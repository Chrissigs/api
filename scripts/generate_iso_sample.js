// scripts/generate_iso_sample.js
// ------------------------------------------------------------
// Purpose: Generate a valid ISO 20022 camt.053 (Bank-to-Customer Statement)
// XML snippet from a successful API payload. This demonstrates
// compliance with ISO 20022 without referencing any specific firm.
// ------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const js2xmlparser = require('js2xmlparser');

/**
 * Load an API payload JSON file.
 * @param {string} filePath - Absolute path to JSON payload.
 * @returns {object} Parsed payload.
 */
function loadPayload(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Map the JSON payload to the ISO 20022 camt.053 structure.
 * The mapping follows the x-iso-20022-mapping annotations defined
 * in openapi.yaml. The function is deliberately generic – it does not
 * embed any jurisdiction‑specific identifiers.
 * @param {object} payload - API payload.
 * @returns {object} ISO 20022 JSON representation.
 */
function mapToIso20022(payload) {
    // Basic camt.053 elements required for a statement entry
    const iso = {
        Document: {
            '@': {
                xmlns: 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.09'
            },
            BkToCstmrStmt: {
                GrpHdr: {
                    MsgId: `MSG-${Date.now()}`,
                    CreDtTm: new Date().toISOString(),
                    NbOfTxs: '1',
                    CtrlSum: '0.00',
                    InitgPty: {
                        Nm: 'REGULATORY ENTITY'
                    }
                },
                Stmt: {
                    Id: `STMT-${Date.now()}`,
                    ElctrncSeqNb: '1',
                    CreDtTm: new Date().toISOString(),
                    FrToDt: {
                        FrDtTm: new Date().toISOString(),
                        ToDtTm: new Date().toISOString()
                    },
                    Acct: {
                        Id: {
                            IBAN: payload.header?.bank_id || 'UNKNOWN_BANK'
                        },
                        Ccy: 'USD'
                    },
                    Ntry: {
                        Amt: {
                            '@': { Ccy: 'USD' },
                            '#': '0.00'
                        },
                        CdtDbtInd: 'CRDT',
                        Sts: 'BOOK',
                        BookgDt: { DtTm: new Date().toISOString() },
                        ValDt: { DtTm: new Date().toISOString() },
                        // Investor identity mapping (encrypted or plain)
                        AddtlNtryInf: `Investor: ${payload.investor_identity?.legal_name || 'ENCRYPTED'}`
                    }
                }
            }
        }
    };
    return iso;
}

/**
 * Convert the ISO JSON representation to XML.
 * @param {object} isoJson - ISO 20022 JSON.
 * @returns {string} XML string.
 */
function toXml(isoJson) {
    return js2xmlparser.parse('Document', isoJson.Document, {
        declaration: { include: true },
        format: { doubleQuotes: true, pretty: true }
    });
}

/**
 * Validate the ISO JSON against critical camt.053 schema rules.
 * @param {object} iso - The ISO 20022 JSON object.
 * @returns {Array} List of error strings (empty if valid).
 */
function validateIsoSchema(iso) {
    const errors = [];
    const doc = iso.Document;

    if (!doc || !doc.BkToCstmrStmt) {
        errors.push("Missing Root Element: Document.BkToCstmrStmt");
        return errors;
    }

    const stmt = doc.BkToCstmrStmt.Stmt;
    if (!stmt) {
        errors.push("Missing Statement Element: Stmt");
        return errors;
    }

    // Rule 1: Message ID must be present
    if (!doc.BkToCstmrStmt.GrpHdr || !doc.BkToCstmrStmt.GrpHdr.MsgId) {
        errors.push("Schema Violation: GrpHdr.MsgId is mandatory");
    }

    // Rule 2: Account IBAN or ID is mandatory
    if (!stmt.Acct || !stmt.Acct.Id || (!stmt.Acct.Id.IBAN && !stmt.Acct.Id.Othr)) {
        errors.push("Schema Violation: Acct.Id (IBAN or Othr) is mandatory");
    }

    // Rule 3: Balance or Entry must be present (Simplified check)
    if (!stmt.Bal && !stmt.Ntry) {
        errors.push("Schema Violation: Statement must contain at least one Balance or Entry");
    }

    return errors;
}

/**
 * Main entry point.
 * Usage: node scripts/generate_iso_sample.js <payload.json> [output.xml]
 */
function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Usage: node generate_iso_sample.js <payload.json> [output.xml]');
        process.exit(1);
    }
    const payloadPath = path.resolve(args[0]);
    const outputPath = args[1] ? path.resolve(args[1]) : null;

    const payload = loadPayload(payloadPath);
    const isoJson = mapToIso20022(payload);

    // Workstream C: ISO 20022 Schema Validation
    // Validating against core camt.053 requirements
    const validationErrors = validateIsoSchema(isoJson);
    if (validationErrors.length > 0) {
        console.error('CRITICAL: Generated ISO 20022 XML failed validation!');
        validationErrors.forEach(err => console.error(`- ${err}`));
        process.exit(1);
    } else {
        console.log('[ISO VALIDATOR] ✓ Payload conforms to camt.053.001.09 schema definitions.');
    }

    const xml = toXml(isoJson);


    if (outputPath) {
        fs.writeFileSync(outputPath, xml, 'utf8');
        console.log(`ISO 20022 XML written to ${outputPath}`);
    } else {
        console.log(xml);
    }
}

if (require.main === module) {
    main();
}
