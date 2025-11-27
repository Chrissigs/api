const https = require('https');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const certsDir = path.join(__dirname, '../certs');

// 1. Generate a Token
const payload = {
    header: {
        timestamp: new Date().toISOString(),
        bank_id: "BANK-001",
        transaction_id: "UUID-REVOKE-TEST"
    },
    investor_identity: {
        legal_name: "Revoked User",
        date_of_birth: "1985-05-05",
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
const token = jwt.sign(jwtPayload, privateKey, {
    algorithm: 'RS256',
    issuer: payload.header.bank_id,
    expiresIn: '1h'
});

payload.compliance_warranty.warranty_token = token;

const httpsOptions = {
    hostname: 'localhost',
    port: 3000,
    key: fs.readFileSync(path.join(certsDir, 'client-key.pem')),
    cert: fs.readFileSync(path.join(certsDir, 'client-cert.pem')),
    ca: fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
    rejectUnauthorized: true
};

function revokeToken(token, callback) {
    const options = {
        ...httpsOptions,
        path: '/v1/revoke',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-oauth-token-123'
        }
    };

    const req = https.request(options, (res) => {
        console.log(`Revoke StatusCode: ${res.statusCode}`);
        res.on('data', d => process.stdout.write(d));
        res.on('end', () => {
            console.log('\nToken Revoked.');
            callback();
        });
    });

    req.write(JSON.stringify({ token }));
    req.end();
}

function tryOnboard(payload) {
    const options = {
        ...httpsOptions,
        path: '/v1/onboard',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-oauth-token-123'
        }
    };

    const req = https.request(options, (res) => {
        console.log(`Onboard StatusCode: ${res.statusCode}`);
        res.on('data', d => process.stdout.write(d));
    });

    req.write(JSON.stringify(payload));
    req.end();
}

// Execute Flow
console.log("1. Revoking Token...");
revokeToken(token, () => {
    console.log("2. Attempting to use Revoked Token...");
    tryOnboard(payload);
});
