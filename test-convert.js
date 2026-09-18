import fs from 'fs';
import { convert } from 'libreoffice-convert';
import { promisify } from 'util';
const libreConvertAsync = promisify(convert);
const testText = "Hello World";
const out = await libreConvertAsync(Buffer.from(testText), '.pdf', undefined);
console.log("PDF length:", out.length);
