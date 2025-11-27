const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load keys (using existing certs or generating temporary ones for demo)
// In production, these would be from a secure key management system
const PRIVATE_KEY_PATH = path.join(__dirname, '../certs/server-key.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../certs/server-cert.pem');

let PRIVATE_KEY;
let PUBLIC_KEY;

try {
    if (fs.existsSync(PRIVATE_KEY_PATH)) {
        PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
        PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    } else {
        console.warn('[VC-SERVICE] Warning: Keys not found. Generating temporary keys for demonstration.');
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        PRIVATE_KEY = privateKey;
        PUBLIC_KEY = publicKey;
    }
} catch (err) {
    console.error('[VC-SERVICE] Error loading keys:', err);
}

const CONTEXT = [
    "https://www.w3.org/2018/credentials/v1",
    "https://cayman-standards.gov.ky/credentials/v1"
];

/**
 * Issues a Verifiable Credential (JWS format)
 * @param {string} subjectDid - The DID of the subject (investor)
 * @param {Object} claims - The claims about the subject (Nm, KycStatus, etc.)
 * @param {string} issuerDid - The DID of the issuer (Bank)
 * @returns {string} The signed VC (JWT)
 */
function issueCredential(subjectDid, claims, issuerDid = 'did:web:example-bank.com') {
    const credential = {
        "@context": CONTEXT,
        "type": ["VerifiableCredential", "CaymanInvestorCredential"],
        "issuer": issuerDid,
        "issuanceDate": new Date().toISOString(),
        "credentialSubject": {
            "id": subjectDid,
            ...claims
        }
    };

    // Sign as JWS (JWT)
    // Using RS256 for compatibility with existing RSA keys, but Ed25519 is preferred for new setups
    const token = jwt.sign({ vc: credential }, PRIVATE_KEY, {
        algorithm: 'RS256',
        issuer: issuerDid,
        subject: subjectDid,
        expiresIn: '1y' // Credentials valid for 1 year by default
    });

    return token;
}

/**
 * Verifies a Verifiable Credential (JWS format)
 * @param {string} token - The signed VC (JWT)
 * @returns {Object} Verification result { valid: boolean, payload: Object, error: string }
 */
function verifyCredential(token) {
    try {
        const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });

        // Check for required VC fields
        if (!decoded.vc || !decoded.vc['@context'] || !decoded.vc.type) {
            return { valid: false, error: 'Invalid VC structure: Missing @context or type' };
        }

        return { valid: true, payload: decoded.vc };
    } catch (err) {
        return { valid: false, error: err.message };
    }
}

module.exports = {
    issueCredential,
    verifyCredential
};
