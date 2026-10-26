/**
 * Fenêtre Modale de Visualisation et d'Export de Rapport d'Essai
 * 
 * Ce composant prend en charge la génération, l'affichage et l'archivage serveur des rapports finaux :
 * 1. Mode Modèle Word (.docx) :
 *    - Remplacement des variables contextuelles avec Docxtemplater
 *    - Conversion côté serveur en PDF haute fidélité via LibreOffice
 *    - Enregistrement automatique dans le dossier sécurisé storage/reports/
 * 2. Mode Modèle Standard HTML A4 :
 *    - Rendu de la mise en page A4 normée (En-tête laboratoire, informations projet,
 *      matrice des échantillons, résultats détaillés, clichés microstructures, conclusion)
 *    - Capture haute définition (dom-to-image-more + jsPDF) et sauvegarde automatique
 *      dans le dossier serveur storage/reports/ pour mise à disposition du demandeur.
 */

import React, { useRef, useEffect, useState } from "react";
import { X, Printer, Download, CheckCircle2 } from "lucide-react";
import { Report, AnalysisRequest, Sample, Analysis, AnalysisTemplate, User } from "../types";
import { useLims } from "../store";
import domtoimage from "dom-to-image-more";
import { jsPDF } from "jspdf";
// @ts-ignore
import Docxtemplater from "docxtemplater";
// @ts-ignore
import PizZip from "pizzip";
import { PdfViewer } from "./PdfViewer";
import { createDocxImageModule } from "../utils/docxImageModule";

interface ReportPreviewModalProps {
  /** État de visibilité de la modale */
  isOpen: boolean;
  /** Fonction de fermeture */
  onClose: () => void;
  /** Rapport d'analyse sélectionné */
  report: Report | null;
  /** Liste des demandes */
  requests: AnalysisRequest[];
  /** Liste des échantillons */
  samples: Sample[];
  /** Liste des essais et analyses */
  analyses: Analysis[];
  /** Catalogue des modèles d'analyses */
  analysisTemplates: AnalysisTemplate[];
  /** Liste des utilisateurs (pour la résolution des noms demandeur/technicien) */
  users: User[];
  /** Déclenche automatiquement le téléchargement PDF à l'ouverture (optionnel) */
  autoDownload?: boolean;
  /** Callback appelé une fois le téléchargement automatique lancé */
  onAutoDownloadComplete?: () => void;
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  report,
  requests,
  samples,
  analyses,
  analysisTemplates,
  users,
  autoDownload = false,
  onAutoDownloadComplete
}: ReportPreviewModalProps) {
  const { labSettings, reportTemplates } = useLims();
  const [docxError, setDocxError] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSavedOnServer, setIsSavedOnServer] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const autoSavedReportIdRef = useRef<string | null>(null);

  /**
   * Formatage français des dates
   */
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  };

  // Filtrage des échantillons associés au rapport
  const reportSamples = samples.filter(s => report?.sampleIds.includes(s.id));

  // Résolution de la demande d'analyse parente
  let guessedRequestId = report?.requestId;
  if (!guessedRequestId && report?.title) {
    const matchedReq = requests.find(r => report.title.includes(r.title));
    if (matchedReq) guessedRequestId = matchedReq.id;
  }

  const request = guessedRequestId
    ? requests.find(r => r.id === guessedRequestId)
    : (reportSamples.length > 0 && reportSamples[0].requestId
      ? requests.find(r => r.id === reportSamples[0].requestId)
      : null);

  const client = request ? users.find(u => u.id === request.requesterId) : null;
  const manager = users.find(u => u.role === 'manager');

  // Analyses réalisées sur les échantillons du rapport
  const reportAnalyses = analyses.filter(a => report?.sampleIds.includes(a.sampleId));

  // Identification du modèle Word personnalisé associé
  const template = report?.templateId ? reportTemplates?.find((t: any) => t.id === report.templateId) : null;
  const isDocx = !!(template && template.fileData);

  /**
   * Envoie le fichier PDF (en Base64) au serveur pour stockage dans le dossier sécurisé storage/reports/
   */
  const savePdfToServerStorage = async (pdfBase64: string) => {
    if (!report) return;
    try {
      const res = await fetch('/api/reports/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          requestId: request?.id || report.requestId,
          fileBase64: pdfBase64,
          format: 'PDF',
          title: report.title
        })
      });
      if (res.ok) {
        setIsSavedOnServer(true);
      }
    } catch (e) {
      console.error('Erreur lors de la sauvegarde automatique du rapport sur le serveur :', e);
    }
  };

  /**
     * Génère un PDF A4 multi-pages propre :
     * - Répète l'en-tête et le pied de page sur chaque feuille
     * - Ne coupe jamais un bloc d'analyse ou de texte en deux
     * - Ajoute la numérotation des pages (Page X / Y)
     */
  const buildPdfFromHtmlPreview = async (): Promise<jsPDF | null> => {
    const container = pdfRef.current;
    if (!container) return null;

    const scale = 2;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
    const marginX = 12; // Marge horizontale en mm
    const marginTop = 10; // Marge haute en mm
    const marginBottom = 15; // Espace réservé au pied de page en mm
    const contentWidth = pageWidth - marginX * 2;

    // Fonction utilitaire pour capturer un élément DOM en image Haute Définition
    const captureElement = async (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const w = Math.ceil(rect.width || el.offsetWidth);
      const h = Math.ceil(rect.height || el.offsetHeight);

      const dataUrl = await domtoimage.toJpeg(el, {
        quality: 0.98,
        bgcolor: '#ffffff',
        width: w * scale,
        height: h * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${w}px`,
          height: `${h}px`,
        },
      });
      const heightMm = (h * contentWidth) / w;
      return { dataUrl, heightMm };
    };

    const headerEl = container.querySelector('.pdf-header') as HTMLElement | null;
    const footerEl = container.querySelector('.pdf-footer') as HTMLElement | null;
    const blockEls = Array.from(container.querySelectorAll('.pdf-block')) as HTMLElement[];

    const headerImg = headerEl ? await captureElement(headerEl) : null;
    const footerImg = footerEl ? await captureElement(footerEl) : null;

    const maxContentY = pageHeight - marginBottom - (footerImg ? footerImg.heightMm + 2 : 0);
    let currentY = marginTop;

    // Fonction pour dessiner l'en-tête en haut de la page courante
    const drawHeader = () => {
      if (headerImg) {
        pdf.addImage(headerImg.dataUrl, 'JPEG', marginX, marginTop, contentWidth, headerImg.heightMm);
        currentY = marginTop + headerImg.heightMm + 4;
      } else {
        currentY = marginTop;
      }
    };

    // Initialisation de la première page
    drawHeader();

    // Placement séquentiel de chaque bloc sans coupure
    for (const block of blockEls) {
      if (block.offsetHeight === 0) continue;
      const blockImg = await captureElement(block);

      // Si le bloc dépasse le bas de la feuille et qu'on n'est pas déjà tout en haut sous l'en-tête :
      // on crée une nouvelle page A4 avec un nouvel en-tête
      const topAfterHeader = marginTop + (headerImg ? headerImg.heightMm + 4 : 0);
      if (currentY + blockImg.heightMm > maxContentY && currentY > topAfterHeader + 1) {
        pdf.addPage();
        drawHeader();
      }

      // Si un bloc unique est exceptionnellement plus grand qu'une page entière, on l'ajuste pour ne pas le tronquer
      const availableHeight = maxContentY - currentY;
      if (blockImg.heightMm > availableHeight) {
        const ratio = availableHeight / blockImg.heightMm;
        const scaledW = contentWidth * ratio;
        const centeredX = marginX + (contentWidth - scaledW) / 2;
        pdf.addImage(blockImg.dataUrl, 'JPEG', centeredX, currentY, scaledW, availableHeight);
        currentY += availableHeight + 3;
      } else {
        pdf.addImage(blockImg.dataUrl, 'JPEG', marginX, currentY, contentWidth, blockImg.heightMm);
        currentY += blockImg.heightMm + 3;
      }
    }

    // Ajout du pied de page et de la numérotation "Page X / Y" sur toutes les pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      if (footerImg) {
        pdf.addImage(
          footerImg.dataUrl,
          'JPEG',
          marginX,
          pageHeight - marginBottom - footerImg.heightMm,
          contentWidth,
          footerImg.heightMm
        );
      }
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `Rapport ${report?.id || ''} — Page ${i} / ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 6,
        { align: 'right' }
      );
    }

    return pdf;
  };

  /**
   * Construit la structure de données complète injectée dans le moteur de gabarit Word
   */
  const getDocData = () => {
    const todayFormatted = new Intl.DateTimeFormat("fr-FR").format(new Date());

    const analysesData = reportAnalyses.map((a: any) => {
      const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);

      const baseObj: any = {
        nom: t?.name || "Non défini",
        norme: t?.standardRef || "Non défini",
        technicien: a.technician && a.technician !== 'Non assigné'
          ? a.technician
          : (users.find((u: any) => u.id === request?.assignedTo)?.name || "Non défini"),
        remarques: a.notes || "Aucune",
        echantillon: a.sampleId,
        date: a.date ? new Intl.DateTimeFormat("fr-FR").format(new Date(a.date)) : todayFormatted,
        valeurs: Object.entries(a.results || {}).map(([k, v]) => ({
          cle: t?.expectedResults?.find((er: any) => er.id === k)?.name || k,
          valeur: v && typeof v === 'object' && Array.isArray((v as any).images)
            ? `${(v as any).images.length} image(s) de micrographie`
            : Array.isArray(v) ? v.join(', ') : v
        })),
        micrographies: Object.entries(a.results || {}).flatMap(([k, v]) => {
          const expected = t?.expectedResults?.find((er: any) => er.id === k);
          const images = v && typeof v === 'object' && Array.isArray((v as any).images) ? (v as any).images : [];
          return images.map((img: any, index: number) => ({
            analyse: t?.name || 'Micrographie',
            champ: expected?.name || k,
            numero: index + 1,
            nom: img.name || `Image ${index + 1}`,
            commentaire: img.comment || '',
            image: img.dataUrl || ''
          }));
        })
      };

      const sanitizeKey = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '_');
      const series_resultats: any[] = [];

      Object.entries(a.results || {}).forEach(([k, v]) => {
        const expected = t?.expectedResults?.find((er: any) => er.id === k);
        const fieldName = expected?.name || k;
        const safeName = sanitizeKey(fieldName);

        baseObj[`res_${safeName}`] = v && typeof v === 'object' && Array.isArray((v as any).images) ? `${(v as any).images.length} image(s) de micrographie` : Array.isArray(v) ? v.join(', ') : v;

        if (Array.isArray(v)) {
          v.forEach((val, i) => {
            baseObj[`res_${safeName}_v${i + 1}`] = val;
          });
          const numVals = v.map(Number).filter((n: number) => !isNaN(n));
          let mean: number | null = null;
          let stdDev: number | null = null;
          if (numVals.length > 0) {
            mean = numVals.reduce((sum: number, n: number) => sum + n, 0) / numVals.length;
            baseObj[`res_${safeName}_moyenne`] = mean.toFixed(2);
            const variance = numVals.length > 1
              ? numVals.reduce((sum: number, n: number) => sum + Math.pow(n - mean!, 2), 0) / (numVals.length - 1)
              : 0;
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

    const tables_series: any[] = [];
    const seriesGroups: Record<string, { paramName: string, rows: any[] }> = {};
    const escapeXML = (str: string) => {
      if (str === null || str === undefined) return "";
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    };

    reportAnalyses.forEach((a: any) => {
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

    reportAnalyses.forEach((a: any) => {
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
          const sObj = reportSamples.find((s: any) => s.id === r.sampleId);
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
      "echantillons": reportSamples.map((s: any) => ({ ...s, materiau: s.materialState })),
      "tables_series": tables_series,
      "tables_analyses": tables_analyses,
      "demande.id": request?.id || "N/A",
      "date.jour": todayFormatted,
      "demandeur.nom": client?.name || reportSamples[0]?.client || "Non renseigné",
      "demandeur.email": client?.email || "Non renseigné",
      "demandeur.entreprise": client?.company || reportSamples[0]?.client || "Non renseigné",
      "echantillon.id": reportSamples[0]?.id || "N/A",
      "echantillon.barcode": reportSamples[0]?.barcode || "N/A",
      "echantillon.materiau": reportSamples[0]?.materialState || "N/A",
      "echantillon.projet": reportSamples[0]?.project || "N/A",
      "manager.nom": manager?.name || "Responsable non défini",

      "analyse.nom": analysesData[0]?.nom || "Aucune analyse",
      "analyse.norme": analysesData[0]?.norme || "N/A",
      "analyse.technicien": analysesData.find(a => a.technicien && a.technicien !== 'Non assigné')?.technicien || users.find(u => u.id === request?.assignedTo)?.name || analysesData[0]?.technicien || "Non défini",
      "resultats.tableau": reportAnalyses.length > 0 ? reportAnalyses.map((a: any) => {
        const t = analysisTemplates.find(tpl => tpl.id === a.templateId);
        return Object.entries(a.results || {}).map(([k, v]) => {
          const fieldName = t?.expectedResults?.find(er => er.id === k)?.name || k;
          return `${fieldName}: ${v && typeof v === 'object' && Array.isArray((v as any).images) ? `${(v as any).images.length} image(s) de micrographie` : Array.isArray(v) ? v.join(', ') : v}`;
        }).join("\n");
      }).join("\n---\n") : "Aucun résultat",

      demande: {
        id: request?.id || "N/A",
        custom: Object.fromEntries(
          Object.entries(request?.customData || {}).map(([k, v]) => {
            if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && v[0].includes('-')) {
              const mapped = v.map(id => analysisTemplates.find(a => a.id === id)?.name || id);
              return [k, mapped.join(', ')];
            }
            if (Array.isArray(v)) return [k, v.join(', ')];
            return [k, v];
          })
        )
      },
      date: { jour: todayFormatted },
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
      },
      manager: {
        nom: manager?.name || "Responsable non défini"
      },
      analyses: analysesData,
      resultats: analysesData,
      micrographies: analysesData.flatMap((a: any) => a.micrographies || [])
    };
  };

  /**
   * Effet déclenchant la conversion du modèle DOCX en PDF lors de l'ouverture
   * et sa sauvegarde automatique dans storage/reports/
   */
  useEffect(() => {
    setIsSavedOnServer(false);
    if (isDocx && report?.templateId) {
      const currentTemplate = reportTemplates?.find((t: any) => t.id === report.templateId);
      if (currentTemplate && currentTemplate.fileData) {
        setIsGeneratingPreview(true);
        setDocxError(null);
        try {
          const base64Data = currentTemplate.fileData.split(",")[1];
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const zip = new PizZip(bytes);
          const doc = new Docxtemplater(zip, {
            modules: [createDocxImageModule()],
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: "{{", end: "}}" },
            nullGetter: () => ""
          });

          const docData = getDocData();
          doc.render(docData);
          const out = doc.getZip().generate({ type: "base64" });

          fetch('/api/convert-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docxBase64: out })
          })
            .then(res => res.json())
            .then(data => {
              if (data.pdfUrl) {
                setPreviewPdfUrl(data.pdfUrl);
                setPreviewPdfBase64(data.pdfBase64);
                if (data.pdfBase64) {
                  void savePdfToServerStorage(data.pdfBase64);
                }
              } else if (data.error) {
                setDocxError("Erreur API de conversion : " + data.error);
              }
            })
            .catch(e => {
              console.error(e);
              setDocxError("Erreur réseau lors de la génération de l'aperçu PDF.");
            })
            .finally(() => setIsGeneratingPreview(false));

        } catch (e: any) {
          console.warn("Erreur de rendu Docx :", e);
          setIsGeneratingPreview(false);
          if (e.properties && e.properties.errors instanceof Array) {
            const errorMessages = e.properties.errors.map((err: any) => err.properties.explanation || err.message).join(", ");
            setDocxError("Erreur dans le modèle Word : " + errorMessages);
          } else {
            setDocxError("Erreur lors de la génération de l'aperçu : " + e.message);
          }
        }
      }
    }
  }, [report, isDocx]);

  /**
   * Sauvegarde automatique en arrière-plan du rendu A4 HTML exact dans storage/reports/
   * dès que la modale d'aperçu est affichée (pour que le demandeur ait exactement ce rapport).
   */
  useEffect(() => {
    if (!isOpen || !report || isDocx) return;

    const timer = setTimeout(async () => {
      try {
        if (autoDownload) {
          await generatePDF();
          if (onAutoDownloadComplete) onAutoDownloadComplete();
        } else if (autoSavedReportIdRef.current !== report.id) {
          const pdf = await buildPdfFromHtmlPreview();
          if (pdf) {
            const pdfBase64 = pdf.output('datauristring').split(',')[1];
            await savePdfToServerStorage(pdfBase64);
            autoSavedReportIdRef.current = report.id;
          }
        }
      } catch (e) {
        console.error('Erreur lors de la capture PDF automatique :', e);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isOpen, report, autoDownload, isDocx]);

  /**
   * Génération et téléchargement direct du fichier Word DOCX
   */
  const generateDOCX = () => {
    if (report?.templateId) {
      const currentTemplate = reportTemplates?.find((t: any) => t.id === report.templateId);
      if (currentTemplate && currentTemplate.fileData) {
        try {
          const base64Data = currentTemplate.fileData.split(",")[1];
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const zip = new PizZip(bytes);
          const doc = new Docxtemplater(zip, {
            modules: [createDocxImageModule()],
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: "{{", end: "}}" },
            nullGetter: () => ""
          });

          const docData = getDocData();
          doc.render(docData);
          const out = doc.getZip().generate({ type: "blob" });

          const a = document.createElement("a");
          a.href = URL.createObjectURL(out);
          a.download = `Rapport_${report.id}.docx`;
          a.click();
        } catch (e) {
          console.error('Erreur export DOCX :', e);
        }
      }
    }
  };

  /**
   * Impression directe du document PDF (et non de la fenêtre de l'application)
   */
  const handlePrint = async () => {
    const printPdfBlobUrl = (urlToPrint: string, revokeAfter = false) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = urlToPrint;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Erreur lors du lancement de l\'impression PDF :', e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            if (revokeAfter) {
              URL.revokeObjectURL(urlToPrint);
            }
          }, 15000);
        }
      };
    };

    if (isDocx && previewPdfUrl) {
      printPdfBlobUrl(previewPdfUrl, false);
      return;
    }

    // Mode PDF Générique : on génère le PDF multi-pages et on l'imprime directement
    setIsDownloadingPdf(true);
    try {
      const pdf = await buildPdfFromHtmlPreview();
      if (pdf) {
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        printPdfBlobUrl(blobUrl, true);
      }
    } catch (e) {
      console.error('Erreur lors de la préparation du PDF pour impression :', e);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  /**
   * Téléchargement du fichier PDF généré ET enregistrement dans storage/reports/
   */
  const generatePDF = async () => {
    if (!report) return;

    if (isDocx && report.templateId) {
      if (previewPdfBase64) {
        await savePdfToServerStorage(previewPdfBase64);

        const byteCharacters = atob(previewPdfBase64);
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
      } else {
        alert("Veuillez patienter pendant la génération de l'aperçu PDF.");
      }
    } else {
      if (!pdfRef.current) {
        alert("Aperçu non disponible pour la conversion PDF.");
        return;
      }

      setIsDownloadingPdf(true);
      try {
        const pdf = await buildPdfFromHtmlPreview();
        if (pdf) {
          // 1. Enregistre exactement ce PDF dans storage/reports/ pour le portail demandeur
          const pdfBase64 = pdf.output('datauristring').split(',')[1];
          await savePdfToServerStorage(pdfBase64);
          autoSavedReportIdRef.current = report.id;

          // 2. Télécharge le PDF sur le poste de l'utilisateur
          pdf.save(`Rapport_${report.id}.pdf`);
        }
      } catch (err) {
        console.error("Erreur lors de la génération du PDF générique :", err);
        alert("La conversion directe a rencontré un problème. L'outil d'impression PDF va s'ouvrir en alternative.");
        setTimeout(() => {
          window.print();
        }, 500);
      } finally {
        setIsDownloadingPdf(false);
      }
    }
  };

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-full">
        {/* En-tête de la modale */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 shrink-0 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Aperçu du Rapport - {report.id}</h2>
                {isSavedOnServer && (
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    Mis à disposition du demandeur
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">Document généré le {formatDate(report.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Imprimer"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={generateDOCX}
              className={isDocx ? "flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors mr-2" : "hidden"}
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger DOCX
            </button>
            <button
              onClick={generatePDF}
              disabled={isDownloadingPdf}
              className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloadingPdf ? "Conversion..." : "Télécharger PDF"}
            </button>
            <div className="w-px h-6 bg-slate-300 mx-1"></div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Zone de prévisualisation (DOCX converti ou gabarit HTML A4) */}
        <div className="flex-1 overflow-y-auto bg-slate-200 p-4 sm:p-8 custom-scrollbar">
          {isDocx ? (
            <div className="w-full flex justify-center flex-col items-center max-w-[1000px] mx-auto">
              {docxError && (
                <div className="text-red-500 mb-4 bg-red-100 p-4 rounded-lg font-bold">
                  {docxError}
                </div>
              )}
              {isGeneratingPreview ? (
                <div className="flex flex-col items-center justify-center min-h-[500px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                  <p className="text-slate-600 font-medium">Génération de l'aperçu PDF haute fidélité...</p>
                  <p className="text-slate-400 text-sm mt-2">Veuillez patienter.</p>
                </div>
              ) : previewPdfUrl ? (
                <PdfViewer url={previewPdfUrl} />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500">
                  Aperçu non disponible
                </div>
              )}
            </div>
          ) : (
            <div
              ref={pdfRef}
              className="bg-white w-full max-w-[210mm] min-h-[297mm] h-fit mx-auto shadow-lg p-10 sm:p-14 text-slate-900"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              {/* En-tête officiel du laboratoire (répété sur chaque page du PDF) */}
              <header className="pdf-header flex justify-between items-start border-b-2 border-blue-900 pb-6 mb-6 bg-white">
                <div>
                  {labSettings.logoUrl ? (
                    <img
                      src={labSettings.logoUrl}
                      alt="Logo Laboratoire"
                      crossOrigin="anonymous"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      className="h-12 object-contain mb-2"
                    />
                  ) : null}
                  <h1 className="text-3xl font-black text-blue-900 uppercase tracking-wider">{labSettings.labName}</h1>
                  <div className="mt-4 text-xs text-slate-600 whitespace-pre-line">
                    {labSettings.labAddress}
                    {'\n'}{labSettings.contactEmail}
                    {'\n'}{labSettings.phone}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-800">RAPPORT D'ANALYSE</div>
                  <div className="text-sm font-medium text-slate-500 mt-1">Réf: {report.id}</div>
                  <div className="mt-6 bg-slate-50 border border-slate-200 p-3 rounded text-left min-w-[200px] inline-block">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Demandeur</div>
                    <div className="font-semibold">{client?.company || client?.name || 'N/A'}</div>
                    <div className="text-sm text-slate-600">{client?.name}</div>
                    <div className="text-xs text-slate-500">{client?.email}</div>
                  </div>
                </div>
              </header>

              {/* 1. Informations Générales */}
              <section className="pdf-block mb-6 pb-2 bg-white">
                <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4 text-slate-800">
                  1. Informations Générales
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-semibold text-slate-600">Titre de l'étude :</span> {report.title}</div>
                  <div><span className="font-semibold text-slate-600">ID Demande :</span> {request?.id || 'N/A'}</div>
                  <div><span className="font-semibold text-slate-600">Date de réception :</span> {reportSamples[0] ? new Date(reportSamples[0].receivedAt).toLocaleDateString('fr-FR') : 'N/A'}</div>
                  <div><span className="font-semibold text-slate-600">Date du rapport :</span> {new Date(report.createdAt).toLocaleDateString('fr-FR')}</div>
                </div>
              </section>

              {/* 2. Matrice des Échantillons */}
              <section className="pdf-block mb-6 pb-2 break-inside-avoid bg-white">
                <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-4 text-slate-800">
                  2. Matrice des Échantillons
                </h2>
                <table className="w-full text-sm border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-200 p-2 text-left font-semibold text-slate-700">ID Échantillon</th>
                      <th className="border border-slate-200 p-2 text-left font-semibold text-slate-700">Matériau</th>
                      <th className="border border-slate-200 p-2 text-left font-semibold text-slate-700">État</th>
                      <th className="border border-slate-200 p-2 text-left font-semibold text-slate-700">Préparation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportSamples.map(sample => (
                      <tr key={sample.id}>
                        <td className="border border-slate-200 p-2 font-mono text-xs">{sample.id}</td>
                        <td className="border border-slate-200 p-2">{sample.project}</td>
                        <td className="border border-slate-200 p-2">{sample.materialState}</td>
                        <td className="border border-slate-200 p-2 text-xs">
                          {sample.mountingInfo?.method || 'Aucune'}
                          {sample.mountingInfo?.resinType ? ` (${sample.mountingInfo.resinType})` : ''}
                          {sample.mountingInfo?.etching ? ` - Attaque: ${sample.mountingInfo.etching}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* 3. Résultats des Analyses */}
              <section className="mb-6">
                <div className="pdf-block bg-white pb-2">
                  <h2 className="text-lg font-bold border-b border-slate-200 pb-2 mb-2 text-slate-800">
                    3. Résultats des Analyses
                  </h2>
                </div>

                {reportSamples.map(sample => {
                  const sampleAnalyses = reportAnalyses.filter(a => a.sampleId === sample.id);
                  if (sampleAnalyses.length === 0) return null;

                  return (
                    <div key={sample.id} className="mb-4">
                      <div className="pdf-block bg-white py-2">
                        <h3 className="text-md font-semibold text-slate-700 bg-slate-50 p-2 border-l-4 border-blue-500">
                          Échantillon {sample.id}
                        </h3>
                      </div>

                      {sampleAnalyses.map(analysis => {
                        const tpl = analysisTemplates.find(t => t.id === analysis.templateId);
                        if (!tpl) return null;

                        return (
                          <div key={analysis.id} className="pdf-block pl-4 py-2 mb-3 break-inside-avoid bg-white">
                            <h4 className="text-sm font-bold text-slate-800 mb-2">{tpl.name}</h4>
                            <table className="w-full text-sm border-collapse border border-slate-200 mb-3">
                              <tbody>
                                {tpl.expectedResults.map(expected => (
                                  <tr key={expected.id}>
                                    <td className="border border-slate-200 p-2 text-slate-600 bg-slate-50 w-1/2">{expected.name}</td>
                                    <td className="border border-slate-200 p-2 font-medium">
                                      {analysis.results[expected.id] !== undefined ? (
                                        expected.type === 'micrography'
                                          ? (() => {
                                            const microValue = analysis.results[expected.id];
                                            const microImages = Array.isArray(microValue?.images) ? microValue.images : [];
                                            if (microImages.length === 0) return <span className="text-slate-400">Aucune image</span>;
                                            return (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {microImages.map((img: any, idx: number) => (
                                                  <div key={img.id || idx} className="min-w-0 rounded border border-slate-200 p-2 break-inside-avoid bg-white">
                                                    <img src={img.dataUrl} alt={img.name || `Micrographie ${idx + 1}`} className="w-full max-h-56 object-contain bg-slate-50" />
                                                    <div className="mt-1 text-xs font-semibold text-slate-600">Image {idx + 1}{img.name ? ` — ${img.name}` : ''}</div>
                                                    {img.comment?.trim() && <p className="mt-1 whitespace-pre-wrap text-xs font-normal text-slate-700">{img.comment}</p>}
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          })()
                                          : expected.type === 'number_series'
                                            ? (() => {
                                              const vals = Array.isArray(analysis.results[expected.id]) ? analysis.results[expected.id] : [];
                                              const numVals = vals.map((v: any) => Number(v)).filter((v: number) => !isNaN(v));
                                              if (numVals.length === 0) return '-';
                                              const mean = numVals.reduce((a: number, b: number) => a + b, 0) / numVals.length;
                                              const variance = numVals.length > 1 ? numVals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / (numVals.length - 1) : null;
                                              const stdDev = variance !== null ? Math.sqrt(variance) : null;
                                              return `Moy: ${mean.toFixed(2)} ${expected.unit || ''} (σ: ${stdDev ? stdDev.toFixed(2) : '-'}) [${vals.join(', ')}]`;
                                            })()
                                            : expected.type === 'boolean'
                                              ? (analysis.results[expected.id] ? 'Conforme / Oui' : 'Non Conforme / Non')
                                              : expected.type === 'multiselect' && Array.isArray(analysis.results[expected.id])
                                                ? analysis.results[expected.id].join(', ')
                                                : `${analysis.results[expected.id]} ${expected.unit || ''}`
                                      ) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {analysis.images.length > 0 && (
                              <div className="grid grid-cols-2 gap-4 mt-3">
                                {analysis.images.map((img, idx) => (
                                  <div key={idx} className="border border-slate-200 p-1 break-inside-avoid bg-white">
                                    <img
                                      src={img}
                                      alt={`Micrographie ${idx + 1}`}
                                      crossOrigin="anonymous"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                      className="w-full h-auto object-contain bg-slate-100"
                                      style={{ maxHeight: '200px' }}
                                    />
                                    <div className="text-center text-xs text-slate-500 mt-1 italic">Fig {idx + 1}. {tpl.name}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {analysis.notes && (
                              <div className="text-sm mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded text-slate-700 italic">
                                <span className="font-semibold block mb-1 text-blue-900 not-italic text-xs uppercase">Observations</span>
                                {analysis.notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {reportAnalyses.length === 0 && (
                  <p className="pdf-block text-sm text-slate-500 italic bg-white py-2">
                    Aucun résultat d'analyse disponible pour les échantillons de ce rapport.
                  </p>
                )}
              </section>

              {/* 4. Conclusion & Approbation (avec pb-6 et pr-3 pour ne jamais tronquer le tampon incliné APPROUVÉ) */}
              <section className="pdf-block mt-8 pt-6 pb-6 pr-3 border-t-2 border-slate-200 break-inside-avoid bg-white">
                <h2 className="text-lg font-bold mb-4 text-slate-800">4. Conclusion & Approbation</h2>
                <div className="flex justify-between items-start">
                  <div className="w-1/2 pr-4">
                    <p className="text-sm text-slate-600 mb-4">
                      Les résultats consignés dans le présent document ne se rapportent qu'aux objets soumis à l'essai. La reproduction de ce rapport d'essai n'est autorisée que sous la forme de fac-similé photographique intégral.
                    </p>
                  </div>
                  <div className="w-1/2 pl-4 flex flex-col items-end">
                    <div className="text-sm text-slate-600 mb-1">Validé par :</div>
                    <div className="font-bold text-slate-900">{manager?.name || 'Responsable Laboratoire'}</div>
                    <div className="text-xs text-slate-500">Manager Technique</div>

                    {report.status === 'genere' ? (
                      <div className="mt-5 mb-2 mr-2 border-2 border-green-600 text-green-600 px-3 py-1.5 font-black uppercase text-xl rotate-[-5deg] opacity-80 inline-block">
                        APPROUVÉ
                      </div>
                    ) : (
                      <div className="mt-4 w-40 h-16 border-b-2 border-dashed border-slate-300"></div>
                    )}
                  </div>
                </div>
              </section>

              {/* Pied de page des accréditations */}
              {labSettings.isoCertifications.length > 0 && (
                <footer className="pdf-footer mt-8 pt-4 pb-2 border-t border-slate-200 text-center text-xs text-slate-500 font-medium tracking-wide bg-white">
                  CERTIFICATIONS LABORATOIRE : {labSettings.isoCertifications.join(' • ')}
                </footer>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}