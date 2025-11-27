/**
 * Verification Script: Workstream D (ISO 20022)
 * Tests the JSON to XML transformation
 */

const { generateISO20022XML } = require('./generate_iso_sample');
const fs = require('fs');
const path = require('path');

function runTest() {
    console.log('[TEST] Starting Workstream D Verification: ISO 20022 Crystallization');

    // 1. Create Sample Payload
    const samplePayload = {
        header: {
            transaction_id: 'TX-123456789',
            bank_id: 'BANK_US_01',
            timestamp: new Date().toISOString()
        },
        investor_identity: {
            legal_name: 'Johnathan Doe', // Note: In Phase II this might be encrypted, 
            // but the generator might need to handle decrypted data 
            // OR simply pass through the encrypted blob in a specific field.
            // The current generator maps legal_name -> Nm.
            Nm: {
                FrstNm: 'Johnathan',
                Srnm: 'Doe'
            },
            PstlAdr: {
                StrtNm: '123 Main St',
                TwnNm: 'New York',
                Ctry: 'US',
                PstCd: '10001'
            },
            date_of_birth: '1980-01-01',
            nationality: 'US',
            tax_residency: [
                { country: 'US', tin: '123-456-789' }
            ]
        }
    };

    console.log('[TEST] Generating XML from sample payload...');

    try {
        const xml = generateISO20022XML(samplePayload);

        // 2. Verify Output Structure
        if (!xml.includes('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">')) {
            throw new Error('Missing ISO 20022 Namespace');
        }
        if (!xml.includes('<FrstNm>Johnathan</FrstNm>')) {
            throw new Error('Missing First Name mapping');
        }
        if (!xml.includes('<MsgId>TX-123456789</MsgId>')) {
            throw new Error('Missing Transaction ID mapping');
        }

        console.log('[TEST] Generated XML Snippet:');
        console.log(xml.substring(0, 200) + '...');
        console.log('[TEST] ✓ Workstream D Verification Passed: XML generation successful.');

    } catch (error) {
        console.error('[TEST] ✗ Verification FAILED:', error.message);
        process.exit(1);
    }
}

runTest();
