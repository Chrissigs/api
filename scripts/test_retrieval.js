const https = require('https');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const certsDir = path.join(__dirname, '../certs');

// 1. Create a VALID payload first
const payload = {
    header: {
        timestamp: new Date().toISOString(),
        bank_id: "BANK-001",
        transaction_id: "UUID-ATTACK-TEST"
    },
    investor_identity: {
        legal_name: "Malicious Actor",
        date_of_birth: "1990-01-01",
        nationality: "US",
        tax_residency: [
            { country: "US", tin: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }
        ]
    },
    compliance_warranty: {
        kyc_status: "VERIFIED",
        screening_status: "CLEAR",
        warranty_token: ""
    }
};

const jwtPayload = {
    investor_identity: payload.investor_identity,
    compliance_warranty: {
        kyc_status: payload.compliance_warranty.kyc_status,
        screening_status: payload.compliance_warranty.screening_status,
        status: "VERIFIED"
    }
};

const privateKey = fs.readFileSync(path.join(certsDir, 'client-key.pem'), 'utf8');
let token = jwt.sign(jwtPayload, privateKey, {
    algorithm: 'RS256',
    issuer: payload.header.bank_id,
    expiresIn: '1h'
});

// 2. CORRUPT the token
// We'll just append some garbage to the signature part, or change a character in the payload part.
// A JWT is header.payload.signature
const parts = token.split('.');
// Let's tamper with the payload (middle part) without updating the signature
const decodedPayload = Buffer.from(parts[1], 'base64').toString();
const tamperedPayload = decodedPayload.replace("VERIFIED", "PENDING"); // malicious change
const tamperedToken = `${parts[0]}.${Buffer.from(tamperedPayload).toString('base64').replace(/=/g, '')}.${parts[2]}`;

console.log("Original Token:", token);
console.log("Tampered Token:", tamperedToken);

payload.compliance_warranty.warranty_token = tamperedToken;

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/v1/onboard',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-oauth-token-123'
    },
    key: fs.readFileSync(path.join(certsDir, 'client-key.pem')),
    cert: fs.readFileSync(path.join(certsDir, 'client-cert.pem')),
    ca: fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
    rejectUnauthorized: true
};

const req = https.request(options, (res) => {
    console.log(`StatusCode: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(JSON.stringify(payload));
req.end();
