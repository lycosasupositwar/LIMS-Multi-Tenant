import fs from 'fs';
let code = fs.readFileSync('src/views/Reports.tsx', 'utf8');

const generatePdfLogic = `
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  const handleDownloadPDF = async (report: Report) => {
    const isDocx = !!report.templateId;
    if (isDocx) {
      setDownloadingReportId(report.id);
      try {
        const template = reportTemplates?.find((t: any) => t.id === report.templateId);
        if (!template || !template.fileData) throw new Error("Template not found");
        
        const base64Data = template.fileData.split(",")[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const zip = new PizZip(bytes);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: "{{", end: "}}" }, nullGetter: (part) => { return ""; },
        });
        
        const linkedSamples = samples.filter(s => report.sampleIds.includes(s.id));
        const reqAnalyses = analyses.filter((a: any) => report.sampleIds.includes(a.sampleId));
        
        let guessedRequestId = report?.requestId;
        if (!guessedRequestId && report?.title) {
          const matchedReq = requests.find(r => report.title.includes(r.title));
          if (matchedReq) guessedRequestId = matchedReq.id;
        }
      
        const request = guessedRequestId 
          ? requests.find(r => r.id === guessedRequestId)
          : (linkedSamples.length > 0 && linkedSamples[0].requestId 
              ? requests.find(r => r.id === linkedSamples[0].requestId) 
              : null);
              
        const client = request ? users.find(u => u.id === request.requesterId) : null;
        const manager = users.find(u => u.role === 'manager');

        const formatDate = (dateString: string) => {
          const d = new Date(dateString);
          return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
        };

        const docData = {
          "demande.id": request?.id || "N/A",
          "date.jour": new Intl.DateTimeFormat("fr-FR").format(new Date()),
          "demandeur.nom": client?.name || linkedSamples[0]?.client || "Non renseigné",
          "demandeur.email": client?.email || "Non renseigné",
          "demandeur.entreprise": client?.company || linkedSamples[0]?.client || "Non renseigné",
          "echantillon.id": linkedSamples[0]?.id || "N/A",
          "echantillon.barcode": linkedSamples[0]?.barcode || "N/A",
          "echantillon.materiau": linkedSamples[0]?.materialState || "N/A",
          "echantillon.projet": linkedSamples[0]?.project || "N/A",
          "analyse.nom": reqAnalyses[0] ? (analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.name || "Non défini") : "Aucune analyse",
          "analyse.norme": reqAnalyses[0] ? (analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.standardRef || "Non défini") : "N/A",
          "analyse.technicien": reqAnalyses[0]?.technician || "Non défini",
          "analyse.remarques": reqAnalyses[0]?.notes || "Aucune remarque",
          "resultats.tableau": reqAnalyses.length > 0 ? reqAnalyses.map((a: any) => Object.entries(a.results || {}).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ") : "Aucun résultat",
          "images.galerie": "Images attachées au rapport",
          "manager.nom": manager?.name || "Responsable non défini",
          demande: { id: request?.id || "N/A" },
          date: { jour: new Intl.DateTimeFormat("fr-FR").format(new Date()) },
          demandeur: {
            nom: client?.name || linkedSamples[0]?.client || "Non renseigné",
            email: client?.email || "Non renseigné",
            entreprise: client?.company || linkedSamples[0]?.client || "Non renseigné",
          },
          echantillon: {
            id: linkedSamples[0]?.id || "N/A",
            barcode: linkedSamples[0]?.barcode || "N/A",
            materiau: linkedSamples[0]?.materialState || "N/A",
            projet: linkedSamples[0]?.project || "N/A",
          },
          analyse: {
            nom: reqAnalyses[0] ? (analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.name || "Non défini") : "Aucune analyse",
            norme: reqAnalyses[0] ? (analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.standardRef || "Non défini") : "N/A",
            technicien: reqAnalyses[0]?.technician || "Non défini",
            remarques: reqAnalyses[0]?.notes || "Aucune remarque",
          },
          resultats: {
            tableau: reqAnalyses.length > 0 ? reqAnalyses.map((a: any) => Object.entries(a.results || {}).map(([k, v]) => \`\${k}: \${v}\`).join(", ")).join(" | ") : "Aucun résultat"
          },
          images: {
            galerie: "Images attachées au rapport"
          },
          manager: {
            nom: manager?.name || "Responsable non défini"
          }
        };

        doc.render(docData);
        const out = doc.getZip().generate({ type: "base64" });

        const res = await fetch('/api/convert-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docxBase64: out })
        });
        const data = await res.json();
        
        if (data.pdfBase64) {
          const a = document.createElement("a");
          a.href = "data:application/pdf;base64," + data.pdfBase64;
          a.download = \`Rapport_\${report.id}.pdf\`;
          a.click();
        } else if (data.error) {
          alert("Erreur de conversion: " + data.error);
        }
      } catch (e) {
        console.error("PDF Convert Error", e);
        alert("Erreur lors de la génération du PDF.");
      } finally {
        setDownloadingReportId(null);
      }
    } else {
      // Direct PDF from HTML is only easily supported inside the modal where the HTML is rendered
      setPreviewReport(report);
      alert("Veuillez cliquer sur 'Télécharger PDF' depuis l'aperçu pour les rapports HTML génériques.");
    }
  };
`;

code = code.replace(/const filteredReports = reports\.filter/g, generatePdfLogic + '\n  const filteredReports = reports.filter');

const btnReplace = `                    <button 
                      onClick={() => handleDownloadPDF(report)}
                      disabled={report.status !== 'genere' || downloadingReportId === report.id}
                      className={\`flex items-center \${report.status === 'genere' ? 'text-blue-600 hover:text-blue-900' : 'text-slate-300 cursor-not-allowed'}\`}
                      title="Télécharger PDF"
                    >
                      <Download className={\`w-4 h-4 sm:mr-1 \${downloadingReportId === report.id ? 'animate-bounce' : ''}\`} />
                      <span className="sr-only sm:not-sr-only sm:text-xs">PDF</span>
                    </button>`;
code = code.replace(/<button \s*disabled=\{report\.status !== 'genere'\}\s*className=\{\`flex items-center \$\{report\.status === 'genere' \? 'text-blue-600 hover:text-blue-900' : 'text-slate-300 cursor-not-allowed'\}\`\}\s*title="Télécharger"\s*>\s*<Download className="w-4 h-4 sm:mr-1" \/>\s*<span className="sr-only sm:not-sr-only sm:text-xs">PDF<\/span>\s*<\/button>/g, btnReplace);

fs.writeFileSync('src/views/Reports.tsx', code);
