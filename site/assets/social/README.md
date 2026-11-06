# Social Media Assets - WayChain

**All assets in `/home/wink/projects/waychain-site/assets/social/`**

## Created Assets

### Economic Loop Infographic
- `economic-loop.html` - Interactive SVG circular flow diagram
- Shows: Bitcoin → Treasury → 1WAY → Gold Claims → WAY → DEX → 1WAY cycle

### Dox_Dev Badge Page  
- `doxdev-badge.html` - Level I/II/III overview with visual design

### Twitter/X Thread Template
- `twitter-thread.md` - 5-tweet thread + LinkedIn post templates

### Feature Chips
- `feature-chips.html` - Standalone chips page
- All feature links point to live whitepaper sections

### Implementation Plan
- `implementation-plan.md` - Marketing distribution strategy, channel templates

### Feature Link Mapping
- `feature-links.json` - JSON mapping of all 7 features to whitepaper anchors

## Whitepaper Anchors (Now Live)

| Anchor | Section | Feature |
|--------|---------|---------|
| `#one-human-one-vote` | Governance | One Human, One Vote |
| `#self-sovereign` | Binary Journal | Self-Sovereign System |
| `#anti-extractive` | Abstract | Anti-Extractive (Fixed Fees) |
| `#bitcoin-stablecoin` | 1WAY Stablecoin | Bitcoin → 1WAY |
| `#gold-claims` | Mineral Rights | Gold Claims |
| `#community-work` | Professional Oracles | Community Work |
| `#dex-swap` | 1WAY Stablecoin | DEX Swap |

## To Generate Screenshots
```bash
cd /home/wink/projects/waychain-site/assets/social
python3 -m http.server 8080 &
xdg-open http://localhost:8080/economic-loop.html
```

## Quick Copy-Paste Social Posts

**Tweet:**
```
The lighthouse is lit. WayChain economic loop: Bitcoin → 1WAY → Gold Claims → WAY → DEX → 1WAY. Closed system. Self-sovereign. No extraction.

waychain.org/badge
```