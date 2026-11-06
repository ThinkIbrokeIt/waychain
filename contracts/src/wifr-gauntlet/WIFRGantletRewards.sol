// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WIFRGantletRewards
 * @notice Reward distribution for WIFR Certification Gauntlet.
 *         Early Worm bonus limited to first 10,000 claimants.
 */
contract WIFRGantletRewards {
    event PoolLocked(uint256 indexed poolId, uint256 totalAmount, string description);
    event PioneerClaimed(address indexed claimant, bytes proofHash);
    event SpecialistClaimed(address indexed claimant, bytes proofHash);
    event OracleProClaimed(address indexed claimant, uint256 indexed rank, bytes proofHash);
    event GrandmasterQualified(address indexed claimant, uint256 indexed rank, uint256 prize);

    uint256 public constant POOL_ID_MAIN = 1;
    uint256 public constant POOL_ID_EARLY_WORM = 2;
    uint256 public constant POOL_ID_GRANDMASTER = 3;

    uint256 public constant PIONEER_REWARD = 50 ether;
    uint256 public constant SPECIALIST_REWARD = 200 ether;
    uint256 public constant GRANDMASTER_ORACLE_PRO_REWARD = 5000 ether;
    uint256 public constant STANDARD_ORACLE_PRO_REWARD = 1000 ether;

    struct Pool {
        uint256 totalRewards;
        uint256 claimedRewards;
        uint256 remainingRewards;
        string description;
    }

    mapping(uint256 => Pool) public pools;
    mapping(address => bool) public pioneerClaimed;
    mapping(address => bool) public specialistClaimed;
    mapping(address => uint256) public oracleProRank;

    uint256 public earlyWormClaimCount; // Counter for first 10,000 Early Worm bonuses
    mapping(address => bool) public earlyWormClaimed;

    uint256 public grandmasterCount;
    address[20] public grandmasters;

    constructor() {
        pools[POOL_ID_MAIN] = Pool(1_000_000 ether, 0, 1_000_000 ether, "WIFR Gauntlet Main Pool");
        pools[POOL_ID_EARLY_WORM] = Pool(100_000 ether, 0, 100_000 ether, "Early Worm Bonus Pool (first 10,000)");
        pools[POOL_ID_GRANDMASTER] = Pool(100_000 ether, 0, 100_000 ether, "Grandmaster Prize Pool (first 20 Oracle Pros)");
        
        emit PoolLocked(POOL_ID_MAIN, 1_000_000 ether, "WIFR Gauntlet Main Pool");
        emit PoolLocked(POOL_ID_EARLY_WORM, 100_000 ether, "Early Worm Bonus Pool");
        emit PoolLocked(POOL_ID_GRANDMASTER, 100_000 ether, "Grandmaster Prize Pool");
    }

    function claimPioneer(bytes memory proofHash) external {
        require(!pioneerClaimed[msg.sender], "Pioneer already claimed");
        pioneerClaimed[msg.sender] = true;

        uint256 baseReward = PIONEER_REWARD;
        uint256 earlyWormBonus = 0;

        // Early Worm: 2x bonus for first 10,000 claimants ONLY
        if (earlyWormClaimCount < 10000 && !earlyWormClaimed[msg.sender]) {
            earlyWormBonus = PIONEER_REWARD; // 2x total = 100 WAY (50 + 50)
            earlyWormClaimCount++;
            earlyWormClaimed[msg.sender] = true;
        }

        pools[POOL_ID_MAIN].claimedRewards += baseReward;
        pools[POOL_ID_MAIN].remainingRewards -= baseReward;
        pools[POOL_ID_EARLY_WORM].claimedRewards += earlyWormBonus;
        pools[POOL_ID_EARLY_WORM].remainingRewards -= earlyWormBonus;
        emit PioneerClaimed(msg.sender, proofHash);
    }

    function claimSpecialist(bytes memory proofHash) external {
        require(pioneerClaimed[msg.sender], "Complete Pioneer first");
        require(!specialistClaimed[msg.sender], "Specialist already claimed");

        specialistClaimed[msg.sender] = true;

        pools[POOL_ID_MAIN].claimedRewards += SPECIALIST_REWARD;
        pools[POOL_ID_MAIN].remainingRewards -= SPECIALIST_REWARD;

        emit SpecialistClaimed(msg.sender, proofHash);
    }

    function claimOracleProfessional(bytes memory proofHash) external {
        require(specialistClaimed[msg.sender], "Complete Specialist first");
        require(oracleProRank[msg.sender] == 0, "Oracle Pro already claimed");

        if (grandmasterCount < 20) {
            grandmasterCount++;
            grandmasters[grandmasterCount - 1] = msg.sender;
            oracleProRank[msg.sender] = grandmasterCount;

            pools[POOL_ID_GRANDMASTER].claimedRewards += GRANDMASTER_ORACLE_PRO_REWARD;
            pools[POOL_ID_GRANDMASTER].remainingRewards -= GRANDMASTER_ORACLE_PRO_REWARD;
            pools[POOL_ID_MAIN].claimedRewards += STANDARD_ORACLE_PRO_REWARD;
            pools[POOL_ID_MAIN].remainingRewards -= STANDARD_ORACLE_PRO_REWARD;

            emit GrandmasterQualified(msg.sender, grandmasterCount, GRANDMASTER_ORACLE_PRO_REWARD);
        } else {
            pools[POOL_ID_MAIN].claimedRewards += STANDARD_ORACLE_PRO_REWARD;
            pools[POOL_ID_MAIN].remainingRewards -= STANDARD_ORACLE_PRO_REWARD;
        }

        emit OracleProClaimed(msg.sender, oracleProRank[msg.sender], proofHash);
    }

    function getRemainingRewards(uint256 poolId) external view returns (uint256) {
        return pools[poolId].remainingRewards;
    }

    function getGrandmasterCount() external view returns (uint256) {
        return grandmasterCount;
    }

    function getGrandmaster(uint256 rank) external view returns (address) {
        require(rank > 0 && rank <= grandmasterCount, "Rank not reached");
        return grandmasters[rank - 1];
    }
}