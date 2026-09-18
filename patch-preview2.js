import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  if (filePath.includes('Modal')) {
    code = code.replace(
      /anals\.forEach\(/g,
      `reportAnalyses.forEach(`
    );
  }

  fs.writeFileSync(filePath, code);
}

updateFile('src/components/ReportPreviewModal.tsx');
