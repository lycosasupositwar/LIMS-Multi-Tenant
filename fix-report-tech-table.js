import fs from 'fs';

function fixCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Fix technicien
  code = code.replace(
    /const manager = (.*?);/,
    `const manager = $1;\n          const assignedAnalyst = users.find((u: any) => u.id === req?.assignedTo)?.name;`
  );
  code = code.replace(
    /const manager = users.find\((.*?)\); \/\/ Mocking the approver/,
    `const manager = users.find($1);\n  const assignedAnalyst = users.find(u => u.id === request?.assignedTo)?.name;`
  );

  code = code.replace(
    /"analyse\.technicien": analysesData\.find\(a => a\.technicien && a\.technicien !== 'Non assigné'\)\?\.technicien \|\| analysesData\[0\]\?\.technicien \|\| "Non défini",/g,
    `"analyse.technicien": analysesData.find(a => a.technicien && a.technicien !== 'Non assigné')?.technicien || assignedAnalyst || analysesData[0]?.technicien || "Non défini",`
  );

  // Fix resultats.tableau to use \n
  code = code.replace(
    /return Object\.entries\(a\.results \|\| \{\}\)\.map\(\(\[k, v\]\) => \{\n(.*?)return \`\$\{\w+\}: \$\{v\}\`;\n(.*?) \}\)\.join\(\", \"\);\n(.*?) \}\)\.join\(\" \| \"\) \: \"Aucun résultat\"/g,
    `return Object.entries(a.results || {}).map(([k, v]) => {\n$1return \`\${fieldName}: \${v}\`;\n$2 }).join("\\n");\n$3 }).join("\\n---\\n") : "Aucun résultat"`
  );

  fs.writeFileSync(filePath, code);
}

fixCode('src/components/ReportPreviewModal.tsx');
fixCode('src/views/Reports.tsx');
