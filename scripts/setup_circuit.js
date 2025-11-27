const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function runSetup() {
    const circuitsDir = path.join(__dirname, '../circuits');
    const r1csPath = path.join(circuitsDir, 'identity.r1cs');
    const ptauPath = path.join(circuitsDir, 'pot12_final.ptau');
    const zkeyPath = path.join(circuitsDir, 'identity_0000.zkey');
    const finalZkeyPath = path.join(circuitsDir, 'identity_final.zkey');
    const vKeyPath = path.join(circuitsDir, 'verification_key.json');

    if (!fs.existsSync(r1csPath)) {
        console.error('Error: identity.r1cs not found.');
        console.error('Please compile the circuit first using circom:');
        console.error('circom circuits/identity.circom --r1cs --wasm --sym -o circuits');
        process.exit(1);
    }

    console.log('Starting Trusted Setup Ceremony...');

    // Phase 1: Powers of Tau (using a pre-generated file or generating a small one for testing)
    // For production, download a large enough ptau file. For this test, we generate a small one.
    if (!fs.existsSync(ptauPath)) {
        console.log('Generating Powers of Tau (Phase 1)...');
        await snarkjs.powersOfTau.newAccumulator("bn128", 12, ptauPath);
    }

    // Phase 2: Circuit Specific Setup
    console.log('Phase 2: Generating .zkey...');
    await snarkjs.zKey.newZKey(r1csPath, ptauPath, zkeyPath, console);

    console.log('Phase 2: Contributing to .zkey...');
    await snarkjs.zKey.contribute(zkeyPath, finalZkeyPath, "Contributor 1", "Entropy123", console);

    console.log('Exporting Verification Key...');
    const vKey = await snarkjs.zKey.exportVerificationKey(finalZkeyPath);
    fs.writeFileSync(vKeyPath, JSON.stringify(vKey, null, 2));

    console.log('Trusted Setup Complete!');
    console.log('Generated: identity_final.zkey, verification_key.json');
}

runSetup().catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
});
