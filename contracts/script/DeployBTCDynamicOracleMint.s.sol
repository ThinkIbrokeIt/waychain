// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BTCDynamicOracleMint.sol";

/**
 * @title DeployBTCDynamicOracleMint
 * @notice Deploys the dynamic oracle selection contract for 1WAY minting
 *
 * Usage: forge script script/DeployBTCDynamicOracleMint.s.sol --rpc-url <rpc> --broadcast
 * Requires DoxDevBadge to be deployed first - pass address as arg
 */
contract DeployBTCDynamicOracleMint is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deploying BTCDynamicOracleMint...");
        console.log("Deployer:", deployer);

        address badge = vm.envOr("DOXDEV_BADGE_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);

        BTCDynamicOracleMint mint = new BTCDynamicOracleMint(badge);

        console.log("BTCDynamicOracleMint deployed at:", address(mint));
        console.log("DoxDevBadge:", badge);
        console.log("");
        console.log("Flow: registerOracle() -> requestMint(satoshis) -> approveMint()/rejectMint()");
        console.log("5 oracles selected randomly, 3 approvals within 100 blocks required");
        console.log("Non-responsive oracles slashed via processNonResponders()");

        vm.stopBroadcast();
    }
}