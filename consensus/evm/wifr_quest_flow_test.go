package evm

import (
	"encoding/hex"
	"fmt"
	"math/big"
	"testing"
)

// TestWIFRQuestFullFlow is the complete Dox_Dev / WIFR → quest integration test.
//
// It exercises the REAL precompile path end-to-end (no mocks):
//   1. Burn 1 WIFR on Solana (off-chain). The attester bot witnesses it via
//      CrossChainAttestation 0x1F witnessEvent (selector 0xC1A2B3D4), labelling
//      the wifr-bridge event on the SolanaChainID sentinel.
//   2. The founder-designated autopilot oracle (Dox_Dev L3) calls
//      TaskRegistry 0x23 taskAutoVerify (0x04A78446) for task "wifr-bridge".
//      wifr-bridge is auto-eligible (THE DOOR) and pays 50 WAY from treasury 0x03.
//   3. Assert the real state transitions: attestation recorded, task marked
//      verified (slot=2), claimant balance +50, treasury debited -50, cap paid.
//
// This is the user-flow gate: real users pass through it to enter the quest.
func TestWIFRQuestFullFlow(t *testing.T) {
	state := NewStateDB()

	// ── Genesis-like seed ──
	// Treasury 0x03 funded (mirrors SeedAllGenesis / InitGenesis).
	treasury := state.GetOrCreateAccount(PrecompileAddrHex(0x03))
	treasury.Balance = big.NewInt(10_000_000)
	// Live supply tracker (QuestCap = 5% of this = 5M).
	QuestAddSupply(state, big.NewInt(100_000_000))

	// ── Actors ──
	attester := "00000000000000000000000000000000000000d2" // Dox_Dev L2+ (witness)
	claimant := "00000000000000000000000000000000000000aa" // the WIFR burner entering the quest
	autopilot := "00000000000000000000000000000000000000bb" // founder-designated oracle (L3)

	// Attester must be a verified Dox_Dev (L2+) to witness on 0x1F.
	state.GetOrCreateAccount(attester).DoxDevLevel = 3
	// Founder must be Dox_Dev L3 to designate the autopilot oracle.
	state.GetOrCreateAccount(FounderAddress).DoxDevLevel = 3
	// Founder designates the autopilot oracle (questSetAutopilot, 0x7680323F).
	setAP := append([]byte{0x76, 0x80, 0x32, 0x3F}, mustHex20(autopilot)...)
	if _, err := taskRegistryPrecompile(setAP, FounderAddress, state, 1); err != nil {
		t.Fatalf("questSetAutopilot: %v", err)
	}
	if got := autopilotAddress(state); got != autopilot {
		t.Fatalf("autopilot slot = %s, want %s", got, autopilot)
	}

	// ── Step 1: burn 1 WIFR on Solana → attester witnesses on 0x1F ──
	// witnessEvent(bytes32 sourceChain, uint256 sourceBlock, bytes32 sourceTxHash, bytes eventData)
	sourceChain := make([]byte, 32)
	copy(sourceChain, []byte(SolanaChainID))
	sourceBlock := make([]byte, 32)
	sourceBlock[31] = 1
	sourceTx := make([]byte, 32)
	copy(sourceTx, []byte("wifr-burn-tx-0000000000000001"))
	witness := []byte{0xC1, 0xA2, 0xB3, 0xD4}
	witness = append(witness, sourceChain...)
	witness = append(witness, sourceBlock...)
	witness = append(witness, sourceTx...)
	witness = append(witness, []byte("burn:1 WIFR")...) // eventData

	beforeAtt := state.GetAccount(PrecompileAddrHex(0x1F))
	if beforeAtt != nil {
		t.Fatal("0x1F should start empty")
	}
	if _, err := crossChainAttestationPrecompile(witness, attester, state, 10); err != nil {
		t.Fatalf("CrossChainAttestation witnessEvent: %v", err)
	}
	// Attestation recorded under 0x1F.
	attAcc := state.GetAccount(PrecompileAddrHex(0x1F))
	if attAcc == nil {
		t.Fatal("0x1F attestation not recorded")
	}
	fmt.Println("  ✅ Step 1: 1 WIFR burn witnessed on CrossChainAttestation 0x1F")

	// ── Step 2: claim the wifr-bridge quest (taskClaim 0xA1B2C3D4) ──
	claim := append([]byte{0xA1, 0xB2, 0xC3, 0xD4}, padTask("wifr-bridge")...)
	if _, err := taskRegistryPrecompile(claim, claimant, state, 11); err != nil {
		t.Fatalf("taskClaim wifr-bridge: %v", err)
	}
	// ── Step 2b: autopilot auto-verifies (taskAutoVerify 0x04A78446) ──
	auto := autoVerifyInput("wifr-bridge", claimant)
	if _, err := taskRegistryPrecompile(auto, autopilot, state, 12); err != nil {
		t.Fatalf("taskAutoVerify wifr-bridge: %v", err)
	}
	fmt.Println("  ✅ Step 2: autopilot auto-verified wifr-bridge quest")

	// ── Step 3: assert real state ──
	// Task marked verified (slot 0x10..[claimant] = 2).
	claimKey := storageKey(append([]byte{0x10}, []byte(claimant)...))
	cs := state.GetAccount(claimant).Storage[claimKey]
	if cs[31] != 2 {
		t.Fatalf("wifr-bridge status = %d, want 2 (verified)", cs[31])
	}
	// Claimant balance +50 WAY.
	cb := state.GetAccount(claimant).Balance
	if cb == nil || cb.Uint64() != 50 {
		t.Fatalf("claimant balance = %v, want 50", cb)
	}
	// Treasury debited -50.
	tb := state.GetAccount(PrecompileAddrHex(0x03)).Balance
	if tb.Uint64() != 10_000_000-50 {
		t.Fatalf("treasury balance = %v, want 9,999,950", tb)
	}
	// Cumulative paid against cap incremented by 50.
	paidKey := storageKey([]byte{0x40})
	paid := readBigInt(state.GetAccount(PrecompileAddrHex(0x23)).Storage[paidKey])
	if paid.Uint64() != 50 {
		t.Fatalf("cumulative paid = %v, want 50", paid)
	}
	fmt.Printf("  ✅ Step 3: claimant +50 WAY, treasury -50 (paid=%d), wifr-bridge verified\n", paid.Uint64())

	// ── Negative: a non-autopilot caller cannot auto-verify ──
	rando := "00000000000000000000000000000000000000cc"
	if _, err := taskRegistryPrecompile(autoVerifyInput("wifr-bridge", rando), rando, state, 13); err == nil {
		t.Fatal("expected non-autopilot autoVerify to be rejected")
	}
	fmt.Println("  ✅ Negative: non-autopilot autoVerify rejected")
}

// TestWIFRQuestFlowRejectsUnwitnessedBurn asserts the off-chain ordering the
// Dox_Dev model relies on: the attester must be a verified oracle (Dox_Dev 2+)
// to witness the WIFR burn on 0x1F. A level-0 caller is rejected.
func TestWIFRQuestFlowRejectsUnwitnessedBurn(t *testing.T) {
	state := NewStateDB()
	sourceChain := make([]byte, 32)
	copy(sourceChain, []byte(SolanaChainID))
	sourceBlock := make([]byte, 32)
	sourceTx := make([]byte, 32)
	witness := []byte{0xC1, 0xA2, 0xB3, 0xD4}
	witness = append(witness, sourceChain...)
	witness = append(witness, sourceBlock...)
	witness = append(witness, sourceTx...)

	// Level-0 caller → must be rejected by isVerifiedOracle.
	if _, err := crossChainAttestationPrecompile(witness, "0000000000000000000000000000000000000099", state, 1); err == nil {
		t.Fatal("expected level-0 witness to be rejected")
	}
	fmt.Println("  ✅ Negative: level-0 WIFR burn witness rejected (Dox_Dev gate holds)")
}

func mustHex20Check(a string) []byte {
	b, err := hex.DecodeString(a)
	if err != nil {
		panic(err)
	}
	return b
}
