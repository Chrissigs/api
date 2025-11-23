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

    sanitize(data) {
        if (!data) return data;
        const sensitiveKeys = ['legal_name', 'date_of_birth', 'warranty_token', 'token', 'password', 'secret'];

        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                return data.map(item => this.sanitize(item));
            }

            const sanitized = {};
            for (const key in data) {
                if (sensitiveKeys.includes(key)) {
                    sanitized[key] = '[REDACTED]';
                } else if (typeof data[key] === 'object') {
                    sanitized[key] = this.sanitize(data[key]);
                } else {
                    sanitized[key] = data[key];
                }
            }
            return sanitized;
        }
        return data;
    }

    log(transactionId, bankId, action, status, extraData = {}) {
        const timestamp = new Date().toISOString();
        const sanitizedData = this.sanitize(JSON.parse(JSON.stringify(extraData))); // Deep copy to avoid mutating original

        // Workstream 3: Blind Audit Trail - Cryptographic Warranty Token Hash
        // Extract warranty token if present and compute SHA-256 hash
        // This creates a "Zero-Knowledge Proof" - we can prove what the bank sent
        // without revealing the actual token or embedded investor data
        let warrantyTokenHash = null;
        if (extraData.warrantyToken) {
            warrantyTokenHash = crypto.createHash('sha256')
                .update(extraData.warrantyToken)
                .digest('hex');
            // Remove the actual token from sanitized data - only store the hash
            delete sanitizedData.warrantyToken;
        }

        const entry = {
            prevHash: this.lastHash,
            timestamp,
            transactionId,
            bankId,
            action,
            status,
            data: sanitizedData,
            warrantyTokenHash // Null for non-onboarding events
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

function logAudit(transactionId, bankId, action, status, extraData) {
    logger.log(transactionId, bankId, action, status, extraData);
}

module.exports = { logAudit };
