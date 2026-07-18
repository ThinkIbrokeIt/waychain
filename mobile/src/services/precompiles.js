// WayChain Precompile Registry — SINGLE SOURCE OF TRUTH for frontend↔backend wiring.
//
// Every precompile (0x0C–0x26) implemented natively in Go in
// waychain-consensus/evm/. This module mirrors that table so web + mobile
// share ONE address/selector map (issue #9, child of #8).
//
// Selector encoding (MUST match evm/precompiles.go selectorBytes):
//   input[0..3] = big-endian uint32 of the selector constant.
//   Args follow per the Go `switch sel` bodies (readAddress=20B, readUint256=32B, ...).
//   WayChain uses SHA256-based ABI, NOT keccak256. The selector constants
//   below are the EXACT uint32 values the Go switch matches — do not recompute.
//
// To build a call:  input = selectorBytes(4) + encodedArgs
//   helper encodeCall(precompile, method, argsHex) does this.

// Full 20-byte precompile address from the 1-byte table index (0x0C..0x26).
export const precompileAddress = (hex1) =>
  '0x' + '0'.repeat(24) + hex1.toLowerCase().replace(/^0x/, '');

// ── Registry ──────────────────────────────────────────────────────────────
// addr1 = the 1-byte table index (0x0C..0x26)
// methods: { name, sel (4-byte hex, no 0x), sig, kind: 'read'|'write' }
export const PRECOMPILES = {
  // 0x0C-0x12, 0x17 are SINGLE-PURPOSE precompiles: the Go functions read a
  // fixed raw input layout (no selectorBytes dispatch). There is NO 4-byte
  // selector — call data = the raw argument bytes directly.
  '0x0C': {
    name: 'OracleAggregator',
    file: 'evm/precompiles.go',
    noSelector: true,
    methods: [{ name: 'aggregate', sig: 'aggregate() — raw input layout', kind: 'read' }],
  },
  '0x0D': {
    name: 'OracleScheduler',
    file: 'evm/precompiles.go',
    noSelector: true,
    methods: [{ name: 'schedule', sig: 'schedule() — raw input layout', kind: 'write' }],
  },
  '0x0E': {
    name: 'OracleVerifier',
    file: 'evm/precompiles.go',
    noSelector: true,
    methods: [{ name: 'verify', sig: 'verify() — raw input layout', kind: 'write' }],
  },
  '0x0F': {
    name: 'TLSVerifier',
    file: 'evm/precompiles.go',
    noSelector: true,
    methods: [{ name: 'verifyTLS', sig: 'verifyTLS() — raw input layout', kind: 'read' }],
  },
  '0x10': {
    name: 'AggregateSignatureVerify',
    file: 'evm/precompiles.go',
    noSelector: true,
    methods: [{ name: 'verifyAgg', sig: 'verifyAgg() — raw input layout', kind: 'read' }],
  },
  '0x11': {
    name: 'AccountRecovery',
    file: 'evm/precompiles.go',
    noSelector: true,
    methods: [{ name: 'recover', sig: '[targetPub(32)][newOwnerPub(32)][g1Pub(32)+sig1(64)][g2...][g3...]', kind: 'write' }],
  },
  '0x12': {
    name: 'StateRentCalc',
    file: 'evm/precompiles.go',
    noSelector: true,
    methods: [{ name: 'calcRent', sig: '[address(20)][contract_size(8)]', kind: 'read' }],
  },
  '0x13': {
    name: 'DoxDevBadge',
    file: 'evm/precompiles.go',
    methods: [
      { name: 'getLevel', sel: '9e9f1846', sig: 'getLevel(address)', kind: 'read' },
      { name: 'isVerified', sel: '65274728', sig: 'isVerified(address)', kind: 'read' },
      { name: 'hasMinLevel', sel: '7b245afa', sig: 'hasMinLevel(address,uint8)', kind: 'read' },
      { name: 'getCuratorCount', sel: '5fcf5764', sig: 'getCuratorCount()', kind: 'read' },
      { name: 'getTotalBadges', sel: 'e55b5b05', sig: 'getTotalBadges()', kind: 'read' },
      { name: 'issueBadge', sel: '0210186d', sig: 'issueBadge(address,uint8,uint64)', kind: 'write' },
      { name: 'revokeBadge', sel: 'b911f9c7', sig: 'revokeBadge(address,string)', kind: 'write' },
      { name: 'upgradeBadge', sel: '215f898d', sig: 'upgradeBadge(address,uint8)', kind: 'write' },
      { name: 'addCurator', sel: '0f9bd4bd', sig: 'addCurator(address)', kind: 'write' },
      { name: 'removeCurator', sel: 'd52cdf2d', sig: 'removeCurator(address)', kind: 'write' },
    ],
  },
  '0x14': {
    name: 'BIJO',
    file: 'evm/precompiles.go',
    methods: [
      { name: 'balanceOf', sel: '5b46f8f6', sig: 'balanceOf(address)', kind: 'read' },
      { name: 'totalSupply', sel: 'a368022e', sig: 'totalSupply()', kind: 'read' },
      { name: 'transfer', sel: '3b88ef57', sig: 'transfer(address,uint256)', kind: 'write' },
      { name: 'approve', sel: '9f0bb8a9', sig: 'approve(address,uint256)', kind: 'write' },
      { name: 'transferFrom', sel: '4b6685e7', sig: 'transferFrom(address,address,uint256)', kind: 'write' },
      { name: 'allowance', sel: 'd864b7ca', sig: 'allowance(address,address)', kind: 'read' },
      { name: 'enableTransfers', sel: 'ad478cda', sig: 'enableTransfers()', kind: 'write' },
      { name: 'transfersEnabled', sel: '2f30833b', sig: 'transfersEnabled()', kind: 'read' },
    ],
  },
  '0x15': {
    name: 'DeadMansSwitch',
    file: 'evm/precompiles.go',
    methods: [
      { name: 'createSwitch', sel: '7f78edcf', sig: 'createSwitch(uint8,address,uint64,bytes32)', kind: 'write' },
      { name: 'heartbeat', sel: '7018b39e', sig: 'heartbeat(uint64)', kind: 'write' },
      { name: 'claim', sel: '40fadb8b', sig: 'claim(uint64)', kind: 'write' },
      { name: 'cancel', sel: '26c1497e', sig: 'cancel(uint64)', kind: 'write' },
      { name: 'canClaim', sel: 'a688a635', sig: 'canClaim(uint64)', kind: 'read' },
      { name: 'timeUntilClaimable', sel: 'd75235c5', sig: 'timeUntilClaimable(uint64)', kind: 'read' },
      { name: 'getSwitchInfo', sel: '0034afaa', sig: 'getSwitchInfo(uint64)', kind: 'read' },
      { name: 'totalSwitches', sel: '890219ed', sig: 'totalSwitches()', kind: 'read' },
    ],
  },
  '0x16': {
    name: 'BitcoinRegistry',
    file: 'evm/precompiles.go',
    methods: [
      { name: 'getBalance', sel: '2afe5ae4', sig: 'getBalance(address)', kind: 'read' },
      { name: 'getTotalCommitted', sel: '3abfef65', sig: 'getTotalCommitted()', kind: 'read' },
      { name: 'getTotalWithdrawn', sel: '4a77d80b', sig: 'getTotalWithdrawn()', kind: 'read' },
      { name: 'attestCommitment', sel: 'f237c0c2', sig: 'attestCommitment(bytes32,uint256,address,bytes32,bytes32[],bytes32,uint256)', kind: 'write' },
      { name: 'requestWithdrawal', sel: '1d772727', sig: 'requestWithdrawal(uint256,string)', kind: 'write' },
    ],
  },
  '0x17': {
    name: 'StorageEndowment',
    file: 'evm/precompiles.go',
    methods: [
      { name: 'registerOperator', sel: '13e4f0a2', sig: 'registerOperator(uint256)', kind: 'write' },
      { name: 'unregisterOperator', sel: '24b5d1c3', sig: 'unregisterOperator()', kind: 'write' },
      { name: 'getOperatorInfo', sel: '35c6e2d4', sig: 'getOperatorInfo(address)', kind: 'read' },
      { name: 'getOperatorCount', sel: 'a8a012f7', sig: 'getOperatorCount()', kind: 'read' },
    ],
  },
  '0x18': {
    name: 'TwoWayVault',
    file: 'evm/two_way.go',
    methods: [
      { name: 'deposit', sel: 'fbb35030', sig: 'deposit(bytes32,bytes32,uint256)', kind: 'write' },
      { name: 'mint', sel: 'd185e07f', sig: 'mint(bytes32,uint256)', kind: 'write' },
      { name: 'withdraw', sel: 'e9c4b112', sig: 'withdraw(bytes32,bytes32,uint256)', kind: 'write' },
      { name: 'burn', sel: '0e0c59be', sig: 'burn(bytes32,uint256)', kind: 'write' },
      { name: 'liquidate', sel: '5c8b7698', sig: 'liquidate(bytes32)', kind: 'write' },
      { name: 'getVault', sel: '9eb29ef0', sig: 'getVault(bytes32)', kind: 'read' },
      { name: 'vaultCount', sel: '67a9f0f5', sig: 'vaultCount()', kind: 'read' },
      { name: 'getStablecoinPrice', sel: '7a3b4f00', sig: 'getStablecoinPrice(bytes32)', kind: 'read' },
    ],
  },
  '0x19': {
    name: 'StabilityPool',
    file: 'evm/stability_pool.go',
    methods: [
      { name: 'deposit', sel: '4e26609a', sig: 'deposit(uint256)', kind: 'write' },
      { name: 'withdraw', sel: '2e1a7ddd', sig: 'withdraw(uint256)', kind: 'write' },
      { name: 'claimRewards', sel: '6b6f4360', sig: 'claimRewards()', kind: 'write' },
      { name: 'getUserDeposit', sel: '3c5f5f80', sig: 'getUserDeposit(address)', kind: 'read', args: ['account'] },
      { name: 'getPoolStats', sel: '8c5f41d0', sig: 'getPoolStats()', kind: 'read' },
    ],
  },
  '0x1A': {
    name: 'TrustlessLock',
    file: 'evm/trustless_lock.go',
    methods: [
      { name: 'createTimeLock', sel: 'a1b2c3d4', sig: 'createTimeLock(address,address,address,uint256,uint256,address)', kind: 'write' },
      { name: 'createVestingLock', sel: 'b2c3d4e5', sig: 'createVestingLock(...)', kind: 'write' },
      { name: 'createMultiSigLock', sel: 'c3d4e5f6', sig: 'createMultiSigLock(...)', kind: 'write' },
      { name: 'getLock', sel: 'd4e5f6a7', sig: 'getLock(bytes32)', kind: 'read' },
      { name: 'releasableAmount', sel: 'e5f6a7b8', sig: 'releasableAmount(bytes32)', kind: 'read' },
      { name: 'release', sel: 'f6a7b8c9', sig: 'release(bytes32)', kind: 'write' },
      { name: 'extend', sel: 'a7b8c9d0', sig: 'extend(bytes32,uint256)', kind: 'write' },
    ],
  },
  '0x1B': {
    name: 'AccountManager',
    file: 'evm/account_manager.go',
    methods: [
      { name: 'getStage', sel: 'b1c2d3e4', sig: 'getStage()', kind: 'read' },
      { name: 'graduate', sel: 'c2d3e4f5', sig: 'graduate()', kind: 'write' },
      { name: 'advance', sel: 'd3e4f5a6', sig: 'advance()', kind: 'write' },
      { name: 'rotateKey', sel: 'e4f5a6b7', sig: 'rotateKey()', kind: 'write' },
      { name: 'createSession', sel: 'f5a6b7c8', sig: 'createSession()', kind: 'write' },
      { name: 'revokeSession', sel: 'a6b7c8d9', sig: 'revokeSession()', kind: 'write' },
      { name: 'getSession', sel: 'b7c8d9e0', sig: 'getSession()', kind: 'read' },
      { name: 'setGuardian', sel: 'c8d9e0f1', sig: 'setGuardian()', kind: 'write' },
      { name: 'getGuardian', sel: 'd9e0f1a2', sig: 'getGuardian()', kind: 'read' },
      { name: 'freeze', sel: 'e0f1a2b3', sig: 'freeze()', kind: 'write' },
      { name: 'unfreeze', sel: 'f1a2b3c4', sig: 'unfreeze()', kind: 'write' },
    ],
  },
  '0x1C': {
    name: 'Privacy',
    file: 'evm/privacy.go',
    methods: [
      { name: 'commit', sel: 'c1d2e3f4', sig: 'commit(bytes32,bytes)', kind: 'write' },
      { name: 'verifyRange', sel: 'd2e3f4a5', sig: 'verifyRange(bytes32,uint256,uint256,bytes)', kind: 'read' },
      { name: 'verifyMembership', sel: 'e3f4a5b6', sig: 'verifyMembership(bytes32,bytes32[],bytes)', kind: 'read' },
      { name: 'verifyIdentity', sel: 'f4a5b6c7', sig: 'verifyIdentity(bytes32,uint8,bytes)', kind: 'read' },
      { name: 'verifyBalance', sel: 'a5b6c7d8', sig: 'verifyBalance(address,uint256,bytes)', kind: 'read' },
      { name: 'getCommitment', sel: 'b6c7d8e9', sig: 'getCommitment(bytes32)', kind: 'read' },
      { name: 'revokeCommitment', sel: 'c7d8e9f0', sig: 'revokeCommitment(bytes32)', kind: 'write' },
    ],
  },
  '0x1D': {
    name: 'Governance',
    file: 'evm/governance.go',
    methods: [
      { name: 'createProposal', sel: 'd1e2f3a4', sig: 'createProposal(uint8 voteType,bytes32 titleHash,bytes32 descHash,address target,bytes calldata)', kind: 'write' },
      { name: 'vote', sel: 'e2f3a4b5', sig: 'vote(bytes32 proposalID,uint8 voteDirection,uint256 credits)', kind: 'write' },
      { name: 'getProposal', sel: 'f3a4b5c6', sig: 'getProposal(bytes32)', kind: 'read', args: ['proposalID'] },
      { name: 'getVote', sel: 'a4b5c6d7', sig: 'getVote(bytes32)', kind: 'read', args: ['proposalID'] },
      { name: 'getCredits', sel: 'b5c6d7e8', sig: 'getCredits()', kind: 'read' },
      { name: 'finalize', sel: 'c6d7e8f9', sig: 'finalize()', kind: 'write' },
      { name: 'createMarket', sel: 'd7e8f9a0', sig: 'createMarket()', kind: 'write' },
      { name: 'tradeMarket', sel: 'e8f9a0b1', sig: 'tradeMarket()', kind: 'write' },
    ],
  },
  '0x1E': {
    name: 'StateRent',
    file: 'evm/state_rent.go',
    methods: [
      { name: 'pay', sel: 'e1f2a3b4', sig: 'pay()', kind: 'write' },
      { name: 'getStatus', sel: 'f2a3b4c5', sig: 'getStatus()', kind: 'read' },
      { name: 'getDue', sel: 'a3b4c5d6', sig: 'getDue()', kind: 'read' },
    ],
  },
  '0x1F': {
    name: 'CrossChainAttestation',
    file: 'evm/cross_chain_attestation.go',
    methods: [
      { name: 'witnessEvent', sel: 'c1a2b3d4', sig: 'witnessEvent(bytes32,uint256,bytes32,bytes32,bytes)', kind: 'write' },
      { name: 'getAttestation', sel: 'd2b3c4e5', sig: 'getAttestation(bytes32,uint256,bytes32)', kind: 'read' },
      { name: 'challengeAttestation', sel: 'e3c4d5f6', sig: 'challengeAttestation(bytes32,uint256,bytes32)', kind: 'write' },
      { name: 'getAttestationCount', sel: 'f4d5e6a7', sig: 'getAttestationCount(bytes32,uint256,bytes32)', kind: 'read' },
    ],
  },
  '0x20': {
    name: 'MRTRegistry',
    file: 'evm/mineral_rights.go',
    methods: [
      { name: 'registerClaim', sel: 'a1b2c3d4', sig: 'registerClaim(bytes32,bytes32,uint256)', kind: 'write' },
      { name: 'verifyClaim', sel: 'b2c3d4e5', sig: 'verifyClaim(bytes32,bytes32,uint8)', kind: 'write' },
      { name: 'approveReserve', sel: 'c3d4e5a6', sig: 'approveReserve(bytes32,bytes32,uint256)', kind: 'write' },
      { name: 'issueTokens', sel: 'd4e5a6b7', sig: 'issueTokens(bytes32)', kind: 'write' },
      { name: 'getClaim', sel: 'e5a6b7c8', sig: 'getClaim(bytes32)', kind: 'read' },
      { name: 'getTokens', sel: 'f6b7c8d9', sig: 'getTokens(bytes32,address)', kind: 'read' },
      { name: 'environmentalCheck', sel: 'a7b8c9d0', sig: 'environmentalCheck(bytes32,uint256)', kind: 'write' },
      { name: 'transferRights', sel: 'b8c9d0e1', sig: 'transferRights(bytes32,address)', kind: 'write' },
    ],
  },
  '0x21': {
    name: 'Keccak256', // app-layer hashing bridge (as originally intended, #65)
    file: 'evm/keccak_precompile.go',
    methods: [
      { name: 'hash', sel: '1901a39a', sig: 'hash(bytes)', kind: 'read', args: ['data'] },
      { name: 'hash4', sel: '6963203c', sig: 'hash4(bytes)', kind: 'read', args: ['data'] },
    ],  },
  '0x22': {
    name: 'WayStablecoin',
    file: 'evm/way_stablecoin.go',
    methods: [
      { name: 'createVault', sel: 'a2b1c3d4', sig: 'createVault(bytes32)', kind: 'write' },
      // TRUSTLESS ABI (2026-07-18): depositBTC(bytes32 vaultID, uint256 amount, bytes32 txid, uint64 outIndex, bytes toAddr)
      // Requires a sha256 proof that real BTC landed at the vault's derived address. UI supplies the proof.
      { name: 'depositBTC', sel: 'b3c2d4e5', sig: 'depositBTC(bytes32,uint256,bytes32,uint64,bytes)', kind: 'write' },
      { name: 'mint1Way', sel: 'c4d3e5f6', sig: 'mint1Way(bytes32,uint256)', kind: 'write' },
      { name: 'burn1Way', sel: 'd5e4f6a7', sig: 'burn1Way(bytes32,uint256)', kind: 'write' },
      { name: 'getUserVault', sel: 'a8b7c9d0', sig: 'getUserVault()', kind: 'read' },
      // getVault(bytes32) -> (btc[32], debt[32], creatorPresent[32]) — drives the lock light
      { name: 'getVault', sel: '9eb29ef0', sig: 'getVault(bytes32)', kind: 'read' },
      { name: 'getPrice', sel: 'b9c8d0e1', sig: 'getPrice()', kind: 'read' },
      { name: 'getTotalSupply', sel: 'cad9e0f2', sig: 'getTotalSupply()', kind: 'read' },
      { name: 'updateBTCPrice', sel: 'dbc0f1a2', sig: 'updateBTCPrice()', kind: 'write' },
    ],
  },
  '0x23': {
    name: 'TaskRegistry',
    file: 'evm/task_registry.go',
    methods: [
      { name: 'taskClaim', sel: 'a1b2c3d4', sig: 'taskClaim(bytes32)', kind: 'write' },
      { name: 'taskVerify', sel: 'b2c3d4e5', sig: 'taskVerify(bytes32,address)', kind: 'write' },
      { name: 'taskStatus', sel: 'c3d4e5f6', sig: 'taskStatus(bytes32)', kind: 'read' },
      { name: 'taskStatusOf', sel: 'b5c0a0cf', sig: 'taskStatusOf(bytes32,address)', kind: 'read' },
      { name: 'getTaskReward', sel: 'e32481a4', sig: 'getTaskReward(bytes32)', kind: 'read' },
      { name: 'questPoolRemaining', sel: 'df95446f', sig: 'questPoolRemaining()', kind: 'read' },
      { name: 'questFund', sel: 'cea1b2c3', sig: 'questFund(uint256)', kind: 'write' },
      { name: 'taskAutoVerify', sel: '04a78446', sig: 'taskAutoVerify(bytes32,address,bytes)', kind: 'write' },
      { name: 'questSetAutopilot', sel: '7680323f', sig: 'questSetAutopilot(address)', kind: 'write' },
      { name: 'questGetAutopilot', sel: '79b592db', sig: 'questGetAutopilot()', kind: 'read' },
    ],
  },
  '0x24': {
    name: 'SWAYToken',
    file: 'evm/sway_token.go',
    methods: [
      { name: 'mint', sel: 'a1b2c3e4', sig: 'mint(address,uint256)', kind: 'write' },
      { name: 'burn', sel: 'b2c3d4f5', sig: 'burn(address,uint256)', kind: 'write' },
      { name: 'getBalance', sel: 'c3d4e5a6', sig: 'getBalance(address)', kind: 'read' },
      { name: 'getTotalSupply', sel: 'd4e5a6b7', sig: 'getTotalSupply()', kind: 'read' },
      { name: 'swapFee', sel: 'e5a6b7c8', sig: 'swapFee(address)', kind: 'read' },
      { name: 'mintToCaller', sel: 'f6a7b8c9', sig: 'mintToCaller(uint256)', kind: 'write' },
    ],
  },
  '0x25': {
    name: 'SwapRoute',
    file: 'evm/swap_route.go',
    methods: [
      { name: 'createPair', sel: '1a2b3c4d', sig: 'createPair()', kind: 'write' },
      { name: 'swapExactTokens0', sel: '2e878dc0', sig: 'swapExactTokens0(...)', kind: 'write' },
      { name: 'swapExactTokens1', sel: '38ed1739', sig: 'swapExactTokens1(...)', kind: 'write' },
      { name: 'addLiquidity', sel: 'e868b10b', sig: 'addLiquidity(...)', kind: 'write' },
      { name: 'removeLiquidity', sel: 'baa2abde', sig: 'removeLiquidity(...)', kind: 'write' },
      { name: 'getPair', sel: 'e6a537a4', sig: 'getPair()', kind: 'read' },
      { name: 'getReserves', sel: '23312f44', sig: 'getReserves()', kind: 'read' },
      { name: 'mintSwayReward', sel: 'f6a7b8c9', sig: 'mintSwayReward()', kind: 'write' },
    ],
  },
  '0x26': {
    name: 'TemplateRegistry',
    file: 'evm/template_registry.go',
    methods: [
      { name: 'registerTemplate', sel: '7cbd749e', sig: 'registerTemplate(bytes32,uint8)', kind: 'write' },
      { name: 'deployFromTemplate', sel: '1de26edf', sig: 'deployFromTemplate(bytes32,bytes)', kind: 'write' },
      { name: 'getTemplate', sel: '8ecfe43a', sig: 'getTemplate(bytes32)', kind: 'read' },
      { name: 'getUserTemplates', sel: 'e47e9f21', sig: 'getUserTemplates(address)', kind: 'read' },
      { name: 'isRegistrar', sel: '47b4d00d', sig: 'isRegistrar(address)', kind: 'read' },
    ],
  },
};

// Convenience: flat list of {addr, name, file, methods}
export const PRECOMPILE_LIST = Object.entries(PRECOMPILES).map(([addr, v]) => ({
  addr,
  address: precompileAddress(addr),
  ...v,
}));

// Encode a precompile call.
//  - Selector precompiles (most): data = selector(4 bytes) + argsHex.
//  - No-selector precompiles (0x0C-0x12, 0x17): data = argsHex directly (no 4-byte selector).
//    (the Go function reads a fixed raw input layout, no selectorBytes dispatch).
// Returns the `data` payload for eth_call / sendRawTransaction.
export const encodeCall = (addr1, methodName, argsHex = '') => {
  const pc = PRECOMPILES[addr1];
  if (!pc) throw new Error(`Unknown precompile ${addr1}`);
  const m = pc.methods.find((x) => x.name === methodName);
  if (!m) throw new Error(`Unknown method ${methodName} on ${pc.name}`);
  if (pc.noSelector || !m.sel) return '0x' + argsHex.replace(/^0x/, '');
  return '0x' + m.sel + argsHex.replace(/^0x/, '');
};

export default PRECOMPILES;
