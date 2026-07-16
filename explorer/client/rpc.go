// Package client is a minimal WayChain JSON-RPC client used by the indexer
// (replay + tail) and the API (balance lookups). It speaks the node's real
// RPC surface: eth_getBlockByNumber(fullTx), eth_getTransactionReceipt,
// eth_getLogs, eth_getBalance, eth_blockNumber, and WS eth_subscribe/newHeads.
package client

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// RPC is a JSON-RPC client for a WayChain node.
type RPC struct {
	url        string
	http       *http.Client
	wsDialer   *websocket.Dialer
	reqID      int
}

// New creates a client for the node at nodeURL (http://host:port).
func New(nodeURL string) *RPC {
	return &RPC{
		url:      strings.TrimRight(nodeURL, "/"),
		http:     &http.Client{Timeout: 30 * time.Second},
		wsDialer: &websocket.Dialer{HandshakeTimeout: 10 * time.Second},
	}
}

type rpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *rpcError       `json:"error"`
}

// call performs a single JSON-RPC request.
func (c *RPC) call(method string, params ...interface{}) (json.RawMessage, error) {
	c.reqID++
	body, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: c.reqID, Method: method, Params: params})
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Post(c.url, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("rpc post: %w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var r rpcResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, fmt.Errorf("rpc decode: %w", err)
	}
	if r.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", r.Error.Code, r.Error.Message)
	}
	return r.Result, nil
}

// Block is a node block (fullTx) response shape.
type Block struct {
	Number       string      `json:"number"`
	Hash         string      `json:"hash"`
	ParentHash   string      `json:"parentHash"`
	Timestamp    string      `json:"timestamp"`
	Proposer     string      `json:"proposer"`
	Transactions []json.RawMessage `json:"transactions"`
}

// Tx is a transaction object as returned in a full block.
type Tx struct {
	Nonce       string `json:"nonce"`
	From        string `json:"from"`
	To          string `json:"to"`
	Value       string `json:"value"`
	GasLimit    string `json:"gasLimit"`
	GasPrice    string `json:"gasPrice"`
	GasUsed     string `json:"gasUsed"`
	Data        string `json:"data"`
	Hash        string `json:"hash"`
	Signature   string `json:"signature"`
	Lane        string `json:"lane"`
	EncryptedData string `json:"encryptedData,omitempty"`
}

// Log is an EVM log as returned by eth_getLogs / receipts.
type Log struct {
	Address string   `json:"address"`
	Topics  []string `json:"topics"`
	Data    string   `json:"data"`
	BlockNumber string `json:"blockNumber"`
	TxHash  string   `json:"transactionHash"`
	LogIndex string `json:"logIndex"`
}

// Receipt is a transaction receipt (post-EXPL-2: real gasUsed + logs).
type Receipt struct {
	TxHash    string `json:"transactionHash"`
	BlockHash string `json:"blockHash"`
	BlockNumber string `json:"blockNumber"`
	From      string `json:"from"`
	To        string `json:"to"`
	Status    string `json:"status"`
	GasUsed   string `json:"gasUsed"`
	CumulativeGasUsed string `json:"cumulativeGasUsed"`
	Logs      []Log  `json:"logs"`
}

// BlockNumber returns the latest block height (decimal int).
func (c *RPC) BlockNumber() (int64, error) {
	r, err := c.call("eth_blockNumber")
	if err != nil {
		return 0, err
	}
	return parseHexInt(r)
}

// Block fetches a block by height (decimal int) with full transactions.
func (c *RPC) Block(height int64) (*Block, error) {
	r, err := c.call("eth_getBlockByNumber", fmt.Sprintf("0x%x", height), true)
	if err != nil {
		return nil, err
	}
	if len(r) == 0 || string(r) == "null" {
		return nil, nil
	}
	var b Block
	if err := json.Unmarshal(r, &b); err != nil {
		return nil, err
	}
	return &b, nil
}

// Receipt fetches a transaction receipt (real gasUsed + logs post-EXPL-2).
func (c *RPC) Receipt(txHash string) (*Receipt, error) {
	r, err := c.call("eth_getTransactionReceipt", txHash)
	if err != nil {
		return nil, err
	}
	if len(r) == 0 || string(r) == "null" {
		return nil, nil
	}
	var rc Receipt
	if err := json.Unmarshal(r, &rc); err != nil {
		return nil, err
	}
	return &rc, nil
}

// Balance fetches an account balance by key (64-hex pubkey per node convention).
func (c *RPC) Balance(key string) (string, error) {
	r, err := c.call("eth_getBalance", key, "latest")
	if err != nil {
		return "0x0", err
	}
	return string(r), nil
}

// PendingCount returns the node's pending tx pool size.
func (c *RPC) PendingCount() (int, error) {
	r, err := c.call("txpool_status")
	if err == nil {
		var m map[string]string
		if json.Unmarshal(r, &m) == nil {
			if p, ok := m["pending"]; ok {
				var n int
				if _, e := fmt.Sscanf(p, "0x%x", &n); e == nil {
					return n, nil
				}
			}
		}
	}
	// Fallback: some nodes expose eth_pendingTransactions count.
	r2, err := c.call("eth_pendingTransactions")
	if err != nil {
		return 0, nil
	}
	var arr []json.RawMessage
	if json.Unmarshal(r2, &arr) == nil {
		return len(arr), nil
	}
	return 0, nil
}

// Subscribe connects to the node WS and returns a channel of new-head blocks.
// It is the tail feed for the indexer.
func (c *RPC) Subscribe() (<-chan Block, error, error) {
	wsURL := "ws" + strings.TrimPrefix(c.url, "http")
	conn, _, err := c.wsDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("ws dial: %w", err)
	}
	id := 1
	sub := rpcRequest{JSONRPC: "2.0", ID: id, Method: "eth_subscribe", Params: []interface{}{"newHeads"}}
	if err := conn.WriteJSON(sub); err != nil {
		conn.Close()
		return nil, nil, err
	}
	// Read subscription ack.
	var ack struct {
		Result string `json:"result"`
	}
	if err := conn.ReadJSON(&ack); err != nil {
		conn.Close()
		return nil, nil, err
	}

	out := make(chan Block, 16)
	go func() {
		defer conn.Close()
		for {
			var msg struct {
				Params struct {
					Result struct {
						Number    string `json:"number"`
						Hash      string `json:"hash"`
						ParentHash string `json:"parentHash"`
						Timestamp string `json:"timestamp"`
					} `json:"result"`
				} `json:"params"`
				Method string `json:"method"`
			}
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}
			if msg.Method != "eth_subscription" {
				continue
			}
			b := Block{
				Number:     msg.Params.Result.Number,
				Hash:       msg.Params.Result.Hash,
				ParentHash: msg.Params.Result.ParentHash,
				Timestamp:  msg.Params.Result.Timestamp,
			}
			out <- b
		}
	}()
	return out, nil, nil
}

// parseHexInt parses a hex (0x...) or decimal JSON number string.
func parseHexInt(r json.RawMessage) (int64, error) {
	s := strings.Trim(string(r), "\"")
	s = strings.TrimPrefix(s, "0x")
	if s == "" || s == "null" {
		return 0, nil
	}
	var v int64
	if _, err := fmt.Sscanf(s, "%x", &v); err != nil {
		// try decimal
		if _, e := fmt.Sscanf(s, "%d", &v); e == nil {
			return v, nil
		}
		return 0, err
	}
	return v, nil
}

// DecodeHex decodes a 0x-prefixed hex string to bytes.
func DecodeHex(s string) ([]byte, error) {
	s = strings.TrimPrefix(s, "0x")
	if s == "" {
		return nil, nil
	}
	return hex.DecodeString(s)
}
