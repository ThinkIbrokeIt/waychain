// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/BTCDynamicOracleMint.sol";
import "../src/MockBadge.sol";

/**
 * @title BTCDynamicOracleMintTest
 * @notice Tests for dynamic 3-of-5 oracle selection for BTC minting
 */
contract BTCDynamicOracleMintTest is Test {
    BTCDynamicOracleMint mint;
    MockBadge badge;

    // Test oracles
    address oracle1 = address(0x1001);
    address oracle2 = address(0x1002);
    address oracle3 = address(0x1003);
    address oracle4 = address(0x1004);
    address oracle5 = address(0x1005);
    address oracle6 = address(0x1006);
    address user = address(0x2000);

    function setUp() public {
        badge = new MockBadge();
        mint = new BTCDynamicOracleMint(address(badge));

        // Set up oracles with Level 2+
        vm.prank(oracle1);
        badge.setBadgeLevel(oracle1, 2);
        vm.prank(oracle2);
        badge.setBadgeLevel(oracle2, 3);
        vm.prank(oracle3);
        badge.setBadgeLevel(oracle3, 2);
        vm.prank(oracle4);
        badge.setBadgeLevel(oracle4, 3);
        vm.prank(oracle5);
        badge.setBadgeLevel(oracle5, 2);
        vm.prank(oracle6);
        badge.setBadgeLevel(oracle6, 3);

        // Register all oracles with sufficient bond (contract requires 5000 ether)
        vm.deal(oracle1, 6000 ether);
        vm.deal(oracle2, 6000 ether);
        vm.deal(oracle3, 6000 ether);
        vm.deal(oracle4, 6000 ether);
        vm.deal(oracle5, 6000 ether);
        vm.deal(oracle6, 6000 ether);

        vm.prank(oracle1);
        mint.registerOracle{value: 5000 ether}();
        vm.prank(oracle2);
        mint.registerOracle{value: 5000 ether}();
        vm.prank(oracle3);
        mint.registerOracle{value: 5000 ether}();
        vm.prank(oracle4);
        mint.registerOracle{value: 5000 ether}();
        vm.prank(oracle5);
        mint.registerOracle{value: 5000 ether}();
        vm.prank(oracle6);
        mint.registerOracle{value: 5000 ether}();
    }

    function test_OraclesRegistered() public {
        assertEq(mint.getOracleCount(), 6);
        assert(mint.getAllOracles().length == 6);
    }

    function test_RegistrationRequiresLevel2() public {
        address lowLevel = address(0x3000);
        vm.deal(lowLevel, 6000 ether);
        badge.setBadgeLevel(lowLevel, 1);

        vm.expectRevert("NotDoxDevLevel2()");
        vm.prank(lowLevel);
        mint.registerOracle{value: 5000 ether}();
    }

    function test_RequestMintSelectsFive() public {
        vm.deal(user, 100 ether);
        vm.prank(user);
        bytes32 requestId = mint.requestMint(100000000); // 1 BTC in satoshis

        address[5] memory selected = mint.getSelectedOracles(requestId);

        // Verify all 5 are unique
        for (uint256 i = 0; i < 5; i++) {
            for (uint256 j = i + 1; j < 5; j++) {
                assert(selected[i] != selected[j]);
            }
            // Verify they are all registered
            assert(mint.isOracleSelected(requestId, selected[i]));
        }
    }

    function test_MintFinalizesWithThreeApprovals() public {
        vm.deal(user, 100 ether);
        vm.prank(user);
        bytes32 requestId = mint.requestMint(100000000);

        address[5] memory selected = mint.getSelectedOracles(requestId);

        // First 3 oracles approve
        vm.prank(selected[0]);
        mint.approveMint(requestId);

        vm.prank(selected[1]);
        mint.approveMint(requestId);

        vm.prank(selected[2]);
        mint.approveMint(requestId);

        // Check finalization
        (,,,, bool finalized, bool approved) = mint.getMintRequest(requestId);
        assertTrue(finalized);
        assertTrue(approved);
    }

    function test_SingleRejectFinalizes() public {
        vm.deal(user, 100 ether);
        vm.prank(user);
        bytes32 requestId = mint.requestMint(100000000);

        address[5] memory selected = mint.getSelectedOracles(requestId);

        // Any oracle rejecting finalizes immediately
        vm.prank(selected[0]);
        mint.rejectMint(requestId);

        (,,,, bool finalized, bool approved) = mint.getMintRequest(requestId);
        assertTrue(finalized);
        assertFalse(approved);
    }

    function test_WindowExpired() public {
        vm.deal(user, 100 ether);
        bytes32 requestId = mint.requestMint(100000000);

        address[5] memory selected = mint.getSelectedOracles(requestId);

        // Only 2 approvals - not enough for quorum
        vm.prank(selected[0]);
        mint.approveMint(requestId);
        vm.prank(selected[1]);
        mint.approveMint(requestId);

        // Move forward past the 100-block window
        vm.roll(block.number + 101);

        // Oracles can no longer vote
        vm.expectRevert("WindowExpired()");
        vm.prank(selected[2]);
        mint.approveMint(requestId);
    }

    function test_SlashNonResponsive() public {
        vm.deal(user, 100 ether);
        bytes32 requestId = mint.requestMint(100000000);

        address[5] memory selected = mint.getSelectedOracles(requestId);

        // Only 2 approvals - not enough
        vm.prank(selected[0]);
        mint.approveMint(requestId);
        vm.prank(selected[1]);
        mint.approveMint(requestId);

        // Move past window
        vm.roll(block.number + 101);

        // Process non-responders
        mint.processNonResponders(requestId);

        // Check that 3 non-voters were slashed
        assertEq(mint.getOracleCount(), 3);
    }

    function test_AlreadyVoted() public {
        vm.deal(user, 100 ether);
        bytes32 requestId = mint.requestMint(100000000);

        address[5] memory selected = mint.getSelectedOracles(requestId);

        vm.prank(selected[0]);
        mint.approveMint(requestId);

        // Cannot approve twice
        vm.expectRevert("AlreadyVoted()");
        vm.prank(selected[0]);
        mint.approveMint(requestId);
    }

    function test_NotSelectedCannotVote() public {
        vm.deal(user, 100 ether);
        vm.prank(user);
        bytes32 requestId = mint.requestMint(100000000);

        // Register an additional oracle who will NOT be selected for THIS request
        address lateOracle = address(0x7000);
        vm.deal(lateOracle, 6000 ether);
        badge.setBadgeLevel(lateOracle, 2);
        vm.prank(lateOracle);
        mint.registerOracle{value: 5000 ether}();

        // This oracle is registered but wasn't selected for the PRIOR request
        vm.prank(lateOracle);
        vm.expectRevert("NotSelected()");
        mint.approveMint(requestId);
    }

    function test_InsufficientBond() public {
        address newOracle = address(0x4000);
        vm.deal(newOracle, 1 ether);
        badge.setBadgeLevel(newOracle, 2);

        vm.expectRevert("InsufficientBond()");
        vm.prank(newOracle);
        mint.registerOracle{value: 1 ether}();
    }
}