// Command explorer runs the WayChain indexer + REST/WS API as a single
// service. It replays chain history from the node, tails new blocks over WS,
// and serves the explorer API. The explorer frontend talks only to this API.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/ThinkIbrokeIt/waychain-explorer/api"
	"github.com/ThinkIbrokeIt/waychain-explorer/client"
	"github.com/ThinkIbrokeIt/waychain-explorer/indexer"
	"github.com/ThinkIbrokeIt/waychain-explorer/store"
)

func main() {
	nodeURL := flag.String("node", envOr("WAYCHAIN_NODE_URL", "http://localhost:9545"), "WayChain node JSON-RPC URL")
	dbPath := flag.String("db", envOr("WAYCHAIN_DB", "explorer.db"), "SQLite database path")
	apiAddr := flag.String("addr", envOr("WAYCHAIN_API_ADDR", ":8080"), "API listen address")
	flag.Parse()

	s, err := store.Open(*dbPath)
	if err != nil {
		log.Fatalf("store open: %v", err)
	}
	defer s.Close()

	node := client.New(*nodeURL)

	ix := indexer.New(node, s)
	go func() {
		if err := ix.Run(); err != nil {
			log.Printf("indexer: %v", err)
		}
	}()

	apiSrv := api.New(s, node)
	go apiSrv.Run() // subscriber hub for live WS broadcasts

	// Wire the indexer to notify the API when a block is indexed, so the
	// API can push live newHead events to WS subscribers.
	ix.SetNotifier(func(height int64) { apiSrv.Notify(height) })

	log.Printf("WayChain explorer API listening on %s (node=%s db=%s)", *apiAddr, *nodeURL, *dbPath)
	if err := http.ListenAndServe(*apiAddr, apiSrv.Handler()); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
