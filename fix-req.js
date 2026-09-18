import fs from 'fs';
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');
code = code.replace(/req\?\.assignedTo/g, 'request?.assignedTo');
fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
