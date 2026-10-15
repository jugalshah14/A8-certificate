// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CertificateRegistry
/// @notice Stores a fingerprint (hash) of each issued certificate. The certificate
/// data itself stays off-chain; anyone can recompute its hash and compare.
contract CertificateRegistry {
    struct Record {
        bytes32 fingerprint;
        uint64 issuedAt;
        uint64 revokedAt;
    }

    address public owner;
    mapping(address => bool) public issuers;
    mapping(bytes32 => Record) private records;

    event IssuerSet(address indexed issuer, bool allowed);
    event CertificateIssued(bytes32 indexed id, bytes32 fingerprint);
    event CertificateRevoked(bytes32 indexed id);

    error NotIssuer();
    error NotOwner();
    error AlreadyIssued();
    error NotFound();
    error AlreadyRevoked();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyIssuer() {
        if (!issuers[msg.sender]) revert NotIssuer();
        _;
    }

    constructor() {
        owner = msg.sender;
        issuers[msg.sender] = true;
        emit IssuerSet(msg.sender, true);
    }

    function setIssuer(address issuer, bool allowed) external onlyOwner {
        issuers[issuer] = allowed;
        emit IssuerSet(issuer, allowed);
    }

    function issue(bytes32 id, bytes32 fingerprint) external onlyIssuer {
        if (records[id].issuedAt != 0) revert AlreadyIssued();
        records[id] = Record(fingerprint, uint64(block.timestamp), 0);
        emit CertificateIssued(id, fingerprint);
    }

    function revoke(bytes32 id) external onlyIssuer {
        Record storage r = records[id];
        if (r.issuedAt == 0) revert NotFound();
        if (r.revokedAt != 0) revert AlreadyRevoked();
        r.revokedAt = uint64(block.timestamp);
        emit CertificateRevoked(id);
    }

    function get(bytes32 id) external view returns (bytes32 fingerprint, uint64 issuedAt, uint64 revokedAt) {
        Record memory r = records[id];
        return (r.fingerprint, r.issuedAt, r.revokedAt);
    }
}
