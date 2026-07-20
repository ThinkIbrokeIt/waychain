// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Deploy with EIP-155 signature verification
// Creator signs payload off-web, script verifies on-chain

interface ISignatureDeployer {
    function deployWithSig(bytes memory payload, uint8 v, bytes32 r, bytes32 s) external;
}

contract DeployWithSignature {
    function verifySignature(address signer, string memory payload, uint8 v, bytes32 r, bytes32 s) 
        public view returns (bool) {
        bytes32 digest = keccak256(abi.encodePacked(payload));
        address recovered = ecrecover(digest, v, r, s);
        return recovered == signer;
    }
}
