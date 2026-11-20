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
 *
 * @module views/RequestsInternal
 */

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { useLims } from '../store';
import { FileText, Clock, User, CheckCircle, Shield, AlertCircle, PlayCircle, History, Mail, XCircle, Plus, Box, Edit2, Save, Database, Layers, TestTube2, Trash2, Printer, QrCode } from 'lucide-react';
import { RequestStatus, AnalysisRequest, MaterialState, Sample } from '../types';
import { generateUniqueLimsId, generateUniqueBarcode } from '../utils/idGenerator';
import { printZebraLabelsWindow, generateZplForSamples } from '../utils/zebraLabelPrinter';

/**
 * Composant principal de revue technique, d'assignation et de réception des demandes clients côté laboratoire.
 */
export function RequestsInternal() {
  // Extraction du store global LIMS (entités filtrées par labo + entités globales `allSamples`/`allAnalyses` pour l'unicité des IDs)
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
    activeLabId,
    laboratories,
    addRequestComment,
    saveContractReview
  } = useLims();

  // États locaux de sélection et d'édition du dossier actif
  const [selectedRequest, setSelectedRequest] = useState<AnalysisRequest | null>(null);

  // Maintient le panneau de détail synchronisé avec le store global (statut, assignation, auditTrail)
  useEffect(() => {
    if (selectedRequest) {
      const fresh = requests.find(r => r.id === selectedRequest.id);
      if (fresh && fresh !== selectedRequest) {
        setSelectedRequest(fresh);
      } else if (!fresh) {
        setSelectedRequest(null);
      }
    }
  }, [requests]);
  // Commentaire ou justification saisi lors d'un changement de statut (obligatoire en cas de rejet)
  const [statusComment, setStatusComment] = useState('');
  // Active le mode édition inline des champs personnalisés `customData` de la demande (réservé manager/admin)
  const [isEditing, setIsEditing] = useState(false);
  // Copie de travail des données personnalisées `customData` pendant l'édition
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  // Filtre d'onglet de la liste de gauche : demandes actives vs historique (terminées/rejetées)
  const [filterMode, setFilterMode] = useState<'actives' | 'terminees'>('actives');

  // Paramètres de génération d'échantillons en masse (réception physique au laboratoire)
  const [sampleQuantity, setSampleQuantity] = useState(1);
  // Ne propose que les modèles de matériaux actifs dans le sélecteur
  const activeMaterialTemplates = materialTemplates.filter(t => t.isActive !== false);
  const [sampleMaterialTemplateId, setSampleMaterialTemplateId] = useState(activeMaterialTemplates[0]?.id || '');

  // Initialise le modèle de matériau par défaut dès que la liste est chargée si aucun modèle n'est sélectionné
  useEffect(() => {
    if (!sampleMaterialTemplateId && activeMaterialTemplates.length > 0) {
      setSampleMaterialTemplateId(activeMaterialTemplates[0].id);
    }
  }, [activeMaterialTemplates, sampleMaterialTemplateId]);
  const [sampleMaterialState, setSampleMaterialState] = useState<MaterialState>('Massif');
  const [samplePriority, setSamplePriority] = useState<'basse' | 'normale' | 'haute'>('normale');
  // Propriétés physico-chimiques / géométriques du matériau pré-remplies depuis la demande et ajustables à réception
  const [sampleCustomData, setSampleCustomData] = useState<Record<string, any>>({});
  // Texte de conclusion générale et avis technique destiné à la balise `{{demande.conclusion}}` des rapports
  const [conclusionText, setConclusionText] = useState('');
  // Identifiant de l'échantillon pour lequel le mini-formulaire d'ajout d'analyse à la volée est ouvert
  const [addingAnalysisForSample, setAddingAnalysisForSample] = useState<string | null>(null);
  // Modèle d'analyse sélectionné lors de l'ajout manuel d'un essai sur un échantillon existant
  const [selectedNewAnalysisTplId, setSelectedNewAnalysisTplId] = useState<string>('');
  // Contrôle le repli/dépli de la chronologie Audit Trail
  const [showAudit, setShowAudit] = useState(false);
  // États pour le fil de discussion intégré et la revue de contrat ISO 17025
  const [newCommentText, setNewCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [committedDateDraft, setCommittedDateDraft] = useState('');
  const [reviewMethodsOk, setReviewMethodsOk] = useState(true);
  const [reviewResourcesOk, setReviewResourcesOk] = useState(true);
  const [reviewStaffOk, setReviewStaffOk] = useState(true);
  // Message d'erreur affiché si une tentative d'assignation échoue faute d'habilitation ISO 17025
  const [assignError, setAssignError] = useState<string | null>(null);
  // Sous-onglet actif dans le volet de détail du dossier sélectionné (évite le défilement infini et les débordements)
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'samples' | 'contract' | 'activity'>('overview');

  useEffect(() => {
    setAssignError(null);
  }, [selectedRequest?.id]);

  // Liste des utilisateurs ayant le rôle analyste ou manager rattachés au laboratoire du dossier pour l'assignation
  const analysts = users.filter(u =>
    (u.role === 'analyste' || u.role === 'manager') &&
    (!u.labId || u.labId === 'all' || u.labId === (selectedRequest?.labId || activeLabId))
  );

  /**
   * Retourne la liste dédupliquée des identifiants de modèles d'analyses requis par une demande :
   * combine les essais déjà instanciés sur les échantillons et ceux déclarés dans `customData`.
   */
  const getRequestRequiredTemplateIds = (req: AnalysisRequest | null): string[] => {
    if (!req) return [];
    const ids = new Set<string>();

    // 1. Analyses déjà créées pour les échantillons de cette demande
    const reqSampleIds = new Set(samples.filter(s => s.requestId === req.id).map(s => s.id));
    analyses.forEach(a => {
      if (reqSampleIds.has(a.sampleId) && a.templateId) {
        ids.add(a.templateId);
      }
    });

    // 2. Analyses demandées dans le formulaire dynamique (même avant génération des échantillons)
    const resolveTplId = (raw: string) => {
      const matched = analysisTemplates.find(t => t.id === raw || t.name === raw);
      return matched?.id;
    };

    const reqTpl = requestTemplates.find(t => t.id === req.templateId);
    let rawRequested: string[] = [];
    if (reqTpl) {
      reqTpl.fields
        .filter(f => f.type === 'analyses')
        .forEach(f => {
          const val = req.customData?.[f.id];
          if (Array.isArray(val)) rawRequested.push(...val.map(String));
        });
    }
    if (rawRequested.length === 0 && Array.isArray(req.customData?.['analyses_demandees'])) {
      rawRequested = req.customData['analyses_demandees'].map(String);
    }
    if (rawRequested.length === 0 && req.customData) {
      Object.values(req.customData).forEach(value => {
        if (Array.isArray(value)) {
          value.forEach(v => {
            const resolved = resolveTplId(String(v));
            if (resolved) rawRequested.push(resolved);
          });
        } else if (typeof value === 'string') {
          const resolved = resolveTplId(value);
          if (resolved) rawRequested.push(resolved);
        }
      });
    }
    rawRequested.forEach(raw => {
      const resolved = resolveTplId(raw);
      if (resolved) ids.add(resolved);
    });

    return Array.from(ids);
  };

  /** Vérifie si un utilisateur possède une habilitation valide (non expirée) pour une méthode d'analyse donnée (ISO 17025 §6.2) */
  const isUserQualifiedForTemplate = (userId: string | undefined, templateId: string): boolean => {
    if (!userId) return false;
    const u = users.find(usr => usr.id === userId);
    const quals = u?.qualifiedTemplateIds || [];
    if (!quals.includes(templateId)) return false;
    const expStr = u?.qualificationExpiries?.[templateId];
    if (expStr && new Date(expStr).getTime() < new Date().setHours(0, 0, 0, 0)) {
      return false;
    }
    return true;
  };

  /** Génère un Devis PDF A4 (option activable par laboratoire via `labSettings.enableQuotes`) */
  const handleGenerateQuotePdf = (req: AnalysisRequest) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const quoteNum = req.quoteNumber || `DEV-${req.id.replace(/^REQ-/, '')}`;
    const requester = users.find(u => u.id === req.requesterId);
    const neededIds = getRequestRequiredTemplateIds(req);
    const sampleQty = Math.max(1, req.sampleCount || 1);

    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text(labSettings?.labName || 'Laboratoire', 15, 20);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(labSettings?.labAddress || '', 15, 26);
    doc.text(`${labSettings?.contactEmail || ''} • ${labSettings?.phone || ''}`, 15, 31);

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('DEVIS D\'ESSAIS', 195, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`N° ${quoteNum}`, 195, 26, { align: 'right' });
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')} (Validité 30 jours)`, 195, 31, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(15, 37, 195, 37);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Client : ${requester?.company || requester?.name || 'N/A'} (${requester?.name || ''})`, 15, 45);
    doc.text(`Demande : ${req.id} — ${req.title}`, 15, 51);
    doc.text(`Nombre d'échantillons estimé : ${sampleQty} • Durée estimée : ~${req.estimatedHours || '-'} h`, 15, 57);

    let y = 68;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y - 5, 180, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Prestation / Essai', 18, y);
    doc.text('Qté', 130, y, { align: 'right' });
    doc.text('P.U. HT', 160, y, { align: 'right' });
    doc.text('Total HT', 192, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 8;

    let totalHT = 0;
    neededIds.forEach(tid => {
      const tpl = analysisTemplates.find(t => t.id === tid);
      const unitPrice = tpl?.unitPrice || 0;
      const lineTotal = unitPrice * sampleQty;
      totalHT += lineTotal;
      doc.text(`${tpl?.name || tid}${tpl?.standardRef ? ` (${tpl.standardRef})` : ''}`, 18, y);
      doc.text(String(sampleQty), 130, y, { align: 'right' });
      doc.text(`${unitPrice.toFixed(2)} €`, 160, y, { align: 'right' });
      doc.text(`${lineTotal.toFixed(2)} €`, 192, y, { align: 'right' });
      y += 7;
    });
    if (totalHT === 0 && req.estimatedCost) {
      totalHT = req.estimatedCost;
    }

    y += 6;
    doc.line(120, y, 195, y);
    y += 7;
    const tva = totalHT * 0.2;
    const totalTTC = totalHT + tva;
    doc.text(`Total HT : ${totalHT.toFixed(2)} €`, 192, y, { align: 'right' });
    y += 6;
    doc.text(`TVA (20 %) : ${tva.toFixed(2)} €`, 192, y, { align: 'right' });
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Total TTC : ${totalTTC.toFixed(2)} €`, 192, y, { align: 'right' });

    doc.save(`${quoteNum}.pdf`);
    updateRequestData(
      req.id,
      {
        quoteNumber: quoteNum,
        quoteStatus: req.quoteStatus && req.quoteStatus !== 'aucun' ? req.quoteStatus : 'genere',
        quoteGeneratedAt: new Date().toISOString()
      },
      `Devis PDF ${quoteNum} généré (${totalHT.toFixed(2)} € HT)`
    );
  };

  /**
   * Extrait la valeur d'une propriété de matériau depuis le customData d'une demande
   * (compatible avec la structure `${field.id}__material_properties` de NewRequestModal / EditRequestModal)
   *
   * @param req Demande d'analyse source
   * @param matTplId Identifiant du modèle de matériau
   * @param propFieldId Identifiant technique du champ de propriété matériau
   * @param propFieldName Libellé humain du champ de propriété matériau
   * @returns La valeur saisie par le demandeur ou `undefined` si non renseignée
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
   * Filtrage des demandes visibles selon l'onglet (actives/terminées), la recherche et le rôle :
   * - Managers & Admins : voient toutes les demandes du laboratoire actif
   * - Analystes : ne voient que les demandes qui leur sont nominativement assignées (`r.assignedTo === currentUser.id`)
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
   *
   * @param status Statut du dossier dans le workflow LIMS
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
   *
   * @param dateString Chaîne ISO 8601
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
   * Met à jour à la fois le store global et la copie locale `selectedRequest` pour un retour visuel immédiat.
   *
   * @param newStatus Nouveau statut cible de la demande
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
   * Enregistre le motif du rejet et ajoute une entrée dans la piste d'audit.
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
   * Génère les échantillons LIMS réels et associe automatiquement les analyses demandées :
   * 1. Identifie les essais demandés dans les champs de type `'analyses'` du formulaire (avec fallbacks)
   * 2. Génère `sampleQuantity` échantillons dotés d'identifiants et codes-barres uniques inter-laboratoires
   * 3. Pour chaque échantillon créé, instancie les analyses correspondantes à l'état `'planifie'`
   * 4. Passe automatiquement la demande au statut `'En Cours'`
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

    // Bornage de sécurité (entre 1 et 50) pour empêcher la génération de 0 ou d'un nombre excessif d'échantillons
    const safeQuantity = Math.min(50, Math.max(1, Math.floor(Number(sampleQuantity) || 1)));

    // Création de N échantillons avec leurs essais associés
    for (let i = 0; i < safeQuantity; i++) {
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

      // Instanciation des essais correspondants (uniquement assignés si l'opérateur est habilité sur la méthode)
      requestedAnalyses.forEach((analysisIdentifier: string) => {
        const matchedTemplate = analysisTemplates.find(t => t.id === analysisIdentifier || t.name === analysisIdentifier);
        if (matchedTemplate) {
          const analysisId = generateUniqueLimsId('ESS', usedAnalysisIds);
          usedAnalysisIds.add(analysisId);
          const assignedQualified = isUserQualifiedForTemplate(selectedRequest.assignedTo, matchedTemplate.id);

          addAnalysis({
            id: analysisId,
            labId: selectedRequest.labId || activeLabId,
            sampleId: sampleId,
            templateId: matchedTemplate.id,
            status: 'planifie',
            technician: assignedQualified && selectedRequest.assignedTo
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

  const activeCount = requests.filter(r => {
    if (r.status === 'terminee' || r.status === 'rejetee') return false;
    if (currentUser?.role === 'analyste') return r.assignedTo === currentUser.id;
    return true;
  }).length;
  const historyCount = requests.filter(r => {
    if (r.status !== 'terminee' && r.status !== 'rejetee') return false;
    if (currentUser?.role === 'analyste') return r.assignedTo === currentUser.id;
    return true;
  }).length;

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const selectedRequester = selectedRequest ? users.find(u => u.id === selectedRequest.requesterId) : null;
  const selectedReqSamples = selectedRequest ? samples.filter(s => s.requestId === selectedRequest.id) : [];

  return (
    <div className="space-y-4 h-full flex flex-col min-w-0">
      <div className="flex flex-wrap justify-between items-center gap-2 shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Workflow & Demandes Clients</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Pilotage des dossiers, revue de contrat ISO 17025, réception d'échantillons et traçabilité.
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-5 min-h-0 min-w-0">
        {/* ============================================================ */}
        {/* VOLET GAUCHE : LISTE DES DEMANDES (4/12)                     */}
        {/* ============================================================ */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden min-w-0">
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/80 shrink-0">
            <button
              type="button"
              onClick={() => setFilterMode('actives')}
              className={`py-3 px-2 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                filterMode === 'actives'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>À traiter</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700">{activeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('terminees')}
              className={`py-3 px-2 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                filterMode === 'terminees'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>Historique</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-600">{historyCount}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {visibleRequests.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-400 text-sm italic">
                Aucune demande dans cette catégorie.
              </div>
            ) : (
              visibleRequests.map(req => {
                const requester = users.find(u => u.id === req.requesterId);
                const assignedOp = req.assignedTo ? users.find(u => u.id === req.assignedTo) : null;
                const isSelected = selectedRequest?.id === req.id;
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequest(req);
                      setIsEditing(false);
                      setEditedData(req.customData);
                      setSamplePriority((req as any).priority || 'normale');
                      setSampleQuantity(req.sampleCount || 1);
                      setConclusionText(req.conclusion || '');
                      setShowAudit(false);

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
                    className={`w-full text-left p-3.5 rounded-xl border transition-all min-w-0 ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-200 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-mono font-bold text-blue-700 truncate">{req.id}</span>
                        {req.priority === 'haute' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700 shrink-0">
                            Urgent
                          </span>
                        )}
                      </div>
                      <div className="shrink-0">{getStatusBadge(req.status)}</div>
                    </div>
                    <div className="font-semibold text-slate-900 text-sm line-clamp-1 break-words">{req.title}</div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mt-2 min-w-0">
                      <span className="flex items-center truncate">
                        <User className="w-3 h-3 mr-1 shrink-0" />
                        <span className="truncate">{requester?.company || requester?.name || 'Client'}</span>
                      </span>
                      <span className="shrink-0 text-[10px] font-medium text-slate-400">
                        {assignedOp ? assignedOp.name.split(' ')[0] : 'Non assigné'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* VOLET DROIT : DÉTAIL STRUCTURÉ PAR ONGLETS (8/12)            */}
        {/* ============================================================ */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden min-w-0">
          {selectedRequest ? (
            <>
              {/* EN-TÊTE COMPACT ET SANS DÉBORDEMENT */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 space-y-3.5 shrink-0 min-w-0">
                {/* Ligne 1 : Identité du dossier + métadonnées clés */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg text-slate-900 font-mono">{selectedRequest.id}</h3>
                      {getStatusBadge(selectedRequest.status)}
                      {selectedRequest.priority === 'haute' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                          Urgence Haute
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800 mt-1 break-words">{selectedRequest.title}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                      <span>Client : <strong className="text-slate-700">{selectedRequester?.company || selectedRequester?.name || 'N/A'}</strong></span>
                      <span>• Soumis le {formatDate(selectedRequest.createdAt)}</span>
                      {selectedRequest.sampleCount && <span>• {selectedRequest.sampleCount} éch.</span>}
                      {selectedRequest.estimatedHours && <span>• ~{selectedRequest.estimatedHours}h</span>}
                      {selectedRequest.committedDueDate && (
                        <span className="text-indigo-700 font-semibold">
                          • Échéance : {new Date(selectedRequest.committedDueDate).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ligne 2 : Barre de pilotage Manager/Admin (Grille 3 colonnes propres, zéro débordement) */}
                {isManager && (() => {
                  const neededTplIds = getRequestRequiredTemplateIds(selectedRequest);
                  const getMissingTplNames = (userId: string) =>
                    neededTplIds
                      .filter(tid => !isUserQualifiedForTemplate(userId, tid))
                      .map(tid => analysisTemplates.find(t => t.id === tid)?.name || tid);
                  const currentMissingNames = selectedRequest.assignedTo
                    ? getMissingTplNames(selectedRequest.assignedTo)
                    : [];

                  return (
                    <div className="space-y-2 min-w-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {/* Priorité */}
                        <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
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
                            className="w-full text-xs border-slate-300 rounded-md py-1.5 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="basse">Basse</option>
                            <option value="normale">Normale</option>
                            <option value="haute">Urgente (Haute)</option>
                          </select>
                        </div>

                        {/* Assignation Analyste */}
                        <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                            Analyste assigné (Habilitations)
                          </label>
                          <select
                            value={selectedRequest.assignedTo || ''}
                            onChange={(e) => {
                              const targetId = e.target.value;
                              if (!targetId) {
                                setAssignError(null);
                                assignRequest(selectedRequest.id, '');
                                setSelectedRequest({ ...selectedRequest, assignedTo: '' });
                                return;
                              }
                              const candidate = analysts.find(a => a.id === targetId);
                              const missing = getMissingTplNames(targetId);
                              if (missing.length > 0) {
                                setAssignError(
                                  `Assignation bloquée (ISO 17025 §6.2) : ${candidate?.name || 'cet opérateur'} n'est pas habilité (ou habilitation expirée) pour : ${missing.join(', ')}.`
                                );
                                return;
                              }
                              setAssignError(null);
                              assignRequest(selectedRequest.id, targetId);
                              setSelectedRequest({ ...selectedRequest, assignedTo: targetId });
                            }}
                            className="w-full text-xs border-slate-300 rounded-md py-1.5 focus:ring-blue-500 focus:border-blue-500 truncate"
                          >
                            <option value="">-- Non assigné --</option>
                            {analysts.map(a => {
                              const missing = getMissingTplNames(a.id);
                              const isQualified = missing.length === 0;
                              const isCurrentlyAssigned = a.id === selectedRequest.assignedTo;
                              return (
                                <option
                                  key={a.id}
                                  value={a.id}
                                  disabled={!isQualified && !isCurrentlyAssigned}
                                >
                                  {a.name}{' '}
                                  {neededTplIds.length === 0
                                    ? `(${(a.qualifiedTemplateIds || []).length} hab.)`
                                    : isQualified
                                      ? '✓'
                                      : `⛔ (${missing.length} manq.)`}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Étape Workflow */}
                        <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg min-w-0">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Étape du Workflow
                          </label>
                          <select
                            value={selectedRequest.status}
                            onChange={(e) => handleStatusChange(e.target.value as RequestStatus)}
                            className="w-full text-xs border-slate-300 rounded-md py-1.5 font-semibold text-blue-700 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="soumise">1. Soumise</option>
                            <option value="En Revue">2. En Revue</option>
                            <option value="validee">3. Validée</option>
                            <option value="assignee">4. Assignée</option>
                            <option value="En Cours">5. En Cours</option>
                            <option value="En Validation">6. En Validation</option>
                            <option value="terminee">7. Terminée</option>
                            <option value="rejetee">Rejetée</option>
                          </select>
                        </div>
                      </div>

                      {assignError && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-medium">
                          ⛔ {assignError}
                        </div>
                      )}
                      {!assignError && currentMissingNames.length > 0 && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          ⛔ Opérateur non habilité (ISO 17025 §6.2) pour : <strong>{currentMissingNames.join(', ')}</strong>.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* BARRE D'ONGLETS DU DOSSIER (NAVIGATION CLAIRE EN 4 SECTIONS) */}
              <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-4 shrink-0 gap-1">
                {[
                  { id: 'overview' as const, label: 'Synthèse & Données' },
                  { id: 'samples' as const, label: `Échantillons & Essais (${selectedReqSamples.length})` },
                  { id: 'contract' as const, label: labSettings?.enableQuotes ? 'Revue Contrat & Devis' : 'Revue de Contrat' },
                  { id: 'activity' as const, label: `Discussion & Audit (${(selectedRequest.comments || []).length})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDetailTab(tab.id)}
                    className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                      activeDetailTab === tab.id
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* CORPS DÉFILANT DE L'ONGLET ACTIF */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 min-w-0">

                {/* ====================================================== */}
                {/* ONGLET 1 : SYNTHÈSE, WORKFLOW, DONNÉES & CONCLUSION    */}
                {/* ====================================================== */}
                {activeDetailTab === 'overview' && (
                  <>
                    {/* Actions rapides de transition de statut */}
                    {selectedRequest.status !== 'rejetee' && selectedRequest.status !== 'terminee' ? (
                      <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 space-y-3">
                        <div className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-4 h-4" /> Actions Workflow
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <input
                            type="text"
                            placeholder="Commentaire ou motif (obligatoire en cas de refus)..."
                            value={statusComment}
                            onChange={e => setStatusComment(e.target.value)}
                            className="flex-1 min-w-0 text-xs border-slate-300 rounded-lg bg-white px-3 py-2"
                          />
                          <div className="flex flex-wrap gap-2 shrink-0">
                            {selectedRequest.status === 'soumise' && isManager && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange('En Revue')}
                                className="bg-purple-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-purple-700"
                              >
                                Passer en Revue
                              </button>
                            )}
                            {selectedRequest.status === 'En Revue' && isManager && (
                              <>
                                <button
                                  type="button"
                                  disabled={!statusComment}
                                  onClick={handleReject}
                                  className="bg-red-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Refuser
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange('validee')}
                                  className="bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Valider
                                </button>
                              </>
                            )}
                            {(selectedRequest.status === 'assignee' || selectedRequest.status === 'validee') && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange('En Cours')}
                                className="bg-amber-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-amber-700 flex items-center gap-1"
                              >
                                <PlayCircle className="w-3.5 h-3.5" /> Démarrer
                              </button>
                            )}
                            {selectedRequest.status === 'En Cours' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange('En Validation')}
                                className="bg-orange-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-orange-700 flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Soumettre validation
                              </button>
                            )}
                            {selectedRequest.status === 'En Validation' && isManager && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange('terminee')}
                                className="bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"
                              >
                                <Shield className="w-3.5 h-3.5" /> Libérer (Terminer)
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isManager && (
                      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-amber-900">
                          Ce dossier est clôturé ({selectedRequest.status}).
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStatusChange('En Cours')}
                          className="bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-100 flex items-center gap-1.5"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Réouvrir (En Cours)
                        </button>
                      </div>
                    )}

                    {/* Données Client du Formulaire */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-400" /> Données de la Demande
                        </h4>
                        {isManager && (
                          isEditing ? (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditing(false);
                                  setEditedData(selectedRequest.customData);
                                }}
                                className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateRequestData(selectedRequest.id, { customData: editedData }, 'Modification des données de la demande.');
                                  setSelectedRequest(prev => prev ? { ...prev, customData: editedData } : null);
                                  setIsEditing(false);
                                }}
                                className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
                              >
                                <Save className="w-3 h-3" /> Enregistrer
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsEditing(true)}
                              className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" /> Modifier
                            </button>
                          )
                        )}
                      </div>

                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(selectedRequest.customData).map(([key, value]) => {
                          if (key.endsWith('__material_properties') || key.startsWith('matprop_')) return null;

                          const template = requestTemplates.find(t => t.id === selectedRequest.templateId);
                          const field = template?.fields.find(f => f.id === key);
                          const resolveMaterialName = (idOrName: string) =>
                            materialTemplates.find(m => m.id === idOrName || m.name === idOrName)?.name || idOrName;

                          let displayValue = value;
                          if (typeof value === 'boolean') displayValue = value ? 'Oui' : 'Non';
                          else if (field?.type === 'analyses' && Array.isArray(value)) {
                            displayValue = value.map(id => analysisTemplates.find(a => a.id === id)?.name || id).join(', ');
                          } else if (field?.type === 'materials') {
                            displayValue = Array.isArray(value)
                              ? value.map(resolveMaterialName).join(', ')
                              : resolveMaterialName(String(value));
                          } else if (Array.isArray(value)) {
                            displayValue = value.join(', ');
                          }

                          const selectedMatTemplates = field?.type === 'materials'
                            ? (Array.isArray(value) ? value : [value])
                                .map(v => materialTemplates.find(m => m.id === v || m.name === v))
                                .filter(Boolean)
                            : [];
                          const propertiesKey = `${key}__material_properties`;
                          const materialPropertiesContainer = isEditing
                            ? (editedData[propertiesKey] || {})
                            : (selectedRequest.customData[propertiesKey] || {});
                          const isFullWidth = selectedMatTemplates.length > 0 || field?.type === 'analyses';

                          return (
                            <div
                              key={key}
                              className={`bg-slate-50/80 p-3 rounded-lg border border-slate-100 min-w-0 ${isFullWidth ? 'md:col-span-2' : ''}`}
                            >
                              <dt className="text-[11px] font-semibold text-slate-500 mb-1">{field?.name || key}</dt>
                              <dd className="text-xs text-slate-900 font-medium break-words">
                                {isEditing && field?.type !== 'materials' && field?.type !== 'analyses' ? (
                                  typeof value === 'boolean' ? (
                                    <input
                                      type="checkbox"
                                      checked={editedData[key] || false}
                                      onChange={e => setEditedData({ ...editedData, [key]: e.target.checked })}
                                      className="rounded border-slate-300"
                                    />
                                  ) : Array.isArray(value) ? (
                                    <span className="text-xs text-slate-400 italic">Non modifiable</span>
                                  ) : field?.type === 'date' ? (
                                    <input
                                      type="date"
                                      value={editedData[key] || ''}
                                      onChange={e => setEditedData({ ...editedData, [key]: e.target.value })}
                                      className="w-full text-xs border-slate-300 rounded px-2 py-1"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={editedData[key] || ''}
                                      onChange={e => setEditedData({ ...editedData, [key]: e.target.value })}
                                      className="w-full text-xs border-slate-300 rounded px-2 py-1"
                                    />
                                  )
                                ) : Array.isArray(value) ? (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {value.map(v => (
                                      <span
                                        key={v}
                                        className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
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
                                  displayValue || <span className="text-slate-400 italic">-</span>
                                )}

                                {selectedMatTemplates.length > 0 && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-2">
                                    {selectedMatTemplates.map(matTpl => {
                                      const matPropsForTpl = materialPropertiesContainer[matTpl!.id] || {};
                                      return (
                                        <div key={matTpl!.id} className="bg-white rounded-lg border border-emerald-200 p-2.5 text-xs space-y-1.5">
                                          <span className="font-bold text-emerald-900 uppercase tracking-wider block text-[10px]">
                                            Propriétés — {matTpl!.name}
                                          </span>
                                          {matTpl!.fields.length === 0 ? (
                                            <span className="text-slate-400 italic">Aucune propriété configurée.</span>
                                          ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                              {matTpl!.fields.map(matField => {
                                                const propVal =
                                                  matPropsForTpl[matField.id] ??
                                                  matPropsForTpl[matField.name] ??
                                                  getMaterialPropFromRequest(selectedRequest, matTpl!.id, matField.id, matField.name);
                                                return (
                                                  <div key={matField.id} className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100 gap-2 min-w-0">
                                                    <span className="text-slate-600 truncate">
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
                                                        className="w-28 text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white text-right"
                                                      />
                                                    ) : (
                                                      <span className="font-semibold text-slate-900 text-right truncate">
                                                        {propVal !== undefined && propVal !== '' ? (
                                                          Array.isArray(propVal)
                                                            ? propVal.join(', ')
                                                            : typeof propVal === 'boolean'
                                                              ? (propVal ? 'Oui' : 'Non')
                                                              : `${propVal}${matField.unit ? ` ${matField.unit}` : ''}`
                                                        ) : (
                                                          <span className="text-slate-400 italic font-normal">-</span>
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

                    {/* Conclusion Générale pour les Rapports */}
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-emerald-700" />
                            Conclusion Générale & Avis Technique (Rapport)
                          </h4>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Balise Word : <code className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-200">{"{{demande.conclusion}}"}</code>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            updateRequestData(selectedRequest.id, { conclusion: conclusionText }, 'Mise à jour de la conclusion du rapport');
                            setSelectedRequest(prev => prev ? { ...prev, conclusion: conclusionText } : null);
                          }}
                          className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" /> Enregistrer
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={conclusionText}
                        onChange={e => setConclusionText(e.target.value)}
                        placeholder="Rédigez la conclusion technique et la conformité globale pour le rapport..."
                        className="w-full rounded-lg border border-emerald-300 bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {/* ====================================================== */}
                {/* ONGLET 2 : RÉCEPTION, ÉCHANTILLONS & ESSAIS            */}
                {/* ====================================================== */}
                {activeDetailTab === 'samples' && (
                  <>
                    {(selectedRequest.status === 'validee' || selectedRequest.status === 'assignee' || (selectedRequest.status === 'En Cours' && isManager)) && (
                      <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Box className="w-4 h-4 text-indigo-600" />
                          Réception & Génération d'Échantillons LIMS
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-indigo-900 mb-1">Modèle Matériau</label>
                            <select
                              value={sampleMaterialTemplateId}
                              onChange={e => setSampleMaterialTemplateId(e.target.value)}
                              className="w-full text-xs border-indigo-200 rounded-lg bg-white py-1.5"
                            >
                              {activeMaterialTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-indigo-900 mb-1">État Physique</label>
                            <select
                              value={sampleMaterialState}
                              onChange={e => setSampleMaterialState(e.target.value as any)}
                              className="w-full text-xs border-indigo-200 rounded-lg bg-white py-1.5"
                            >
                              <option value="Massif">Massif</option>
                              <option value="Fritté">Fritté</option>
                              <option value="Poudre">Poudre</option>
                              <option value="Liquide">Liquide</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-indigo-900 mb-1">Priorité</label>
                            <select
                              value={samplePriority}
                              onChange={e => setSamplePriority(e.target.value as 'basse' | 'normale' | 'haute')}
                              className="w-full text-xs border-indigo-200 rounded-lg bg-white py-1.5"
                            >
                              <option value="basse">Basse</option>
                              <option value="normale">Normale</option>
                              <option value="haute">Urgente (Haute)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-indigo-900 mb-1">Quantité</label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={sampleQuantity}
                              onChange={e => setSampleQuantity(Number(e.target.value))}
                              className="w-full text-xs border-indigo-200 rounded-lg bg-white py-1.5 px-2.5"
                            />
                          </div>
                        </div>

                        {(() => {
                          const selectedMatTpl = materialTemplates.find(t => t.id === sampleMaterialTemplateId);
                          if (!selectedMatTpl || selectedMatTpl.fields.length === 0) return null;
                          return (
                            <div className="pt-2.5 border-t border-indigo-200/70">
                              <span className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-2">
                                Propriétés — {selectedMatTpl.name}
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {selectedMatTpl.fields.map(field => (
                                  <div key={field.id}>
                                    <label className="block text-[11px] font-medium text-indigo-900 mb-1">
                                      {field.name} {field.unit ? `(${field.unit})` : ''}
                                    </label>
                                    {field.type === 'select' ? (
                                      <select
                                        value={sampleCustomData[field.name] ?? ''}
                                        onChange={e => setSampleCustomData({ ...sampleCustomData, [field.name]: e.target.value })}
                                        className="w-full text-xs border-indigo-200 rounded-md bg-white px-2 py-1.5"
                                      >
                                        <option value="">-- Sélectionner --</option>
                                        {field.options?.map(opt => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : field.type === 'multiselect' ? (
                                      <div className="flex flex-wrap gap-1">
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
                                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                                isChecked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-indigo-200'
                                              }`}
                                            >
                                              {opt}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : field.type === 'boolean' ? (
                                      <label className="inline-flex items-center gap-2 text-xs text-indigo-900 mt-1">
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
                                        placeholder={field.unit ? `En ${field.unit}...` : 'Saisir...'}
                                        onChange={e => setSampleCustomData({
                                          ...sampleCustomData,
                                          [field.name]: field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                                        })}
                                        className="w-full text-xs border-indigo-200 rounded-md bg-white px-2 py-1.5"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleGenerateSamples}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" /> Générer {sampleQuantity} échantillon(s)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Liste des Échantillons & Analyses rattachés */}
                    {(() => {
                      const activeAnalysisTpls = analysisTemplates.filter(t => t.isActive !== false);
                      const buildLabelPayload = (targetSamples: Sample[]) =>
                        targetSamples.map(s => {
                          const lab = laboratories.find(l => l.id === s.labId);
                          return {
                            sample: s,
                            materialName: materialTemplates.find(m => m.id === s.templateId)?.name || s.templateId,
                            labCode: lab?.code || s.labId?.toUpperCase() || 'LIMS'
                          };
                        });

                      return (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                              <Database className="w-4 h-4 text-slate-400" />
                              Échantillons & Analyses ({selectedReqSamples.length})
                            </h4>
                            {selectedReqSamples.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => printZebraLabelsWindow(buildLabelPayload(selectedReqSamples))}
                                  className="text-xs px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-1.5"
                                >
                                  <Printer className="w-3.5 h-3.5" /> Étiquettes Zebra ({selectedReqSamples.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const zpl = generateZplForSamples(buildLabelPayload(selectedReqSamples));
                                    navigator.clipboard?.writeText(zpl);
                                    alert('Code ZPL copié dans le presse-papiers !');
                                  }}
                                  className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg font-mono font-semibold flex items-center gap-1"
                                >
                                  <QrCode className="w-3.5 h-3.5" /> ZPL
                                </button>
                              </div>
                            )}
                          </div>

                          {selectedReqSamples.length === 0 ? (
                            <div className="text-xs text-slate-400 italic bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
                              Aucun échantillon LIMS généré pour cette demande.
                            </div>
                          ) : (
                            selectedReqSamples.map(sample => {
                              const sampleAnalyses = analyses.filter(a => a.sampleId === sample.id);
                              return (
                                <div key={sample.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                                      <Layers className="w-4 h-4 text-indigo-500" />
                                      <span className="font-mono font-bold">{sample.id}</span>
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-mono text-[11px]">
                                        {sample.barcode}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => printZebraLabelsWindow(buildLabelPayload([sample]))}
                                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 flex items-center gap-1 text-[11px]"
                                      >
                                        <Printer className="w-3 h-3" /> Étiquette
                                      </button>
                                    </div>
                                    {isManager && (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAddingAnalysisForSample(addingAnalysisForSample === sample.id ? null : sample.id);
                                            setSelectedNewAnalysisTplId(activeAnalysisTpls[0]?.id || '');
                                          }}
                                          className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-semibold flex items-center gap-1"
                                        >
                                          <Plus className="w-3.5 h-3.5" /> Analyse
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (window.confirm(`Supprimer l'échantillon ${sample.id} et toutes ses analyses associées ?`)) {
                                              deleteSample(sample.id);
                                            }
                                          }}
                                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                          title="Supprimer cet échantillon"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {isManager && addingAnalysisForSample === sample.id && (
                                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg flex flex-wrap items-center gap-2">
                                      <select
                                        value={selectedNewAnalysisTplId}
                                        onChange={e => setSelectedNewAnalysisTplId(e.target.value)}
                                        className="text-xs border-indigo-200 rounded-md py-1.5 px-2 bg-white flex-1 min-w-[180px]"
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
                                          const isAssignedQualified = isUserQualifiedForTemplate(
                                            selectedRequest.assignedTo,
                                            selectedNewAnalysisTplId
                                          );
                                          const assignedUser = selectedRequest.assignedTo
                                            ? users.find(u => u.id === selectedRequest.assignedTo)
                                            : null;
                                          if (assignedUser && !isAssignedQualified) {
                                            const tplName = analysisTemplates.find(t => t.id === selectedNewAnalysisTplId)?.name || selectedNewAnalysisTplId;
                                            setAssignError(
                                              `L'essai "${tplName}" a été créé sans technicien car ${assignedUser.name} ne dispose pas de cette habilitation.`
                                            );
                                          }
                                          addAnalysis({
                                            id: newAnalysisId,
                                            labId: selectedRequest.labId || activeLabId,
                                            sampleId: sample.id,
                                            templateId: selectedNewAnalysisTplId,
                                            status: 'planifie',
                                            technician: isAssignedQualified && assignedUser ? assignedUser.name : 'Non assigné',
                                            updatedAt: new Date().toISOString(),
                                            results: {},
                                            images: []
                                          });
                                          setAddingAnalysisForSample(null);
                                        }}
                                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700"
                                      >
                                        Ajouter
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAddingAnalysisForSample(null)}
                                        className="text-xs px-2 py-1.5 text-slate-600 hover:bg-slate-200 rounded-md"
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
                                          <div key={analysis.id} className="flex items-center text-xs border border-slate-200/80 rounded-lg bg-slate-50 px-3 py-2 gap-2 min-w-0">
                                            <TestTube2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <div className="truncate flex-1 min-w-0">
                                              <span className="font-semibold text-slate-800">{tpl?.name || analysis.id}</span>
                                              <span className="ml-1.5 text-[10px] font-mono text-slate-400">({analysis.id})</span>
                                            </div>
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                              analysis.status === 'rejete'
                                                ? 'bg-red-50 border-red-200 text-red-700'
                                                : 'bg-white border-slate-200 text-slate-500'
                                            }`}>
                                              {analysis.status}
                                            </span>
                                            {isManager && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (window.confirm(`Supprimer l'analyse ${analysis.id} ?`)) {
                                                    deleteAnalysis(analysis.id);
                                                  }
                                                }}
                                                className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 shrink-0"
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
                            })
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ====================================================== */}
                {/* ONGLET 3 : REVUE DE CONTRAT ISO 17025 & DEVIS PDF      */}
                {/* ====================================================== */}
                {activeDetailTab === 'contract' && (
                  <div className="space-y-4">
                    {/* Synthèse estimation / valorisation */}
                    {(() => {
                      const reqAnas = analyses.filter(a => selectedReqSamples.some(s => s.id === a.sampleId));
                      const totalCost = reqAnas.reduce((sum, a) => sum + (analysisTemplates.find(t => t.id === a.templateId)?.unitPrice || 0), 0) || selectedRequest.estimatedCost || 0;
                      const estHours = selectedRequest.estimatedHours || reqAnas.reduce((sum, a) => sum + (analysisTemplates.find(t => t.id === a.templateId)?.estimatedHours || 2), 0);
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="text-[10px] font-bold uppercase text-slate-500">Échantillons déclarés</div>
                            <div className="text-lg font-bold text-slate-900 mt-0.5">{selectedRequest.sampleCount || selectedReqSamples.length || 1}</div>
                          </div>
                          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200">
                            <div className="text-[10px] font-bold uppercase text-blue-700">Durée estimée</div>
                            <div className="text-lg font-bold text-blue-900 mt-0.5">~{estHours} h</div>
                          </div>
                          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                            <div className="text-[10px] font-bold uppercase text-emerald-700">Valorisation estimée</div>
                            <div className="text-lg font-bold text-emerald-900 mt-0.5">{totalCost.toLocaleString('fr-FR')} € HT</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Revue de contrat ISO 17025 §7.1 */}
                    <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                          Revue de Demande / Contrat (ISO/IEC 17025 §7.1)
                        </h4>
                        {selectedRequest.contractReview && (
                          <p className="text-xs text-indigo-700 mt-0.5">
                            Validée par <strong>{selectedRequest.contractReview.reviewedBy}</strong> le {new Date(selectedRequest.contractReview.reviewedAt).toLocaleDateString('fr-FR')}
                            {selectedRequest.committedDueDate ? ` • Échéance engagée : ${new Date(selectedRequest.committedDueDate).toLocaleDateString('fr-FR')}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <label className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-indigo-100">
                          <input type="checkbox" disabled={!isManager} checked={reviewMethodsOk} onChange={e => setReviewMethodsOk(e.target.checked)} className="rounded text-indigo-600" />
                          Méthodes d'essais adaptées
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-indigo-100">
                          <input type="checkbox" disabled={!isManager} checked={reviewResourcesOk} onChange={e => setReviewResourcesOk(e.target.checked)} className="rounded text-indigo-600" />
                          Moyens & équipements disponibles
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-indigo-100">
                          <input type="checkbox" disabled={!isManager} checked={reviewStaffOk} onChange={e => setReviewStaffOk(e.target.checked)} className="rounded text-indigo-600" />
                          Personnel habilité disponible
                        </label>
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                          <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1">Date d'échéance engagée</label>
                          <input
                            type="date"
                            disabled={!isManager}
                            value={committedDateDraft || selectedRequest.committedDueDate || ''}
                            onChange={e => setCommittedDateDraft(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-indigo-300 rounded bg-white"
                          />
                        </div>
                      </div>
                      {isManager && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              saveContractReview(
                                selectedRequest.id,
                                { methodsAdequate: reviewMethodsOk, resourcesAvailable: reviewResourcesOk, staffQualified: reviewStaffOk },
                                committedDateDraft || selectedRequest.committedDueDate || undefined
                              );
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
                          >
                            Enregistrer la revue de contrat
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Option Devis PDF Commercial (uniquement si activé dans Paramètres → Laboratoire) */}
                    {isManager && labSettings?.enableQuotes && (
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                              Devis Commercial (Optionnel){selectedRequest.quoteNumber ? ` — ${selectedRequest.quoteNumber}` : ''}
                            </h4>
                            <p className="text-xs text-emerald-800 mt-0.5">
                              {selectedRequest.quoteGeneratedAt
                                ? `Dernier devis généré le ${new Date(selectedRequest.quoteGeneratedAt).toLocaleDateString('fr-FR')}`
                                : 'Aucun devis PDF généré pour ce dossier.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateQuotePdf(selectedRequest)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                          >
                            Générer Devis PDF
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-emerald-900 mb-1">Statut du devis</label>
                            <select
                              value={selectedRequest.quoteStatus || 'aucun'}
                              onChange={e => {
                                const nextSt = e.target.value as NonNullable<AnalysisRequest['quoteStatus']>;
                                updateRequestData(selectedRequest.id, { quoteStatus: nextSt }, `Statut devis passé à : ${nextSt}`);
                              }}
                              className="w-full text-xs border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
                            >
                              <option value="aucun">Non émis</option>
                              <option value="genere">Devis généré</option>
                              <option value="envoye">Envoyé au client</option>
                              <option value="approuve">Accord / BC reçu ✓</option>
                              <option value="refuse">Devis refusé</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-emerald-900 mb-1">N° Bon de commande client</label>
                            <input
                              type="text"
                              placeholder="Ex: BC-2026-0412"
                              defaultValue={selectedRequest.purchaseOrderRef || ''}
                              onBlur={e => {
                                if (e.target.value !== (selectedRequest.purchaseOrderRef || '')) {
                                  updateRequestData(selectedRequest.id, { purchaseOrderRef: e.target.value }, `Bon de commande renseigné : ${e.target.value}`);
                                }
                              }}
                              className="w-full text-xs border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ====================================================== */}
                {/* ONGLET 4 : FIL DE DISCUSSION & AUDIT TRAIL             */}
                {/* ====================================================== */}
                {activeDetailTab === 'activity' && (
                  <div className="space-y-5">
                    {/* Fil de discussion */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Fil de discussion ({(selectedRequest.comments || []).length})
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(selectedRequest.comments || []).length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Aucun échange pour le moment.</p>
                        ) : (
                          (selectedRequest.comments || []).map(c => (
                            <div key={c.id} className={`p-3 rounded-lg text-xs border ${c.isInternal ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 mb-1">
                                <span className="font-semibold text-slate-800">
                                  {c.authorName} <span className="uppercase text-[10px] text-slate-400">({c.authorRole})</span>
                                  {c.isInternal && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[9px] font-bold">NOTE INTERNE</span>}
                                </span>
                                <span>{new Date(c.createdAt).toLocaleString('fr-FR')}</span>
                              </div>
                              <p className="text-slate-700 whitespace-pre-wrap break-words">{c.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          value={newCommentText}
                          onChange={e => setNewCommentText(e.target.value)}
                          placeholder="Écrire un message au client ou une note interne..."
                          className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                        />
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 px-2 shrink-0">
                          <input type="checkbox" checked={isInternalComment} onChange={e => setIsInternalComment(e.target.checked)} className="rounded text-amber-600" />
                          Interne
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newCommentText.trim()) return;
                            addRequestComment(selectedRequest.id, newCommentText, isInternalComment);
                            setNewCommentText('');
                          }}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 shrink-0"
                        >
                          Envoyer
                        </button>
                      </div>
                    </div>

                    {/* Piste d'Audit ISO 17025 / 21 CFR Part 11 */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="w-4 h-4 text-slate-400" />
                          Piste d'Audit ({(selectedRequest.auditTrail || []).length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAudit(!showAudit)}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          {showAudit ? 'Réduire' : 'Tout afficher'}
                        </button>
                      </div>
                      <div className="relative border-l-2 border-slate-200 ml-2.5 space-y-4 pt-1">
                        {selectedRequest.auditTrail && selectedRequest.auditTrail.length > 0 ? (
                          (showAudit ? selectedRequest.auditTrail : selectedRequest.auditTrail.slice(0, 5)).map((audit, i) => {
                            const user = users.find(u => u.id === audit.userId);
                            return (
                              <div key={audit.id || i} className="relative pl-4">
                                <div className="absolute w-2.5 h-2.5 bg-blue-500 rounded-full -left-[6px] top-1 ring-4 ring-white" />
                                <div className="text-[11px] text-slate-400">{formatDate(audit.timestamp)} • {user?.name || audit.userId}</div>
                                <div className="text-xs font-semibold text-slate-800">{audit.action}</div>
                                <div className="text-xs text-slate-600 mt-0.5 break-words">{audit.details}</div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-400 italic pl-4">Aucun événement d'audit enregistré.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
              <FileText className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Sélectionnez une demande dans la liste de gauche</p>
              <p className="text-xs text-slate-400 mt-1">Consultez ses données, échantillons, revue de contrat et historique.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}