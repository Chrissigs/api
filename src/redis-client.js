// src/redis-client.js
// ------------------------------------------------------------
// Redis client providing Distributed Revocation List (DRL) and
// key rotation support for banks. All functions are async and
// return Promises.
// ------------------------------------------------------------

const redis = require('redis');

// ------------------------------------------------------------------
// Configuration (environment variables, defaults for local dev)
// ------------------------------------------------------------------
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

let redisClient = null;
let isRedisAvailable = false;

// In-Memory Mock for Fallback REMOVED for Production Security
// const memoryStore = new Map();
// const memorySets = new Map();

/** Initialize Redis connection (singleton) */
async function initializeRedis() {
    try {
        redisClient = redis.createClient({
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                connectTimeout: 2000, // Short timeout for demo
                reconnectStrategy: false // Don't retry if failed, go to mock
            },
            password: REDIS_PASSWORD || undefined
        });

        redisClient.on('error', (err) => {
            // console.error('[REDIS] Connection Error:', err.message);
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

        await redisClient.connect();
        isRedisAvailable = true;
        console.log(`[REDIS] Initialized: ${REDIS_HOST}:${REDIS_PORT}`);
    } catch (err) {
        console.error('[REDIS] CRITICAL: Connection failed. Service is UNRELIABLE.');
        isRedisAvailable = false;
        redisClient = null;
        // No fallback to memory in production
    }
}

/** Distributed Revocation List helpers */
async function addRevokedToken(token) {
    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.sAdd('revoked_tokens', token);
            console.log(`[DRL] Token revoked: ${token.substring(0, 20)}...`);
            return true;
        } catch (err) {
            console.error('[DRL] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    console.error('[DRL] CRITICAL: Redis unavailable. Cannot revoke token.');
    throw new Error('Service Unavailable: Revocation List Unreachable');
}

async function isTokenRevoked(token) {
    if (isRedisAvailable && redisClient) {
        try {
            return await redisClient.sIsMember('revoked_tokens', token);
        } catch (err) {
            console.error('[DRL] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    console.error('[DRL] CRITICAL: Redis unavailable. Cannot check revocation status.');
    throw new Error('Service Unavailable: Revocation List Unreachable');
}

async function getRevokedTokenCount() {
    if (isRedisAvailable && redisClient) {
        try {
            return await redisClient.sCard('revoked_tokens');
        } catch (err) {
            console.error('[DRL] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    return 0;
}

function isRedisHealthy() {
    return isRedisAvailable && redisClient && redisClient.isOpen;
}

/** Key rotation support */
async function storeBankPublicKey(bankId, publicKey, version) {
    const keyName = `bank:${bankId}:key:v${version}`;
    const versionKey = `bank:${bankId}:current_version`;

    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.set(keyName, publicKey);
            await redisClient.set(versionKey, version);
            console.log(`[KEY_ROTATION] Stored public key v${version} for ${bankId}`);
            return true;
        } catch (err) {
            console.error('[KEY_ROTATION] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    console.error('[KEY_ROTATION] CRITICAL: Redis unavailable. Cannot store key.');
    throw new Error('Service Unavailable: Key Storage Unreachable');
}

async function getBankPublicKey(bankId, version = null) {
    let keyName;

    if (isRedisAvailable && redisClient) {
        try {
            if (version === null) {
                version = await redisClient.get(`bank:${bankId}:current_version`);
                if (!version) return null;
            }
            keyName = `bank:${bankId}:key:v${version}`;
            return await redisClient.get(keyName);
        } catch (err) {
            console.error('[KEY_ROTATION] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    console.error('[KEY_ROTATION] CRITICAL: Redis unavailable. Cannot retrieve key.');
    throw new Error('Service Unavailable: Key Storage Unreachable');
}

async function getCurrentKeyVersion(bankId) {
    if (isRedisAvailable && redisClient) {
        try {
            const version = await redisClient.get(`bank:${bankId}:current_version`);
            return version ? parseInt(version, 10) : null;
        } catch (err) {
            console.error('[KEY_ROTATION] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    console.error('[KEY_ROTATION] CRITICAL: Redis unavailable. Cannot retrieve key version.');
    throw new Error('Service Unavailable: Key Storage Unreachable');
}

async function isInTransitionPeriod(bankId) {
    if (isRedisAvailable && redisClient) {
        try {
            const transitionUntil = await redisClient.get(`bank:${bankId}:transition_until`);
            if (!transitionUntil) return false;
            return Date.now() < parseInt(transitionUntil, 10);
        } catch (err) {
            console.error('[KEY_ROTATION] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    console.error('[KEY_ROTATION] CRITICAL: Redis unavailable. Cannot check transition status.');
    throw new Error('Service Unavailable: Key Storage Unreachable');
}

async function setKeyTransition(bankId, transitionUntilTimestamp) {
    if (isRedisAvailable && redisClient) {
        try {
            await redisClient.set(`bank:${bankId}:transition_until`, transitionUntilTimestamp);
            console.log(`[KEY_ROTATION] Transition set until ${new Date(transitionUntilTimestamp).toISOString()} for ${bankId}`);
            return true;
        } catch (err) {
            console.error('[KEY_ROTATION] Redis error, falling back to mock:', err.message);
        }
    }

    // Fail Closed
    console.error('[KEY_ROTATION] CRITICAL: Redis unavailable. Cannot set transition.');
    throw new Error('Service Unavailable: Key Storage Unreachable');
}

module.exports = {
    initializeRedis,
    addRevokedToken,
    isTokenRevoked,
    getRevokedTokenCount,
    isRedisHealthy,
    storeBankPublicKey,
    getBankPublicKey,
    isInTransitionPeriod,
    getCurrentKeyVersion,
    setKeyTransition
};
