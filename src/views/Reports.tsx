/**
 * Vue Rapports d'Expertise & Certification (Reports)
 * 
 * Cette vue centralise la génération documentaire et l'archivage réglementaire du laboratoire :
 * 1. Moteur de fusion documentaire Docxtemplater :
 *    - Ingestion dynamique de modèles Word (.docx) paramétrables via le CMS
 *    - Remplacement des balises de fusion (demande, demandeur, échantillons, manager, etc.)
 *    - Boucles itératives pour matrices de résultats et micrographies rattachées
 *    - Génération de tableaux XML natifs OpenXML pour les séries statistiques (moyenne, écart-type)
 * 2. Pipeline de conversion en PDF vectoriel haute fidélité via l'API backend (/api/convert-pdf)
 * 3. Générateur de certificats de conformité unitaire par éprouvette ou lot de poudre
 * 4. Export brut au format tabulaire CSV pour exploitation statistique externe
 * 5. Visualiseur et modal d'aperçu avant impression et distribution
 */

import React, { useState } from "react";
import { useLims } from "../store";
import { FileDown, FileText, Settings2, Download, Image as ImageIcon, X, Eye, Trash2, Search } from "lucide-react";
import { Report, ReportTemplate } from "../types";
import { ReportPreviewModal } from "../components/ReportPreviewModal";
// @ts-ignore
import Docxtemplater from "docxtemplater";
// @ts-ignore
import PizZip from "pizzip";
import { saveAs } from "file-saver";

export function Reports() {
  const { 
    reports, 
    requests, 
    samples, 
    analyses, 
    analysisTemplates, 
    currentUser, 
    users, 
    reportTemplates, 
    labSettings,
    addReport, 
    deleteReport 
  } = useLims() as any;

  // États de sélection de modèle et de demande
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  // États pour les certificats unitaires
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certSelectedSample, setCertSelectedSample] = useState("");
  const [certSelectedTemplate, setCertSelectedTemplate] = useState("");
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

  /**
   * Construction du dictionnaire complet de variables de substitution pour Docxtemplater
   * Prépare les données scalaires, les boucles {#analyses} et les tableaux OpenXML natifs.
   */
  const buildDocData = (req: any, cl: any, samps: any[], anals: any[], mgr: any) => {
    const formattedDate = new Intl.DateTimeFormat("fr-FR").format(new Date());
    
    // Structure détaillée pour les boucles itératives {#analyses} ... {/analyses}
    const analysesData = anals.map((a: any) => {
      const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
      
      const sanitizeKey = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '_');
      const safeAnalysisName = sanitizeKey(t?.name || "inconnu");
      
      const baseObj: any = {
        nom: t?.name || "Non défini",
        norme: t?.standardRef || "Non défini",
        technicien: a.technician && a.technician !== 'Non assigné' ? a.technician : (users.find((u: any) => u.id === req?.assignedTo)?.name || "Non défini"),
        remarques: a.notes || "Aucune",
        echantillon: a.sampleId,
        date: a.date ? new Intl.DateTimeFormat("fr-FR").format(new Date(a.date)) : formattedDate,
        valeurs: Object.entries(a.results || {}).map(([k, v]) => ({ cle: t?.expectedResults?.find((er: any) => er.id === k)?.name || k, valeur: Array.isArray(v) ? v.join(', ') : v })),
        [`is_${safeAnalysisName}`]: true
      };
      
      // Extraction dynamique des séries de mesures et indicateurs statistiques
      const series_resultats: any[] = [];
      
      Object.entries(a.results || {}).forEach(([k, v]) => {
         const expected = t?.expectedResults?.find((er: any) => er.id === k);
         const fieldName = expected?.name || k;
         const safeName = sanitizeKey(fieldName);
         
         baseObj[`res_${safeName}`] = Array.isArray(v) ? v.join(', ') : v;
         
         if (Array.isArray(v)) {
            v.forEach((val, i) => {
               baseObj[`res_${safeName}_v${i+1}`] = val;
            });
            const numVals = v.map(Number).filter((n: number) => !isNaN(n));
            let mean: number | null = null;
            let stdDev: number | null = null;
            if (numVals.length > 0) {
               mean = numVals.reduce((sum: number, n: number) => sum + n, 0) / numVals.length;
               baseObj[`res_${safeName}_moyenne`] = mean.toFixed(2);
               const variance = numVals.length > 1 ? numVals.reduce((sum: number, n: number) => sum + Math.pow(n - mean!, 2), 0) / (numVals.length - 1) : 0;
               stdDev = numVals.length > 1 ? Math.sqrt(variance) : 0;
               baseObj[`res_${safeName}_ecart`] = stdDev.toFixed(2);
               baseObj[`res_${safeName}_stats`] = `${mean.toFixed(2)} ± ${stdDev.toFixed(2)}`;
            }
            
            if (expected?.type === 'number_series') {
               series_resultats.push({
                  nom_parametre: fieldName,
                  echantillon: a.sampleId,
                  v1: v[0] !== undefined ? v[0] : "-",
                  v2: v[1] !== undefined ? v[1] : "-",
                  v3: v[2] !== undefined ? v[2] : "-",
                  v4: v[3] !== undefined ? v[3] : "-",
                  v5: v[4] !== undefined ? v[4] : "-",
                  v6: v[5] !== undefined ? v[5] : "-",
                  v7: v[6] !== undefined ? v[6] : "-",
                  v8: v[7] !== undefined ? v[7] : "-",
                  v9: v[8] !== undefined ? v[8] : "-",
                  v10: v[9] !== undefined ? v[9] : "-",
                  stats: mean !== null && stdDev !== null ? `${mean.toFixed(2)} ± ${stdDev!.toFixed(2)}` : "-",
                  moyenne: mean !== null ? mean.toFixed(2) : "-",
                  ecart_type: stdDev !== null ? stdDev.toFixed(2) : "-"
               });
            }
         }
      });
      
      baseObj.series_resultats = series_resultats;
      baseObj.has_series = series_resultats.length > 0;
      
      return baseObj;
    });

    // Génération des tableaux XML OpenXML pour l'intégration fidèle dans Word
    const tables_series: any[] = [];
    const seriesGroups: Record<string, { paramName: string, rows: any[] }> = {};
    const escapeXML = (str: string) => {
      if(str === null || str === undefined) return "";
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    };

    anals.forEach((a: any) => {
        const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
        if (!t) return;
        Object.entries(a.results || {}).forEach(([k, v]) => {
            const expected = t.expectedResults?.find((er: any) => er.id === k);
            if (Array.isArray(v) && v.length > 0) {
                if (!seriesGroups[k]) seriesGroups[k] = { paramName: expected?.name || k, rows: [] };
                const numVals = v.map(Number).filter((n: number) => !isNaN(n));
                let stats = "-";
                if (numVals.length > 0) {
                   const mean = numVals.reduce((sum: number, n: number) => sum + n, 0) / numVals.length;
                   const variance = numVals.length > 1 ? numVals.reduce((sum: number, n: number) => sum + Math.pow(n - mean, 2), 0) / (numVals.length - 1) : 0;
                   const stdDev = numVals.length > 1 ? Math.sqrt(variance) : 0;
                   stats = `${mean.toFixed(2)} ± ${stdDev.toFixed(2)}`;
                }
                seriesGroups[k].rows.push({ echantillon: a.sampleId, valeurs: v, stats: stats });
            }
        });
    });

    Object.values(seriesGroups).forEach(group => {
        let maxVals = 0;
        group.rows.forEach(r => { if (r.valeurs.length > maxVals) maxVals = r.valeurs.length; });
        if (maxVals > 0) {
            const tColor = labSettings?.tableStyles?.borderColor || "000000";
            const tSize = labSettings?.tableStyles?.borderSize ?? 4;
            let xml = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:left w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:bottom w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:right w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:insideH w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:insideV w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
            xml += `<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>`;
            const addHeaderCell = (text: string) => { xml += `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${labSettings?.tableStyles?.headerBgColor || "E2E8F0"}"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXML(text)}</w:t></w:r></w:p></w:tc>`; };
            addHeaderCell("Echantillon");
            for (let i = 1; i <= maxVals; i++) addHeaderCell(`Mesure ${i}`);
            addHeaderCell("Moyenne");
            xml += `</w:tr>`;
            group.rows.forEach(r => {
                xml += `<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>`;
                const addDataCell = (text: string) => { xml += `<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${escapeXML(text)}</w:t></w:r></w:p></w:tc>`; };
                addDataCell(r.echantillon);
                for (let i = 0; i < maxVals; i++) addDataCell(r.valeurs[i] !== undefined ? String(r.valeurs[i]) : "-");
                addDataCell(r.stats);
                xml += `</w:tr>`;
            });
            xml += `</w:tbl>`;
            tables_series.push({ titre: group.paramName, xml: xml });
        }
    });

    const tables_analyses: any[] = [];
    const analysesGroups: Record<string, { templateName: string, columns: any[], rows: any[] }> = {};
    
    anals.forEach((a: any) => {
        const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
        if (!t) return;
        
        if (!analysesGroups[a.templateId]) {
            const hasSeries = (t.expectedResults || []).some((er: any) => er.type === 'number_series');
            if (hasSeries) return; 
            
            const columns = (t.expectedResults || []).filter((er: any) => er.type !== 'image');
            if (columns.length === 0) return;
            analysesGroups[a.templateId] = { templateName: t.name, columns: columns, rows: [] };
        }
        
        analysesGroups[a.templateId].rows.push(a);
    });

    Object.values(analysesGroups).forEach(group => {
        if (group.rows.length > 0 && group.columns.length > 0) {
            const tColor = labSettings?.tableStyles?.borderColor || "000000";
            const tSize = labSettings?.tableStyles?.borderSize ?? 4;
            let xml = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:left w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:bottom w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:right w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:insideH w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/><w:insideV w:val="${tSize > 0 ? 'single' : 'none'}" w:sz="${tSize}" w:space="0" w:color="${tColor}"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
            xml += `<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>`;
            const addHeaderCell = (text: string) => { xml += `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${labSettings?.tableStyles?.headerBgColor || "E2E8F0"}"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXML(text)}</w:t></w:r></w:p></w:tc>`; };
            const addDataCell = (text: string) => { xml += `<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${escapeXML(text)}</w:t></w:r></w:p></w:tc>`; };
            
            addHeaderCell("Echantillon");
            group.columns.forEach(col => addHeaderCell(col.name));
            xml += `</w:tr>`;
            
            group.rows.forEach(r => {
                xml += `<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>`;
                let sampleStr = r.sampleId;
                const sObj = samps.find((s: any) => s.id === r.sampleId);
                if (sObj) {
                    sampleStr = sObj.barcode || sObj.id;
                }
                
                addDataCell(sampleStr);
                
                group.columns.forEach(col => {
                    const v = (r.results || {})[col.id];
                    let textVal = "-";
                    if (v !== undefined && v !== null && v !== "") {
                        textVal = Array.isArray(v) ? v.join(", ") : String(v);
                    }
                    addDataCell(textVal);
                });
                
                xml += `</w:tr>`;
            });
            xml += `</w:tbl>`;
            tables_analyses.push({ titre: group.templateName, xml: xml });
        }
    });

    return {
      "echantillons": samps.map((s: any) => ({ ...s, materiau: s.materialState })),
      "tables_series": tables_series,
      "tables_analyses": tables_analyses,
      "demande.id": req?.id || "N/A",
      "date.jour": formattedDate,
      "demandeur.nom": cl?.name || samps[0]?.client || "Non renseigné",
      "demandeur.email": cl?.email || "Non renseigné",
      "demandeur.entreprise": cl?.company || samps[0]?.client || "Non renseigné",
      "echantillon.id": samps[0]?.id || "N/A",
      "echantillon.barcode": samps[0]?.barcode || "N/A",
      "echantillon.materiau": samps[0]?.materialState || "N/A",
      "echantillon.projet": samps[0]?.project || "N/A",
      "manager.nom": mgr?.name || "Responsable non défini",
      
      // Variables rétrocompatibles
      "analyse.nom": analysesData[0]?.nom || "Aucune analyse",
      "analyse.norme": analysesData[0]?.norme || "N/A",
      "analyse.technicien": analysesData.find((a: any) => a.technicien && a.technicien !== 'Non assigné')?.technicien || users.find((u: any) => u.id === req?.assignedTo)?.name || analysesData[0]?.technicien || "Non défini",
      "resultats.tableau": anals.length > 0 ? anals.map((a: any) => {
        const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
        return Object.entries(a.results || {}).map(([k, v]) => {
          const fieldName = t?.expectedResults?.find((er: any) => er.id === k)?.name || k;
          return `${fieldName}: ${v}`;
        }).join("\n");
      }).join("\n---\n") : "Aucun résultat",
      "images.galerie": "Images attachées au rapport",

      // Objets hiérarchiques
      demande: { id: req?.id || "N/A" },
      date: { jour: formattedDate },
      demandeur: {
        nom: cl?.name || samps[0]?.client || "Non renseigné",
        email: cl?.email || "Non renseigné",
        entreprise: cl?.company || samps[0]?.client || "Non renseigné",
      },
      echantillon: {
        id: samps[0]?.id || "N/A",
        barcode: samps[0]?.barcode || "N/A",
        materiau: samps[0]?.materialState || "N/A",
        projet: samps[0]?.project || "N/A",
      },
      manager: {
        nom: mgr?.name || "Responsable non défini"
      },
      
      // Boucles
      analyses: analysesData,
      resultats: analysesData
    };
  };

  /**
   * Formatage standard de date
   */
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  };

  /**
   * Téléchargement direct du fichier source Word (.docx)
   */
  const handleDownload = (report: any) => {
    if (report.templateId) {
      const template = reportTemplates.find((t: any) => t.id === report.templateId);
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
            delimiters: { start: "{{", end: "}}" }, 
            nullGetter: () => ""
          });
          const linkedSamples = samples.filter((s: any) => report.sampleIds.includes(s.id));
          const req = linkedSamples.length > 0 ? requests.find((r: any) => r.id === linkedSamples[0].requestId) : undefined;
          const client = users.find((u: any) => u.id === req?.requesterId);
          const reqAnalyses = analyses.filter((a: any) => linkedSamples.map((s: any) => s.id).includes(a.sampleId));
          const manager = users.find((u: any) => u.role === "manager" || u.role === "admin");
          const docData = buildDocData(req, client, linkedSamples, reqAnalyses, manager);
          doc.render(docData);
          const out = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(out);
          a.download = `Rapport_${report.id}.docx`;
          a.click();
        } catch (e) {
          console.warn(e);
          alert("Erreur lors de la génération du document Word.");
        }
      }
    } else {
      setPreviewReport(report);
    }
  };

  /**
   * Génération et enregistrement d'un rapport consolidé pour une demande d'analyse
   */
  const handleGenerate = () => {
    if (!selectedRequestId) return;
    const req = requests.find((r: any) => r.id === selectedRequestId);
    if (!req) return;
    
    const linkedSamples = samples.filter((s: any) => s.requestId === selectedRequestId);
    
    if (selectedTemplateId) {
      const template = reportTemplates.find((t: any) => t.id === selectedTemplateId);
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
            delimiters: { start: "{{", end: "}}" }, 
            nullGetter: () => "",
          });
          const client = users.find((u: any) => u.id === req.requesterId);
          const reqAnalyses = analyses.filter((a: any) => linkedSamples.map((s: any) => s.id).includes(a.sampleId));
          const manager = users.find((u: any) => u.role === "manager" || u.role === "admin");
          const docData = buildDocData(req, client, linkedSamples, reqAnalyses, manager);
          doc.render(docData);
          const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
          saveAs(out, `Rapport_${req.id}.docx`);
        } catch(e: any) {
          console.warn(e);
          if (e.properties && e.properties.errors instanceof Array) {
            const errorMessages = e.properties.errors.map((err: any) => err.properties.explanation || err.message).join(", ");
            alert("Erreur dans le modèle Word : " + errorMessages);
          } else {
            alert("Erreur lors de la génération du docx : " + e.message);
          }
        }
      }
    }
    
    const newReport: Report = {
      id: `RAP-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
      title: `Rapport d'Expertise - ${req.title}`,
      requestId: req.id,
      sampleIds: linkedSamples.map((s: any) => s.id),
      createdAt: new Date().toISOString(),
      status: "genere",
      format: selectedTemplateId ? "Word" : "PDF",
      templateId: selectedTemplateId || undefined
    } as Report;

    if (addReport) {
      addReport(newReport);
    }
    setIsModalOpen(false);
    setSelectedRequestId("");
    setSelectedTemplateId("");
  };

  /**
   * Pipeline de conversion serveur DOCX -> PDF
   */
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
          delimiters: { start: "{{", end: "}}" }, 
          nullGetter: () => "",
        });
        
        const linkedSamples = samples.filter((s: any) => report.sampleIds.includes(s.id));
        const reqAnalyses = analyses.filter((a: any) => report.sampleIds.includes(a.sampleId));
        
        let guessedRequestId = report?.requestId;
        if (!guessedRequestId && report?.title) {
          const matchedReq = requests.find((r: any) => report.title.includes(r.title));
          if (matchedReq) guessedRequestId = matchedReq.id;
        }
      
        const request = guessedRequestId 
          ? requests.find((r: any) => r.id === guessedRequestId)
          : (linkedSamples.length > 0 && linkedSamples[0].requestId 
              ? requests.find((r: any) => r.id === linkedSamples[0].requestId) 
              : null);
              
        const client = request ? users.find((u: any) => u.id === request.requesterId) : null;
        const manager = users.find((u: any) => u.role === "manager" || u.role === "admin");

        const docData = buildDocData(request, client, linkedSamples, reqAnalyses, manager);
        doc.render(docData);
        const out = doc.getZip().generate({ type: "base64" });

        const res = await fetch('/api/convert-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docxBase64: out })
        });
        const data = await res.json();
        
        if (data.pdfBase64) {
          const byteCharacters = atob(data.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Rapport_${report.id}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 100);
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
      setPreviewReport(report);
      alert("Veuillez cliquer sur 'Télécharger PDF' depuis l'aperçu pour les rapports HTML génériques.");
    }
  };

  /**
   * Export CSV des données brutes d'essais
   */
  const handleGenerateCSV = () => {
    const headers = ["ID Analyse", "Date", "Echantillon ID", "Type", "Technicien", "Resultats Bruts"];
    let csvContent = headers.join(";") + "\n";
    
    analyses.forEach((a: any) => {
      const template = analysisTemplates.find((t: any) => t.id === a.templateId);
      const resultsString = Object.entries(a.results || {}).map(([k, v]) => `${k}: ${v}`).join(' | ');
      const row = [
        a.id,
        new Date(a.date).toLocaleDateString('fr-FR'),
        a.sampleId,
        template?.name || "N/A",
        a.technician,
        `"${resultsString}"`
      ];
      csvContent += row.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "export_analyses_brutes.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  /**
   * Génération d'un Certificat de Conformité unitaire au format PDF
   */
  const handleGenerateCertificate = async () => {
    if (!certSelectedSample || !certSelectedTemplate) {
      alert("Veuillez sélectionner un échantillon et un modèle.");
      return;
    }
    
    setIsGeneratingCert(true);
    try {
      const sample = samples.find((s: any) => s.id === certSelectedSample);
      const template = reportTemplates.find((t: any) => t.id === certSelectedTemplate);
      
      if (!template || !template.fileData) {
        alert("Modèle Word introuvable ou vide.");
        setIsGeneratingCert(false);
        return;
      }
      
      const sampleAnalyses = analyses.filter((a: any) => a.sampleId === certSelectedSample);
      
      const docData: any = {
        date: new Date().toLocaleDateString('fr-FR'),
        echantillon: {
          id: sample?.id,
          barcode: sample?.barcode,
          projet: sample?.project,
          client: sample?.client,
          etat: sample?.materialState,
        },
        resultats: sampleAnalyses.map((a: any) => {
          const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
          return {
            analyse: t?.name,
            norme: t?.standardRef,
            valeurs: Object.entries(a.results || {}).map(([k, v]) => ({ cle: t?.expectedResults?.find((er: any) => er.id === k)?.name || k, valeur: v }))
          };
        }),
      };
      
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
        delimiters: { start: "{{", end: "}}" }, 
        nullGetter: () => "",
      });
      
      doc.render(docData);
      const out = doc.getZip().generate({ type: "base64" });
      
      const res = await fetch('/api/convert-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docxBase64: out })
      });
      const data = await res.json();
      
      if (data.pdfBase64) {
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Certificat_${sample?.barcode || sample?.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } else {
        alert("Erreur lors de la conversion PDF : " + (data.error || 'Erreur inconnue'));
      }
    } catch (e: any) {
      console.error(e);
      alert("Erreur lors de la génération : " + e.message);
    } finally {
      setIsGeneratingCert(false);
      setIsCertModalOpen(false);
    }
  };

  const filteredReports = reports.filter((r: any) => 
    (r.id?.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (r.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.format?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const completedRequests = requests.filter((r: any) => r.status === 'terminee' || r.status === 'en_validation' || r.status === 'validee' || r.status === 'en_cours');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-display font-bold text-slate-900">Rapports d'Expertise & Certification</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center shadow-sm"
        >
          <Settings2 className="w-4 h-4 mr-2" />
          Nouveau Rapport Consolidé
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Rechercher par ID, titre ou format..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Raccourcis de génération rapide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-md relative overflow-hidden">
          <FileText className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white/10" />
          <h3 className="text-lg font-semibold mb-1 relative z-10">Rapport d'Expertise Métallographique</h3>
          <p className="text-slate-300 text-sm mb-4 relative z-10">Générez un PDF complet incluant la matrice d'essais, l'historique de préparation et toutes les micrographies annotées.</p>
          <button onClick={() => setIsModalOpen(true)} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors relative z-10 flex items-center">
            <ImageIcon className="w-4 h-4 mr-2" />
            Générer
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Certificat Conformité Poudres</h3>
          <p className="text-slate-500 text-sm mb-4">Export rapide des résultats granulométriques (D10, D50, D90) avec courbe laser intégrée.</p>
          <button onClick={() => setIsCertModalOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200">Configurer</button>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Export Brut (Data)</h3>
          <p className="text-slate-500 text-sm mb-4">Export Excel des valeurs brutes de porosité et dureté Vickers pour analyse statistique externe.</p>
          <button onClick={handleGenerateCSV} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200">Générer CSV</button>
        </div>
      </div>

      {/* Tableau d'archivage des rapports */}
      <h3 className="text-lg font-display font-bold text-slate-900 mb-4">Archives des Rapports</h3>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Titre du rapport</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Échantillons liés</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Format</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Télécharger</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredReports.map((report: any) => (
              <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileDown className="h-5 w-5 text-slate-400 mr-3" />
                    <span className="text-sm font-medium text-slate-900">{report.title}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {report.sampleIds?.map((id: string) => (
                      <span key={id} className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono">{id}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDate(report.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-slate-200 text-xs font-medium bg-slate-100 text-slate-800">
                    {report.format}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-3">
                    <button 
                      onClick={() => setPreviewReport(report)}
                      className="flex items-center text-slate-500 hover:text-slate-800 transition-colors"
                      title="Aperçu"
                    >
                      <Eye className="w-4 h-4 sm:mr-1" />
                      <span className="sr-only sm:not-sr-only sm:text-xs">Aperçu</span>
                    </button>
                    <button 
                      onClick={() => handleDownloadPDF(report)}
                      disabled={report.status !== 'genere' || downloadingReportId === report.id}
                      className={`flex items-center ${report.status === 'genere' ? 'text-blue-600 hover:text-blue-900' : 'text-slate-300 cursor-not-allowed'}`}
                      title="Télécharger PDF"
                    >
                      <Download className={`w-4 h-4 sm:mr-1 ${downloadingReportId === report.id ? 'animate-bounce' : ''}`} />
                      <span className="sr-only sm:not-sr-only sm:text-xs">PDF</span>
                    </button>
                    <button 
                      onClick={() => { deleteReport(report.id); }}
                      className="flex items-center text-red-500 hover:text-red-700 transition-colors ml-2"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">Aucun rapport généré.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Fenêtre modale de génération de Certificat de Conformité */}
      {isCertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Certificat de Conformité</h2>
            <p className="text-sm text-slate-600 mb-4">Générez un certificat PDF en utilisant un modèle Word configuré avec vos variables.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Échantillon à certifier
              </label>
              <select
                value={certSelectedSample}
                onChange={e => setCertSelectedSample(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Sélectionner l'échantillon --</option>
                {samples.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.barcode} - {s.materialState} ({s.client})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Modèle de Certificat
              </label>
              <select
                value={certSelectedTemplate}
                onChange={e => setCertSelectedTemplate(e.target.value)}
                className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Sélectionner le modèle --</option>
                {reportTemplates.filter((t: any) => t.type === 'certificate' && t.fileData).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {reportTemplates.filter((t: any) => t.type === 'certificate' && t.fileData).length === 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  Aucun modèle de certificat (.docx) disponible. Veuillez en ajouter un dans les Paramètres &gt; CMS.
                </p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setIsCertModalOpen(false)}
                disabled={isGeneratingCert}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                Annuler
              </button>
              <button 
                onClick={handleGenerateCertificate}
                disabled={isGeneratingCert || !certSelectedSample || !certSelectedTemplate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center disabled:opacity-50"
              >
                {isGeneratingCert ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                {isGeneratingCert ? "Génération..." : "Générer PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fenêtre modale de création d'un Rapport Consolidé */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Générer un Rapport Consolidé
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <label className="block text-sm font-medium text-slate-700 mb-2">Sélectionnez le dossier / la demande client</label>
              <select 
                value={selectedRequestId}
                onChange={e => setSelectedRequestId(e.target.value)}
                className="w-full border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">-- Choisir une demande --</option>
                {completedRequests.map((req: any) => {
                  const client = users.find((u: any) => u.id === req.requesterId);
                  return (
                    <option key={req.id} value={req.id}>
                      {req.id} - {req.title} ({client?.company || client?.name})
                    </option>
                  );
                })}
              </select>
              <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Modèle de rapport (Optionnel)</label>
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">-- PDF Générique --</option>
                {reportTemplates?.filter((t: any) => t.fileData).map((tpl: any) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} (.docx)
                  </option>
                ))}
              </select>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-800">
                  Le rapport consolidé inclura :<br/>
                  - Les informations de la demande initiale<br/>
                  - La matrice complète de tous les échantillons générés<br/>
                  - Les résultats des analyses (Dureté, Granulométrie, BET...)<br/>
                  - Les micrographies et images associées
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white">
                Annuler
              </button>
              <button 
                onClick={handleGenerate}
                disabled={!selectedRequestId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg transition-colors shadow-sm flex items-center"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Générer le document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualiseur de rapport complet */}
      <ReportPreviewModal 
        isOpen={!!previewReport}
        onClose={() => setPreviewReport(null)}
        report={previewReport}
        requests={requests}
        samples={samples}
        analyses={analyses}
        analysisTemplates={analysisTemplates}
        users={users}
      />
    </div>
  );
}
