const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { validatePayload } = require('./validator');
const { logAudit } = require('./logger');
const { initializeRedis, addRevokedToken, isTokenRevoked, isRedisHealthy, getRevokedTokenCount } = require('./redis-client');
const { queueWebhookRetry } = require('./webhook-queue');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Clause 3.1: Deed of Reliance Status Tracking
// This variable tracks whether the Bank is still in compliance with the Deed
// States: ACTIVE (fully operational), WARNING (grace period), SUSPENDED (kill switch activated)
let bankStatus = 'ACTIVE';

// Clause 4.6: Grace Period Tracking
// Track when heartbeat failures began to implement 4-hour grace period
let firstFailureTimestamp = null;

// Grace period duration: 4 hours (14400000 ms)
// During this period, operations continue but are flagged for manual review
const GRACE_PERIOD_MS = 4 * 60 * 60 * 1000; // 4 hours

// Note: Distributed Revocation List now managed via Redis (see redis-client.js)
// No longer using in-memory Set - all offices share the same Redis instance

// Module 3: Webhook Configuration (The Green Light Protocol)
const ADMIN_WEBHOOK_URL = process.env.ADMIN_WEBHOOK_URL || 'http://localhost:4000/v1/walkers-ingest';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'shared-secret-key-demo-123';

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * This prevents spoofing attacks on the administrator's endpoint
 * @param {object} payload - The webhook payload object
 * @returns {string} - Hex-encoded HMAC signature
 */
function generateSignature(payload) {
    return crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
}

/**
 * Module 3: The Admin Handoff (Green Light Protocol)
 * Push real-time verification events to external Fund Administrators
 * 
 * @param {string} transactionId - Internal transaction identifier
 * @param {object} investorData - Clean investor data from onboarding payload
 * @param {string} bankId - Bank identifier (reliance provider)
 * @param {object} subscription - Optional subscription details
 */
async function notifyAdmin(transactionId, investorData, bankId, subscription = null) {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Construct standard webhook payload
    const payload = {
        event_id: eventId,
        event_type: 'INVESTOR_VERIFIED',
        timestamp: new Date().toISOString(),
        fund_id: process.env.FUND_ID || 'FUND_DEMO_01',
        investor_profile: {
            reference_id: transactionId, // Link to our audit log
            legal_name: investorData.legal_name,
            tax_residency: investorData.tax_residency,
            kyc_status: 'VERIFIED',
            reliance_provider: bankId
        },
        subscription: subscription || {
            currency: 'USD',
            amount: 10000.00,
            share_class: 'Class A (Retail)'
        },
        walkers_certification: {
            aml_officer_sign_off: 'AUTO_SYSTEM_ID_01',
            compliance_hash: transactionId
        }
    };

    const signature = generateSignature(payload);

    try {
        console.log(`[ADMIN HANDOFF] Notifying Administrator at ${ADMIN_WEBHOOK_URL}...`);
        console.log(`[ADMIN HANDOFF] Event ID: ${eventId}`);

        const response = await axios.post(ADMIN_WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Walkers-Signature': signature,
                'User-Agent': 'Walkers-Protocol-Bot/1.0'
            },
            timeout: 5000
        });

        console.log(`[ADMIN HANDOFF] ✓ Success: Administrator acknowledged receipt (Status ${response.status})`);
        console.log(`[ADMIN HANDOFF] Investor ${investorData.legal_name} synced to Fund Administrator`);

        return { success: true, eventId };
    } catch (error) {
        console.error('[ADMIN HANDOFF] ✗ Failed: Could not reach Administrator.');
        console.error(`[ADMIN HANDOFF] Error: ${error.message}`);

        // CRITICAL: Queue for retry - cannot drop a verified investor
        console.warn(`[ADMIN HANDOFF] Queuing event ${eventId} for retry...`);
        await queueWebhookRetry(eventId, payload, ADMIN_WEBHOOK_URL, signature);

        return { success: false, eventId, queued: true };
    }
}

app.use(bodyParser.json());

// Clause 4.6: Daily Heartbeat Check (Demo: every 10 seconds)
// Legal Requirement: The Bank must prove continued access to cryptographic material
// If the Bank fails to respond within 30 seconds, reliance is automatically suspended
const checkHeartbeat = () => {
    console.log('[LEGAL AUDIT] Daily Heartbeat Sent...');
    console.log('[LEGAL AUDIT] Checking Bank compliance with Deed of Reliance...');

    const postData = JSON.stringify({});

    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/v1/heartbeat-response',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length
        },
        // Clause 4.6: Must reply in 30s - we use 29s to be safe
        timeout: 29000,
        rejectUnauthorized: false // For demo with self-signed certs
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (response.status === 'ACCESS_CONFIRMED') {
                    console.log('[LEGAL AUDIT] ✓ Heartbeat OK: Bank is verified.');
                    console.log('[LEGAL AUDIT] Bank maintains cryptographic control. Reliance confirmed.');
                    // Success: Reset to ACTIVE and clear failure tracking
                    bankStatus = 'ACTIVE';
                    firstFailureTimestamp = null;
                } else {
                    console.log('[RISK CONTROL] ✗ Heartbeat Failed: Unexpected response.');
                    handleHeartbeatFailure('Unexpected response from Bank');
                }
            } catch (err) {
                console.error('[RISK CONTROL] ✗ Heartbeat Failed: Invalid response format.');
                handleHeartbeatFailure('Invalid response format');
            }
        });
    });

    req.on('error', (error) => {
        console.error('[RISK CONTROL] ✗ CRITICAL: Heartbeat Failed - Connection Error.');
        console.error(`[RISK CONTROL] Error details: ${error.message}`);
        handleHeartbeatFailure(`Connection Error: ${error.message}`);
    });

    req.on('timeout', () => {
        console.error('[RISK CONTROL] ✗ CRITICAL: Heartbeat Failed - Timeout (>29s).');
        console.error('[RISK CONTROL] Clause 4.6 Violation: Bank did not respond within 30 seconds.');
        req.destroy();
        handleHeartbeatFailure('Timeout (>29s)');
    });

    req.write(postData);
    req.end();
};

// Clause 4.6: Grace Period Handler for Heartbeat Failures
// Implements graduated response: WARNING → SUSPENSION after 4 hours
function handleHeartbeatFailure(reason) {
    const now = Date.now();

    if (firstFailureTimestamp === null) {
        // First failure: Enter WARNING state
        firstFailureTimestamp = now;
        bankStatus = 'WARNING';
        console.warn('[GRACE PERIOD] First heartbeat failure detected.');
        console.warn(`[GRACE PERIOD] Reason: ${reason}`);
        console.warn('[GRACE PERIOD] Entering WARNING state. Operations continue with manual review flag.');
        console.warn('[GRACE PERIOD] Bank has 4 hours to restore heartbeat before SUSPENSION.');
    } else {
        // Subsequent failure: Check elapsed time
        const elapsedMs = now - firstFailureTimestamp;
        const elapsedHours = (elapsedMs / (1000 * 60 * 60)).toFixed(2);

        if (elapsedMs >= GRACE_PERIOD_MS) {
            // Grace period exceeded: SUSPEND
            bankStatus = 'SUSPENDED';
            console.error('[KILL SWITCH] CRITICAL: Grace period exceeded (4 hours).');
            console.error(`[KILL SWITCH] Total downtime: ${elapsedHours} hours`);
            console.error('[KILL SWITCH] KILL SWITCH ACTIVATED. All operations SUSPENDED.');
        } else {
            // Still in grace period: Maintain WARNING
            const remainingHours = ((GRACE_PERIOD_MS - elapsedMs) / (1000 * 60 * 60)).toFixed(2);
            console.warn(`[GRACE PERIOD] Heartbeat still failing. Elapsed: ${elapsedHours}h, Remaining: ${remainingHours}h`);
            console.warn('[GRACE PERIOD] Status: WARNING. Operations continue with manual review.');
        }
    }
}

// Start the heartbeat scheduler
// Demo: Check every 10 seconds (in production, this would be daily)
setInterval(checkHeartbeat, 10000);

// Run initial heartbeat check on startup
console.log('[LEGAL AUDIT] Initiating first heartbeat check...');
setTimeout(checkHeartbeat, 2000); // Wait 2 seconds after startup

// Secure OAuth 2.0 Middleware
const checkAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const validToken = process.env.API_AUTH_TOKEN;

    if (!validToken) {
        console.error('CRITICAL: API_AUTH_TOKEN environment variable is not set. Rejecting all requests.');
        return res.status(500).json({ error: 'Internal Server Error: Security Configuration Missing' });
    }

    // Secure constant-time comparison to prevent timing attacks
    const crypto = require('crypto');
    const validTokenBuffer = Buffer.from(validToken);
    const tokenBuffer = Buffer.from(token);

    if (validTokenBuffer.length !== tokenBuffer.length || !crypto.timingSafeEqual(validTokenBuffer, tokenBuffer)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    next();
};

app.post('/v1/onboard', checkAuth, async (req, res) => {
    // Clause 5.1: Kill Switch - Check Deed of Reliance Status
    // Three-state enforcement: ACTIVE (normal), WARNING (grace period), SUSPENDED (kill switch)
    if (bankStatus === 'SUSPENDED') {
        console.warn('[KILL SWITCH] Request rejected: Reliance Suspended');
        console.warn('[KILL SWITCH] Bank has failed to maintain compliance with Deed of Reliance');
        return res.status(503).json({
            error: 'Service Unavailable: Reliance Suspended via Kill Switch',
            reason: 'Bank failed to prove continued cryptographic control for >4 hours',
            legal_basis: 'Clause 4.6 - Heartbeat Requirement'
        });
    }

    // WARNING state: Allow operations but flag for manual review
    const manualReviewRequired = (bankStatus === 'WARNING');
    if (manualReviewRequired) {
        console.warn('[GRACE PERIOD] Processing onboarding during WARNING state.');
        console.warn('[GRACE PERIOD] Transaction will be flagged for manual compliance review.');
    }

    const payload = req.body;

    // 1. Validate Schema & Business Logic
    // We need the client public key to verify the signature.
    // In this mTLS setup, we are trusting the client-cert.pem we have on disk as the "Bank's Public Key".
    // In a real dynamic scenario, we might extract the peer certificate from the request (req.socket.getPeerCertificate()),
    // but here we are validating against a known stored key for the "Bank" entity.

    const bankPublicKey = fs.readFileSync(path.join(certsDir, 'client-cert.pem'), 'utf8');
    const validation = validatePayload(payload, bankPublicKey);
    if (!validation.valid) {
        return res.status(400).json({ error: 'Bad Request', details: validation.errors });
    }

    // Check Revocation via Distributed Revocation List (Redis)
    try {
        const tokenRevoked = await isTokenRevoked(payload.compliance_warranty.warranty_token);
        if (tokenRevoked) {
            console.warn(`[DRL] Rejected revoked token: ${payload.compliance_warranty.warranty_token.substring(0, 20)}...`);
            return res.status(401).json({ error: 'Unauthorized: Token is revoked' });
        }
    } catch (err) {
        console.error('[DRL] CRITICAL: Cannot verify token revocation status:', err.message);
        return res.status(503).json({
            error: 'Service Unavailable: Cannot verify token revocation status',
            reason: 'Distributed Revocation List unavailable'
        });
    }

    // 2. Extract Info for Logging
    const { transaction_id, bank_id } = payload.header;

    // 3. "Create Register Entry" (Mock)
    const memberId = `MEM-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`;

    // 4. Log Audit (with manual review flag if in WARNING state)
    // Workstream 3: Include warranty token for cryptographic verification
    logAudit(
        transaction_id,
        bank_id,
        'ONBOARD_INVESTOR',
        'SUCCESS',
        {
            manual_review_required: manualReviewRequired,
            bank_status: bankStatus,
            warrantyToken: payload.compliance_warranty.warranty_token
        }
    );

    // 5. Module 3: NOTIFY ADMIN (Green Light Protocol)
    // Async call - does not block response to Bank
    notifyAdmin(transaction_id, payload.investor_identity, bank_id).catch(err => {
        console.error('[ADMIN HANDOFF] Critical error in webhook handler:', err);
    });

    // 6. Response to Bank
    res.status(201).json({
        member_id: memberId,
        status: 'VERIFIED_AND_SYNCED',
        admin_handoff: 'INITIATED'
    });
});

app.post('/v1/revoke', checkAuth, async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Missing token' });
    }

    try {
        await addRevokedToken(token);
        const revokedCount = await getRevokedTokenCount();
        console.log(`[DRL] Token revoked. Total revoked tokens: ${revokedCount}`);
        res.status(200).json({
            message: 'Token revoked',
            total_revoked: revokedCount
        });
    } catch (err) {
        console.error('[DRL] ERROR: Failed to revoke token:', err.message);
        return res.status(503).json({
            error: 'Service Unavailable: Cannot revoke token',
            reason: 'Distributed Revocation List unavailable'
        });
    }
});

// Workstream 1.2: Retrieval Mechanism
app.get('/v1/retrieve-evidence', checkAuth, (req, res) => {
    const transactionId = req.query.transaction_id;

    if (!transactionId) {
        return res.status(400).json({ error: 'Missing transaction_id query parameter' });
    }

    // Mock Permission Check
    // In reality, we would check if the caller (from the cert or token) has the 'COMPLIANCE_OFFICER' role.
    const authHeader = req.headers.authorization;
    // For prototype, let's assume a specific token is the "admin" token, or just allow it for the mock token for now.

    // Generate Mock Presigned URL
    // This simulates a secure link to an S3 bucket or similar storage where the evidence is kept.
    const presignedUrl = `https://vault.bank.com/upload/${transactionId}?token=SECURE_TOKEN_${uuidv4()}`;

    res.status(200).json({
        transaction_id: transactionId,
        evidence_upload_url: presignedUrl,
        expires_in: '15m'
    });
});

// HTTPS Options for mTLS
const certsDir = path.join(__dirname, '../certs');
let httpsOptions = {};

try {
    httpsOptions = {
        key: fs.readFileSync(path.join(certsDir, 'server-key.pem')),
        cert: fs.readFileSync(path.join(certsDir, 'server-cert.pem')),
        ca: fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
        requestCert: true,
        rejectUnauthorized: true // Enforce mTLS
    };
} catch (err) {
    console.warn('Warning: Certificates not found. mTLS will fail if not fixed. Running in insecure mode for testing might be necessary if certs are missing.');
    // For the purpose of the prototype code, we want to show the mTLS logic. 
    // If files are missing, this script will crash on start if we don't handle it.
    // But the requirement is strict mTLS.
}

if (Object.keys(httpsOptions).length > 0) {
    // Initialize Redis before starting server
    initializeRedis().then(() => {
        https.createServer(httpsOptions, app).listen(PORT, () => {
            console.log(`Secure API Server running on port ${PORT}`);
            console.log(`Bank Status: ${bankStatus}`);
            console.log(`Redis Health: ${isRedisHealthy() ? 'CONNECTED' : 'DISCONNECTED'}`);
        });
    }).catch((err) => {
        console.error('CRITICAL: Failed to initialize Redis. Server cannot start without DRL.');
        console.error('For development, you can start Redis with: redis-server');
        process.exit(1);
    });
} else {
    console.error('Failed to start server: Missing certificates.');
    process.exit(1);
}
