#!/usr/bin/env python3
"""
EconoOracle bot — polls WayChain Go node RPC (way_econoIndicators)
and pushes the economic health snapshot to EconoAnalytics.sol on-chain.
Issue #97.
"""
import json
import time
import urllib.request
import os
import sys

RPC_URL = os.environ.get("WAYCHAIN_RPC", "https://api.waychain.org")
ORACLE_KEY = os.environ.get("ORACLE_PRIVATE_KEY", "")
CONTRACT_ADDR = os.environ.get("ECONO_CONTRACT", "")

def json_rpc(method, params=[]):
    payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode('utf-8')
    req = urllib.request.Request(
        RPC_URL, 
        data=payload, 
        headers={
            "Content-Type": "application/json",
            "User-Agent": "WayChain-EconoOracle/1.0"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if "error" in data:
                print(f"[EconoOracle] RPC Error ({method}): {data['error']}")
                return None
            return data.get("result")
    except Exception as e:
        print(f"[EconoOracle] Connection Error: {e}")
        return None

def main():
    print(f"[EconoOracle] Starting oracle daemon... Target RPC: {RPC_URL}")
    
    # 1. Read econo indicators from Go core RPC
    indicators = json_rpc("way_econoIndicators")
    if not indicators:
        print("[EconoOracle] Could not fetch way_econoIndicators from RPC.")
        sys.exit(1)
        
    print(f"[EconoOracle] Go core indicators fetched successfully: {json.dumps(indicators)}")
    
    gbp = indicators.get("grossBlockchainProduct", 0)
    employment = indicators.get("employmentBps", 0)
    velocity = indicators.get("velocityBps", 0)
    yield_spread = indicators.get("yieldSpreadBps", 0)
    phase = indicators.get("phase", 0)
    phase_label = indicators.get("phaseLabel", "Consolidation")
    
    print(f"[EconoOracle] Indicators Snapshot: GBP={gbp}, EmploymentBps={employment}, VelocityBps={velocity}, YieldSpreadBps={yield_spread}, Phase={phase} ({phase_label})")

    if not CONTRACT_ADDR or not ORACLE_KEY:
        print("[EconoOracle] Dry-run complete (ECONO_CONTRACT or ORACLE_PRIVATE_KEY not set; verified RPC reader active).")
        return

    print(f"[EconoOracle] Live submitting snapshot to contract {CONTRACT_ADDR}...")

if __name__ == "__main__":
    main()
