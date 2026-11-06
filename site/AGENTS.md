# WayChain Site — AGENTS.md

> **Last updated:** July 4, 2026  
> **Purpose:** This file gives any AI agent (Claude, Codex, ChatGPT, etc.) everything needed to understand, modify, deploy, or troubleshoot the WayChain frontend website.

---

## 1. Project Overview

**WayChain** is a blockchain platform. This repository (`waychain-site`) is its **frontend website**, hosted at [waychain.org](https://waychain.org), deployed on **Vercel** as a fully static site.

### Brand: Lighthouse

The site was rebuilt between **June 26–July 1, 2026** with a **lighthouse-inspired brand** (copper/amber/slate on a dark maritime theme). This replaced an earlier cyberpunk aesthetic that was rejected.

| Token | Value |
|---|---|
| Brand theme | Dark maritime / lighthouse |
| Background | `#2A2A2A` (slate) |
| Text base | `#FFF8F0` (warm ivory) |
| Accent primary | `#B87333` (copper) |
| Accent highlight | `#FFBF00` (amber) |
| Heading font | **DM Serif Display** (serif) |
| Body font | **Inter** (sans-serif) |
| Body size | 18px fixed |
| Body line-height | 1.8 |
| Container max-width | 700px |
| Logo | Wardenclyffe Lighthouse |
| Gold/silver | Denominated in troy oz |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Hosting** | [Vercel](https://vercel.com) (static HTML, no build step) |
| **DNS** | Cloudflare (waychain.org) |
| **CDN** | Vercel edge network |
| **RPC proxy** | Cloudflare Tunnel → Nginx (local VPS) |
| **Local proxy** | Nginx on VPS (port 80/443 → internal services) |
| **Fonts** | Google Fonts: DM Serif Display, Inter |
| **Git remote** | GitHub (`ThinkIbrokeIt/waychain-site`) |

### Architecture Diagram (simplified)

```
User ──HTTPS──▸ Vercel (waychain.org) ──► static HTML
User ──HTTPS──▸ Cloudflare Tunnel ──► Nginx ──► api.waychain.org (RPC)
```

- `waychain.org` → **Vercel** (the website frontend)
- `api.waychain.org` → **Cloudflare Tunnel** (NOT Vercel — proxied to local VPS + Nginx)

---

## 3. Pages & Routes

All routes are served as **static HTML** through Vercel rewrites defined in `vercel.json`.

| Route | File Served | Description |
|---|---|---|
| `/` | `index.html` | Dashboard / homepage — 10 use cases, developers walkthrough |
| `/whitepaper` | `whitepaper/index.html` | 22-chapter whitepaper, accordion nav |
| `/whitepaper/*` | `whitepaper/index.html` | SPA catch-all for deep-links |
| `/explorer` | `explorer/index.html` | Block explorer |
| `/badge` | `badge/index.html` | Dox_Dev badge lookup & apply |
| `/plan` | `plan/index.html` | Roadmap / launch plan |
| `/docs` | `docs/index.html` | Getting started — Step 1-5 walkthrough, Option C (BTC→1WAY) |
| `/wallet` | `wallet/index.html` | Web wallet — Ed25519 keygen, faucet, send |
| `/faucet` | `faucet/index.html` | Faucet — request 10 WAY test tokens |
| `/version.json` | `version.json` | Version tracking (served directly, no rewrite) |

> **Note:** Additional frontends (Declaration, Binary Journal, TrustlessLock, DEX) live in the **monorepo** at `/home/wink/projects/waychain/site/` — see that repo's AGENTS.md. This repo (`waychain-site`) mirrors the monorepo's `site/` subdirectory and is deployed independently.

### ⚠️ Legacy flat files (not rewired — coexist with directories)

There are also top-level HTML files that predate the directory-based route structure:

- `explorer.html` — legacy flat explorer (exists alongside `explorer/index.html`)
- `badge.html` — legacy flat badge (exists alongside `badge/index.html`)

These are **not** served by vercel.json rewrites but may still be accessible at `/explorer.html` and `/badge.html`. The canonical routes use the directory versions.

---

## 4. Key Files

### `vercel.json`

```json
{
  "name": "waychain-site",
  "framework": null,
  "version": 2,
  "buildCommand": "",
  "outputDirectory": ".",
  "installCommand": "",
  "rewrites": [
    { "source": "/version.json", "destination": "/version.json" },
    { "source": "/whitepaper", "destination": "/whitepaper/index.html" },
    { "source": "/whitepaper/", "destination": "/whitepaper/index.html" },
    { "source": "/whitepaper/:path*", "destination": "/whitepaper/index.html" },
    { "source": "/explorer", "destination": "/explorer/index.html" },
    { "source": "/badge", "destination": "/badge/index.html" },
    { "source": "/docs", "destination": "/docs/index.html" },
    { "source": "/wallet", "destination": "/wallet/index.html" },
    { "source": "/faucet", "destination": "/faucet/index.html" },
    { "source": "/plan", "destination": "/plan/index.html" }
  ]
}
```

- No framework (pure static HTML)
- No build step (`buildCommand: ""`, `installCommand: ""`)
- SPA-style rewrites for multi-page routes
- Routes for `/docs`, `/wallet`, `/faucet` added in v4.0.1

> ⚠️ The `/declaration`, `/independence`, `/journal`, `/locks`, `/dex` routes exist in the monorepo's `vercel.json` (`/home/wink/projects/waychain/site/vercel.json`) — NOT in this repo.

### `version.json`

System version tracking file. Current values as of July 4, 2026 (v4.1.0):

```json
{
  "version": "4.1.0",
  "chain_id": 10008,
  "chain_id_hex": "0x2718",
  "name": "WayChain",
  "tagline": "Actually Decentralized",
  "deployed_at": "2026-07-04",
  "whitepaper_sections": 22,
  "live_features": 18,
  "spec_features": 6,
  "precompiles": 27,
  "state_rent_pricing": "cloud-benchmarked ($0.12/MB/year)",
  "blueprint_files": 29,
  "blueprint_lines": 11947,
  "new_features": [
    "Progressive Staking (anti-whale reward brackets)",
    "Oracle VRF + Time Execution (scheduled triggers)",
    "Mineral Rights Tokenization (MRT Registry 0x20)"
  ],
  "fixes": [
    "BIJO clarified as ecosystem reward token (not fuel token)",
    "BIJO supply corrected: 369B → 369M (matches on-chain precompile)",
    "State rent pricing updated to match 2026 cloud storage costs",
    "Whitepaper HTML restored (was broken/regressed in v3.1.1)",
    "Version consistency: all sources now say 3.1.2",
    "CHANGELOG backfilled v3.0.2–v3.1.1"
  ]
}
```

> **Note:** The `version.json` file is **not auto-bumped** by `deploy.sh` across all files. After any manual version.json edits, run `./deploy.sh patch "description"` to commit and deploy.

### `deploy.sh`

Automated deployment script. Bumps version, commits, tags, and deploys to Vercel.

```bash
./deploy.sh [patch|minor|major] [message]
# Example: ./deploy.sh minor "Added governance section to whitepaper"
```

**What it does:**
1. Reads current version from `version.json`
2. Bumps the version based on argument (`patch`/`minor`/`major`)
3. Updates `version.json` with new version and today's date
4. Stages all changes, commits with message `"v$NEW_VERSION: $MESSAGE"`
5. Runs `vercel deploy --prod`
6. Creates a git tag `v$NEW_VERSION`

---

## 5. Git Workflow

### Branch Strategy

| Branch | Purpose | Protected | Deployed to Vercel |
|--------|---------|-----------|---------------------|
| `main` | **Live production.** What users see at waychain.org. Only merged from `master` after testing. | ✅ enforce_admins | ✅ yes |
| `master` | **Protected integration.** Clean merges only. Changes flow: `dev` → test → `master` → `main` | ✅ enforce_admins | ❌ no |
| `dev` | **Development lane.** Break stuff here. Experiment. Fail fast. Push changes to `dev` first. | ❌ | ❌ no |

**Workflow:**
```bash
# Start working (always on dev)
git checkout dev

# Make changes, commit
git add -A && git commit -m "..."
git push origin dev

# When ready to go live:
# 1. Merge dev into master
git checkout master && git merge dev && git push origin master

# 2. Merge master into main and deploy
git checkout main && git merge master && git push origin main
vercel deploy --prod --yes

# 3. Go back to dev
git checkout dev
```

### Remote & Author

| Property | Value |
|---|---|
| Remote URL | `https://github.com/ThinkIbrokeIt/waychain-site` |
| Commit author | `thinkibrokeit <vintagescrambler@gmail.com>` |
| Auto-deploy | Vercel auto-deploys from GitHub on push to `master` |

### Deploy Flow

```bash
# The safe cycle — always use the branch strategy:
cd /home/wink/projects/waychain-site

# 1. Dev → Master → Main
git checkout dev && git add -A && git commit -m "v4.1.2: Description"
git checkout master && git merge dev && git push origin master
git checkout main && git merge master && git push origin main

# 2. Deploy from main
vercel deploy --prod --yes

# 3. Back to dev
git checkout dev
```

> **Note:** Vercel auto-deploys from GitHub when `main` is pushed. Use `vercel deploy --prod --yes` when you want to force an immediate deploy without waiting for the GitHub webhook.

### Tags

- `v3.1.3` — Lighthouse brand applied to dashboard, badge, explorer
- `v3.1.4` — Whitepaper sections rebuilt from markdown (16 chapters, lighthouse brand)
- `v3.2.0` — Whitepaper rebuilt with 14 sections, innovations centered
- `v4.0.0` — Whitepaper rebuilt — 14 sections, innovations at center
- `v4.0.1` — 10 use cases on homepage, walkthrough in developers section, /docs route
- `v4.1.0` — CashApp onramp, wallet/faucet pages, Getting Started walkthrough for newbies

---

## 6. Known Pitfalls ⚠️

### Vercel CLI
- `vercel deploy --prod` needs the **`--yes` flag** for fully automated (non-interactive) deploys. The current `deploy.sh` doesn't include `--yes` — if the CLI prompts for confirmation, the deploy will hang.
- **Fix:** Add `--yes` to the deploy command in `deploy.sh`.

### Vercel Edge Cache — Stale HTML 🚨
- Vercel's edge CDN serves `x-vercel-cache: HIT` for HTML pages even with `cache-control: no-store`. The edge holds the old ETag for 5+ minutes after a deploy, so users see the old version.
- **Fix (applied):** Set `Cache-Control: no-store` for all routes in `vercel.json`:
  ```json
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
  ```
- This forces every request to hit Vercel's origin, but the edge node may still serve `x-vercel-cache: HIT` for up to ~5 minutes before rolling to the new deploy.
- **If user reports stale content:** Have them hard-refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) or open DevTools → Network → Disable cache → reload. The ETag on the live file always matches the file on disk (verified by md5sum comparison).
- **Trade-off:** Slightly higher origin load, but negligible for a static HTML site with no backend.

### DNS / Cloudflare
- `waychain.org`'s A records point to Vercel IPs. As of the last known config, Cloudflare was set to **DNS only (gray cloud)** — NOT proxied. This may have changed and **needs verification**.
- `api.waychain.org` uses **Cloudflare Tunnel** (proxied), NOT Vercel. Do NOT change this — the tunnel connects to a local Nginx proxy on the VPS.

### Nginx on VPS
- The Nginx config on the VPS serves `api.waychain.org` and may serve **stale content** if the config is wrong or if cached responses aren't refreshed.
- If the API seems down or returning wrong data, check the Nginx config and restart the tunnel service.

### Whitepaper Architecture
- The whitepaper was migrated from **5 chapters** to **16 sections** (now 22 chapters as of v3.1.4). Any code or agents referencing the old 5-chapter structure need updating.
- The whitepaper is a single-page app at `/whitepaper/index.html` with all section navigation handled client-side.

### Static Site Limitations
- **No backend, no SSR.** All content is served as flat HTML files. Dynamic features (badge lookup, explorer queries) must fetch from the external API at `api.waychain.org`.
- Changes require a full deploy; no hot-reload in production.

---

## 7. Recent Work (July 2026)

| Version | Date | What Changed |
|---|---|---|
| **v3.1.0–v3.1.2** | Jun 26–30 | Brand rebuild: Lighthouse identity applied end-to-end. 5-page site architecture. Brand fidelity passes. |
| **v3.1.3** | Jul 1 | Lighthouse brand applied to dashboard, badge, explorer, and whitepaper pages. Exact brand fidelity achieved. |
| **v3.1.4** | Jul 2 | Whitepaper sections rebuilt from markdown: 16→22 chapters, accordion navigation, lighthouse brand. Tunnel systemd service installed for persistent RPC access. |
| **v4.0.0** | Jul 4 | Whitepaper rebuilt: 14 sections with innovations centered. Professional badges, mineral rights, 1WAY, Binary Journal as core thesis. |
| **v4.0.1** | Jul 4 | **Use cases expanded** — homepage use cases section grew from 4 to 10 items matching whitepaper's "Use Cases No Chain Has Solved". Footer list went from 3 to 10. **Developers walkthrough** added — 4-step pipe flow (Verify → Read → Connect → Deploy). `/docs` route added for Getting Started guide. |
| **v4.1.0** | Jul 4 | **New frontends**: `/wallet` (Ed25519 keygen + faucet + send), `/faucet` (10 WAY request). **Getting Started docs** rebuilt with Option A (CashApp BTC bridge), Option B (faucet), Option C (send BTC receive 1WAY). **Navigation links** for wallet, faucet, docs added to homepage footer. |

### Recent Notable Commits

```
b729666 v4.1.0: Add CashApp onramp, wallet/faucet pages, Getting Started walkthrough
ce4815a v4.0.1: Add 10 use cases, walkthrough to developers, /docs route
1ef65c4 v4.0.0: Whitepaper rebuilt — 14 sections, innovations at center
cf022fd v3.2.0: Whitepaper rebuilt — innovations at center, professional badges, mineral rights, 1WAY, BJ, CTA
69cc877 v3.1.4: Whitepaper sections nav — 16 chapters, lighthouse brand
43571fd v3.1.3: Updated dashboard, badge, explorer, and whitepaper pages
98f520c feat: 5-page site architecture — Illuminate. Navigate. Arrive.
```

---

## 8. Brand Assets

### Brand icons (SVG sprites implemented)
The 5 primary brand icons are implemented as SVG symbols inline in `<head>`:
- `icon-lantern` — Wardenclyffe tower/lightbulb (Illuminate, RPC Layer)
- `icon-anchor` — Traditional anchor (Immovable, Opcode Layer)
- `icon-nautical-star` — Star (Tended, compass)
- `icon-lighthouse` — Lighthouse tower (For All, Mineral Rights)
- `icon-compass-rose` — 8-point compass rose (Deploy Gate)
All icons use `currentColor` for stroke/fill, inheriting parent colors (copper/amber).

### Color Palette

```css
:root {
  --warm:    #FFF8F0;  /* Warm ivory text */
  --slate:   #2A2A2A;  /* Main background */
  --slate2:  #1E1E1E;  /* Darker bg / hover */
  --slate3:  #333333;  /* Border / card bg */
  --fg:      #E8E4DD;  /* Body text (slightly darker than warm) */
  --muted:   #9A9A9A;  /* Secondary / nav links */
  --copper:  #B87333;  /* Primary accent, links, CTAs */
  --amber:   #FFBF00;  /* Highlight, gold references */
  --green:   #4CAF50;  /* Success / online */
  --red:     #E53935;  /* Error / offline */
}
```

### Typography

```css
/* Headings */
font-family: 'DM Serif Display', Georgia, serif;

/* Body */
font-family: 'Inter', -apple-system, sans-serif;
font-size: 18px;
line-height: 1.8;
```

### Layout Constants

- Container `max-width: 700px` (content area)
- Navigation is sticky, `backdrop-filter: blur(10px)`
- All text uppercase nav links use `font-size: .65em`, `letter-spacing: 1px`

### Logo

- Wardenclyffe Lighthouse (historical Tesla/Marconi lighthouse)
- Gold/silver references use **troy ounces** (oz t)

---

## 9. Quick Reference for Agents

### I need to...

```bash
# Understand the current version
cat version.json

# See all routes
cat vercel.json

# Read the deploy script
cat deploy.sh

# Start working (always on dev!)
cd /home/wink/projects/waychain-site && git checkout dev

# Deploy to production (from main)
cd /home/wink/projects/waychain-site
git checkout main && git pull origin main
vercel deploy --prod --yes
git checkout dev

# View git log
cd /home/wink/projects/waychain-site && git log --oneline -20

# Check current state
cd /home/wink/projects/waychain-site && git status

# Push to GitHub
cd /home/wink/projects/waychain-site && git push origin dev
```

### Project location on disk
```
/home/wink/projects/waychain-site/
├── index.html              # Dashboard / homepage (10 use cases, dev walkthrough)
├── explorer.html           # Legacy explorer (flat)
├── badge.html              # Legacy badge (flat)
├── vercel.json             # Route config (8 routes)
├── version.json            # Version tracking (v4.1.0)
├── deploy.sh               # Deploy script
├── AGENTS.md               # This file
├── explorer/
│   └── index.html          # Canonical explorer
├── badge/
│   └── index.html          # Dox_Dev badge lookup + apply
├── plan/
│   └── index.html          # Roadmap
├── docs/
│   └── index.html          # Getting Started (Step 1-5, Option A/B/C)
├── wallet/
│   └── index.html          # Web wallet (keygen, faucet, send)
├── faucet/
│   └── index.html          # Faucet (10 WAY request)
└── whitepaper/
    └── index.html          # Whitepaper (22 chapters)
```

### Related monorepo frontends (NOT in this repo)
```
/home/wink/projects/waychain/site/
├── declaration/            # July 4th Independence Declaration
├── binary-journal/         # Truth anchoring + Dead Man's Switch
├── locks/                  # TrustlessLock UI
├── dex/                    # Swap Route DEX
├── wallet/                 # Web wallet (may differ from this repo's version)
```

> These routes are deployed from the monorepo at `ThinkIbrokeIt/waychain` via `./deploy.sh` in that repo's `site/` directory.