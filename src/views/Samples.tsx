/**
 * Vue Gestion des Échantillons & Préparations Métallographiques (Samples)
 * 
 * Cette vue assure le suivi physique des éprouvettes et pièces reçues au laboratoire :
 * 1. Visualisation tabulaire avec bascule "Échantillons en cours" vs "Historique (Terminés / Non conformes)"
 * 2. Moteur de recherche multicritères (Nuance, Code-barres, Référence client, N° Demande)
 * 3. Panneau latéral d'inspection détaillée :
 *    - Stepper interactif d'avancement (Réceptionné -> Préparation -> En essai -> Terminé)
 *    - Filiation et traçabilité (lien vers la demande parente et échantillons découpés)
 *    - Paramètres de métallographie (enrobage à chaud/froid, résine, polissage, attaque chimique Nital/Kalling)
 *    - Sous-échantillonnage et découpe (génération automatisée d'enrobages ENR-xx)
 *    - Galerie micrographique et macrographique rattachée
 *    - Suivi des essais rattachés à l'échantillon
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { Search, Filter, MoreHorizontal, FlaskConical, Link as LinkIcon, Image as ImageIcon, X, Plus } from 'lucide-react';
import { Sample, SampleStatus } from '../types';

export function Samples() {
  const {
    samples,
    requests,
    materialTemplates,
    addSampleImage,
    updateSampleStatus,
    updateSampleMounting,
    globalSearchQuery,
    addSample,
    labSettings,
    analyses,
    analysisTemplates,
    currentUser
  } = useLims();

  // États locaux de recherche et de navigation
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<SampleStatus | 'all'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // États d'édition métallographique et découpe
  const [isEditingMounting, setIsEditingMounting] = useState(false);
  const [mountingData, setMountingData] = useState<Sample['mountingInfo']>();
  const [isCreatingEnrobage, setIsCreatingEnrobage] = useState(false);
  const [enrobageCount, setEnrobageCount] = useState(2);

  // Onglets actifs
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'pending' | 'history'>('pending');
  const [activeMainTab, setActiveMainTab] = useState<'pending' | 'history'>('pending');

  /**
   * Filtrage combiné : recherche globale, recherche locale, statut et statut d'archivage
   */
  const filteredSamples = samples.filter(s => {
    // Filtre global transverse
    if (globalSearchQuery) {
      const q = globalSearchQuery.toLowerCase();
      const matchesGlobal = s.id.toLowerCase().includes(q) ||
      (s.barcode && s.barcode.toLowerCase().includes(q)) ||
        s.client.toLowerCase().includes(q) ||
        s.project.toLowerCase().includes(q) ||
        (s.requestId && s.requestId.toLowerCase().includes(q));
      if (!matchesGlobal) return false;
    }

    // Filtre textuel local
    const qLocal = searchTerm.toLowerCase();
    const matchesSearch = s.id.toLowerCase().includes(qLocal) ||
      (s.barcode && s.barcode.toLowerCase().includes(qLocal)) || // <-- Ajout ici
      s.client.toLowerCase().includes(qLocal) ||
      s.project.toLowerCase().includes(qLocal) ||
      (s.requestId && s.requestId.toLowerCase().includes(qLocal));

    // Filtre par statut spécifique
    const matchesFilter = filterStatus === 'all' || s.status === filterStatus;

    // Séparation en-cours / historique
    const isHistory = s.status === 'termine' || s.status === 'non_conforme';
    const matchesMainTab = activeMainTab === 'pending' ? !isHistory : isHistory;

    return matchesSearch && matchesFilter && matchesMainTab;
  });

  /**
   * Ajout d'une micrographie de démonstration pour illustrer le raccordement optique
   */
  const handleMockImageAdd = (sampleId: string) => {
    const mockImages = [
      'https://images.unsplash.com/photo-1582719202047-76d3332be339?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1532153259564-839352618dd2?auto=format&fit=crop&q=80&w=400',
      'https://images.unsplash.com/photo-1614935151651-0bea6508abb0?auto=format&fit=crop&q=80&w=400',
    ];
    const randomImg = mockImages[Math.floor(Math.random() * mockImages.length)];
    addSampleImage(sampleId, randomImg);

    if (selectedSample && selectedSample.id === sampleId) {
      setSelectedSample({ ...selectedSample, images: [...selectedSample.images, randomImg] });
    }
  };

  /**
   * Rendu visuel du badge de statut d'échantillon
   */
  const getStatusBadge = (status: SampleStatus) => {
    switch (status) {
      case 'receptionne':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Réceptionné</span>;
      case 'en_preparation':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">En préparation / Enrobage</span>;
      case 'en_essai':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">En essai / Métallo</span>;
      case 'termine':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Terminé</span>;
      case 'non_conforme':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Non Conforme</span>;
    }
  };

  /**
   * Rendu du badge de priorité
   */
  const getPriorityBadge = (priority: string) => {
    if (priority === 'haute') return <span className="text-red-600 font-medium text-xs">Urgente</span>;
    if (priority === 'basse') return <span className="text-slate-500 font-medium text-xs">Basse</span>;
    return <span className="text-slate-700 font-medium text-xs">Normale</span>;
  };

  /**
   * Formatage standard de date
   */
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  };

  /**
   * Résolution du libellé d'un modèle d'essai
   */
  const getAnalysisName = (templateId: string) => {
    return analysisTemplates.find(t => t.id === templateId)?.name || templateId;
  };

  /**
   * Résolution du libellé d'un modèle de matériau
   */
  const getTemplateName = (templateId: string) => {
    return materialTemplates.find(t => t.id === templateId)?.name || templateId;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Échantillons & Préparations</h2>
          <p className="text-sm text-slate-500 mt-1">Gérés depuis le workflow des demandes d'analyse.</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Volet principal : Tableau des échantillons */}
        <div className={`bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden transition-all duration-300 ${selectedSample ? 'lg:w-2/3 hidden lg:flex' : 'w-full'}`}>
          {/* En-tête des onglets d'état */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setActiveMainTab('pending')}
              className={`flex-1 py-3 text-sm font-bold ${activeMainTab === 'pending' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
            >
              Échantillons en cours
            </button>
            <button
              onClick={() => setActiveMainTab('history')}
              className={`flex-1 py-3 text-sm font-bold ${activeMainTab === 'history' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
            >
              Historique (Terminés)
            </button>
          </div>

          {/* Barre d'outils et filtres */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <div className="relative w-full sm:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher (Nuance, Composition, Client)..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center px-4 py-2 bg-white border ${filterStatus !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-slate-300 text-slate-700'} rounded-lg text-sm font-medium hover:bg-slate-50`}
              >
                <Filter className={`w-4 h-4 mr-2 ${filterStatus !== 'all' ? 'text-blue-500' : 'text-slate-500'}`} />
                {filterStatus !== 'all' ? 'Filtre actif' : 'Filtrer'}
              </button>
              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 shadow-lg rounded-lg z-50 overflow-hidden flex flex-col text-left">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">Filtrer par statut</div>
                  <button onClick={() => { setFilterStatus('all'); setIsFilterOpen(false); }} className={`px-4 py-2 text-sm text-left hover:bg-slate-50 ${filterStatus === 'all' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>Tous les statuts</button>
                  <button onClick={() => { setFilterStatus('receptionne'); setIsFilterOpen(false); }} className={`px-4 py-2 text-sm text-left hover:bg-slate-50 ${filterStatus === 'receptionne' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>Réceptionné</button>
                  <button onClick={() => { setFilterStatus('en_preparation'); setIsFilterOpen(false); }} className={`px-4 py-2 text-sm text-left hover:bg-slate-50 ${filterStatus === 'en_preparation' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>En préparation</button>
                  <button onClick={() => { setFilterStatus('en_essai'); setIsFilterOpen(false); }} className={`px-4 py-2 text-sm text-left hover:bg-slate-50 ${filterStatus === 'en_essai' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>En essai</button>
                  <button onClick={() => { setFilterStatus('termine'); setIsFilterOpen(false); }} className={`px-4 py-2 text-sm text-left hover:bg-slate-50 ${filterStatus === 'termine' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>Terminé</button>
                  <button onClick={() => { setFilterStatus('non_conforme'); setIsFilterOpen(false); }} className={`px-4 py-2 text-sm text-left hover:bg-slate-50 ${filterStatus === 'non_conforme' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}>Non Conforme</button>
                </div>
              )}
            </div>
          </div>

          {/* Tableau des lignes d'échantillons */}
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID / Code-Barres</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Demande Associée</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Matériau & État</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut Prep.</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredSamples.map((sample) => (
                  <tr
                    key={sample.id}
                    onClick={() => setSelectedSample(sample)}
                    className={`cursor-pointer transition-colors ${selectedSample?.id === sample.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{sample.id}</span>
                          {getPriorityBadge(sample.priority)}
                        </div>
                        <span className="text-xs text-slate-500 font-mono mt-0.5">{sample.barcode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center text-sm font-medium text-slate-900">
                          {sample.requestId ? (
                            <>
                              <LinkIcon className="w-3 h-3 mr-1 text-blue-500" />
                              {sample.requestId}
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Indépendant</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{sample.project}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FlaskConical className="w-4 h-4 text-slate-400 mr-2" />
                        <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200 font-medium">
                          {getTemplateName(sample.templateId)} ({sample.materialState})
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(sample.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {sample.status === 'receptionne' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSampleStatus(sample.id, 'en_preparation');
                            if (selectedSample?.id === sample.id) setSelectedSample({ ...selectedSample, status: 'en_preparation' });
                          }}
                          className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
                        >
                          Préparer
                        </button>
                      )}
                      {sample.status === 'en_preparation' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSampleStatus(sample.id, 'en_essai');
                            if (selectedSample?.id === sample.id) setSelectedSample({ ...selectedSample, status: 'en_essai' });
                          }}
                          className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
                        >
                          Passer en essai
                        </button>
                      )}
                      {sample.status === 'en_essai' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSampleStatus(sample.id, 'termine');
                            if (selectedSample?.id === sample.id) setSelectedSample({ ...selectedSample, status: 'termine' });
                          }}
                          className="text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
                        >
                          Terminer
                        </button>
                      )}
                      {(sample.status === 'termine' || sample.status === 'non_conforme') && (
                        <span className="text-xs text-slate-400 font-medium px-3 py-1.5">Clôturé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Volet latéral d'inspection détaillée */}
        {selectedSample && (
          <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden animate-in slide-in-from-right-4">

            <div className="bg-white border-b border-slate-200 p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Détails Échantillon</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {selectedSample.id}
                    {selectedSample.parentSampleId && (
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded-md">
                        Découpé de {selectedSample.parentSampleId}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSample(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stepper de progression normé */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progression / Statut</h4>
                <div className="flex items-center gap-1">
                  {['receptionne', 'en_preparation', 'en_essai', 'termine'].map((step, index) => {
                    const stepLabels: Record<string, string> = {
                      'receptionne': 'Réceptionné',
                      'en_preparation': 'Préparation',
                      'en_essai': 'En essai',
                      'termine': 'Terminé'
                    };
                    const statusOrder = ['receptionne', 'en_preparation', 'en_essai', 'termine'];
                    const currentIndex = statusOrder.indexOf(selectedSample.status);

                    let stateClass = "bg-slate-200 text-slate-500 border border-slate-300";
                    let isClickable = false;

                    if (selectedSample.status === 'non_conforme') {
                      stateClass = "bg-red-50 border border-red-200 text-red-500";
                    } else if (index < currentIndex) {
                      stateClass = "bg-blue-100 border border-blue-200 text-blue-700";
                      isClickable = true;
                    } else if (index === currentIndex) {
                      stateClass = "bg-blue-600 border border-blue-600 text-white font-bold shadow-sm";
                    } else if (index === currentIndex + 1) {
                      stateClass = "bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 cursor-pointer border-dashed";
                      isClickable = true;
                    }

                    if ((currentUser?.role === 'manager' || currentUser?.role === 'admin') && index !== currentIndex) {
                      isClickable = true;
                      if (!stateClass.includes('hover:')) {
                        stateClass += " hover:bg-slate-100 cursor-pointer";
                      }
                    }

                    return (
                      <React.Fragment key={step}>
                        <button
                          onClick={() => {
                            if (isClickable) {
                              updateSampleStatus(selectedSample.id, step as SampleStatus);
                              setSelectedSample({ ...selectedSample, status: step as SampleStatus });
                            }
                          }}
                          disabled={!isClickable && index !== currentIndex}
                          className={`flex-1 py-1.5 px-2 text-[10px] md:text-xs rounded-md transition-all text-center ${stateClass}`}
                        >
                          {stepLabels[step]}
                        </button>
                        {index < 3 && <div className="w-2 h-px bg-slate-300 shrink-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>
                {selectedSample.status !== 'non_conforme' && selectedSample.status !== 'termine' && (
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => {
                        updateSampleStatus(selectedSample.id, 'non_conforme');
                        setSelectedSample({ ...selectedSample, status: 'non_conforme' });
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700 hover:underline font-medium"
                    >
                      Marquer Non Conforme
                    </button>
                  </div>
                )}
                {selectedSample.status === 'non_conforme' && (
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => {
                        updateSampleStatus(selectedSample.id, 'receptionne');
                        setSelectedSample({ ...selectedSample, status: 'receptionne' });
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-700 hover:underline font-medium"
                    >
                      Annuler la non-conformité
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Informations Générales & Traçabilité */}
              <section>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Informations de base</h4>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div className="col-span-2">
                    <span className="block text-slate-500 text-xs">Demande Associée</span>
                    <span className="font-medium text-slate-900 flex items-center">
                      {selectedSample.requestId ? (
                        <>
                          <LinkIcon className="w-3 h-3 mr-1 text-blue-500" />
                          {selectedSample.requestId}
                        </>
                      ) : (
                        'N/A'
                      )}
                    </span>
                  </div>
                  <div><span className="block text-slate-500 text-xs">Client</span><span className="font-medium text-slate-900 truncate block">{selectedSample.client}</span></div>
                  <div><span className="block text-slate-500 text-xs">Projet</span><span className="font-medium text-slate-900 truncate block">{selectedSample.project}</span></div>
                  <div><span className="block text-slate-500 text-xs">Date de réception</span><span className="font-medium text-slate-900">{formatDate(selectedSample.receivedAt)}</span></div>
                  <div><span className="block text-slate-500 text-xs">Priorité</span><span className="font-medium">{getPriorityBadge(selectedSample.priority)}</span></div>
                  <div className="col-span-2"><span className="block text-slate-500 text-xs">Type de Matériau</span><span className="font-medium text-slate-900">{getTemplateName(selectedSample.templateId)} - {selectedSample.materialState}</span></div>
                </div>
              </section>

              {/* Attributs Métier Personnalisés (CMS) reliés au MaterialTemplate */}
              <section>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Propriétés Matériau</h4>
                <div className="space-y-2">
                  {(() => {
                    // 1. On récupère le modèle de matériau associé à l'échantillon
                    const matTemplate = materialTemplates.find(t => t.id === selectedSample.templateId);
                    const templateFields = matTemplate?.fields || [];
                    const customData = selectedSample.customData || {};

                    // 2. Si le modèle possède des champs définis, on les affiche tous
                    if (templateFields.length > 0) {
                      return templateFields.map((field) => {
                        // On cherche la valeur par ID du champ ou par nom du champ
                        const value = customData[field.id] !== undefined ? customData[field.id] : customData[field.name];

                        return (
                          <div key={field.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                            <span className="text-slate-600">
                              {field.name} {field.unit ? <span className="text-xs text-slate-400">({field.unit})</span> : ''}
                            </span>
                            <span className="font-medium text-slate-900 text-right">
                              {value === undefined || value === null || value === '' ? (
                                <span className="text-slate-400 italic text-xs">Non renseigné</span>
                              ) : Array.isArray(value) ? (
                                <div className="flex flex-wrap gap-1.5 justify-end mt-1 sm:mt-0">
                                  {value.map(v => (
                                    <span key={v} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-medium">
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              ) : typeof value === 'boolean' ? (
                                value ? 'Oui' : 'Non'
                              ) : (
                                `${value}${field.unit ? ` ${field.unit}` : ''}`
                              )}
                            </span>
                          </div>
                        );
                      });
                    }

                    // 3. Fallback : s'il n'y a pas de champs dans le modèle mais qu'il y a des données dans customData
                    const entries = Object.entries(customData);
                    if (entries.length === 0) {
                      return (
                        <div className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                          Aucune propriété définie pour ce matériau.
                        </div>
                      );
                    }

                    return entries.map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
                        <span className="text-slate-600 capitalize">{key.replace('_', ' ')}</span>
                        <span className="font-medium text-slate-900 text-right">
                          {Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : value}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </section>

              {/* Fiche de Préparation Métallographique */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Préparation Métallographique</h4>
                  {isEditingMounting ? (
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingMounting(false)} className="text-xs text-slate-500 font-medium hover:underline">Annuler</button>
                      <button onClick={() => {
                        if (mountingData) {
                          updateSampleMounting(selectedSample.id, mountingData);
                          setSelectedSample({ ...selectedSample, mountingInfo: mountingData });
                        }
                        setIsEditingMounting(false);
                      }} className="text-xs text-blue-600 font-medium hover:underline">Sauvegarder</button>
                    </div>
                  ) : (
                    <button onClick={() => {
                      setMountingData(selectedSample.mountingInfo || { method: 'A chaud', resinType: '', diameter: 30, polishingSteps: [], etching: '' });
                      setIsEditingMounting(true);
                    }} className="text-xs text-blue-600 font-medium hover:underline">Modifier</button>
                  )}
                </div>
                {isEditingMounting && mountingData ? (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Méthode</label>
                      <select value={mountingData.method} onChange={e => setMountingData({ ...mountingData, method: e.target.value as any })} className="w-full text-sm border-slate-300 rounded px-2 py-1">
                        <option value="A chaud">A chaud</option>
                        <option value="A froid">A froid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Résine</label>
                      <input type="text" value={mountingData.resinType} onChange={e => setMountingData({ ...mountingData, resinType: e.target.value })} className="w-full text-sm border-slate-300 rounded px-2 py-1" placeholder="Ex: Phénolique..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Diamètre (mm)</label>
                      <input type="number" value={mountingData.diameter} onChange={e => setMountingData({ ...mountingData, diameter: Number(e.target.value) })} className="w-full text-sm border-slate-300 rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Attaque chimique</label>
                      <input type="text" value={mountingData.etching || ''} onChange={e => setMountingData({ ...mountingData, etching: e.target.value })} className="w-full text-sm border-slate-300 rounded px-2 py-1" placeholder="Ex: Nital 3%..." />
                    </div>
                  </div>
                ) : selectedSample.mountingInfo ? (
                  <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100 text-sm">
                    <div className="mb-2"><span className="font-semibold text-indigo-900">Méthode :</span> {selectedSample.mountingInfo.method}</div>
                    <div className="mb-2"><span className="font-semibold text-indigo-900">Résine :</span> {selectedSample.mountingInfo.resinType} (Ø{selectedSample.mountingInfo.diameter}mm)</div>
                    <div className="mb-2"><span className="font-semibold text-indigo-900">Polissage :</span> {selectedSample.mountingInfo.polishingSteps?.join(' ➔ ') || 'Standard'}</div>
                    {selectedSample.mountingInfo.etching && <div><span className="font-semibold text-indigo-900">Attaque :</span> {selectedSample.mountingInfo.etching}</div>}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                    Aucune préparation métallographique définie.
                  </div>
                )}
              </section>

              {/* Galerie Optique & Microscopie */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Imagerie (Macro/Micro)</h4>
                  <button onClick={() => handleMockImageAdd(selectedSample.id)} className="text-xs text-blue-600 font-medium flex items-center hover:underline">
                    <Plus className="w-3 h-3 mr-1" /> Ajouter
                  </button>
                </div>
                {selectedSample.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedSample.images.map((img, i) => (
                      <div key={i} className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                        <img src={img} alt={`Microscope view ${i}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="w-6 h-6 mb-2" />
                    <span className="text-xs">Aucune image stockée</span>
                  </div>
                )}
              </section>
            </div>

            {/* Pied de panneau : Découpe en sous-échantillons et Essais rattachés */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
              {isCreatingEnrobage ? (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <label className="block text-xs font-semibold text-indigo-900 mb-2">Nombre d'enrobages à créer :</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={enrobageCount}
                      onChange={(e) => setEnrobageCount(parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-1.5 border border-indigo-200 rounded-md text-sm font-medium focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={() => {
                        const num = enrobageCount;
                        if (num > 0) {
                          const prefix = labSettings?.idPrefixes?.subSample || 'ENR';
                          const parentIdBase = selectedSample.id.split('-').slice(1).join('-');
                          for (let i = 1; i <= num; i++) {
                            const newId = `${prefix}-${parentIdBase}-${i}`;
                            const subSample = {
                              ...selectedSample,
                              id: newId,
                              barcode: `${selectedSample.barcode}-${i}`,
                              parentSampleId: selectedSample.id,
                              images: [],
                              mountingInfo: undefined,
                              status: 'receptionne' as const,
                              receivedAt: new Date().toISOString()
                            };
                            addSample(subSample);
                          }
                          setIsCreatingEnrobage(false);
                        }
                      }}
                      className="flex-1 bg-indigo-600 text-white py-1.5 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setIsCreatingEnrobage(false)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingEnrobage(true)}
                  className="w-full flex justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm items-center shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" /> Créer Enrobages (Découpe)
                </button>
              )}

              {(selectedSample.status === 'en_essai' || selectedSample.status === 'termine') && (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col mt-4">
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => setActiveAnalysisTab('pending')}
                      className={`flex-1 py-2 text-xs font-bold ${activeAnalysisTab === 'pending' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      Essais en cours
                    </button>
                    <button
                      onClick={() => setActiveAnalysisTab('history')}
                      className={`flex-1 py-2 text-xs font-bold ${activeAnalysisTab === 'history' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      Historique (Terminés)
                    </button>
                  </div>
                  <div className="p-0 bg-white max-h-48 overflow-y-auto">
                    {(() => {
                      const sampleAnalyses = analyses.filter(a => a.sampleId === selectedSample.id);
                      const displayed = activeAnalysisTab === 'pending'
                        ? sampleAnalyses.filter(a => a.status !== 'terminee')
                        : sampleAnalyses.filter(a => a.status === 'terminee');

                      if (displayed.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-slate-500 italic">
                            Aucun essai {activeAnalysisTab === 'pending' ? 'en cours' : 'terminé'}.
                          </div>
                        );
                      }

                      return displayed.map((analysis) => (
                        <div key={analysis.id} className="p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex justify-between items-center">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{getAnalysisName(analysis.templateId)}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{analysis.id}</div>
                          </div>
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${analysis.status === 'valide' || analysis.status === 'termine' ? 'bg-emerald-100 text-emerald-800' :
                                analysis.status === 'En Cours' || analysis.status === 'en_cours' ? 'bg-blue-100 text-blue-800' :
                                  analysis.status === 'a_valider' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                              {analysis.status === 'valide' || analysis.status === 'termine' ? 'Terminé' :
                                analysis.status === 'En Cours' || analysis.status === 'en_cours' ? 'En cours' :
                                  analysis.status === 'a_valider' ? 'À valider' : 'Planifié'}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
