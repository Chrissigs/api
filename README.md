# Project Passport API

A secure, multi-tenant investor onboarding platform with real-time Fund Administrator synchronization.

## Features

- **ISO 20022 Compliance**: SEPA-ready identity schema
- **CRS Tax Support**: Multi-jurisdiction tax residency handling
- **Operational Resilience**: Grace period logic with heartbeat monitoring
- **Distributed Revocation List**: Redis-backed multi-office token revocation
- **Blind Audit Trail**: Cryptographic hash-chained audit logs
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
export ADMIN_WEBHOOK_URL="http://localhost:4000/v1/walkers-ingest"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
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

### Complete System Test

```bash
# Windows
integration_test.bat

# Or run individual tests
node scripts/test_iso20022_payload.js
node scripts/test_webhook.js
node scripts/verify_audit_trail.js
```

### Module 3 Webhook Test

```bash
# Windows
test_module3.bat

# Manual
node scripts/test_webhook.js
```

## API Endpoints

### POST /v1/onboard

Onboard a verified investor.

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "header": {
    "timestamp": "2025-11-22T20:00:00Z",
    "bank_id": "CNB-KY-001",
    "transaction_id": "TXN-123"
  },
  "investor_identity": {
    "legal_name": "John Doe",
    "Nm": { "FrstNm": "John", "Srnm": "Doe" },
    "tax_residency": [
      { "country": "KY", "tin": "HASHED_TIN" }
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

### POST /v1/revoke

Revoke a warranty token.

### GET /v1/retrieve-evidence

Retrieve evidence for compliance review.

## Architecture

```
Bank → WPS → Verify → Log → Notify Admin → Response
              ↓              ↓
           Redis DRL    Fund Administrator
```

## Security

- **mTLS 1.3**: Mutual TLS authentication
- **JWT Signatures**: RS256 warranty tokens
- **HMAC Webhooks**: SHA-256 signed admin notifications
- **Zero-Knowledge Audit**: Cryptographic proof without exposing PII

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

## Documentation

See [walkthrough.md](walkthrough.md) in the artifacts directory for complete system documentation.

## License

Proprietary - Walkers Protocol System

## Support

For technical support, contact the development team.
