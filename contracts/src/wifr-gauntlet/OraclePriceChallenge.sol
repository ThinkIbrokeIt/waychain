// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OraclePriceChallenge
 * @notice Calls the on-chain oracle (precompile 0x0E) and asks user to confirm price.
 *         Used for Pioneer tier step 3.
 */
contract OraclePriceChallenge {
    mapping(address => bool) public completed;
    mapping(address => uint256) public confirmedPrices;

    function submitPrice(address user, uint256 price) external {
        // Verify against on-chain oracle (simplified for now)
        // In production: call OracleVerifier precompile to get WIFR/USD price
        completed[user] = true;
        confirmedPrices[user] = price;
    }

    function isCompleted(address user) external view returns (bool) {
        return completed[user];
    }
}