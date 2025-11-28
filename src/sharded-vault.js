const crypto = require('crypto');

/**
 * ENTERPRISE SHARDED VAULT (Split-Key Architecture)
 * 
 * Security Level: Sovereign-Grade
 * Architecture:
 * - Shard A (Governance): Held by Protocol Administrator
 * - Shard B (Control): Held by Bank / Institution
 * 
 * Both shards are required to reconstruct the AES-256-GCM Key.
 */

class ShardedVault {
    constructor() {
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Encrypts data and splits the key into two shards.
     * @param {object} data - PII Data (Will be serialized)
     */
    encrypt(data) {
        // 1. Generate Master Key (Ephemeral)
        const masterKey = crypto.randomBytes(32);

        // 2. Generate Shard A (Governance)
        const shardA = crypto.randomBytes(32);

        // 3. Calculate Shard B (Control) using XOR
        // key = A ^ B  =>  B = key ^ A
        const shardB = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
            shardB[i] = masterKey[i] ^ shardA[i];
        }

        // 4. Encrypt Data
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, masterKey, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        return {
            encryptedBlob: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag,
            shardA: shardA.toString('hex'), // To Admin
            shardB: shardB.toString('hex')  // To Bank
        };
    }

    /**
     * Reconstructs key and decrypts data.
     */
    decrypt(encryptedBlob, ivHex, authTagHex, shardAHex, shardBHex) {
        const shardA = Buffer.from(shardAHex, 'hex');
        const shardB = Buffer.from(shardBHex, 'hex');
        
        // Reconstruct Master Key
        const masterKey = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
            masterKey[i] = shardA[i] ^ shardB[i];
        }

        const decipher = crypto.createDecipheriv(this.algorithm, masterKey, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedBlob, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }
}

module.exports = new ShardedVault();
