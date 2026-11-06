// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WayChain EconoAnalytics (application-layer economic health engine)
/// @notice WayChain's CORE protocol (Go TaskRegistry precompile 0x23) is the
///         source of truth: it emits sha256-core `TaskPaid` events and computes
///         the four decentralized indicators natively. This Solidity contract is
///         the APP-LAYER mirror — an off-chain EconoOracle reads the Go-computed
///         snapshot (via way_econoIndicators) and replays it here so dapps and
///         high-tier task gates can read it through standard EVM calls.
///
///         Indicators (defined per the economic-health spec, translated):
///           - GBP (Gross Blockchain Product): WAY paid for completed tasks / window
///           - Network Employment: active task-takers / total addresses (basis pts)
///           - Token Velocity: tasks (token handoffs) / circulating supply (basis pts)
///           - Task Yield Spread: avg professional payout / avg micro payout (basis pts)
///           - Phase: Expansion (high GBP + high velocity) | Consolidation
interface IEconoFeed {
    function feedSnapshot(
        uint256 gbp,
        uint256 employmentBps,
        uint256 velocityBps,
        uint256 yieldSpreadBps,
        uint8 phase
    ) external;
}

contract EconoAnalytics {
    /// @notice Authorized oracle that replays Go-core snapshots. Set at deploy.
    address public oracle;

    uint256 public lastGBP;
    uint256 public lastEmploymentBps;
    uint256 public lastVelocityBps;
    uint256 public lastYieldSpreadBps;
    uint8 public lastPhase; // 0 = Consolidation, 1 = Expansion
    uint256 public lastSettledBlock;

    event SnapshotFed(
        uint256 blockNum,
        uint256 gbp,
        uint256 employmentBps,
        uint256 velocityBps,
        uint256 yieldSpreadBps,
        uint8 phase
    );

    error Unauthorized();

    constructor(address _oracle) {
        oracle = _oracle;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert Unauthorized();
        _;
    }

    /// @notice Oracle replays the Go-core computed snapshot into the app layer.
    function feedSnapshot(
        uint256 gbp,
        uint256 employmentBps,
        uint256 velocityBps,
        uint256 yieldSpreadBps,
        uint8 phase
    ) external onlyOracle {
        lastGBP = gbp;
        lastEmploymentBps = employmentBps;
        lastVelocityBps = velocityBps;
        lastYieldSpreadBps = yieldSpreadBps;
        lastPhase = phase;
        lastSettledBlock = block.number;
        emit SnapshotFed(block.number, gbp, employmentBps, velocityBps, yieldSpreadBps, phase);
    }

    /// @notice One-shot read of all indicators + phase (UI-friendly).
    function getIndicators()
        external
        view
        returns (
            uint256 gbp,
            uint256 employmentBps,
            uint256 velocityBps,
            uint256 yieldSpreadBps,
            uint8 phase
        )
    {
        return (lastGBP, lastEmploymentBps, lastVelocityBps, lastYieldSpreadBps, lastPhase);
    }

    /// @notice Human-readable phase label.
    function phaseLabel() external view returns (string memory) {
        return lastPhase == 1 ? "Expansion" : "Consolidation";
    }
}
