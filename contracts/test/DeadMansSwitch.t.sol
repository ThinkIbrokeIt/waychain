// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeadMansSwitch} from "../src/DeadMansSwitch.sol";

contract DeadMansSwitchTest is Test {
    DeadMansSwitch public dms;
    address public owner = makeAddr("owner");
    address public heir = makeAddr("heir");
    address public stranger = makeAddr("stranger");
    bytes32 public keyRef = keccak256("decryption_key");

    uint256 public constant DAY = 86400;
    uint256 public constant MONTH = 30 * DAY;

    function setUp() public {
        dms = new DeadMansSwitch();
    }

    function test_CreateDarkSwitch() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        assertEq(id, 1);
        assertEq(dms.totalSwitches(), 1);
    }

    function test_CreateLightSwitch() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Light, address(0), MONTH, keyRef);
        assertEq(id, 1);
    }

    function test_RevertShortInterval() public {
        vm.prank(owner);
        vm.expectRevert("Interval too short");
        dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, DAY - 1, keyRef);
    }

    function test_RevertDarkWithoutHeir() public {
        vm.prank(owner);
        vm.expectRevert("Dark truth needs heir");
        dms.createSwitch(DeadMansSwitch.TruthType.Dark, address(0), MONTH, keyRef);
    }

    function test_Heartbeat() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        vm.warp(block.timestamp + 15 days);
        vm.prank(owner);
        dms.heartbeat(id);

        assertFalse(dms.canClaim(id));
    }

    function test_RevertHeartbeatNonOwner() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        vm.prank(stranger);
        vm.expectRevert("Not owner");
        dms.heartbeat(id);
    }

    function test_ClaimAfterMissedHeartbeat() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        vm.warp(block.timestamp + MONTH + 1 days);
        assertTrue(dms.canClaim(id));

        vm.prank(heir);
        dms.claim(id);

        assertFalse(dms.canClaim(id));
    }

    function test_RevertClaimBeforeExpiry() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        vm.prank(heir);
        vm.expectRevert("Cannot claim yet");
        dms.claim(id);
    }

    function test_RevertClaimByStranger() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        vm.warp(block.timestamp + MONTH + 1 days);

        vm.prank(stranger);
        vm.expectRevert("Only heir can claim Dark truth");
        dms.claim(id);
    }

    function test_CancelSwitch() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        vm.prank(owner);
        dms.cancel(id);

        assertFalse(dms.canClaim(id));
    }

    function test_TimeUntilClaimable() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);

        uint256 remaining = dms.timeUntilClaimable(id);
        assertApproxEqAbs(remaining, MONTH, 2);

        vm.warp(block.timestamp + MONTH);
        assertEq(dms.timeUntilClaimable(id), 0);
    }

    function test_GetSwitches() public {
        vm.prank(owner);
        dms.createSwitch(DeadMansSwitch.TruthType.Dark, heir, MONTH, keyRef);
        vm.prank(owner);
        dms.createSwitch(DeadMansSwitch.TruthType.Light, address(0), MONTH * 2, keyRef);

        uint256[] memory switches = dms.getSwitches(owner);
        assertEq(switches.length, 2);
    }

    function test_LightTruthClaimableByAnyone() public {
        vm.prank(owner);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Light, address(0), MONTH, keyRef);

        vm.warp(block.timestamp + MONTH + 1 days);

        vm.prank(stranger);
        dms.claim(id);

        assertFalse(dms.canClaim(id));
    }
}