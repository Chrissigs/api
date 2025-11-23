const https = require('https');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const certsDir = path.join(__dirname, '../certs');

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

const payload = {
    header: {
        timestamp: new Date().toISOString(), // Use current time
        bank_id: "CNB-KY-001",
        transaction_id: "UUID-1234-5678"
    },
    investor_identity: {
        legal_name: "Johnathan Doe",
        date_of_birth: "1980-01-01",
        nationality: "KY",
        tax_residency: "KY"
    },
    compliance_warranty: {
        kyc_status: "VERIFIED",
        screening_status: "CLEAR",
        warranty_token: "" // To be filled
    }
};

// Create JWT Payload
// We include the identity and warranty status in the JWT to bind them to the signature.
const jwtPayload = {
    investor_identity: payload.investor_identity,
    compliance_warranty: {
        kyc_status: payload.compliance_warranty.kyc_status,
        screening_status: payload.compliance_warranty.screening_status,
        status: "VERIFIED"
    }
};

// Sign the JWT
const privateKey = fs.readFileSync(path.join(certsDir, 'client-key.pem'), 'utf8');
const token = jwt.sign(jwtPayload, privateKey, {
    algorithm: 'RS256',
    issuer: payload.header.bank_id,
    expiresIn: '1h'
});

payload.compliance_warranty.warranty_token = token;

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
