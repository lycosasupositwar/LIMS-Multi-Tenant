/**
 * Vue Suivi des Analyses & Essais Métallurgiques (Analyses)
 */

import React, { useState, useEffect } from 'react';
import { useLims } from '../store';
import { Search, Microscope, Check, UploadCloud, Image as ImageIcon, Plus, X, Lock, ClipboardPaste } from 'lucide-react';
import { AnalysisStatus, ExpectedResult } from '../types';

type MicrographyImage = { id: string; name: string; dataUrl: string; comment: string };
type VerticalRow = { element: string; value: string; unit: string };

const readMicrographyImage = (file: File): Promise<MicrographyImage> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) { reject(new Error('Le fichier sélectionné n’est pas une image.')); return; }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`Impossible de lire ${file.name}`));
  reader.onload = () => {
    const source = String(reader.result || '');
    const image = new Image();
    image.onload = () => {
      try {
        const maxSide = 1800;
        const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas indisponible');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const defaultName = file.name.replace(/\.[^/.]+$/, '');
        resolve({
          id: `micro_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: defaultName,
          dataUrl: canvas.toDataURL('image/jpeg', 0.84),
          comment: ''
        });
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error(`Format d’image non pris en charge : ${file.name}`));
    image.src = source;
  };
  reader.readAsDataURL(file);
});

/**
 * Analyse un texte issu d'un fichier CSV/TXT ou d'un copier-coller Excel
 * et fusionne les valeurs dans les lignes du tableau vertical.
 */
const parseAndMergeVerticalTableText = (
  rawText: string,
  currentRows: VerticalRow[],
  defaultUnit: string,
  startRowIndex = 0
): VerticalRow[] => {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return currentRows;

  const parseLineCells = (line: string): string[] => {
    if (line.includes('\t')) return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    if (line.includes(';')) return line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
    if (line.includes(',')) {
      const parts = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      // Si la première colonne ressemble à un nom d'élément (contient des lettres) et non à un décimal type "12,4"
      if (parts.length >= 2 && /[a-zA-Z]/.test(parts[0])) {
        return parts;
      }
    }
    return [line.replace(/^"|"$/g, '').trim()];
  };

  const parsedLines = lines.map(parseLineCells);

  // Ignore une éventuelle première ligne d'en-tête (ex: "Élément;Valeur;Unité")
  const firstLine = parsedLines[0];
  const isHeader =
    firstLine.length >= 2 &&
    /^(el[eé]ment|param[eè]tre|symbole|analyte|nom)$/i.test(firstLine[0]) &&
    /^(valeur|r[eé]sultat|concentration|mesure|teneur)$/i.test(firstLine[1]);

  const dataLines = isHeader ? parsedLines.slice(1) : parsedLines;
  if (dataLines.length === 0) return currentRows;

  // Cas 1 : Une seule colonne de valeurs copiée depuis Excel -> remplit les valeurs à partir de startRowIndex
  const isSingleValueColumn = dataLines.every(cells => cells.length === 1);
  if (isSingleValueColumn) {
    const nextRows = [...currentRows];
    dataLines.forEach((cells, offset) => {
      const targetIdx = startRowIndex + offset;
      if (targetIdx < nextRows.length) {
        nextRows[targetIdx] = { ...nextRows[targetIdx], value: cells[0] };
      } else {
        nextRows.push({ element: '', value: cells[0], unit: defaultUnit });
      }
    });
    return nextRows;
  }

  // Cas 2 : Plusieurs colonnes (Élément | Valeur | [Unité]) -> associe par nom d'élément ou ajoute à la fin
  const nextRows = currentRows.filter(
    r => String(r.element || '').trim() !== '' || String(r.value || '').trim() !== ''
  );

  dataLines.forEach(cells => {
    const elName = (cells[0] || '').trim();
    const valStr = (cells[1] ?? '').trim();
    const unitStr = (cells[2] ?? '').trim();
    if (!elName && !valStr) return;

    const existingIdx = nextRows.findIndex(
      r => String(r.element || '').trim().toLowerCase() === elName.toLowerCase()
    );

    if (existingIdx !== -1) {
      nextRows[existingIdx] = {
        ...nextRows[existingIdx],
        value: valStr,
        unit: unitStr || nextRows[existingIdx].unit || defaultUnit
      };
    } else {
      nextRows.push({
        element: elName,
        value: valStr,
        unit: unitStr || defaultUnit
      });
    }
  });

  return nextRows.length > 0 ? nextRows : [{ element: '', value: '', unit: defaultUnit }];
};

export function Analyses() {
  const {
    currentUser,
    analyses,
    analysisTemplates,
    updateAnalysisStatus,
    updateAnalysisResult,
    addAnalysisImage,
    samples,
    requests,
    globalSearchQuery,
    setGlobalSearchQuery
  } = useLims();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAuditFor, setShowAuditFor] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'request'>('none');
  const [filterMode, setFilterMode] = useState<'actives' | 'historique'>('actives');

  const isManager = (currentUser?.role === 'manager' || currentUser?.role === 'admin');

  /**
   * Synchronise automatiquement l'onglet ('actives' vs 'historique') et fait défiler jusqu'à l'analyse
   * lorsqu'un manager clique sur une notification ciblant un essai (ex: ESS-26-0612).
   */
  useEffect(() => {
    if (!globalSearchQuery) return;
    const q = globalSearchQuery.trim().toLowerCase();
    const targetAnalysis = analyses.find(
      a => a.id.toLowerCase() === q || (a.sampleId && a.sampleId.toLowerCase() === q)
    );
    if (targetAnalysis) {
      if (targetAnalysis.status === 'valide' || targetAnalysis.status === 'termine' || targetAnalysis.status === 'rejete') {
        setFilterMode('historique');
      } else {
        setFilterMode('actives');
      }
      setTimeout(() => {
        const el = document.getElementById(`analysis-card-${targetAnalysis.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [globalSearchQuery, analyses]);

  const filteredAnalyses = analyses.filter(a => {
    const sample = samples.find(s => s.id === a.sampleId);

    // Masquer l'analyse tant que l'échantillon n'est pas passé à l'étape "En essai" (ou "Terminé")
    if (!sample || (sample.status !== 'en_essai' && sample.status !== 'termine')) {
      return false;
    }

    // Une analyse rejetée ('rejete') reste dans 'actives' pour que l'analyste puisse la corriger et la resoumettre !
    if (filterMode === 'actives' && (a.status === 'valide' || a.status === 'termine')) {
      return false;
    }
    if (filterMode === 'historique' && (a.status !== 'valide' && a.status !== 'termine')) {
      return false;
    }

    if (filterMode === 'actives' && sample.requestId) {
      const request = requests.find(r => r.id === sample.requestId);
      // Si l'utilisateur recherche spécifiquement cette analyse via notification, on ne la masque pas
      const isDirectlyTargeted = globalSearchQuery && a.id.toLowerCase() === globalSearchQuery.trim().toLowerCase();
      if (!isDirectlyTargeted && request && (request.status === 'terminee' || request.status === 'rejetee')) {
        return false;
      }
    }

    const matchesSearch = a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.sampleId && a.sampleId.toLowerCase().includes(searchTerm.toLowerCase()));

    if (globalSearchQuery) {
      const template = analysisTemplates.find(t => t.id === a.templateId);
      const q = globalSearchQuery.toLowerCase();
      if (!a.id.toLowerCase().includes(q) &&
        !a.sampleId?.toLowerCase().includes(q) &&
        !template?.name.toLowerCase().includes(q)) {
        return false;
      }
    }

    return matchesSearch;
  }).sort((a, b) => {
    const priorityWeight: Record<string, number> = { haute: 3, normale: 2, basse: 1 };
    const sampleA = samples.find(s => s.id === a.sampleId);
    const sampleB = samples.find(s => s.id === b.sampleId);
    const prioA = priorityWeight[sampleA?.priority || 'normale'] || 2;
    const prioB = priorityWeight[sampleB?.priority || 'normale'] || 2;
    return prioB - prioA;
  });

  const getStatusBadge = (status: AnalysisStatus) => {
    switch (status) {
      case 'planifie':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Planifié</span>;
      case 'En Cours':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">En cours</span>;
      case 'a_valider':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">À valider</span>;
      case 'valide':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Validé</span>;
      case 'termine':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Terminé</span>;
      case 'rejete':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejeté</span>;
    }
  };
  const getPriorityBadge = (priority?: string) => {
    if (priority === 'haute') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
          Urgent
        </span>
      );
    }
    if (priority === 'basse') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          Priorité basse
        </span>
      );
    }
    return null; // On n'affiche rien (ou un badge discret) si la priorité est normale
  };

  const handleMicrographyUpload = async (analysisId: string, resultId: string, files: FileList | null, currentValue: any) => {
    if (!files?.length) return;
    const existing: MicrographyImage[] = currentValue && Array.isArray(currentValue.images) ? currentValue.images : [];
    try {
      const additions = await Promise.all(Array.from(files).map(readMicrographyImage));
      updateAnalysisResult(analysisId, resultId, { images: [...existing, ...additions] });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur pendant le chargement des images.');
    }
  };

  const updateMicrographyImage = (analysisId: string, resultId: string, currentValue: any, imageId: string, updates: Partial<MicrographyImage>) => {
    const images: MicrographyImage[] = Array.isArray(currentValue?.images) ? currentValue.images : [];
    updateAnalysisResult(analysisId, resultId, { images: images.map(img => img.id === imageId ? { ...img, ...updates } : img) });
  };

  const renderMicrographyInput = (analysisId: string, resultId: string, currentValue: any, disabled: boolean) => {
    const images: MicrographyImage[] = Array.isArray(currentValue?.images) ? currentValue.images : [];
    return (
      <div className="mt-2 space-y-3 sm:col-span-2">
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm font-medium transition-colors ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
          <UploadCloud className="h-4 w-4" /> Ajouter une ou plusieurs images
          <input type="file" accept="image/*" multiple disabled={disabled} className="hidden" onChange={e => { void handleMicrographyUpload(analysisId, resultId, e.target.files, currentValue); e.currentTarget.value = ''; }} />
        </label>
        <p className="text-xs text-slate-500">Images redimensionnées automatiquement pour limiter la taille des données. Le nom et le commentaire de chaque image sont modifiables.</p>
        {images.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {images.map((img, index) => (
              <div key={img.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      Image {index + 1} ·
                    </span>
                    <input
                      type="text"
                      value={img.name || ''}
                      disabled={disabled}
                      onChange={e => updateMicrographyImage(analysisId, resultId, currentValue, img.id, { name: e.target.value })}
                      placeholder="Nom de l'image..."
                      title="Modifier le nom de l'image"
                      className="w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-white focus:border-indigo-400 focus:bg-white focus:outline-none disabled:hover:border-transparent disabled:hover:bg-transparent"
                    />
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      title="Supprimer l’image"
                      onClick={() => updateAnalysisResult(analysisId, resultId, { images: images.filter(item => item.id !== img.id) })}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <img src={img.dataUrl} alt={img.name || `Micrographie ${index + 1}`} className="max-h-64 w-full bg-slate-50 object-contain" />
                <div className="p-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Commentaire (facultatif)</label>
                  <textarea
                    value={img.comment || ''}
                    disabled={disabled}
                    onChange={e => updateMicrographyImage(analysisId, resultId, currentValue, img.id, { comment: e.target.value })}
                    rows={2}
                    placeholder="Observation liée à cette image…"
                    className="w-full resize-y rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderInputForResult = (analysisId: string, resultTemplate: ExpectedResult, currentValue: any, status: AnalysisStatus) => {
    const disabled = (!isManager && (status === 'a_valider' || status === 'valide' || status === 'termine')) || (isManager && status === 'termine');

    if (resultTemplate.type === 'micrography') {
      return renderMicrographyInput(analysisId, resultTemplate.id, currentValue, disabled);
    }

    if (resultTemplate.type === 'image') {
      return (
        <div className="mt-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-indigo-700">
            <UploadCloud className="h-4 w-4" /> {currentValue ? 'Remplacer l’image' : 'Charger une image'}
            <input type="file" accept="image/*" disabled={disabled} className="hidden" onChange={async e => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              try { const image = await readMicrographyImage(file); updateAnalysisResult(analysisId, resultTemplate.id, image.dataUrl); addAnalysisImage(analysisId, image.dataUrl); }
              catch (error) { alert(error instanceof Error ? error.message : 'Erreur pendant le chargement.'); }
              input.value = '';
            }} />
          </label>
          {typeof currentValue === 'string' && currentValue && <img src={currentValue} alt={resultTemplate.name} className="mt-2 max-h-40 rounded border border-slate-200 object-contain" />}
        </div>
      );
    }

    if (resultTemplate.type === 'select') {
      return (
        <div className="flex items-center gap-2 mt-1">
          <select
            value={currentValue || ''}
            onChange={(e) => updateAnalysisResult(analysisId, resultTemplate.id, e.target.value)}
            className="w-full max-w-[200px] px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            disabled={disabled}
          >
            <option value="">Sélectionner...</option>
            {resultTemplate.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {resultTemplate.unit && <span className="text-xs font-medium text-slate-500">{resultTemplate.unit}</span>}
        </div>
      );
    }

    if (resultTemplate.type === 'multiselect') {
      const currentValues = Array.isArray(currentValue) ? currentValue : [];
      return (
        <div className="flex flex-wrap gap-2 mt-2">
          {resultTemplate.options?.map(opt => {
            const isSelected = currentValues.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const newValues = isSelected
                    ? currentValues.filter((v: string) => v !== opt)
                    : [...currentValues, opt];
                  updateAnalysisResult(analysisId, resultTemplate.id, newValues);
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors disabled:opacity-50 ${isSelected
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    if (resultTemplate.type === 'number_series') {
      const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue !== undefined && currentValue !== '' ? [currentValue] : []);
      const numValues = currentValues
        .filter(v => v !== '' && v !== null && v !== undefined && String(v).trim() !== '')
        .map(v => Number(v))
        .filter(v => !isNaN(v));
      const mean = numValues.length > 0 ? numValues.reduce((a, b) => a + b, 0) / numValues.length : null;
      const variance = numValues.length > 1
        ? numValues.reduce((a, b) => a + Math.pow(b - mean!, 2), 0) / (numValues.length - 1)
        : null;
      const stdDev = variance !== null ? Math.sqrt(variance) : null;

      return (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex flex-wrap gap-2 items-center">
            {currentValues.map((val, idx) => (
              <div key={idx} className="flex items-center bg-blue-50 border border-blue-200 rounded px-2 py-1 gap-2">
                <input
                  type="number"
                  value={val}
                  onChange={(e) => {
                    const newValues = [...currentValues];
                    newValues[idx] = e.target.value;
                    updateAnalysisResult(analysisId, resultTemplate.id, newValues);
                  }}
                  className="w-16 text-sm bg-transparent border-b border-blue-300 focus:border-blue-500 focus:outline-none px-1"
                  disabled={disabled}
                />
                {!disabled && (
                  <button
                    onClick={() => {
                      const newValues = [...currentValues];
                      newValues.splice(idx, 1);
                      updateAnalysisResult(analysisId, resultTemplate.id, newValues);
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {!disabled && (
              <button
                type="button"
                onClick={() => {
                  updateAnalysisResult(analysisId, resultTemplate.id, [...currentValues, '']);
                }}
                className="text-xs flex items-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded"
              >
                <Plus className="w-3 h-3 mr-1" /> Ajouter valeur
              </button>
            )}
          </div>
          {numValues.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-1">
              <div>Moyenne: <span className="text-slate-800 font-bold">{mean?.toFixed(2)}</span> {resultTemplate.unit}</div>
              {numValues.length > 1 && (
                <div>Écart-type: <span className="text-slate-800 font-bold">{stdDev?.toFixed(2)}</span> {resultTemplate.unit}</div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (resultTemplate.type === 'vertical_table') {
      const defaultUnit = resultTemplate.unit || '';
      const templateElements = Array.isArray(resultTemplate.options)
        ? resultTemplate.options.flatMap(opt => String(opt).split(/[,;\n]+/)).map(s => s.trim()).filter(Boolean)
        : [];

      // Vérifie si currentValue contient réellement des lignes non vides
      const savedRows: VerticalRow[] = Array.isArray(currentValue)
        ? currentValue.filter(r => r && typeof r === 'object')
        : [];

      const isOnlyEmptyPlaceholder =
        savedRows.length === 1 &&
        !String(savedRows[0].element || '').trim() &&
        !String(savedRows[0].value || '').trim();

      let rows: VerticalRow[];

      if (savedRows.length > 0 && !isOnlyEmptyPlaceholder) {
        // S'il y a des éléments dans le modèle qui ne sont pas encore dans les lignes sauvegardées, on les ajoute à la suite
        const existingElements = new Set(savedRows.map(r => String(r.element || '').trim().toLowerCase()));
        const missingFromTemplate = templateElements
          .filter(el => !existingElements.has(el.toLowerCase()))
          .map(el => ({ element: el, value: '', unit: defaultUnit }));
        rows = [...savedRows, ...missingFromTemplate];
      } else if (templateElements.length > 0) {
        rows = templateElements.map(opt => ({ element: opt, value: '', unit: defaultUnit }));
      } else {
        rows = [{ element: '', value: '', unit: defaultUnit }];
      }

      const updateRows = (nextRows: VerticalRow[]) => {
        updateAnalysisResult(analysisId, resultTemplate.id, nextRows);
      };

      const handleFileImport = (file: File | undefined) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = String(ev.target?.result || '');
          const merged = parseAndMergeVerticalTableText(content, rows, defaultUnit, 0);
          updateRows(merged);
        };
        reader.readAsText(file);
      };

      const handleClipboardPasteButton = async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            const merged = parseAndMergeVerticalTableText(text, rows, defaultUnit, 0);
            updateRows(merged);
            return;
          }
        } catch {
          // Si le navigateur bloque navigator.clipboard, on ouvre une boîte de saisie rapide
        }
        const manualText = window.prompt(
          'Collez ici vos lignes copiées depuis Excel ou CSV (Format : Élément [Tab/;] Valeur [Tab/;] Unité, ou une colonne de valeurs) :'
        );
        if (manualText && manualText.trim()) {
          const merged = parseAndMergeVerticalTableText(manualText, rows, defaultUnit, 0);
          updateRows(merged);
        }
      };

      return (
        <div className="mt-2 sm:col-span-2">
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-semibold w-2/5">Élément / Paramètre</th>
                  <th className="py-2 px-3 font-semibold w-2/5">Résultat / Valeur</th>
                  <th className="py-2 px-3 font-semibold w-1/5">Unité</th>
                  {!disabled && <th className="py-2 px-2 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="p-1.5 px-2">
                      <input
                        type="text"
                        value={row.element}
                        disabled={disabled}
                        onPaste={(e) => {
                          const text = e.clipboardData.getData('text/plain');
                          if (text && (text.includes('\n') || text.includes('\t'))) {
                            e.preventDefault();
                            updateRows(parseAndMergeVerticalTableText(text, rows, defaultUnit, idx));
                          }
                        }}
                        onChange={(e) => {
                          const next = rows.map((r, i) => i === idx ? { ...r, element: e.target.value } : r);
                          updateRows(next);
                        }}
                        placeholder="Ex: Fe, Cr, Ni..."
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                      />
                    </td>
                    <td className="p-1.5 px-2">
                      <input
                        type="text"
                        value={row.value}
                        disabled={disabled}
                        onPaste={(e) => {
                          const text = e.clipboardData.getData('text/plain');
                          if (text && (text.includes('\n') || text.includes('\t'))) {
                            e.preventDefault();
                            updateRows(parseAndMergeVerticalTableText(text, rows, defaultUnit, idx));
                          }
                        }}
                        onChange={(e) => {
                          const next = rows.map((r, i) => i === idx ? { ...r, value: e.target.value } : r);
                          updateRows(next);
                        }}
                        placeholder="Ex: 12.4 ou < 0.01"
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                      />
                    </td>
                    <td className="p-1.5 px-2">
                      <input
                        type="text"
                        value={row.unit ?? defaultUnit}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = rows.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r);
                          updateRows(next);
                        }}
                        placeholder={defaultUnit || 'ppm, %'}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                      />
                    </td>
                    {!disabled && (
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const next = rows.filter((_, i) => i !== idx);
                            updateRows(next);
                          }}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Supprimer la ligne"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!disabled && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateRows([...rows, { element: '', value: '', unit: defaultUnit }])}
                  className="text-xs flex items-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded font-medium"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un élément
                </button>

                <label
                  className="text-xs flex items-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded font-medium cursor-pointer"
                  title="Importer un fichier CSV ou TXT (colonnes : Élément ; Valeur ; Unité)"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1" /> Importer CSV / TXT
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv"
                    className="hidden"
                    onChange={(e) => {
                      handleFileImport(e.target.files?.[0]);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleClipboardPasteButton}
                  className="text-xs flex items-center text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded font-medium"
                  title="Coller directement des colonnes copiées depuis Excel"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 mr-1" /> Coller depuis Excel
                </button>

                {templateElements.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const existingMap = new Map<string, VerticalRow>(
                        rows.map(r => [String(r.element || '').trim().toLowerCase(), r] as [string, VerticalRow])
                      );
                      const resetRows = templateElements.map(el => {
                        const prev = existingMap.get(el.toLowerCase());
                        return {
                          element: el,
                          value: prev?.value || '',
                          unit: prev?.unit || defaultUnit
                        };
                      });
                      updateRows(resetRows);
                    }}
                    className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1.5 rounded font-medium"
                    title="Recharger les éléments définis dans le modèle d'analyse"
                  >
                    Charger la liste du modèle ({templateElements.length})
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {rows.filter(r => String(r.value).trim() !== '').length} / {rows.length} élément(s) renseigné(s)
              </span>
            </div>
          )}
        </div>
      );
    }

    if (resultTemplate.type === 'boolean') {
      return (
        <div className="flex items-center gap-2 mt-2">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentValue === true || currentValue === 'true'}
              onChange={(e) => updateAnalysisResult(analysisId, resultTemplate.id, e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              disabled={disabled}
            />
            <span className="ml-2 text-sm text-slate-700">Oui / Conforme</span>
          </label>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          type={resultTemplate.type === 'number' ? 'number' : 'text'}
          value={currentValue !== undefined ? currentValue : ''}
          onChange={(e) => updateAnalysisResult(analysisId, resultTemplate.id, e.target.value)}
          placeholder={`Saisir ${resultTemplate.name}...`}
          className="w-full max-w-[200px] px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          disabled={disabled}
        />
        {resultTemplate.unit && <span className="text-xs font-medium text-slate-500">{resultTemplate.unit}</span>}
      </div>
    );
  };

  const renderAnalysesList = (analysesList: typeof analyses) => {
    return analysesList.map((analysis) => {
      const template = analysisTemplates.find(t => t.id === analysis.templateId);
      if (!template) return null;

      const sample = samples.find(s => s.id === analysis.sampleId);
      const request = sample?.requestId ? requests.find(r => r.id === sample.requestId) : undefined;
      const effectivePriority = sample?.priority || request?.priority || 'normale';

      const isAnalysisLocked = (!isManager && (analysis.status === 'a_valider' || analysis.status === 'valide' || analysis.status === 'termine')) || (isManager && analysis.status === 'termine');
      const isHighlighted = globalSearchQuery && analysis.id.toLowerCase() === globalSearchQuery.trim().toLowerCase();

      return (
        <li
          key={analysis.id}
          id={`analysis-card-${analysis.id}`}
          className={`p-4 sm:p-6 transition-colors ${isHighlighted
            ? 'bg-amber-50/40 ring-2 ring-inset ring-amber-300'
            : effectivePriority === 'haute'
              ? 'bg-red-50/20 hover:bg-red-50/40 border-l-4 border-l-red-500'
              : 'hover:bg-slate-50/30'
            }`}
        >
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
            {/* Colonne de gauche : Métadonnées de l'essai */}
            <div className="flex items-start flex-1">
              <div className="flex-shrink-0 h-10 w-10 mt-1 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <Microscope className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="ml-4">
                <div className="flex flex-wrap items-center gap-2.5 mb-1">
                  <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                    {analysis.id}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{template.name}</h3>
                  {getStatusBadge(analysis.status)}
                  {getPriorityBadge(effectivePriority)}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 mb-3">
                  <span>Échantillon: <strong className="text-blue-600">{analysis.sampleId}</strong></span>
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-xs">
                    {template.standardRef || 'Méthode interne'}
                  </span>
                  <span>Tech: <strong className="text-slate-700">{analysis.technician}</strong></span>
                </div>
                <p className="text-xs text-slate-500">{template.description}</p>
                {analysis.status === 'rejete' && (
                  <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                    <strong>Essai refusé par le manager :</strong> {analysis.rejectionReason || 'Veuillez vérifier et corriger les résultats saisis.'}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne de droite : Saisie des résultats et contrôle du workflow */}
            <div className="flex flex-col sm:flex-row gap-6 xl:justify-end xl:w-3/5">

              {/* Affiché uniquement si l'essai est démarré (statut différent de 'planifie') */}
              {analysis.status !== 'planifie' ? (
                <div className="flex-1 bg-slate-50 rounded-lg border border-slate-200 p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saisie des résultats</h4>
                    {isAnalysisLocked && (
                      <div className="flex items-center text-[10px] font-bold uppercase text-slate-500 bg-slate-200 px-2 py-1 rounded">
                        <Lock className="w-3 h-3 mr-1" />
                        Verrouillé
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {template.expectedResults.map(expectedResult => (
                      <div key={expectedResult.id} className={(expectedResult.type === 'micrography' || expectedResult.type === 'vertical_table') ? 'sm:col-span-2' : ''}>
                        <label className="text-xs font-semibold text-slate-700">
                          {expectedResult.name} {expectedResult.required && <span className="text-red-500">*</span>}
                        </label>
                        {renderInputForResult(analysis.id, expectedResult, analysis.results[expectedResult.id], analysis.status)}
                      </div>
                    ))}
                  </div>

                  {analysis.images.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <h4 className="text-xs font-semibold text-slate-500 mb-2">Micrographies jointes :</h4>
                      <div className="flex gap-2 overflow-x-auto">
                        {analysis.images.map((img, i) => (
                          <img key={i} src={img} alt="micrographie" className="h-16 w-16 object-cover rounded border border-slate-300" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                  <p className="text-xs text-slate-400 italic">
                    La saisie des résultats sera disponible une fois que l'essai aura été démarré.
                  </p>
                </div>
              )}

              {/* Boutons d'avancement du cycle d'approbation */}
              <div className="flex flex-col items-end gap-2 sm:w-44 sm:border-l sm:border-slate-200 sm:pl-6 justify-center">
                {analysis.status === 'planifie' && (
                  <button
                    onClick={() => updateAnalysisStatus(analysis.id, 'En Cours')}
                    className="w-full text-xs px-3 py-2 bg-blue-50 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition-colors text-center"
                  >
                    Démarrer l'essai
                  </button>
                )}

                {/* L'analyste peut soumettre ou resoumettre si l'essai est 'En Cours' OU 'rejete' */}
                {(analysis.status === 'En Cours' || analysis.status === 'rejete') && (
                  <button
                    onClick={() => updateAnalysisStatus(analysis.id, 'a_valider')}
                    className="w-full text-xs px-3 py-2 bg-amber-500 text-white rounded-md font-medium hover:bg-amber-600 transition-colors text-center shadow-xs"
                  >
                    {analysis.status === 'rejete' ? 'Corriger & Resoumettre' : 'Soumettre résultats'}
                  </button>
                )}

                {analysis.status === 'a_valider' && isManager && (
                  <>
                    <button
                      onClick={() => updateAnalysisStatus(analysis.id, 'valide')}
                      className="w-full text-xs px-3 py-2 bg-emerald-500 text-white rounded-md font-medium hover:bg-emerald-600 transition-colors flex justify-center items-center"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Valider
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Motif du rejet de cet essai (sera visible par l’analyste) :', 'Valeurs aberrantes / Essai à reprendre');
                        if (reason !== null) {
                          updateAnalysisStatus(analysis.id, 'rejete', reason.trim() || 'Essai à reprendre');
                        }
                      }}
                      className="w-full text-xs px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium hover:bg-red-100 transition-colors text-center mt-1"
                    >
                      Rejeter à l'analyste
                    </button>
                  </>
                )}

                {/* Permet au manager de déverrouiller un essai déjà validé si besoin */}
                {(analysis.status === 'valide' || analysis.status === 'termine') && isManager && (
                  <button
                    onClick={() => updateAnalysisStatus(analysis.id, 'En Cours', 'Réouverture de l’essai par le manager')}
                    className="w-full text-xs px-3 py-2 bg-slate-100 text-slate-700 rounded-md font-medium hover:bg-slate-200 transition-colors text-center"
                  >
                    Réouvrir l'essai
                  </button>
                )}
                {analysis.auditTrail && analysis.auditTrail.length > 0 && (
                  <button
                    onClick={() => setShowAuditFor(showAuditFor === analysis.id ? null : analysis.id)}
                    className="text-xs text-slate-500 underline hover:text-slate-800 mt-2"
                  >
                    {showAuditFor === analysis.id ? 'Masquer l\'historique' : 'Voir l\'historique'}
                  </button>
                )}
              </div>
            </div>

            {showAuditFor === analysis.id && analysis.auditTrail && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 w-full xl:w-3/5 xl:ml-auto">
                <h5 className="font-bold mb-2">Historique des modifications</h5>
                <ul className="space-y-2">
                  {analysis.auditTrail.map(log => (
                    <li key={log.id} className="flex flex-col border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <span className="font-medium">{log.action}</span>
                      <span>{log.details}</span>
                      <span className="text-slate-400 mt-1">{new Date(log.timestamp).toLocaleString('fr-FR')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </li>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-display font-bold text-slate-900">Suivi des Analyses & Essais</h2>

        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shrink-0">
          <button
            onClick={() => setFilterMode('actives')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filterMode === 'actives' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            En cours
          </button>
          <button
            onClick={() => setFilterMode('historique')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filterMode === 'historique' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Historique
          </button>
        </div>
      </div>

      {globalSearchQuery && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-blue-800">
          <span>
            Filtre actif sur : <strong className="font-mono">{globalSearchQuery}</strong>
          </span>
          <button
            onClick={() => setGlobalSearchQuery('')}
            className="font-semibold text-blue-700 hover:underline"
          >
            Afficher toutes les analyses
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher essai, ID échantillon..."
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 font-medium">Classer par :</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'none' | 'request')}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="none">Analyse individuelle</option>
              <option value="request">Demande</option>
            </select>
          </div>
        </div>

        {groupBy === 'none' ? (
          <ul className="divide-y divide-slate-200">
            {filteredAnalyses.length === 0 ? (
              <li className="px-6 py-10 text-center text-sm text-slate-500">Aucun essai trouvé.</li>
            ) : (
              renderAnalysesList(filteredAnalyses)
            )}
          </ul>
        ) : (
          <div className="space-y-6 p-4 bg-slate-50/50">
            {(() => {
              const grouped = filteredAnalyses.reduce((acc, analysis) => {
                const sample = samples.find(s => s.id === analysis.sampleId);
                const reqId = sample?.requestId || 'unknown';
                if (!acc[reqId]) acc[reqId] = [];
                acc[reqId].push(analysis);
                return acc;
              }, {} as Record<string, typeof analyses>);

              if (Object.keys(grouped).length === 0) {
                return <div className="text-center py-10 text-sm text-slate-500">Aucun essai trouvé.</div>;
              }

              return (Object.entries(grouped) as [string, typeof analyses][]).map(([reqId, reqAnalyses]) => {
                const req = requests.find(r => r.id === reqId);
                return (
                  <div key={reqId} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-white border-b border-slate-200 px-5 py-3 font-semibold text-slate-800 flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded text-xs tracking-wider uppercase font-bold mr-3">
                          {reqId === 'unknown' ? 'SANS DEMANDE' : reqId}
                        </span>
                        <span>{req ? req.title : 'Demande inconnue / Création manuelle'}</span>
                        {getPriorityBadge(req?.priority || samples.find(s => s.requestId === reqId)?.priority)}
                      </div>
                      <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
                        {reqAnalyses.length} essai(s)
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-200 bg-white">
                      {renderAnalysesList(reqAnalyses)}
                    </ul>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}