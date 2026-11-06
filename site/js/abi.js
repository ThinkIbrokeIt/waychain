// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimal ABI arg encoder for WayChain precompile calls (issue #12.2).
// The registry's encodeCall appends raw argsHex, so callers must pre-encode
// args. These helpers produce the 32-byte-left-padded Solidity encodings the
// precompiles expect (address, uint256). EVM word = 32 bytes.
(function (global) {
  'use strict';

  function pad32(hex) {
    const h = hex.replace(/^0x/, '');
    return h.padStart(64, '0');
  }

  // Encode an address arg (20-byte) as a 32-byte left-padded word.
  function encodeAddress(addr) {
    const a = addr.replace(/^0x/, '').toLowerCase().padStart(40, '0');
    return pad32(a);
  }

  // Encode a uint256 arg as a 32-byte big-endian word.
  function encodeUint256(value) {
    let v;
    try { v = BigInt(value); } catch { v = 0n; }
    let hex = (v < 0n ? (1n << 256n) + v : v).toString(16);
    return pad32(hex);
  }

  // Concatenate already-encoded 32-byte words.
  function concat(...words) {
    return '0x' + words.map((w) => w.replace(/^0x/, '')).join('');
  }

  // Encode a single byte (uint8) as a 1-byte value (for Governance voteType / voteDirection).
  function byte1(n) {
    let v;
    try { v = Number(n); } catch { v = 0; }
    return (v & 0xff).toString(16).padStart(2, '0');
  }

  // Encode an address as a RAW 20-byte value (no 32-byte left-padding).
  // Some WayChain precompiles read addresses as 20 raw bytes (e.g. TaskRegistry
  // taskVerify claimant, Governance createProposal target: input[offset:offset+20]),
  // NOT as Solidity 32-byte words. Use this for those fields.
  function rawAddress20(addr) {
    return addr.replace(/^0x/, '').toLowerCase().padStart(40, '0').slice(0, 40);
  }

  // Governance createProposal layout (from evm/governance.go govCreateProposal):
  //   selector(4) + voteType(1) + titleHash(32) + descHash(32) + target(20 RAW) + calldataLen(32) + calldata
  function govCreateProposalArgs({ voteType, titleHash, descHash, target, calldata = '' }) {
    const title = pad32(titleHash || '0');
    const desc = pad32(descHash || '0');
    const tgt = rawAddress20(target || '0x0000000000000000000000000000000000000000');
    const cd = calldata.replace(/^0x/, '');
    const cdLen = pad32(cd.length / 2);
    return '0x' + byte1(voteType || 0) + title + desc + tgt + cdLen + cd;
  }

  // Governance vote layout (evm/governance.go govVote):
  //   selector(4) + proposalID(32) + voteDirection(1) + credits(32)
  function govVoteArgs({ proposalID, voteDirection, credits = 0 }) {
    const pid = pad32(proposalID || '0');
    const dir = byte1(voteDirection || 0);
    const cr = encodeUint256(credits);
    return '0x' + pid + dir + cr;
  }

  global.WayChainABI = { encodeAddress, encodeUint256, pad32, concat, byte1, rawAddress20, govCreateProposalArgs, govVoteArgs };
})(window);
