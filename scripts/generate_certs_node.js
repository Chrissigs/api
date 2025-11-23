const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '../certs');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
}

function generateCert(subject, issuer, issuerKey, serial) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = serial || '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
        { name: 'commonName', value: subject.CN },
        { name: 'countryName', value: subject.C },
        { shortName: 'ST', value: subject.ST },
        { name: 'localityName', value: subject.L },
        { name: 'organizationName', value: subject.O }
    ];

    cert.setSubject(attrs);

    if (issuer) {
        cert.setIssuer(issuer.subject.attributes);
        cert.sign(issuerKey, forge.md.sha256.create());
    } else {
        // Self-signed (CA)
        cert.setIssuer(attrs);
        cert.setExtensions([
            { name: 'basicConstraints', cA: true },
            { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
            { name: 'subjectKeyIdentifier' }
        ]);
        cert.sign(keys.privateKey, forge.md.sha256.create());
    }

    return {
        key: forge.pki.privateKeyToPem(keys.privateKey),
        cert: forge.pki.certificateToPem(cert),
        keys: keys,
        certificate: cert
    };
}

console.log('Generating CA...');
const ca = generateCert(
    { CN: 'WPS Root CA', C: 'KY', ST: 'Grand Cayman', L: 'George Town', O: 'WPS' }
);
fs.writeFileSync(path.join(certsDir, 'ca-key.pem'), ca.key);
fs.writeFileSync(path.join(certsDir, 'ca-cert.pem'), ca.cert);

function generateEndEntityCert(subject, issuer, issuerKey, serial, isServer) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = serial || '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
        { name: 'commonName', value: subject.CN },
        { name: 'countryName', value: subject.C },
        { shortName: 'ST', value: subject.ST },
        { name: 'localityName', value: subject.L },
        { name: 'organizationName', value: subject.O }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(issuer.subject.attributes);

    const extensions = [
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        { name: 'subjectKeyIdentifier' },
        { name: 'extKeyUsage', serverAuth: isServer, clientAuth: !isServer }
    ];

    if (isServer) {
        extensions.push({
            name: 'subjectAltName',
            altNames: [{ type: 2, value: 'localhost' }]
        });
    }

    cert.setExtensions(extensions);
    cert.sign(issuerKey, forge.md.sha256.create());

    return {
        key: forge.pki.privateKeyToPem(keys.privateKey),
        cert: forge.pki.certificateToPem(cert),
        keys: keys,
        certificate: cert
    };
}

console.log('Generating Server Cert...');
const server = generateEndEntityCert(
    { CN: 'localhost', C: 'KY', ST: 'Grand Cayman', L: 'George Town', O: 'WPS' },
    ca.certificate,
    ca.keys.privateKey,
    '02',
    true
);
fs.writeFileSync(path.join(certsDir, 'server-key.pem'), server.key);
fs.writeFileSync(path.join(certsDir, 'server-cert.pem'), server.cert);

console.log('Generating Client Cert...');
const client = generateEndEntityCert(
    { CN: 'Bank Client', C: 'KY', ST: 'Grand Cayman', L: 'George Town', O: 'Bank' },
    ca.certificate,
    ca.keys.privateKey,
    '03',
    false
);
fs.writeFileSync(path.join(certsDir, 'client-key.pem'), client.key);
fs.writeFileSync(path.join(certsDir, 'client-cert.pem'), client.cert);

console.log('Certificates generated successfully.');
