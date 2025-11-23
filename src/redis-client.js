const redis = require('redis');

// Redis Configuration from Environment Variables
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Create Redis Client (Singleton)
let redisClient = null;
let isRedisAvailable = false;

async function initializeRedis() {
    try {
        redisClient = redis.createClient({
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('[REDIS] Max reconnection attempts reached. Operating without Redis.');
                        return new Error('Max reconnection attempts reached');
                    }
                    // Exponential backoff: 50ms, 100ms, 200ms, ...
                    return Math.min(retries * 50, 3000);
                }
            },
            password: REDIS_PASSWORD || undefined
        });

        redisClient.on('error', (err) => {
            console.error('[REDIS] Connection Error:', err.message);
            isRedisAvailable = false;
        });

        redisClient.on('connect', () => {
            console.log('[REDIS] Connected successfully');
            isRedisAvailable = true;
        });

        redisClient.on('ready', () => {
            console.log('[REDIS] Client ready');
            isRedisAvailable = true;
        });

        redisClient.on('reconnecting', () => {
            console.warn('[REDIS] Reconnecting...');
            isRedisAvailable = false;
        });

        await redisClient.connect();
        isRedisAvailable = true;
        console.log(`[REDIS] Initialized: ${REDIS_HOST}:${REDIS_PORT}`);
    } catch (err) {
        console.error('[REDIS] CRITICAL: Failed to initialize Redis client:', err.message);
        console.error('[REDIS] Operating in DEGRADED mode. Revocation list will be unavailable.');
        isRedisAvailable = false;
        redisClient = null;
    }
}

// Helper Functions for Distributed Revocation List (DRL)

/**
 * Add a token to the distributed revocation list
 * @param {string} token - The warranty token to revoke
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function addRevokedToken(token) {
    if (!isRedisAvailable || !redisClient) {
        console.error('[DRL] CRITICAL: Cannot revoke token - Redis unavailable');
        throw new Error('Distributed Revocation List unavailable');
    }

    try {
        await redisClient.sAdd('revoked_tokens', token);
        console.log(`[DRL] Token revoked: ${token.substring(0, 20)}...`);
        return true;
    } catch (err) {
        console.error('[DRL] ERROR: Failed to add revoked token:', err.message);
        throw err;
    }
}

/**
 * Check if a token is revoked
 * @param {string} token - The warranty token to check
 * @returns {Promise<boolean>} - True if revoked, false if valid
 */
async function isTokenRevoked(token) {
    if (!isRedisAvailable || !redisClient) {
        console.error('[DRL] CRITICAL: Cannot verify token - Redis unavailable');
        console.error('[DRL] SECURITY POLICY: Rejecting token due to inability to check revocation status');
        // Fail-safe: If we can't check revocation, reject the token
        throw new Error('Cannot verify token revocation status - Redis unavailable');
    }

    try {
        const isRevoked = await redisClient.sIsMember('revoked_tokens', token);
        return isRevoked;
    } catch (err) {
        console.error('[DRL] ERROR: Failed to check token revocation:', err.message);
        throw err;
    }
}

/**
 * Get the count of revoked tokens (for monitoring/diagnostics)
 * @returns {Promise<number>} - Number of revoked tokens
 */
async function getRevokedTokenCount() {
    if (!isRedisAvailable || !redisClient) {
        return 0;
    }

    try {
        return await redisClient.sCard('revoked_tokens');
    } catch (err) {
        console.error('[DRL] ERROR: Failed to get revoked token count:', err.message);
        return 0;
    }
}

/**
 * Check if Redis is currently available
 * @returns {boolean} - True if Redis is available
 */
function isRedisHealthy() {
    return isRedisAvailable && redisClient && redisClient.isOpen;
}

module.exports = {
    initializeRedis,
    addRevokedToken,
    isTokenRevoked,
    getRevokedTokenCount,
    isRedisHealthy
};
