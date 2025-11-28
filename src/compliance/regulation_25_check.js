/**
 * CAYMAN DIGITAL RELIANCE FRAMEWORK
 * Module: Regulation 25 Compliance Engine
 * 
 * Verifies "Schedule 3 Equivalence" and "Eligible Introducer Status".
 */

const SCHEDULE_3_JURISDICTIONS = ['KY', 'US', 'UK', 'CA', 'SG', 'HK', 'JP', 'AU'];

class Regulation25Check {
    
    /**
     * Verifies if a counterparty is an Eligible Introducer under Regulation 25.
     * @param {object} introducerProfile 
     */
    verifyEligibleIntroducer(introducerProfile) {
        console.log(\[COMPLIANCE] Verifying Eligible Introducer: \\);

        // Check 1: Schedule 3 Equivalence
        if (!SCHEDULE_3_JURISDICTIONS.includes(introducerProfile.jurisdiction)) {
            console.warn(\[COMPLIANCE] FAIL: Jurisdiction \ not in Schedule 3.\);
            return { eligible: false, reason: 'NON_EQUIVALENT_JURISDICTION' };
        }

        // Check 2: Regulated Status
        if (!introducerProfile.is_regulated) {
            console.warn('[COMPLIANCE] FAIL: Entity is not regulated in home jurisdiction.');
            return { eligible: false, reason: 'UNREGULATED_ENTITY' };
        }

        console.log('[COMPLIANCE] PASS: Entity is an Eligible Introducer.');
        return { eligible: true, status: 'VERIFIED' };
    }
}

module.exports = new Regulation25Check();
