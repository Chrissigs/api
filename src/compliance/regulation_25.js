/**
 * THE SOVEREIGN BRIDGE - COMPLIANCE ENGINE
 * Regulation 25: Simplified Due Diligence (SDD)
 * 
 * Implements generic logic for checking "Letter of Equivalency" and "Status Warranty".
 * STRICTLY FIRM-AGNOSTIC.
 */

class Regulation25Checker {
    
    /**
     * Evaluates eligibility for SDD based on counterparty status.
     * @param {object} counterparty - The entity being evaluated (e.g., Bank_Node_A)
     * @param {object} evidence - The provided evidence (e.g., Letter of Equivalency)
     */
    evaluateEligibility(counterparty, evidence) {
        console.log(\[REG-25] Evaluating eligibility for: \\);

        // Check 1: Is the counterparty from an Equivalent Jurisdiction?
        if (!this.isEquivalentJurisdiction(counterparty.jurisdiction)) {
            console.log('[REG-25] FAIL: Jurisdiction not equivalent.');
            return false;
        }

        // Check 2: Valid Letter of Equivalency?
        if (!evidence.letter_of_equivalency || !evidence.letter_of_equivalency.valid) {
            console.log('[REG-25] FAIL: Missing or invalid Letter of Equivalency.');
            return false;
        }

        console.log('[REG-25] PASS: Entity eligible for Simplified Due Diligence.');
        return true;
    }

    isEquivalentJurisdiction(jurisdictionCode) {
        // List of AMLSG Schedule 3 Equivalent Jurisdictions
        const whitelist = ['KY', 'US', 'UK', 'CA', 'SG', 'HK'];
        return whitelist.includes(jurisdictionCode);
    }
}

module.exports = new Regulation25Checker();
