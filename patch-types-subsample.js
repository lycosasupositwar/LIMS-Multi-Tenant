import fs from 'fs';

let code = fs.readFileSync('src/types.ts', 'utf8');

const target = `export interface Sample {
  id: string;
  requestId?: string;
  barcode: string;`;

const replacement = `export interface Sample {
  id: string;
  parentSampleId?: string;
  requestId?: string;
  barcode: string;`;

code = code.replace(target, replacement);

fs.writeFileSync('src/types.ts', code);
