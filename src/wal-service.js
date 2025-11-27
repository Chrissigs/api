const fs = require('fs');
const path = require('path');

/**
 * Write-Ahead Log (WAL) Service
 * 
 * Ensures durability by writing events to disk before processing.
 * Format: JSONL (Newline Delimited JSON)
 */

const WAL_FILE = path.join(__dirname, '../data/wal.log');
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

class WALService {
    constructor() {
        this.walPath = WAL_FILE;
    }

    /**
     * Write an event to the WAL.
     * @param {object} event - Event data to persist
     * @returns {Promise<boolean>}
     */
    async write(event) {
        return new Promise((resolve, reject) => {
            const entry = JSON.stringify({ timestamp: Date.now(), ...event }) + '\n';
            fs.appendFile(this.walPath, entry, (err) => {
                if (err) {
                    console.error('[WAL] CRITICAL: Failed to write to WAL:', err);
                    reject(err);
                } else {
                    // fs.sync() or equivalent could be used for strict durability, 
                    // but appendFile is usually sufficient for this prototype.
                    resolve(true);
                }
            });
        });
    }

    /**
     * Replay the WAL to recover pending events.
     * In a real system, we would mark events as "processed" to avoid re-processing completed ones.
     * For this prototype, we'll just read the log.
     */
    replay() {
        if (!fs.existsSync(this.walPath)) return [];

        try {
            const data = fs.readFileSync(this.walPath, 'utf8');
            const lines = data.split('\n').filter(line => line.trim());

            const events = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            }).filter(e => e !== null);

            console.log(`[WAL] Replayed ${events.length} events from log.`);
            return events;
        } catch (err) {
            console.error('[WAL] Error replaying log:', err);
            return [];
        }
    }

    /**
     * Clear the WAL (Checkpointing)
     * In production, you'd archive old logs instead of deleting.
     */
    checkpoint() {
        // For prototype simplicity, we might not implement full checkpointing logic yet,
        // but this method would truncate the file after successful processing.
        // fs.truncateSync(this.walPath, 0);
    }
}

module.exports = new WALService();
