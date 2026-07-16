// Package indexer replays WayChain history from genesis and tails new blocks
// over WS, persisting everything to the store. It is the spine the explorer
// reads from — the node stays a node; the indexer makes data queryable.
package indexer

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ThinkIbrokeIt/waychain-explorer/client"
	"github.com/ThinkIbrokeIt/waychain-explorer/store"
)

// Indexer replays + tails a node into a Store.
type Indexer struct {
	node  *client.RPC
	store *store.Store
}

// New creates an indexer for node -> store.
func New(node *client.RPC, s *store.Store) *Indexer {
	return &Indexer{node: node, store: s}
}

// Run replays from the next unindexed block to head, then tails new heads via
// WS. It blocks; run in a goroutine if you also serve the API.
func (ix *Indexer) Run() error {
	if err := ix.replay(); err != nil {
		return fmt.Errorf("replay: %w", err)
	}
	// Continuous catch-up: replay on a ticker so gaps created while the
	// service was down/restarting (blocks produced between restarts) get
	// backfilled. The WS tail only receives heads AFTER subscription, so it
	// cannot fill a gap that already exists at startup.
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if err := ix.replay(); err != nil {
				print("replay tick: %v\n", err)
			}
		}
	}()
	return ix.tail()
}

// replay fills the gap between the store head and the node head.
func (ix *Indexer) replay() error {
	nodeHead, err := ix.node.BlockNumber()
	if err != nil {
		return fmt.Errorf("node blockNumber: %w", err)
	}
	storeHead, err := ix.store.Head()
	if err != nil {
		return err
	}
	start := storeHead + 1
	if start < 0 {
		start = 0
	}
	for h := start; h <= nodeHead; h++ {
		if err := ix.indexBlock(h); err != nil {
			return fmt.Errorf("index block %d: %w", h, err)
		}
		// Throttle replay: the node enforces 100 req/s/IP (token bucket).
		// ~2 RPCs/block -> ~30ms keeps us safely under the limit.
		time.Sleep(30 * time.Millisecond)
	}
	return nil
}

// tail subscribes to new heads and indexes each as it lands.
func (ix *Indexer) tail() error {
	heads, _, err := ix.node.Subscribe()
	if err != nil {
		return fmt.Errorf("subscribe: %w", err)
	}
	for b := range heads {
		h, err := parseHeight(b.Number)
		if err != nil {
			continue
		}
		// Guard against re-indexing an already-stored block.
		have, err := ix.store.HasBlock(h)
		if err != nil {
			continue
		}
		if have {
			continue
		}
		if err := ix.indexBlock(h); err != nil {
			// Non-fatal: continue tailing.
			fmt.Printf("index block %d: %v\n", h, err)
		}
	}
	return nil
}

// indexBlock fetches a block + each tx receipt and persists them.
func (ix *Indexer) indexBlock(height int64) error {
	b, err := callWithRetry(func() (*client.Block, error) { return ix.node.Block(height) })
	if err != nil {
		return err
	}
	if b == nil {
		return nil
	}
	ts, err := store.HexToUint64(b.Timestamp)
	if err != nil {
		ts = 0
	}
	block := store.BlockRow{
		Height:    height,
		Hash:      normHex(b.Hash),
		Parent:    normHex(b.ParentHash),
		Timestamp: int64(ts),
		Proposer:  b.Proposer,
		TxCount:   len(b.Transactions),
	}

	txs := make([]store.TxRow, 0, len(b.Transactions))
	logs := make([]store.LogRow, 0, len(b.Transactions))
	for i, raw := range b.Transactions {
		var t client.Tx
		if err := json.Unmarshal(raw, &t); err != nil {
			return fmt.Errorf("decode tx %d: %w", i, err)
		}
		txRow := store.TxRow{
			Hash:      normHex(t.Hash),
			Block:     height,
			Idx:       i,
			Nonce:     int64(mustHexInt(t.Nonce)),
			From:      strings.TrimPrefix(t.From, "0x"),
			To:        strings.TrimPrefix(t.To, "0x"),
			Value:     t.Value,
			GasLimit:  int64(mustHexInt(t.GasLimit)),
			GasPrice:  int64(mustHexInt(t.GasPrice)),
			Lane:      int(mustHexInt(t.Lane)),
			Data:      t.Data,
			Timestamp: int64(ts),
		}
		// Real gasUsed + logs come from the receipt (post-EXPL-2).
		if rc, err := callWithRetry(func() (*client.Receipt, error) { return ix.node.Receipt(txRow.Hash) }); err == nil && rc != nil {
			txRow.GasUsed = int64(mustHexInt(rc.GasUsed))
			for _, l := range rc.Logs {
				topics := make([]string, 0, len(l.Topics))
				for _, tp := range l.Topics {
					topics = append(topics, strings.TrimPrefix(tp, "0x"))
				}
				logs = append(logs, store.LogRow{
					Address:  strings.TrimPrefix(l.Address, "0x"),
					Topics:   topics,
					Data:     strings.TrimPrefix(l.Data, "0x"),
					Block:    height,
					TxHash:   normHex(l.TxHash),
					LogIndex: int(mustHexInt(l.LogIndex)),
				})
			}
		}
		txs = append(txs, txRow)
	}
	return ix.store.SaveBlock(block, txs, logs)
}

func normHex(s string) string {
	s = strings.TrimPrefix(s, "0x")
	if s == "" {
		return ""
	}
	return "0x" + s
}

func parseHeight(s string) (int64, error) {
	s = strings.TrimPrefix(strings.Trim(s, "\""), "0x")
	var v int64
	_, err := fmt.Sscanf(s, "%x", &v)
	return v, err
}

func mustHexInt(s string) uint64 {
	v, err := store.HexToUint64(s)
	if err != nil {
		return 0
	}
	return v
}

// callWithRetry runs an RPC call, retrying with backoff on rate-limit errors
// (-32005). The node enforces 100 req/s/IP; the replay throttle keeps us under
// that, but bursts/tail can still trip it, so we back off and retry.
func callWithRetry[T any](fn func() (T, error)) (T, error) {
	var zero T
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		res, err := fn()
		if err == nil {
			return res, nil
		}
		lastErr = err
		if !isRateLimitErr(err) {
			return zero, err
		}
		backoff := time.Duration(200*(attempt+1)) * time.Millisecond
		time.Sleep(backoff)
	}
	return zero, lastErr
}

func isRateLimitErr(err error) bool {
	return strings.Contains(err.Error(), "rate limit exceeded") ||
		strings.Contains(err.Error(), "-32005")
}
