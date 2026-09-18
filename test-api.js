import fs from 'fs';
import libre from 'libreoffice-convert';
import { promisify } from 'util';

const libreConvertAsync = promisify(libre.convert);

async function test() {
  try {
    const docxBuf = fs.readFileSync('test.txt'); // use text file for now
    console.log("Converting...");
    const pdfBuf = await libreConvertAsync(docxBuf, '.pdf', undefined);
    console.log("Success! size:", pdfBuf.length);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
