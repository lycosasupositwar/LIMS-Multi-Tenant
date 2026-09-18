import fs from 'fs';

let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

// Replace the duplicated blocks
code = code.replace(/analyse: \{[\s\S]*?images: \{[\s\S]*?\},[\s\S]*?analyse: \{/g, 'analyse: {');

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
