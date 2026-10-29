/**
 * Vue Gestion Interne des Demandes & Revue de Contrat (RequestsInternal)
 * 
 * Ce composant constitue le centre opérationnel du laboratoire pour le traitement des commandes :
 * 1. Liste et filtrage des demandes d'analyses (En cours / À traiter vs Historique archivé)
 * 2. Affectation / Assignation nominative des dossiers aux analystes et techniciens
 * 3. Gestion du cycle de vie normé (Soumise -> En revue -> Validée -> Assignée -> En cours -> En validation -> Terminée / Rejetée)
 * 4. Génération automatique des échantillons LIMS physiques et des analyses associées
 * 5. Piste d'audit inviolable (Audit Trail conforme 21 CFR Part 11 / ISO 17025)
 * 6. Visualisation et édition des données personnalisées issues des formulaires CMS
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { FileText, Clock, User, CheckCircle, Shield, AlertCircle, PlayCircle, History, Mail, XCircle, Plus, Box, Edit2, Save, Database, Layers, TestTube2, Trash2, Printer, QrCode } from 'lucide-react';
import { RequestStatus, AnalysisRequest, MaterialState, Sample } from '../types';
import { generateUniqueLimsId, generateUniqueBarcode } from '../utils/idGenerator';
import { printZebraLabelsWindow, generateZplForSamples } from '../utils/zebraLabelPrinter';

export function RequestsInternal() {
  const {
    currentUser,
    requests,
    users,
    requestTemplates,
    materialTemplates,
    analysisTemplates,
    assignRequest,
    updateRequestStatus,
    rejectRequest,
    addSample,
    deleteSample,
    addAnalysis,
    deleteAnalysis,
    updateRequestData,
    samples,
    analyses,
    allSamples,
    allAnalyses,
    labSettings,
    globalSearchQuery,
    activeLabId
  } = useLims();

  // États locaux de sélection et d'édition
  const [selectedRequest, setSelectedRequest] = useState<AnalysisRequest | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [filterMode, setFilterMode] = useState<'actives' | 'terminees'>('actives');

  // Paramètres de génération d'échantillons en masse
  const [sampleQuantity, setSampleQuantity] = useState(1);
  const activeMaterialTemplates = materialTemplates.filter(t => t.isActive !== false);
  const [sampleMaterialTemplateId, setSampleMaterialTemplateId] = useState(activeMaterialTemplates[0]?.id || '');
  const [sampleMaterialState, setSampleMaterialState] = useState<MaterialState>('Massif');
  const [samplePriority, setSamplePriority] = useState<'basse' | 'normale' | 'haute'>('normale');
  const [sampleCustomData, setSampleCustomData] = useState<Record<string, any>>({});
  const [conclusionText, setConclusionText] = useState('');
  const [addingAnalysisForSample, setAddingAnalysisForSample] = useState<string | null>(null);
  const [selectedNewAnalysisTplId, setSelectedNewAnalysisTplId] = useState<string>('');
  const [showAudit, setShowAudit] = useState(false);

  // Liste des utilisateurs ayant le rôle analyste pour l'assignation
  const analysts = users.filter(u =>
    (u.role === 'analyste' || u.role === 'manager') &&
    (!u.labId || u.labId === 'all' || u.labId === (selectedRequest?.labId || activeLabId))
  );

  /**
   * Extrait la valeur d'une propriété de matériau depuis le customData d'une demande
   * (compatible avec la structure `${field.id}__material_properties` de NewRequestModal / EditRequestModal)
   */
  const getMaterialPropFromRequest = (
    req: AnalysisRequest | null,
    matTplId: string,
    propFieldId: string,
    propFieldName: string
  ) => {
    if (!req || !req.customData) return undefined;
    const reqTpl = requestTemplates.find(t => t.id === req.templateId);
    const matFields = reqTpl?.fields.filter(f => f.type === 'materials') || [];

    for (const mf of matFields) {
      const propsContainer = req.customData[`${mf.id}__material_properties`];
      if (propsContainer && propsContainer[matTplId]) {
        const val = propsContainer[matTplId][propFieldId] ?? propsContainer[matTplId][propFieldName];
        if (val !== undefined) return val;
      }
    }

    // Fallbacks si stocké à plat
    return (
      req.customData[`matprop_${matTplId}_${propFieldId}`] ??
      req.customData[propFieldId] ??
      req.customData[propFieldName]
    );
  };

  /**
   * Filtrage des demandes visibles selon l'onglet (actives/terminées), la recherche et le rôle
   */
  const visibleRequests = requests.filter(r => {
    if (filterMode === 'actives' && (r.status === 'terminee' || r.status === 'rejetee')) return false;
    if (filterMode === 'terminees' && (r.status !== 'terminee' && r.status !== 'rejetee')) return false;

    if (globalSearchQuery) {
      const q = globalSearchQuery.toLowerCase();
      const template = requestTemplates.find(t => t.id === r.templateId);
      const requester = users.find(u => u.id === r.requesterId);
      const matchesSearch = r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (template && template.name.toLowerCase().includes(q)) ||
        (requester && requester.name.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    if ((currentUser?.role === 'manager' || currentUser?.role === 'admin')) return true;
    if (currentUser?.role === 'analyste') return r.assignedTo === currentUser.id;
    return false;
  });

  // Synchronise automatiquement les champs du Modèle Matériau sélectionné avec les valeurs saisies par le client
  React.useEffect(() => {
    const matTpl = materialTemplates.find(t => t.id === sampleMaterialTemplateId);
    if (!matTpl) {
      setSampleCustomData({});
      return;
    }
    const initialProps: Record<string, any> = {};
    matTpl.fields.forEach(field => {
      const fromReq = getMaterialPropFromRequest(selectedRequest, matTpl.id, field.id, field.name);
      initialProps[field.name] = fromReq !== undefined
        ? fromReq
        : (field.type === 'boolean' ? false : field.type === 'multiselect' ? [] : '');
    });
    setSampleCustomData(initialProps);
  }, [sampleMaterialTemplateId, selectedRequest, materialTemplates, requestTemplates]);

  /**
   * Rendu graphique du badge de statut
   */
  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'brouillon':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Brouillon</span>;
      case 'soumise':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Nouvelle Soumission</span>;
      case 'En Revue':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">En Revue</span>;
      case 'validee':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Validée</span>;
      case 'assignee':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">Assignée</span>;
      case 'En Cours':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">En Cours</span>;
      case 'En Validation':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">En Validation finale</span>;
      case 'terminee':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Terminée</span>;
      case 'rejetee':
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">Rejetée</span>;
    }
  };

  /**
   * Formatage des dates pour l'affichage de l'audit trail et des en-têtes
   */
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  /**
   * Évolution du statut avec consignation dans l'audit trail
   */
  const handleStatusChange = (newStatus: RequestStatus) => {
    if (selectedRequest) {
      updateRequestStatus(selectedRequest.id, newStatus, statusComment);
      setStatusComment('');
      setSelectedRequest(prev => prev ? {
        ...prev,
        status: newStatus,
        auditTrail: [
          {
            id: `temp-${Date.now()}`,
            timestamp: new Date().toISOString(),
            userId: currentUser!.id,
            action: 'Changement',
            details: `Statut: ${newStatus}`
          },
          ...(prev.auditTrail || [])
        ]
      } : null);
    }
  };

  /**
   * Refus technique d'une demande avec justification obligatoire
   */
  const handleReject = () => {
    if (selectedRequest && statusComment) {
      rejectRequest(selectedRequest.id, statusComment);
      setStatusComment('');
      setSelectedRequest(prev => prev ? {
        ...prev,
        status: 'rejetee',
        rejectionReason: statusComment,
        auditTrail: [
          {
            id: `temp-${Date.now()}`,
            timestamp: new Date().toISOString(),
            userId: currentUser!.id,
            action: 'Rejetée',
            details: `Refus: ${statusComment}`
          },
          ...(prev.auditTrail || [])
        ]
      } : null);
    }
  };

  /**
   * Génère les échantillons LIMS réels et associe automatiquement les analyses demandées
   */
  const handleGenerateSamples = () => {
    if (!selectedRequest) return;
    const requester = users.find(u => u.id === selectedRequest.requesterId);

    // Extraction des analyses spécifiées dans le formulaire dynamique
    const template = requestTemplates.find(t => t.id === selectedRequest.templateId);
    let requestedAnalyses: string[] = [];
    if (template) {
      const analysesFields = template.fields.filter(f => f.type === 'analyses');
      analysesFields.forEach(f => {
        if (selectedRequest.customData[f.id] && Array.isArray(selectedRequest.customData[f.id])) {
          requestedAnalyses.push(...selectedRequest.customData[f.id]);
        }
      });
    }

    // Solutions de secours si le modèle est ancien ou non typé
    if (requestedAnalyses.length === 0) {
      requestedAnalyses = selectedRequest.customData['analyses_demandees'] || [];
    }
    if (requestedAnalyses.length === 0) {
      Object.values(selectedRequest.customData).forEach(value => {
        if (Array.isArray(value)) {
          const hasMatch = value.some(v => analysisTemplates.some(t => t.id === String(v) || t.name === String(v)));
          if (hasMatch) {
            requestedAnalyses.push(...value.map(String));
          }
        } else if (typeof value === 'string') {
          if (analysisTemplates.some(t => t.id === value || t.name === value)) {
            requestedAnalyses.push(value);
          }
        }
      });
    }

    // Ensembles locaux pour suivre les IDs déjà existants + ceux créés dans la boucle en cours
    const usedSampleIds = new Set(allSamples.map(s => s.id));
    const usedBarcodes = new Set(allSamples.map(s => s.barcode));
    const usedAnalysisIds = new Set(allAnalyses.map(a => a.id));

    const samplePrefix = labSettings?.idPrefixes?.sample || 'ECH';

    // Création de N échantillons avec leurs essais associés
    for (let i = 0; i < sampleQuantity; i++) {
      const sampleId = generateUniqueLimsId(samplePrefix, usedSampleIds);
      usedSampleIds.add(sampleId);

      const barcode = generateUniqueBarcode(usedBarcodes, 'BC');
      usedBarcodes.add(barcode);

      const newSample: Sample = {
        id: sampleId,
        labId: selectedRequest.labId || activeLabId,
        barcode: barcode,
        templateId: sampleMaterialTemplateId,
        requestId: selectedRequest.id,
        materialState: sampleMaterialState,
        status: 'receptionne',
        receivedAt: new Date().toISOString(),
        client: requester?.company || requester?.name || 'Inconnu',
        project: selectedRequest.title,
        priority: samplePriority,
        // Utilise directement les valeurs pré-remplies et éventuellement ajustées par l'opérateur dans sampleCustomData
        customData: { ...sampleCustomData },
        images: [],
        notes: `Échantillon généré depuis la demande ${selectedRequest.id}`
      };
      addSample(newSample);

      // Instanciation des essais correspondants
      requestedAnalyses.forEach((analysisIdentifier: string) => {
        const matchedTemplate = analysisTemplates.find(t => t.id === analysisIdentifier || t.name === analysisIdentifier);
        if (matchedTemplate) {
          const analysisId = generateUniqueLimsId('ESS', usedAnalysisIds);
          usedAnalysisIds.add(analysisId);

          addAnalysis({
            id: analysisId,
            labId: selectedRequest.labId || activeLabId,
            sampleId: sampleId,
            templateId: matchedTemplate.id,
            status: 'planifie',
            technician: selectedRequest.assignedTo
              ? (users.find(u => u.id === selectedRequest.assignedTo)?.name || 'Non assigné')
              : 'Non assigné',
            updatedAt: new Date().toISOString(),
            results: {},
            images: []
          });
        }
      });
    }

    // Bascule automatique de la demande au statut 'En Cours'
    handleStatusChange('En Cours');
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Workflow & Demandes Clients</h2>
          <p className="text-sm text-slate-500 mt-1">
            Gestion des assignations, revue des mandats et conformité (Audit Trail 21 CFR Part 11).
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Volet de gauche : Liste des Demandes */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setFilterMode('actives')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${filterMode === 'actives' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              En cours / À traiter
            </button>
            <button
              onClick={() => setFilterMode('terminees')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${filterMode === 'terminees' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              Historique
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {visibleRequests.length === 0 ? (
              <div className="text-center p-6 text-slate-500 text-sm">Aucune demande assignée ou visible.</div>
            ) : (
              visibleRequests.map(req => {
                const template = requestTemplates.find(t => t.id === req.templateId);
                const requester = users.find(u => u.id === req.requesterId);
                const isSelected = selectedRequest?.id === req.id;
                return (
                  <button
                    key={req.id}
                    onClick={() => {
                      setSelectedRequest(req);
                      setIsEditing(false);
                      setEditedData(req.customData);
                      setSamplePriority((req as any).priority || 'normale');
                      setConclusionText(req.conclusion || '');
                      setShowAudit(false);

                      // Pré-sélectionne automatiquement le premier matériau choisi par le client dans le formulaire
                      const reqTpl = requestTemplates.find(t => t.id === req.templateId);
                      const matField = reqTpl?.fields.find(f => f.type === 'materials');
                      if (matField && req.customData?.[matField.id]) {
                        const rawVal = req.customData[matField.id];
                        const firstMatId = Array.isArray(rawVal) ? rawVal[0] : rawVal;
                        const matchedMat = materialTemplates.find(m => m.id === firstMatId || m.name === firstMatId);
                        if (matchedMat) {
                          setSampleMaterialTemplateId(matchedMat.id);
                        }
                      }
                    }}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${isSelected ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono font-bold text-slate-500">{req.id}</span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="font-semibold text-slate-900 text-sm mb-1 line-clamp-1">{req.title}</div>
                    <div className="text-xs text-slate-500 flex items-center mt-2">
                      <User className="w-3 h-3 mr-1" />
                      {requester?.company || requester?.name}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Volet de droite : Détails du Dossier, Workflow et Traçabilité */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {selectedRequest ? (
            <>
              {/* En-tête du dossier avec assignation */}
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg text-slate-900 font-mono">{selectedRequest.id}</h3>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <h4 className="text-md font-medium text-slate-800">{selectedRequest.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">Soumis le {formatDate(selectedRequest.createdAt)}</p>
                </div>
                {(currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
                  <div className="flex flex-wrap gap-3">
                    <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                      <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                        Priorité
                      </label>
                      <select
                        value={selectedRequest.priority || samplePriority}
                        onChange={(e) => {
                          const newPrio = e.target.value as 'basse' | 'normale' | 'haute';
                          setSamplePriority(newPrio);
                          updateRequestData(selectedRequest.id, { priority: newPrio }, `Priorité passée à : ${newPrio}`);
                          setSelectedRequest({ ...selectedRequest, priority: newPrio });
                        }}
                        className="w-full text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="basse">Basse</option>
                        <option value="normale">Normale</option>
                        <option value="haute">Urgente (Haute)</option>
                      </select>
                    </div>

                    <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                      <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                        Assignation Analyste
                      </label>
                      <select
                        value={selectedRequest.assignedTo || ''}
                        onChange={(e) => {
                          assignRequest(selectedRequest.id, e.target.value);
                          setSelectedRequest({ ...selectedRequest, assignedTo: e.target.value });
                        }}
                        className="w-full text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Non assigné --</option>
                        {analysts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                      <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                        Forcer l'étape du Workflow
                      </label>
                      <select
                        value={selectedRequest.status}
                        onChange={(e) => {
                          const targetStatus = e.target.value as RequestStatus;
                          handleStatusChange(targetStatus);
                        }}
                        className="w-full text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-medium text-blue-700"
                      >
                        <option value="soumise">1. Soumise</option>
                        <option value="En Revue">2. En Revue</option>
                        <option value="validee">3. Validée</option>
                        <option value="assignee">4. Assignée</option>
                        <option value="En Cours">5. En Cours</option>
                        <option value="En Validation">6. En Validation finale</option>
                        <option value="terminee">7. Terminée</option>
                        <option value="rejetee">Rejetée</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Actions de changement d'état du Workflow */}
                {selectedRequest.status !== 'rejetee' && selectedRequest.status !== 'terminee' && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider mb-3 flex items-center">
                      <Shield className="w-4 h-4 mr-2" />
                      Validation & Changement de Statut
                    </h4>
                    <div className="flex gap-3 items-start flex-wrap">
                      <input
                        type="text"
                        placeholder="Justification ou commentaire (obligatoire pour Refus)..."
                        value={statusComment}
                        onChange={e => setStatusComment(e.target.value)}
                        className="flex-1 min-w-[250px] text-sm border-slate-300 rounded-md"
                      />
                      <div className="flex gap-2 flex-wrap">
                        {selectedRequest.status === 'soumise' && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
                          <button
                            onClick={() => handleStatusChange('En Revue')}
                            className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm"
                          >
                            Passer en Revue
                          </button>
                        )}
                        {selectedRequest.status === 'En Revue' && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
                          <>
                            <button
                              disabled={!statusComment}
                              onClick={handleReject}
                              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm flex items-center"
                            >
                              <XCircle className="w-4 h-4 mr-1.5" /> Refuser la demande
                            </button>
                            <button
                              onClick={() => handleStatusChange('validee')}
                              className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center"
                            >
                              <CheckCircle className="w-4 h-4 mr-1.5" /> Valider la demande
                            </button>
                          </>
                        )}
                        {(selectedRequest.status === 'assignee' || selectedRequest.status === 'validee') && (
                          <button
                            onClick={() => handleStatusChange('En Cours')}
                            className="bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-700 transition-colors shadow-sm flex items-center"
                          >
                            <PlayCircle className="w-4 h-4 mr-1.5" /> Démarrer les essais sans échantillon
                          </button>
                        )}
                        {selectedRequest.status === 'En Cours' && (
                          <button
                            onClick={() => handleStatusChange('En Validation')}
                            className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors shadow-sm flex items-center"
                          >
                            <CheckCircle className="w-4 h-4 mr-1.5" /> Soumettre pour validation
                          </button>
                        )}
                        {selectedRequest.status === 'En Validation' && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
                          <button
                            onClick={() => handleStatusChange('terminee')}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center"
                          >
                            <Shield className="w-4 h-4 mr-1.5" /> Approuver (Libération)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Option de réouverture pour les managers */}
                {(selectedRequest.status === 'terminee' || selectedRequest.status === 'rejetee') && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-3 flex items-center">
                      <History className="w-4 h-4 mr-2" />
                      Actions de Gestion (Manager)
                    </h4>
                    <button
                      onClick={() => handleStatusChange('En Cours')}
                      className="bg-white border border-amber-300 text-amber-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-50 transition-colors shadow-sm flex items-center"
                    >
                      <PlayCircle className="w-4 h-4 mr-1.5" /> Réouvrir le dossier (Passer En Cours)
                    </button>
                  </div>
                )}

                {/* Module de génération rapide des échantillons physiques */}
                {(selectedRequest.status === 'validee' || selectedRequest.status === 'assignee' || (selectedRequest.status === 'En Cours' && (currentUser?.role === 'manager' || currentUser?.role === 'admin'))) && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center">
                      <Box className="w-4 h-4 mr-2" />
                      Réception & Création d'Échantillons
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Modèle Matériau (CMS)</label>
                        <select
                          value={sampleMaterialTemplateId}
                          onChange={e => setSampleMaterialTemplateId(e.target.value)}
                          className="w-full text-sm border-indigo-200 rounded-md"
                        >
                          {activeMaterialTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-800 mb-1">État Physique</label>
                        <select
                          value={sampleMaterialState}
                          onChange={e => setSampleMaterialState(e.target.value as any)}
                          className="w-full text-sm border-indigo-200 rounded-md"
                        >
                          <option value="Massif">Massif</option>
                          <option value="Fritté">Fritté</option>
                          <option value="Poudre">Poudre</option>
                          <option value="Liquide">Liquide</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Priorité</label>
                        <select
                          value={samplePriority}
                          onChange={e => setSamplePriority(e.target.value as 'basse' | 'normale' | 'haute')}
                          className="w-full text-sm border-indigo-200 rounded-md"
                        >
                          <option value="basse">Basse</option>
                          <option value="normale">Normale</option>
                          <option value="haute">Urgente (Haute)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Nombre d'échantillons</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={sampleQuantity}
                          onChange={e => setSampleQuantity(Number(e.target.value))}
                          className="w-full text-sm border-indigo-200 rounded-md"
                        />
                      </div>
                    </div>

                    {/* Champs dynamiques du Modèle Matériau sélectionné */}
                    {(() => {
                      const selectedMatTpl = materialTemplates.find(t => t.id === sampleMaterialTemplateId);
                      if (!selectedMatTpl || selectedMatTpl.fields.length === 0) return null;
                      return (
                        <div className="mb-4 pt-3 border-t border-indigo-200/60">
                          <span className="block text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">
                            Propriétés du matériau ({selectedMatTpl.name})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {selectedMatTpl.fields.map(field => (
                              <div key={field.id}>
                                <label className="block text-xs font-medium text-indigo-800 mb-1">
                                  {field.name} {field.unit ? `(${field.unit})` : ''}
                                </label>
                                {field.type === 'select' ? (
                                  <select
                                    value={sampleCustomData[field.name] ?? ''}
                                    onChange={e => setSampleCustomData({ ...sampleCustomData, [field.name]: e.target.value })}
                                    className="w-full text-sm border-indigo-200 rounded-md bg-white px-2 py-1.5"
                                  >
                                    <option value="">-- Sélectionner --</option>
                                    {field.options?.map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : field.type === 'multiselect' ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {field.options?.map(opt => {
                                      const currentVals = Array.isArray(sampleCustomData[field.name]) ? sampleCustomData[field.name] : [];
                                      const isChecked = currentVals.includes(opt);
                                      return (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => {
                                            const nextVals = isChecked
                                              ? currentVals.filter((v: string) => v !== opt)
                                              : [...currentVals, opt];
                                            setSampleCustomData({ ...sampleCustomData, [field.name]: nextVals });
                                          }}
                                          className={`px-2 py-1 rounded text-xs font-medium border ${
                                            isChecked
                                              ? 'bg-indigo-600 text-white border-indigo-600'
                                              : 'bg-white text-slate-700 border-indigo-200'
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : field.type === 'boolean' ? (
                                  <label className="inline-flex items-center gap-2 text-sm text-indigo-900 mt-1">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(sampleCustomData[field.name])}
                                      onChange={e => setSampleCustomData({ ...sampleCustomData, [field.name]: e.target.checked })}
                                      className="rounded border-indigo-300 text-indigo-600"
                                    />
                                    Oui
                                  </label>
                                ) : (
                                  <input
                                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                    value={sampleCustomData[field.name] ?? ''}
                                    placeholder={field.unit ? `Valeur en ${field.unit}...` : 'Saisir...'}
                                    onChange={e => setSampleCustomData({
                                      ...sampleCustomData,
                                      [field.name]: field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                                    })}
                                    className="w-full text-sm border-indigo-200 rounded-md bg-white px-2 py-1.5"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <button
                      onClick={handleGenerateSamples}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Générer {sampleQuantity} échantillon(s) LIMS
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Détails et Attributs du Formulaire */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Données Client
                      </h4>
                      {(currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
                        isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setIsEditing(false);
                                setEditedData(selectedRequest.customData);
                              }}
                              className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => {
                                updateRequestData(selectedRequest.id, { customData: editedData }, 'Modification des données de la demande.');
                                setSelectedRequest(prev => prev ? { ...prev, customData: editedData } : null);
                                setIsEditing(false);
                              }}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                            >
                              <Save className="w-3 h-3 mr-1" /> Enregistrer
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 flex items-center"
                          >
                            <Edit2 className="w-3 h-3 mr-1" /> Modifier
                          </button>
                        )
                      )}
                    </div>

                    <dl className="space-y-4">
                      {Object.entries(selectedRequest.customData).map(([key, value]) => {
                        // On masque les clés techniques de sous-propriétés matériaux car elles sont affichées directement sous le champ 'materials'
                        if (key.endsWith('__material_properties') || key.startsWith('matprop_')) {
                          return null;
                        }

                        const template = requestTemplates.find(t => t.id === selectedRequest.templateId);
                        const field = template?.fields.find(f => f.id === key);

                        // Helper pour résoudre le nom d'un matériau depuis son ID
                        const resolveMaterialName = (idOrName: string) =>
                          materialTemplates.find(m => m.id === idOrName || m.name === idOrName)?.name || idOrName;

                        let displayValue = value;
                        if (typeof value === 'boolean') {
                          displayValue = value ? 'Oui' : 'Non';
                        } else if (field?.type === 'analyses' && Array.isArray(value)) {
                          displayValue = value.map(id => analysisTemplates.find(a => a.id === id)?.name || id).join(', ');
                        } else if (field?.type === 'materials') {
                          displayValue = Array.isArray(value)
                            ? value.map(resolveMaterialName).join(', ')
                            : resolveMaterialName(String(value));
                        } else if (Array.isArray(value)) {
                          displayValue = value.join(', ');
                        }

                        // Si c'est un champ de type 'materials', on récupère les modèles sélectionnés et leurs propriétés associées
                        const selectedMatTemplates = field?.type === 'materials'
                          ? (Array.isArray(value) ? value : [value])
                              .map(v => materialTemplates.find(m => m.id === v || m.name === v))
                              .filter(Boolean)
                          : [];

                        const propertiesKey = `${key}__material_properties`;
                        const materialPropertiesContainer = isEditing
                          ? (editedData[propertiesKey] || {})
                          : (selectedRequest.customData[propertiesKey] || {});

                        return (
                          <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <dt className="text-xs font-medium text-slate-500 mb-1">{field?.name || key}</dt>
                            <dd className="text-sm text-slate-900 font-medium">
                              {isEditing && field?.type !== 'materials' && field?.type !== 'analyses' ? (
                                typeof value === 'boolean' ? (
                                  <input
                                    type="checkbox"
                                    checked={editedData[key] || false}
                                    onChange={e => setEditedData({ ...editedData, [key]: e.target.checked })}
                                    className="rounded border-slate-300"
                                  />
                                ) : Array.isArray(value) ? (
                                  <span className="text-xs text-slate-400 italic">Non modifiable (Tableau)</span>
                                ) : field?.type === 'date' ? (
                                  <input
                                    type="date"
                                    value={editedData[key] || ''}
                                    onChange={e => setEditedData({ ...editedData, [key]: e.target.value })}
                                    className="w-full text-sm border-slate-300 rounded px-2 py-1"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={editedData[key] || ''}
                                    onChange={e => setEditedData({ ...editedData, [key]: e.target.value })}
                                    className="w-full text-sm border-slate-300 rounded px-2 py-1"
                                  />
                                )
                              ) : Array.isArray(value) ? (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {value.map(v => (
                                    <span
                                      key={v}
                                      className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                        field?.type === 'materials'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      }`}
                                    >
                                      {field?.type === 'analyses'
                                        ? (analysisTemplates.find(a => a.id === v)?.name || v)
                                        : field?.type === 'materials'
                                          ? resolveMaterialName(v)
                                          : v}
                                    </span>
                                  ))}
                                </div>
                              ) : field?.type === 'date' && displayValue ? (
                                new Date(displayValue as string).toLocaleDateString('fr-FR')
                              ) : (
                                displayValue
                              )}

                              {/* Affichage et édition des propriétés des matériaux sélectionnés */}
                              {selectedMatTemplates.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-slate-200 space-y-2.5">
                                  {selectedMatTemplates.map(matTpl => {
                                    const matPropsForTpl = materialPropertiesContainer[matTpl!.id] || {};
                                    return (
                                      <div key={matTpl!.id} className="bg-white rounded-lg border border-emerald-200 p-2.5 text-xs space-y-1.5">
                                        <span className="font-bold text-emerald-900 uppercase tracking-wider block">
                                          Propriétés — {matTpl!.name}
                                        </span>
                                        {matTpl!.fields.length === 0 ? (
                                          <span className="text-slate-400 italic">Aucune propriété configurée sur ce modèle.</span>
                                        ) : (
                                          <div className="space-y-1">
                                            {matTpl!.fields.map(matField => {
                                              const propVal =
                                                matPropsForTpl[matField.id] ??
                                                matPropsForTpl[matField.name] ??
                                                getMaterialPropFromRequest(selectedRequest, matTpl!.id, matField.id, matField.name);

                                              return (
                                                <div key={matField.id} className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 gap-2">
                                                  <span className="text-slate-600">
                                                    {matField.name} {matField.unit ? `(${matField.unit})` : ''}
                                                  </span>
                                                  {isEditing ? (
                                                    <input
                                                      type={matField.type === 'number' ? 'number' : 'text'}
                                                      value={propVal !== undefined ? String(propVal) : ''}
                                                      onChange={e => {
                                                        const updatedVal = matField.type === 'number'
                                                          ? (e.target.value === '' ? '' : Number(e.target.value))
                                                          : e.target.value;
                                                        setEditedData({
                                                          ...editedData,
                                                          [propertiesKey]: {
                                                            ...materialPropertiesContainer,
                                                            [matTpl!.id]: {
                                                              ...matPropsForTpl,
                                                              [matField.id]: updatedVal
                                                            }
                                                          }
                                                        });
                                                      }}
                                                      className="w-36 text-xs border border-slate-300 rounded px-2 py-1 bg-white text-right"
                                                    />
                                                  ) : (
                                                    <span className="font-semibold text-slate-900 text-right">
                                                      {propVal !== undefined && propVal !== '' ? (
                                                        Array.isArray(propVal)
                                                          ? propVal.join(', ')
                                                          : typeof propVal === 'boolean'
                                                            ? (propVal ? 'Oui' : 'Non')
                                                            : `${propVal}${matField.unit ? ` ${matField.unit}` : ''}`
                                                      ) : (
                                                        <span className="text-slate-400 italic font-normal">Non renseigné</span>
                                                      )}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>

                  {/* Audit Trail et Traçabilité Complète (Masqué par défaut) */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center m-0">
                        <History className="w-4 h-4 mr-2" />
                        Audit Trail (Traçabilité)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAudit(!showAudit)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                      >
                        {showAudit ? 'Masquer l\'audit' : 'Afficher l\'audit'}
                      </button>
                    </div>

                    {showAudit && (
                      <div className="relative border-l border-slate-200 ml-3 space-y-6 pt-2 animate-in fade-in duration-200">
                        {selectedRequest.auditTrail && selectedRequest.auditTrail.length > 0 ? (
                          selectedRequest.auditTrail.map((audit, i) => {
                            const user = users.find(u => u.id === audit.userId);
                            return (
                              <div key={audit.id || i} className="relative pl-5">
                                <div className="absolute w-2.5 h-2.5 bg-blue-500 rounded-full -left-[5px] top-1.5 ring-4 ring-white"></div>
                                <div className="text-xs text-slate-400 mb-0.5">{formatDate(audit.timestamp)}</div>
                                <div className="text-sm font-semibold text-slate-800">{audit.action}</div>
                                <div className="text-sm text-slate-600 mt-1">{audit.details}</div>
                                <div className="text-xs font-medium text-slate-500 mt-2 flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  Par : {user?.name || audit.userId}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-400 italic pl-5">Aucun historique d'audit pour ce dossier.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Encart Conclusion Générale pour les Rapports */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-emerald-950 uppercase tracking-wider flex items-center">
                          <FileText className="w-4 h-4 mr-2 text-emerald-700" />
                          Conclusion Générale & Avis Technique (Rapport)
                        </h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Cette conclusion sera automatiquement injectable dans vos rapports Word/PDF via la balise <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">{"{{demande.conclusion}}"}</code>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateRequestData(selectedRequest.id, { conclusion: conclusionText }, 'Mise à jour de la conclusion du rapport');
                          setSelectedRequest(prev => prev ? { ...prev, conclusion: conclusionText } : null);
                        }}
                        className="shrink-0 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs flex items-center"
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Enregistrer la conclusion
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={conclusionText}
                      onChange={e => setConclusionText(e.target.value)}
                      placeholder="Rédigez ici la conclusion générale de l'expertise, la conformité des échantillons ou les recommandations techniques..."
                      className="w-full rounded-lg border border-emerald-300 bg-white p-3 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Échantillons et Essais Rattachés (avec Ajout / Suppression par le Manager) */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Database className="w-4 h-4 mr-2" />
                    Échantillons & Analyses Générés
                  </h4>
                  {/* Échantillons et Essais Rattachés (avec Impression Zebra & ZPL) */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                  {(() => {
                    const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
                    const reqSamples = samples.filter(s => s.requestId === selectedRequest.id);
                    const activeAnalysisTpls = analysisTemplates.filter(t => t.isActive !== false);

                    const buildLabelPayload = (targetSamples: Sample[]) =>
                      targetSamples.map(s => ({
                        sample: s,
                        materialName: materialTemplates.find(m => m.id === s.templateId)?.name || s.templateId,
                        labCode: s.labId?.toUpperCase()
                      }));

                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center">
                            <Database className="w-4 h-4 mr-2" />
                            Échantillons & Analyses Générés ({reqSamples.length})
                          </h4>

                          {reqSamples.length > 0 && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => printZebraLabelsWindow(buildLabelPayload(reqSamples))}
                                className="text-xs px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                                title="Imprimer toutes les étiquettes de cette demande sur imprimante Zebra (50x30mm)"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Imprimer Étiquettes Zebra ({reqSamples.length})
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const zpl = generateZplForSamples(buildLabelPayload(reqSamples));
                                  navigator.clipboard?.writeText(zpl);
                                  alert('Code ZPL copié dans le presse-papiers !\n\nAperçu :\n' + zpl.slice(0, 350) + '...');
                                }}
                                className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg font-mono font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Copier le code ZPL II natif pour imprimante Zebra"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                ZPL
                              </button>
                            </div>
                          )}
                        </div>
                  {(() => {
                    const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
                    const reqSamples = samples.filter(s => s.requestId === selectedRequest.id);
                    const activeAnalysisTpls = analysisTemplates.filter(t => t.isActive !== false);

                    if (reqSamples.length === 0) {
                      return (
                        <div className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-lg border border-slate-100">
                          Aucun échantillon LIMS généré pour cette demande.
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-4">
                        {reqSamples.map(sample => {
                          const sampleAnalyses = analyses.filter(a => a.sampleId === sample.id);
                          return (
                            <div key={sample.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                <div className="font-semibold text-slate-800 flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-indigo-500" />
                                  <span>Échantillon : {sample.id}</span>
                                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-mono">
                                    {sample.barcode}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => printZebraLabelsWindow(buildLabelPayload([sample]))}
                                    className="text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 flex items-center gap-1 font-medium transition-colors"
                                    title="Imprimer l'étiquette Zebra de cet échantillon"
                                  >
                                    <Printer className="w-3 h-3" /> Étiquette
                                  </button>
                                </div>
                                {isManager && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingAnalysisForSample(addingAnalysisForSample === sample.id ? null : sample.id);
                                        setSelectedNewAnalysisTplId(activeAnalysisTpls[0]?.id || '');
                                      }}
                                      className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-medium flex items-center transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une analyse
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`Supprimer l'échantillon ${sample.id} et toutes ses analyses associées ?`)) {
                                          deleteSample(sample.id);
                                        }
                                      }}
                                      className="text-xs p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                      title="Supprimer cet échantillon"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Petit formulaire d'ajout d'analyse à la volée pour cet échantillon */}
                              {isManager && addingAnalysisForSample === sample.id && (
                                <div className="mb-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg flex flex-wrap items-center gap-2">
                                  <select
                                    value={selectedNewAnalysisTplId}
                                    onChange={e => setSelectedNewAnalysisTplId(e.target.value)}
                                    className="text-xs border-indigo-200 rounded-md py-1.5 px-2 bg-white flex-1 min-w-[200px]"
                                  >
                                    {activeAnalysisTpls.map(tpl => (
                                      <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.standardRef || 'Interne'})</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!selectedNewAnalysisTplId) return;
                                      const usedAnalysisIds = new Set(allAnalyses.map(a => a.id));
                                      const newAnalysisId = generateUniqueLimsId('ESS', usedAnalysisIds);
                                      addAnalysis({
                                        id: newAnalysisId,
                                        labId: selectedRequest.labId || activeLabId,
                                        sampleId: sample.id,
                                        templateId: selectedNewAnalysisTplId,
                                        status: 'planifie',
                                        technician: selectedRequest.assignedTo
                                          ? (users.find(u => u.id === selectedRequest.assignedTo)?.name || 'Non assigné')
                                          : 'Non assigné',
                                        updatedAt: new Date().toISOString(),
                                        results: {},
                                        images: []
                                      });
                                      setAddingAnalysisForSample(null);
                                    }}
                                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700"
                                  >
                                    Confirmer l'ajout
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddingAnalysisForSample(null)}
                                    className="text-xs px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 rounded-md"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              )}

                              {sampleAnalyses.length === 0 ? (
                                <div className="text-xs text-slate-400 italic">Aucune analyse associée.</div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {sampleAnalyses.map(analysis => {
                                    const tpl = analysisTemplates.find(t => t.id === analysis.templateId);
                                    return (
                                      <div key={analysis.id} className="flex items-center text-sm border border-slate-100 rounded bg-slate-50 px-3 py-2 gap-2">
                                        <TestTube2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <div className="truncate flex-1">
                                          <span className="font-medium text-slate-700">{tpl?.name || analysis.id}</span>
                                          <span className="ml-1.5 text-[10px] font-mono text-slate-400">({analysis.id})</span>
                                        </div>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${analysis.status === 'rejete'
                                          ? 'bg-red-50 border-red-200 text-red-700'
                                          : 'bg-white border-slate-200 text-slate-500'
                                          }`}>
                                          {analysis.status}
                                        </span>
                                        {isManager && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (window.confirm(`Supprimer l'analyse ${analysis.id} (${tpl?.name || ''}) ?`)) {
                                                deleteAnalysis(analysis.id);
                                              }
                                            }}
                                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                            title="Supprimer cette analyse"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <FileText className="w-12 h-12 mb-3 text-slate-300" />
              <p>Sélectionnez un dossier pour consulter le détail et l'audit trail.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}