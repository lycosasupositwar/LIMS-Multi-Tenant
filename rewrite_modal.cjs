const fs = require('fs');
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

// Add states
code = code.replace(/const docxContainerRef = useRef<HTMLDivElement>\(null\);/, 
`const docxContainerRef = useRef<HTMLDivElement>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);`);
  
// Fix doc.render and add backend conversion
code = code.replace(/doc\.render\(\{[\s\S]*?renderAsync\(out, docxContainerRef\.current, undefined, \{ className: "docx-preview-container", inWrapper: false, ignoreLastRenderedPageBreak: false \}\);/g, 
`doc.render({
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
          });`);
          
code = code.replace(/<div ref=\{docxContainerRef\} className="w-full docx-wrapper"><\/div>/, 
`{isGeneratingPdf ? (
                <div className="flex flex-col items-center justify-center p-20 text-slate-500">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                  <p>Génération du PDF Haute-Fidélité (LibreOffice)...</p>
                </div>
              ) : pdfPreviewUrl ? (
                <iframe src={pdfPreviewUrl} className="w-full min-h-[800px] border-0 rounded-lg shadow-sm bg-white" />
              ) : (
                <div ref={docxContainerRef} className="hidden"></div>
              )}`);
              
code = code.replace(/const generatePDF = \(\) => \{[\s\S]*?html2pdf\(\)\.set\(opt\)\.from\(element\)\.save\(\);\s*\};/, 
`const generatePDF = () => {
    if (report.templateId && pdfPreviewUrl) {
      const a = document.createElement("a");
      a.href = pdfPreviewUrl;
      a.download = \`Rapport_\${report.id}.pdf\`;
      a.click();
      return;
    }

    const element = pdfRef.current;
    if (!element) return;
    const opt = {
      margin:       10,
      filename:     \`rapport-\${report.id}.pdf\`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };`);
  
fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
