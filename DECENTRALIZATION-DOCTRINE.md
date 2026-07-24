# WAYCHAIN DECENTRALIZATION DOCTRINE
**Status:** BINDING PRINCIPLE · **Ratified:** 2026-07-24 · **Authority:** Founder directive
**Companion to:** `REPO_LAW.md` (this doctrine amends Article II + Article VII)

---

## 0. Why this exists

> "I don't want our community to ever have to rely on something outside of our
> community. That's how PulseChain got blocked by mainstream. We need a full
> audit of possible areas of concern. If a community member needs an API they
> get it right here. If they need storage they get it here. If they need to host
> their frontend and backend they get it from the community. This will truly keep
> us operational and 100% decentralized."

> "This aligns with collecting rent for taking up space. Not a profit machine.
> A way for us to survive."

This is not ideology for its own sake. It is **operational survival**. Every
external dependency is a point where a corporation or registrar can cut us off.
PulseChain proved that happens. WayChain must not have that lever.

---

## 1. The principle

**If a member needs infrastructure, the community provides it — and the member
pays rent for the space they use, in WAY.**

- Rent = survival, not profit. It covers the cost of the hardware, bandwidth,
  and stewardship that keep the resource alive. It is NOT extracted as margin.
- This extends the existing economic model:
  - TrustlessLock revenue share: **98/2** (98% to locker, 2% to foundation).
  - Foundation pays gas for new users (onboarding, not exploitation).
  - Community infra rent: **small WAY per resource used**, ring-fenced to
    operating that resource.

The rent mechanism is the *flywheel*: usage pays for capacity, capacity serves
more usage. No VC, no ad model, no corporate API bill.

---

## 2. Audit — external dependencies found (2026-07-24)

Evidence-based. Each is a lever someone else holds over us.

### TIER 1 — Hard blockers to 100% community operation
| Concern | Current external dep | Location | Risk |
|---|---|---|---|
| Frontend hosting | **Vercel** (`waychain-site` → Vercel prod) | `site/` | Vercel can delist/ban; our DEX fix could not deploy without their gate. LIVE BLOCKER. |
| RPC ingress | **Cloudflare Tunnel** (cloudflared) + single AWS box | node `3.89.116.45` | CF is a centralized intermediary; one AWS instance is a central point of failure. |
| Package registry | **npmjs.org** | every `npm install`, all `package-lock.json` | No npm = no one can build wallet/node. |
| LLM/agent tokens | **OpenRouter** | agent loop | External paid API; token drain. |

### TIER 2 — Runtime external calls (every site page pulls these)
| Asset | External source | Pages |
|---|---|---|
| Fonts (Playfair / Inter / DM Serif) | `fonts.googleapis.com` + `fonts.gstatic.com` | ALL site pages |
| Crypto libs (tweetnacl, bip39, jsQR, @scure/bip39, qrcode) | `cdn.jsdelivr.net` | wallet, dex, protocol, tokens, trade, binary-journal |
| GitHub links | `github.com/ThinkIbrokeIt/...` | footer/nav (OUR repo, but GitHub itself is external) |

### TIER 3 — Build/runtime
| Concern | Source |
|---|---|
| Mobile build | Expo + npm (external); APKs built on OUR AWS box |
| Node deps | `revm-ffi` (Rust) — needs cargo/npm at build |

---

## 3. The community-run replacement stack

| Need | External (drop) | Community-run (build) |
|---|---|---|
| Frontend hosting | Vercel | Our own nginx on community hardware serving `site/` from `api.waychain.org` |
| RPC endpoint | Cloudflare Tunnel + 1 box | Multiple community-run RPC nodes; wallets fall back across them |
| npm packages | npmjs.org | Self-hosted registry (Verdaccio) on community infra |
| CDN assets | jsdelivr | Vendored into repo `site/vendor/`, served from our host |
| Fonts | googleapis/gstatic | Bundled `site/fonts/` (self-hosted woff2) |
| Object storage | (none yet) | MinIO / S3-compatible on community hardware for member frontends/backends |
| LLM/agent | OpenRouter | Self-hosted model or community-run endpoint (future) |

---

## 4. Rent model (survival, not profit)

A member who hosts their frontend on community storage, or calls a community
API, or uses a community RPC node, pays **rent in WAY** proportional to space/
calls used. Rent is:

- **Custodial** — held by the foundation/stewards, spent ONLY on the resource.
- **Transparent** — a public ledger (on WayChain, naturally) shows rent in /
  capacity cost out.
- **Non-extractive** — no surplus siphoned; if rent exceeds cost, capacity
  grows (more nodes, more storage) rather than padding a treasury.

This is the inverse of the mainstream model: instead of paying a corporation to
rent us back our own data, the community pays itself to keep the lights on.

---

## 5. Execution order (build it right, one step at a time)

Per founder directive: codify the law, then execute phase-by-phase. No boiling
the ocean in one turn.

1. **Amend REPO_LAW** (Article II + VII) to forbid hard external deps; name the
   community-run stack as the required path.
2. **Vendor CDN + fonts** into `site/vendor/` + `site/fonts/`; rewrite all
   `cdn.jsdelivr.net` / `googleapis` references to local paths. (Removes Tier 2
   runtime external calls entirely.)
3. **Self-host the site** — serve `site/` from our own nginx (already on the
   node) instead of Vercel. Kill the Vercel production gate.
4. **Self-host npm mirror** (Verdaccio) so builds never hit npmjs.
5. **Multiple RPC endpoints** — stand up ≥2 community RPC nodes; wallets fall
   back across them; demote Cloudflare Tunnel to one option among many.
6. **Community storage** (MinIO) + rent ledger for member-hosted apps.
7. **LLM/agent** — move off OpenRouter to a community-run or self-hosted model.
8. **Seed-down → community activation** (founder directive 2026-07-24): the node
   gossip layer detects when ALL seed/founder nodes are unreachable and
   gossips `MsgSeedDown`. That alert is the community's bat-signal to
   **deploy replacement nodes** and tell family/friends. A single point of
   failure is a rallying signal, not a network death. See
   `docs/COMMUNITY-NODE-RUN.md`.

Each step is its own issue + branch + PR (REPO_LAW Article III). Steps 1–7
(build) + 8 (gossip alert) are now **coded + staged** (PRs #165/#166/#168/#169).
The 1% = the deploy flip (needs node capacity / the actual seed-down event).

Step 2 is the highest-leverage first move: it removes the most pervasive
external calls AND unblocks the Vercel problem by making the site portable.
---

**One chain. One community. No outside lever. Rent we pay ourselves to survive.**
