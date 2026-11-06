// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BitcoinSPV {
    event HeaderSubmitted(uint256 indexed height, bytes32 indexed blockHash, uint256 ts);
    event ReorgDetected(bytes32 indexed oldTip, bytes32 indexed newTip, uint256 depth);

    uint256 public constant CONFIRMATIONS_REQUIRED = 6;
    uint256 public constant MAX_REORG_DEPTH = 12;

    struct Header {
        bytes32 blockHash;
        bytes32 prevBlock;
        uint256 height;
        uint256 timestamp;
        uint256 target;
        bool validated;
    }

    mapping(bytes32 => Header) public headers;
    bytes32 public bestBlock;
    uint256 public bestHeight;
    bytes32 public immutable genesisHash;
    uint256 public immutable genesisHeight;

    constructor(bytes32 _genesisHash, uint256 _genesisHeight, bytes memory _genesisHeader) {
        require(_genesisHash != bytes32(0), "Invalid genesis");
        require(_genesisHeader.length == 80, "Header must be 80 bytes");

        genesisHash = _genesisHash;
        genesisHeight = _genesisHeight;

        Header memory h = _parseHeader(_genesisHeader);
        require(h.blockHash == _genesisHash, "Genesis hash mismatch");

        headers[_genesisHash] = Header({
            blockHash: _genesisHash,
            prevBlock: h.prevBlock,
            height: _genesisHeight,
            timestamp: h.timestamp,
            target: h.target,
            validated: true
        });

        bestBlock = _genesisHash;
        bestHeight = _genesisHeight;

        emit HeaderSubmitted(_genesisHeight, _genesisHash, h.timestamp);
    }

    function submitHeaders(bytes[] calldata rawHeaders) external {
        require(rawHeaders.length > 0, "No headers");
        Header memory prev = headers[bestBlock];
        require(prev.validated, "Best block not validated");

        for (uint256 i = 0; i < rawHeaders.length; i++) {
            require(rawHeaders[i].length == 80, "Invalid header length");
            Header memory h = _parseHeader(rawHeaders[i]);
            require(h.prevBlock == prev.blockHash, "Header chain broken");

            uint256 height = prev.height + 1;
            headers[h.blockHash] = Header({
                blockHash: h.blockHash,
                prevBlock: h.prevBlock,
                height: height,
                timestamp: h.timestamp,
                target: h.target,
                validated: true
            });
            prev = headers[h.blockHash];
            emit HeaderSubmitted(height, h.blockHash, h.timestamp);
        }

        bestBlock = prev.blockHash;
        bestHeight = prev.height;
    }

    function verifyTransaction(
        bytes32 txid,
        bytes32[] calldata merkleProof,
        bytes32 blockHash,
        uint256 index
    ) external view returns (bool) {
        Header storage h = headers[blockHash];
        require(h.validated, "Block not validated");
        require(bestHeight - h.height >= CONFIRMATIONS_REQUIRED, "Not enough confirmations");
        bytes32 computed = txid;
        for (uint256 i = 0; i < merkleProof.length; i++) {
            if ((index >> i) & 1 == 0) {
                computed = _doubleSha256(abi.encodePacked(computed, merkleProof[i]));
            } else {
                computed = _doubleSha256(abi.encodePacked(merkleProof[i], computed));
            }
        }
        return computed == h.blockHash;
    }

    function _doubleSha256(bytes memory data) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(sha256(data)));
    }

    function _parseHeader(bytes memory raw) internal pure returns (Header memory) {
        require(raw.length == 80, "Invalid header length");
        bytes32 prevBlock;
        bytes32 merkleRoot;
        uint256 ts;
        uint256 bitfield;

        assembly {
            let data := mload(add(raw, 32))
            prevBlock := and(data, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            merkleRoot := mload(add(raw, 68))
            ts := and(mload(add(raw, 72)), 0xFFFFFFFF)
            bitfield := and(mload(add(raw, 76)), 0xFFFFFFFF)
        }

        bytes32 blockHash = _doubleSha256(raw);
        uint256 target = _bitsToTarget(bitfield);

        return Header({
            blockHash: blockHash,
            prevBlock: prevBlock,
            height: 0,
            timestamp: ts,
            target: target,
            validated: false
        });
    }

    function _bitsToTarget(uint256 bits) internal pure returns (uint256) {
        uint256 exponent = bits >> 24;
        uint256 mantissa = bits & 0xFFFFFF;
        if (exponent <= 3) {
            return mantissa >> (8 * (3 - exponent));
        }
        return mantissa << (8 * (exponent - 3));
    }
}