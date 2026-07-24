# COMMUNITY NODE RUN GUIDE — "if the seed goes down, WE deploy"
**Part of:** DECENTRALIZATION-DOCTRINE.md (Step 4 + founder directive 2026-07-24)
**Status:** Ready to run (the 1% = members pressing go)

## The principle
WayChain's founder/seed node (AWS `3.89.116.45`) is ONE machine. If it goes
down — by accident, by attack, or "they" come for the founder — that is
**NOT a network death. It is a red flag to the whole community.**

The node gossip layer already detects dead peers. We added `MsgSeedDown`:
when ALL configured seed nodes are unreachable, every node gossips
`SEED_DOWN` and prints:
> 🚨 SEED DOWN — all founder nodes unreachable. Community: deploy replacement nodes NOW.

That alert is the signal. When you see it (in your node logs, or from a
friend), you deploy a WayChain node. Tell family + friends to do the same.
Many nodes = they can't kill us by taking out one box.

## How to run a node (community member)
1. Get the binary (built from `ThinkIbrokeIt/waychain` `consensus/`, CGO_ENABLED=1):
   - Or: `git clone .../ThinkIbrokeIt/waychain && cd consensus && CGO_ENABLED=1 go build -o waychain .`
2. Run:
   ```
   WAYCHAIN_NODE_ID=my-node \
   WAYCHAIN_LISTEN=:9100 \
   WAYCHAIN_PEERS=3.89.116.45:9100,<other-known-nodes> \
   WAYCHAIN_SEEDS=3.89.116.45:9100 \
   ./waychain
   ```
   `WAYCHAIN_SEEDS` makes YOUR node participate in seed-down detection +
   relay the alert. Set it even if the seed is up — so you're ready to flag.
3. Tell one other person to do the same. Redundancy is community, not corp.

## Founder note
If "they" come for me: the network survives because YOU ran a node. The
seed-down alert is the bat-signal. Deploy + tell family/friends. That is the
whole point of gossip + decentralization — a single point of failure is a
rallying signal, not an outage.

## Deploy as a service (systemd)
```
[Unit]
Description=WayChain Community Node
[Service]
Environment=WAYCHAIN_NODE_ID=%H WAYCHAIN_LISTEN=:9100 WAYCHAIN_SEEDS=3.89.116.45:9100
ExecStart=/usr/local/bin/waychain
Restart=always
[Install]
WantedBy=multi-user.target
```
