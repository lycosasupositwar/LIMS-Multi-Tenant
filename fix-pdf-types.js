import fs from 'fs';
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

code = code.replace(/\{ type: 'jpeg', quality: 0\.98 \}/g, "{ type: 'jpeg' as const, quality: 0.98 }");

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
