# Passport Project KY: Cayman Verifiable Trust Protocol

**Status**: Release Candidate (RC1)
**Standards**: W3C Verifiable Credentials, ISO 20022, ISO 30107-3, RFC 3161

## Overview
Passport Project KY is a Sovereign Digital Identity Network designed to meet Cayman Islands regulations (Regulation 25), eIDAS standards, and global payments interoperability (ISO 20022). It enables Cayman Islands financial institutions to issue W3C-compliant identity credentials backed by a Split-Key Liability Shield.

## System Architecture (The 4 Pillars)

### Module A: The Credential Authority (Issuance)
- **Standard**: W3C Verifiable Credentials Data Model v2.0.
- **Schema**: `passport-schema.jsonld` (Maps `Nm` and `PstlAdr` to ISO 20022).
- **Issuer**: `did:web:butterfield.ky` (Authorised Issuance Node).
- **Output**: JWS-signed KY-Credential.

### Module B: The Sharded Evidence Vault (Storage)
- **Encryption**: AES-256-GCM Split-Key Architecture.
- **Shard A**: Governance Shard (Stored by NRL/WPS).
- **Shard B**: Control Shard (Returned to AIN).
- **Compliance**: `liveness_standard: "ISO 30107-3"`, `timestamp_seal` (RFC 3161).

### Module C: The Reliance Monitor (Active Risk)
- **Function**: Automated "Spot Check" Bot.
- **Logic**: Samples 1% of active investors daily. Sends `ReconstructRequest` to AIN.
- **Enforcement**: Auto-revokes credential if Shard B is not returned within 60s.

### Module D: The Interoperability Gateway (Global)
- **Protocol**: OpenID Connect (OIDC) & RFC 8693 (Token Exchange).
- **Endpoints**:
    - `GET /.well-known/openid-configuration`
    - `POST /v1/token` (Exchange KY-Credential for Fund-Access-Token).

## Setup & Verification

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run the Comprehensive Check (GMP Demo)**:
    ```bash
    npm run verify-passport
    ```
    *Executes the "Clean Room", "Fire Drill", "Kill Switch", and "Passport Scan" tests.*

3.  **Start the National Reliance Ledger (NRL)**:
    ```bash
    npm start
    ```

## Disclaimer
This is a sovereign-grade reference implementation. Ensure all cryptographic keys are managed via HSM in production environments.
