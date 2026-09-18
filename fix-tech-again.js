import fs from 'fs';

function fixCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Remove the floating assignedAnalyst definitions
  code = code.replace(/const assignedAnalyst = users\.find.*?;\n/g, '');

  // Fix inside buildDocData / getDocData
  if (filePath.includes('Modal')) {
    code = code.replace(
      /\|\| assignedAnalyst \|\|/g,
      `|| users.find(u => u.id === request?.assignedTo)?.name ||`
    );
  } else {
    code = code.replace(
      /\|\| assignedAnalyst \|\|/g,
      `|| users.find(u => u.id === req?.assignedTo)?.name ||`
    );
  }

  fs.writeFileSync(filePath, code);
}
fixCode('src/components/ReportPreviewModal.tsx');
fixCode('src/views/Reports.tsx');
