import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Remove <w:tblStyle w:val="TableGrid"/>
  code = code.replace(/<w:tblStyle w:val="TableGrid"\/>/g, '');

  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
