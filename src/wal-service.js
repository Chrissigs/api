/**
 * Write-Ahead Log (WAL) Service
 * 
 * DEPRECATED: Durability is now handled by PostgreSQL's internal WAL and Redis for queues.
 * This service is kept for backward compatibility but performs no file I/O.
 */

class WALService {
    constructor() {
        console.log('[WAL] Service initialized (File-based WAL deprecated).');
    }

    /**
     * Write an event to the WAL.
     * @param {object} event - Event data to persist
     * @returns {Promise<boolean>}
     */
    async write(event) {
        // No-op: Durability handled by DB/Redis
        // console.log('[WAL] Event received (skipped file write):', event.type);
        return Promise.resolve(true);
    }

    /**
     * Replay the WAL to recover pending events.
     */
    replay() {
        console.log('[WAL] Replay skipped (File-based WAL deprecated).');
        return [];
    }

    /**
     * Clear the WAL (Checkpointing)
     */
    checkpoint() {
        // No-op
    }
}

module.exports = new WALService();
