// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BitcoinRegistry
 * @notice Track Bitcoin UTXO commitments on WayChain.
 *         Users prove control of Bitcoin UTXOs via SPV + oracle attestation.
 *         The Bitcoin never moves. This contract tracks who controls what.
 *
 *         Flow:
 *         1. User creates a Bitcoin tx with OP_RETURN "WC:{waychain_addr}"
 *         2. WayChain oracles witness the tx on Bitcoin
 *         3. SPV verifies the tx is in a Bitcoin block (6 confirmations)
 *         4. Oracles attest to the commitment on WayChain
 *         5. Registry credits the user's balance
 *
 *         Withdrawal:
 *         1. User signs a withdrawal message on WayChain
 *         2. Registry deducts the balance
 *         3. Oracles coordinate a Bitcoin tx to release the BTC
 */
contract BitcoinRegistry {
    event BitcoinCommitted(
        address indexed user,
        bytes32 indexed utxo,       // keccak256(txid ++ vout)
        uint256 amount,             // Satoshis
        uint256 timestamp
    );
    event BalanceUpdated(address indexed user, uint256 newBalance);
    event WithdrawalRequested(
        address indexed user,
        uint256 amount,
        string bitcoinAddress,
        bytes32 indexed requestId
    );

    // Minimum and maximum commitment amounts (in satoshis)
    uint256 public constant MIN_COMMIT = 10000;        // 0.0001 BTC
    uint256 public constant MAX_COMMIT = 100_000_000;  // 1 BTC

    // Minimum oracle attestations required
    uint256 public constant MIN_ATTESTATIONS = 3;

    // Reference to Bitcoin SPV verifier
    address public immutable spv;

    // Reference to Dox_Dev badge contract
    address public immutable doxDev;

    // User balances (in satoshis)
    mapping(address => uint256) public balances;

    // UTXO → user (prevents double-commit)
    mapping(bytes32 => address) public utxoOwners;

    // Total BTC committed (in satoshis)
    uint256 public totalCommitted;

    // Total BTC withdrawn (in satoshis)
    uint256 public totalWithdrawn;

    struct Attestation {
        address attester;
        bytes32 utxo;
        uint256 amount;
        uint256 blockNumber;
        bool used;
    }

    // Track attestations by UTXO
    mapping(bytes32 => Attestation[]) public attestations;

    modifier onlyVerified() {
        require(doxDev != address(0), "Dox_Dev not set");
        (bool success, bytes memory data) = doxDev.staticcall(
            abi.encodeWithSignature("getLevel(address)", msg.sender)
        );
        require(success && abi.decode(data, (uint8)) >= 2, "Dox_Dev Level 2+ required");
        _;
    }

    modifier onlyOracle() {
        require(doxDev != address(0), "Dox_Dev not set");
        (bool success, bytes memory data) = doxDev.staticcall(
            abi.encodeWithSignature("getLevel(address)", msg.sender)
        );
        require(success && abi.decode(data, (uint8)) >= 1, "Not an oracle");
        _;
    }

    constructor(address _spv, address _doxDev) {
        require(_spv != address(0), "Invalid SPV");
        require(_doxDev != address(0), "Invalid Dox_Dev");
        spv = _spv;
        doxDev = _doxDev;
    }

    /**
     * @notice Attest that a Bitcoin UTXO is committed to a WayChain address.
     *         Called by Dox_Dev-verified oracles after witnessing the Bitcoin tx.
     * @param utxo keccak256(txid ++ vout) — identifies the UTXO
     * @param amount Amount in satoshis
     * @param targetAddress The WayChain address the UTXO is committed to
     * @param bitcoinTxId Bitcoin transaction ID (for verification)
     * @param merkleProof Merkle proof showing tx is in a Bitcoin block
     * @param blockHash Bitcoin block hash containing the tx
     * @param txIndex Transaction index within the block
     */
    function attestCommitment(
        bytes32 utxo,
        uint256 amount,
        address targetAddress,
        bytes32 bitcoinTxId,
        bytes32[] calldata merkleProof,
        bytes32 blockHash,
        uint256 txIndex
    ) external onlyOracle {
        require(amount >= MIN_COMMIT, "Below minimum");
        require(amount <= MAX_COMMIT, "Above maximum");
        require(targetAddress != address(0), "Invalid target");
        require(utxoOwners[utxo] == address(0), "UTXO already committed");
        require(utxo != bytes32(0), "Invalid UTXO");

        // Verify the Bitcoin tx via SPV
        (bool spvSuccess,) = spv.staticcall(
            abi.encodeWithSignature(
                "verifyTransaction(bytes32,bytes32[],bytes32,uint256)",
                bitcoinTxId, merkleProof, blockHash, txIndex
            )
        );
        require(spvSuccess, "SPV verification failed");

        // Record attestation
        attestations[utxo].push(Attestation({
            attester: msg.sender,
            utxo: utxo,
            amount: amount,
            blockNumber: block.number,
            used: false
        }));

        // Check if we have enough attestations
        if (attestations[utxo].length >= MIN_ATTESTATIONS) {
            // Mark all attestations as used
            for (uint256 i = 0; i < attestations[utxo].length; i++) {
                attestations[utxo][i].used = true;
            }

            // Credit the user
            utxoOwners[utxo] = targetAddress;
            balances[targetAddress] += amount;
            totalCommitted += amount;

            emit BitcoinCommitted(targetAddress, utxo, amount, block.timestamp);
            emit BalanceUpdated(targetAddress, balances[targetAddress]);
        }
    }

    /**
     * @notice Request withdrawal of committed BTC to a Bitcoin address.
     *         User signs this on WayChain. Oracles execute the Bitcoin tx.
     * @param amount Amount in satoshis to withdraw
     * @param bitcoinAddress Bitcoin address to send to
     */
    function requestWithdrawal(uint256 amount, string calldata bitcoinAddress) external {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(bytes(bitcoinAddress).length > 0, "Invalid address");

        balances[msg.sender] -= amount;
        totalWithdrawn += amount;

        bytes32 requestId = keccak256(abi.encodePacked(msg.sender, amount, bitcoinAddress, block.timestamp));

        emit BalanceUpdated(msg.sender, balances[msg.sender]);
        emit WithdrawalRequested(msg.sender, amount, bitcoinAddress, requestId);
    }

    /**
     * @notice Get the attestation count for a UTXO
     */
    function getAttestationCount(bytes32 utxo) external view returns (uint256) {
        return attestations[utxo].length;
    }

    /**
     * @notice Get user balance in satoshis
     */
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    /**
     * @notice Get total BTC committed (in satoshis)
     */
    function getTotalCommitted() external view returns (uint256) {
        return totalCommitted;
    }
}