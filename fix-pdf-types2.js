import fs from 'fs';
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

code = code.replace(/orientation: 'portrait'/g, "orientation: 'portrait' as const");
code = code.replace(/unit: 'mm'/g, "unit: 'mm' as const");
code = code.replace(/format: 'a4'/g, "format: 'a4' as const");

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
