const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

/**
 * Zero-Knowledge Proof Service
 * 
 * Uses `snarkjs` and `circom` artifacts to generate and verify proofs.
 */

class ZKService {
    constructor() {
        // Paths to circuit artifacts
        // Note: These files must be generated via `circom` and the trusted setup ceremony
        this.wasmPath = path.join(__dirname, '../circuits/identity_js/identity.wasm');
        this.zkeyPath = path.join(__dirname, '../circuits/identity_final.zkey');
        this.vKeyPath = path.join(__dirname, '../circuits/verification_key.json');
    }

    /**
     * Generate a ZK Proof.
     * @param {object} input - Private inputs (e.g., { private_legal_name: 123, ... })
     * @returns {Promise<object>} { proof, publicSignals }
     */
    async generateProof(input) {
        console.log('[ZK] Generating Zero-Knowledge Proof...');

        if (!fs.existsSync(this.wasmPath) || !fs.existsSync(this.zkeyPath)) {
            throw new Error('Circuit artifacts not found. Please compile circuit and run trusted setup.');
        }

        try {
            // fullProve generates the proof and calculates the public signals
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, this.wasmPath, this.zkeyPath);
            console.log('[ZK] Proof Generated.');
            return { proof, publicSignals };
        } catch (error) {
            console.error('[ZK] Proof Generation Failed:', error);
            throw error;
        }
    }

    /**
     * Verify a ZK Proof.
     * @param {object} proof 
     * @param {array} publicSignals 
     * @returns {Promise<boolean>}
     */
    async verifyProof(proof, publicSignals) {
        console.log('[ZK] Verifying Proof...');

        if (!fs.existsSync(this.vKeyPath)) {
            console.error('[ZK] Verification Key not found.');
            return false;
        }

        try {
            const vKey = JSON.parse(fs.readFileSync(this.vKeyPath, 'utf-8'));
            const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
            return res;
        } catch (error) {
            console.error('[ZK] Verification Failed:', error);
            return false;
        }
    }
}

module.exports = new ZKService();
