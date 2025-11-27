pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template IdentityCircuit() {
    // Private inputs
    signal input private_legal_name;
    signal input private_tin;
    signal input private_nationality;
    
    // Public output
    signal output public_identity_hash;

    // Use Poseidon hash for efficiency in ZK
    component poseidon = Poseidon(3);
    poseidon.inputs[0] <== private_legal_name;
    poseidon.inputs[1] <== private_tin;
    poseidon.inputs[2] <== private_nationality;

    public_identity_hash <== poseidon.out;
}

component main = IdentityCircuit();
