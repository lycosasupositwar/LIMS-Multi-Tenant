#!/bin/bash
sed -i '/const handleGenerate = () => {/i \
  const handleDownload = (report: any) => {\
    if (report.templateId) {\
      const template = reportTemplates.find((t: any) => t.id === report.templateId);\
      if (template && template.fileData) {\
        try {\
          const base64Data = template.fileData.split(",")[1];\
          const binaryString = atob(base64Data);\
          const len = binaryString.length;\
          const bytes = new Uint8Array(len);\
          for (let i = 0; i < len; i++) {\
            bytes[i] = binaryString.charCodeAt(i);\
          }\
          const zip = new window.PizZip(bytes);\
          const doc = new window.Docxtemplater(zip, {\
            paragraphLoop: true,\
            linebreaks: true,\
            delimiters: { start: "{{", end: "}}" }\
          });\
          const req = requests.find(r => r.id === report.requestId);\
          const linkedSamples = samples.filter(s => s.requestId === report.requestId);\
          const client = users.find((u: any) => u.id === req?.requesterId);\
          const reqAnalyses = analyses.filter((a: any) => linkedSamples.map(s => s.id).includes(a.sampleId));\
          const manager = users.find((u: any) => u.role === "manager" || u.role === "admin");\
          doc.render({\
            demande: { id: req?.id || "" },\
            date: { jour: formatDate(new Date().toISOString()) },\
            demandeur: {\
              nom: client?.name || "",\
              email: client?.email || "",\
              entreprise: client?.company || ""\
            },\
            echantillon: {\
              id: linkedSamples[0]?.id || "",\
              barcode: linkedSamples[0]?.barcode || "",\
              materiau: linkedSamples[0]?.materialState || "",\
              projet: linkedSamples[0]?.project || "",\
            },\
            manager: {\
              nom: manager?.name || ""\
            }\
          });\
          const out = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });\
          const a = document.createElement("a");\
          a.href = URL.createObjectURL(out);\
          a.download = `Rapport_${report.id}.docx`;\
          a.click();\
        } catch (e) {\
          console.warn(e);\
          alert("Erreur lors de la génération du document.");\
        }\
      }\
    } else {\
      setPreviewReport(report);\
    }\
  };\
' src/views/Reports.tsx

sed -i 's/<button [[:space:]]*disabled={report.status !== '"'genere'"'}/<button onClick={() => handleDownload(report)} disabled={report.status !== '"'genere'"'}/g' src/views/Reports.tsx
