import fs from 'fs';

let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

// Add console.log(docData) right before doc.render
code = code.replace(/doc\.render\(docData\);/, 'console.log("DOC_DATA:", JSON.stringify(docData, null, 2));\n          doc.render(docData);');
code = code.replace(/doc\.render\(\{[\s\S]*?demande:[\s\S]*?manager:[\s\S]*?\}\);/, 'console.log("DOC_DATA_2:", JSON.stringify({ demande: { id: request?.id } }));\n          $&');

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
