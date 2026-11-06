// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Attestation
 * @notice Permissionless hash anchor. No owner. No admin. Immutable.
 *         Anyone can anchor a SHA-256 hash of truth permanently.
 *         Cost: ~$0.001 in WAY (fiat-pegged gas fee).
 *
 *         The raw content never goes on-chain. Only the hash.
 *         The content stays encrypted in the user's vault.
 *
 *         Deployed via WayChain template registry as Class A (safe).
 *         No Dox_Dev badge required to deploy or use.
 */
contract Attestation {
    event TruthAnchored(bytes32 indexed hash, uint256 indexed timestamp, address indexed attestant);

    /// @notice Total attestations ever made through this contract
    uint256 public totalAttestations;

    /// @notice Check if a specific hash has been attested
    mapping(bytes32 => bool) public isAttested;

    /// @notice Get attestation details by hash
    mapping(bytes32 => AttestationData) public attestations;

    struct AttestationData {
        address attestant;
        uint256 timestamp;
        uint256 blockNumber;
    }

    /**
     * @notice Anchor a hash permanently on WayChain
     * @param hash SHA-256 hash of the encrypted truth record
     */
    function attest(bytes32 hash) external {
        require(hash != bytes32(0), "Empty hash");
        require(!isAttested[hash], "Already attested");

        isAttested[hash] = true;
        attestations[hash] = AttestationData({
            attestant: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        });
        totalAttestations++;

        emit TruthAnchored(hash, block.timestamp, msg.sender);
    }

    /**
     * @notice Verify that a hash was attested at a specific time
     * @param hash The hash to verify
     * @return attested Whether the hash exists
     * @return attestant Who attested it
     * @return timestamp When it was attested
     */
    function verify(bytes32 hash) external view returns (bool attested, address attestant, uint256 timestamp) {
        AttestationData memory data = attestations[hash];
        return (data.timestamp > 0, data.attestant, data.timestamp);
    }
}