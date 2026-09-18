import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';

// Create a minimal docx file to test
// Let's test if doc.render({ "demande.id": "123" }) works vs doc.render({ demande: { id: "123" } })
// I can't easily create a docx here. Let's just create a dummy one and test docxtemplater.
