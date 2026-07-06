package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"testing"

	"github.com/wink/waychain-consensus/evm"
)

// TestFullTxPipeline tests the full transaction pipeline:
// RPC eth_sendRawTransaction → Pool → Block Production → eth_getTransactionByHash → eth_getTransactionReceipt
func TestFullTxPipeline(t *testing.T) {
	chain := NewChain()

	// Create and fund an account
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	fromAddr := hex.EncodeToString(pub)

	// Fund it
	acc := chain.State.GetOrCreateAccount(fromAddr)
	acc.Balance.SetUint64(1_000_000)
	acc.Nonce = 0
	acc.DoxDevLevel = 3

	// Create an RPC server for this chain (in-memory, no HTTP server needed for this test)
	// We'll test the RPC method logic directly by calling handleMethod
	rpc := NewRPCServer(chain, 9545)

	// Get current nonce (should be 0)
	nonceResult, err := rpc.handleMethod("eth_getTransactionCount", jsonRaw(`["0x`+fromAddr+`"]`))
	if err != nil {
		t.Fatalf("Failed to get nonce: %v", err)
	}
	nonceHex := nonceResult.(string)
	nonce := uint64(0)
	fmt.Sscanf(nonceHex, "0x%x", &nonce)
	t.Logf("Current nonce: %d", nonce)

	// Check balance
	balResult, err := rpc.handleMethod("eth_getBalance", jsonRaw(`["0x`+fromAddr+`"]`))
	if err != nil {
		t.Fatalf("Failed to get balance: %v", err)
	}
	t.Logf("Balance: %s", balResult.(string))

	// Build transaction
	tx := Transaction{
		Nonce:    nonce,
		From:     fromAddr,
		To:       "bob",
		Value:    big.NewInt(5000),
		GasLimit: 21000,
		GasPrice: 1,
		Lane:     evm.ConsensusLane,
	}

	// Compute hash
	hashInput := fmt.Sprintf("%d:%s:%s:%s:%d:%d:%d:%x:%x",
		tx.Nonce, tx.From, tx.To, tx.Value.String(), tx.GasLimit, tx.Lane, len(tx.Data), tx.Data, tx.EncryptedData)
	tx.Hash = sha256.Sum256([]byte(hashInput))

	// Sign
	tx.Signature = ed25519.Sign(priv, tx.Hash[:])

	// Serialize
	ser := SerializeTxHex(&tx)
	t.Logf("Serialized TX: %s", ser)

	// Submit via RPC (this calls handleMethod which is what eth_sendRawTransaction does)
	txHashResult, err := rpc.handleMethod("eth_sendRawTransaction", jsonRaw(`["0x`+ser+`"]`))
	if err != nil {
		t.Fatalf("Submit error: %v", err)
	}
	txHash := txHashResult.(string)
	t.Logf("TX hash: %s", txHash)

	// Verify it's in the pool
	if len(chain.Pool.Consensus) != 1 {
		t.Fatalf("Expected 1 tx in pool, got %d", len(chain.Pool.Consensus))
	}
	t.Logf("✅ Transaction added to pool")

	// Produce a block
	vs := NewValidatorSet()
	vs.Add(NewValidatorID(0x01), 5000)
	proposer := vs.SelectProposer(1)
	block := chain.ProduceBlock(proposer)

	if len(block.Transactions) != 1 {
		t.Fatalf("Expected 1 tx in block, got %d", len(block.Transactions))
	}
	t.Logf("✅ Transaction mined in block #%d", block.Height)

	// Verify tx by hash
	txByHashResult, err := rpc.handleMethod("eth_getTransactionByHash", jsonRaw(`["`+txHash+`"]`))
	if err != nil {
		t.Fatalf("Failed to get tx by hash: %v", err)
	}
	if txByHashResult == nil {
		t.Fatal("Transaction not found by hash")
	}
	t.Logf("✅ Transaction found by hash: %+v", txByHashResult)

	// Verify receipt
	receiptResult, err := rpc.handleMethod("eth_getTransactionReceipt", jsonRaw(`["`+txHash+`"]`))
	if err != nil {
		t.Fatalf("Failed to get receipt: %v", err)
	}
	if receiptResult == nil {
		t.Fatal("Receipt not found")
	}
	t.Logf("✅ Receipt: %+v", receiptResult)

	// Verify receipt fields
	receipt := receiptResult.(map[string]interface{})
	if receipt["status"] != "0x1" {
		t.Fatalf("Expected status 0x1, got %v", receipt["status"])
	}
	if receipt["blockNumber"] != "0x1" {
		t.Fatalf("Expected blockNumber 0x1, got %v", receipt["blockNumber"])
	}
	t.Logf("✅ All receipt fields correct")
}

func jsonRaw(s string) json.RawMessage {
	return json.RawMessage(s)
}