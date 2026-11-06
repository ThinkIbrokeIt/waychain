package store

import (
	"strings"
	"testing"
)

func TestDisplayAddr(t *testing.T) {
	// 64-hex ed25519 pubkey (node key) -> 20-byte display (pub[0:40]).
	key := strings.Repeat("ab", 32)
	got := DisplayAddr(key)
	if got != strings.Repeat("ab", 20) {
		t.Fatalf("DisplayAddr = %s, want %s", got, strings.Repeat("ab", 20))
	}
	// Already a 20-byte form passes through.
	if got := DisplayAddr(strings.Repeat("cd", 20)); got != strings.Repeat("cd", 20) {
		t.Fatalf("DisplayAddr short = %s", got)
	}
}

func TestSaveAndQueryBlock(t *testing.T) {
	s, err := Open(":memory:")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer s.Close()

	b := BlockRow{Height: 1, Hash: "0xh", Parent: "0x0", Timestamp: 100, Proposer: "v1", TxCount: 1}
	txs := []TxRow{{
		Hash: "0xtx", Block: 1, Idx: 0, Nonce: 0,
		From: strings.Repeat("11", 32), To: strings.Repeat("22", 32),
		Value: "0x5", GasLimit: 30000, GasPrice: 1, GasUsed: 21000, Lane: 0, Data: "0x", Timestamp: 100,
	}}
	logs := []LogRow{{
		Address: strings.Repeat("00", 19) + "18", Topics: []string{"0xdeposited"}, Data: "01",
		Block: 1, TxHash: "0xtx", LogIndex: 0,
	}}
	if err := s.SaveBlock(b, txs, logs); err != nil {
		t.Fatalf("save: %v", err)
	}

	got, _ := s.Block(1)
	if got == nil || got.TxCount != 1 {
		t.Fatalf("block not stored")
	}
	storedTxs, _ := s.TxsByBlock(1)
	if len(storedTxs) != 1 || storedTxs[0].GasUsed != 21000 {
		t.Fatalf("tx not stored correctly: %+v", storedTxs)
	}
	// Address resolution: query by display form resolves the 64-hex key's tx.
	cnt, _ := s.AddressTxCount(DisplayAddr(txs[0].From))
	if cnt != 1 {
		t.Fatalf("display-form address query failed: cnt=%d", cnt)
	}
	gotLogs, _ := s.Logs("", "", 1, 1, 10)
	if len(gotLogs) != 1 {
		t.Fatalf("log not stored: %d", len(gotLogs))
	}
	blocks, txs2, addrs, _ := s.Stats()
	// 4 distinct indexed address forms: from/to each stored as 64-hex key AND
	// 20-byte display form. That's expected (address resolution needs both).
	if blocks != 1 || txs2 != 1 || addrs != 4 {
		t.Fatalf("stats wrong: blocks=%d txs=%d addrs=%d (want 1/1/4)", blocks, txs2, addrs)
	}
}
