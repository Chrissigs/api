const fs = require('fs');
const path = require('path');

/**
 * Registry Database (Lightweight)
 * 
 * In production, this would be a PostgreSQL database.
 * For this prototype/pilot, we use a JSON file to ensure portability and zero-dependency setup.
 * 
 * Schema:
 * - deeds: Array of Deed objects
 *   - id: string (Contract ID)
 *   - bank_id: string
 *   - status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'
 *   - expiry_date: string (ISO Date)
 *   - created_at: string (ISO Date)
 */

const DB_FILE = path.join(__dirname, '../data/registry_db.json');
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        deeds: [
            {
                id: 'DEED-2025-001',
                bank_id: 'BANK_CAYMAN_01',
                status: 'ACTIVE',
                expiry_date: '2026-12-31T23:59:59Z',
                created_at: new Date().toISOString()
            }
        ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

class RegistryDB {
    constructor() {
        this.dbPath = DB_FILE;
    }

    _readDB() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('[REGISTRY DB] Error reading DB:', err);
            return { deeds: [] };
        }
    }

    _writeDB(data) {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
            return true;
        } catch (err) {
            console.error('[REGISTRY DB] Error writing DB:', err);
            return false;
        }
    }

    /**
     * Check the status of a Deed of Reliance for a given Bank.
     * @param {string} bankId 
     * @returns {object} { valid: boolean, status: string, deed: object }
     */
    checkDeedStatus(bankId) {
        const db = this._readDB();
        const deed = db.deeds.find(d => d.bank_id === bankId);

        if (!deed) {
            return { valid: false, status: 'NOT_FOUND', reason: 'No Deed of Reliance on file' };
        }

        if (deed.status !== 'ACTIVE') {
            return { valid: false, status: deed.status, reason: `Deed is ${deed.status}` };
        }

        const now = new Date();
        const expiry = new Date(deed.expiry_date);
        if (now > expiry) {
            // Auto-expire if past date
            deed.status = 'EXPIRED';
            this._writeDB(db);
            return { valid: false, status: 'EXPIRED', reason: 'Deed has expired' };
        }

        return { valid: true, status: 'ACTIVE', deed };
    }

    /**
     * Register or Update a Deed
     */
    registerDeed(bankId, contractId, expiryDate) {
        const db = this._readDB();
        const existingIndex = db.deeds.findIndex(d => d.bank_id === bankId);

        const newDeed = {
            id: contractId,
            bank_id: bankId,
            status: 'ACTIVE',
            expiry_date: expiryDate,
            created_at: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            db.deeds[existingIndex] = newDeed;
        } else {
            db.deeds.push(newDeed);
        }

        this._writeDB(db);
        console.log(`[REGISTRY DB] Deed registered for ${bankId} (Contract: ${contractId})`);
    }
}

module.exports = new RegistryDB();
