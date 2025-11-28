pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template IdentityCircuit() {
    // Private inputs (Hashes of the original data, as integers)
    signal input private_legal_name_hash;
    signal input private_tin_hash;
    signal input private_nationality_hash;
    
    // Public output
    signal output public_identity_hash;

    // Use Poseidon hash for efficiency in ZK
    component poseidon = Poseidon(3);
    poseidon.inputs[0] <== private_legal_name_hash;
    poseidon.inputs[1] <== private_tin_hash;
    poseidon.inputs[2] <== private_nationality_hash;

    public_identity_hash <== poseidon.out;
}

component main = IdentityCircuit();
