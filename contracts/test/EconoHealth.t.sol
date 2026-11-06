// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {EconoAnalytics} from "../src/EconoAnalytics.sol";
import {ProfessionalSBT} from "../src/ProfessionalSBT.sol";

/// @notice Self-contained tests verifying the spec's mapping:
///         - the four on-chain indicators + phase feed
///         - the SBT gates high-tier tasks (soulbound, authority-gated)
contract EconoHealthTest is Test {
    EconoAnalytics analytics;
    ProfessionalSBT sbt;
    address oracle = address(0x0A);
    address authority = address(0x0B);
    address pro = address(0x0C);

    function setUp() public {
        analytics = new EconoAnalytics(oracle);
        sbt = new ProfessionalSBT(authority);
    }

    function testFeedSnapshot() public {
        vm.prank(oracle);
        analytics.feedSnapshot(1_000_000, 4200, 150, 18_000, 1);
        (uint256 gbp, uint256 emp, uint256 vel, uint256 ys, uint8 phase) = analytics.getIndicators();
        assert(gbp == 1_000_000);
        assert(emp == 4200);
        assert(vel == 150);
        assert(ys == 18_000);
        assert(phase == 1);
        assert(keccak256(bytes(analytics.phaseLabel())) == keccak256(bytes("Expansion")));
    }

    function testFeedUnauthorized() public {
        vm.expectRevert();
        analytics.feedSnapshot(0, 0, 0, 0, 1);
    }

    function testSBTMintAndGate() public {
        assert(!sbt.hasLicense(pro));

        bytes32 lic = sha256(abi.encodePacked("geo-license-123"));
        vm.prank(authority);
        uint256 id = sbt.mint(pro, "geologist", lic);
        assert(id == 1);
        assert(sbt.hasLicense(pro));
        assert(sbt.hasProfession(pro, "geologist"));
        assert(!sbt.hasProfession(pro, "lawyer"));

        // soulbound: transfers must revert
        vm.expectRevert();
        sbt.transferFrom(pro, address(0x0D), id);

        // authority can revoke
        vm.prank(authority);
        sbt.revoke(pro);
        assert(!sbt.hasLicense(pro));
    }

    function testSBTUnauthorizedMint() public {
        vm.expectRevert();
        sbt.mint(pro, "geologist", bytes32(0));
    }
}
