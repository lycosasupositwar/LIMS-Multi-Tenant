import fs from 'fs';

let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

const replacement = `  useEffect(() => {
    if (report?.templateId && docxContainerRef.current) {
      const template = reportTemplates?.find((t: any) => t.id === report.templateId);
      if (template && template.fileData) {
        try {
          setDocxError(null);
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
          const reqAnalyses = analyses.filter((a: any) => report.sampleIds.includes(a.sampleId));
          
          const docData = {
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
          };

          doc.render(docData);
          const out = doc.getZip().generate({ type: "base64" });
          
          setIsGeneratingPdf(true);
          fetch('/api/convert-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docxBase64: out })
          })
          .then(res => {
            if (!res.ok) throw new Error("Erreur de conversion serveur");
            return res.json();
          })
          .then(data => {
            const pdfBytes = atob(data.pdfBase64);
            const pdfLen = pdfBytes.length;
            const pdfArr = new Uint8Array(pdfLen);
            for (let i = 0; i < pdfLen; i++) {
              pdfArr[i] = pdfBytes.charCodeAt(i);
            }
            const blob = new Blob([pdfArr], { type: "application/pdf" });
            setPdfPreviewUrl(URL.createObjectURL(blob));
            setIsGeneratingPdf(false);
          })
          .catch(e => {
            console.error(e);
            setDocxError("Impossible de convertir le modèle en PDF.");
            setIsGeneratingPdf(false);
          });
        } catch(e: any) {
          console.warn("Docx render error", e);
          if (e.properties && e.properties.errors instanceof Array) {
            const errorMessages = e.properties.errors.map((err: any) => err.properties.explanation || err.message).join(", ");
            setDocxError("Erreur dans le modèle Word : " + errorMessages);
          } else {
            setDocxError("Erreur lors de la génération de l'aperçu du document : " + e.message);
          }
          setIsGeneratingPdf(false);
        }
      }
    }
  }, [report, docxContainerRef.current]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', { 
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString));
  };

  const generateDOCX = () => {
    if (report?.templateId) {
      const template = reportTemplates?.find((t: any) => t.id === report.templateId);
      if (template && template.fileData) {
        try {
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
          const reqAnalyses = analyses.filter((a: any) => report.sampleIds.includes(a.sampleId));
          
          doc.render({
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
          });

          const out = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(out);
          a.download = \`Rapport_\${report.id}.docx\`;
          a.click();
        } catch(e) {
          console.warn(e);
        }
      }
    }
  };`;

const lines = code.split('\n');
const before = lines.slice(0, 41).join('\n');
const after = lines.slice(104).join('\n');

fs.writeFileSync('src/components/ReportPreviewModal.tsx', before + '\n' + replacement + '\n' + after);
