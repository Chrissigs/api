const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const AUDIT_LOG_PATH = path.join(__dirname, '../audit_ledger.jsonl');
const OUTPUT_PATH = path.join(__dirname, '../Certificate_of_Reliance.pdf');

function generateCertificate() {
    console.log('Generating Certificate of Reliance...');

    if (!fs.existsSync(AUDIT_LOG_PATH)) {
        console.error('Error: audit_ledger.jsonl not found.');
        process.exit(1);
    }

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(OUTPUT_PATH);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('CERTIFICATE OF RELIANCE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('This document certifies the chronological sequence of reliance events recorded by the Protocol System.', { align: 'center' });
    doc.moveDown(2);

    // Table Header
    const tableTop = 200;
    const col1 = 50;
    const col2 = 200;
    const col3 = 350;
    const col4 = 450;

    doc.font('Helvetica-Bold');
    doc.text('Timestamp', col1, tableTop);
    doc.text('Transaction ID', col2, tableTop);
    doc.text('Action', col3, tableTop);
    doc.text('Status', col4, tableTop);
    doc.font('Helvetica');

    // Draw Line
    doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;
    const fileStream = fs.createReadStream(AUDIT_LOG_PATH);
    const readline = require('readline');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    rl.on('line', (line) => {
        if (!line) return;
        try {
            const entry = JSON.parse(line);

            // Check for page break
            if (y > 700) {
                doc.addPage();
                y = 50;
            }

            doc.fontSize(8);
            doc.text(entry.timestamp, col1, y);
            doc.text(entry.transaction_id, col2, y);
            doc.text(entry.action, col3, y);

            if (entry.status === 'SUCCESS') {
                doc.fillColor('green').text(entry.status, col4, y);
            } else {
                doc.fillColor('red').text(entry.status, col4, y);
            }
            doc.fillColor('black'); // Reset

            y += 15;
        } catch (err) {
            console.warn('Skipping malformed line');
        }
    });

    rl.on('close', () => {
        // Signature Block
        doc.addPage();
        doc.moveDown(5);
        doc.fontSize(12).text('I hereby certify that the above record is a true and accurate representation of the system audit logs.', { align: 'left' });
        doc.moveDown(4);
        doc.text('_________________________________', { align: 'left' });
        doc.text('Authorized Signatory', { align: 'left' });
        doc.text('[REGULATORY AUDITOR]', { align: 'left' });

        doc.end();
        console.log(`Certificate generated at: ${OUTPUT_PATH}`);
    });
}

generateCertificate();
