// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TemplateRegistry} from "../src/TemplateRegistry.sol";
import {DoxDevBadge} from "../src/DoxDevBadge.sol";

contract TemplateRegistryTest is Test {
    TemplateRegistry public registry;
    DoxDevBadge public badge;
    address public registrar1 = makeAddr("registrar1");
    address public registrar2 = makeAddr("registrar2");
    address public curator1 = makeAddr("curator1");
    address public curator2 = makeAddr("curator2");
    address public curator3 = makeAddr("curator3");
    address public devL2 = makeAddr("devL2");  // Level 2 badge
    address public devL3 = makeAddr("devL3");  // Level 3 badge
    address public anonUser = makeAddr("anonUser");

    bytes32 public constant DUMMY_HASH = keccak256("bytecode");

    function setUp() public {
        // Deploy Dox_Dev badge
        address[] memory curators = new address[](3);
        curators[0] = curator1;
        curators[1] = curator2;
        curators[2] = curator3;
        badge = new DoxDevBadge(curators);

        // Issue badges
        vm.prank(curator1);
        badge.issueBadge(devL2, 2, 0);  // Level 2
        vm.prank(curator1);
        badge.issueBadge(devL3, 3, 0);  // Level 3

        // Deploy registry
        address[] memory registrars = new address[](2);
        registrars[0] = registrar1;
        registrars[1] = registrar2;
        registry = new TemplateRegistry(address(badge), registrars);
    }

    function test_Constructor() public {
        assertTrue(registry.registrars(registrar1));
        assertTrue(registry.registrars(registrar2));
        assertEq(registry.totalDeployments(), 0);
    }

    function test_RegisterClassA() public {
        vm.prank(registrar1);
        bytes32 id = registry.registerTemplate("Attestation", "Permissionless hash anchor", TemplateRegistry.ContractClass.A, abi.encode(DUMMY_HASH));
        assertTrue(id != bytes32(0));

        TemplateRegistry.Template memory t = registry.getTemplate(id);
        assertEq(t.name, "Attestation");
        assertTrue(t.active);
    }

    function test_RevertRegisterNotRegistrar() public {
        vm.prank(anonUser);
        vm.expectRevert("Not a registrar");
        registry.registerTemplate("Test", "test", TemplateRegistry.ContractClass.A, abi.encode(DUMMY_HASH));
    }

    function test_RevertDuplicateRegistration() public {
        vm.prank(registrar1);
        registry.registerTemplate("Unique", "test", TemplateRegistry.ContractClass.A, abi.encode(DUMMY_HASH));

        vm.prank(registrar1);
        vm.expectRevert("Template already exists");
        registry.registerTemplate("Unique", "test", TemplateRegistry.ContractClass.A, abi.encode(DUMMY_HASH));
    }

    function test_DeployClassAAnyone() public {
        vm.prank(registrar1);
        bytes32 id = registry.registerTemplate("Attestation", "Hash anchor", TemplateRegistry.ContractClass.A, abi.encode(DUMMY_HASH));

        vm.prank(anonUser);
        registry.recordDeployment(id, address(0x1234));

        assertEq(registry.totalDeployments(), 1);
        TemplateRegistry.Template memory t = registry.getTemplate(id);
        assertEq(t.deployCount, 1);
    }

    function test_RevertClassBNotVerified() public {
        vm.prank(registrar1);
        bytes32 id = registry.registerTemplate("DeadMansSwitch", "Inheritance protocol", TemplateRegistry.ContractClass.B, abi.encode(DUMMY_HASH));

        vm.prank(anonUser);
        vm.expectRevert("Insufficient Dox_Dev level");
        registry.recordDeployment(id, address(0x1234));
    }

    function test_DeployClassBWithLevel2() public {
        vm.prank(registrar1);
        bytes32 id = registry.registerTemplate("DeadMansSwitch", "Inheritance protocol", TemplateRegistry.ContractClass.B, abi.encode(DUMMY_HASH));

        vm.prank(devL2);
        registry.recordDeployment(id, address(0x1234));

        assertEq(registry.totalDeployments(), 1);
    }

    function test_RevertClassCRequiresLevel3() public {
        vm.prank(registrar1);
        bytes32 id = registry.registerTemplate("StorageEndowment", "Eternal archive", TemplateRegistry.ContractClass.C, abi.encode(DUMMY_HASH));

        vm.prank(devL2); // Only level 2
        vm.expectRevert("Insufficient Dox_Dev level");
        registry.recordDeployment(id, address(0x1234));
    }

    function test_DeployClassCWithLevel3() public {
        vm.prank(registrar1);
        bytes32 id = registry.registerTemplate("StorageEndowment", "Eternal archive", TemplateRegistry.ContractClass.C, abi.encode(DUMMY_HASH));

        vm.prank(devL3);
        registry.recordDeployment(id, address(0x1234));

        assertEq(registry.totalDeployments(), 1);
    }

    function test_GetTemplateIds() public {
        vm.prank(registrar1);
        registry.registerTemplate("A", "a", TemplateRegistry.ContractClass.A, abi.encode(DUMMY_HASH));
        vm.prank(registrar1);
        registry.registerTemplate("B", "b", TemplateRegistry.ContractClass.B, abi.encode(DUMMY_HASH));

        bytes32[] memory ids = registry.getTemplateIds();
        assertEq(ids.length, 2);
    }
}