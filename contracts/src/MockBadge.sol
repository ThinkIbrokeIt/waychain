// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockBadge
 * @notice Mock Dox_Dev badge contract for testing
 */
contract MockBadge {
    mapping(address => uint8) public levels;

    function setBadgeLevel(address account, uint8 level) external {
        levels[account] = level;
    }

    function getLevel(address account) external view returns (uint8) {
        return levels[account];
    }

    function isVerified(address account) external view returns (bool) {
        return levels[account] >= 2;
    }
}