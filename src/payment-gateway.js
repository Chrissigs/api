/**
 * Payment Gateway Service (Mock)
 * 
 * Simulates the Bank's internal Core Banking System or connection to a Real-Time Gross Settlement (RTGS) rail.
 * Ensures "Delivery vs Payment" (DvP) by confirming funds transfer before the Token is issued.
 */

class PaymentGateway {
    constructor() {
        // Mock Account Ledger
        this.accounts = {
            'ACC-998877': { balance: 1000000, currency: 'KYD', name: 'John Doe' },
            'ACC-112233': { balance: 5000, currency: 'KYD', name: 'Small Investor' }
        };
    }

    /**
     * Process a payment from a client account.
     * @param {string} accountId - Source Account Number
     * @param {number} amount - Amount to debit
     * @param {string} currency - Currency code (e.g., 'KYD', 'USD')
     * @returns {Promise<object>} { success: boolean, transactionRef: string, error?: string }
     */
    async processPayment(accountId, amount, currency) {
        console.log(`[PAYMENT GATEWAY] Processing transfer: ${amount} ${currency} from ${accountId}...`);

        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 500));

        const account = this.accounts[accountId];

        // 1. Validate Account
        if (!account) {
            // For demo purposes, if account ID starts with 'VALID', we treat it as a generic valid account with infinite funds
            if (accountId.startsWith('VALID')) {
                return this._successResponse();
            }
            console.error('[PAYMENT GATEWAY] Account not found.');
            return { success: false, error: 'ACCOUNT_NOT_FOUND' };
        }

        // 2. Validate Currency
        if (account.currency !== currency) {
            console.error(`[PAYMENT GATEWAY] Currency mismatch. Account: ${account.currency}, Req: ${currency}`);
            return { success: false, error: 'CURRENCY_MISMATCH' };
        }

        // 3. Validate Funds
        if (account.balance < amount) {
            console.error(`[PAYMENT GATEWAY] Insufficient funds. Balance: ${account.balance}, Req: ${amount}`);
            return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }

        // 4. Execute Transfer (Update Ledger)
        account.balance -= amount;
        console.log(`[PAYMENT GATEWAY] Transfer successful. New Balance: ${account.balance}`);

        return this._successResponse();
    }

    _successResponse() {
        return {
            success: true,
            transactionRef: `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new PaymentGateway();
