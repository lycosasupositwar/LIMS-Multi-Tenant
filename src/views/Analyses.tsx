/**
 * Vue Suivi des Analyses & Essais Métallurgiques (Analyses)
 */

import React, { useState, useEffect } from 'react';
import { useLims } from '../store';
import { Search, Microscope, Check, UploadCloud, Image as ImageIcon, Plus, X, Lock } from 'lucide-react';
import { AnalysisStatus, ExpectedResult } from '../types';

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
    if (filterMode === 'actives' && (a.status === 'valide' || a.status === 'termine' || a.status === 'rejete')) {
      return false;
    }
    if (filterMode === 'historique' && (a.status !== 'valide' && a.status !== 'termine' && a.status !== 'rejete')) {
      return false;
    }

    const sample = samples.find(s => s.id === a.sampleId);
    if (filterMode === 'actives' && sample && sample.requestId) {
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

  const handleMockImageUpload = (analysisId: string, resultId: string) => {
    const mockImages = [
      'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1614935151651-0bea6508abb0?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1582719202047-76d3332be339?auto=format&fit=crop&q=80&w=400',
    ];
    const randomImg = mockImages[Math.floor(Math.random() * mockImages.length)];
    updateAnalysisResult(analysisId, resultId, randomImg);
    addAnalysisImage(analysisId, randomImg);
  };

  const renderInputForResult = (analysisId: string, resultTemplate: ExpectedResult, currentValue: any, status: AnalysisStatus) => {
    const disabled = (!isManager && (status === 'a_valider' || status === 'valide' || status === 'termine')) || (isManager && status === 'termine');
    
    if (resultTemplate.type === 'image') {
      return (
        <div className="flex items-center gap-2 mt-2">
          {currentValue || (status === 'valide' && analyses.find(a => a.id === analysisId)?.images.length) ? (
            <div className="flex items-center text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
              <ImageIcon className="w-3 h-3 mr-1" />
              Image attachée
            </div>
          ) : (
            <button 
              onClick={() => handleMockImageUpload(analysisId, resultTemplate.id)} 
              disabled={disabled} 
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded flex items-center border border-slate-200 transition-colors disabled:opacity-50"
            >
              <UploadCloud className="w-3 h-3 mr-1.5" /> Charger une image
            </button>
          )}
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
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors disabled:opacity-50 ${
                  isSelected 
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
      const currentValues = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
      const numValues = currentValues.map(v => Number(v)).filter(v => !isNaN(v));
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
      
      const isAnalysisLocked = (!isManager && (analysis.status === 'a_valider' || analysis.status === 'valide' || analysis.status === 'termine')) || (isManager && analysis.status === 'termine');
      const isHighlighted = globalSearchQuery && analysis.id.toLowerCase() === globalSearchQuery.trim().toLowerCase();

      return (
        <li
          key={analysis.id}
          id={`analysis-card-${analysis.id}`}
          className={`p-4 sm:p-6 transition-colors ${
            isHighlighted ? 'bg-amber-50/40 ring-2 ring-inset ring-amber-300' : 'hover:bg-slate-50/30'
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
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 mb-3">
                  <span>Échantillon: <strong className="text-blue-600">{analysis.sampleId}</strong></span>
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-xs">
                    {template.standardRef || 'Méthode interne'}
                  </span>
                  <span>Tech: <strong className="text-slate-700">{analysis.technician}</strong></span>
                </div>
                <p className="text-xs text-slate-500">{template.description}</p>
              </div>
            </div>
            
            {/* Colonne de droite : Saisie des résultats et contrôle du workflow */}
            <div className="flex flex-col sm:flex-row gap-6 xl:justify-end xl:w-3/5">
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
                    <div key={expectedResult.id}>
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

              {/* Boutons d'avancement du cycle d'approbation */}
              <div className="flex flex-col items-end gap-2 sm:w-40 sm:border-l sm:border-slate-200 sm:pl-6 justify-center">
                {analysis.status === 'planifie' && (
                  <button 
                    onClick={() => updateAnalysisStatus(analysis.id, 'En Cours')}
                    className="w-full text-xs px-3 py-2 bg-blue-50 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition-colors text-center"
                  >
                    Démarrer l'essai
                  </button>
                )}
                {analysis.status === 'En Cours' && (
                  <button 
                    onClick={() => updateAnalysisStatus(analysis.id, 'a_valider')}
                    className="w-full text-xs px-3 py-2 bg-amber-50 text-amber-700 rounded-md font-medium hover:bg-amber-100 transition-colors text-center"
                  >
                    Soumettre résultats
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
                      onClick={() => updateAnalysisStatus(analysis.id, 'rejete')}
                      className="w-full text-xs px-3 py-2 bg-red-50 text-red-700 rounded-md font-medium hover:bg-red-100 transition-colors text-center mt-1"
                    >
                      Rejeter
                    </button>
                  </>
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