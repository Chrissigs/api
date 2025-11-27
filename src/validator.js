const { Validator } = require('jsonschema');
const validator = new Validator();
const jwt = require('jsonwebtoken');

// MODULE 2: THE BRIDGE - ISO 20022 SCHEMAS

const headerSchema = {
  id: '/Header',
  type: 'object',
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    bank_id: { type: 'string' },
    transaction_id: { type: 'string' }
  },
  required: ['timestamp', 'bank_id', 'transaction_id']
};

// ISO 20022: Name (Nm)
const nameSchema = {
  id: '/Nm',
  type: 'object',
  properties: {
    FrstNm: { type: 'string', minLength: 1 },
    Srnm: { type: 'string', minLength: 1 }
  },
  required: ['FrstNm', 'Srnm']
};

// ISO 20022: Postal Address (PstlAdr)
const addressSchema = {
  id: '/PstlAdr',
  type: 'object',
  properties: {
    StrtNm: { type: 'string' },
    TwnNm: { type: 'string' },
    Ctry: { type: 'string', pattern: /^[A-Z]{2}$/ } // ISO 3166-1 alpha-2
  },
  required: ['StrtNm', 'TwnNm', 'Ctry']
};

// ISO 20022: Tax Residency (TaxRes)
const taxResidencySchema = {
  id: '/TaxRes',
  type: 'array',
  items: {
    type: 'object',
    properties: {
      Ctry: { type: 'string', pattern: /^[A-Z]{2}$/ },
      // TIN is encrypted at source or will be encrypted by the vault? 
      // The prompt says "Tax Residency: Must support a multi-jurisdiction array (TaxRes) containing Ctry and encrypted TIN."
      // Assuming the client sends it already encrypted or we encrypt it. 
      // Wait, Module 1 says "Generate a transient Data Encryption Key (DEK) for every transaction."
      // This implies the SERVER does the encryption.
      // So the payload from the bank should probably be PLAINTEXT PII, which the server then encrypts?
      // "The system must allow the Administrator to verify investors instantly without permanently holding their raw PII"
      // "Endpoint: POST /v1/onboard ... Payload Schema ... Name ... Address ... Tax Residency"
      // If the server encrypts it, it holds PII for a millisecond.
      // "Zero-Knowledge Default: The Administrator must never hold the decryption key at rest."
      // This implies the server CAN see PII in memory to encrypt it, but must not store it.
      // So the input payload is likely PLAINTEXT (or encrypted with a transport key like TLS).
      // Let's assume input is Plaintext for now, as the server acts as the "Bridge".
      // Actually, looking at the previous code, it was encrypted at source.
      // But the new requirement says "Generate a transient Data Encryption Key (DEK) for every transaction... Split the DEK... Shard B Returned to Introducer Bank".
      // This strongly implies the SERVER generates the key and does the encryption.
      // So the input payload IS plaintext (protected by mTLS).
      Id: { type: 'string' } // Plaintext TIN
    },
    required: ['Ctry', 'Id']
  }
};

const investorProfileSchema = {
  id: '/InvestorProfile',
  type: 'object',
  properties: {
    Nm: { $ref: '/Nm' },
    PstlAdr: { $ref: '/PstlAdr' },
    TaxRes: { $ref: '/TaxRes' },
    DtOfBirth: { type: 'string', format: 'date' },
    Ntnlty: { type: 'string', pattern: /^[A-Z]{2}$/ }
  },
  required: ['Nm', 'PstlAdr', 'TaxRes', 'DtOfBirth', 'Ntnlty']
};

const complianceWarrantySchema = {
  id: '/ComplianceWarranty',
  type: 'object',
  properties: {
    kyc_status: { type: 'string', enum: ['VERIFIED'] },
    screening_status: { type: 'string', enum: ['CLEAR'] },
    warranty_token: { type: 'string' } // JWT
  },
  required: ['kyc_status', 'screening_status', 'warranty_token']
};

const onboardRequestSchema = {
  id: '/OnboardRequest',
  type: 'object',
  properties: {
    header: { $ref: '/Header' },
    investor_profile: { $ref: '/InvestorProfile' },
    compliance_warranty: { $ref: '/ComplianceWarranty' }
  },
  required: ['header', 'investor_profile', 'compliance_warranty']
};

validator.addSchema(headerSchema, '/Header');
validator.addSchema(nameSchema, '/Nm');
validator.addSchema(addressSchema, '/PstlAdr');
validator.addSchema(taxResidencySchema, '/TaxRes');
validator.addSchema(investorProfileSchema, '/InvestorProfile');
validator.addSchema(complianceWarrantySchema, '/ComplianceWarranty');

function validatePayload(payload) {
  const validationResult = validator.validate(payload, onboardRequestSchema);

  if (!validationResult.valid) {
    return { valid: false, errors: validationResult.errors.map(e => e.stack) };
  }

  // Verify Warranty Token (JWT)
  // We don't have the bank's public key here easily without looking it up.
  // For now, we just check structure. The server.js will handle signature verification with the key.
  // Or we can pass the key in.

  return { valid: true };
}

module.exports = { validatePayload };
