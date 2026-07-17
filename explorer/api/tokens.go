package api

import (
	"net/http"
	"strings"
)

// tokenMeta is the truthful protocol-token directory. Sourced from
// consensus/evm/precompiles.go (precompile names) + protocol knowledge.
//
// NOTE on 0x25: consensus/evm/precompiles.go:173 names it "BinaryJournal"
// (storage/data incentive token), but protocol-manifest.json (used by the
// precompile panel) calls it "SwapRoute". That is a manifest↔code drift —
// surfaced here, not silently resolved. The token page uses the code truth
// (BinaryJournal) and flags the discrepancy in its Purpose field.
var tokenMeta = map[string]struct {
	Symbol   string
	Name     string
	Purpose  string
	Decimals int
	LiveSupply bool // true only if a node way_* RPC exposes total supply
}{
	"0x22": {
		Symbol:      "1WAY",
		Name:        "1WAY Stablecoin",
		Purpose:     "Bitcoin-backed stablecoin (identity: way_1waystablecoin). BTC locked in vaults → 1WAY minted; supply flexes with the BTC committed (not a fixed constant). Mint/burn via 0x22 precompile.",
		Decimals:    18,
		LiveSupply:  true, // way_1wayTotalSupply (consensus/evm/stats_read.go:Get1WayTotalSupply)
	},
	"0x24": {
		Symbol:      "SWAY",
		Name:        "SwayToken",
		Purpose:     "DEX LP incentive token — rewards liquidity providers on the native swap route.",
		Decimals:    18,
		LiveSupply:  false, // no node way_* supply RPC exposed yet
	},
	"0x25": {
		Symbol:      "BIJO",
		Name:        "BinaryJournal (BIJO)",
		Purpose:     "Storage/data incentive token — epoch-based release to node operators who store data. NOTE: protocol-manifest.json labels 0x25 'SwapRoute'; code (precompiles.go:173) names it BinaryJournal. Manifest↔code drift — verify before relying.",
		Decimals:    18,
		LiveSupply:  false, // epoch-based release, no single stored total exposed via way_*
	},
}

// handleTokens returns the protocol token directory with live 1WAY supply.
// SWAY/BIJO supply is reported as null (not exposed) — never fabricated.
func (s *Server) handleTokens(w http.ResponseWriter, r *http.Request) {
	out := make([]map[string]interface{}, 0, len(tokenMeta))
	for addr, meta := range tokenMeta {
		tok := map[string]interface{}{
			"addr":         addr,
			"symbol":       meta.Symbol,
			"name":         meta.Name,
			"purpose":      meta.Purpose,
			"decimals":     meta.Decimals,
			"liveSupply":   meta.LiveSupply,
			"totalSupply":  nil, // filled below for 1WAY only
		}
		if meta.LiveSupply {
			raw, err := s.node.Call("way_1wayTotalSupply")
			if err == nil {
				// node returns a JSON-quoted string e.g. "\"0x5f5e100\"" — strip
				// the surrounding quotes and the 0x prefix for a clean hex value.
				sup := strings.TrimSpace(string(raw))
				sup = strings.Trim(sup, "\"")
				sup = strings.TrimPrefix(sup, "0x")
				if sup == "" {
					sup = "0"
				}
				tok["totalSupply"] = sup
			}
		}
		out = append(out, tok)
	}
	writeJSON(w, out)
}
