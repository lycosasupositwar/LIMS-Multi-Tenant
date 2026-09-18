import fs from 'fs';

let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

// The easiest way is to rewrite the entire doc.render({ ... }) block with a simple regex since it's used in two places.

const correctRenderBlock = `doc.render({
            demande: { id: request?.id || "" },
            date: { jour: new Intl.DateTimeFormat("fr-FR").format(new Date()) },
            demandeur: {
              nom: client?.name || "",
              email: client?.email || "",
              entreprise: client?.company || "",
            },
            echantillon: {
              id: reportSamples[0]?.id || "",
              barcode: reportSamples[0]?.barcode || "",
              materiau: reportSamples[0]?.materialState || "",
              projet: reportSamples[0]?.project || "",
            },
            analyse: {
              nom: analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.name || "",
              norme: analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.standardRef || "",
              technicien: reqAnalyses[0]?.technician || "",
              remarques: reqAnalyses[0]?.notes || "",
            },
            resultats: {
              tableau: reqAnalyses.map((a: any) => Object.entries(a.results).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ")
            },
            images: {
              galerie: "Images attachées au rapport"
            },
            manager: {
              nom: manager?.name || ""
            }
          });`;

code = code.replace(/doc\.render\(\{[\s\S]*?manager:\s*\{[\s\S]*?\}\s*\}\);/g, correctRenderBlock);

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
