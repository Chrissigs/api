const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const https = require('https');

const SERVER_PATH = path.join(__dirname, '../src/server.js');
const BANK_NODE_PATH = path.join(__dirname, '../scripts/bank_node.js');

let serverProcess;
let bankProcess;

function startProcess(name, scriptPath, env = {}) {
    const proc = spawn('node', [scriptPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...env }
    });

    proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) console.log(`[${name}] ${line.trim()}`);
            checkLogs(name, line.trim());
        });
    });

    proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) console.error(`[${name} ERROR] ${line.trim()}`);
            checkLogs(name, line.trim());
        });
    });

    return proc;
}

let strikeCount = 0;
let warningDetected = false;
let alertDetected = false;

function checkLogs(source, message) {
    if (message.includes('Strike') && message.includes('Retrying heartbeat')) {
        strikeCount++;
        console.log(`>>> TEST: Detected Strike ${strikeCount}`);
    }
    if (message.includes('Bank Status transitioned to WARNING')) {
        warningDetected = true;
        console.log('>>> TEST: Detected Transition to WARNING');
        triggerOnboardingTest();
    }
    if (message.includes('[ALERT: HIGH_PRIORITY] Manual Intervention Required')) {
        alertDetected = true;
        console.log('>>> TEST: Detected High Priority Alert');
        finishTest();
    }
}

const certsDir = path.join(__dirname, '../certs');
// Ensure certs exist before reading
let clientKey, clientCert;
try {
    clientKey = fs.readFileSync(path.join(certsDir, 'client-key.pem'));
    clientCert = fs.readFileSync(path.join(certsDir, 'client-cert.pem'));
} catch (e) {
    console.warn('>>> TEST WARNING: Could not load client certs. mTLS might fail.');
}

const agent = new https.Agent({
    rejectUnauthorized: false,
    key: clientKey,
    cert: clientCert
});

async function triggerOnboardingTest() {
    console.log('>>> TEST: Triggering Onboarding to test Alert...');
    try {
        await axios.post('https://127.0.0.1:3000/v1/onboard', {
            header: { bank_id: 'BANK_TEST', transaction_id: 'TX_123', fund_id: 'FUND_ID_A' },
            investor_identity: { legal_name: 'Test Investor', tax_residency: 'US' },
            compliance_warranty: { warranty_token: 'test-token' }
        }, {
            headers: { 'Authorization': 'Bearer secure-token-prod-991' },
            httpsAgent: agent
        });
    } catch (err) {
        console.log(`>>> TEST: Onboarding request failed. Message: ${err.message}`);
        console.log(`>>> TEST: Status: ${err.response ? err.response.status : 'Unknown'}`);
        if (err.response && err.response.data) {
            console.log(`>>> TEST: Response Data: ${JSON.stringify(err.response.data)}`);
        }
    }
}

function finishTest() {
    console.log('\n>>> TEST RESULTS <<<');
    console.log(`Strikes Detected: ${strikeCount} (Expected 3)`);
    console.log(`Warning Transition: ${warningDetected ? 'PASS' : 'FAIL'}`);
    console.log(`Alert Detected: ${alertDetected ? 'PASS' : 'FAIL'}`);

    if (strikeCount >= 3 && warningDetected && alertDetected) {
        console.log('>>> OVERALL STATUS: PASS');
    } else {
        console.log('>>> OVERALL STATUS: FAIL');
    }

    cleanup();
}

function cleanup() {
    if (serverProcess) serverProcess.kill();
    if (bankProcess) bankProcess.kill();
    process.exit(0);
}

async function run() {
    console.log('>>> Starting Verification Test...');

    // 1. Start Server
    serverProcess = startProcess('SERVER', SERVER_PATH, { GRACE_PERIOD_MS: '30000' });

    // 2. Start Bank Node
    bankProcess = startProcess('BANK', BANK_NODE_PATH);

    // 3. Wait for initialization
    console.log('>>> Waiting 5s for startup...');
    await new Promise(r => setTimeout(r, 5000));

    // 4. Kill Bank Node to trigger failure
    console.log('>>> Simulating Bank Failure (Killing Node)...');
    bankProcess.kill();
    bankProcess = null;

    // 5. Wait for strikes and warning (approx 40s)
    // The logs will trigger the next steps

    // Timeout safety
    setTimeout(() => {
        console.log('>>> TEST TIMEOUT');
        finishTest();
    }, 90000);
}

run();
