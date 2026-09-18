import fs from 'fs';
let code = fs.readFileSync('src/views/Reports.tsx', 'utf8');

const target1 = `      "analyse.nom": analysesData[0]?.nom || "Aucune analyse",
      "analyse.norme": analysesData[0]?.norme || "N/A",
      "resultats.tableau": anals.length > 0 ? anals.map((a: any) => Object.entries(a.results || {}).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ") : "Aucun résultat",`;

const rep1 = `      "analyse.nom": analysesData[0]?.nom || "Aucune analyse",
      "analyse.norme": analysesData[0]?.norme || "N/A",
      "analyse.technicien": analysesData[0]?.technicien || "Non défini",
      "resultats.tableau": anals.length > 0 ? anals.map((a: any) => Object.entries(a.results || {}).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ") : "Aucun résultat",`;

code = code.replace(target1, rep1);

const target2 = `const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });`;

const rep2 = `const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: "{{", end: "}}" }, nullGetter: (part) => { return ""; },
        });`;

code = code.replace(target2, rep2);

fs.writeFileSync('src/views/Reports.tsx', code);
