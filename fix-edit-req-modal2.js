import fs from 'fs';
let code = fs.readFileSync('src/components/EditRequestModal.tsx', 'utf8');

code = code.replace(/const \{ requestTemplates, resubmitRequest \} = useLims\(\);/, 'const { requestTemplates, resubmitRequest, analysisTemplates } = useLims();');

fs.writeFileSync('src/components/EditRequestModal.tsx', code);
