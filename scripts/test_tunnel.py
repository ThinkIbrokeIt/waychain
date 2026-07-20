# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
#!/usr/bin/env python3
import json
import subprocess
import time

# First, let's check the RPC and get the block height
def rpc_call(method, params=[]):
    cmd = ['curl', '-s', 'http://localhost:9545', '-X', 'POST', 
           '-H', 'Content-Type: application/json',
           '-d', json.dumps({"jsonrpc":"2.0","method":method,"params":params,"id":1})]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)

# Check current height
height = rpc_call('eth_blockNumber')
print(f"Current block height: {height['result']}")

# Get pool size
pool = rpc_call('eth_getBlockByNumber', ['latest', False])
print(f"Latest block tx count: {pool['result']['transactions']}")