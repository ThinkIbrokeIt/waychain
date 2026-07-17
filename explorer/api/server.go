// Package api serves the explorer REST + WebSocket API over the indexed store
// (and the node for live balance lookups). The explorer talks ONLY to this —
// never directly to the node.
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/ThinkIbrokeIt/waychain-explorer/client"
	"github.com/ThinkIbrokeIt/waychain-explorer/store"
)

// Server is the explorer API.
type Server struct {
	store *store.Store
	node  *client.RPC
	upg   websocket.Upgrader

	// live subscriber hub
	subs     map[*wsClient]bool
	subAdd   chan *wsClient
	subDel   chan *wsClient
	broadcast chan []byte
}

type wsClient struct {
	conn *websocket.Conn
	send chan []byte
}

// New creates the API server.
func New(s *store.Store, node *client.RPC) *Server {
	return &Server{
		store:     s,
		node:      node,
		upg:       websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }},
		subs:      make(map[*wsClient]bool),
		subAdd:    make(chan *wsClient),
		subDel:    make(chan *wsClient),
		broadcast: make(chan []byte, 64),
	}
}

// Run starts the subscriber hub. Call once (e.g. in main) before serving.
func (s *Server) Run() {
	for {
		select {
		case c := <-s.subAdd:
			s.subs[c] = true
		case c := <-s.subDel:
			if _, ok := s.subs[c]; ok {
				delete(s.subs, c)
				close(c.send)
			}
		case msg := <-s.broadcast:
			for c := range s.subs {
				select {
				case c.send <- msg:
				default:
					// drop if client is slow; don't block the hub
				}
			}
		}
	}
}

// Notify is called by the indexer after a block is indexed. It loads the
// block from the store and broadcasts a newHead event to WS subscribers.
func (s *Server) Notify(height int64) {
	b, err := s.store.Block(height)
	if err != nil || b == nil {
		return
	}
	blocks, txs, addrs, _ := s.store.Stats()
	msg, err := json.Marshal(map[string]interface{}{
		"type":  "newHead",
		"block": b,
		"stats": map[string]interface{}{
			"blocks":       blocks,
			"transactions": txs,
			"addresses":    addrs,
		},
	})
	if err != nil {
		return
	}
	select {
	case s.broadcast <- msg:
	default:
	}
}

// Handler returns the http.Handler for the API.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/blocks", s.handleBlocks)
	mux.HandleFunc("/api/block/", s.handleBlock)
	mux.HandleFunc("/api/tx/", s.handleTx)
	mux.HandleFunc("/api/address/", s.handleAddress)
	mux.HandleFunc("/api/search", s.handleSearch)
	mux.HandleFunc("/api/stats", s.handleStats)
	mux.HandleFunc("/api/logs", s.handleLogs)
	mux.HandleFunc("/api/precompiles", s.handlePrecompiles)
	mux.HandleFunc("/api/precompile/", s.handlePrecompile)
	mux.HandleFunc("/api/ws", s.handleWS)
	return mux
}

func (s *Server) handleBlocks(w http.ResponseWriter, r *http.Request) {
	limit := atoiDefault(r.URL.Query().Get("limit"), 25)
	offset := atoiDefault(r.URL.Query().Get("offset"), 0)
	if limit > 100 {
		limit = 100
	}
	blocks, err := s.store.Blocks(limit, offset)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, blocks)
}

func (s *Server) handleBlock(w http.ResponseWriter, r *http.Request) {
	h := parseHeightPath(r.URL.Path, "/api/block/")
	if h < 0 {
		writeErr(w, fmt.Errorf("invalid block height"))
		return
	}
	b, err := s.store.Block(h)
	if err != nil {
		writeErr(w, err)
		return
	}
	if b == nil {
		writeJSON(w, map[string]interface{}{"error": "block not found"})
		return
	}
	txs, _ := s.store.TxsByBlock(h)
	writeJSON(w, map[string]interface{}{"block": b, "transactions": txs})
}

func (s *Server) handleTx(w http.ResponseWriter, r *http.Request) {
	hash := normHexPath(r.URL.Path, "/api/tx/")
	t, err := s.store.Tx(hash)
	if err != nil {
		writeErr(w, err)
		return
	}
	if t == nil {
		writeJSON(w, map[string]interface{}{"error": "tx not found"})
		return
	}
	logs, _ := s.store.Logs("", "", t.Block, t.Block, 1000)
	writeJSON(w, map[string]interface{}{"tx": t, "logs": logs})
}

func (s *Server) handleAddress(w http.ResponseWriter, r *http.Request) {
	addr := strings.TrimPrefix(r.URL.Path[len("/api/address/"):], "/")
	if addr == "" {
		writeErr(w, fmt.Errorf("address required"))
		return
	}
	// Balance: resolve to the node key (64-hex). The indexer stored both the
	// raw key and its 20-byte display form; the node keys by 64-hex, so we
	// try the raw input first, then as a display form's key is unknown here
	// we must use the stored raw key. Fetch from store to recover the key.
	key := s.resolveKey(addr)
	balance := "0x0"
	if key != "" {
		if b, err := s.node.Balance("0x" + key); err == nil {
			balance = b
		}
	}
	count, _ := s.store.AddressTxCount(addr)
	limit := atoiDefault(r.URL.Query().Get("limit"), 25)
	offset := atoiDefault(r.URL.Query().Get("offset"), 0)
	txs, _ := s.store.TxsByAddress(addr, limit, offset)
	writeJSON(w, map[string]interface{}{
		"address": addr,
		"balance": balance,
		"txCount": count,
		"txs":     txs,
	})
}

// resolveKey recovers the 64-hex node key for an address (either form) by
// looking up the address_tx table, preferring the 'from' direction's raw key.
func (s *Server) resolveKey(addr string) string {
	key := strings.TrimPrefix(strings.ToLower(addr), "0x")
	// If already a 64-hex key, return as-is.
	if len(key) == 128 {
		return key
	}
	// Else it's a 20-byte display form; recover the raw key from a stored tx.
	rows, err := s.store.TxsByAddress(addr, 1, 0)
	if err != nil || len(rows) == 0 {
		return ""
	}
	// The stored from_addr is the 64-hex key.
	for _, t := range rows {
		if strings.EqualFold(t.From, key) || store.DisplayAddr(t.From) == key {
			return t.From
		}
		if strings.EqualFold(t.To, key) || store.DisplayAddr(t.To) == key {
			return t.To
		}
	}
	return ""
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeErr(w, fmt.Errorf("q required"))
		return
	}
	q = strings.TrimPrefix(q, "0x")
	// block height (decimal)
	if n, err := strconv.ParseInt(q, 10, 64); err == nil {
		b, _ := s.store.Block(n)
		if b != nil {
			writeJSON(w, map[string]interface{}{"type": "block", "result": b})
			return
		}
	}
	// tx hash (64 hex) or address (40/128 hex)
	if len(q) == 64 {
		if t, _ := s.store.Tx("0x" + q); t != nil {
			writeJSON(w, map[string]interface{}{"type": "tx", "result": t})
			return
		}
	}
	if len(q) == 40 || len(q) == 128 {
		if c, _ := s.store.AddressTxCount(q); c > 0 {
			writeJSON(w, map[string]interface{}{"type": "address", "result": map[string]interface{}{"address": q, "txCount": c}})
			return
		}
	}
	writeJSON(w, map[string]interface{}{"type": "unknown", "query": q})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	blocks, txs, addrs, err := s.store.Stats()
	if err != nil {
		writeErr(w, err)
		return
	}
	pending, _ := s.node.PendingCount()
	writeJSON(w, map[string]interface{}{
		"blocks":     blocks,
		"transactions": txs,
		"addresses":  addrs,
		"pending":    pending,
	})
}

func (s *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	addr := q.Get("address")
	topic0 := q.Get("topic0")
	from := int64(-1)
	to := int64(-1)
	if v := q.Get("fromBlock"); v != "" {
		from, _ = strconv.ParseInt(strings.TrimPrefix(v, "0x"), 16, 64)
	}
	if v := q.Get("toBlock"); v != "" {
		to, _ = strconv.ParseInt(strings.TrimPrefix(v, "0x"), 16, 64)
	}
	limit := atoiDefault(q.Get("limit"), 100)
	if limit > 500 {
		limit = 500
	}
	logs, err := s.store.Logs(addr, topic0, from, to, int64(limit))
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, logs)
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upg.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &wsClient{conn: conn, send: make(chan []byte, 16)}
	s.subAdd <- c
	c.send <- []byte(`{"type":"welcome","msg":"WayChain explorer WS"}`)
	// read pump: detect client disconnect, then deregister
	go func() {
		defer func() {
			s.subDel <- c
			c.conn.Close()
		}()
		for {
			if _, _, err := c.conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
	go c.writePump(s.subDel)
}

func (c *wsClient) writePump(subDel chan *wsClient) {
	defer func() {
		subDel <- c
		c.conn.Close()
	}()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

// ── helpers ──

func writeJSON(w http.ResponseWriter, v interface{}) {
	// CORS is owned exclusively by the reverse proxy (nginx) via
	// `add_header Access-Control-Allow-Origin "*" always`. Do NOT set it here:
	// a duplicated ACAO header is invalid per spec and causes browsers to
	// reject the response with a network-level "Failed to fetch" (curl ignores
	// it, which is why the bug was invisible server-side).
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, err error) {
	// CORS owned by nginx (add_header ... always). Do not set ACAO here.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

func parseHeightPath(path, prefix string) int64 {
	s := strings.TrimPrefix(path, prefix)
	s = strings.TrimPrefix(s, "/")
	s = strings.TrimPrefix(s, "0x")
	var v int64
	_, err := fmt.Sscanf(s, "%d", &v)
	if err != nil {
		// try hex
		if _, e := fmt.Sscanf(s, "%x", &v); e == nil {
			return v
		}
		return -1
	}
	return v
}

func normHexPath(path, prefix string) string {
	s := strings.TrimPrefix(path, prefix)
	s = strings.TrimPrefix(s, "/")
	if !strings.HasPrefix(s, "0x") {
		return "0x" + s
	}
	return s
}
