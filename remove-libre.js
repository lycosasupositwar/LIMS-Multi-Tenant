import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/import libre from 'libreoffice-convert';\nimport \{ promisify \} from 'util';\nconst libreConvertAsync = promisify\(libre\.convert\);\n/g, '');

const convertPdfRegex = /app\.post\('\/api\/convert-pdf', async \(req, res\) => \{[\s\S]*?\}\);/g;
code = code.replace(convertPdfRegex, '');

fs.writeFileSync('server.ts', code);

// Also remove from package.json
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete pkg.dependencies['libreoffice-convert'];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
