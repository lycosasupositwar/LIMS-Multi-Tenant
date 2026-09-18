import fs from 'fs';
import { convert } from 'libreoffice-convert';
import { promisify } from 'util';
const libreConvertAsync = promisify(convert);
const testText = "Hello World";
const out = await libreConvertAsync(Buffer.from(testText), '.pdf', undefined);
fs.writeFileSync('test.pdf', out);
