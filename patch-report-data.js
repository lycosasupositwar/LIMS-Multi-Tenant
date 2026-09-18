import fs from 'fs';
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

const target = `      demande: { id: request?.id || "N/A" },
      date: { jour: new Intl.DateTimeFormat("fr-FR").format(new Date()) },
      demandeur: {
        nom: client?.name || reportSamples[0]?.client || "Non renseigné",
        email: client?.email || "Non renseigné",
        entreprise: client?.company || reportSamples[0]?.client || "Non renseigné",
      },
      echantillon: {
        id: reportSamples[0]?.id || "N/A",
        barcode: reportSamples[0]?.barcode || "N/A",
        materiau: reportSamples[0]?.materialState || "N/A",        
        projet: reportSamples[0]?.project || "N/A",
      },`;

const replacement = `      demande: { 
        id: request?.id || "N/A",
        custom: request?.customData || {}
      },
      date: { jour: new Intl.DateTimeFormat("fr-FR").format(new Date()) },
      demandeur: {
        nom: client?.name || reportSamples[0]?.client || "Non renseigné",
        email: client?.email || "Non renseigné",
        entreprise: client?.company || reportSamples[0]?.client || "Non renseigné",
      },
      echantillon: {
        id: reportSamples[0]?.id || "N/A",
        barcode: reportSamples[0]?.barcode || "N/A",
        materiau: reportSamples[0]?.materialState || "N/A",        
        projet: reportSamples[0]?.project || "N/A",
        custom: reportSamples[0]?.customData || {}
      },`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
