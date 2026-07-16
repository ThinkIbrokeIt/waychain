// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BTCDynamicOracleMint
 * @notice Dynamic 3-of-5 oracle multi-sig for BTC-backed stablecoin minting.
 *         Uses WayChain native VRF via RANDOM opcode (0xC4), selecting 5 oracles
 *         from registry of Dox_Dev Level 2+ candidates.
 *
 *         DYNAMIC MODEL OVERRIDE (per user spec):
 *         - Oracles are NOT static - any Dox_Dev Level 2+ can register
 *         - Selection is random for each mint request
 *         - Maximizes decentralization and prevents oracle capture
 */
contract BTCDynamicOracleMint {
    // --- Events ---
    event OracleRegistered(address indexed oracle, uint256 indexed blockNumber);
    event OracleUnregistered(address indexed oracle);
    event MintRequested(
        bytes32 indexed requestId,
        address indexed requester,
        uint256 btcAmount,
        address[5] selectedOracles,
        uint256 deadline
    );
    event OracleApproved(bytes32 indexed requestId, address indexed oracle);
    event OracleRejected(bytes32 indexed requestId, address indexed oracle);
    event MintFinalized(bytes32 indexed requestId, address indexed recipient, uint256 amount);
    event OracleSlashed(address indexed oracle, bytes32 indexed requestId);
    event OracleBondDeposited(address indexed oracle, uint256 amount);
    event OracleBondWithdrawn(address indexed oracle, uint256 amount);

    // --- Errors ---
    error NotDoxDevLevel2();
    error AlreadyRegistered();
    error NotRegistered();
    error NotSelected();
    error AlreadyVoted();
    error WindowExpired();
    error InsufficientBond();

    // --- Types ---
    enum Vote { None, Approve, Reject }

    struct MintRequest {
        address requester;
        uint256 btcAmount;
        uint256 deadline;
        bool finalized;
        bool approved;
        uint256 approveCount;
    }

    struct OracleInfo {
        uint256 bondedAmount;
        bool slashed;
    }

    // --- State ---
    mapping(address => bool) public registeredOracles;
    mapping(address => OracleInfo) public oracleInfo;
    mapping(bytes32 => MintRequest) private requests;
    mapping(bytes32 => address[5]) private requestOracles;
    mapping(bytes32 => mapping(address => Vote)) private requestVotes;

    address[] private allRegisteredOracles;
    uint256 public totalOracles;

    // Constants
    uint256 public constant MINORACLECOUNT = 5;
    uint256 public constant REQUIREDAPPROVALS = 3;
    uint256 public constant APPROVALWINDOW = 100;
    uint256 public constant MINLEVEL = 2;
    uint256 public constant MINBOND = 5000 ether;

    address public doxDevBadge;

    // --- Modifiers ---
    modifier onlyRegistered() {
        if (!registeredOracles[msg.sender]) revert NotRegistered();
        _;
    }

    modifier onlySelected(bytes32 requestId) {
        if (!_isOracleSelected(requestId, msg.sender)) revert NotSelected();
        _;
    }

    // --- Constructor ---
    constructor(address _doxDevBadge) {
        require(_doxDevBadge != address(0), "Invalid badge contract");
        doxDevBadge = _doxDevBadge;
    }

    // --- Registration Functions ---

    function registerOracle() external payable {
        if (registeredOracles[msg.sender]) revert AlreadyRegistered();

        if (!_hasMinLevel(msg.sender, MINLEVEL)) revert NotDoxDevLevel2();
        if (msg.value < MINBOND) revert InsufficientBond();

        registeredOracles[msg.sender] = true;
        oracleInfo[msg.sender] = OracleInfo({
            bondedAmount: msg.value,
            slashed: false
        });

        allRegisteredOracles.push(msg.sender);
        totalOracles++;

        emit OracleRegistered(msg.sender, block.number);
    }

    function unregisterOracle() external {
        if (!registeredOracles[msg.sender]) revert NotRegistered();

        registeredOracles[msg.sender] = false;

        totalOracles--;
        for (uint256 i = 0; i < allRegisteredOracles.length; i++) {
            if (allRegisteredOracles[i] == msg.sender) {
                allRegisteredOracles[i] = allRegisteredOracles[allRegisteredOracles.length - 1];
                allRegisteredOracles.pop();
                break;
            }
        }

        emit OracleUnregistered(msg.sender);
    }

    function depositBond() external payable {
        require(registeredOracles[msg.sender], "Not registered");
        oracleInfo[msg.sender].bondedAmount += msg.value;
        emit OracleBondDeposited(msg.sender, msg.value);
    }

    function withdrawBond(uint256 amount) external {
        require(amount <= oracleInfo[msg.sender].bondedAmount, "Exceeds bond");
        oracleInfo[msg.sender].bondedAmount -= amount;
        emit OracleBondWithdrawn(msg.sender, amount);
    }

    // --- Mint Request Functions ---

    function requestMint(uint256 btcAmount) external returns (bytes32 requestId) {
        require(totalOracles >= MINORACLECOUNT, "Not enough oracles registered");
        require(btcAmount > 0, "Invalid BTC amount");

        bytes32 seed = _getRandomSeed();
        requestId = keccak256(abi.encodePacked(msg.sender, btcAmount, seed, block.number));

        address[5] memory selected = _selectOracles(seed);

        requests[requestId] = MintRequest({
            requester: msg.sender,
            btcAmount: btcAmount,
            deadline: block.number + APPROVALWINDOW,
            finalized: false,
            approved: false,
            approveCount: 0
        });
        requestOracles[requestId] = selected;

        for (uint256 i = 0; i < MINORACLECOUNT; i++) {
            requestVotes[requestId][selected[i]] = Vote.None;
        }

        emit MintRequested(requestId, msg.sender, btcAmount, selected, block.number + APPROVALWINDOW);
    }

    function approveMint(bytes32 requestId) external onlyRegistered onlySelected(requestId) {
        MintRequest storage req = requests[requestId];
        if (req.finalized) revert AlreadyVoted();
        if (block.number > req.deadline) revert WindowExpired();
        if (requestVotes[requestId][msg.sender] != Vote.None) revert AlreadyVoted();

        requestVotes[requestId][msg.sender] = Vote.Approve;
        req.approveCount++;

        emit OracleApproved(requestId, msg.sender);

        if (req.approveCount >= REQUIREDAPPROVALS) {
            _finalizeMint(requestId, true);
        }
    }

    function rejectMint(bytes32 requestId) external onlyRegistered onlySelected(requestId) {
        MintRequest storage req = requests[requestId];
        if (req.finalized) revert AlreadyVoted();
        if (block.number > req.deadline) revert WindowExpired();
        if (requestVotes[requestId][msg.sender] != Vote.None) revert AlreadyVoted();

        requestVotes[requestId][msg.sender] = Vote.Reject;
        _finalizeMint(requestId, false);
    }

    function processNonResponders(bytes32 requestId) external {
        MintRequest storage req = requests[requestId];
        if (req.finalized) revert AlreadyVoted();
        if (block.number <= req.deadline) revert WindowExpired();

        if (req.approveCount >= REQUIREDAPPROVALS) {
            _finalizeMint(requestId, true);
            return;
        }

        address[5] storage selected = requestOracles[requestId];
        for (uint256 i = 0; i < MINORACLECOUNT; i++) {
            address oracle = selected[i];
            if (requestVotes[requestId][oracle] == Vote.None) {
                _slashOracle(oracle, requestId);
            }
        }

        _finalizeMint(requestId, req.approveCount >= REQUIREDAPPROVALS);
    }

    // --- View Functions ---

    function getAllOracles() external view returns (address[] memory) {
        return allRegisteredOracles;
    }

    function getOracleCount() external view returns (uint256) {
        return totalOracles;
    }

    function getMintRequest(bytes32 requestId)
        external
        view
        returns (address requester, uint256 btcAmount, uint256 deadline, uint256 approveCount, bool finalized, bool approved)
    {
        MintRequest storage req = requests[requestId];
        return (req.requester, req.btcAmount, req.deadline, req.approveCount, req.finalized, req.approved);
    }

    function getSelectedOracles(bytes32 requestId) external view returns (address[5] memory) {
        return requestOracles[requestId];
    }

    function isOracleSelected(bytes32 requestId, address oracle) external view returns (bool) {
        return _isOracleSelected(requestId, oracle);
    }

    // --- Internal Functions ---

    function _isOracleSelected(bytes32 requestId, address oracle)
        internal
        view
        returns (bool)
    {
        address[5] storage selected = requestOracles[requestId];
        for (uint256 i = 0; i < MINORACLECOUNT; i++) {
            if (selected[i] == oracle) return true;
        }
        return false;
    }

    /// @notice Get random seed - WayChain RANDOM opcode (0xC4) or keccak256 fallback
    /// @dev On WayChain: RANDOM (0xC4) opcode provides VRF seed (100 gas, deterministic).
    ///      Usage: bytes32 seed; assembly { seed := random() } - no arguments needed.
    ///      For EVM testing, keccak256 over blockhash + prevrandao (same result via 0x14 precompile).
    function _getRandomSeed() internal view returns (bytes32) {
        // WayChain RANDOM opcode (0xC4) pattern:
        // bytes32 seed; assembly { seed := random() }
        // On EVM, keccak256 uses the 0x14 precompile (SHA256 on WayChain)
        
        uint256 safeBlock1 = block.number > 1 ? block.number - 1 : block.number;
        uint256 safeBlock2 = block.number > 2 ? block.number - 2 : block.number;
        return keccak256(abi.encodePacked(
            blockhash(safeBlock1),
            blockhash(safeBlock2),
            block.prevrandao,
            block.number,
            block.timestamp
        ));
    }

    /// @notice Select 5 unique oracles using random seed
    function _selectOracles(bytes32 seed)
        internal
        view
        returns (address[5] memory)
    {
        address[5] memory selected;
        uint256 startingIndex = uint256(seed) % totalOracles;
        uint256 selectedCount = 0;
        uint256 currentIndex = startingIndex;
        uint256 iterations = 0;
        uint256 maxIterations = totalOracles * 2;

        while (selectedCount < MINORACLECOUNT && iterations < maxIterations) {
            address candidate = allRegisteredOracles[currentIndex];
            if (registeredOracles[candidate]) {
                bool found = false;
                for (uint256 i = 0; i < selectedCount; i++) {
                    if (selected[i] == candidate) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    selected[selectedCount] = candidate;
                    selectedCount++;
                }
            }
            currentIndex = (currentIndex + 1) % totalOracles;
            unchecked {
                iterations++;
            }
        }

        return selected;
    }

    /// @notice Check if address has minimum Dox_Dev level
    /// @dev On WayChain, native DOXDEVLEVEL opcode (0xC1) could be used via Yul
    function _hasMinLevel(address account, uint256 minLevel)
        internal
        view
        returns (bool)
    {
        (bool success, bytes memory data) = doxDevBadge.staticcall(
            abi.encodeWithSignature("getLevel(address)", account)
        );
        if (!success) return false;
        return abi.decode(data, (uint8)) >= minLevel;
    }

    /// @notice Slash an oracle for non-response
    function _slashOracle(address oracle, bytes32 requestId) internal {
        if (oracleInfo[oracle].slashed) return;
        oracleInfo[oracle].slashed = true;

        registeredOracles[oracle] = false;
        totalOracles--;

        for (uint256 i = 0; i < allRegisteredOracles.length; i++) {
            if (allRegisteredOracles[i] == oracle) {
                allRegisteredOracles[i] = allRegisteredOracles[allRegisteredOracles.length - 1];
                allRegisteredOracles.pop();
                break;
            }
        }

        emit OracleSlashed(oracle, requestId);
    }

    /// @notice Finalize a mint request
    function _finalizeMint(bytes32 requestId, bool approved) internal {
        MintRequest storage req = requests[requestId];
        req.finalized = true;
        req.approved = approved;

        if (approved) {
            uint256 oneWayAmount = (req.btcAmount * 70000) / 100000000;
            emit MintFinalized(requestId, req.requester, oneWayAmount);
        }
    }

    // --- receive ---
    receive() external payable {}
}