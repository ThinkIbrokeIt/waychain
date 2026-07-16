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

// handlePrecompiles lists all 27 precompiles (SoT metadata).
func (s *Server) handlePrecompiles(w http.ResponseWriter, r *http.Request) {
	m := loadManifest()
	writeJSON(w, map[string]interface{}{
		"chainId":        m.ChainID,
		"precompileRange": m.PrecompileRange,
		"precompiles":    m.Precompiles,
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
		"addr":  entry.Addr,
		"name":  entry.Name,
		"stats": stats,
	})
}
