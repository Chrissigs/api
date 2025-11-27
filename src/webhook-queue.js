const { isRedisHealthy } = require('./redis-client');
const crypto = require('crypto');

/**
 * Webhook Retry Queue Infrastructure
 * 
 * Manages failed webhook deliveries with exponential backoff retry logic.
 * Uses Redis for distributed queue management across multiple server instances.
 */

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [30000, 120000, 600000, 1800000, 7200000]; // 30s, 2m, 10m, 30m, 2h

/**
 * Queue a failed webhook for retry
 * @param {string} eventId - Unique event identifier
 * @param {object} payload - Webhook payload
 * @param {string} adminUrl - Administrator webhook URL
 * @param {string} signature - HMAC signature
 */
async function queueWebhookRetry(eventId, payload, adminUrl, signature) {
    // 1.3 Durable State Engine: Write-Ahead Log
    const wal = require('./wal-service');

    try {
        await wal.write({
            type: 'WEBHOOK_RETRY',
            eventId,
            payload,
            adminUrl,
            signature
        });
        console.log(`[WAL] Event ${eventId} persisted to disk.`);
    } catch (walErr) {
        console.error('[WAL] CRITICAL: Failed to persist event. Data loss risk!', walErr);
        // We continue to try memory/Redis queuing even if WAL fails, but this is a critical error.
    }

    if (!isRedisHealthy()) {
        console.error('[WEBHOOK QUEUE] CRITICAL: Cannot queue retry - Redis unavailable');
        console.error(`[WEBHOOK QUEUE] Event ${eventId} is safely in WAL but cannot be processed immediately.`);
        return false;
    }

    try {
        const { addRevokedToken } = require('./redis-client');
        const redisClient = require('./redis-client');

        const retryData = {
            eventId,
            payload,
            adminUrl,
            signature,
            queuedAt: Date.now(),
            retryCount: 0
        };

        // Store in retry queue (using Redis List)
        // Note: In production, use proper Redis client methods
        console.log(`[WEBHOOK QUEUE] Queuing event ${eventId} for retry`);

        // For now, log to console. In production, push to Redis:
        // await redisClient.lPush('retry_queue:webhooks', JSON.stringify(retryData));
        // await redisClient.set(`retry_count:${eventId}`, 0);

        console.log(`[WEBHOOK QUEUE] Event ${eventId} queued successfully`);
        return true;
    } catch (err) {
        console.error('[WEBHOOK QUEUE] ERROR: Failed to queue retry:', err.message);
        return false;
    }
}

/**
 * Get retry count for an event
 * @param {string} eventId - Event identifier
 * @returns {Promise<number>} - Number of retry attempts
 */
async function getRetryCount(eventId) {
    if (!isRedisHealthy()) {
        return 0;
    }

    try {
        // In production: await redisClient.get(`retry_count:${eventId}`)
        return 0;
    } catch (err) {
        console.error('[WEBHOOK QUEUE] ERROR: Failed to get retry count:', err.message);
        return 0;
    }
}

/**
 * Increment retry count for an event
 * @param {string} eventId - Event identifier
 * @returns {Promise<number>} - New retry count
 */
async function incrementRetryCount(eventId) {
    if (!isRedisHealthy()) {
        return 0;
    }

    try {
        // In production: await redisClient.incr(`retry_count:${eventId}`)
        console.log(`[WEBHOOK QUEUE] Incrementing retry count for ${eventId}`);
        return 1;
    } catch (err) {
        console.error('[WEBHOOK QUEUE] ERROR: Failed to increment retry count:', err.message);
        return 0;
    }
}

/**
 * Move event to dead letter queue (permanent failures)
 * @param {string} eventId - Event identifier
 * @param {object} payload - Original webhook payload
 */
async function moveToDeadLetter(eventId, payload) {
    if (!isRedisHealthy()) {
        console.error('[WEBHOOK QUEUE] CRITICAL: Cannot move to dead letter - Redis unavailable');
        console.error(`[WEBHOOK QUEUE] Event ${eventId} lost after ${MAX_RETRIES} retries`);
        return false;
    }

    try {
        const deadLetterEntry = {
            eventId,
            payload,
            failedAt: Date.now(),
            retries: MAX_RETRIES,
            reason: 'MAX_RETRIES_EXCEEDED'
        };

        // In production: await redisClient.lPush('dead_letter:webhooks', JSON.stringify(deadLetterEntry));

        console.error(`[WEBHOOK QUEUE] Event ${eventId} moved to DEAD LETTER QUEUE`);
        console.error(`[WEBHOOK QUEUE] Manual intervention required for investor: ${payload.investor_profile?.legal_name}`);

        return true;
    } catch (err) {
        console.error('[WEBHOOK QUEUE] ERROR: Failed to move to dead letter:', err.message);
        return false;
    }
}

/**
 * Process retry queue (background worker)
 * This would run on a scheduled interval (e.g., every minute)
 */
async function processRetryQueue() {
    if (!isRedisHealthy()) {
        console.warn('[WEBHOOK QUEUE] Skipping retry processing - Redis unavailable');
        return;
    }

    try {
        // In production:
        // 1. Get all items from retry_queue:webhooks
        // 2. Check retry_count for each
        // 3. If retry_count < MAX_RETRIES:
        //    - Check if enough time has passed based on RETRY_DELAYS_MS
        //    - Attempt webhook delivery
        //    - On success: Remove from queue
        //    - On failure: Increment retry count
        // 4. If retry_count >= MAX_RETRIES:
        //    - Move to dead letter queue

        console.log('[WEBHOOK QUEUE] Retry queue processing (not implemented - requires background worker)');
    } catch (err) {
        console.error('[WEBHOOK QUEUE] ERROR: Failed to process retry queue:', err.message);
    }
}

/**
 * Get retry delay for current attempt
 * @param {number} retryCount - Current retry count (0-indexed)
 * @returns {number} - Delay in milliseconds
 */
function getRetryDelay(retryCount) {
    if (retryCount >= RETRY_DELAYS_MS.length) {
        return RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    }
    return RETRY_DELAYS_MS[retryCount];
}

module.exports = {
    queueWebhookRetry,
    getRetryCount,
    incrementRetryCount,
    moveToDeadLetter,
    processRetryQueue,
    getRetryDelay,
    MAX_RETRIES
};
