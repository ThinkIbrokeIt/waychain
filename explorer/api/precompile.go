package api

import (
	_ "embed"
	"encoding/json"
	"net/http"
	"strings"
)

//go:embed protocol-manifest.json
var manifestJSON []byte

// manifest is the SoT precompile list (protocol-manifest.json). It is embedded
// here as a COPY — regenerate from the monorepo SoT (scripts/gen-protocol-manifest.py)
// if the node's precompiles change. Drift is caught by the node's CI --check.
type manifest struct {
	ChainID        int    `json:"chain_id"`
	PrecompileRange struct {
		Start string `json:"start"`
		End   string `json:"end"`
	} `json:"precompile_range"`
	Precompiles []struct {
		Addr string `json:"addr"`
		Name string `json:"name"`
	} `json:"precompiles"`
}

func loadManifest() *manifest {
	var m manifest
	if err := json.Unmarshal(manifestJSON, &m); err != nil {
		// Should never happen (embedded + CI-checked); return empty rather than panic.
		return &m
	}
	return &m
}

// precompileStat maps a precompile address (0xNN) to the node way_* read(s)
// that return its live global state. Sourced from consensus/rpc.go:303+.
// Account-specific reads (way_getDoxLevel, way_taskStatus) are excluded here;
// they need an address/taskId arg and are handled by a later UI input.
func precompileStatCalls(addr string) []string {
	switch strings.ToLower(addr) {
	case "0x18":
		return []string{"way_twoWayStats"}
	case "0x16":
		return []string{"way_bridgeStats"}
	case "0x1d":
		return []string{"way_govProposals"}
	case "0x22", "0x24":
		return []string{"way_wayTotalSupply"}
	case "0x23":
		return []string{"way_questPoolRemaining", "way_questCap", "way_questGetAutopilot"}
	default:
		return nil
	}
}

// precompileDesc gives a one-line purpose per precompile (protocol SoT naming).
// Truth-first: descriptions are factual; we never invent a stat that doesn't
// exist. A precompile is "accountScoped" when it has no global way_* read
// (see precompileStatCalls) and must be queried with an address/taskId.
var precompileDesc = map[string]string{
	"0x0c": "Aggregates off-chain oracle feeds on-chain.",
	"0x0d": "Schedules oracle update rounds.",
	"0x0e": "Verifies oracle submitter signatures and rounds.",
	"0x0f": "Verifies TLS session proofs (web-proof oracle).",
	"0x10": "Aggregate / BLS signature verification.",
	"0x11": "Social and key recovery for accounts.",
	"0x12": "Computes state rent owed by an account.",
	"0x13": "Dox_Dev identity and attestation badges (L2/L3).",
	"0x14": "BinaryJournal (BIJO) — self-sovereign knowledge vault.",
	"0x15": "Time-locked dead-man's-switch releases.",
	"0x16": "BitcoinRegistry — BTC bridge registry (committed/withdrawn).",
	"0x17": "Funds storage for endowed accounts.",
	"0x18": "TwoWayVault — CDP vault minting 2WAY (debt/vaults).",
	"0x19": "Stability pool for CDP liquidations.",
	"0x1a": "TrustlessLock — anti-rug liquidity locks.",
	"0x1b": "Account abstraction and key management.",
	"0x1c": "Privacy / confidential transaction support.",
	"0x1d": "On-chain governance proposals.",
	"0x1e": "Applies and collects state rent.",
	"0x1f": "Cross-chain attestations (WIFR→WAY bridge witness).",
	"0x20": "Mineral-rights RWA token registry.",
	"0x21": "WIFR gantlet reward pool.",
	"0x22": "WayStablecoin (1WAY) — BTC-pegged, minted by BTC deposit.",
	"0x23": "TaskRegistry — quest/task program.",
	"0x24": "SwayToken (SWAY) — governance/utility token.",
	"0x25": "DEX swap routing.",
	"0x26": "TemplateRegistry — deployable contract templates.",
}

// handlePrecompiles lists all 27 precompiles (SoT metadata).
func (s *Server) handlePrecompiles(w http.ResponseWriter, r *http.Request) {
	m := loadManifest()
	out := make([]map[string]interface{}, 0, len(m.Precompiles))
	for _, p := range m.Precompiles {
		statCalls := precompileStatCalls(p.Addr)
		out = append(out, map[string]interface{}{
			"addr":          p.Addr,
			"name":          p.Name,
			"desc":          precompileDesc[strings.ToLower(p.Addr)],
			"accountScoped": len(statCalls) == 0,
		})
	}
	writeJSON(w, map[string]interface{}{
		"chainId":          m.ChainID,
		"precompileRange": m.PrecompileRange,
		"precompiles":     out,
	})
}

// handlePrecompile returns one precompile's metadata + live way_* stats.
func (s *Server) handlePrecompile(w http.ResponseWriter, r *http.Request) {
	addr := strings.TrimPrefix(r.URL.Path[len("/api/precompile/"):], "/")
	addr = strings.ToLower(addr)
	m := loadManifest()

	var entry *struct {
		Addr string `json:"addr"`
		Name string `json:"name"`
	}
	for i := range m.Precompiles {
		if strings.EqualFold(m.Precompiles[i].Addr, addr) {
			entry = &m.Precompiles[i]
			break
		}
	}
	if entry == nil {
		writeJSON(w, map[string]interface{}{"error": "unknown precompile " + addr})
		return
	}

	stats := map[string]interface{}{}
	for _, method := range precompileStatCalls(addr) {
		raw, err := s.node.Call(method)
		if err != nil {
			stats[method] = map[string]string{"error": err.Error()}
			continue
		}
		var v interface{}
		if err := json.Unmarshal(raw, &v); err != nil {
			stats[method] = string(raw)
		} else {
			stats[method] = v
		}
	}

	writeJSON(w, map[string]interface{}{
		"addr":          entry.Addr,
		"name":          entry.Name,
		"desc":          precompileDesc[addr],
		"accountScoped": len(precompileStatCalls(addr)) == 0,
		"statCalls":     precompileStatCalls(addr),
		"stats":         stats,
	})
}
