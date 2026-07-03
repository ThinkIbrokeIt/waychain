package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/wink/waychain-consensus/evm"
)

// TestSubmitDevTx submits a transaction from the dev key
func TestSubmitDevTx(t *testing.T) {
	// Use the dev key from the running node
	fromAddr := "3faf5f01b28dbe96c5a51cf691fda2df0bf0cc830dfbb081e6c7badc71addb7a"
	privKeyHex := "848bc494a16d7a9bd11b6c5433be5dfa558a87df1f5f7efc4de1783fe973eeff3faf5f01b28dbe96c5a51cf691fda2df0bf0cc830dfbb081e6c7badc71addb7a"
	
	privBytes, _ := hex.DecodeString(privKeyHex)
	priv := ed25519.PrivateKey(privBytes)
	
	// Use current nonce (6 after previous tx)
	nonce := uint64(6)
	
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
	
	// Submit via RPC
	url := "http://localhost:9545"
	payload := fmt.Sprintf(`{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["0x%s"],"id":1}`, ser)
	
	resp, err := http.Post(url, "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatalf("Submit error: %v", err)
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	
	if errVal, ok := result["error"]; ok && errVal != nil {
		t.Fatalf("Submit error: %v", errVal)
	}
	
	txHash := result["result"].(string)
	t.Logf("TX hash: %s", txHash)
	
	// Wait for mining with retry
	maxRetries := 10
	var txResult map[string]interface{}
	for i := 0; i < maxRetries; i++ {
		time.Sleep(1 * time.Second)
		txResult = rpcCall("eth_getTransactionByHash", []interface{}{txHash})
		if txResult["result"] != nil {
			break
		}
		t.Logf("Waiting for tx to be indexed... attempt %d/%d", i+1, maxRetries)
	}
	
	if txResult["result"] == nil {
		t.Fatal("Transaction not found after mining")
	}
	t.Logf("✅ Transaction mined!")
	
	receiptResult := rpcCall("eth_getTransactionReceipt", []interface{}{txHash})
	t.Logf("✅ Receipt: %+v", receiptResult["result"])
}

func rpcCall(method string, params ...interface{}) map[string]interface{} {
	url := "http://localhost:9545"
	payload := map[string]interface{}{"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
	data, _ := json.Marshal(payload)
	
	resp, err := http.Post(url, "application/json", strings.NewReader(string(data)))
	if err != nil {
		return map[string]interface{}{"error": err.Error()}
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result
}