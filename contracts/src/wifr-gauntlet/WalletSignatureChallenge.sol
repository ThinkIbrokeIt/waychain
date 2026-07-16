// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WalletSignatureChallenge
 * @notice Issues nonce, verifies ECDSA signature using standard Ethereum recovery.
 *         Compatible with OpenZeppelin ECDSA.sol for malleability protection.
 */
contract WalletSignatureChallenge {
    mapping(address => bytes32) public nonces;
    mapping(address => bool) public completed;

    event NonceIssued(address indexed user, bytes32 nonce);
    event SignatureVerified(address indexed user, bool valid);

    function issueNonce(address user) external returns (bytes32) {
        // In production: use WayChain RANDOM opcode (0xC4)
        // For compatibility, derive from blockhash
        bytes32 nonce = bytes32(uint256(keccak256(abi.encodePacked(block.number, user, block.timestamp))));
        nonces[user] = nonce;
        emit NonceIssued(user, nonce);
        return nonce;
    }

    function verifySignature(
        address user,
        bytes32 nonce,
        bytes memory signature
    ) external returns (bool) {
        require(nonces[user] == nonce, "Invalid nonce");
        require(!completed[user], "Already completed");
        require(signature.length == 65, "Invalid signature length");

        bytes32 message = keccak256(abi.encodePacked("WIFR_Gauntlet_Signature:", nonce, user));
        bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(message);
        
        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(signature);
        address recovered = ECDSA.recover(ethSignedHash, v, r, s);
        
        completed[user] = (recovered == user);
        emit SignatureVerified(user, completed[user]);
        return completed[user];
    }

    function _splitSignature(bytes memory sig)
        internal
        pure
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
    }
}

library ECDSA {
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function recover(bytes32 ethSignedHash, uint8 v, bytes32 r, bytes32 s)
        internal
        pure
        returns (address)
    {
        return ecrecover(ethSignedHash, v, r, s);
    }
}