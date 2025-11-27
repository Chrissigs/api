const https = require('https');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Test Client for ISO 20022 Compliant Payload
 * 
 * This demonstrates the new Universal Identity schema with:
 * - ISO 20022 Nm and PstlAdr fields
 * - Multi-jurisdiction tax_residency array (CRS compliant)
 */

const certsDir = path.join(__dirname, '../certs');

// Load Bank's Private Key for JWT signing
const bankPrivateKey = fs.readFileSync(path.join(certsDir, 'client-key.pem'), 'utf8');

// Sample Investor Data with ISO 20022 Fields
const investorIdentity = {
    legal_name: "Johnathan Michael Doe",  // Convenience field
    Nm: {  // ISO 20022 Name structure
        FrstNm: "Johnathan",
        Srnm: "Doe"
    },
    PstlAdr: {  // ISO 20022 Postal Address
        StrtNm: "123 Seven Mile Beach Road",
        TwnNm: "George Town",
        Ctry: "KY",
        PstCd: "KY1-1234"
    },
    date_of_birth: "1980-05-15",
    nationality: "US",
    tax_residency: [
        {
            country: "US",
            // Hash of actual TIN (in production, this would be SHA-256 of real TIN)
            tin: crypto.createHash('sha256').update('123-45-6789').digest('hex')
        },
        {
            country: "KY",
            // Hash of Cayman TIN
            tin: crypto.createHash('sha256').update('KY-TIN-987654321').digest('hex')
        }
    ]
};

const complianceWarranty = {
    kyc_status: "VERIFIED",
    screening_status: "CLEAR"
};

// Create JWT (Warranty Token)
const jwtPayload = {
    iss: "BANK-001",  // Issuer: Example Introducer Bank
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60),  // 1 hour expiry
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
        bank_id: "BANK-001",
        transaction_id: `TXN-ISO20022-${Date.now()}`
    },
    investor_identity: investorIdentity,
    compliance_warranty: {
        ...complianceWarranty,
        warranty_token: warrantyToken
    }
};

console.log('========================================');
console.log('ISO 20022 COMPLIANCE TEST');
console.log('========================================\n');

console.log('Testing new Universal Identity schema:');
console.log(`  ✓ ISO 20022 Name (Nm): ${payload.investor_identity.Nm.FrstNm} ${payload.investor_identity.Nm.Srnm}`);
console.log(`  ✓ ISO 20022 Address (PstlAdr): ${payload.investor_identity.PstlAdr.TwnNm}, ${payload.investor_identity.PstlAdr.Ctry}`);
console.log(`  ✓ Multi-jurisdiction tax residency: ${payload.investor_identity.tax_residency.length} countries`);
payload.investor_identity.tax_residency.forEach((tr, idx) => {
    console.log(`    - ${tr.country}: TIN Hash ${tr.tin.substring(0, 16)}...`);
});
console.log('\nSending payload to /v1/onboard...\n');

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
        console.log(`Response Status: ${res.statusCode}`);
        console.log('========================================\n');

        try {
            const response = JSON.parse(data);
            console.log(JSON.stringify(response, null, 2));

            if (res.statusCode === 201) {
                console.log('\n✅ SUCCESS: ISO 20022 compliant payload accepted!');
                console.log(`✅ Member ID: ${response.member_id}`);
                console.log(`✅ Transaction ID: ${payload.header.transaction_id}`);
                console.log('\nVerify in audit_ledger.jsonl:');
                console.log('  - Warranty token should be hashed (SHA-256)');
                console.log('  - Investor PII should be redacted');
                console.log('  - Multi-jurisdiction tax residency accepted');
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
});

req.write(postData);
req.end();
