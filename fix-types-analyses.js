import fs from 'fs';
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(/type: 'text' \| 'number' \| 'number_series' \| 'select' \| 'boolean' \| 'multiselect' \| 'date';/, "type: 'text' | 'number' | 'number_series' | 'select' | 'boolean' | 'multiselect' | 'date' | 'analyses' | 'image';");

fs.writeFileSync('src/types.ts', code);
