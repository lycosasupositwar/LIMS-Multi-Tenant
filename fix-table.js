import fs from 'fs';

function fixCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Regex was too strict. Let's do a simpler replace.
  code = code.replace(/\}\)\.join\(\", \"\);\n\s+\}\)\.join\(\" \| \"\)/g, '}).join("\\n");\n      }).join("\\n---\\n")');

  fs.writeFileSync(filePath, code);
}
fixCode('src/components/ReportPreviewModal.tsx');
fixCode('src/views/Reports.tsx');
