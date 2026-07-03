// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Attestation} from "../src/Attestation.sol";

contract AttestationTest is Test {
    Attestation public attestation;
    address public alice = makeAddr("alice");

    function setUp() public {
        attestation = new Attestation();
    }

    function test_AttestHash() public {
        bytes32 hash = keccak256("truth");
        vm.prank(alice);
        attestation.attest(hash);
        assertTrue(attestation.isAttested(hash));
        assertEq(attestation.totalAttestations(), 1);
    }

    function test_RevertEmptyHash() public {
        vm.expectRevert("Empty hash");
        attestation.attest(bytes32(0));
    }

    function test_RevertDuplicate() public {
        bytes32 hash = keccak256("truth");
        attestation.attest(hash);
        vm.expectRevert("Already attested");
        attestation.attest(hash);
    }

    function test_Verify() public {
        bytes32 hash = keccak256("truth");
        vm.prank(alice);
        attestation.attest(hash);

        (bool attested, address attestant, uint256 timestamp) = attestation.verify(hash);
        assertTrue(attested);
        assertEq(attestant, alice);
        assertTrue(timestamp > 0);
    }

    function test_VerifyNonExistent() public {
        bytes32 hash = keccak256("nothing");
        (bool attested,,) = attestation.verify(hash);
        assertFalse(attested);
    }

    function test_EventEmitted() public {
        bytes32 hash = keccak256("event_test");
        vm.expectEmit(true, true, false, true);
        emit Attestation.TruthAnchored(hash, block.timestamp, address(this));
        attestation.attest(hash);
    }
}