# WayChain Site — AGENTS.md

> **Last updated:** July 2, 2026  
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
| `/` | `index.html` | Dashboard / homepage |
| `/whitepaper` | `whitepaper/index.html` | 16-section/22-chapter whitepaper |
| `/whitepaper/*` | `whitepaper/index.html` | SPA catch-all for all whitepaper deep-links |
| `/explorer` | `explorer/index.html` | Block explorer |
| `/badge` | `badge/index.html` | Badge/verification page |
| `/plan` | `plan/index.html` | Roadmap/plan page |
| `/version.json` | `version.json` | Version tracking (served directly, no rewrite) |

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
    { "source": "/plan", "destination": "/plan/index.html" }
  ]
}
```

- No framework (pure static HTML)
- No build step (`buildCommand: ""`, `installCommand: ""`)
- SPA-style rewrites for multi-page routes

### `version.json`

System version tracking file. Current values as of July 2, 2026:

```json
{
  "version": "3.1.4",
  "chain_id": 10008,
  "chain_id_hex": "0x2718",
  "name": "WayChain",
  "tagline": "Actually Decentralized",
  "deployed_at": "2026-07-02",
  "whitepaper_sections": 22,
  "live_features": 18,
  "spec_features": 6,
  "precompiles": 20,
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

### Remote & Author

| Property | Value |
|---|---|
| Remote URL | `https://github.com/ThinkIbrokeIt/waychain-site` |
| Commit author | `thinkibrokeit <vintagescrambler@gmail.com>` |
| Auto-deploy | Vercel auto-deploys from GitHub on push to `master` |

### Deploy Flow

```bash
# Typical deploy cycle:
./deploy.sh patch "Fix typo in footer"
# OR
./deploy.sh minor "Add new section to dashboard"

# Script handles: bump → commit → vercel deploy --prod → tag
# No manual vercel deploy needed
```

### Tags

- `v3.1.3` — Lighthouse brand applied to dashboard, badge, explorer
- `v3.1.4` — Whitepaper sections rebuilt from markdown (16 chapters, lighthouse brand)

---

## 6. Known Pitfalls ⚠️

### Vercel CLI
- `vercel deploy --prod` needs the **`--yes` flag** for fully automated (non-interactive) deploys. The current `deploy.sh` doesn't include `--yes` — if the CLI prompts for confirmation, the deploy will hang.
- **Fix:** Add `--yes` to the deploy command in `deploy.sh`.

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

### Recent Notable Commits

```
69cc877 v3.1.4: Whitepaper sections nav — 16 chapters, lighthouse brand
2401089 v3.1.4: Whitepaper sections nav — 16 chapters, lighthouse brand, accordion layout
43571fd v3.1.3: Updated dashboard, badge, explorer, and whitepaper pages
5ee434d brand: Exact brand fidelity — System Two (Product/Web) applied
f5b7c41 brand: Exact match to waychainbrand.png
d8e947a brand: Exact match to waychainbrand.png
601aafa brand: Corrected hex codes + exact brand text from guide
e2dc8ef brand: Implement exact brand guide — colors, fonts, tiers, compass
98f520c feat: 5-page site architecture — Illuminate. Navigate. Arrive.
```

---

## 8. Brand Assets

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

# Deploy a patch
cd /home/wink/projects/waychain-site && ./deploy.sh patch "description"

# Deploy a minor version
cd /home/wink/projects/waychain-site && ./deploy.sh minor "description"

# View git log
cd /home/wink/projects/waychain-site && git log --oneline -20

# Check current state
cd /home/wink/projects/waychain-site && git status
```

### Project location on disk
```
/home/wink/projects/waychain-site/
├── index.html              # Dashboard / homepage
├── explorer.html           # Legacy explorer (flat)
├── badge.html              # Legacy badge (flat)
├── vercel.json             # Route config
├── version.json            # Version tracking
├── deploy.sh               # Deploy script
├── AGENTS.md               # This file
├── explorer/
│   └── index.html          # Canonical explorer
├── badge/
│   └── index.html          # Canonical badge
├── plan/
│   └── index.html          # Roadmap
└── whitepaper/
    └── index.html          # Whitepaper (22 chapters)
```