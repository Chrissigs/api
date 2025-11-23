const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

/**
 * Mock Fund Administrator Webhook Server
 * 
 * Simulates a third-party administrator (e.g., Citco, Apex) receiving
 * verification webhooks from the Walkers Protocol System.
 * 
 * This validates HMAC signatures to prevent spoofing attacks.
 * 
 * Port: 4000
 */

const app = express();
const PORT = 4000;

// Shared secret (must match server.js WEBHOOK_SECRET)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'shared-secret-key-demo-123';

app.use(bodyParser.json());

// Storage for received events (in-memory for demo)
const receivedEvents = [];

/**
 * Verify HMAC signature
 * @param {object} payload - Request body
 * @param {string} signature - Received signature from X-Walkers-Signature header
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(payload, signature) {
    const computedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

    return computedSignature === signature;
}

/**
 * Webhook Ingestion Endpoint
 * Receives INVESTOR_VERIFIED events from Walkers Protocol System
 */
app.post('/v1/walkers-ingest', (req, res) => {
    const payload = req.body;
    const receivedSignature = req.headers['x-walkers-signature'];

    console.log('========================================');
    console.log('[MOCK ADMIN] Webhook Received');
    console.log('========================================');
    console.log(`Event ID: ${payload.event_id}`);
    console.log(`Event Type: ${payload.event_type}`);
    console.log(`Investor: ${payload.investor_profile?.legal_name}`);
    console.log(`Fund: ${payload.fund_id}`);
    console.log(`Received Signature: ${receivedSignature?.substring(0, 32)}...`);

    // Validate signature
    if (!receivedSignature) {
        console.error('[MOCK ADMIN] ✗ REJECTED: Missing X-Walkers-Signature header');
        return res.status(401).json({
            error: 'Unauthorized',
            reason: 'Missing signature header'
        });
    }

    const isValid = verifySignature(payload, receivedSignature);

    if (!isValid) {
        console.error('[MOCK ADMIN] ✗ REJECTED: Invalid signature - potential spoofing attack!');
        return res.status(401).json({
            error: 'Unauthorized',
            reason: 'Invalid HMAC signature'
        });
    }

    console.log('[MOCK ADMIN] ✓ SIGNATURE VALID - Webhook accepted');

    // Store event
    receivedEvents.push({
        ...payload,
        receivedAt: new Date().toISOString()
    });

    console.log(`[MOCK ADMIN] Total events received: ${receivedEvents.length}`);
    console.log('[MOCK ADMIN] Event added to Register of Members');
    console.log('========================================\n');

    // Acknowledge receipt
    res.status(200).json({
        status: 'ACCEPTED',
        event_id: payload.event_id,
        message: 'Investor verified and added to fund registry',
        fund_id: payload.fund_id
    });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Mock Fund Administrator',
        events_received: receivedEvents.length
    });
});

/**
 * View received events (for testing)
 */
app.get('/v1/events', (req, res) => {
    res.status(200).json({
        total: receivedEvents.length,
        events: receivedEvents
    });
});

// Start server
app.listen(PORT, () => {
    console.log('========================================');
    console.log('MOCK FUND ADMINISTRATOR SERVER');
    console.log('========================================');
    console.log(`Listening on port ${PORT}`);
    console.log(`Webhook endpoint: POST http://localhost:${PORT}/v1/walkers-ingest`);
    console.log(`Shared secret: ${WEBHOOK_SECRET}`);
    console.log('========================================\n');
    console.log('Waiting for webhooks from Walkers Protocol System...\n');
});
