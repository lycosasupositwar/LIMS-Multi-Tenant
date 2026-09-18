import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Fix echantillons mapping in ReportPreviewModal (uses reportSamples)
  if (filePath.includes('Modal')) {
    code = code.replace(
      /"echantillons": samps\.map/g,
      `"echantillons": reportSamples.map`
    );
  }

  // Also verify Reports.tsx has samps (it is passed as an argument in buildDocData)
  
  fs.writeFileSync(filePath, code);
}

updateFile('src/components/ReportPreviewModal.tsx');
