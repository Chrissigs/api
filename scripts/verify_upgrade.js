const vcService = require('../src/vc-service');
const shardedVault = require('../sharded-vault');
const { runRelianceMonitor } = require('../src/reliance-monitor');
const fs = require('fs');
const path = require('path');

async function runVerification() {
    console.log('=== VERIFICATION START ===');

    // 1. Test Credential Engine
    console.log('\n[TEST 1] Credential Engine (Module 1)');
    const subjectDid = 'did:key:z6Mkq...';
    const claims = {
        "iso:Nm": { "iso:FrstNm": "Jane", "iso:Srnm": "Doe" },
        "cima:RelianceStatus": "Verified"
    };

    console.log('Issuing Credential...');
    const token = vcService.issueCredential(subjectDid, claims);
    console.log('Credential Issued (Truncated):', token.substring(0, 50) + '...');

    console.log('Verifying Credential...');
    const verification = vcService.verifyCredential(token);
    if (verification.valid) {
        console.log('✓ Credential Verified Successfully');
        console.log('  Issuer:', verification.payload.issuer);
        console.log('  Subject:', verification.payload.credentialSubject.id);
    } else {
        console.error('✗ Credential Verification Failed:', verification.error);
    }

    // 2. Test Sharded Vault 2.0
    console.log('\n[TEST 2] Sharded Vault 2.0 (Module 2)');
    const piiData = { name: "John Doe", tin: "123-456" };
    console.log('Encrypting Data...');
    const vaultEntry = shardedVault.encrypt(piiData);

    // Decrypt to check metadata
    // We need to reconstruct manually to see the internal structure or trust the encrypt function
    // Let's decrypt using the reconstruct function (if available/exported or simulate it)
    // shardedVault.reconstruct is available.

    try {
        const decrypted = shardedVault.reconstruct(
            vaultEntry.encryptedBlob,
            vaultEntry.iv,
            vaultEntry.authTag,
            vaultEntry.shardA,
            vaultEntry.shardB
        );

        console.log('Decrypted Data:', JSON.stringify(decrypted, null, 2));

        if (decrypted._security_metadata && decrypted._security_metadata.liveness_verified) {
            console.log('✓ Liveness Metadata Present');
            console.log('  Standard:', decrypted._security_metadata.liveness_standard);
            console.log('  Timestamp:', decrypted._security_metadata.timestamp_seal.timestamp);
        } else {
            console.error('✗ Missing Liveness/Timestamp Metadata');
        }
    } catch (err) {
        console.error('✗ Decryption Failed:', err.message);
    }

    // 3. Test Reliance Monitor (Module 3)
    console.log('\n[TEST 3] Reliance Monitor (Module 3)');
    console.log('Running Monitor (Expect Connection Refused as Bank Node is offline/mocked)...');

    // Create a dummy evidence file to ensure the monitor has something to check
    const dummyEvidence = {
        transaction_id: "test_tx_001",
        bank_id: "BANK_TEST",
        shard_a: "dummy_shard_a"
    };
    const evidenceDir = path.join(__dirname, '../evidence_vault');
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, 'test_tx_001.json'), JSON.stringify(dummyEvidence));

    try {
        await runRelianceMonitor();
        console.log('✓ Reliance Monitor ran without crashing.');
    } catch (err) {
        console.error('✗ Reliance Monitor crashed:', err);
    }

    // Cleanup
    fs.unlinkSync(path.join(evidenceDir, 'test_tx_001.json'));

    console.log('\n=== VERIFICATION COMPLETE ===');
}

runVerification();
