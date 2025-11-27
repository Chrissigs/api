const axios = require('axios');
const { addRevokedToken, initializeRedis } = require('./redis-client');
const fs = require('fs');
const path = require('path');

// Configuration
const BANK_NODE_URL = process.env.BANK_NODE_URL || 'http://localhost:3001';
const SAMPLE_RATE = 0.01; // 1%
const TIMEOUT_MS = 60000; // 60 seconds

// Mock Database of Active Credentials (in production, this would be a DB query)
// We'll scan the evidence_vault directory for this demo
const EVIDENCE_VAULT_DIR = path.join(__dirname, '../evidence_vault');

async function getActiveCredentials() {
    if (!fs.existsSync(EVIDENCE_VAULT_DIR)) return [];
    const files = fs.readdirSync(EVIDENCE_VAULT_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
        const content = JSON.parse(fs.readFileSync(path.join(EVIDENCE_VAULT_DIR, f), 'utf8'));
        return {
            transaction_id: content.transaction_id,
            bank_id: content.bank_id,
            shard_a: content.shard_a
        };
    });
}

async function performSpotCheck(credential) {
    console.log(`[RELIANCE MONITOR] Spot checking Transaction ID: ${credential.transaction_id}...`);

    try {
        const startTime = Date.now();

        // Trigger ReconstructRequest
        // The Bank must return Shard B to prove they still hold it and are online
        const response = await axios.post(`${BANK_NODE_URL}/v1/reconstruct-request`, {
            transaction_id: credential.transaction_id,
            challenge: Date.now().toString()
        }, {
            timeout: TIMEOUT_MS
        });

        const duration = Date.now() - startTime;

        if (response.status === 200 && response.data.shard_b) {
            console.log(`[RELIANCE MONITOR] ✓ Verified ${credential.transaction_id} in ${duration}ms.`);
            return true;
        } else {
            throw new Error('Invalid response from Bank Node');
        }

    } catch (error) {
        console.error(`[RELIANCE MONITOR] ✗ FAILED ${credential.transaction_id}: ${error.message}`);
        return false;
    }
}

async function runRelianceMonitor() {
    console.log('[RELIANCE MONITOR] Starting monthly audit cycle...');

    await initializeRedis();
    const allCredentials = await getActiveCredentials();

    // Select 1% random sample
    const sampleSize = Math.max(1, Math.ceil(allCredentials.length * SAMPLE_RATE));
    const sample = allCredentials.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

    console.log(`[RELIANCE MONITOR] Selected ${sample.length} credentials for active testing.`);

    for (const cred of sample) {
        const passed = await performSpotCheck(cred);

        if (!passed) {
            console.error(`[RELIANCE MONITOR] ⚠️ RELIANCE BREACH DETECTED for ${cred.transaction_id}`);
            console.log(`[RELIANCE MONITOR] Revoking credential...`);

            // In a real scenario, we might need the token ID associated with this transaction.
            // For this demo, we'll assume the transaction_id maps to a token or we revoke the transaction itself.
            // Let's assume we revoke a derived token ID.
            await addRevokedToken(`token_${cred.transaction_id}`);

            // Notify Admin/Compliance (Mock)
            console.log(`[RELIANCE MONITOR] ALERT: Compliance Officer notified of Breach.`);
        }
    }

    console.log('[RELIANCE MONITOR] Audit cycle complete.');
}

// Run immediately if called directly
if (require.main === module) {
    runRelianceMonitor().catch(err => console.error(err));
}

module.exports = { runRelianceMonitor };
