import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Replace condition in patch-auto-tables
  code = code.replace(
    /if \(expected\?\.type === 'number_series' && Array\.isArray\(v\) && v\.length > 0\) \{/g,
    `if (Array.isArray(v) && v.length > 0) {`
  );

  // Add echantillons array to root
  const rootReturnMarker = `    return {\n      "tables_series": tables_series,`;
  const newRootReturn = `    return {\n      "echantillons": samps.map((s: any) => ({ ...s, materiau: s.materialState })),\n      "tables_series": tables_series,`;
  
  if (!code.includes('"echantillons": samps.map')) {
      code = code.replace(rootReturnMarker, newRootReturn);
  }

  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
