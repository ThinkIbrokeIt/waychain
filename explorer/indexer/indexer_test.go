package indexer

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ThinkIbrokeIt/waychain-explorer/client"
	"github.com/ThinkIbrokeIt/waychain-explorer/store"
)

// fakeNode is a minimal JSON-RPC server returning real-shaped responses for
// the methods the indexer consumes. It emulates a node with one block (height
// 0) containing one transfer tx + one precompile log (post-EXPL-2 receipt).
func fakeNode(t *testing.T) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string        `json:"method"`
			Params []interface{} `json:"params"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		w.Header().Set("Content-Type", "application/json")

		switch req.Method {
		case "eth_blockNumber":
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": 1, "result": "0x0"})
		case "eth_getBlockByNumber":
			block := map[string]interface{}{
				"number":     "0x0",
				"hash":       "0xabc",
				"parentHash": "0x0",
				"timestamp":  "0x64",
				"proposer":   "validator1",
				"transactions": []map[string]interface{}{
					{
						"nonce":     "0x0",
						"from":      "0x" + strings.Repeat("11", 32), // 64-hex key
						"to":        "0x" + strings.Repeat("22", 32),
						"value":     "0x" + strings.Repeat("0", 60) + "a",
						"gasLimit":  "0x7530",
						"gasPrice":  "0x1",
						"gasUsed":   "0x5208", // 21000 — real for a transfer
						"data":      "0x",
						"hash":      "0xdeadbeef",
						"signature": "0xsig",
						"lane":      "0x0",
					},
				},
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": 1, "result": block})
		case "eth_getTransactionReceipt":
			receipt := map[string]interface{}{
				"transactionHash":   "0xdeadbeef",
				"blockHash":         "0xabc",
				"blockNumber":       "0x0",
				"from":              "0x" + strings.Repeat("11", 32),
				"to":                "0x" + strings.Repeat("22", 32),
				"status":            "0x1",
				"gasUsed":           "0x5208",
				"cumulativeGasUsed": "0x5208",
				"logs": []map[string]interface{}{
					{
						"address":   "0x" + strings.Repeat("00", 19) + "18",
						"topics":    []string{"0xdeposited", "0xvault"},
						"data":      "0x01",
						"blockNumber": "0x0",
						"transactionHash":  "0xdeadbeef",
						"logIndex":  "0x0",
					},
				},
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": 1, "result": receipt})
		default:
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": 1, "result": nil})
		}
	}))
}

func TestIndexerReplayStoresRealData(t *testing.T) {
	srv := fakeNode(t)
	defer srv.Close()

	s, err := store.Open(":memory:")
	if err != nil {
		t.Fatalf("store: %v", err)
	}
	defer s.Close()

	node := client.New(srv.URL)
	ix := New(node, s)
	if err := ix.replay(); err != nil {
		t.Fatalf("replay: %v", err)
	}

	// 1 block indexed.
	head, _ := s.Head()
	if head != 0 {
		t.Fatalf("expected head 0, got %d", head)
	}
	blocks, _ := s.Blocks(10, 0)
	if len(blocks) != 1 {
		t.Fatalf("expected 1 block, got %d", len(blocks))
	}
	if blocks[0].TxCount != 1 {
		t.Fatalf("expected txCount 1, got %d", blocks[0].TxCount)
	}

	// 1 tx stored with real gasUsed (21000).
	txs, _ := s.TxsByBlock(0)
	if len(txs) != 1 {
		t.Fatalf("expected 1 tx, got %d", len(txs))
	}
	if txs[0].GasUsed != 21000 {
		t.Fatalf("expected gasUsed 21000, got %d", txs[0].GasUsed)
	}

	// 1 log stored.
	logs, _ := s.Logs("", "", 0, 0, 10)
	if len(logs) != 1 {
		t.Fatalf("expected 1 log, got %d", len(logs))
	}
	if logs[0].Address != "0x"+strings.Repeat("00", 19)+"18" {
		t.Fatalf("unexpected log address: %s", logs[0].Address)
	}

	// Address index stores BOTH the 64-hex key and its 20-byte display form.
	key64 := strings.Repeat("11", 32)
	display := store.DisplayAddr(key64)
	if cnt, _ := s.AddressTxCount(key64); cnt != 1 {
		t.Fatalf("64-hex key should have 1 tx, got %d", cnt)
	}
	if cnt, _ := s.AddressTxCount(display); cnt != 1 {
		t.Fatalf("20-byte display form should resolve to 1 tx, got %d", cnt)
	}
}
