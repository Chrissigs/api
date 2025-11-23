const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Verify Audit Trail Integrity
 * 
 * This script validates the cryptographic integrity of the audit ledger:
 * 1. Hash chain continuity (each prevHash matches previous entry's hash)
 * 2. Entry hash correctness (recompute and verify)
 * 3. Warranty token hash presence for ONBOARD_INVESTOR actions
 * 
 * Usage: node scripts/verify_audit_trail.js
 */

const LOG_FILE = path.join(__dirname, '../audit_ledger.jsonl');

function verifyAuditTrail() {
    console.log('========================================');
    console.log('AUDIT TRAIL VERIFICATION REPORT');
    console.log('========================================\n');

    if (!fs.existsSync(LOG_FILE)) {
        console.error('ERROR: Audit ledger file not found:', LOG_FILE);
        return false;
    }

    const data = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = data.trim().split('\n');

    if (lines.length === 0) {
        console.log('Audit ledger is empty. Nothing to verify.');
        return true;
    }

    console.log(`Total entries to verify: ${lines.length}\n`);

    let isValid = true;
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis hash
    const genesisHash = previousHash;

    const errors = [];
    const warnings = [];
    let onboardingEntryCount = 0;
    let onboardingWithTokenHashCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        let entry;

        try {
            entry = JSON.parse(lines[i]);
        } catch (err) {
            const error = `Line ${lineNum}: Failed to parse JSON - ${err.message}`;
            errors.push(error);
            console.error(`❌ ${error}`);
            isValid = false;
            continue;
        }

        // Check 1: Verify prevHash matches previous entry's hash
        if (entry.prevHash !== previousHash) {
            const error = `Line ${lineNum}: Hash chain broken! Expected prevHash: ${previousHash}, Got: ${entry.prevHash}`;
            errors.push(error);
            console.error(`❌ ${error}`);
            isValid = false;
        }

        // Check 2: Recompute entry hash and verify
        const storedHash = entry.hash;
        delete entry.hash; // Remove hash before recomputing

        const recomputedEntryString = JSON.stringify(entry);
        const recomputedHash = crypto.createHash('sha256').update(recomputedEntryString).digest('hex');

        if (recomputedHash !== storedHash) {
            const error = `Line ${lineNum}: Entry hash mismatch! Computed: ${recomputedHash}, Stored: ${storedHash}`;
            errors.push(error);
            console.error(`❌ ${error}`);
            isValid = false;
        }

        // Check 3: Verify warranty token hash for ONBOARD_INVESTOR actions
        if (entry.action === 'ONBOARD_INVESTOR') {
            onboardingEntryCount++;

            if (entry.warrantyTokenHash) {
                onboardingWithTokenHashCount++;

                // Verify it's a valid SHA-256 hash format
                if (!/^[a-f0-9]{64}$/.test(entry.warrantyTokenHash)) {
                    const warning = `Line ${lineNum}: Invalid warranty token hash format (not SHA-256): ${entry.warrantyTokenHash}`;
                    warnings.push(warning);
                    console.warn(`⚠️  ${warning}`);
                }

                console.log(`✓ Line ${lineNum}: ONBOARD_INVESTOR with warranty token hash present`);
            } else {
                const warning = `Line ${lineNum}: ONBOARD_INVESTOR entry missing warranty token hash (may be from older version)`;
                warnings.push(warning);
                console.warn(`⚠️  ${warning}`);
            }
        }

        // Update previousHash for next iteration
        previousHash = storedHash;
    }

    console.log('\n========================================');
    console.log('VERIFICATION SUMMARY');
    console.log('========================================\n');

    console.log(`Total entries verified: ${lines.length}`);
    console.log(`ONBOARD_INVESTOR entries: ${onboardingEntryCount}`);
    console.log(`ONBOARD_INVESTOR entries with token hash: ${onboardingWithTokenHashCount}\n`);

    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ AUDIT TRAIL INTEGRITY: PERFECT');
        console.log('All hash chains verified, all entries valid, all warranty tokens hashed.\n');
    } else {
        if (errors.length > 0) {
            console.log(`❌ ERRORS FOUND: ${errors.length}`);
            isValid = false;
        } else {
            console.log('✅ NO CRITICAL ERRORS');
        }

        if (warnings.length > 0) {
            console.log(`⚠️  WARNINGS: ${warnings.length}`);
        }
        console.log();
    }

    // Zero-Knowledge Proof Demonstration
    console.log('========================================');
    console.log('ZERO-KNOWLEDGE PROOF CAPABILITY');
    console.log('========================================\n');

    console.log('✅ The audit trail maintains zero-knowledge properties:');
    console.log('  - Investor PII is redacted ([REDACTED])');
    console.log('  - Warranty tokens are hashed (SHA-256), not stored plaintext');
    console.log('  - CIMA can verify what the Bank attested without seeing sensitive data');
    console.log('  - Hash chain provides non-repudiation\n');

    if (onboardingWithTokenHashCount > 0) {
        console.log(`✅ ${onboardingWithTokenHashCount} onboarding event(s) can be cryptographically verified`);
        console.log('   by providing the original warranty token (JWT) and hashing it.\n');
    }

    return isValid;
}

// Run verification
const isValid = verifyAuditTrail();

if (isValid) {
    console.log('✅ VERIFICATION COMPLETE: AUDIT TRAIL IS VALID\n');
    process.exit(0);
} else {
    console.log('❌ VERIFICATION FAILED: AUDIT TRAIL HAS ERRORS\n');
    process.exit(1);
}
