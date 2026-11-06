// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TrustlessLock} from "../src/TrustlessLock.sol";

contract MockERC20 {
    string public name = "Mock LP Token";
    string public symbol = "MLP";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(address initialHolder, uint256 amount) {
        balanceOf[initialHolder] = amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract TrustlessLockTest is Test {
    TrustlessLock public lock;
    MockERC20 public lpToken;
    address public treasury = makeAddr("treasury");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant LOCK_AMOUNT = 1000 ether;
    uint256 public constant INITIAL_BALANCE = 10000 ether;
    uint256 public constant SIX_MONTHS = 180 days;

    function setUp() public {
        lock = new TrustlessLock(treasury);
        lpToken = new MockERC20(alice, 10000 ether);
        vm.prank(alice);
        lpToken.approve(address(lock), 10000 ether);
    }

    function test_CreateTimeLock() public {
        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        assertEq(id, 1);
        assertEq(lock.totalLocks(), 1);
    }

    function test_RevertShortDuration() public {
        vm.prank(alice);
        vm.expectRevert("Min lock: 30 days");
        lock.createTimeLock(address(lpToken), LOCK_AMOUNT, 1 days);
    }

    function test_RevertZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert("Amount must be > 0");
        lock.createTimeLock(address(lpToken), 0, SIX_MONTHS);
    }

    function test_WithdrawAfterLockPeriod() public {
        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        vm.warp(block.timestamp + SIX_MONTHS + 1 days);

        uint256 treasuryBefore = lpToken.balanceOf(treasury);
        uint256 aliceBefore = lpToken.balanceOf(alice);

        vm.prank(alice);
        lock.withdraw(id);

        // 2% to treasury, 98% to alice
        uint256 treasuryAmount = (LOCK_AMOUNT * 200) / 10000;
        uint256 aliceAmount = LOCK_AMOUNT - treasuryAmount;

        assertEq(lpToken.balanceOf(treasury), treasuryBefore + treasuryAmount);
        assertEq(lpToken.balanceOf(alice), aliceBefore + aliceAmount);
    }

    function test_RevertWithdrawBeforeUnlock() public {
        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        vm.prank(alice);
        vm.expectRevert("Lock still active");
        lock.withdraw(id);
    }

    function test_RevertWithdrawNotOwner() public {
        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        vm.warp(block.timestamp + SIX_MONTHS + 1 days);

        vm.prank(bob);
        vm.expectRevert("Not owner");
        lock.withdraw(id);
    }

    function test_RevertDoubleWithdraw() public {
        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        vm.warp(block.timestamp + SIX_MONTHS + 1 days);

        vm.prank(alice);
        lock.withdraw(id);

        vm.prank(alice);
        vm.expectRevert("Already withdrawn");
        lock.withdraw(id);
    }

    function test_GetLockStatus() public {
        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        (bool locked, uint256 remaining,) = lock.getLockStatus(id);
        assertTrue(locked);
        assertApproxEqAbs(remaining, SIX_MONTHS, 1);

        vm.warp(block.timestamp + SIX_MONTHS + 1 days);

        (locked,,) = lock.getLockStatus(id);
        assertFalse(locked);
    }

    function test_GetOwnerLocks() public {
        vm.prank(alice);
        lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);
        vm.prank(alice);
        lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        uint256[] memory locks = lock.getOwnerLocks(alice);
        assertEq(locks.length, 2);
    }

    function test_TreasuryReceivesShare() public {
        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), LOCK_AMOUNT, SIX_MONTHS);

        vm.warp(block.timestamp + SIX_MONTHS + 1 days);

        vm.prank(alice);
        lock.withdraw(id);

        uint256 treasuryAmount = (LOCK_AMOUNT * 200) / 10000;
        assertEq(lpToken.balanceOf(treasury), treasuryAmount);
        assertEq(lpToken.balanceOf(alice), INITIAL_BALANCE - treasuryAmount);
    }
}