// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Canonical protocol constants mirrored from consensus/*.go (source of truth).
// These are PROTOCOL CONSTANTS, not client guesses. If the node later exposes
// way_validatorMinStake / way_validatorTotalStake RPCs, prefer those over this
// module (see issue: make validator thresholds truly live / drift-proof).
//
// Sources (verified 2026-07-19 against master):
//   consensus.go:50        MinValidatorStake = 10000   // minimum self-bond (WAY)
//   consensus/validators.go:11  MaxValidators   = 200
//   consensus/validators.go:12  MinStake        = 100   // devnet test fixture (NOT validator min)
//   consensus/validators.go:13  JailThreshold   = 50    // missed blocks before jail
//   consensus/validators.go:96  TotalStake()           // sum of WAY staked by validators

export const VALIDATOR_CONSTANTS = {
  // Minimum self-bond to JOIN the active validator set (consensus.go:50).
  minValidatorStake: 10000,
  // Hard cap on active validators (validators.go:11).
  maxValidators: 200,
  // Consecutive missed blocks that jail a validator (validators.go:13).
  jailThresholdBlocks: 50,
  // NOTE: total community stake is NOT a constant — it is chain state.
  // Read it live via way_validatorTotalStake once exposed; until then the
  // Stake tab shows validator count (way_validatorCount) as the live signal.
};

export default VALIDATOR_CONSTANTS;
