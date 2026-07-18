// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WayChain ProfessionalSBT (Soulbound professional license token)
/// @notice Implements the spec's "Decentralized Identity (DID) — Soulbound
///         Tokens to verify professional licenses on-chain before users can
///         accept high-tier tasks." Minting/revocation is gated by a single
///         trusted LICENSE AUTHORITY — the off-chain oracle that verifies a
///         real-world credential (the Go ProfessionalBadge flow at precompile
///         0x0D already gates Dox_Dev L2+ + profession; this SBT is the
///         app-layer, EVM-readable mirror that high-tier Solidity task
///         contracts can check via hasLicense()).
///
///         SBTs are NON-TRANSFERABLE by design (soulbound).
contract ProfessionalSBT {
    address public authority;

    string public constant name = "WayChain Professional License";
    string public constant symbol = "WCPRO";

    struct License {
        address holder;
        string profession; // "geologist", "lawyer", "surveyor", "engineer", ...
        bytes32 licenseHash; // sha256 of the off-chain credential (core hashing)
        uint64 issuedAt;
    }

    /// @notice holder => token id (nonzero means holds a license)
    mapping(address => uint256) public licensee;
    mapping(uint256 => License) public licenses;
    uint256 public totalSupply;

    event Licensed(uint256 indexed id, address indexed holder, string profession, bytes32 licenseHash);
    event Revoked(address indexed holder, uint256 indexed id);

    error Unauthorized();
    error NotLicensed();
    error Soulbound();

    constructor(address _authority) {
        authority = _authority;
    }

    modifier onlyAuthority() {
        if (msg.sender != authority) revert Unauthorized();
        _;
    }

    /// @notice Authority mints a verified professional license (soulbound).
    function mint(address holder, string calldata profession, bytes32 licenseHash)
        external
        onlyAuthority
        returns (uint256 id)
    {
        id = ++totalSupply;
        licenses[id] = License(holder, profession, licenseHash, uint64(block.timestamp));
        licensee[holder] = id;
        emit Licensed(id, holder, profession, licenseHash);
    }

    /// @notice Authority revokes a license (e.g. credential expired/revoked).
    function revoke(address holder) external onlyAuthority {
        uint256 id = licensee[holder];
        if (id == 0) revert NotLicensed();
        delete licenses[id];
        delete licensee[holder];
        emit Revoked(holder, id);
    }

    /// @notice True if the address holds any professional license.
    function hasLicense(address holder) external view returns (bool) {
        return licensee[holder] != 0;
    }

    /// @notice True if the address holds a license of a specific profession.
    function hasProfession(address holder, string calldata profession) external view returns (bool) {
        uint256 id = licensee[holder];
        if (id == 0) return false;
        return keccak256(bytes(licenses[id].profession)) == keccak256(bytes(profession));
    }

    // ── Soulbound: all transfers/reapprovals are disabled ──
    function transferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function approve(address, uint256) external pure { revert Soulbound(); }
    function setApprovalForAll(address, bool) external pure { revert Soulbound(); }
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }
    function getApproved(uint256) external pure returns (address) { return address(0); }
}
