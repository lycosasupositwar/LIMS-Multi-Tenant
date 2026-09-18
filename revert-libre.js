import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const importStatement = `import libre from 'libreoffice-convert';
import { promisify } from 'util';
const libreConvertAsync = promisify(libre.convert);\n`;

code = code.replace(/import cookieParser from 'cookie-parser';\n/, "import cookieParser from 'cookie-parser';\n" + importStatement);

const endpoint = `
  const tempPdfs = new Map();
  app.get('/api/temp-pdf/:id', (req, res) => {
    const pdf = tempPdfs.get(req.params.id);
    if (!pdf) return res.status(404).send('PDF not found or expired');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    res.send(pdf.buffer);
  });

  app.post('/api/convert-pdf', async (req, res) => {
    try {
      const { docxBase64 } = req.body;
      if (!docxBase64) return res.status(400).json({ error: 'Missing docxBase64' });
      const docxBuf = Buffer.from(docxBase64, 'base64');
      const pdfBuf = await libreConvertAsync(docxBuf, '.pdf', undefined);
      
      const id = crypto.randomUUID();
      tempPdfs.set(id, { buffer: pdfBuf, timestamp: Date.now() });
      
      for (const [key, value] of tempPdfs.entries()) {
        if (Date.now() - value.timestamp > 3600000) tempPdfs.delete(key);
      }
      
      res.json({ 
        pdfBase64: pdfBuf.toString('base64'),
        pdfUrl: \`/api/temp-pdf/\${id}\`
      });
    } catch (error) {
      console.error('PDF conversion error:', error);
      res.status(500).json({ error: 'Error generating PDF' });
    }
  });
`;

code = code.replace(/\/\/\s*Vite middleware for development/, endpoint + '\n  // Vite middleware for development');
// also remove the old tempPdfs if it's there
code = code.replace(/const tempPdfs = new Map\(\);\n  app\.get\('\/api\/temp-pdf\/:id',[\s\S]*?res\.send\(pdf\.buffer\);\n  \}\);\n/, '');

fs.writeFileSync('server.ts', code);
