#!/usr/bin/env python3
import json
import subprocess
import time
import hashlib

# Known values
from_addr = "1146875a27c44539bcd247bb705a213827efbe29be4d77b99bb887a84230f459"
priv_hex = "efc258420fa40a614831834dd50faa2babd6e8464474acd3c436ca23d03adb851146875a27c44539bcd247bb705a213827efbe29be4d77b99bb887a84230f459"
nonce = 1

# Use the go test to build and sign the transaction
# Actually, let's just run a Go program to sign and submit

go_code = '''
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

	"github.com/wink/waychain-consensus/evm"
)

func main() {
	fromAddr := "''' + from_addr + '''"
	privKeyHex := "''' + priv_hex + '''"
	nonce := uint64(''' + str(nonce) + ''')
	
	privBytes, _ := hex.DecodeString(privKeyHex)
	priv := ed25519.PrivateKey(privBytes)
	
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
	hashInput := fmt.Sprintf("%%d:%%s:%%s:%%s:%%d:%%d:%%d:%%x:%%x",
		tx.Nonce, tx.From, tx.To, tx.Value.String(), tx.GasLimit, tx.Lane, len(tx.Data), tx.Data, tx.EncryptedData)
	tx.Hash = sha256.Sum256([]byte(hashInput))
	
	// Sign
	tx.Signature = ed25519.Sign(priv, tx.Hash[:])
	
	// Serialize
	ser := SerializeTxHex(&tx)
	
	fmt.Println("Serialized TX:", ser)
	
	// Submit via RPC
	url := "http://localhost:9545"
	payload := fmt.Sprintf(`{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["0x%%s"],"id":1}`, ser)
	
	resp, err := http.Post(url, "application/json", strings.NewReader(payload))
	if err != nil {
		fmt.Println("Submit error:", err)
		return
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	
	if errVal, ok := result["error"]; ok && errVal != nil {
		fmt.Println("Submit error:", errVal)
		return
	}
	
	txHash := result["result"].(string)
	fmt.Println("TX hash:", txHash)
}
'''

# Write and run
with open('/tmp/sign_submit.go', 'w') as f:
    f.write(go_code)

result = subprocess.run(['cd', '/home/wink/projects/waychain-consensus', '&&', 'go', 'run', '/tmp/sign_submit.go'], 
                       shell=True, capture_output=True, text=True, cwd='/home/wink/projects/waychain-consensus')
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("Return code:", result.returncode)