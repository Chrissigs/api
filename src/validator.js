const { Validator } = require('jsonschema');
const validator = new Validator();
const jwt = require('jsonwebtoken');

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

const investorIdentitySchema = {
  id: '/InvestorIdentity',
  type: 'object',
  properties: {
    legal_name: { type: 'string' },
    Nm: {
      type: 'object',
      properties: {
        FrstNm: { type: 'string' },
        Srnm: { type: 'string' }
      }
    },
    PstlAdr: {
      type: 'object',
      properties: {
        StrtNm: { type: 'string' },
        TwnNm: { type: 'string' },
        Ctry: { type: 'string', pattern: /^[A-Z]{2}$/ },
        PstCd: { type: 'string' }
      }
    },
    date_of_birth: { type: 'string', format: 'date' },
    nationality: { type: 'string' },
    tax_residency: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          country: { type: 'string', pattern: /^[A-Z]{2}$/ },
          tin: { type: 'string', pattern: /^[a-f0-9]{64}$/ }
        },
        required: ['country', 'tin']
      },
      minItems: 1
    }
  },
  required: ['legal_name', 'date_of_birth', 'nationality', 'tax_residency']
};

const complianceWarrantySchema = {
  id: '/ComplianceWarranty',
  type: 'object',
  properties: {
    kyc_status: { type: 'string', enum: ['VERIFIED', 'PENDING', 'REJECTED'] },
    screening_status: { type: 'string' },
    warranty_token: { type: 'string' }
  },
  required: ['kyc_status', 'screening_status', 'warranty_token']
};

const onboardRequestSchema = {
  id: '/OnboardRequest',
  type: 'object',
  properties: {
    header: { $ref: '/Header' },
    investor_identity: { $ref: '/InvestorIdentity' },
    compliance_warranty: { $ref: '/ComplianceWarranty' }
  },
  required: ['header', 'investor_identity', 'compliance_warranty']
};

validator.addSchema(headerSchema, '/Header');
validator.addSchema(investorIdentitySchema, '/InvestorIdentity');
validator.addSchema(complianceWarrantySchema, '/ComplianceWarranty');

function validatePayload(payload, publicKey) {
  const validationResult = validator.validate(payload, onboardRequestSchema);

  if (!validationResult.valid) {
    return { valid: false, errors: validationResult.errors.map(e => e.stack) };
  }

  // Business Logic Validation
  if (payload.compliance_warranty.kyc_status !== 'VERIFIED') {
    return { valid: false, errors: ['KYC Status must be VERIFIED'] };
  }

  // Verify Signature (JWT)
  if (!publicKey) {
    console.warn('Skipping signature verification: No public key provided.');
    return { valid: true };
  }

  try {
    const token = payload.compliance_warranty.warranty_token;
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256', 'ES256'] });

    // Verify Claims Binding
    // Ensure the data in the JWT matches the data in the payload
    if (decoded.investor_identity.legal_name !== payload.investor_identity.legal_name ||
      decoded.investor_identity.date_of_birth !== payload.investor_identity.date_of_birth ||
      decoded.compliance_warranty.kyc_status !== payload.compliance_warranty.kyc_status) {
      return { valid: false, errors: ['JWT Claims do not match Payload Data'] };
    }

    // Verify Issuer
    if (decoded.iss !== payload.header.bank_id) {
      return { valid: false, errors: ['JWT Issuer mismatch'] };
    }

  } catch (err) {
    return { valid: false, errors: ['JWT Verification Failed: ' + err.message] };
  }

  return { valid: true };
}

module.exports = { validatePayload };
