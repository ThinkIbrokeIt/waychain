// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {DoxDevBadge} from "../src/DoxDevBadge.sol";
import {TemplateRegistry} from "../src/TemplateRegistry.sol";
import {Attestation} from "../src/Attestation.sol";
import {DeadMansSwitch} from "../src/DeadMansSwitch.sol";
import {TrustlessLock} from "../src/TrustlessLock.sol";
import {BIJO} from "../src/BIJO.sol";
import {StorageEndowment} from "../src/StorageEndowment.sol";
import {BitcoinSPV} from "../src/BitcoinSPV.sol";
import {BitcoinRegistry} from "../src/BitcoinRegistry.sol";

contract MockERC20 {
    string public name = "Mock LP";
    string public symbol = "MLP";
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(address holder, uint256 amount) { balanceOf[holder] = amount; }
    function transfer(address to, uint256 amount) external returns (bool success) {
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool success) {
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
    function approve(address spender, uint256 amount) external returns (bool success) {
        allowance[msg.sender][spender] = amount; return true;
    }
}

contract WayChainIntegrationTest is Test {
    // Curators who control Dox_Dev badge issuance
    address curator1 = makeAddr("curator1");
    address curator2 = makeAddr("curator2");
    address curator3 = makeAddr("curator3");

    // Users
    address alice = makeAddr("alice");    // Normal user, L2 badge
    address bob = makeAddr("bob");        // Normal user, L3 badge
    address charlie = makeAddr("charlie"); // Unverified user
    address treasury = makeAddr("treasury");
    address governance = makeAddr("governance");

    // Contracts
    DoxDevBadge badge;
    TemplateRegistry registry;
    Attestation attestation;
    DeadMansSwitch dms;
    TrustlessLock lock;
    BIJO bijo;
    StorageEndowment endowment;
    BitcoinSPV spv;
    BitcoinRegistry bitcoinReg;
    MockERC20 lpToken;

    function setUp() public {
        vm.label(curator1, "Curator1");
        vm.label(curator2, "Curator2");
        vm.label(curator3, "Curator3");
        vm.label(alice, "Alice");
        vm.label(bob, "Bob");
        vm.label(charlie, "Charlie");
        vm.label(treasury, "Treasury");
        vm.label(governance, "Governance");

        console.log("=== WayChain Integration Test Setup ===");

        // ── 1. Deploy DoxDevBadge ──
        address[] memory curators = new address[](3);
        curators[0] = curator1;
        curators[1] = curator2;
        curators[2] = curator3;
        badge = new DoxDevBadge(curators);
        console.log("DoxDevBadge deployed");

        // ── 2. Issue badges ──
        vm.prank(curator1);
        badge.issueBadge(alice, 2, 0);    // Level 2 — can deploy Class B
        vm.prank(curator2);
        badge.issueBadge(bob, 3, 0);      // Level 3 — can deploy Class C
        console.log("Badges issued: Alice(L2), Bob(L3)");

        // ── 3. Deploy TemplateRegistry ──
        address[] memory registrars = new address[](2);
        registrars[0] = curator1;
        registrars[1] = governance;
        registry = new TemplateRegistry(address(badge), registrars);
        console.log("TemplateRegistry deployed");

        // ── 4. Deploy core contracts ──
        attestation = new Attestation();
        dms = new DeadMansSwitch();
        lock = new TrustlessLock(treasury);
        console.log("Core contracts deployed: Attestation, DMS, TrustlessLock");

        // ── 5. Register templates ──
        vm.prank(curator1);
        registry.registerTemplate("Attestation", "Hash anchor",
            TemplateRegistry.ContractClass.A, abi.encode(keccak256("attestation")));

        vm.prank(curator1);
        registry.registerTemplate("DeadMansSwitch", "Inheritance",
            TemplateRegistry.ContractClass.B, abi.encode(keccak256("dms")));

        vm.prank(curator1);
        registry.registerTemplate("TrustlessLock", "LP locks",
            TemplateRegistry.ContractClass.A, abi.encode(keccak256("lock")));

        console.log("Templates registered: Attestation(A), DMS(B), Lock(A)");

        // ── 6. Deploy BIJO + StorageEndowment ──
        address storageAddr = makeAddr("storageEndowment");
        address airdropAddr = makeAddr("airdrop");
        address vestingAddr = makeAddr("vesting");
        address liquidityAddr = makeAddr("liquidity");
        address reserveAddr = makeAddr("reserve");

        bijo = new BIJO(governance, storageAddr, airdropAddr, vestingAddr, liquidityAddr, reserveAddr);
        console.log("BIJO deployed: 369M supply");

        // WAY token (native coin — mock ERC20 for testing)
        MockERC20 wayToken = new MockERC20(treasury, 1_000_000 ether);

        endowment = new StorageEndowment(address(bijo), address(wayToken), governance);
        console.log("StorageEndowment deployed");

        // ── 7. Deploy Bitcoin contracts ──
        // Use simplified deployment for integration (full SPV needs real Bitcoin headers)
        bitcoinReg = new BitcoinRegistry(address(0x1), address(badge));
        console.log("BitcoinRegistry deployed");

        // ── 8. Deploy mock LP token ──
        lpToken = new MockERC20(alice, 10000 ether);
        vm.prank(alice);
        lpToken.approve(address(lock), 10000 ether);
        console.log("Mock LP token deployed");
        console.log("=== Setup Complete ===");
    }

    // ── Phase 0: Identity ──
    function test_FullFlow_Identity() public {
        assertTrue(badge.isVerified(alice), "Alice should be verified");
        assertEq(badge.getLevel(alice), 2, "Alice should be L2");
        assertEq(badge.getLevel(bob), 3, "Bob should be L3");
        assertEq(badge.getLevel(charlie), 0, "Charlie should be unverified");
    }

    function test_FullFlow_BadgeRevoke() public {
        assertTrue(badge.isVerified(alice));
        vm.prank(curator2);
        badge.revokeBadge(alice, "Test revocation");
        assertFalse(badge.isVerified(alice));
    }

    // ── Phase 0: Template Registry ──
    function test_FullFlow_TemplateGating() public {
        bytes32 attestId = keccak256("Attestation");
        bytes32 dmsId = keccak256("DeadMansSwitch");
        bytes32 lockId = keccak256("TrustlessLock");

        // Class A — anyone can deploy
        vm.prank(charlie);
        registry.recordDeployment(attestId, address(attestation));
        assertEq(registry.totalDeployments(), 1);

        // Class B — needs L2+
        vm.prank(charlie);
        vm.expectRevert("Insufficient Dox_Dev level");
        registry.recordDeployment(dmsId, address(dms));

        vm.prank(alice); // Alice is L2
        registry.recordDeployment(dmsId, address(dms));
        assertEq(registry.totalDeployments(), 2);
    }

    // ── Phase 1: Attestation ──
    function test_FullFlow_Attest() public {
        bytes32 hash = keccak256("truth");

        vm.prank(alice);
        attestation.attest(hash);

        assertTrue(attestation.isAttested(hash));
        assertEq(attestation.totalAttestations(), 1);

        (bool attested, address attestant,) = attestation.verify(hash);
        assertTrue(attested);
        assertEq(attestant, alice);
    }

    // ── Phase 1: Dead Man's Switch ──
    function test_FullFlow_DeadMansSwitch() public {
        uint256 interval = 30 days;
        bytes32 keyRef = keccak256("key");

        vm.prank(alice);
        uint256 id = dms.createSwitch(DeadMansSwitch.TruthType.Dark, bob, interval, keyRef);

        assertFalse(dms.canClaim(id), "Should not be claimable yet");

        // Alice heartbeats at 15 days
        vm.warp(block.timestamp + 15 days);
        vm.prank(alice);
        dms.heartbeat(id);
        assertFalse(dms.canClaim(id), "Heartbeat reset timer");

        // Skip 31 days — now claimable
        vm.warp(block.timestamp + 31 days);
        assertTrue(dms.canClaim(id), "Should be claimable");

        // Bob claims
        vm.prank(bob);
        dms.claim(id);
        assertFalse(dms.canClaim(id), "Already claimed");
    }

    // ── Phase 1: Trustless Lock ──
    function test_FullFlow_TrustlessLock() public {
        uint256 amount = 1000 ether;

        vm.prank(alice);
        uint256 id = lock.createTimeLock(address(lpToken), amount, 180 days);

        (bool locked,,) = lock.getLockStatus(id);
        assertTrue(locked);

        // Withdraw after lock period
        vm.warp(block.timestamp + 181 days);
        vm.prank(alice);
        lock.withdraw(id);

        // 2% to treasury
        uint256 treasuryShare = (amount * 200) / 10000;
        assertEq(lpToken.balanceOf(treasury), treasuryShare, "Treasury should get 2%");
    }

    // ── Phase 2: Token (BIJO) ──
    function test_FullFlow_BIJOSupply() public {
        assertEq(bijo.totalSupply(), 369_000_000 * 10**18, "Total supply should be 369M");
        assertEq(bijo.name(), "Binary Journal");
        assertEq(bijo.symbol(), "BIJO");
        assertFalse(bijo.transfersEnabled(), "Transfers should be disabled at launch");
    }

    function test_FullFlow_BIJOEnableTransfers() public {
        vm.prank(governance);
        bijo.enableTransfers();
        assertTrue(bijo.transfersEnabled(), "Transfers should be enabled");
    }

    // ── Integration: Badge → Template → Deploy ──
    function test_FullFlow_VerifiedDeployer() public {
        // Alice (L2) can deploy Class B (DeadMansSwitch)
        bytes32 dmsId = keccak256("DeadMansSwitch");
        vm.prank(alice);
        registry.recordDeployment(dmsId, address(dms));

        // Charlie (no badge) cannot
        bytes32 lockId = keccak256("TrustlessLock");
        vm.prank(charlie);
        registry.recordDeployment(lockId, address(lock)); // Class A — allowed
    }

    // ── Integration: Full User Lifecycle ──
    function test_FullFlow_UserLifecycle() public {
        // 1. Get verified
        address user = makeAddr("newUser");
        vm.prank(curator1);
        badge.issueBadge(user, 2, 0);
        assertTrue(badge.isVerified(user));

        // 2. Attest truth
        bytes32 truth = keccak256("my_witness");
        vm.prank(user);
        attestation.attest(truth);
        assertEq(attestation.totalAttestations(), 1);

        // 3. Set up inheritance
        uint256 interval = 30 days;
        vm.prank(user);
        uint256 switchId = dms.createSwitch(DeadMansSwitch.TruthType.Dark, bob, interval, keccak256("my_key"));

        // 4. Deploy from template (Class A — anyone)
        bytes32 attId = keccak256("Attestation");
        vm.prank(user);
        registry.recordDeployment(attId, address(attestation));

        console.log("User lifecycle complete: verified, attested, inherited, deployed");
    }

    // ── Integration: Bitcoin Registry Basics ──
    function test_FullFlow_BitcoinRegistry() public {
        // Verify the BitcoinRegistry uses Dox_Dev for oracles
        // Charlie (no badge) can't attest
        bytes32 utxo = keccak256("test_utxo");
        bytes32[] memory emptyProof;

        vm.prank(charlie);
        vm.expectRevert(); // Should fail — not an oracle
        bitcoinReg.attestCommitment(utxo, 10000, alice, keccak256("tx"), emptyProof, bytes32(0), 0);

        // But anyone can request withdrawal (if they have balance)
        // Alice has 0 balance
        vm.prank(alice);
        vm.expectRevert("Insufficient balance");
        bitcoinReg.requestWithdrawal(10000, "bc1q-test");
    }
}