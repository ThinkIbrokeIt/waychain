# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
#!/usr/bin/env python3
"""
Submit a real Ed25519-signed transaction to WayChain and verify it mines.
"""
import json
import subprocess
import time
import hashlib
import os

# Use Go's Ed25519 implementation via subprocess (simplest reliable approach)
# Generate a key pair using the waychain binary itself

# Actually, let's just use Python's cryptography library
try:
    from cryptography.hazmat.primitives.asymmetric import ed25519
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.backends import default_backend
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    print("cryptography not installed, using alternative method")

def sha256_hex(data):
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()

def be_encode(val, byte_len):
    """Big-endian encode integer to bytes"""
    return val.to_bytes(byte_len, 'big')

def rpc_call(method, params=[]):
    cmd = ['curl', '-s', 'http://localhost:9545', '-X', 'POST', '-H', 'Content-Type: application/json',
           '-d', json.dumps({"jsonrpc":"2.0","method":method,"params":params,"id":1})]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)

if HAS_CRYPTO:
    # Generate Ed25519 key pair
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    pub_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )
    priv_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    from_addr = pub_bytes.hex()
    
    print(f"=== Generated Ed25519 keypair ===")
    print(f"From address: {from_addr}")
    print(f"Private key: {priv_bytes.hex()}")
    
    # Build transaction
    nonce = 0
    to_addr = "bob"
    value = 5000
    gas_limit = 21000
    gas_price = 1
    lane = 0  # ConsensusLane
    
    # Compute hash input (matching Go's format)
    # hashInput := fmt.Sprintf("%d:%s:%s:%s:%d:%d:%d:%x:%x",
    #     tx.Nonce, tx.From, tx.To, tx.Value.String(), tx.GasLimit, tx.Lane, len(tx.Data), tx.Data, tx.EncryptedData)
    
    hash_input = f"{nonce}:{from_addr}:{to_addr}:{value}:{gas_limit}:{lane}:0:"
    tx_hash = bytes.fromhex(sha256_hex(hash_input))
    
    print(f"Tx hash: 0x{tx_hash.hex()}")
    
    # Sign the hash
    signature = private_key.sign(tx_hash)
    print(f"Signature: 0x{signature.hex()}")
    
    # Serialize transaction in WayChain binary format
    # nonce:8, fromLen:2, from:var, toLen:2, to:var, valueLen:2, value:var, gasLimit:8, gasPrice:8, lane:1, encDataLen:4, dataLen:4, sigLen:2, signature
    
    value_bytes = str(value).encode()  # In Go, it's big.Int bytes, but we use 0 value
    
    buf = b''
    buf += be_encode(nonce, 8)                    # nonce
    buf += be_encode(len(from_addr), 2)           # fromLen
    buf += from_addr.encode()                     # from
    buf += be_encode(len(to_addr), 2)             # toLen
    buf += to_addr.encode()                       # to
    buf += be_encode(len(value_bytes), 2)         # valueLen
    buf += value_bytes                             # value (empty for 0)
    buf += be_encode(gas_limit, 8)                # gasLimit
    buf += be_encode(gas_price, 8)                # gasPrice
    buf += be_encode(lane, 1)                     # lane
    buf += be_encode(0, 4)                        # encDataLen
    buf += be_encode(0, 4)                        # dataLen
    buf += be_encode(len(signature), 2)             # sigLen
    buf += signature                              # signature
    
    tx_hex = buf.hex()
    print(f"Serialized TX (hex): {tx_hex}")
    
    # Submit via RPC
    print(f"\n=== Submitting transaction ===")
    result = rpc_call('eth_sendRawTransaction', [f'0x{tx_hex}'])
    print(f"Result: {json.dumps(result, indent=2)}")
    
    if 'error' in result and result['error']:
        print(f"Error: {result['error']['message']}")
        exit(1)
    
    tx_hash_result = result['result']
    print(f"Submitted tx hash: {tx_hash_result}")
    
    # Wait for next block
    print(f"\n=== Waiting for mining ===")
    initial_height = int(rpc_call('eth_blockNumber')['result'], 16)
    print(f"Current height: {initial_height}")
    
    for i in range(15):
        time.sleep(1)
        current_height = int(rpc_call('eth_blockNumber')['result'], 16)
        if current_height > initial_height:
            print(f"New block at height: {current_height}")
            break
    
    # Verify transaction
    print(f"\n=== Verifying transaction ===")
    tx = rpc_call('eth_getTransactionByHash', [tx_hash_result])
    print(f"Tx lookup: {json.dumps(tx, indent=2)}")
    
    receipt = rpc_call('eth_getTransactionReceipt', [tx_hash_result])
    print(f"Receipt: {json.dumps(receipt, indent=2)}")
    
else:
    print("Need to install cryptography: pip install cryptography")