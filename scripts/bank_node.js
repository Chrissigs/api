const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json());

const certsDir = path.join(__dirname, '../certs');

// Clause 4.6: Heartbeat Response Endpoint
// This endpoint proves the Bank still has access to the original cryptographic material
app.post('/v1/heartbeat-response', (req, res) => {
    console.log('[BANK NODE] Heartbeat request received...');

    // Clause 4.6.1: Verify Bank still has access to certs/ folder
    // This is the legal "proof of continued reliance" required by the Deed
    try {
        fs.accessSync(certsDir, fs.constants.R_OK);
        console.log('[BANK NODE] Certificate access verified. Bank maintains cryptographic control.');
    } catch (err) {
        console.error('[BANK NODE] CRITICAL: Cannot access certs/ folder. Legal warranty broken!');
        return res.status(500).json({
            status: 'ACCESS_DENIED',
            error: 'Certificate access failure'
        });
    }

    // Simulate real-world network delay (0-2 seconds)
    // In production, this would be actual processing time
    const delay = Math.floor(Math.random() * 2000);
    console.log(`[BANK NODE] Simulating network delay: ${delay}ms`);

    setTimeout(() => {
        console.log('[BANK NODE] Responding with ACCESS_CONFIRMED');
        res.status(200).json({ status: 'ACCESS_CONFIRMED' });
    }, delay);
});

// HTTPS Options for mTLS (Bank Node also uses secure communication)
let httpsOptions = {};

try {
    httpsOptions = {
        key: fs.readFileSync(path.join(certsDir, 'server-key.pem')),
        cert: fs.readFileSync(path.join(certsDir, 'server-cert.pem')),
        ca: fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
        requestCert: false, // Bank node doesn't require client certs for heartbeat
        rejectUnauthorized: false // Allow connections without client auth for this demo
    };
} catch (err) {
    console.warn('[BANK NODE] Warning: Could not load certificates. Will try HTTP fallback.');
}

// Start the server
if (Object.keys(httpsOptions).length > 0) {
    https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`[BANK NODE] Secure Bank Node running on https://localhost:${PORT}`);
        console.log('[BANK NODE] Ready to respond to Heartbeat checks...');
    });
} else {
    // Fallback to HTTP for demo purposes
    app.listen(PORT, () => {
        console.log(`[BANK NODE] Bank Node running on http://localhost:${PORT} (INSECURE MODE)`);
        console.log('[BANK NODE] Ready to respond to Heartbeat checks...');
    });
}
