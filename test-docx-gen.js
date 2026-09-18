import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const content = fs.readFileSync('test.pdf'); // wait we don't have a docx template easily.
