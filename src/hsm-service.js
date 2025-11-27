const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * HSM Service (Simulation)
 * 
 * In a real environment, this would be a client library for AWS CloudHSM or Azure Dedicated HSM.
 * Here, we simulate the HSM by:
 * 1. Generating/Loading keys into protected memory.
 * 2. Never exposing the Private Key via the API.
 * 3. Performing cryptographic operations "internally".
 */
class HSMService {
    constructor() {
        this.keyId = 'hsm-key-001';
        this.privateKey = null;
        this.publicKey = null;
        this.initialized = false;
    }

    /**
     * Initialize the HSM.
     * In this simulation, we will generate a new RSA-4096 key pair on startup.
     * In production, this would connect to the hardware device.
     */
    initialize() {
        console.log('[HSM] Initializing Secure Module...');

        try {
            // Generate a new key pair in memory
            // This ensures the private key never exists on disk in a readable format
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 4096,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            this.privateKey = privateKey;
            this.publicKey = publicKey;
            this.initialized = true;

            console.log('[HSM] Key Pair Generated. Key ID:', this.keyId);
            console.log('[HSM] Private Key is locked in memory.');

            // Export Public Key so the Validator can trust us
            // In a real scenario, this would be part of a CSR (Certificate Signing Request)
            const certsDir = path.join(__dirname, '../certs');
            if (!fs.existsSync(certsDir)) {
                fs.mkdirSync(certsDir);
            }
            fs.writeFileSync(path.join(certsDir, 'hsm-public-key.pem'), this.publicKey);
            console.log('[HSM] Public Key exported to certs/hsm-public-key.pem');

        } catch (err) {
            console.error('[HSM] CRITICAL FAILURE: Could not generate keys', err);
            throw err;
        }
    }

    /**
     * Sign a payload using the internal Private Key.
     * @param {string|object} payload - Data to sign
     * @returns {string} - JWT or Signature
     */
    signJWT(payload, options = {}) {
        if (!this.initialized) {
            throw new Error('[HSM] Module not initialized');
        }

        console.log('[HSM] Signing operation requested...');

        const jwt = require('jsonwebtoken');

        // We use the internal private key to sign
        // The key is passed directly from memory, not read from a file per request
        const token = jwt.sign(payload, this.privateKey, {
            algorithm: 'RS256',
            ...options
        });

        console.log('[HSM] Payload signed successfully.');
        return token;
    }

    /**
     * Get the Public Key (for verification)
     */
    getPublicKey() {
        if (!this.initialized) {
            throw new Error('[HSM] Module not initialized');
        }
        return this.publicKey;
    }
}

// Singleton instance
const hsm = new HSMService();
module.exports = hsm;
