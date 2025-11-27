const crypto = require('crypto');

/**
 * MODULE 1: THE "SHARDED VAULT"
 * 
 * Technical Specifications:
 * - Algorithm: AES-256-GCM
 * - Key Architecture: Split-Key (XOR)
 * - Shard A: Governance Shard (Stored by Admin)
 * - Shard B: Control Shard (Returned to Bank)
 */

/**
 * Generates a random 32-byte key (AES-256)
 */
function generateKey() {
    return crypto.randomBytes(32);
}

/**
 * Splits a 32-byte key into two shards using XOR
 * @param {Buffer} masterKey - The 32-byte DEK
 * @returns {Object} { shardA: Buffer, shardB: Buffer }
 */
function splitKey(masterKey) {
    const shardA = crypto.randomBytes(32);
    const shardB = Buffer.alloc(32);

    for (let i = 0; i < 32; i++) {
        shardB[i] = masterKey[i] ^ shardA[i];
    }

    return { shardA, shardB };
}

/**
 * Reconstructs the master key from two shards using XOR
 * @param {Buffer|string} shardA - Governance Shard (Buffer or Hex string)
 * @param {Buffer|string} shardB - Control Shard (Buffer or Hex string)
 * @returns {Buffer} The reconstructed 32-byte DEK
 */
function combineKeys(shardA, shardB) {
    const bufA = Buffer.isBuffer(shardA) ? shardA : Buffer.from(shardA, 'hex');
    const bufB = Buffer.isBuffer(shardB) ? shardB : Buffer.from(shardB, 'hex');

    if (bufA.length !== 32 || bufB.length !== 32) {
        throw new Error('Invalid shard length. Must be 32 bytes.');
    }

    const masterKey = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
        masterKey[i] = bufA[i] ^ bufB[i];
    }

    return masterKey;
}

/**
 * Encrypts data using AES-256-GCM and splits the key
 * @param {Object} data - The JSON data to encrypt
 * @returns {Object} { encryptedBlob: string, iv: string, authTag: string, shardA: string, shardB: string }
 */
function encrypt(data) {
    const dek = generateKey();
    const iv = crypto.randomBytes(16); // 96-bit IV is standard for GCM, but 128-bit (16 bytes) is also common. Node's crypto often uses 12-16. Let's use 16 (128-bit) or 12 (96-bit). NIST recommends 96-bit (12 bytes) for efficiency, but 16 is fine. Let's stick to 16 for robust randomness unless specific GCM constraint. Actually, GCM standard is 12 bytes. Let's use 12 bytes for GCM.
    // Correction: NIST SP 800-38D recommends 12 bytes (96 bits) for IV.
    const iv96 = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv96);

    const jsonStr = JSON.stringify(data);
    let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const { shardA, shardB } = splitKey(dek);

    return {
        encryptedBlob: encrypted,
        iv: iv96.toString('hex'),
        authTag: authTag,
        shardA: shardA.toString('hex'),
        shardB: shardB.toString('hex')
    };
}

/**
 * The "Fire Drill" Function: Reconstructs and Decrypts
 * @param {string} encryptedBlob - Hex string
 * @param {string} iv - Hex string
 * @param {string} authTag - Hex string
 * @param {string} shardA - Hex string
 * @param {string} shardB - Hex string
 * @returns {Object} Decrypted JSON data
 */
function reconstruct(encryptedBlob, iv, authTag, shardA, shardB) {
    let dek;
    try {
        dek = combineKeys(shardA, shardB);

        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            dek,
            Buffer.from(iv, 'hex')
        );

        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(encryptedBlob, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    } catch (err) {
        throw new Error(`Decryption failed: ${err.message}`);
    } finally {
        // Zero out the key in memory (Best effort in JS)
        if (dek) {
            dek.fill(0);
        }
    }
}

module.exports = {
    encrypt,
    reconstruct,
    combineKeys // Exported for testing if needed
};
