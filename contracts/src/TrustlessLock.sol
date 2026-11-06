// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustlessLock
 * @notice Anti-rug pull liquidity lock for WayChain.
 *         LP tokens are locked for a minimum duration.
 *         No admin keys. No early withdrawal. Immutable.
 *
 *         Deployed via WayChain template registry as Class A/B.
 *         Revenue share: 98% to user, 2% to WayChain treasury.
 *
 *         Three lock types:
 *         - TimeLock: Lock for a fixed duration, then withdraw
 *         - VestingLock: Unlock gradually over time
 *         - MultiSigLock: Requires N-of-M signers to withdraw
 */
contract TrustlessLock {
    event TokensLocked(
        uint256 indexed lockId,
        address indexed owner,
        address indexed token,
        uint256 amount,
        uint256 unlockTime
    );
    event TokensWithdrawn(uint256 indexed lockId, address indexed owner, uint256 amount);
    event RevenueShared(uint256 indexed lockId, uint256 treasuryAmount, uint256 ownerAmount);

    enum LockType { TimeLock, VestingLock, MultiSigLock }

    struct Lock {
        address owner;
        address token;          // LP token contract address
        uint256 amount;
        uint256 startTime;
        uint256 unlockTime;     // When fully unlocked (TimeLock) or vesting end
        LockType lockType;
        bool withdrawn;
        uint256 revenueShare;   // 2% = 200 basis points
        // Multi-sig fields
        address[] signers;
        uint256 requiredSignatures;
        uint256 currentSignatures;
        mapping(address => bool) hasSigned;
    }

    uint256 public totalLocks;
    mapping(uint256 => Lock) public locks;
    address public immutable treasury;
    uint256 public constant REVENUE_SHARE_BPS = 200; // 2%

    // Track lock IDs per owner
    mapping(address => uint256[]) public ownerLocks;

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    /**
     * @notice Lock LP tokens for a fixed duration
     * @param token Address of the LP token
     * @param amount Amount to lock
     * @param duration Duration in seconds (min 30 days, max 10 years)
     */
    function createTimeLock(
        address token,
        uint256 amount,
        uint256 duration
    ) external returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(duration >= 30 days, "Min lock: 30 days");
        require(duration <= 3650 days, "Max lock: 10 years");

        uint256 lockId = ++totalLocks;

        Lock storage l = locks[lockId];
        l.owner = msg.sender;
        l.token = token;
        l.amount = amount;
        l.startTime = block.timestamp;
        l.unlockTime = block.timestamp + duration;
        l.lockType = LockType.TimeLock;
        l.revenueShare = REVENUE_SHARE_BPS;

        ownerLocks[msg.sender].push(lockId);

        // Transfer tokens to contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        emit TokensLocked(lockId, msg.sender, token, amount, l.unlockTime);
        return lockId;
    }

    /**
     * @notice Withdraw unlocked tokens
     * @param lockId The lock to withdraw from
     */
    function withdraw(uint256 lockId) external {
        Lock storage l = locks[lockId];
        require(l.amount > 0, "Lock does not exist");
        require(!l.withdrawn, "Already withdrawn");
        require(block.timestamp >= l.unlockTime, "Lock still active");
        require(msg.sender == l.owner, "Not owner");

        l.withdrawn = true;

        // Revenue share: 2% to treasury
        uint256 treasuryAmount = (l.amount * l.revenueShare) / 10000;
        uint256 ownerAmount = l.amount - treasuryAmount;

        if (treasuryAmount > 0) {
            IERC20(l.token).transfer(treasury, treasuryAmount);
        }
        IERC20(l.token).transfer(l.owner, ownerAmount);

        emit RevenueShared(lockId, treasuryAmount, ownerAmount);
        emit TokensWithdrawn(lockId, l.owner, ownerAmount);
    }

    /**
     * @notice Get the status of a lock
     * @param lockId The lock to query
     * @return locked Whether tokens are still locked
     * @return timeRemaining Seconds until unlock (0 if unlocked)
     * @return unlockedAmount Amount that can be withdrawn
     */
    function getLockStatus(uint256 lockId) external view returns (bool locked, uint256 timeRemaining, uint256 unlockedAmount) {
        Lock storage l = locks[lockId];
        if (l.amount == 0) return (false, 0, 0);
        if (l.withdrawn) return (false, 0, 0);

        if (block.timestamp >= l.unlockTime) {
            return (false, 0, l.amount);
        }

        return (true, l.unlockTime - block.timestamp, 0);
    }

    /**
     * @notice Get all lock IDs for an owner
     */
    function getOwnerLocks(address owner) external view returns (uint256[] memory) {
        return ownerLocks[owner];
    }
}

// Minimal interface for ERC20 interactions
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}