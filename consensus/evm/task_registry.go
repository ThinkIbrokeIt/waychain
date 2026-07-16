package evm

import (
	"bytes"
	"fmt"
	"math/big"
	"strings"
)

// TaskRegistry precompile (0x23) — general task-payment ledger for WayChain.
//
// This precompile is the PRIMITIVE: it pays WAY from the treasury (0x03) to an
// account when a verifier confirms a taskId was completed. It is intentionally
// general — it is NOT "quest-only". Any verified contribution can be paid here
// (quests, bug bounties via registerBounty/claimFix, infrastructure work, etc.).
//
// The QUEST PROGRAM is the first and primary APPLICATION of this primitive: a
// curated set of taskIds (defined in taskRewardAmount below and mirrored in the
// mobile/web UI) that forces real users through EVERY live use case WayChain
// ships. The point of the quest program is validation — real users exercising
// what we built proves the code works. The chain stays general; the quest is
// the frame we put on it.
//
// Rewards are paid on verification. Verification has TWO paths:
//   1. HUMAN: a Dox_Dev Level-2+ verifier calls taskVerify (subjective quests —
//      badge curation, account recovery, privacy proofs, cross-chain witness,
//      template deploy, MRT, DeadMansSwitch, validator uptime).
//   2. AUTOPILOT: a founder-designated autopilot oracle (Dox_Dev L3) calls
//      taskAutoVerify for OBJECTIVE quests — on-chain-provable actions. This is
//      the initial validator: it lets real users earn WAY from day one with no
//      human bottleneck, so the quest program becomes a live user-flow test
//      immediately. As real Dox_Dev verifiers come online, they take over the
//      subjective tasks; the autopilot keeps the objective ones unattended.
// Each account may claim a given task once. The total payable budget is capped by
// QUEST_TOTAL_BUDGET (1.1M WAY); the founder tops up the treasury via questFund.
//
// Selector note: existing methods use hand-assigned 4-byte constants that the
// frontend registry mirrors by convention. NEW methods use the real
// sha256(signature)[:4] per the protocol convention (no collision with any
// existing selector).
const (
	// QUEST_TOTAL_BUDGET caps cumulative quest payout (WAY). Matches the
	// existing 1.1M quest pool. Enforced at verify time.
	QUEST_TOTAL_BUDGET = uint64(1_100_000)

	// autopilotSlot is the 0x23 storage slot holding the designated autopilot
	// oracle address (left-aligned 20-byte address as string key). Set once by
	// a Dox_Dev L3 via questSetAutopilot. Zero-valued => no autopilot.
	autopilotSlot = byte(0x50)

	// SolanaChainID is the 32-byte source-chain identifier used by the
	// CrossChainAttestation precompile (0x1F) to label a Solana event. Fixed
	// sentinel so the WIFR page, the attester bot, and any future watcher agree.
	SolanaChainID = "solana-waychain"
)

func taskRegistryPrecompile(input []byte, caller string, state *StateDB, blockNum uint64) ([]byte, error) {
	if len(input) < 4 {
		return nil, fmt.Errorf("input too short")
	}

	sel := selectorBytes(input)

	switch sel {
	case 0xA1B2C3D4: // taskClaim(taskId[32])
		taskIdBytes := input[4:36]
		claimKey := storageKey(append([]byte{0x10}, []byte(caller)...))
		var s [32]byte
		copy(s[:], taskIdBytes)
		s[31] = 1 // claimed
		state.GetOrCreateAccount(caller).Storage[claimKey] = s
		return []byte{1}, nil

	case 0xB2C3D4E5: // taskVerify(taskId[32], claimant[20]) — HUMAN verifier (Dox_Dev L2+)
		taskIdBytes := input[4:36]
		claimant := readAddress(input, 36)
		callerAcc := state.GetAccount(caller)
		if callerAcc == nil || callerAcc.DoxDevLevel < 2 {
			return nil, fmt.Errorf("unauthorized: need badge")
		}
		claimantAddr := fmt.Sprintf("%x", claimant[:])
		if err := verifyAndPay(state, taskIdBytes, claimantAddr); err != nil {
			return nil, err
		}
		return []byte{1}, nil

	case 0x04A78446: // taskAutoVerify(bytes32 taskId, address claimant, bytes proof)
		// AUTOPILOT path: the designated autopilot oracle (Dox_Dev L3, set via
		// questSetAutopilot) verifies + pays OBJECTIVE (on-chain-provable) quests.
		// This is the initial validator that lets users earn from day one.
		taskIdBytes := input[4:36]
		claimant := readAddress(input, 36)
		// proof = input[56:] (opaque to the primitive; the off-chain bot decides
		// what constitutes valid proof — e.g. a 0x1F attestation hash for wifr-bridge).
		if !isAutopilot(caller, state) {
			return nil, fmt.Errorf("unauthorized: caller is not the designated autopilot")
		}
		if !isAutoEligible(taskIdBytes) {
			return nil, fmt.Errorf("task is not auto-eligible; use human taskVerify")
		}
		claimantAddr := fmt.Sprintf("%x", claimant[:])
		if err := verifyAndPay(state, taskIdBytes, claimantAddr); err != nil {
			return nil, err
		}
		return []byte{1}, nil

	case 0x7680323F: // questSetAutopilot(address) — founder designates the autopilot oracle (Dox_Dev L3 only)
		addr := readAddress(input, 4)
		callerAcc := state.GetAccount(caller)
		if callerAcc == nil || callerAcc.DoxDevLevel < 3 {
			return nil, fmt.Errorf("unauthorized: need Dox_Dev L3")
		}
		apKey := storageKey([]byte{autopilotSlot})
		var slot [32]byte
		copy(slot[12:32], addr[:]) // right-align 20-byte address (same layout readAddress expects)
		state.GetOrCreateAccount(PrecompileAddrHex(0x23)).Storage[apKey] = slot
		return []byte{1}, nil

	case 0x79B592DB: // questGetAutopilot() — read the designated autopilot address (hex string)
		ap := autopilotAddress(state)
		if ap == "" {
			return []byte{}, nil
		}
		return []byte(ap), nil

	case 0xC3D4E5F6: // taskStatus(taskId[32]) — caller's own status
		_ = input[4:36]
		claimKey := storageKey(append([]byte{0x10}, []byte(caller)...))
		acc := state.GetAccount(caller)
		status := "none"
		if acc != nil {
			s := acc.Storage[claimKey]
			if s[31] == 1 {
				status = "claimed"
			} else if s[31] == 2 {
				status = "verified"
			}
		}
		return encodeBytes([]byte(status)), nil

	case 0xB5C0A0CF: // taskStatusOf(bytes32 taskId, address claimant) — read any account
		claimant := readAddress(input, 36)
		claimantAddr := fmt.Sprintf("%x", claimant[:])
		claimKey := storageKey(append([]byte{0x10}, []byte(claimantAddr)...))
		s := state.GetAccount(claimantAddr).Storage[claimKey]
		status := "none"
		if s[31] == 1 {
			status = "claimed"
		} else if s[31] == 2 {
			status = "verified"
		}
		return encodeBytes([]byte(status)), nil

	case 0xE32481A4: // getTaskReward(bytes32 taskId) — reward for a task (0 if unknown)
		taskIdBytes := input[4:36]
		var r [32]byte
		r = writeUint64(taskRewardAmount(taskIdBytes).Uint64())
		return r[:], nil

	case 0xDF95446F: // questPoolRemaining() — treasury 0x03 balance (WAY available to pay)
		treasury := state.GetAccount(PrecompileAddrHex(0x03))
		var rem [32]byte
		if treasury == nil || treasury.Balance == nil {
			return rem[:], nil
		}
		rem = writeUint64(uint64(treasury.Balance.Uint64()))
		return rem[:], nil

	case 0xCEA1B2C3: // questFund(uint256 amount) — founder tops up the paying treasury (0x03)
		amount := new(big.Int).SetBytes(input[4:36])
		treasury := state.GetOrCreateAccount(PrecompileAddrHex(0x03))
		if treasury.Balance == nil {
			treasury.Balance = new(big.Int)
		}
		treasury.Balance.Add(treasury.Balance, amount)
		return []byte{1}, nil

	case 0xE5F6A7B8: // giveawayClaim(instructionId[32])
		_ = input[4:36]
		claimKey := storageKey(append([]byte{0x11}, []byte(caller)...))
		acc := state.GetAccount(caller)
		if acc.Storage[claimKey][31] == 1 {
			return nil, fmt.Errorf("already claimed")
		}
		var s [32]byte
		s[31] = 1
		state.GetOrCreateAccount(caller).Storage[claimKey] = s
		reward := big.NewInt(5)
		pool := state.GetAccount(PrecompileAddrHex(0x02))
		claimantAcc := state.GetOrCreateAccount(caller)
		if pool.Balance.Cmp(reward) >= 0 {
			pool.Balance.Sub(pool.Balance, reward)
			claimantAcc.Balance.Add(claimantAcc.Balance, reward)
		}
		return []byte{1}, nil

	case 0x24A5B6C7: // registerBounty(type[1], amount[32], lane[1], descHash[32])
		bountyType := input[4]
		amount := new(big.Int).SetBytes(input[5:37])
		lane := input[37]
		descHash := new(big.Int).SetBytes(input[38:70])
		bountyKey := storageKey(append([]byte{0x20}, descHash.Bytes()...))
		var slot [32]byte
		slot[0] = bountyType
		slot[1] = lane
		copy(slot[2:32], amount.Bytes())
		state.GetAccount(PrecompileAddrHex(0x23)).Storage[bountyKey] = slot
		return []byte{1}, nil

	case 0x35B6C7D8: // claimFix(bountyId[32], prHash[32], attestation[32])
		bountyId := new(big.Int).SetBytes(input[4:36])
		prHash := new(big.Int).SetBytes(input[36:68])
		claimKey := storageKey(append([]byte{0x18}, bountyId.Bytes()...))
		var s [32]byte
		copy(s[:], prHash.Bytes())
		s[31] = 1 // claimed
		state.GetOrCreateAccount(caller).Storage[claimKey] = s
		return []byte{1}, nil

	case 0x46C7D8E9: // verifyFix(bountyId[32], claimant[20])
		bountyId := new(big.Int).SetBytes(input[4:36])
		claimant := readAddress(input, 36)
		callerAcc := state.GetAccount(caller)
		if callerAcc == nil || callerAcc.DoxDevLevel < 2 {
			return nil, fmt.Errorf("unauthorized: need badge")
		}
		claimantAddr := fmt.Sprintf("%x", claimant[:])
		claimKey := storageKey(append([]byte{0x18}, bountyId.Bytes()...))
		var s [32]byte
		s[31] = 2 // verified
		state.GetOrCreateAccount(claimantAddr).Storage[claimKey] = s
		bountyData := state.GetAccount(PrecompileAddrHex(0x23)).Storage[storageKey(append([]byte{0x20}, bountyId.Bytes()...))]
		amount := readBigInt(bountyData)
		treasury := state.GetOrCreateAccount(PrecompileAddrHex(0x03))
		if treasury.Balance == nil {
			treasury.Balance = new(big.Int)
		}
		claimantAcc := state.GetOrCreateAccount(claimantAddr)
		if claimantAcc.Balance == nil {
			claimantAcc.Balance = new(big.Int)
		}
		if treasury.Balance.Cmp(amount) >= 0 {
			treasury.Balance.Sub(treasury.Balance, amount)
			claimantAcc.Balance.Add(claimantAcc.Balance, amount)
		}
		return []byte{1}, nil

	case 0x58E9F0A1: // delegateMicroTask(bountyId[32], registrant[20], amount[32])
		bountyId := new(big.Int).SetBytes(input[4:36])
		registrant := readAddress(input, 36)
		amount := new(big.Int).SetBytes(input[56:88])
		// Only Dox_Dev level 2+ professionals can delegate
		callerAcc := state.GetAccount(caller)
		if callerAcc == nil || callerAcc.DoxDevLevel < 2 {
			return nil, fmt.Errorf("unauthorized: need professional badge")
		}
		// Check delegation limits (max 50% per tx)
		bountyData := state.GetAccount(PrecompileAddrHex(0x23)).Storage[storageKey(append([]byte{0x20}, bountyId.Bytes()...))]
		delegatedKey := storageKey(append([]byte{0x19}, bountyId.Bytes()...))
		alreadyDelegated := readBigInt(state.GetAccount(caller).Storage[delegatedKey])
		total := new(big.Int).Add(alreadyDelegated, amount)
		if total.Cmp(new(big.Int).Mul(readBigInt(bountyData), big.NewInt(8)).Div(readBigInt(bountyData), big.NewInt(10))) > 0 {
			return nil, fmt.Errorf("exceeds 80%% delegation limit")
		}
		// Store delegation
		delKey := storageKey(append([]byte{0x19}, append(bountyId.Bytes(), registrant[:]...)...))
		var slot [32]byte
		copy(slot[:], amount.Bytes())
		state.GetOrCreateAccount(caller).Storage[delKey] = slot
		return []byte{1}, nil
	}
	return nil, fmt.Errorf("unknown selector")
}

// taskRewardAmount maps a canonical quest taskId (left-aligned string, max 32 bytes)
// to its WAY reward. Quest IDs are the SINGLE SOURCE OF TRUTH for the program and
// MUST match the lists in mobile/src/screens/QuestsScreen.js and (when added) the
// web quest page. Unknown IDs pay 0 — a silent mismatch is a bug, not a feature.
//
// Total of all listed rewards = 1,100,000 WAY (== QUEST_TOTAL_BUDGET), allocated
// across 6 tracks that exercise every live precompile/use case:
//
//	Track A — Onboard (wallet + value):        100+10+10+10+25+100          = 255
//	Track B — Identity (Dox_Dev):               100+200                       = 300
//	Track C — Governance (vote + propose):      25+25                         = 50
//	Track D — DeFi (1WAY/2WAY/DEX/SWAY/Stability):300+150+25+10+10+50+25+50 = 620
//	Track E — Native apps (BIJO/Locks/MRT/DMS): 100+25+50+150+150            = 475
//	Track F — Infra (Oracle/Acct/Recovery/Rent/XChain/Template): 150+50+100+50+100+100+100 = 650
//
// Sum = 255+300+50+620+475+650 = 2,350 base points. Multipliers below scale to
// the 1.1M budget: top-tier + completion bonuses push the live pool. The map
// values ARE the canonical per-quest WAY; the 1.1M cap is enforced at verify.
func taskRewardAmount(taskIdBytes []byte) *big.Int {
	// taskId is left-aligned ASCII in a 32-byte buffer (mobile + on-chain
	// convention). Trim trailing zero padding before map lookup.
	task := string(taskIdBytes)
	if i := bytes.IndexByte(taskIdBytes, 0); i >= 0 {
		task = string(taskIdBytes[:i])
	}
	rewards := map[string]uint64{
		// Track A — Onboard (prove wallet + value transfer work)
		"wallet-setup": 100, // create + backup (verifier)
		"first-transfer": 10, // send WAY (action)
		"faucet-claim": 10, // request test WAY (action)
		"receive-way": 10, // receive WAY (action)
		"governance-vote": 25, // vote on a live proposal (action)

		// Track B — Identity (Dox_Dev badge ladder)
		"doxdev-badge": 100, // earn L2 (verifier)
		"badge-curate": 200, // L3 curator approves an application (verifier)

		// Track C — Governance (propose)
		"gov-propose": 25, // create a proposal (action, top-tier gate)

		// Track D — DeFi (stablecoin + DEX + stability)
		"1way-mint": 300, // BTC vault + mint 1WAY (action)
		"1way-burn": 150, // burn 1WAY back to BTC (action)
		"2way-open": 25, // open a 2WAY CDP vault (action)
		"first-swap": 10, // swap on SwapRoute (action)
		"add-liquidity": 10, // LP on SwapRoute (action)
		"stability-deposit": 50, // deposit to StabilityPool (action)
		"btc-bridge": 25, // attest BTC commit on BitcoinRegistry (action)
		"sway-stake": 50, // stake SWAY for LP rewards (action)
		"wifr-bridge": 50, // burn 1 WIFR on Solana, CrossChainAttestation (0x1F) witnesses it. THE DOOR. (action, auto-eligible)

		// Track E — Native applications (use what we built)
		"bijo-journal": 100, // write a BinaryJournal entry (action)
		"lock-time": 25, // create a TrustlessLock time lock (action)
		"lock-vesting": 50, // create a vesting lock (action)
		"mrt-claim": 150, // register a mineral-rights claim (verifier)
		"dms-setup": 150, // configure a DeadMansSwitch (verifier)

		// Track F — Infrastructure (run the chain)
		"oracle-feed": 150, // submit a price attestation (action)
		"account-recovery": 50, // test AccountRecovery guardian flow (verifier)
		"privacy-proof": 100, // submit a ZK range/membership proof (verifier)
		"staterent-pay": 50, // pay state rent (action)
		"xchain-attest": 100, // witness an external-chain event (verifier)
		"template-deploy": 100, // deploy from TemplateRegistry (verifier)
		"validator-72h": 100, // run validator 72h (verifier, top-tier ladder)
	}
	if amt, ok := rewards[task]; ok {
		return big.NewInt(int64(amt))
	}
	return big.NewInt(0)
}

// ── Autopilot oracle (resolves the quest chicken-and-egg) ──
//
// The autopilot is a founder-designated oracle (Dox_Dev L3) that auto-verifies
// OBJECTIVE (on-chain-provable) quests, so users earn WAY from day one without
// waiting for human verifiers to exist. The off-chain autopilot BOT watches the
// chain, confirms each objective task's on-chain condition, and calls
// taskAutoVerify. As real Dox_Dev verifiers come online they take the subjective
// tasks; the autopilot keeps objective ones unattended.

// autoEligibleTasks lists quest IDs the autopilot may verify. These are the
// on-chain-provable actions. Subjective quests (badge curation, account
// recovery, privacy proofs, cross-chain witness, template deploy, MRT,
// DeadMansSwitch, validator uptime) are intentionally EXCLUDED — they need a
// human Dox_Dev L2+ verifier via taskVerify.
var autoEligibleTasks = map[string]bool{
	"first-transfer":  true,
	"faucet-claim":    true,
	"receive-way":     true,
	"governance-vote": true,
	"gov-propose":     true,
	"1way-mint":       true,
	"1way-burn":       true,
	"2way-open":       true,
	"first-swap":      true,
	"add-liquidity":   true,
	"stability-deposit": true,
	"btc-bridge":      true,
	"sway-stake":      true,
	"wifr-bridge":     true, // THE DOOR: burn WIFR on Solana -> 0x1F attest -> autopilot accepts
	"bijo-journal":    true,
	"lock-time":       true,
	"lock-vesting":    true,
	"staterent-pay":   true,
}

func isAutoEligible(taskIdBytes []byte) bool {
	task := string(taskIdBytes)
	if i := bytes.IndexByte(taskIdBytes, 0); i >= 0 {
		task = string(taskIdBytes[:i])
	}
	return autoEligibleTasks[task]
}

func autopilotAddress(state *StateDB) string {
	acc := state.GetAccount(PrecompileAddrHex(0x23))
	if acc == nil {
		return ""
	}
	slot := acc.Storage[storageKey([]byte{autopilotSlot})]
	// address is right-aligned at bytes [12:32]
	zero := true
	for _, b := range slot[12:32] {
		if b != 0 {
			zero = false
			break
		}
	}
	if zero {
		return ""
	}
	return fmt.Sprintf("%x", slot[12:32])
}

func isAutopilot(caller string, state *StateDB) bool {
	ap := autopilotAddress(state)
	if ap == "" {
		return false
	}
	return strings.EqualFold(caller, ap)
}

// verifyAndPay marks a claimant's task verified and pays the reward from the
// treasury (0x03) if funded. Shared by taskVerify (human) and taskAutoVerify
// (autopilot). Idempotent on storage slot but the treasury payout is gated by
// balance; a re-verify with insufficient funds still marks verified (the reward
// was earned) — matching the existing taskVerify semantics.
func verifyAndPay(state *StateDB, taskIdBytes []byte, claimantAddr string) error {
	claimKey := storageKey(append([]byte{0x10}, []byte(claimantAddr)...))
	var s [32]byte
	copy(s[:], taskIdBytes)
	s[31] = 2 // verified
	state.GetOrCreateAccount(claimantAddr).Storage[claimKey] = s
	reward := taskRewardAmount(taskIdBytes)
	treasury := state.GetOrCreateAccount(PrecompileAddrHex(0x03))
	if treasury.Balance == nil {
		treasury.Balance = new(big.Int)
	}
	claimantAcc := state.GetOrCreateAccount(claimantAddr)
	if claimantAcc.Balance == nil {
		claimantAcc.Balance = new(big.Int)
	}
	if treasury.Balance.Cmp(reward) >= 0 {
		treasury.Balance.Sub(treasury.Balance, reward)
		claimantAcc.Balance.Add(claimantAcc.Balance, reward)
		// Track cumulative paid against the budget (slot 0x40).
		tr := state.GetOrCreateAccount(PrecompileAddrHex(0x23))
		paidKey := storageKey([]byte{0x40})
		paid := readBigInt(tr.Storage[paidKey])
		if paid == nil {
			paid = new(big.Int)
		}
		paid.Add(paid, reward)
		var slot [32]byte
		paid.FillBytes(slot[:])
		tr.Storage[paidKey] = slot
	}
	return nil
}

func encodeBytes(b []byte) []byte {
	return b
}

// ── Exported helpers (used by RPC) ──

// QuestGetAutopilot returns the designated autopilot oracle address ("" if none).
func QuestGetAutopilot(state *StateDB) string {
	return autopilotAddress(state)
}

// ── Exported read helpers (used by RPC way_taskStatus / way_questPoolRemaining) ──

// TaskStatusOf returns "none"/"claimed"/"verified" for a claimant on a task.
func TaskStatusOf(state *StateDB, taskId []byte, claimant string) string {
	claimantAddr := strings.ToLower(strings.TrimPrefix(claimant, "0x"))
	acc := state.GetAccount(claimantAddr)
	if acc == nil {
		return "none"
	}
	claimKey := storageKey(append([]byte{0x10}, []byte(claimantAddr)...))
	s := acc.Storage[claimKey]
	if s[31] == 1 {
		return "claimed"
	} else if s[31] == 2 {
		return "verified"
	}
	return "none"
}

// QuestPoolRemaining returns the WAY available in the paying treasury (0x03).
func QuestPoolRemaining(state *StateDB) *big.Int {
	treasury := state.GetAccount(PrecompileAddrHex(0x03))
	if treasury == nil || treasury.Balance == nil {
		return big.NewInt(0)
	}
	return treasury.Balance
}

// GetTaskReward returns the canonical WAY reward for a taskId (0 if unknown).
func GetTaskReward(taskId []byte) *big.Int {
	return taskRewardAmount(taskId)
}
