import fs from 'fs';
let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

// Replace the literal "\n" in the JSX
code = code.replace(/\\n\s*\{builderTab === 'reports'/g, "\n            {builderTab === 'reports'");

fs.writeFileSync('src/views/BuilderCMS.tsx', code);
