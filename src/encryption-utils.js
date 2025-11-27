const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Workstream A.1: Field-Level Encryption (The "Vault" Pattern)
 * 
 * This module implements asymmetric encryption (RSA-4096) to create a "blind API":
 * - The Introducer Bank encrypts PII using the Protocol Administrator's Public Key
 * - The API stores the encrypted blob without decryption capability
 * - Only the offline "Registry Module" holds the Private Key for regulatory reporting
 * 
 * Legal Benefit: The API server cannot be a "Data Controller" under privacy regulations
 * since it cannot access the plaintext PII.
 */

/**
 * Generate RSA-4096 key pair for encryption vault
 * @returns {Object} { publicKey: string, privateKey: string }
 */
function generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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

    return { publicKey, privateKey };
}

/**
 * Save key pair to designated locations
 * @param {string} publicKey - PEM-encoded public key
 * @param {string} privateKey - PEM-encoded private key
 * @param {string} outputDir - Directory to save keys
 */
function saveKeyPair(publicKey, privateKey, outputDir = './certs') {
    // Public Key Ceremony: Output to STDOUT for Administrator to copy into API Config
    console.log('\n=== PUBLIC KEY CEREMONY ===');
    console.log('Copy the following Public Key into your API Configuration (Redis/DB):');
    console.log('---------------------------------------------------------------');
    console.log(publicKey);
    console.log('---------------------------------------------------------------\n');

    // Private Key Ceremony: Secure Storage
    // CRITICAL: NEVER write Private Key to web server disk in production.
    // We simulate sending it to an HSM or Encrypted Volume.

    const secureVolume = process.env.SECURE_VOLUME_PATH || './secure_vault';

    if (!fs.existsSync(secureVolume)) {
        fs.mkdirSync(secureVolume, { recursive: true, mode: 0o700 });
    }

    const privateKeyPath = path.join(secureVolume, 'encryption-private.pem');
    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });

    console.log(`[SECURE STORAGE] Private Key written to SECURE VOLUME: ${privateKeyPath}`);
    console.log('[SECURE STORAGE] ⚠️  Ensure this volume is unmounted after key generation!');

    // Only save Public Key to web server for validation purposes (if needed locally)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(path.join(outputDir, 'encryption-public.pem'), publicKey);
    console.log(`[PUBLIC ACCESS] Public Key also saved to: ${path.join(outputDir, 'encryption-public.pem')}`);
}

/**
 * Encrypt PII data using public key (RSA-4096-OAEP)
 * @param {Object} data - Investor identity data to encrypt
 * @param {string} publicKey - PEM-encoded public key
 * @returns {string} Base64-encoded encrypted data
 */
function encryptPII(data, publicKey) {
    const dataString = JSON.stringify(data);
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(dataString, 'utf8')
    );

    return encrypted.toString('base64');
}

/**
 * Decrypt PII data using private key (RSA-4096-OAEP)
 * NOTE: This function should ONLY be used in the offline Registry Module
 * @param {string} encryptedData - Base64-encoded encrypted data
 * @param {string} privateKey - PEM-encoded private key
 * @returns {Object} Decrypted investor identity data
 */
function decryptPII(encryptedData, privateKey) {
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(encryptedData, 'base64')
    );

    return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Validate encrypted string format without decrypting
 * Used by API server to verify format is correct before storing
 * @param {string} encrypted - Base64-encoded encrypted string
 * @returns {boolean} True if format is valid
 */
function validateEncryptedFormat(encrypted) {
    if (!encrypted || typeof encrypted !== 'string') {
        return false;
    }

    // Base64 pattern validation
    const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
    if (!base64Pattern.test(encrypted)) {
        return false;
    }

    // RSA-4096-OAEP produces ~512 bytes of output
    // Base64 encoding increases size by ~33%, so expect ~680 characters minimum
    const decodedLength = Buffer.from(encrypted, 'base64').length;
    if (decodedLength < 400 || decodedLength > 600) {
        return false; // Unexpected size for RSA-4096
    }

    return true;
}

/**
 * Workstream A.2: Encrypted TIN Handling
 * Encrypt TIN separately for FATCA/CRS reporting compliance
 * @param {string} tin - Tax Identification Number (plaintext)
 * @param {string} publicKey - PEM-encoded public key
 * @returns {string} Base64-encoded encrypted TIN
 */
function encryptTIN(tin, publicKey) {
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(tin, 'utf8')
    );

    return encrypted.toString('base64');
}

/**
 * Decrypt TIN for regulatory reporting (offline Registry Module only)
 * @param {string} encryptedTIN - Base64-encoded encrypted TIN
 * @param {string} privateKey - PEM-encoded private key
 * @returns {string} Plaintext TIN
 */
function decryptTIN(encryptedTIN, privateKey) {
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(encryptedTIN, 'base64')
    );

    return decrypted.toString('utf8');
}

/**
 * Load public key from file system
 * @param {string} keyPath - Path to public key file
 * @returns {string} PEM-encoded public key
 */
function loadPublicKey(keyPath = './certs/encryption-public.pem') {
    if (!fs.existsSync(keyPath)) {
        throw new Error(`Public key not found at ${keyPath}. Run generateKeyPair() first.`);
    }
    return fs.readFileSync(keyPath, 'utf8');
}

/**
 * Load private key from file system (Registry Module only)
 * @param {string} keyPath - Path to private key file
 * @returns {string} PEM-encoded private key
 */
function loadPrivateKey(keyPath = './certs/encryption-private.pem') {
    if (!fs.existsSync(keyPath)) {
        throw new Error(`Private key not found at ${keyPath}. This key should be in the offline Registry Module.`);
    }
    return fs.readFileSync(keyPath, 'utf8');
}

module.exports = {
    generateKeyPair,
    saveKeyPair,
    encryptPII,
    decryptPII,
    encryptTIN,
    decryptTIN,
    validateEncryptedFormat,
    loadPublicKey,
    loadPrivateKey
};
