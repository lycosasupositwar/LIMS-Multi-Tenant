import fs from 'fs';
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

const target = `      "analyse.nom": analysesData[0]?.nom || "Aucune analyse",
      "analyse.norme": analysesData[0]?.norme || "N/A",
      "resultats.tableau": reportAnalyses.length > 0 ? reportAnalyses.map((a: any) => Object.entries(a.results || {}).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ") : "Aucun résultat",`;

const replacement = `      "analyse.nom": analysesData[0]?.nom || "Aucune analyse",
      "analyse.norme": analysesData[0]?.norme || "N/A",
      "analyse.technicien": analysesData[0]?.technicien || "Non défini",
      "resultats.tableau": reportAnalyses.length > 0 ? reportAnalyses.map((a: any) => Object.entries(a.results || {}).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ") : "Aucun résultat",`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
