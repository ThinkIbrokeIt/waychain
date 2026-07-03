// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./WayChainPair.sol";

/**
 * @title WayChainFactory
 * @notice Creates and tracks AMM liquidity pairs on WayChain.
 *         Dox_Dev Level 2+ required to create a pair.
 *         Price oracle integrated for fair pricing.
 */
contract WayChainFactory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    address public immutable priceOracle;
    address public immutable doxDevBadge;
    uint256 public allPairsLength;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    constructor(address _priceOracle, address _doxDevBadge) {
        require(_priceOracle != address(0), "Invalid oracle");
        require(_doxDevBadge != address(0), "Invalid Dox_Dev");
        priceOracle = _priceOracle;
        doxDevBadge = _doxDevBadge;
    }

    /**
     * @notice Create a new liquidity pair.
     *         Requires Dox_Dev Level 2+ (enforced by the protocol at deploy time).
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return pair Address of the created pair
     */
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "Identical addresses");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Zero address");
        require(getPair[token0][token1] == address(0), "Pair exists");

        // Deploy new pair
        bytes memory bytecode = type(WayChainPair).creationCode;
        bytes memory deployData = abi.encodePacked(bytecode, abi.encode(token0, token1, priceOracle));

        assembly {
            pair := create2(0, add(deployData, 32), mload(deployData), token0)
        }
        require(pair != address(0), "Create failed");

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        allPairsLength++;

        emit PairCreated(token0, token1, pair, allPairsLength);
    }

    /**
     * @notice Get all pair addresses
     */
    function getAllPairs() external view returns (address[] memory) {
        return allPairs;
    }
}