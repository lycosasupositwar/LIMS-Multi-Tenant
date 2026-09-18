import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Instead of a complex regex, we'll replace everything from "const analysesData" up to "return baseObj;"
  const startMarker = "const sanitizeKey = (str: string) => str.normalize(\"NFD\")";
  const endMarker = "      return baseObj;";
  
  const replacement = `const sanitizeKey = (str: string) => str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '_');
      const series_resultats: any[] = [];
      
      Object.entries(a.results || {}).forEach(([k, v]) => {
         const expected = t?.expectedResults?.find((er: any) => er.id === k);
         const fieldName = expected?.name || k;
         const safeName = sanitizeKey(fieldName);
         
         baseObj[\`res_\${safeName}\`] = Array.isArray(v) ? v.join(', ') : v;
         
         if (Array.isArray(v)) {
            v.forEach((val, i) => {
               baseObj[\`res_\${safeName}_v\${i+1}\`] = val;
            });
            const numVals = v.map(Number).filter((n: number) => !isNaN(n));
            let mean: number | null = null;
            let stdDev: number | null = null;
            if (numVals.length > 0) {
               mean = numVals.reduce((sum: number, n: number) => sum + n, 0) / numVals.length;
               baseObj[\`res_\${safeName}_moyenne\`] = mean.toFixed(2);
               const variance = numVals.length > 1 ? numVals.reduce((sum: number, n: number) => sum + Math.pow(n - mean!, 2), 0) / (numVals.length - 1) : 0;
               stdDev = numVals.length > 1 ? Math.sqrt(variance) : 0;
               baseObj[\`res_\${safeName}_ecart\`] = stdDev.toFixed(2);
               baseObj[\`res_\${safeName}_stats\`] = \`\${mean.toFixed(2)} ± \${stdDev.toFixed(2)}\`;
            }
            
            if (expected?.type === 'number_series') {
               series_resultats.push({
                  nom_parametre: fieldName,
                  echantillon: a.sampleId,
                  v1: v[0] !== undefined ? v[0] : "-",
                  v2: v[1] !== undefined ? v[1] : "-",
                  v3: v[2] !== undefined ? v[2] : "-",
                  v4: v[3] !== undefined ? v[3] : "-",
                  v5: v[4] !== undefined ? v[4] : "-",
                  v6: v[5] !== undefined ? v[5] : "-",
                  v7: v[6] !== undefined ? v[6] : "-",
                  v8: v[7] !== undefined ? v[7] : "-",
                  v9: v[8] !== undefined ? v[8] : "-",
                  v10: v[9] !== undefined ? v[9] : "-",
                  stats: mean !== null && stdDev !== null ? \`\${mean.toFixed(2)} ± \${stdDev!.toFixed(2)}\` : "-",
                  moyenne: mean !== null ? mean.toFixed(2) : "-",
                  ecart_type: stdDev !== null ? stdDev.toFixed(2) : "-"
               });
            }
         }
      });
      
      baseObj.series_resultats = series_resultats;
      baseObj.has_series = series_resultats.length > 0;
      
      return baseObj;`;

  // We substring replace
  const startIndex = code.indexOf(startMarker);
  const endIndex = code.indexOf(endMarker, startIndex) + endMarker.length;
  
  if(startIndex > -1 && endIndex > -1) {
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  }
  
  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
