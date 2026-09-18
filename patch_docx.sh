#!/bin/bash
sed -i '/const formatDate = (dateString: string) => {/i \
  useEffect(() => {\
    if (report.templateId && docxContainerRef.current) {\
      const template = reportTemplates?.find((t: any) => t.id === report.templateId);\
      if (template && template.fileData) {\
        try {\
          setDocxError(null);\
          const base64Data = template.fileData.split(",")[1];\
          const binaryString = atob(base64Data);\
          const len = binaryString.length;\
          const bytes = new Uint8Array(len);\
          for (let i = 0; i < len; i++) {\
            bytes[i] = binaryString.charCodeAt(i);\
          }\
          const zip = new PizZip(bytes);\
          const doc = new Docxtemplater(zip, {\
            paragraphLoop: true,\
            linebreaks: true,\
          });\
          const reqAnalyses = analyses.filter((a: any) => report.sampleIds.includes(a.sampleId));\
          doc.render({\
            demande: {\
              id: request?.id || "",\
            },\
            date: {\
              jour: new Intl.DateTimeFormat("fr-FR").format(new Date()),\
            },\
            demandeur: {\
              nom: client?.name || "",\
              email: client?.email || "",\
              entreprise: client?.company || "",\
            },\
            echantillon: {\
              id: reportSamples[0]?.id || "",\
              barcode: reportSamples[0]?.barcode || "",\
              materiau: reportSamples[0]?.materialState || "",\
              projet: reportSamples[0]?.project || "",\
            },\
            analyse: {\
              nom: analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.name || "",\
              norme: analysisTemplates.find((t: any) => t.id === reqAnalyses[0]?.templateId)?.standardRef || "",\
              technicien: reqAnalyses[0]?.technician || "",\
              remarques: reqAnalyses[0]?.notes || "",\
            },\
            resultats: {\
              tableau: reqAnalyses.map((a: any) => Object.entries(a.results).map(([k, v]) => `${k}: ${v}`).join(", ")).join(" | ")\
            },\
            images: {\
              galerie: "Images attachées au rapport"\
            }\
          });\
          const out = doc.getZip().generate({\
            type: "blob",\
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",\
          });\
          renderAsync(out, docxContainerRef.current, undefined, { className: "docx-preview-container", inWrapper: false, ignoreLastRenderedPageBreak: false });\
        } catch(e) {\
          console.error("Docx render error", e);\
          setDocxError("Erreur lors de la génération de l'\''aperçu du document.");\
        }\
      }\
    }\
  }, [report, docxContainerRef.current]);\
' src/components/ReportPreviewModal.tsx
