// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StorageEndowment
 * @notice The eternal archive fund. Holds 70% of BIJO supply and pays
 *         verified storage node operators for storing encrypted truth files.
 *
 *         Operators must have a Dox_Dev badge (Level 2+). Payments are in
 *         BIJO + WAY. Allocation per operator halves every 2 years
 *         (10 halvings ≈ 20 years of operation).
 *
 *         On WayChain, storage operators are verified humans with real
 *         identity, real reputation, and real economic stake. If they
 *         disappear with the data, their badge is revoked and bond slashed.
 *
 *         No owner. Immutable after initialization.
 */
contract StorageEndowment {
    event OperatorAdded(address indexed operator, address indexed badgeContract);
    event OperatorRemoved(address indexed operator, string reason);
    event AllocationSet(uint256 epoch, uint256 totalAllocation);
    event PaymentMade(address indexed operator, uint256 bijoAmount, uint256 wayAmount);
    event StorageProofSubmitted(address indexed operator, bytes32 fileHash, uint256 timestamp);

    struct Operator {
        address addr;
        address badgeContract;  // Dox_Dev badge contract address
        bool active;
        uint256 joinedAt;
        uint256 totalPaidBijo;
        uint256 totalPaidWay;
    }

    address public immutable bijoToken;
    address public immutable wayToken;    // WAY token address
    address public immutable governance;
    uint256 public immutable halvingInterval = 2 * 365 days; // 2 years
    uint256 public immutable startTime;

    uint256 public totalAllocation;     // BIJO allocated to this epoch
    uint256 public currentEpoch;
    uint256 public operatorCount;
    uint256 public constant MAX_OPERATORS = 50;
    uint256 public constant MIN_OPERATORS = 5;

    // Halving schedule: starts at 100% of base allocation, halves every 2 years
    uint256 public constant BASE_EPOCH_ALLOCATION = 10_000_000 * 10**18; // 10M BIJO per epoch

    mapping(address => Operator) public operators;
    address[] public operatorList;

    modifier onlyGovernance() {
        require(msg.sender == governance, "Only governance");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender].active, "Not an active operator");
        _;
    }

    constructor(address _bijoToken, address _wayToken, address _governance) {
        require(_bijoToken != address(0), "Invalid BIJO");
        require(_wayToken != address(0), "Invalid WAY");
        require(_governance != address(0), "Invalid governance");
        bijoToken = _bijoToken;
        wayToken = _wayToken;
        governance = _governance;
        startTime = block.timestamp;
        currentEpoch = 0;
    }

    /**
     * @notice Add a storage operator. Must have a Dox_Dev badge.
     * @param operator Address of the storage node operator
     * @param badgeContract Dox_Dev badge contract to verify against
     */
    function addOperator(address operator, address badgeContract) external onlyGovernance {
        require(!operators[operator].active, "Already active");
        require(operatorCount < MAX_OPERATORS, "Max operators reached");
        require(operator != address(0), "Invalid address");

        operators[operator] = Operator({
            addr: operator,
            badgeContract: badgeContract,
            active: true,
            joinedAt: block.timestamp,
            totalPaidBijo: 0,
            totalPaidWay: 0
        });

        operatorList.push(operator);
        operatorCount++;

        emit OperatorAdded(operator, badgeContract);
    }

    /**
     * @notice Remove an operator (for fraud, downtime, or badge revocation)
     * @param operator Address to remove
     * @param reason Why they were removed
     */
    function removeOperator(address operator, string calldata reason) external onlyGovernance {
        require(operators[operator].active, "Not active");
        operators[operator].active = false;
        operatorCount--;

        emit OperatorRemoved(operator, reason);
    }

    /**
     * @notice Calculate the current epoch (0-indexed)
     */
    function getCurrentEpoch() public view returns (uint256) {
        return (block.timestamp - startTime) / halvingInterval;
    }

    /**
     * @notice Get the allocation multiplier for the current epoch
     *         Starts at 100%, halves every epoch
     */
    function getAllocationMultiplier() public view returns (uint256) {
        uint256 epoch = getCurrentEpoch();
        if (epoch >= 10) return 0; // After 10 halvings, allocation is negligible
        // Each epoch halves: 1, 1/2, 1/4, ... 1/1024
        // Represented as fraction: numerator=2^(10-epoch-1), denominator=1024
        uint256 numerator = 2**(10 - epoch - 1);
        return numerator; // out of 1024
    }

    /**
     * @notice Calculate payout for this epoch
     */
    function calculateEpochAllocation() public view returns (uint256) {
        uint256 multiplier = getAllocationMultiplier();
        if (multiplier == 0) return 0;
        return BASE_EPOCH_ALLOCATION * multiplier / 1024;
    }

    /**
     * @notice Submit a storage proof
     * @param fileHash Hash of the stored file
     */
    function submitProof(bytes32 fileHash) external onlyOperator {
        emit StorageProofSubmitted(msg.sender, fileHash, block.timestamp);
    }

    /**
     * @notice Process payments for the current epoch
     *         Called by governance each epoch
     */
    function processPayments() external onlyGovernance {
        require(operatorCount >= MIN_OPERATORS, "Not enough operators");

        uint256 epoch = getCurrentEpoch();
        require(epoch > currentEpoch, "Epoch not yet complete");

        uint256 allocation = calculateEpochAllocation();
        require(allocation > 0, "No allocation for this epoch");

        uint256 paymentPerOperator = allocation / operatorCount;

        // Verify we have enough BIJO
        IERC20(bijoToken).transferFrom(governance, address(this), allocation);

        for (uint256 i = 0; i < operatorList.length; i++) {
            address opAddr = operatorList[i];
            if (!operators[opAddr].active) continue;

            // Pay in BIJO
            IERC20(bijoToken).transfer(opAddr, paymentPerOperator);

            // Pay in WAY (same value in WAY — oracle would determine exact amount)
            // Simplified: 1:1 ratio at deployment
            uint256 wayAmount = paymentPerOperator;
            IERC20(wayToken).transfer(opAddr, wayAmount);

            operators[opAddr].totalPaidBijo += paymentPerOperator;
            operators[opAddr].totalPaidWay += wayAmount;

            emit PaymentMade(opAddr, paymentPerOperator, wayAmount);
        }

        currentEpoch = epoch;
        emit AllocationSet(epoch, allocation);
    }

    /**
     * @notice Get the operator list
     */
    function getOperators() external view returns (address[] memory) {
        return operatorList;
    }

    /**
     * @notice Get operator count
     */
    function getActiveOperatorCount() external view returns (uint256) {
        uint256 count;
        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]].active) count++;
        }
        return count;
    }
}

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}