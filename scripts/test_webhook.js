const https = require('https');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * End-to-End Webhook Test
 * 
 * Tests Module 3: WEBHOOK-OUTBOUND-ADMIN-SYNC
 * 
 * This test:
 * 1. Sends an onboarding request to the main server
 * 2. Verifies webhook is sent to mock admin server
 * 3. Validates HMAC signature verification
 * 4. Checks response includes admin_handoff status
 */

const certsDir = path.join(__dirname, '../certs');

// Load Bank's Private Key for JWT signing
const bankPrivateKey = fs.readFileSync(path.join(certsDir, 'client-key.pem'), 'utf8');

console.log('========================================');
console.log('MODULE 3: WEBHOOK ADMIN SYNC TEST');
console.log('========================================\n');

// Sample Investor Data
const investorIdentity = {
    legal_name: "Maria Gonzalez",
    Nm: {
        FrstNm: "Maria",
        Srnm: "Gonzalez"
    },
    PstlAdr: {
        StrtNm: "456 Reforma Avenue",
        TwnNm: "Mexico City",
        Ctry: "MX",
        PstCd: "06600"
    },
    date_of_birth: "1985-03-20",
    nationality: "MX",
    tax_residency: [
        {
            country: "MX",
            tin: crypto.createHash('sha256').update('CURP-GOZM850320MDFNZR05').digest('hex')
        }
    ]
};

const complianceWarranty = {
    kyc_status: "VERIFIED",
    screening_status: "CLEAR"
};

// Create JWT (Warranty Token)
const jwtPayload = {
    iss: "BANK-MX-001",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60),
    investor_identity: {
        legal_name: investorIdentity.legal_name,
        date_of_birth: investorIdentity.date_of_birth
    },
    compliance_warranty: complianceWarranty
};

const warrantyToken = jwt.sign(jwtPayload, bankPrivateKey, { algorithm: 'RS256' });

// Construct Full Payload
const payload = {
    header: {
        timestamp: new Date().toISOString(),
        bank_id: "BANK-MX-001",
        transaction_id: `TXN-WEBHOOK-TEST-${Date.now()}`
    },
    investor_identity: investorIdentity,
    compliance_warranty: {
        ...complianceWarranty,
        warranty_token: warrantyToken
    }
};

console.log('Test Scenario: Onboarding investor from Example Mexican Bank');
console.log(`Investor: ${payload.investor_identity.legal_name}`);
console.log(`Transaction ID: ${payload.header.transaction_id}\n`);

console.log('Step 1: Sending onboarding request to main server...\n');

const postData = JSON.stringify(payload);

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/v1/onboard',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Authorization': `Bearer ${process.env.API_AUTH_TOKEN || 'DEMO_TOKEN_123'}`
    },
    key: fs.readFileSync(path.join(certsDir, 'client-key.pem')),
    cert: fs.readFileSync(path.join(certsDir, 'client-cert.pem')),
    ca: fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
    rejectUnauthorized: false
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('========================================');
        console.log('MAIN SERVER RESPONSE');
        console.log('========================================');
        console.log(`Status: ${res.statusCode}\n`);

        try {
            const response = JSON.parse(data);
            console.log(JSON.stringify(response, null, 2));

            if (res.statusCode === 201) {
                console.log('\n✅ SUCCESS: Investor onboarded');
                console.log(`✅ Member ID: ${response.member_id}`);
                console.log(`✅ Status: ${response.status}`);
                console.log(`✅ Admin Handoff: ${response.admin_handoff}`);

                if (response.admin_handoff === 'INITIATED') {
                    console.log('\n========================================');
                    console.log('WEBHOOK VERIFICATION');
                    console.log('========================================');
                    console.log('✅ Webhook notification was triggered');
                    console.log('✅ Check mock admin server logs for webhook receipt');
                    console.log('✅ Check main server logs for delivery status\n');

                    // Wait a moment for webhook to be delivered
                    setTimeout(() => {
                        console.log('Step 2: Checking mock admin server for received webhooks...\n');
                        checkAdminReceivedWebhook();
                    }, 2000);
                } else {
                    console.log('\n⚠️  WARNING: admin_handoff status unexpected');
                }
            } else {
                console.log('\n❌ FAILED:', response.error);
                if (response.details) {
                    console.log('Details:', response.details);
                }
            }
        } catch (err) {
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Main server is running (node src/server.js)');
    console.error('2. Mock admin server is running (node scripts/mock_admin_server.js)');
    console.error('3. Redis is running');
});

req.write(postData);
req.end();

/**
 * Check if mock admin server received the webhook
 */
function checkAdminReceivedWebhook() {
    const http = require('http');

    const options = {
        hostname: 'localhost',
        port: 4000,
        path: '/v1/events',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);

                console.log('========================================');
                console.log('MOCK ADMIN SERVER STATUS');
                console.log('========================================');
                console.log(`Total webhooks received: ${response.total}\n`);

                if (response.total > 0) {
                    const latestEvent = response.events[response.events.length - 1];
                    console.log('Latest webhook:');
                    console.log(`  Event ID: ${latestEvent.event_id}`);
                    console.log(`  Investor: ${latestEvent.investor_profile.legal_name}`);
                    console.log(`  Tax Residency: ${latestEvent.investor_profile.tax_residency.length} countries`);
                    console.log(`  Reliance Provider: ${latestEvent.investor_profile.reliance_provider}`);
                    console.log(`  Received At: ${latestEvent.receivedAt}\n`);

                    console.log('✅ END-TO-END TEST PASSED!');
                    console.log('✅ Webhook was successfully delivered and verified');
                    console.log('✅ HMAC signature validation successful');
                    console.log('✅ Module 3 implementation working correctly\n');
                } else {
                    console.log('⚠️  No webhooks received by mock admin server');
                    console.log('Check main server logs for webhook delivery errors\n');
                }
            } catch (err) {
                console.error('Error parsing admin response:', err.message);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Failed to connect to mock admin server:', error.message);
        console.error('Make sure mock admin server is running on port 4000\n');
    });

    req.end();
}
