import fs from 'fs';

let code = fs.readFileSync('src/types.ts', 'utf8');

const targetSettings = `  tableStyles?: {
    headerBgColor: string; // e.g. "E2E8F0"
    borderColor: string;   // e.g. "000000"
    borderSize: number;    // 0, 4, 8, etc.
  };
}`;

const newSettings = `  tableStyles?: {
    headerBgColor: string; // e.g. "E2E8F0"
    borderColor: string;   // e.g. "000000"
    borderSize: number;    // 0, 4, 8, etc.
  };
  idPrefixes?: {
    request: string;
    sample: string;
    subSample: string;
  };
}`;

code = code.replace(targetSettings, newSettings);
fs.writeFileSync('src/types.ts', code);
