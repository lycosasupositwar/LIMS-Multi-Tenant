import fs from 'fs';

function fixCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // We want to replace the resultats.tableau line:
  // "resultats.tableau": reportAnalyses.length > 0 ? reportAnalyses.map((a: any) => Object.entries(a.results || {}).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ") : "Aucun résultat",
  // With something that maps the field keys to field names.

  // First, find the right replacement for getDocData/buildDocData
  let isModal = filePath.includes('Modal');
  
  const replacer = isModal 
    ? `"resultats.tableau": reportAnalyses.length > 0 ? reportAnalyses.map((a: any) => {
        const t = analysisTemplates.find(tpl => tpl.id === a.templateId);
        return Object.entries(a.results || {}).map(([k, v]) => {
          const fieldName = t?.expectedResults?.find(er => er.id === k)?.name || k;
          return \`\${fieldName}: \${v}\`;
        }).join(", ");
      }).join(" | ") : "Aucun résultat",`
    : `"resultats.tableau": anals.length > 0 ? anals.map((a: any) => {
        const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
        return Object.entries(a.results || {}).map(([k, v]) => {
          const fieldName = t?.expectedResults?.find((er: any) => er.id === k)?.name || k;
          return \`\${fieldName}: \${v}\`;
        }).join(", ");
      }).join(" | ") : "Aucun résultat",`;

  if (isModal) {
     code = code.replace(/"resultats\.tableau": reportAnalyses\.length > 0 \? reportAnalyses\.map.*/, replacer);
     // Also fix technicien to pull from an analysis that actually has a technician if the first one doesn't
     code = code.replace(
       /"analyse\.technicien": analysesData\[0\]\?\.technicien \|\| "Non défini",/,
       `"analyse.technicien": analysesData.find(a => a.technicien && a.technicien !== 'Non assigné')?.technicien || analysesData[0]?.technicien || "Non défini",`
     );
  } else {
     code = code.replace(/"resultats\.tableau": anals\.length > 0 \? anals\.map.*/, replacer);
     code = code.replace(
       /"analyse\.technicien": analysesData\[0\]\?\.technicien \|\| "Non défini",/,
       `"analyse.technicien": analysesData.find(a => a.technicien && a.technicien !== 'Non assigné')?.technicien || analysesData[0]?.technicien || "Non défini",`
     );
  }

  // Also fix the `valeurs` array inside analysesData mapping so that {cle, valeur} uses human readable names
  const valsRegex = /valeurs: Object\.entries\(a\.results \|\| \{\}\)\.map\(\(\[k, v\]\) => \(\{ cle: k, valeur: v \}\)\)/g;
  code = code.replace(valsRegex, `valeurs: Object.entries(a.results || {}).map(([k, v]) => ({ cle: t?.expectedResults?.find((er: any) => er.id === k)?.name || k, valeur: v }))`);

  fs.writeFileSync(filePath, code);
}

fixCode('src/components/ReportPreviewModal.tsx');
fixCode('src/views/Reports.tsx');

