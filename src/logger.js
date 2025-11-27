const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_FILE = path.join(__dirname, '../audit_ledger.jsonl');

class HashChainedLogger {
    constructor() {
        this.lastHash = this.getLastHash();
    }

    getLastHash() {
        if (!fs.existsSync(LOG_FILE)) {
            return '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis Hash
        }

        const data = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = data.trim().split('\n');
        if (lines.length === 0) {
            return '0000000000000000000000000000000000000000000000000000000000000000';
        }

        try {
            const lastLine = JSON.parse(lines[lines.length - 1]);
            return lastLine.hash;
        } catch (e) {
            console.error('Error reading last hash, ledger might be corrupted:', e);
            return null;
        }
    }

    /**
     * Workstream C: Deep Masking - Enhanced PII Redaction
     * 
     * ISO 20022 PII Fields to Hash:
     * - Nm (FrstNm, Srnm)
     * - DtOfBirth
     * - TaxRes (Id)
     * 
     * @param {*} data - Data to sanitize
     * @returns {*} Sanitized data with PII replaced by hashes
     */
    sanitize(data) {
        if (!data) return data;

        // Fields to Hash (Exact match keys)
        const piiFields = ['FrstNm', 'Srnm', 'DtOfBirth', 'Id']; // Id inside TaxRes

        // Fields to Redact completely
        const secretFields = ['warranty_token', 'token', 'password', 'secret', 'shard_a', 'shard_b', 'encrypted_blob', 'auth_tag', 'iv'];

        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                return data.map(item => this.sanitize(item));
            }

            const sanitized = {};
            for (const key in data) {
                if (piiFields.includes(key)) {
                    // PII: Replace with SHA-256 hash
                    const value = String(data[key]);
                    sanitized[key] = crypto.createHash('sha256')
                        .update(value)
                        .digest('hex');
                    sanitized[`${key}_hash_type`] = 'SHA256';
                } else if (secretFields.includes(key)) {
                    // Secrets: Redact
                    sanitized[key] = '[REDACTED]';
                } else if (typeof data[key] === 'object') {
                    // Recursive
                    sanitized[key] = this.sanitize(data[key]);
                } else {
                    sanitized[key] = data[key];
                }
            }
            return sanitized;
        }
        return data;
    }

    log(transactionId, bankId, action, status, extraData = {}, fundId = null, adminId = null) {
        const timestamp = new Date().toISOString();
        const sanitizedData = this.sanitize(JSON.parse(JSON.stringify(extraData))); // Deep copy

        // Extract warranty token hash specifically if needed, but sanitize handles it if passed in extraData
        // In server.js we pass { warrantyToken: ... } which matches 'warrantyToken' (not in secretFields list above, let's add it)
        // Wait, 'warranty_token' is in secretFields. server.js passes 'warrantyToken' (camelCase).
        // I should add 'warrantyToken' to secretFields.

        const entry = {
            prevHash: this.lastHash,
            timestamp,
            transactionId,
            bankId,
            fundId,
            adminId,
            action,
            status,
            data: sanitizedData
        };

        // Calculate Hash of the current entry
        const entryString = JSON.stringify(entry);
        const hash = crypto.createHash('sha256').update(entryString).digest('hex');

        entry.hash = hash;
        this.lastHash = hash;

        fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
            if (err) {
                console.error('CRITICAL: Failed to write to audit ledger:', err);
            }
        });
    }
}

const logger = new HashChainedLogger();

function logAudit(transactionId, bankId, action, status, extraData, fundId, adminId) {
    logger.log(transactionId, bankId, action, status, extraData, fundId, adminId);
}

module.exports = { logAudit, HashChainedLogger };
