# Project Passport API

A secure, multi-tenant investor onboarding platform with real-time Fund Administrator synchronization.

## Features

- **Privacy Engineering**: RSA-4096 field-level encryption for PII (Zero-Knowledge Data Controller)
- **Security Architecture**: mTLS enforcement with certificate-to-identity binding
- **Key Rotation**: Seamless cryptographic key transition support
- **ISO 20022 Compliance**: SEPA-ready identity schema with XML generation
- **CRS Tax Support**: Multi-jurisdiction tax residency handling with encrypted TINs
- **Operational Resilience**: Grace period logic with heartbeat monitoring
- **Distributed Revocation List**: Redis-backed multi-office token revocation
- **Blind Audit Trail**: Cryptographic hash-chained audit logs with PII hashing
- **Webhook Admin Sync**: HMAC-signed real-time notifications to Fund Administrators

## Quick Start

### Prerequisites

- Node.js v16+
- Redis server
- OpenSSL (for certificate generation)

### Installation

```bash
# Install dependencies
npm install

# Generate certificates (if needed)
node scripts/generate_certs_node.js

# Start Redis
redis-server
```

### Configuration

Set environment variables:

```bash
export API_AUTH_TOKEN="your-secure-token"
export WEBHOOK_SECRET="shared-secret-with-admin"
export ADMIN_WEBHOOK_URL="http://localhost:4000/v1/admin-ingest"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export GRACE_PERIOD_MS="900000" # 15 minutes
```

### Certificates
This project requires mTLS certificates.
```bash
# Generate self-signed demo certificates
node scripts/generate_certs_node.js
```

### Running

```bash
# Start bank node (simulates introducer bank)
node scripts/bank_node.js

# Start main server
node src/server.js

# In another terminal, start mock admin server (for testing)
node scripts/mock_admin_server.js
```

## Testing

### Verification Suite (Phase II)

```bash
# Verify Encryption Logic
node scripts/test_encryption.js

# Verify Key Rotation
node scripts/test_key_rotation.js

# Verify Audit Trail Sanitization
node scripts/verify_audit_trail.js

# Verify ISO 20022 Generation
node scripts/test_iso20022_generation.js
```

### Complete System Test

```bash
# Windows
integration_test.bat
```

## API Endpoints

### POST /v1/onboard

Onboard a verified investor.

**Headers:**
- `Authorization: Bearer <token>`
- `X-Client-Cert-Fingerprint: <fingerprint>` (Required in Production)

**Body:**
```json
{
  "header": {
    "timestamp": "2025-11-22T20:00:00Z",
    "bank_id": "BANK-001",
    "transaction_id": "TXN-123"
  },
  "investor_identity": {
    "encrypted_identity": "BASE64_ENCRYPTED_BLOB...",
    "nationality": "US",
    "tax_residency": [
      { "country": "US", "tin": "BASE64_ENCRYPTED_TIN..." }
    ]
  },
  "compliance_warranty": {
    "kyc_status": "VERIFIED",
    "warranty_token": "JWT_TOKEN"
  }
}
```

**Response:**
```json
{
  "member_id": "MEM-2025-12345",
  "status": "VERIFIED_AND_SYNCED",
  "admin_handoff": "INITIATED"
}
```

### POST /v1/rotate-key

Initiate key rotation for a bank.

### POST /v1/revoke

Revoke a warranty token.

### GET /v1/retrieve-evidence

Retrieve evidence for compliance review.

## Architecture

```
Bank → Protocol System → Verify → Log → Notify Admin → Response
                            ↓              ↓
                         Redis DRL    Fund Administrator
```

## Security

- **Privacy**: RSA-4096 encryption (Server is blind to PII)
- **mTLS 1.3**: Mutual TLS authentication with identity binding
- **JWT Signatures**: RS256 warranty tokens
- **HMAC Webhooks**: SHA-256 signed admin notifications
- **Zero-Knowledge Audit**: PII replaced by SHA-256 hashes in logs

## Project Structure

```
project_passport/
├── src/
│   ├── server.js           # Main API server
│   ├── validator.js        # Schema validation
│   ├── logger.js           # Audit trail logger
│   ├── redis-client.js     # Redis DRL client
│   └── webhook-queue.js    # Retry queue infrastructure
├── scripts/
│   ├── bank_node.js        # Mock introducer bank
│   ├── mock_admin_server.js # Mock fund administrator
│   ├── test_webhook.js     # Webhook test client
│   └── verify_audit_trail.js # Audit verification
├── certs/                  # mTLS certificates
├── openapi.yaml           # API specification
└── package.json
```

## License

MIT License

## Support

For technical support, contact the development team.
