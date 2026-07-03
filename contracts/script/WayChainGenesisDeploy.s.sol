// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DoxDevBadge} from "../src/DoxDevBadge.sol";
import {TemplateRegistry} from "../src/TemplateRegistry.sol";
import {Attestation} from "../src/Attestation.sol";
import {DeadMansSwitch} from "../src/DeadMansSwitch.sol";
import {TrustlessLock} from "../src/TrustlessLock.sol";
import {BIJO} from "../src/BIJO.sol";
import {StorageEndowment} from "../src/StorageEndowment.sol";

/**
 * @title WayChainGenesisDeploy
 * @notice Deploys all WayChain Phase 0-2 contracts in dependency order.
 *
 * Usage:
 *   forge script script/WayChainGenesisDeploy.s.sol --rpc-url <rpc> --broadcast
 *
 * Deploy order:
 *   1. DoxDevBadge     — Identity layer
 *   2. TemplateRegistry — Contract classification
 *   3. Attestation     — Truth anchor (permissionless)
 *   4. DeadMansSwitch  — Inheritance protocol (Class B template)
 *   5. TrustlessLock   — Liquidity locks (Class A template)
 *   6. BIJO            — Binary Journal token
 *   7. StorageEndowment — Eternal archive fund
 */
contract WayChainGenesisDeploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address governance = vm.envOr("GOVERNANCE_ADDRESS", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // ── 1. DoxDevBadge ──
        address[] memory curators = new address[](3);
        curators[0] = vm.envOr("CURATOR_1", deployer);
        curators[1] = vm.envOr("CURATOR_2", deployer);
        curators[2] = vm.envOr("CURATOR_3", deployer);

        DoxDevBadge badge = new DoxDevBadge(curators);
        console.log("DoxDevBadge deployed at:", address(badge));

        // ── 2. TemplateRegistry ──
        address[] memory registrars = new address[](1);
        registrars[0] = governance;

        TemplateRegistry registry = new TemplateRegistry(address(badge), registrars);
        console.log("TemplateRegistry deployed at:", address(registry));

        // ── 3. Attestation ── (no constructor args)
        Attestation attestation = new Attestation();
        console.log("Attestation deployed at:", address(attestation));

        // ── 4. DeadMansSwitch ── (no constructor args)
        DeadMansSwitch dms = new DeadMansSwitch();
        console.log("DeadMansSwitch deployed at:", address(dms));

        // ── 5. TrustlessLock ──
        TrustlessLock lock = new TrustlessLock(treasury);
        console.log("TrustlessLock deployed at:", address(lock));

        // ── 6. Register templates ──
        // Class A: Attestation — anyone can deploy
        registry.registerTemplate(
            "Attestation",
            "Permissionless hash anchor. Immutable. No owner.",
            TemplateRegistry.ContractClass.A,
            abi.encode(keccak256(type(Attestation).creationCode))
        );

        // Class A: TrustlessLock — anyone can deploy
        registry.registerTemplate(
            "TrustlessLock",
            "Time-locked LP token locker with 98/2 revenue share.",
            TemplateRegistry.ContractClass.A,
            abi.encode(keccak256(type(TrustlessLock).creationCode))
        );

        // Class B: DeadMansSwitch — Dox_Dev Level 2+
        registry.registerTemplate(
            "DeadMansSwitch",
            "Dark/Light truth inheritance protocol.",
            TemplateRegistry.ContractClass.B,
            abi.encode(keccak256(type(DeadMansSwitch).creationCode))
        );

        console.log("Templates registered: Attestation (A), TrustlessLock (A), DeadMansSwitch (B)");

        // ── 7. BIJO ── (Binary Journal token)
        BIJO bijo = new BIJO(
            governance,
            address(0), // StorageEndowment (deployed next)
            address(0), // Airdrop distributor (TBD)
            address(0), // Founder vesting (TBD)
            address(0), // Liquidity pool (TBD)
            address(0)  // Ecosystem reserve (TBD)
        );
        console.log("BIJO deployed at:", address(bijo));

        // ── 8. StorageEndowment ──
        StorageEndowment endowment = new StorageEndowment(
            address(bijo),
            address(0), // WAY token address (TBD — native token)
            governance
        );
        console.log("StorageEndowment deployed at:", address(endowment));

        vm.stopBroadcast();

        // ── Deployment Summary ──
        console.log("");
        console.log("======");
        console.log("WayChain Genesis Deployment Complete");
        console.log("======");
        console.log("DoxDevBadge:     ", address(badge));
        console.log("TemplateRegistry:", address(registry));
        console.log("Attestation:     ", address(attestation));
        console.log("DeadMansSwitch:  ", address(dms));
        console.log("TrustlessLock:   ", address(lock));
        console.log("BIJO:            ", address(bijo));
        console.log("StorageEndowment:", address(endowment));
    }
}