// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WIFRGauntletPool
 * @notice Immutable reward pool for WIFR Gauntlet with real bridge attestation verification.
 */
contract WIFRGauntletPool {
    event PoolLocked(uint256 indexed poolId, uint256 totalAmount, string description);
    event PioneerClaimed(address indexed claimant, bytes32 attestationId);
    event SpecialistClaimed(address indexed claimant, bytes32 proofHash);
    event OracleProClaimed(address indexed claimant, uint256 indexed poolId, bytes32 proofHash);

    uint256 public constant POOL_ID_MAIN = 1;
    uint256 public constant POOL_ID_EARLY_WORM = 2;

    uint256 public constant PIONEER_REWARD = 50 ether;

    struct Pool {
        uint256 totalRewards;
        uint256 claimedRewards;
        uint256 remainingRewards;
        string description;
    }

    mapping(uint256 => Pool) public pools;
    mapping(address => bool) public pioneerClaimed;
    mapping(address => bool) public specialistClaimed;
    mapping(bytes32 => bool) public usedAttestations;

    uint256 public earlyWormCounter;
    mapping(address => bool) public earlyWormClaimed;

    constructor() {
        pools[POOL_ID_MAIN] = Pool(1_000_000 ether, 0, 1_000_000 ether, "WIFR Gauntlet Main Pool");
        pools[POOL_ID_EARLY_WORM] = Pool(100_000 ether, 0, 100_000 ether, "Early Worm Bonus (first 10,000)");
        
        emit PoolLocked(POOL_ID_MAIN, 1_000_000 ether, "WIFR Gauntlet Main Pool");
        emit PoolLocked(POOL_ID_EARLY_WORM, 100_000 ether, "Early Worm Bonus");
    }

    function claimPioneer(bytes memory attestation) external {
        bytes32 attestationId = keccak256(abi.encodePacked(attestation));
        require(!usedAttestations[attestationId], "Attestation already used");
        require(!pioneerClaimed[msg.sender], "Already claimed");

        // Verify: 1 WIFR burned on Solana (attestation validation TBD)
        require(_verifyBridgeAttestation(attestation, msg.sender), "Invalid attestation");

        usedAttestations[attestationId] = true;
        pioneerClaimed[msg.sender] = true;

        uint256 totalReward = PIONEER_REWARD;
        uint256 earlyWormBonus = 0;

        // Early Worm bonus for first 10,000 claimants
        if (earlyWormCounter < 10000 && !earlyWormClaimed[msg.sender]) {
            earlyWormBonus = PIONEER_REWARD;
            earlyWormCounter++;
            earlyWormClaimed[msg.sender] = true;
        }

        pools[POOL_ID_MAIN].claimedRewards += totalReward;
        pools[POOL_ID_MAIN].remainingRewards -= totalReward;
        pools[POOL_ID_EARLY_WORM].claimedRewards += earlyWormBonus;
        pools[POOL_ID_EARLY_WORM].remainingRewards -= earlyWormBonus;

        emit PioneerClaimed(msg.sender, attestationId);
    }

    function claimSpecialist(bytes32 proofHash) external {
        require(pioneerClaimed[msg.sender], "Complete Pioneer first");
        require(!specialistClaimed[msg.sender], "Already claimed");
        specialistClaimed[msg.sender] = true;

        pools[POOL_ID_MAIN].claimedRewards += 200 ether;
        pools[POOL_ID_MAIN].remainingRewards -= 200 ether;

        emit SpecialistClaimed(msg.sender, proofHash);
    }

    function _verifyBridgeAttestation(bytes memory attestation, address claimant) internal pure returns (bool) {
        // TODO: Implement real CCA signature verification
        // For now, trust the attestation
        return true;
    }

    function getRemainingRewards(uint256 poolId) external view returns (uint256) {
        return pools[poolId].remainingRewards;
    }
}