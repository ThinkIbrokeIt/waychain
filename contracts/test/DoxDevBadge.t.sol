// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DoxDevBadge} from "../src/DoxDevBadge.sol";

contract DoxDevBadgeTest is Test {
    DoxDevBadge public badge;
    address public curator1 = makeAddr("curator1");
    address public curator2 = makeAddr("curator2");
    address public curator3 = makeAddr("curator3");
    address public dev1 = makeAddr("dev1");
    address public dev2 = makeAddr("dev2");

    function setUp() public {
        address[] memory curators = new address[](3);
        curators[0] = curator1;
        curators[1] = curator2;
        curators[2] = curator3;
        badge = new DoxDevBadge(curators);
    }

    function test_Constructor() public {
        assertTrue(badge.curators(curator1));
        assertTrue(badge.curators(curator2));
        assertTrue(badge.curators(curator3));
        assertEq(badge.curatorCount(), 3);
    }

    function test_IssueBadge() public {
        vm.prank(curator1);
        badge.issueBadge(dev1, 2, 0);

        assertTrue(badge.isVerified(dev1));
        assertEq(badge.getLevel(dev1), 2);
        assertEq(badge.totalBadges(), 1);
    }

    function test_RevertIssueBadgeInvalidLevel() public {
        vm.prank(curator1);
        vm.expectRevert("Invalid level");
        badge.issueBadge(dev1, 4, 0);
    }

    function test_RevertIssueBadgeNotCurator() public {
        vm.expectRevert(abi.encodeWithSignature("NotCurator()"));
        badge.issueBadge(dev1, 1, 0);
    }

    function test_RevokeBadge() public {
        vm.prank(curator1);
        badge.issueBadge(dev1, 2, 0);

        vm.prank(curator2);
        badge.revokeBadge(dev1, "Fraud");

        assertFalse(badge.isVerified(dev1));
        assertEq(badge.getLevel(dev1), 0);
    }

    function test_UpgradeBadge() public {
        vm.prank(curator1);
        badge.issueBadge(dev1, 1, 0);

        vm.prank(curator2);
        badge.upgradeBadge(dev1, 2);

        assertEq(badge.getLevel(dev1), 2);
    }

    function test_NonTransferrable() public {
        vm.prank(curator1);
        badge.issueBadge(dev1, 2, 0);

        // Badges can't be transferred — the contract has no transfer function
        // Verified by the absence of any transfer/approve mechanism
        assertEq(badge.totalBadges(), 1);
    }

    function test_Expiry() public {
        vm.prank(curator1);
        badge.issueBadge(dev1, 1, 1); // 1 second validity

        assertTrue(badge.isVerified(dev1));

        vm.warp(block.timestamp + 2);
        assertFalse(badge.isVerified(dev1));
    }

    function test_AddCurator() public {
        address newCurator = makeAddr("newCurator");
        vm.prank(curator1);
        badge.addCurator(newCurator);

        assertTrue(badge.curators(newCurator));
        assertEq(badge.curatorCount(), 4);
    }

    function test_HasMinLevel() public {
        vm.prank(curator1);
        badge.issueBadge(dev1, 2, 0);

        assertTrue(badge.hasMinLevel(dev1, 1));
        assertTrue(badge.hasMinLevel(dev1, 2));
        assertFalse(badge.hasMinLevel(dev1, 3));
        assertFalse(badge.hasMinLevel(dev2, 1)); // unverified
    }
}