// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeadMansSwitch
 * @notice The inheritance protocol. Two truth types:
 *         - Dark: released to a specific Dox_Dev-verified heir
 *         - Light: released to the public
 *
 *         The user sets a heartbeat interval. If they miss it,
 *         the switch becomes claimable. The heir (or public) can
 *         claim the decryption key and the truth survives.
 *
 *         Deployed via WayChain template registry as Class B.
 *         Dox_Dev Level 2+ required to deploy.
 *
 *         Heartbeats can be automated (validator node can heartbeat
 *         on behalf of the operator). If the validator goes down,
 *         the heartbeat stops. If the operator dies, the switch fires.
 */
contract DeadMansSwitch {
    event SwitchCreated(
        address indexed owner,
        uint256 indexed switchId,
        TruthType truthType,
        address indexed heir,
        uint256 heartbeatInterval
    );
    event Heartbeat(uint256 indexed switchId, uint256 timestamp);
    event ClaimTriggered(uint256 indexed switchId, address indexed claimer);
    event KeyReleased(uint256 indexed switchId, bytes32 keyReference);
    event SwitchCancelled(uint256 indexed switchId);

    enum TruthType { Dark, Light }
    enum SwitchState { Active, Claimable, Claimed, Cancelled }

    struct Switch {
        address owner;
        TruthType truthType;
        address heir;          // For Dark truth — the specific recipient
        uint256 heartbeatInterval; // In seconds (e.g. 30 days = 2,592,000)
        uint256 lastHeartbeat;
        SwitchState state;
        bytes32 keyReference;  // IPFS CID of the encrypted decryption key
        uint256 createdAt;
    }

    uint256 public totalSwitches;
    mapping(uint256 => Switch) public switches;
    mapping(address => uint256[]) public userSwitches;

    /// @notice Minimum heartbeat interval (1 day)
    uint256 public constant MIN_INTERVAL = 86400;
    /// @notice Maximum heartbeat interval (1 year)
    uint256 public constant MAX_INTERVAL = 31536000;

    /**
     * @notice Create a new dead man's switch
     * @param truthType Dark (0) = heir only, Light (1) = public
     * @param heir Address of designated heir (address(0) for Light)
     * @param heartbeatInterval How often owner must heartbeat (seconds)
     * @param keyReference IPFS CID or hash of the encrypted decryption key
     */
    function createSwitch(
        TruthType truthType,
        address heir,
        uint256 heartbeatInterval,
        bytes32 keyReference
    ) external returns (uint256) {
        require(heartbeatInterval >= MIN_INTERVAL, "Interval too short");
        require(heartbeatInterval <= MAX_INTERVAL, "Interval too long");
        require(keyReference != bytes32(0), "Empty key reference");

        if (truthType == TruthType.Dark) {
            require(heir != address(0), "Dark truth needs heir");
            require(heir != msg.sender, "Heir cannot be self");
        }

        uint256 switchId = ++totalSwitches;

        switches[switchId] = Switch({
            owner: msg.sender,
            truthType: truthType,
            heir: heir,
            heartbeatInterval: heartbeatInterval,
            lastHeartbeat: block.timestamp,
            state: SwitchState.Active,
            keyReference: keyReference,
            createdAt: block.timestamp
        });

        userSwitches[msg.sender].push(switchId);

        emit SwitchCreated(msg.sender, switchId, truthType, heir, heartbeatInterval);
        return switchId;
    }

    /**
     * @notice Send a heartbeat to keep the switch active
     * @param switchId The switch to heartbeat for
     */
    function heartbeat(uint256 switchId) external {
        Switch storage sw = switches[switchId];
        require(sw.state == SwitchState.Active, "Not active");
        require(msg.sender == sw.owner, "Not owner");

        sw.lastHeartbeat = block.timestamp;

        emit Heartbeat(switchId, block.timestamp);
    }

    /**
     * @notice Check if a switch is claimable (missed heartbeat)
     * @param switchId The switch to check
     * @return True if the switch can be claimed
     */
    function canClaim(uint256 switchId) public view returns (bool) {
        Switch storage sw = switches[switchId];
        if (sw.state != SwitchState.Active) return false;
        return block.timestamp > sw.lastHeartbeat + sw.heartbeatInterval;
    }

    /**
     * @notice Claim the switch — release the key
     * @param switchId The switch to claim
     */
    function claim(uint256 switchId) external {
        Switch storage sw = switches[switchId];
        require(canClaim(switchId), "Cannot claim yet");

        if (sw.truthType == TruthType.Dark) {
            require(msg.sender == sw.heir, "Only heir can claim Dark truth");
        }

        sw.state = SwitchState.Claimed;

        emit ClaimTriggered(switchId, msg.sender);
        emit KeyReleased(switchId, sw.keyReference);
    }

    /**
     * @notice Cancel a switch (owner changed their mind)
     * @param switchId The switch to cancel
     */
    function cancel(uint256 switchId) external {
        Switch storage sw = switches[switchId];
        require(sw.state == SwitchState.Active, "Not active");
        require(msg.sender == sw.owner, "Not owner");

        sw.state = SwitchState.Cancelled;

        emit SwitchCancelled(switchId);
    }

    /**
     * @notice Get all switches for a user
     * @param user The address to query
     * @return Array of switch IDs
     */
    function getSwitches(address user) external view returns (uint256[] memory) {
        return userSwitches[user];
    }

    /**
     * @notice Get the time remaining until a switch becomes claimable
     * @param switchId The switch to check
     * @return Seconds remaining (0 if already claimable or not active)
     */
    function timeUntilClaimable(uint256 switchId) external view returns (uint256) {
        Switch storage sw = switches[switchId];
        if (sw.state != SwitchState.Active) return 0;
        uint256 deadline = sw.lastHeartbeat + sw.heartbeatInterval;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }
}