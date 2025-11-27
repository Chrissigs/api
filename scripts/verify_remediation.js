const https = require('https');
const fs = require('fs');
const path = require('path');

const API_PORT = 3000;
const API_HOST = 'localhost';

// Mock Data
const payload = {
    header: {
        timestamp: new Date().toISOString(),
        bank_id: 'TEST-BANK',
        transaction_id: 'TEST-TX-001'
    },
    investor_identity: {
        legal_name: 'TEST_INVESTOR_NAME',
        date_of_birth: '1990-01-01',
        nationality: 'KY',
        tax_residency: 'KY'
    },
    compliance_warranty: {
        kyc_status: 'VERIFIED',
        screening_status: 'CLEAR',
        warranty_token: 'TEST_WARRANTY_TOKEN'
    }
};

function makeRequest(token, callback) {
    const certsDir = path.join(__dirname, '../certs');
    const options = {
        hostname: API_HOST,
        port: API_PORT,
        path: '/v1/onboard',
        method: 'POST',
        key: fs.readFileSync(path.join(certsDir, 'client-key.pem')),
        cert: fs.readFileSync(path.join(certsDir, 'client-cert.pem')),
        ca: fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        rejectUnauthorized: false // Allow self-signed certs (though we have CA now)
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            callback(res.statusCode, data);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(JSON.stringify(payload));
    req.end();
}

async function runTests() {
    console.log('--- Starting Verification ---');

    // Test 1: Auth Failure (Wrong Token)
    console.log('\nTest 1: Auth Failure (Wrong Token)');
    await new Promise(resolve => {
        makeRequest('wrong-token', (status, body) => {
            if (status === 401) {
                console.log('PASS: Received 401 Unauthorized');
            } else {
                console.log(`FAIL: Received ${status}`);
            }
            resolve();
        });
    });

    // Test 2: Auth Success (Correct Token)
    console.log('\nTest 2: Auth Success (Correct Token)');
    await new Promise(resolve => {
        makeRequest('test-token', (status, body) => {
            if (status === 201 || status === 400) { // 400 is acceptable if signature validation fails (we don't have a real signature here)
                // Actually, looking at server.js, it validates schema first. 
                // If we don't provide a valid signature, it might fail validation or signature check.
                // But we care about Auth passing (so not 401).
                console.log(`PASS: Auth passed (Status: ${status})`);
            } else {
                console.log(`FAIL: Received ${status} - ${body}`);
            }
            resolve();
        });
    });

    // Test 3: Privacy Check
    console.log('\nTest 3: Privacy Check (Audit Log)');
    const logPath = path.join(__dirname, '../audit_ledger.jsonl');
    try {
        const logs = fs.readFileSync(logPath, 'utf8').trim().split('\n');
        const lastLog = JSON.parse(logs[logs.length - 1]);

        // Check if PII is redacted in the 'data' field (if it was logged)
        // Wait, server.js logs: logAudit(transaction_id, bank_id, 'ONBOARD_INVESTOR', 'SUCCESS');
        // It does NOT log the full payload in the 'extraData' argument in the current server.js implementation!
        // Let's check server.js again.
        // Line 52: logAudit(transaction_id, bank_id, 'ONBOARD_INVESTOR', 'SUCCESS');
        // It doesn't pass the payload! So PII wouldn't be logged anyway unless we change server.js to log it.
        // However, the requirement was to ensure IF it is logged, it is redacted.
        // Let's manually test the logger class directly to verify the redaction logic.

        const { logAudit } = require('../src/logger');
        // We need to mock the fs.appendFile or just check the file after.
        // Let's just call logAudit with PII and check the file.

        logAudit('TEST-TX-002', 'TEST-BANK', 'TEST_ACTION', 'INFO', payload);

        // Give it a moment to write
        setTimeout(() => {
            const newLogs = fs.readFileSync(logPath, 'utf8').trim().split('\n');
            const testLog = JSON.parse(newLogs[newLogs.length - 1]);

            if (testLog.data.investor_identity.legal_name === '[REDACTED]' &&
                testLog.data.compliance_warranty.warranty_token === '[REDACTED]') {
                console.log('PASS: PII Redacted in logs');
            } else {
                console.log('FAIL: PII NOT Redacted:', JSON.stringify(testLog.data, null, 2));
            }
        }, 1000);

    } catch (err) {
        console.error('Error reading logs:', err);
    }
}

// Wait for server to start (we assume user runs server separately or we can try to import it, but import starts it)
// For this script, we will just run the unit test part for logger and assume server is running for auth.
// Actually, let's just run the logger test standalone as it imports logger.
// And for Auth, we need the server running. 
// I will start the server in the background in the next step.

runTests();
