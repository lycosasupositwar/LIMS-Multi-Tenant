/**
 * Vue Tableau de Bord & Indicateurs Clés de Performance (Dashboard)
 *
 * Fonctionnalités principales :
 * 1. Profil Analyste / Opérateur :
 *    - Résumé des dossiers et analyses assignés personnellement
 *    - Décompte des échantillons en attente de préparation ou d'essais
 *    - Liste des dossiers prioritaires avec modale de consultation rapide et navigation directe
 * 2. Profil Manager / Administrateur :
 *    - Filtres interactifs par période et par laboratoire
 *    - Indicateurs de suivi : demandes en retard, analyses en attente de validation,
 *      taux de clôture, alertes de stock et indicateurs qualité
 *    - Graphiques interactifs Recharts (statuts des demandes, activité des analyses, stocks)
 *    - Bouton unique "Générer Bilan" ouvrant une modale de paramétrage et d'export :
 *      * Export Excel (.xlsx OpenXML natif) avec feuille Dashboard, 3 graphiques Excel natifs
 *        (statuts des demandes, activité des analyses, stocks) et feuilles détaillées
 *        (Demandes, Échantillons, Analyses, Consommables, Modèles)
 *      * Export PDF complet de pilotage
 */

import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { useLims } from '../store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Box,
  Activity,
  CheckCircle,
  FileText,
  AlertCircle,
  ClipboardClock,
  Download,
  Calendar,
  Building2,
  X,
  FileSpreadsheet,
  Clock,
  ShieldAlert,
  TrendingUp,
  Filter
} from 'lucide-react';
import {
  RequestStatus,
  AnalysisRequest,
  Sample,
  Analysis,
  Consumable,
  MaterialTemplate,
  AnalysisTemplate,
  RequestTemplate,
  Laboratory
} from '../types';

type PeriodFilter = 'all' | '7d' | '30d' | '90d' | 'year' | 'custom';

interface DashboardProps {
  onNavigate?: (tab: string, targetId?: string) => void;
}

/* ============================================================================
 * GÉNÉRATEUR OPENXML (.XLSX) NATIF SANS DÉPENDANCE EXTERNE + GRAPHIQUES EXCEL
 * ============================================================================
 * Construit une archive ZIP OpenXML standard contenant :
 * - Les feuilles de calcul typées et stylées
 * - Les objets de dessin (xl/drawings/drawing1.xml)
 * - Les graphiques natifs Excel (xl/charts/chart1..3.xml)
 */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(files: { path: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const fileEntries = files.map(f => {
    const nameBytes = encoder.encode(f.path);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc, offset: 0 };
  });

  let localTotalSize = 0;
  let centralTotalSize = 0;
  for (const entry of fileEntries) {
    entry.offset = localTotalSize;
    localTotalSize += 30 + entry.nameBytes.length + entry.dataBytes.length;
    centralTotalSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localTotalSize + centralTotalSize + 22;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  let pos = 0;
  for (const entry of fileEntries) {
    view.setUint32(pos, 0x04034b50, true); // Local file header signature
    view.setUint16(pos + 4, 20, true); // Version needed
    view.setUint16(pos + 6, 0x0800, true); // UTF-8 flag
    view.setUint16(pos + 8, 0, true); // Store method (uncompressed)
    view.setUint16(pos + 10, 0, true); // Mod time
    view.setUint16(pos + 12, 0x5555, true); // Mod date
    view.setUint32(pos + 14, entry.crc, true);
    view.setUint32(pos + 18, entry.dataBytes.length, true);
    view.setUint32(pos + 22, entry.dataBytes.length, true);
    view.setUint16(pos + 26, entry.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);
    pos += 30;
    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
    out.set(entry.dataBytes, pos);
    pos += entry.dataBytes.length;
  }

  const centralDirOffset = pos;
  for (const entry of fileEntries) {
    view.setUint32(pos, 0x02014b50, true); // Central directory signature
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, 0x0800, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, 0, true);
    view.setUint16(pos + 14, 0x5555, true);
    view.setUint32(pos + 16, entry.crc, true);
    view.setUint32(pos + 20, entry.dataBytes.length, true);
    view.setUint32(pos + 24, entry.dataBytes.length, true);
    view.setUint16(pos + 28, entry.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true);
    view.setUint16(pos + 32, 0, true);
    view.setUint16(pos + 34, 0, true);
    view.setUint16(pos + 36, 0, true);
    view.setUint32(pos + 38, 0, true);
    view.setUint32(pos + 42, entry.offset, true);
    pos += 46;
    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
  }

  // End of central directory record
  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, fileEntries.length, true);
  view.setUint16(pos + 10, fileEntries.length, true);
  view.setUint32(pos + 12, centralTotalSize, true);
  view.setUint32(pos + 16, centralDirOffset, true);
  view.setUint16(pos + 20, 0, true);

  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function xmlEscape(val: any): string {
  return String(val ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(colIndex0: number): string {
  let n = colIndex0 + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

interface XlsxCell {
  v: string | number;
  s?: number; // style index (0: normal, 1: title, 2: section/table header, 3: bold, 4: alert, 5: ok)
}

function buildWorksheetXml(
  rows: (string | number | XlsxCell | null | undefined)[][],
  colWidths: number[],
  hasDrawing = false
): string {
  const colsXml =
    colWidths.length > 0
      ? `<cols>${colWidths
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join('')}</cols>`
      : '';

  const rowsXml = rows
    .map((r, rIdx) => {
      const rowNum = rIdx + 1;
      const cellsXml = r
        .map((c, cIdx) => {
          if (c === null || c === undefined || c === '') return '';
          const ref = `${colLetter(cIdx)}${rowNum}`;
          const isObj = typeof c === 'object' && c !== null && 'v' in c;
          const rawVal = isObj ? (c as XlsxCell).v : c;
          const styleAttr = isObj && (c as XlsxCell).s !== undefined ? ` s="${(c as XlsxCell).s}"` : '';

          if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
            return `<c r="${ref}"${styleAttr}><v>${rawVal}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${xmlEscape(
            rawVal
          )}</t></is></c>`;
        })
        .filter(Boolean)
        .join('');
      return `<row r="${rowNum}">${cellsXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
  ${hasDrawing ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`;
}

function buildBarChartXml(
  title: string,
  seriesName: string,
  catFormula: string,
  valFormula: string,
  categories: string[],
  values: number[],
  accentHex = '2563EB'
): string {
  const strPts = categories
    .map((c, idx) => `<c:pt idx="${idx}"><c:v>${xmlEscape(c)}</c:v></c:pt>`)
    .join('');
  const numPts = values
    .map((v, idx) => `<c:pt idx="${idx}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:lang val="fr-FR"/>
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1100" b="1"/><a:t>${xmlEscape(
        title
      )}</a:t></a:r></a:p></c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx><c:v>${xmlEscape(seriesName)}</c:v></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="${accentHex}"/></a:solidFill></c:spPr>
          <c:cat>
            <c:strRef>
              <c:f>${catFormula}</c:f>
              <c:strCache><c:ptCount val="${categories.length}"/>${strPts}</c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${valFormula}</c:f>
              <c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${numPts}</c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:axId val="101"/>
        <c:axId val="102"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="101"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:crossAx val="102"/>
        <c:crosses val="autoZero"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="102"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:crossAx val="101"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function buildDoughnutChartXml(
  title: string,
  seriesName: string,
  catFormula: string,
  valFormula: string,
  categories: string[],
  values: number[]
): string {
  const strPts = categories
    .map((c, idx) => `<c:pt idx="${idx}"><c:v>${xmlEscape(c)}</c:v></c:pt>`)
    .join('');
  const numPts = values
    .map((v, idx) => `<c:pt idx="${idx}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:lang val="fr-FR"/>
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1100" b="1"/><a:t>${xmlEscape(
        title
      )}</a:t></a:r></a:p></c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:doughnutChart>
        <c:varyColors val="1"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx><c:v>${xmlEscape(seriesName)}</c:v></c:tx>
          <c:cat>
            <c:strRef>
              <c:f>${catFormula}</c:f>
              <c:strCache><c:ptCount val="${categories.length}"/>${strPts}</c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${valFormula}</c:f>
              <c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${numPts}</c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:holeSize val="55"/>
      </c:doughnutChart>
    </c:plotArea>
    <c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

/* ============================================================================
 * FONCTIONS UTILITAIRES MÉTIER (DATES, RETARDS, PÉRIMÈTRE)
 * ============================================================================ */

function getTargetDaysForPriority(priority?: string): number {
  if (priority === 'haute') return 7;
  if (priority === 'basse') return 30;
  return 14; // normale par défaut
}

function getRequestAgeDays(req: AnalysisRequest, refDate = new Date()): number {
  if (!req.createdAt) return 0;
  const created = new Date(req.createdAt);
  if (isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((refDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
}

function isRequestOverdue(req: AnalysisRequest, refDate = new Date()): boolean {
  if (['terminee', 'rejetee', 'brouillon'].includes(req.status)) return false;
  const customDue = req.customData?.dueDate || req.customData?.dateEcheance || req.customData?.deadline;
  if (customDue) {
    const due = new Date(customDue);
    if (!isNaN(due.getTime())) {
      return refDate.getTime() > due.getTime();
    }
  }
  const ageDays = getRequestAgeDays(req, refDate);
  return ageDays > getTargetDaysForPriority(req.priority);
}

function isDateWithinPeriod(
  isoDate: string | undefined,
  period: PeriodFilter,
  customStart: string,
  customEnd: string
): boolean {
  if (period === 'all') return true;
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  if (period === '7d') {
    const min = new Date(now);
    min.setDate(now.getDate() - 7);
    return d >= min;
  }
  if (period === '30d') {
    const min = new Date(now);
    min.setDate(now.getDate() - 30);
    return d >= min;
  }
  if (period === '90d') {
    const min = new Date(now);
    min.setDate(now.getDate() - 90);
    return d >= min;
  }
  if (period === 'year') {
    return d.getFullYear() === now.getFullYear();
  }
  if (period === 'custom') {
    if (customStart) {
      const start = new Date(`${customStart}T00:00:00`);
      if (!isNaN(start.getTime()) && d < start) return false;
    }
    if (customEnd) {
      const end = new Date(`${customEnd}T23:59:59`);
      if (!isNaN(end.getTime()) && d > end) return false;
    }
    return true;
  }
  return true;
}

export function Dashboard({ onNavigate }: DashboardProps = {}) {
  const {
    currentUser,
    laboratories,
    activeLabId,
    samples,
    analyses,
    requests,
    materialTemplates,
    consumables,
    analysisTemplates,
    requestTemplates,
    allSamples,
    allAnalyses,
    allRequests,
    allConsumables,
    allMaterialTemplates,
    allAnalysisTemplates,
    allRequestTemplates,
    labSettings,
    setGlobalSearchQuery
  } = useLims();

  // État pour la modale d'ouverture rapide de dossier côté laborantin (analyste)
  const [selectedAnalystRequest, setSelectedAnalystRequest] = useState<AnalysisRequest | null>(null);

  // États des filtres du Dashboard & de la modale "Générer Bilan"
  const canFilterAllLabs =
    currentUser?.role === 'admin' || !currentUser?.labId || currentUser?.labId === 'all';

  const [selectedLabFilter, setSelectedLabFilter] = useState<string>(activeLabId || 'all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isBilanModalOpen, setIsBilanModalOpen] = useState<boolean>(false);

  // Synchronise le filtre labo par défaut lorsque l'utilisateur change de labo actif
  React.useEffect(() => {
    if (activeLabId) {
      setSelectedLabFilter(activeLabId);
    }
  }, [activeLabId]);

  /**
   * Génère le badge visuel coloré correspondant à un statut de demande
   */
  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'brouillon':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">
            Brouillon
          </span>
        );
      case 'soumise':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Nouvelle Soumission
          </span>
        );
      case 'En Revue':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
            En Revue
          </span>
        );
      case 'validee':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
            Validée
          </span>
        );
      case 'assignee':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
            Assignée
          </span>
        );
      case 'En Cours':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
            En Cours
          </span>
        );
      case 'En Validation':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
            En Validation finale
          </span>
        );
      case 'terminee':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
            Terminée
          </span>
        );
      case 'rejetee':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
            Rejetée
          </span>
        );
    }
  };

  /* =========================================================================
   * 1. TABLEAU DE BORD OPÉRATEUR (ANALYSTE / LABORANTIN)
   * ========================================================================= */
  if (currentUser?.role === 'analyste') {
    const assignedRequests = requests.filter(
      r =>
        r.assignedTo === currentUser.id &&
        ['assignee', 'En Cours', 'En Validation'].includes(r.status)
    );
    const pendingSamples = samples.filter(
      s => s.status === 'receptionne' || s.status === 'en_preparation'
    );
    const myAnalyses = analyses.filter(
      a => a.technician === currentUser.name && a.status === 'En Cours'
    );

    const handleGoToTab = (tab: string, targetId?: string) => {
      if (targetId && setGlobalSearchQuery) {
        setGlobalSearchQuery(targetId);
      }
      if (onNavigate) {
        onNavigate(tab, targetId);
      } else {
        window.dispatchEvent(
          new CustomEvent('lims:navigate', { detail: { tab, targetId } })
        );
      }
      setSelectedAnalystRequest(null);
    };

    const requestSamples = selectedAnalystRequest
      ? samples.filter(s => s.requestId === selectedAnalystRequest.id)
      : [];
    const requestSampleIds = new Set(requestSamples.map(s => s.id));
    const requestAnalyses = selectedAnalystRequest
      ? analyses.filter(a => requestSampleIds.has(a.sampleId))
      : [];

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Bonjour {currentUser.name}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Voici un résumé de vos tâches et dossiers en cours pour aujourd&apos;hui.
            </p>
          </div>
        </div>

        {/* Cartes de synthèse analyste */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-slate-500">Dossiers assignés</h3>
              <p className="text-2xl font-bold font-display text-slate-900">
                {assignedRequests.length}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
              <Activity className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-slate-500">Analyses en cours</h3>
              <p className="text-2xl font-bold font-display text-slate-900">{myAnalyses.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
              <Box className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-slate-500">Échantillons à préparer</h3>
              <p className="text-2xl font-bold font-display text-slate-900">
                {pendingSamples.length}
              </p>
            </div>
          </div>
        </div>

        {/* Liste des dossiers prioritaires */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
            Vos dossiers prioritaires
          </div>
          {assignedRequests.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              Aucun dossier ne vous est actuellement assigné.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assignedRequests.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedAnalystRequest(r)}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-slate-900">{r.id}</span>
                      {getStatusBadge(r.status)}
                    </div>
                    <div className="text-sm text-slate-600">{r.title}</div>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedAnalystRequest(r);
                    }}
                    className="text-blue-600 text-sm font-medium hover:underline px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Ouvrir le dossier
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modale de consultation rapide du dossier côté Laborantin */}
        {selectedAnalystRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-700">
                      {selectedAnalystRequest.id}
                    </span>
                    {getStatusBadge(selectedAnalystRequest.status)}
                  </div>
                  <h3 className="text-lg font-display font-semibold mt-1">
                    {selectedAnalystRequest.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAnalystRequest(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Informations générales */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                  <div>
                    <span className="block text-xs text-slate-500">Date de création</span>
                    <strong className="text-slate-800">
                      {selectedAnalystRequest.createdAt
                        ? new Date(selectedAnalystRequest.createdAt).toLocaleDateString('fr-FR')
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">Priorité</span>
                    <strong className="text-slate-800 uppercase">
                      {selectedAnalystRequest.priority || 'Normale'}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500">Échantillons liés</span>
                    <strong className="text-slate-800">{requestSamples.length}</strong>
                  </div>
                </div>

                {/* Échantillons du dossier */}
                <div>
                  <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">
                    Échantillons associés ({requestSamples.length})
                  </h4>
                  {requestSamples.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">
                      Aucun échantillon rattaché à cette demande pour le moment.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                      {requestSamples.map(s => (
                        <div
                          key={s.id}
                          className="p-3 flex items-center justify-between text-sm bg-white"
                        >
                          <div>
                            <span className="font-mono font-semibold text-slate-900">{s.id}</span>
                            <span className="text-slate-500 ml-2">
                              ({s.materialState} · {s.project || s.client || 'Sans projet'})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700 font-medium">
                            {s.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Analyses du dossier */}
                <div>
                  <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">
                    Essais & Analyses programmés ({requestAnalyses.length})
                  </h4>
                  {requestAnalyses.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">
                      Aucune analyse créée pour les échantillons de ce dossier.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                      {requestAnalyses.map(a => {
                        const tpl = analysisTemplates.find(t => t.id === a.templateId);
                        return (
                          <div
                            key={a.id}
                            className="p-3 flex items-center justify-between text-sm bg-white"
                          >
                            <div>
                              <span className="font-mono font-semibold text-slate-900">{a.id}</span>
                              <span className="text-slate-700 ml-2 font-medium">
                                {tpl?.name || a.templateId}
                              </span>
                              <span className="text-xs text-slate-500 ml-2">
                                (Éch. {a.sampleId})
                              </span>
                            </div>
                            <span className="px-2 py-0.5 text-xs rounded bg-amber-50 text-amber-800 font-medium">
                              {a.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions de navigation directe */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleGoToTab('requests', selectedAnalystRequest.id)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Aller à la Demande complète
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoToTab('samples', selectedAnalystRequest.id)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors"
                  >
                    Voir les Échantillons
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoToTab('analyses', selectedAnalystRequest.id)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                  >
                    Saisir les Analyses
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAnalystRequest(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =========================================================================
   * 2. TABLEAU DE BORD MANAGER / ADMIN (FILTRES, KPIs, QUALITÉ & EXPORTS)
   * ========================================================================= */

  const effectiveLabId = canFilterAllLabs ? selectedLabFilter : currentUser?.labId || activeLabId;

  const baseRequests: AnalysisRequest[] = allRequests || requests;
  const baseSamples: Sample[] = allSamples || samples;
  const baseAnalyses: Analysis[] = allAnalyses || analyses;
  const baseConsumables: Consumable[] = allConsumables || consumables;
  const baseMaterials: MaterialTemplate[] = allMaterialTemplates || materialTemplates;
  const baseAnalysisTemplates: AnalysisTemplate[] = allAnalysisTemplates || analysisTemplates;
  const baseRequestTemplates: RequestTemplate[] = allRequestTemplates || requestTemplates || [];

  const matchLab = (itemLabId?: string) =>
    effectiveLabId === 'all' || !effectiveLabId || itemLabId === effectiveLabId;

  const filteredRequests = useMemo(
    () =>
      baseRequests.filter(
        r =>
          matchLab(r.labId) &&
          isDateWithinPeriod(r.createdAt, periodFilter, customStartDate, customEndDate)
      ),
    [baseRequests, effectiveLabId, periodFilter, customStartDate, customEndDate]
  );

  const filteredSamples = useMemo(
    () =>
      baseSamples.filter(
        s =>
          matchLab(s.labId) &&
          isDateWithinPeriod(s.receivedAt, periodFilter, customStartDate, customEndDate)
      ),
    [baseSamples, effectiveLabId, periodFilter, customStartDate, customEndDate]
  );

  const filteredAnalyses = useMemo(
    () =>
      baseAnalyses.filter(
        a =>
          matchLab(a.labId) &&
          isDateWithinPeriod(a.updatedAt, periodFilter, customStartDate, customEndDate)
      ),
    [baseAnalyses, effectiveLabId, periodFilter, customStartDate, customEndDate]
  );

  const filteredConsumables = useMemo(
    () => baseConsumables.filter(c => matchLab(c.labId)),
    [baseConsumables, effectiveLabId]
  );

  const filteredMaterials = useMemo(
    () => baseMaterials.filter(m => matchLab(m.labId)),
    [baseMaterials, effectiveLabId]
  );

  const filteredAnalysisTemplates = useMemo(
    () => baseAnalysisTemplates.filter(t => matchLab(t.labId)),
    [baseAnalysisTemplates, effectiveLabId]
  );

  const filteredRequestTemplates = useMemo(
    () => baseRequestTemplates.filter(t => matchLab(t.labId)),
    [baseRequestTemplates, effectiveLabId]
  );

  // Calcul des indicateurs de suivi & qualité
  const totalSamples = filteredSamples.length;
  const pendingRequests = filteredRequests.filter(r =>
    ['soumise', 'En Revue'].includes(r.status)
  ).length;
  const inProgressRequests = filteredRequests.filter(r =>
    ['assignee', 'En Cours', 'En Validation'].includes(r.status)
  ).length;
  const completedRequests = filteredRequests.filter(r => r.status === 'terminee').length;
  const rejectedRequests = filteredRequests.filter(r => r.status === 'rejetee').length;
  const overdueRequestsList = filteredRequests.filter(r => isRequestOverdue(r));
  const overdueRequestsCount = overdueRequestsList.length;
  const closureRate = filteredRequests.length
    ? Math.round((completedRequests / filteredRequests.length) * 100)
    : 0;

  const pendingValidationAnalyses = filteredAnalyses.filter(a => a.status === 'a_valider').length;
  const inProgressAnalyses = filteredAnalyses.filter(
    a => a.status === 'En Cours' || a.status === 'a_valider'
  ).length;
  const validatedAnalyses = filteredAnalyses.filter(a =>
    ['valide', 'termine'].includes(a.status)
  ).length;
  const rejectedAnalyses = filteredAnalyses.filter(a => a.status === 'rejete').length;
  const nonConformSamples = filteredSamples.filter(s => s.status === 'non_conforme').length;
  const qualityValidationRate = filteredAnalyses.length
    ? Math.round((validatedAnalyses / filteredAnalyses.length) * 100)
    : 0;

  // Alertes de stock (sous seuil ou péremption <= 60 jours)
  const lowStockConsumables = filteredConsumables.filter(
    c => Number(c.stockLevel) <= Number(c.minThreshold)
  );
  const expiredOrSoonConsumables = filteredConsumables.filter(c => {
    if (!c.expiryDate) return false;
    const exp = new Date(c.expiryDate);
    if (isNaN(exp.getTime())) return false;
    const limit = new Date();
    limit.setDate(limit.getDate() + 60);
    return exp <= limit;
  });

  // Répartition des statuts de demandes
  const requestStatusCount = filteredRequests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData =
    Object.keys(requestStatusCount).length > 0
      ? Object.entries(requestStatusCount).map(([status, count]) => ({
          name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count
        }))
      : [{ name: 'Aucune demande', count: 0 }];

  // Répartition de l'activité des analyses
  const analysisStatusCount = filteredAnalyses.reduce((acc, ana) => {
    acc[ana.status] = (acc[ana.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const analysisChartData =
    Object.keys(analysisStatusCount).length > 0
      ? Object.entries(analysisStatusCount).map(([status, count]) => ({
          name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count
        }))
      : [{ name: 'Aucune analyse', count: 0 }];

  const pieData = [
    {
      name: 'Stock OK',
      value: Math.max(0, filteredConsumables.length - lowStockConsumables.length)
    },
    { name: 'Stock Bas / Alerte', value: lowStockConsumables.length }
  ];

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case '7d':
        return '7 derniers jours';
      case '30d':
        return '30 derniers jours';
      case '90d':
        return '90 derniers jours (Trimestre)';
      case 'year':
        return `Année en cours (${new Date().getFullYear()})`;
      case 'custom':
        return `Du ${customStartDate || '...'} au ${customEndDate || '...'}`;
      default:
        return 'Toutes les périodes';
    }
  };

  const getLabLabel = (labId?: string) => {
    if (!labId || labId === 'all') return 'Tous les laboratoires';
    const found = laboratories?.find((l: Laboratory) => l.id === labId);
    return found ? `${found.name} (${found.code})` : labId;
  };

  /**
   * Génère le Bilan PDF complet en prenant en compte les filtres sélectionnés
   */
  const generateBilanPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    const generatedAt = new Date();
    const dateLabel = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(generatedAt);

    const selectedLabObj = laboratories?.find((l: Laboratory) => l.id === effectiveLabId);
    const labName =
      effectiveLabId === 'all'
        ? 'Direction Multi-Laboratoires'
        : selectedLabObj?.settings?.labName || selectedLabObj?.name || labSettings?.labName || 'Laboratoire';
    const labAddress = selectedLabObj?.settings?.labAddress || labSettings?.labAddress || '';
    const labContact = [
      selectedLabObj?.settings?.contactEmail || labSettings?.contactEmail,
      selectedLabObj?.settings?.phone || labSettings?.phone
    ]
      .filter(Boolean)
      .join(' · ');

    let y = 18;

    const ensureSpace = (needed = 16) => {
      if (y + needed > pageHeight - 17) {
        doc.addPage();
        y = 18;
      }
    };
    const section = (title: string) => {
      ensureSpace(17);
      doc.setFillColor(30, 64, 104);
      doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, margin + 3, y + 5.4);
      y += 13;
      doc.setTextColor(35, 45, 58);
      doc.setFont('helvetica', 'normal');
    };
    const line = (label: string, value: string | number) => {
      const lines = doc.splitTextToSize(`${label} : ${value}`, contentWidth - 4);
      ensureSpace(lines.length * 5 + 2);
      doc.setFontSize(9);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.8 + 1.8;
    };
    const table = (headers: string[], rows: string[][], widths?: number[]) => {
      const cols = widths || headers.map(() => contentWidth / headers.length);
      const drawRow = (cells: string[], header = false) => {
        const wrapped = cells.map((c, i) => doc.splitTextToSize(String(c ?? '—'), cols[i] - 3));
        const rowH = Math.max(7, ...wrapped.map(w => w.length * 4 + 3));
        ensureSpace(rowH + 1);
        let x = margin;
        cells.forEach((_, i) => {
          if (header) doc.setFillColor(226, 232, 240);
          else doc.setFillColor(255, 255, 255);
          doc.setDrawColor(203, 213, 225);
          doc.rect(x, y - 3.5, cols[i], rowH, 'FD');
          doc.setTextColor(35, 45, 58);
          doc.setFont('helvetica', header ? 'bold' : 'normal');
          doc.setFontSize(8);
          doc.text(wrapped[i], x + 1.5, y + 0.5);
          x += cols[i];
        });
        y += rowH;
      };
      drawRow(headers, true);
      rows.forEach(row => drawRow(row));
      y += 4;
    };

    doc.setFillColor(15, 45, 78);
    doc.rect(0, 0, pageWidth, 43, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('BILAN D’ACTIVITÉ & QUALITÉ DU LABORATOIRE', margin, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(labName, margin, 26);
    doc.setFontSize(8.5);
    doc.text(`Généré le ${dateLabel} · Période : ${getPeriodLabel()}`, margin, 34);
    doc.setTextColor(35, 45, 58);
    y = 50;

    if (labAddress) line('Adresse', labAddress);
    if (labContact) line('Contact', labContact);
    line('Périmètre laboratoire', getLabLabel(effectiveLabId));
    line('Période filtrée', getPeriodLabel());
    line('Préparé par', currentUser?.name || 'Utilisateur connecté');

    section('1. Synthèse exécutive, KPI & Indicateurs de suivi');
    table(
      ['Indicateur de pilotage', 'Valeur', 'Analyse & État'],
      [
        ['Demandes enregistrées', String(filteredRequests.length), `${inProgressRequests} en traitement`],
        ['Taux de clôture des demandes', `${closureRate} %`, `${completedRequests} demande(s) terminée(s)`],
        [
          'Demandes en retard',
          String(overdueRequestsCount),
          overdueRequestsCount > 0 ? 'ALERTE : dépassement délai cible' : 'Aucun retard détecté'
        ],
        [
          'Analyses en attente de validation',
          String(pendingValidationAnalyses),
          pendingValidationAnalyses > 0 ? 'Action manager requise' : 'Aucune en attente'
        ],
        [
          'Indicateur Qualité : Analyses validées',
          `${validatedAnalyses} (${qualityValidationRate} %)`,
          `${rejectedAnalyses} essai(s) refusé(s) / repris`
        ],
        [
          'Indicateur Qualité : Échantillons non conformes',
          String(nonConformSamples),
          `Sur ${filteredSamples.length} échantillon(s)`
        ],
        [
          'Alertes de stock (sous seuil)',
          String(lowStockConsumables.length),
          lowStockConsumables.length > 0 ? 'Réapprovisionnement requis' : 'Stocks nominaux'
        ],
        [
          'Alertes péremption consommables (<= 60j)',
          String(expiredOrSoonConsumables.length),
          expiredOrSoonConsumables.length > 0 ? 'Lot(s) à contrôler' : 'Aucune alerte'
        ]
      ],
      [contentWidth * 0.44, contentWidth * 0.18, contentWidth * 0.38]
    );

    section('2. Suivi des demandes et retards');
    const reqRows = filteredRequests
      .slice(0, 20)
      .map(r => [
        r.id,
        r.title || 'Sans titre',
        r.status,
        r.priority || 'normale',
        isRequestOverdue(r) ? `OUI (${getRequestAgeDays(r)}j)` : `Non (${getRequestAgeDays(r)}j)`
      ]);
    table(
      ['Référence', 'Titre', 'Statut', 'Priorité', 'En retard'],
      reqRows.length ? reqRows : [['—', 'Aucune demande sur la période', '—', '—', '—']],
      [
        contentWidth * 0.2,
        contentWidth * 0.34,
        contentWidth * 0.18,
        contentWidth * 0.13,
        contentWidth * 0.15
      ]
    );

    section('3. Échantillons, Analyses et Validation technique');
    const anaRows = filteredAnalyses
      .slice(0, 20)
      .map(a => [
        a.id,
        a.sampleId,
        filteredAnalysisTemplates.find(t => t.id === a.templateId)?.name || a.templateId,
        a.technician || 'Non assigné',
        a.status
      ]);
    table(
      ['ID Analyse', 'Échantillon', 'Méthode / Modèle', 'Technicien', 'Statut'],
      anaRows.length ? anaRows : [['—', '—', 'Aucune analyse sur la période', '—', '—']],
      [
        contentWidth * 0.18,
        contentWidth * 0.18,
        contentWidth * 0.3,
        contentWidth * 0.18,
        contentWidth * 0.16
      ]
    );

    section('4. Alertes de stock & Consommables');
    const stockRows = filteredConsumables
      .slice(0, 25)
      .map(c => [
        c.name,
        c.category,
        `${c.stockLevel} ${c.unit || ''}`,
        `${c.minThreshold} ${c.unit || ''}`,
        c.expiryDate || '—',
        Number(c.stockLevel) <= Number(c.minThreshold) ? 'ALERTE STOCK' : 'OK'
      ]);
    table(
      ['Consommable', 'Catégorie', 'Stock', 'Seuil', 'Péremption', 'État'],
      stockRows.length ? stockRows : [['—', '—', '—', '—', '—', 'Aucun consommable']],
      [
        contentWidth * 0.28,
        contentWidth * 0.16,
        contentWidth * 0.14,
        contentWidth * 0.14,
        contentWidth * 0.14,
        contentWidth * 0.14
      ]
    );

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${labName} · Bilan généré le ${generatedAt.toLocaleDateString('fr-FR')}`,
        margin,
        pageHeight - 7
      );
      doc.text(`Page ${i}/${pages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    const fileDate = generatedAt.toISOString().slice(0, 10);
    doc.save(`bilan-laboratoire-${fileDate}.pdf`);
    setIsBilanModalOpen(false);
  };

  /**
   * Génère un véritable classeur Excel OpenXML (.xlsx) natif contenant :
   * - Feuille 1 : Dashboard (KPIs, Indicateurs Qualité, Alertes de stock + 3 Graphiques Excel natifs)
   * - Feuille 2 : Demandes
   * - Feuille 3 : Échantillons
   * - Feuille 4 : Analyses
   * - Feuille 5 : Consommables
   * - Feuille 6 : Modèles
   */
  const generateExcelDashboard = () => {
    const now = new Date();
    const dateLabel = now.toLocaleString('fr-FR');
    const selectedLabObj = laboratories?.find((l: Laboratory) => l.id === effectiveLabId);
    const labTitle =
      effectiveLabId === 'all'
        ? 'Tous les laboratoires'
        : selectedLabObj?.name || labSettings?.labName || 'Laboratoire';

    // Préparation des séries pour les 3 graphiques Excel natifs sur la feuille Dashboard
    const reqChartItems: [string, number][] =
      Object.entries(requestStatusCount).length > 0
        ? (Object.entries(requestStatusCount) as [string, number][])
        : [['Aucune demande', 0]];

    const anaChartItems: [string, number][] =
      Object.entries(analysisStatusCount).length > 0
        ? (Object.entries(analysisStatusCount) as [string, number][])
        : [['Aucune analyse', 0]];

    const stockOkCount = Math.max(0, filteredConsumables.length - lowStockConsumables.length);
    const stockChartItems: [string, number][] = [
      ['Stock Nominal (OK)', stockOkCount],
      ['En Alerte (Sous seuil)', lowStockConsumables.length],
      ['Péremption Proche / Dépassée', expiredOrSoonConsumables.length]
    ];

    // Construction de la feuille 1 : Dashboard
    const dashRows: (string | number | XlsxCell | null)[][] = [
      [{ v: 'TABLEAU DE BORD LIMS - KPI, QUALITÉ & ALERTES DE STOCK', s: 1 }],
      [
        { v: 'Laboratoire :', s: 3 },
        labTitle,
        null,
        { v: 'Date de génération :', s: 3 },
        dateLabel
      ],
      [
        { v: 'Période filtrée :', s: 3 },
        getPeriodLabel(),
        null,
        { v: 'Généré par :', s: 3 },
        currentUser?.name || 'Utilisateur connecté'
      ],
      [],
      [
        { v: 'INDICATEURS CLÉS DE PERFORMANCE (KPI) & SUIVI', s: 2 },
        { v: 'VALEUR', s: 2 },
        { v: 'STATUT / SEUIL', s: 2 },
        { v: 'COMMENTAIRE OPÉRATIONNEL', s: 2 }
      ],
      [
        'Demandes totales sur la période',
        filteredRequests.length,
        { v: 'INFO', s: 5 },
        `${inProgressRequests} demande(s) actuellement en traitement`
      ],
      [
        'Demandes en retard (dépassement délai cible)',
        overdueRequestsCount,
        overdueRequestsCount > 0 ? { v: 'ALERTE RETARD', s: 4 } : { v: 'CONFORME', s: 5 },
        overdueRequestsCount > 0
          ? `${overdueRequestsCount} dossier(s) dépassent l'échéance cible`
          : 'Aucun dossier hors délai'
      ],
      [
        'Analyses en attente de validation technique',
        pendingValidationAnalyses,
        pendingValidationAnalyses > 0 ? { v: 'À VALIDER', s: 4 } : { v: 'À JOUR', s: 5 },
        pendingValidationAnalyses > 0
          ? 'Validation manager requise pour émission rapport'
          : 'Aucune analyse en attente'
      ],
      [
        'Taux de clôture des demandes (%)',
        closureRate,
        closureRate >= 70 ? { v: 'PERFORMANT', s: 5 } : { v: 'EN SUIVI', s: 3 },
        `${completedRequests} demande(s) terminée(s) sur ${filteredRequests.length}`
      ],
      [
        'Alertes de stock (consommables sous seuil mini)',
        lowStockConsumables.length,
        lowStockConsumables.length > 0 ? { v: 'ALERTE STOCK', s: 4 } : { v: 'STOCK OK', s: 5 },
        lowStockConsumables.length > 0
          ? 'Commande de réapprovisionnement recommandée'
          : 'Tous les consommables sont au-dessus du seuil'
      ],
      [],
      [
        { v: 'INDICATEURS QUALITÉ (ISO/IEC 17025)', s: 2 },
        { v: 'VALEUR', s: 2 },
        { v: 'ÉTAT QUALITÉ', s: 2 },
        { v: 'DÉTAIL TRAÇABILITÉ', s: 2 }
      ],
      [
        'Taux de validation technique des analyses (%)',
        qualityValidationRate,
        qualityValidationRate >= 80 ? { v: 'MAÎTRISÉ', s: 5 } : { v: 'SURVEILLANCE', s: 3 },
        `${validatedAnalyses} validée(s) / terminée(s) sur ${filteredAnalyses.length}`
      ],
      [
        'Analyses refusées / reprises pour non-conformité',
        rejectedAnalyses,
        rejectedAnalyses > 0 ? { v: 'NON-CONFORMITÉ', s: 4 } : { v: 'ZÉRO REJET', s: 5 },
        'Essais ayant fait l’objet d’un refus manager'
      ],
      [
        'Échantillons déclarés non conformes à réception',
        nonConformSamples,
        nonConformSamples > 0 ? { v: 'NC RÉCEPTION', s: 4 } : { v: 'CONFORME', s: 5 },
        `Sur un total de ${filteredSamples.length} échantillon(s)`
      ],
      [
        'Demandes clients rejetées',
        rejectedRequests,
        rejectedRequests > 0 ? { v: 'REJET CLIENT', s: 4 } : { v: 'AUCUN REJET', s: 5 },
        'Demandes incomplètes ou hors périmètre'
      ],
      [
        'Consommables à péremption proche (<= 60j) ou expirés',
        expiredOrSoonConsumables.length,
        expiredOrSoonConsumables.length > 0 ? { v: 'ALERTE LOT', s: 4 } : { v: 'CONFORME', s: 5 },
        'Vérification de validité des réactifs et étalons'
      ],
      []
    ];

    // Tableaux sources pour les 3 graphiques Excel natifs (placés à partir de la ligne 19)
    dashRows.push([
      { v: 'DONNÉES GRAPHIQUE 1 : STATUTS DES DEMANDES', s: 2 },
      { v: 'NOMBRE DE DEMANDES', s: 2 }
    ]);
    const reqStartRow = dashRows.length + 1;
    reqChartItems.forEach(([status, count]) => {
      dashRows.push([status, count]);
    });
    const reqEndRow = dashRows.length;

    dashRows.push([]);

    dashRows.push([
      { v: 'DONNÉES GRAPHIQUE 2 : ACTIVITÉ DES ANALYSES', s: 2 },
      { v: 'NOMBRE D’ANALYSES', s: 2 }
    ]);
    const anaStartRow = dashRows.length + 1;
    anaChartItems.forEach(([status, count]) => {
      dashRows.push([status, count]);
    });
    const anaEndRow = dashRows.length;

    dashRows.push([]);

    dashRows.push([
      { v: 'DONNÉES GRAPHIQUE 3 : SYNTHÈSE DES STOCKS', s: 2 },
      { v: 'NOMBRE DE RÉFÉRENCES', s: 2 }
    ]);
    const stockStartRow = dashRows.length + 1;
    stockChartItems.forEach(([label, count]) => {
      dashRows.push([label, count]);
    });
    const stockEndRow = dashRows.length;

    dashRows.push([]);

    dashRows.push([
      { v: 'LISTE DES ALERTES DE STOCK PRIORITAIRES', s: 2 },
      { v: 'CATÉGORIE', s: 2 },
      { v: 'STOCK ACTUEL', s: 2 },
      { v: 'SEUIL MINI', s: 2 },
      { v: 'PÉREMPTION', s: 2 }
    ]);
    if (lowStockConsumables.length === 0) {
      dashRows.push(['Aucune alerte de seuil critique détectée', '—', 0, 0, '—']);
    } else {
      lowStockConsumables.forEach(c => {
        dashRows.push([
          { v: c.name, s: 4 },
          c.category,
          Number(c.stockLevel),
          Number(c.minThreshold),
          c.expiryDate || 'Non renseignée'
        ]);
      });
    }

    // Feuille 2 : Demandes détaillées
    const requestsRows: (string | number | XlsxCell)[][] = [
      [
        { v: 'Référence', s: 2 },
        { v: 'Laboratoire', s: 2 },
        { v: 'Titre de la demande', s: 2 },
        { v: 'Statut', s: 2 },
        { v: 'Priorité', s: 2 },
        { v: 'Date création', s: 2 },
        { v: 'Ancienneté (jours)', s: 2 },
        { v: 'En retard', s: 2 },
        { v: 'Assigné à', s: 2 },
        { v: 'Conclusion / Motif rejet', s: 2 }
      ],
      ...filteredRequests.map(r => {
        const overdue = isRequestOverdue(r);
        return [
          r.id,
          getLabLabel(r.labId),
          r.title || '',
          r.status,
          r.priority || 'normale',
          r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '',
          getRequestAgeDays(r),
          overdue ? { v: 'OUI (RETARD)', s: 4 } : { v: 'NON', s: 5 },
          r.assignedTo || 'Non assigné',
          r.conclusion || r.rejectionReason || ''
        ];
      })
    ];

    // Feuille 3 : Échantillons détaillés
    const samplesRows: (string | number | XlsxCell)[][] = [
      [
        { v: 'ID Échantillon', s: 2 },
        { v: 'Code-barres', s: 2 },
        { v: 'Laboratoire', s: 2 },
        { v: 'Demande liée', s: 2 },
        { v: 'Client', s: 2 },
        { v: 'Projet', s: 2 },
        { v: 'Statut', s: 2 },
        { v: 'Priorité', s: 2 },
        { v: 'État matière', s: 2 },
        { v: 'Date réception', s: 2 },
        { v: 'Notes', s: 2 }
      ],
      ...filteredSamples.map(s => [
        s.id,
        s.barcode || '',
        getLabLabel(s.labId),
        s.requestId || '—',
        s.client || '',
        s.project || '',
        s.status === 'non_conforme' ? { v: s.status, s: 4 } : s.status,
        s.priority || 'normale',
        s.materialState || '',
        s.receivedAt ? new Date(s.receivedAt).toLocaleDateString('fr-FR') : '',
        s.notes || ''
      ])
    ];

    // Feuille 4 : Analyses détaillées
    const analysesRows: (string | number | XlsxCell)[][] = [
      [
        { v: 'ID Analyse', s: 2 },
        { v: 'Laboratoire', s: 2 },
        { v: 'ID Échantillon', s: 2 },
        { v: 'Modèle / Méthode', s: 2 },
        { v: 'Technicien', s: 2 },
        { v: 'Statut', s: 2 },
        { v: 'Attente validation', s: 2 },
        { v: 'Dernière mise à jour', s: 2 },
        { v: 'Synthèse des résultats', s: 2 },
        { v: 'Notes / Motif refus', s: 2 }
      ],
      ...filteredAnalyses.map(a => {
        const tplName =
          filteredAnalysisTemplates.find(t => t.id === a.templateId)?.name || a.templateId;
        const resultSummary = Object.entries(a.results || {})
          .map(([k, v]) => {
            if (v && typeof v === 'object') return `${k}: [Objet/Image]`;
            return `${k}: ${v}`;
          })
          .join(' | ');
        return [
          a.id,
          getLabLabel(a.labId),
          a.sampleId,
          tplName,
          a.technician || 'Non assigné',
          a.status,
          a.status === 'a_valider' ? { v: 'OUI (À VALIDER)', s: 4 } : { v: 'NON', s: 5 },
          a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('fr-FR') : '',
          resultSummary || 'Aucun résultat saisi',
          a.rejectionReason || a.notes || ''
        ];
      })
    ];

    // Feuille 5 : Consommables détaillés
    const consumablesRows: (string | number | XlsxCell)[][] = [
      [
        { v: 'ID', s: 2 },
        { v: 'Laboratoire', s: 2 },
        { v: 'Désignation consommable', s: 2 },
        { v: 'Catégorie', s: 2 },
        { v: 'Stock actuel', s: 2 },
        { v: 'Seuil minimum', s: 2 },
        { v: 'Unité', s: 2 },
        { v: 'Statut Stock', s: 2 },
        { v: 'Dernier réapprovisionnement', s: 2 },
        { v: 'Date de péremption', s: 2 }
      ],
      ...filteredConsumables.map(c => {
        const isLow = Number(c.stockLevel) <= Number(c.minThreshold);
        return [
          c.id,
          getLabLabel(c.labId),
          c.name,
          c.category,
          Number(c.stockLevel),
          Number(c.minThreshold),
          c.unit || '',
          isLow ? { v: 'ALERTE SOUS SEUIL', s: 4 } : { v: 'STOCK OK', s: 5 },
          c.lastRestocked ? new Date(c.lastRestocked).toLocaleDateString('fr-FR') : '—',
          c.expiryDate || '—'
        ];
      })
    ];

    // Feuille 6 : Modèles (Matériaux, Analyses et Demandes)
    const modelsRows: (string | number | XlsxCell)[][] = [
      [
        { v: 'Type de modèle', s: 2 },
        { v: 'Identifiant', s: 2 },
        { v: 'Laboratoire', s: 2 },
        { v: 'Nom du modèle', s: 2 },
        { v: 'Catégorie / Norme', s: 2 },
        { v: 'Actif', s: 2 },
        { v: 'Nombre de champs / attendus', s: 2 },
        { v: 'Détail des paramètres configurés', s: 2 }
      ],
      ...filteredMaterials.map(m => [
        'Modèle Matériau',
        m.id,
        getLabLabel(m.labId),
        m.name,
        m.category || '—',
        m.isActive === false ? 'Non' : 'Oui',
        (m.fields || []).length,
        (m.fields || [])
          .map(f => `${f.name} (${f.type}${f.unit ? ', ' + f.unit : ''})`)
          .join(' ; ')
      ]),
      ...filteredAnalysisTemplates.map(t => [
        'Modèle Analyse',
        t.id,
        getLabLabel(t.labId),
        t.name,
        [t.category, t.standardRef].filter(Boolean).join(' · ') || '—',
        t.isActive === false ? 'Non' : 'Oui',
        (t.expectedResults || []).length,
        (t.expectedResults || [])
          .map(r => `${r.name} (${r.type}${r.unit ? ', ' + r.unit : ''})`)
          .join(' ; ')
      ]),
      ...filteredRequestTemplates.map(rt => [
        'Modèle Demande',
        rt.id,
        getLabLabel(rt.labId),
        rt.name,
        rt.description || '—',
        rt.isActive === false ? 'Non' : 'Oui',
        (rt.fields || []).length,
        (rt.fields || []).map(f => `${f.name} (${f.type})`).join(' ; ')
      ])
    ];

    // Génération des 3 graphiques Excel natifs liés à la feuille Dashboard
    const chart1Xml = buildBarChartXml(
      'Répartition par Statut des Demandes',
      'Demandes',
      `Dashboard!$A$${reqStartRow}:$A$${reqEndRow}`,
      `Dashboard!$B$${reqStartRow}:$B$${reqEndRow}`,
      reqChartItems.map(x => x[0]),
      reqChartItems.map(x => x[1]),
      '2563EB'
    );

    const chart2Xml = buildBarChartXml(
      'Activité et Statuts des Analyses',
      'Analyses',
      `Dashboard!$A$${anaStartRow}:$A$${anaEndRow}`,
      `Dashboard!$B$${anaStartRow}:$B$${anaEndRow}`,
      anaChartItems.map(x => x[0]),
      anaChartItems.map(x => x[1]),
      'D97706'
    );

    const chart3Xml = buildDoughnutChartXml(
      'État des Stocks & Alertes Consommables',
      'Consommables',
      `Dashboard!$A$${stockStartRow}:$A$${stockEndRow}`,
      `Dashboard!$B$${stockStartRow}:$B$${stockEndRow}`,
      stockChartItems.map(x => x[0]),
      stockChartItems.map(x => x[1])
    );

    // Ancrage des 3 graphiques natifs à droite des tableaux sur la feuille Dashboard (colonnes F à M)
    const drawing1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>15</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Graphique Statuts Demandes"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId1"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>16</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>30</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="3" name="Graphique Activite Analyses"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId2"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>31</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>45</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="4" name="Graphique Alertes Stocks"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId3"/></a:graphicData></a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="10"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF991B1B"/><name val="Calibri"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F2D4E"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E4068"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;

    const zipFiles: { path: string; content: string }[] = [
      {
        path: '[Content_Types].xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet6.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
  <Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/xl/charts/chart3.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
</Types>`
      },
      {
        path: '_rels/.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
      },
      {
        path: 'xl/workbook.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Dashboard" sheetId="1" r:id="rId1"/>
    <sheet name="Demandes" sheetId="2" r:id="rId2"/>
    <sheet name="Échantillons" sheetId="3" r:id="rId3"/>
    <sheet name="Analyses" sheetId="4" r:id="rId4"/>
    <sheet name="Consommables" sheetId="5" r:id="rId5"/>
    <sheet name="Modèles" sheetId="6" r:id="rId6"/>
  </sheets>
</workbook>`
      },
      {
        path: 'xl/_rels/workbook.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet6.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
      },
      { path: 'xl/styles.xml', content: stylesXml },
      {
        path: 'xl/worksheets/sheet1.xml',
        content: buildWorksheetXml(dashRows, [44, 18, 22, 42, 18], true)
      },
      {
        path: 'xl/worksheets/_rels/sheet1.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`
      },
      {
        path: 'xl/worksheets/sheet2.xml',
        content: buildWorksheetXml(requestsRows, [18, 24, 34, 16, 12, 16, 18, 16, 20, 32])
      },
      {
        path: 'xl/worksheets/sheet3.xml',
        content: buildWorksheetXml(samplesRows, [18, 20, 24, 18, 22, 22, 16, 12, 16, 16, 30])
      },
      {
        path: 'xl/worksheets/sheet4.xml',
        content: buildWorksheetXml(analysesRows, [18, 24, 18, 28, 20, 16, 18, 18, 38, 28])
      },
      {
        path: 'xl/worksheets/sheet5.xml',
        content: buildWorksheetXml(consumablesRows, [16, 24, 30, 16, 14, 14, 12, 20, 20, 18])
      },
      {
        path: 'xl/worksheets/sheet6.xml',
        content: buildWorksheetXml(modelsRows, [20, 18, 24, 28, 24, 10, 22, 50])
      },
      { path: 'xl/drawings/drawing1.xml', content: drawing1Xml },
      {
        path: 'xl/drawings/_rels/drawing1.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart3.xml"/>
</Relationships>`
      },
      { path: 'xl/charts/chart1.xml', content: chart1Xml },
      { path: 'xl/charts/chart2.xml', content: chart2Xml },
      { path: 'xl/charts/chart3.xml', content: chart3Xml }
    ];

    const blob = createZipArchive(zipFiles);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-lims-${now.toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setIsBilanModalOpen(false);
  };

  /**
   * Composant carte d'indicateur individuel
   */
  const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, highlight }: any) => (
    <div
      className={`bg-white rounded-xl p-5 border ${
        highlight ? 'border-red-400 shadow-md ring-1 ring-red-100' : 'border-slate-200 shadow-sm'
      } flex items-center relative overflow-hidden`}
    >
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="ml-4 z-10 min-w-0">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">
          {title}
        </h3>
        <p className="text-2xl font-bold font-display text-slate-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* En-tête + Bouton unique "Générer Bilan" */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">
            Direction, Qualité & KPI Laboratoire
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Supervision opérationnelle, suivi des retards, validation technique et alertes de stock.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBilanModalOpen(true)}
            className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Générer Bilan
          </button>
        </div>
      </div>

      {/* Barre de filtres par Période et par Laboratoire */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Filtres :</span>
        </div>

        {/* Filtre Laboratoire */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <select
            value={effectiveLabId}
            disabled={!canFilterAllLabs}
            onChange={e => setSelectedLabFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            {canFilterAllLabs && <option value="all">Tous les laboratoires</option>}
            {(laboratories || []).map((lab: Laboratory) => (
              <option key={lab.id} value={lab.id}>
                {lab.name} ({lab.code})
              </option>
            ))}
          </select>
        </div>

        {/* Filtre Période */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les périodes</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours (Trimestre)</option>
            <option value="year">Année en cours ({new Date().getFullYear()})</option>
            <option value="custom">Période personnalisée...</option>
          </select>
        </div>

        {periodFilter === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Du</span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-sm"
            />
            <span className="text-slate-500">au</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-sm"
            />
          </div>
        )}

        {(periodFilter !== 'all' || (canFilterAllLabs && effectiveLabId === 'all')) && (
          <button
            onClick={() => {
              setPeriodFilter('all');
              setCustomStartDate('');
              setCustomEndDate('');
              if (activeLabId) setSelectedLabFilter(activeLabId);
            }}
            className="text-xs text-blue-600 hover:underline ml-auto"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Ligne 1 : Indicateurs de suivi exigés (Retards, Attente validation, Taux de clôture, Alertes stock) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Demandes en retard"
          value={overdueRequestsCount}
          subtitle={`Sur ${inProgressRequests + pendingRequests} demandes ouvertes`}
          icon={Clock}
          colorClass="bg-red-100 text-red-600"
          highlight={overdueRequestsCount > 0}
        />
        <StatCard
          title="Analyses à valider"
          value={pendingValidationAnalyses}
          subtitle={`${inProgressAnalyses} analyse(s) active(s)`}
          icon={ShieldAlert}
          colorClass="bg-amber-100 text-amber-600"
          highlight={pendingValidationAnalyses > 0}
        />
        <StatCard
          title="Taux de clôture"
          value={`${closureRate} %`}
          subtitle={`${completedRequests} / ${filteredRequests.length} demandes terminées`}
          icon={TrendingUp}
          colorClass="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Alertes de stock"
          value={lowStockConsumables.length}
          subtitle={`${expiredOrSoonConsumables.length} lot(s) à péremption proche`}
          icon={AlertCircle}
          colorClass="bg-rose-100 text-rose-600"
          highlight={lowStockConsumables.length > 0}
        />
      </div>

      {/* Ligne 2 : Volumétrie & Indicateurs Qualité */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Demandes à revoir"
          value={pendingRequests}
          subtitle="Nouvelles soumissions & revues"
          icon={ClipboardClock}
          colorClass="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Échantillons suivis"
          value={totalSamples}
          subtitle={`${nonConformSamples} non conforme(s)`}
          icon={Box}
          colorClass="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Validation Qualité"
          value={`${qualityValidationRate} %`}
          subtitle={`${validatedAnalyses} essai(s) validé(s) ou terminé(s)`}
          icon={CheckCircle}
          colorClass="bg-teal-100 text-teal-600"
        />
        <StatCard
          title="Essais repris / rejetés"
          value={rejectedAnalyses}
          subtitle={`${rejectedRequests} demande(s) rejetée(s)`}
          icon={Activity}
          colorClass="bg-slate-100 text-slate-700"
        />
      </div>

      {/* Graphiques interactifs Recharts (Demandes, Analyses, Stocks) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique 1 : Statuts des demandes */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-display font-semibold text-slate-900 mb-4">
            Statuts des Demandes
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique 2 : Activité des analyses */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-display font-semibold text-slate-900 mb-4">
            Activité des Analyses
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysisChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique 3 : État des stocks consommables */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-display font-semibold text-slate-900 mb-4">
            État des Stocks & Alertes
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center flex-wrap gap-4 -mt-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center text-xs text-slate-600">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {entry.name} ({entry.value})
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modale unique "Générer Bilan" (Choix des filtres + Format Excel .xlsx ou PDF) */}
      {isBilanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Download className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-display font-semibold mt-1 text-slate-900">
                  Générer le Bilan d&apos;Activité & Qualité
                </h3>
              </div>
              <button
                onClick={() => setIsBilanModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600">
                Configurez le périmètre et la période du bilan, puis choisissez le format d&apos;export souhaité :
              </p>

              {/* Sélection Laboratoire et Période dans la modale */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Périmètre Laboratoire
                  </label>
                  <select
                    value={effectiveLabId}
                    disabled={!canFilterAllLabs}
                    onChange={e => setSelectedLabFilter(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  >
                    {canFilterAllLabs && <option value="all">Tous les laboratoires</option>}
                    {(laboratories || []).map((lab: Laboratory) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name} ({lab.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Période d&apos;analyse
                  </label>
                  <select
                    value={periodFilter}
                    onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Toutes les données disponibles</option>
                    <option value="7d">7 derniers jours</option>
                    <option value="30d">30 derniers jours</option>
                    <option value="90d">90 derniers jours (Trimestre)</option>
                    <option value="year">Année en cours ({new Date().getFullYear()})</option>
                    <option value="custom">Plage de dates personnalisée</option>
                  </select>
                </div>
              </div>

              {periodFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Date de fin
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Aperçu synthétique des données incluses */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-700 uppercase">
                  Aperçu du périmètre sélectionné ({getPeriodLabel()})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
                  <div>
                    • Demandes : <strong className="text-slate-900">{filteredRequests.length}</strong>{' '}
                    ({overdueRequestsCount} en retard)
                  </div>
                  <div>
                    • Échantillons :{' '}
                    <strong className="text-slate-900">{filteredSamples.length}</strong>
                  </div>
                  <div>
                    • Analyses :{' '}
                    <strong className="text-slate-900">{filteredAnalyses.length}</strong> (
                    {pendingValidationAnalyses} à valider)
                  </div>
                  <div>
                    • Taux clôture : <strong className="text-slate-900">{closureRate} %</strong>
                  </div>
                  <div>
                    • Alertes stock :{' '}
                    <strong className="text-red-600">{lowStockConsumables.length}</strong>
                  </div>
                  <div>
                    • Modèles actifs :{' '}
                    <strong className="text-slate-900">
                      {filteredMaterials.length + filteredAnalysisTemplates.length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Choix du format de génération */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  onClick={generateExcelDashboard}
                  className="flex items-start gap-3 p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-colors group"
                >
                  <div className="p-2.5 rounded-lg bg-emerald-600 text-white shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm group-hover:text-emerald-950">
                      Classeur Excel (.xlsx)
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Feuille Dashboard (KPI, Qualité, Stocks), 3 graphiques Excel natifs et 5 feuilles détaillées.
                    </p>
                  </div>
                </button>

                <button
                  onClick={generateBilanPDF}
                  className="flex items-start gap-3 p-4 rounded-xl border-2 border-blue-600 bg-blue-50/60 hover:bg-blue-100/70 text-left transition-colors group"
                >
                  <div className="p-2.5 rounded-lg bg-blue-600 text-white shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-950">
                      Rapport Bilan (.pdf)
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Document de synthèse formaté A4 prêt pour impression et revue de direction.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsBilanModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}