// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WIFRCertificationBadge
 * @notice Soulbound NFT that represents WIFR Gauntlet completion.
 *         Rank 0 (Creator) → Rank 1 (Pioneer) → Rank 2 (Specialist) → Rank 3 (Oracle Professional).
 *         Creator badge is unique, non-transferable, auctionable upon retirement.
 *         No godMode - pure bragging rights for deploying critical contracts.
 */
contract WIFRCertificationBadge {
    event BadgeMinted(address indexed owner, uint256 indexed tokenId, uint8 rank, bytes proofHash);
    event BadgeUpgraded(address indexed owner, uint256 indexed tokenId, uint8 newRank, bytes proofHash);
    event GrandmasterQualified(address indexed owner, uint256 indexed rank, uint256 prize);
    event CreatorRetired(address indexed creator, uint256 retiredAt);

    uint256 private _nextTokenId = 1;
    address public creator;
    bool public creatorRetired = false;
    
    uint256 public constant RANK_0_CREATOR = 0;
    uint256 public constant RANK_1_PIONEER = 1;
    uint256 public constant RANK_2_SPECIALIST = 2;
    uint256 public constant RANK_3_ORACLE_PRO = 3;

    address[20] public grandmasters;
    uint256 public grandmasterCount;

    mapping(address => uint256) public addressToTokenId;
    mapping(uint256 => address) public tokenIdToOwner;
    mapping(uint256 => uint8) public tokenIdToRank;
    mapping(uint256 => bytes) public tokenIdToProofs;

    constructor() {
        creator = msg.sender;
    }

    // ===================== Badge Management =====================

    function mintCreator() external returns (uint256) {
        require(msg.sender == creator, "Only creator can call");
        require(!creatorRetired, "Creator badge already retired");
        
        uint256 tokenId = _nextTokenId++;
        addressToTokenId[msg.sender] = tokenId;
        tokenIdToOwner[tokenId] = msg.sender;
        tokenIdToRank[tokenId] = uint8(RANK_0_CREATOR);
        
        emit BadgeMinted(msg.sender, tokenId, uint8(RANK_0_CREATOR), "");
        return tokenId;
    }

    function retireCreator() external {
        require(msg.sender == creator, "Only creator can call");
        creatorRetired = true;
        emit CreatorRetired(creator, block.timestamp);
    }

    function mintPioneer(address to, bytes memory proofHash) external returns (uint256) {
        require(to != address(0), "Invalid address");
        require(addressToTokenId[to] == 0, "Already has badge");

        uint256 tokenId = _nextTokenId++;
        addressToTokenId[to] = tokenId;
        tokenIdToOwner[tokenId] = to;
        tokenIdToRank[tokenId] = uint8(RANK_1_PIONEER);
        tokenIdToProofs[tokenId] = proofHash;

        emit BadgeMinted(to, tokenId, uint8(RANK_1_PIONEER), proofHash);
        return tokenId;
    }

    function upgradeToSpecialist(uint256 tokenId, bytes memory proofHash) external returns (uint256) {
        require(tokenIdToRank[tokenId] == uint8(RANK_1_PIONEER), "Not Pioneer");

        tokenIdToRank[tokenId] = uint8(RANK_2_SPECIALIST);
        tokenIdToProofs[tokenId] = proofHash;

        emit BadgeUpgraded(tokenIdToOwner[tokenId], tokenId, uint8(RANK_2_SPECIALIST), proofHash);
        return tokenId;
    }

    function upgradeToOraclePro(uint256 tokenId, bytes memory proofHash) external returns (uint256) {
        require(tokenIdToRank[tokenId] == uint8(RANK_2_SPECIALIST), "Not Specialist");
        require(grandmasterCount < 20, "Grandmaster slots full");

        grandmasterCount++;
        grandmasters[grandmasterCount - 1] = tokenIdToOwner[tokenId];

        tokenIdToRank[tokenId] = uint8(RANK_3_ORACLE_PRO);
        tokenIdToProofs[tokenId] = proofHash;

        uint256 prize = 5000 * 1e18;
        emit GrandmasterQualified(tokenIdToOwner[tokenId], grandmasterCount, prize);
        return tokenId;
    }

    // ===================== Queries =====================

    function getRank(address user) external view returns (uint8) {
        uint256 tokenId = addressToTokenId[user];
        if (tokenId == 0) return 0;
        return tokenIdToRank[tokenId];
    }

    function isCreator(address user) external view returns (bool) {
        return creator == user;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        uint8 rank = tokenIdToRank[tokenId];
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(abi.encodePacked(
                "{\"name\":\"WIFR Badge #", _toString(tokenId),
                "\",\"description\":\"WIFR Certification Gauntlet - Creator Rank\",\"attributes\":[{\"trait_type\":\"Rank\",\"value\":\"",
                _rankToString(rank), "\"},{\"trait_type\":\"Unique\",\"value\":\"true\"},{\"trait_type\":\"Auctionable\",\"value\":\"upon retirement\"}]}"
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
        if (rank == 1) return "Pioneer";
        if (rank == 2) return "Specialist";
        if (rank == 3) return "Oracle Professional";
        return "None";
    }
}

library Base64 {
    function encode(bytes memory) internal pure returns (string memory) {
        // Base64 encoding stub - metadata rendered on-chain
        return "";
    }
}