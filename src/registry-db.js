const db = require('./db');

/**
 * Registry Database (PostgreSQL)
 * 
 * Stores Deeds of Reliance and Institution data.
 */

class RegistryDB {

    /**
     * Check the status of a Deed of Reliance for a given Bank.
     * @param {string} bankId 
     * @returns {Promise<object>} { valid: boolean, status: string, deed: object }
     */
    async checkDeedStatus(bankId) {
        try {
            const res = await db.query(
                'SELECT * FROM deeds WHERE bank_id = $1 ORDER BY created_at DESC LIMIT 1',
                [bankId]
            );

            if (res.rows.length === 0) {
                return { valid: false, status: 'NOT_FOUND', reason: 'No Deed of Reliance on file' };
            }

            const deed = res.rows[0];

            if (deed.status !== 'ACTIVE') {
                return { valid: false, status: deed.status, reason: `Deed is ${deed.status}` };
            }

            const now = new Date();
            const expiry = new Date(deed.expiry_date);
            if (now > expiry) {
                // Auto-expire if past date
                await db.query('UPDATE deeds SET status = $1 WHERE transaction_id = $2', ['EXPIRED', deed.transaction_id]);
                return { valid: false, status: 'EXPIRED', reason: 'Deed has expired' };
            }

            return { valid: true, status: 'ACTIVE', deed };
        } catch (err) {
            console.error('[REGISTRY DB] Error checking deed status:', err);
            return { valid: false, status: 'ERROR', reason: 'Database error' };
        }
    }

    /**
     * Register or Update a Deed
     */
    async registerDeed(bankId, contractId, expiryDate) {
        try {
            // Insert or Update (Upsert logic if transaction_id matches, but here we assume new contractId is unique)
            // If we want to replace the active deed for the bank, we might want to invalidate old ones, but for now we just insert.

            await db.query(
                `INSERT INTO deeds (transaction_id, contract_id, bank_id, expiry_date, status)
                 VALUES ($1, $2, $3, $4, 'ACTIVE')
                 ON CONFLICT (transaction_id) DO UPDATE SET status = 'ACTIVE', expiry_date = $4`,
                [contractId, contractId, bankId, expiryDate] // Using contractId as transaction_id for now based on previous logic
            );

            console.log(`[REGISTRY DB] Deed registered for ${bankId} (Contract: ${contractId})`);
        } catch (err) {
            console.error('[REGISTRY DB] Error registering deed:', err);
        }
    }
}

module.exports = new RegistryDB();
