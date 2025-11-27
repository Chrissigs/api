# Project Antigravity: Cayman Verifiable Trust Protocol

**Status**: Prototype / Reference Implementation
**Standards**: W3C Verifiable Credentials, ISO 20022, ISO 30107-3, RFC 3161

## Overview
Project Antigravity is a Digital Identity Network designed to meet Cayman Islands regulations (Regulation 25), eIDAS standards, and global payments interoperability (ISO 20022). It transforms the "Status Token" into a W3C Verifiable Credential (JSON-LD) secured by a Split-Key "Sharded Vault".

## Architecture Modules

### 1. Credential Engine (W3C VC)
- **Format**: JSON-LD Verifiable Credentials (W3C VC Data Model v2.0).
- **Signing**: JWS (JSON Web Signature) using `jsonwebtoken`.
- **Schema**: `credential-schema.jsonld` maps `Nm` and `PstlAdr` to ISO 20022.

### 2. Sharded Vault 2.0
- **Encryption**: AES-256-GCM Split-Key (Governance Shard + Control Shard).
- **Compliance**: RFC 3161 Timestamping and ISO 30107-3 Liveness metadata.
- **Privacy**: PII is encrypted at rest; the API never holds the decryption key.

### 3. Reliance Monitor (Risk Engine)
- **Active Testing**: Automated "Spot Checks" (ReconstructRequest) to ensure the Bank maintains control of Shard B.
- **Revocation**: Instant invalidation via Redis-backed revocation registry.

### 4. Interoperability Bridge
- **OIDC**: `.well-known/openid-configuration` discovery endpoint.
- **Token Exchange**: RFC 8693 compliant endpoint to swap Bank Credentials for Fund Subscription Tokens.

## Setup & Installation

1.  **Prerequisites**: Node.js v16+, Redis (optional, for revocation).
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Generate Keys** (for demo purposes):
    ```bash
    # Keys are automatically generated if not found in ./certs
    ```

## Usage

### Start the Server (Interoperability Bridge)
```bash
node src/updated-server.js
```
*Runs on port 3000 by default.*

### Run the Reliance Monitor
```bash
node src/reliance-monitor.js
```
*Simulates a monthly audit cycle.*

### Verify the Upgrade
```bash
node scripts/verify_upgrade.js
```
*Runs a comprehensive test suite for all modules.*

## Configuration
- `WEBHOOK_SECRET`: Shared secret for admin notifications (default provided for demo).
- `API_AUTH_TOKEN`: Bearer token for API access (default provided for demo).
- `BANK_NODE_URL`: URL of the Bank Node for spot checks.

## Disclaimer
This is a reference implementation for architectural demonstration purposes. It uses mock cryptographic keys and simulated external services. Do not use in production without replacing the key management and security layers with HSM-backed solutions.
