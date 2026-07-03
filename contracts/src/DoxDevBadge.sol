// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DoxDevBadge
 * @notice Non-transferable soulbound badge for WayChain.
 *         Unlike the original DVB contract (which had an admin owner),
 *         this contract is governance-controlled via WayChain's
 *         Governance 2.0 system.
 *
 *         Three badge levels:
 *         - Level 1: Verification exists
 *         - Level 2: Professional (required for validators)
 *         - Level 3: Enterprise (required for governance proposals)
 *
 *         Badge revocation triggers slashing per WayChain tokenomics spec
 *         (10% of staked WAY, 50% burned, 50% to treasury).
 *
 *         No owner. Governance controls badge issuance via
 *         designated curators elected through Governance 2.0.
 */
contract DoxDevBadge {
    event BadgeIssued(address indexed developer, uint256 indexed tokenId, uint8 level, uint256 expiresAt);
    event BadgeRevoked(address indexed developer, uint256 indexed tokenId, string reason);
    event BadgeUpgraded(address indexed developer, uint256 indexed tokenId, uint8 newLevel);
    event CuratorAdded(address indexed curator);
    event CuratorRemoved(address indexed curator);

    error NonTransferrable();
    error AlreadyVerified();
    error NotVerified();
    error InvalidLevel();
    error NotCurator();
    error BadgeExpired();

    uint256 public totalBadges;

    struct Badge {
        uint8 level;        // 1, 2, or 3
        uint256 issuedAt;
        uint256 expiresAt;  // 0 = never expires
        bool revoked;
        string revocationReason;
    }

    mapping(address => Badge) public badges;
    mapping(address => bool) public curators;
    mapping(uint256 => address) public badgeOwnerOf;

    uint256 public curatorCount;
    uint256 public constant MIN_CURATORS = 3;

    modifier onlyCurator() {
        if (!curators[msg.sender]) revert NotCurator();
        _;
    }

    /**
     * @notice Constructor sets initial curators (governance-controlled at genesis)
     * @param initialCurators Array of initial curator addresses
     */
    constructor(address[] memory initialCurators) {
        require(initialCurators.length >= MIN_CURATORS, "Need at least 3 curators");
        for (uint256 i = 0; i < initialCurators.length; i++) {
            require(initialCurators[i] != address(0), "Invalid curator");
            curators[initialCurators[i]] = true;
            emit CuratorAdded(initialCurators[i]);
        }
        curatorCount = initialCurators.length;
    }

    /**
     * @notice Issue a badge to a developer
     * @param developer Address to receive the badge
     * @param level Badge level (1-3)
     * @param validityPeriod Seconds until expiry (0 = never expires)
     */
    function issueBadge(address developer, uint8 level, uint256 validityPeriod) external onlyCurator {
        require(developer != address(0), "Invalid address");
        require(level >= 1 && level <= 3, "Invalid level");
        require(badges[developer].issuedAt == 0 || badges[developer].revoked, "Already verified or pending");

        uint256 tokenId = ++totalBadges;
        uint256 expiresAt = validityPeriod > 0 ? block.timestamp + validityPeriod : 0;

        badges[developer] = Badge({
            level: level,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            revocationReason: ""
        });
        badgeOwnerOf[tokenId] = developer;

        emit BadgeIssued(developer, tokenId, level, expiresAt);
    }

    /**
     * @notice Revoke a developer's badge
     * @param developer Address whose badge to revoke
     * @param reason Reason for revocation
     */
    function revokeBadge(address developer, string calldata reason) external onlyCurator {
        Badge storage badge = badges[developer];
        if (badge.issuedAt == 0) revert NotVerified();
        if (badge.revoked) revert AlreadyVerified();

        badge.revoked = true;
        badge.revocationReason = reason;

        emit BadgeRevoked(developer, totalBadges, reason);
    }

    /**
     * @notice Upgrade a badge to a higher level
     * @param developer Address to upgrade
     * @param newLevel New badge level (must be higher than current)
     */
    function upgradeBadge(address developer, uint8 newLevel) external onlyCurator {
        Badge storage badge = badges[developer];
        if (badge.issuedAt == 0) revert NotVerified();
        if (badge.revoked) revert BadgeExpired();
        require(newLevel > badge.level, "Must upgrade to higher level");
        require(newLevel >= 1 && newLevel <= 3, InvalidLevel());

        badge.level = newLevel;

        emit BadgeUpgraded(developer, totalBadges, newLevel);
    }

    /**
     * @notice Add a curator (governance-controlled)
     */
    function addCurator(address curator) external onlyCurator {
        require(!curators[curator], "Already a curator");
        curators[curator] = true;
        curatorCount++;
        emit CuratorAdded(curator);
    }

    /**
     * @notice Remove a curator (governance-controlled)
     */
    function removeCurator(address curator) external onlyCurator {
        require(curators[curator], "Not a curator");
        require(curatorCount > MIN_CURATORS, "Minimum curators reached");
        curators[curator] = false;
        curatorCount--;
        emit CuratorRemoved(curator);
    }

    /// @notice Check if an address has a valid (non-revoked, non-expired) badge
    function isVerified(address developer) external view returns (bool) {
        Badge storage badge = badges[developer];
        if (badge.issuedAt == 0) return false;
        if (badge.revoked) return false;
        if (badge.expiresAt > 0 && block.timestamp > badge.expiresAt) return false;
        return true;
    }

    /// @notice Get the verification level of an address
    function getLevel(address developer) public view returns (uint8) {
        Badge storage badge = badges[developer];
        if (badge.issuedAt == 0) return 0;
        if (badge.revoked) return 0;
        if (badge.expiresAt > 0 && block.timestamp > badge.expiresAt) return 0;
        return badge.level;
    }

    /// @notice Check if an address meets a minimum level requirement
    function hasMinLevel(address developer, uint8 minLevel) external view returns (bool) {
        return getLevel(developer) >= minLevel;
    }
}