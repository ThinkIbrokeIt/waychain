// Package store persists indexed WayChain data in SQLite (pure-Go driver,
// no CGO). The indexer writes; the API reads. All aggregation the prototype
// faked (totals, counts) becomes a SQL query here — no node RPCs added.
package store

import (
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

// Store is the indexed-data persistence layer.
type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at path.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite %s: %w", path, err)
	}
	db.SetMaxOpenConns(1) // SQLite is single-writer; serialise to avoid locks.
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS blocks (
			height      INTEGER PRIMARY KEY,
			hash        TEXT,
			parent_hash  TEXT,
			timestamp   INTEGER,
			proposer    TEXT,
			tx_count    INTEGER
		)`,
		`CREATE TABLE IF NOT EXISTS transactions (
			hash         TEXT PRIMARY KEY,
			block_height INTEGER,
			idx          INTEGER,
			nonce        INTEGER,
			from_addr    TEXT,
			to_addr      TEXT,
			value        TEXT,
			gas_limit    INTEGER,
			gas_price    INTEGER,
			gas_used     INTEGER,
			lane         INTEGER,
			data         TEXT,
			timestamp    INTEGER
		)`,
		`CREATE TABLE IF NOT EXISTS address_tx (
			address      TEXT,
			tx_hash      TEXT,
			direction    TEXT, -- 'from' or 'to'
			block_height INTEGER,
			PRIMARY KEY (address, tx_hash, direction)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_addr_tx_addr ON address_tx(address)`,
		`CREATE INDEX IF NOT EXISTS idx_addr_tx_height ON address_tx(block_height)`,
		`CREATE TABLE IF NOT EXISTS logs (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			address      TEXT,
			topic0       TEXT,
			topic1       TEXT,
			topic2       TEXT,
			topic3       TEXT,
			data         TEXT,
			block_height INTEGER,
			tx_hash      TEXT,
			log_index    INTEGER
		)`,
		`CREATE INDEX IF NOT EXISTS idx_logs_address ON logs(address)`,
		`CREATE INDEX IF NOT EXISTS idx_logs_topic0 ON logs(topic0)`,
	}
	for _, st := range stmts {
		if _, err := s.db.Exec(st); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}

// displayAddr derives the 20-byte (40-hex) display address from a node key.
// The node keys accounts by the 64-hex ed25519 pubkey; the wallet displays
// pub[0:40] (crypto_verify.go addrFromPubKey). Storing both forms lets the
// API resolve either a 64-hex key or a 20-byte display address.
func DisplayAddr(key string) string {
	k := strings.TrimPrefix(strings.ToLower(key), "0x")
	if len(k) >= 40 {
		return k[:40]
	}
	return k
}

// BlockRow is a stored block.
type BlockRow struct {
	Height    int64
	Hash      string
	Parent    string
	Timestamp int64
	Proposer  string
	TxCount   int
}

// TxRow is a stored transaction.
type TxRow struct {
	Hash      string
	Block     int64
	Idx       int
	Nonce     int64
	From      string
	To        string
	Value     string
	GasLimit  int64
	GasPrice  int64
	GasUsed   int64
	Lane      int
	Data      string
	Timestamp int64
}

// LogRow is a stored EVM log.
type LogRow struct {
	Address  string
	Topics   []string // topic0..topic3
	Data     string
	Block    int64
	TxHash   string
	LogIndex int
}

// SaveBlock persists a block + its transactions + address index + logs in a
// single transaction. logs may be nil/empty (e.g. pre-EXPL-2 nodes).
func (s *Store) SaveBlock(b BlockRow, txs []TxRow, logs []LogRow) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`INSERT OR IGNORE INTO blocks (height,hash,parent_hash,timestamp,proposer,tx_count)
		 VALUES (?,?,?,?,?,?)`,
		b.Height, b.Hash, b.Parent, b.Timestamp, b.Proposer, b.TxCount); err != nil {
		return fmt.Errorf("insert block: %w", err)
	}

	for _, t := range txs {
		if _, err := tx.Exec(
			`INSERT OR IGNORE INTO transactions
			 (hash,block_height,idx,nonce,from_addr,to_addr,value,gas_limit,gas_price,gas_used,lane,data,timestamp)
			 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			t.Hash, t.Block, t.Idx, t.Nonce, t.From, t.To, t.Value,
			t.GasLimit, t.GasPrice, t.GasUsed, t.Lane, t.Data, t.Timestamp); err != nil {
			return fmt.Errorf("insert tx: %w", err)
		}
		// Address index: store both the raw key and its 20-byte display form.
		fromKey := t.From
		toKey := t.To
		addrs := map[string]string{}
		if fromKey != "" {
			addrs[fromKey] = "from"
			addrs[DisplayAddr(fromKey)] = "from"
		}
		if toKey != "" {
			addrs[toKey] = "to"
			addrs[DisplayAddr(toKey)] = "to"
		}
		for addr, dir := range addrs {
			if _, err := tx.Exec(
				`INSERT OR IGNORE INTO address_tx (address,tx_hash,direction,block_height) VALUES (?,?,?,?)`,
				addr, t.Hash, dir, t.Block); err != nil {
				return fmt.Errorf("insert address_tx: %w", err)
			}
		}
	}

	for _, l := range logs {
		t0, t1, t2, t3 := "", "", "", ""
		if len(l.Topics) > 0 {
			t0 = l.Topics[0]
		}
		if len(l.Topics) > 1 {
			t1 = l.Topics[1]
		}
		if len(l.Topics) > 2 {
			t2 = l.Topics[2]
		}
		if len(l.Topics) > 3 {
			t3 = l.Topics[3]
		}
		if _, err := tx.Exec(
			`INSERT INTO logs (address,topic0,topic1,topic2,topic3,data,block_height,tx_hash,log_index)
			 VALUES (?,?,?,?,?,?,?,?,?)`,
			l.Address, t0, t1, t2, t3, l.Data, l.Block, l.TxHash, l.LogIndex); err != nil {
			return fmt.Errorf("insert log: %w", err)
		}
	}

	return tx.Commit()
}

// HasBlock reports whether a block height is already indexed.
func (s *Store) HasBlock(height int64) (bool, error) {
	var n int
	err := s.db.QueryRow(`SELECT count(*) FROM blocks WHERE height=?`, height).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// Head returns the highest indexed block height (-1 if none).
func (s *Store) Head() (int64, error) {
	var h sql.NullInt64
	err := s.db.QueryRow(`SELECT max(height) FROM blocks`).Scan(&h)
	if err != nil {
		return -1, err
	}
	if !h.Valid {
		return -1, nil
	}
	return h.Int64, nil
}

// Blocks returns the most recent blocks (desc), limited.
func (s *Store) Blocks(limit, offset int) ([]BlockRow, error) {
	rows, err := s.db.Query(
		`SELECT height,hash,parent_hash,timestamp,proposer,tx_count FROM blocks
		 ORDER BY height DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BlockRow
	for rows.Next() {
		var b BlockRow
		if err := rows.Scan(&b.Height, &b.Hash, &b.Parent, &b.Timestamp, &b.Proposer, &b.TxCount); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// Block returns a single block by height.
func (s *Store) Block(height int64) (*BlockRow, error) {
	var b BlockRow
	err := s.db.QueryRow(
		`SELECT height,hash,parent_hash,timestamp,proposer,tx_count FROM blocks WHERE height=?`,
		height).Scan(&b.Height, &b.Hash, &b.Parent, &b.Timestamp, &b.Proposer, &b.TxCount)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// TxsByBlock returns transactions for a block, in order.
func (s *Store) TxsByBlock(height int64) ([]TxRow, error) {
	return s.queryTxs(
		`SELECT hash,block_height,idx,nonce,from_addr,to_addr,value,gas_limit,gas_price,gas_used,lane,data,timestamp
		 FROM transactions WHERE block_height=? ORDER BY idx`, height)
}

// Tx returns a single transaction by hash.
func (s *Store) Tx(hash string) (*TxRow, error) {
	rows, err := s.queryTxs(
		`SELECT hash,block_height,idx,nonce,from_addr,to_addr,value,gas_limit,gas_price,gas_used,lane,data,timestamp
		 FROM transactions WHERE hash=?`, hash)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

// TxsByAddress returns transactions touching an address (either form), desc.
func (s *Store) TxsByAddress(addr string, limit, offset int) ([]TxRow, error) {
	key := strings.TrimPrefix(strings.ToLower(addr), "0x")
	return s.queryTxs(
		`SELECT t.hash,t.block_height,t.idx,t.nonce,t.from_addr,t.to_addr,t.value,t.gas_limit,t.gas_price,t.gas_used,t.lane,t.data,t.timestamp
		 FROM transactions t JOIN address_tx a ON a.tx_hash=t.hash
		 WHERE a.address=? ORDER BY t.block_height DESC, t.idx DESC LIMIT ? OFFSET ?`,
		key, limit, offset)
}

// AddressTxCount returns the number of txs touching an address.
func (s *Store) AddressTxCount(addr string) (int, error) {
	key := strings.TrimPrefix(strings.ToLower(addr), "0x")
	var n int
	err := s.db.QueryRow(`SELECT count(DISTINCT tx_hash) FROM address_tx WHERE address=?`, key).Scan(&n)
	return n, err
}

// Logs returns logs matching optional filters (address, topic0).
func (s *Store) Logs(address, topic0 string, fromBlock, toBlock, limit int64) ([]LogRow, error) {
	q := `SELECT address,topic0,topic1,topic2,topic3,data,block_height,tx_hash,log_index FROM logs WHERE 1=1`
	var args []interface{}
	if address != "" {
		q += ` AND address=?`
		args = append(args, strings.TrimPrefix(strings.ToLower(address), "0x"))
	}
	if topic0 != "" {
		q += ` AND topic0=?`
		args = append(args, strings.TrimPrefix(strings.ToLower(topic0), "0x"))
	}
	if fromBlock >= 0 {
		q += ` AND block_height>=?`
		args = append(args, fromBlock)
	}
	if toBlock >= 0 {
		q += ` AND block_height<=?`
		args = append(args, toBlock)
	}
	q += ` ORDER BY block_height DESC, log_index DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []LogRow
	for rows.Next() {
		var l LogRow
		var t0, t1, t2, t3, data string
		if err := rows.Scan(&l.Address, &t0, &t1, &t2, &t3, &data, &l.Block, &l.TxHash, &l.LogIndex); err != nil {
			return nil, err
		}
		l.Data = data
		l.Topics = nil
		for _, t := range []string{t0, t1, t2, t3} {
			if t != "" {
				l.Topics = append(l.Topics, "0x" + t)
			}
		}
		l.Address = "0x" + l.Address
		out = append(out, l)
	}
	return out, rows.Err()
}

// Stats returns aggregate counts for the network overview.
func (s *Store) Stats() (blocks, txs, addresses int64, err error) {
	if e := s.db.QueryRow(`SELECT count(*), coalesce(sum(tx_count),0) FROM blocks`).Scan(&blocks, &txs); e != nil {
		return 0, 0, 0, e
	}
	if e := s.db.QueryRow(`SELECT count(DISTINCT address) FROM address_tx`).Scan(&addresses); e != nil {
		return 0, 0, 0, e
	}
	return blocks, txs, addresses, nil
}

func (s *Store) queryTxs(q string, args ...interface{}) ([]TxRow, error) {
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TxRow
	for rows.Next() {
		var t TxRow
		if err := rows.Scan(&t.Hash, &t.Block, &t.Idx, &t.Nonce, &t.From, &t.To, &t.Value,
			&t.GasLimit, &t.GasPrice, &t.GasUsed, &t.Lane, &t.Data, &t.Timestamp); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// HexToUint64 parses a 0x-prefixed or plain hex string to uint64.
func HexToUint64(s string) (uint64, error) {
	s = strings.TrimPrefix(s, "0x")
	if s == "" {
		return 0, nil
	}
	var v uint64
	if _, err := fmt.Sscanf(s, "%x", &v); err != nil {
		return 0, err
	}
	return v, nil
}

// ToHex0x ensures a hex string is 0x-prefixed.
func ToHex0x(s string) string {
	if strings.HasPrefix(s, "0x") {
		return s
	}
	return "0x" + s
}

// BytesToHex encodes bytes as 0x-prefixed hex.
func BytesToHex(b []byte) string {
	if len(b) == 0 {
		return "0x"
	}
	return "0x" + hex.EncodeToString(b)
}
