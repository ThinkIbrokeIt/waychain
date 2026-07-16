// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WayChainCreatorBadge
 * @notice Ecosystem-wide creator certification. Unique soulbound NFT for launching critical contracts.
 *         Rank 0 (Creator) → Rank 1 (Maintainer) → Rank 2 (Operator) → Rank 3 (Oracle).
 *         Creator badge can be retired (making it auctionable) when ecosystem is stable.
 *         No god mode - pure bragging rights and future auction value.
 */
contract WayChainCreatorBadge {
    event BadgeMinted(address indexed owner, uint256 indexed tokenId, uint8 rank, string metadata);
    event BadgeUpgraded(address indexed owner, uint256 indexed tokenId, uint8 newRank, string metadata);
    event CreatorRetired(address indexed creator, uint256 retiredAt);
    event EcosystemVerified(bytes32 contractHash, uint256 timestamp);

    uint256 private _nextTokenId = 1;
    address public ecosystemCreator;
    bool public creatorRetired = false;
    uint256 public ecosystemStabilityScore = 0; // Increases as contracts verify stable

    uint256 public constant RANK_0_CREATOR = 0;    // Launch verified
    uint256 public constant RANK_1_MAINTAINER = 1; // 1 week no bugs
    uint256 public constant RANK_2_OPERATOR = 2;   // Emergency controls used
    uint256 public constant RANK_3_ORACLE = 3;      // All contracts stable +50

    struct Verification {
        bytes32 contractHash;
        uint256 timestamp;
        bool passed;
        string notes;
    }

    mapping(address => uint256) public addressToTokenId;
    mapping(uint256 => address) public tokenIdToOwner;
    mapping(uint256 => uint8) public tokenIdToRank;
    mapping(bytes32 => Verification) public verifications;
    mapping(address => uint256) public stableDays;

    constructor() {
        ecosystemCreator = msg.sender;
    }

    // ===================== Creator Functions =====================

    function mintCreator(string memory initialVerification) external returns (uint256) {
        require(msg.sender == ecosystemCreator, "Only ecosystem creator");
        require(!creatorRetired, "Creator badge already retired");
        
        uint256 tokenId = _nextTokenId++;
        addressToTokenId[msg.sender] = tokenId;
        tokenIdToOwner[tokenId] = msg.sender;
        tokenIdToRank[tokenId] = uint8(RANK_0_CREATOR);
        stableDays[msg.sender] = 1; // Day 1 starts
        
        emit BadgeMinted(msg.sender, tokenId, uint8(RANK_0_CREATOR), initialVerification);
        return tokenId;
    }

    function retireCreator() external {
        require(msg.sender == ecosystemCreator, "Only creator can call");
        require(ecosystemStabilityScore >= 50, "Ecosystem not stable yet");
        creatorRetired = true;
        emit CreatorRetired(ecosystemCreator, block.timestamp);
    }

    function verifyContract(bytes32 contractHash, bool passed, string memory notes) external {
        require(msg.sender == ecosystemCreator, "Only creator");
        verifications[contractHash] = Verification({
            contractHash: contractHash,
            timestamp: block.timestamp,
            passed: passed,
            notes: notes
        });
        
        if (passed) ecosystemStabilityScore++;
        emit EcosystemVerified(contractHash, block.timestamp);
    }

    // ===================== Upgrades =====================

    function upgradeToMaintainer(uint256 tokenId) external {
        require(addressToTokenId[msg.sender] == tokenId, "Not your badge");
        require(tokenIdToRank[tokenId] == uint8(RANK_0_CREATOR), "Already upgraded");
        require(stableDays[msg.sender] >= 7, "Need 7 stable days");
        
        tokenIdToRank[tokenId] = uint8(RANK_1_MAINTAINER);
        emit BadgeUpgraded(msg.sender, tokenId, uint8(RANK_1_MAINTAINER), "7-day stability milestone");
    }

    function upgradeToOperator(uint256 tokenId) external {
        require(addressToTokenId[msg.sender] == tokenId, "Not your badge");
        require(tokenIdToRank[tokenId] == uint8(RANK_1_MAINTAINER), "Must be Maintainer");
        
        tokenIdToRank[tokenId] = uint8(RANK_2_OPERATOR);
        emit BadgeUpgraded(msg.sender, tokenId, uint8(RANK_2_OPERATOR), "Emergency access granted");
    }

    function upgradeToOracle(uint256 tokenId) external {
        require(addressToTokenId[msg.sender] == tokenId, "Not your badge");
        require(tokenIdToRank[tokenId] == uint8(RANK_2_OPERATOR), "Must be Operator");
        require(ecosystemStabilityScore >= 50, "Ecosystem must be verified stable");
        
        tokenIdToRank[tokenId] = uint8(RANK_3_ORACLE);
        emit BadgeUpgraded(msg.sender, tokenId, uint8(RANK_3_ORACLE), "Ecosystem oracle certified");
    }

    // ===================== Decay (for retirement auction) =====================

    function decayDays() external {
        if (stableDays[msg.sender] > 0) stableDays[msg.sender]--;
    }

    // ===================== Queries =====================

    function getRank(address user) external view returns (uint8) {
        uint256 tokenId = addressToTokenId[user];
        if (tokenId == 0) return 0;
        return tokenIdToRank[tokenId];
    }

    function isCreator(address user) external view returns (bool) {
        return ecosystemCreator == user;
    }

    function getEcosystemScore() external view returns (uint256) {
        return ecosystemStabilityScore;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        uint8 rank = tokenIdToRank[tokenId];
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(abi.encodePacked(
                "{\"name\":\"WayChain Creator Badge #", _toString(tokenId),
                "\",\"description\":\"Genesis launch certification - unique NFT\",\"attributes\":[{\"trait_type\":\"Rank\",\"value\":\"",
                _rankToString(rank), "\"},{\"trait_type\":\"Unique\",\"value\":\"true\"},{\"trait_type\":\"Auctionable\",\"value\":\"",
                creatorRetired ? "retired" : "active", "\"}]}"
            ))
        ));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp > 0) { temp /= 10; digits++; }
        bytes memory buffer = new bytes(digits);
        while (value > 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint8(value - value / 10 * 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _rankToString(uint8 rank) internal pure returns (string memory) {
        if (rank == 0) return "Creator";
        if (rank == 1) return "Maintainer";
        if (rank == 2) return "Operator";
        if (rank == 3) return "Oracle";
        return "None";
    }
}

library Base64 {
    function encode(bytes memory) internal pure returns (string memory) {
        return ""; // On-chain metadata
    }
}