/**
 * Portail Demandeur Multi-Laboratoires (Espace Client Unifié)
 * 
 * Cette vue unique permet aux donneurs d'ordre et demandeurs externes :
 * 1. De visualiser en un seul endroit toutes leurs demandes d'analyses, tous laboratoires confondus
 * 2. De filtrer leurs dossiers par laboratoire destinataire (Métallographie vs Mécanique)
 * 3. De soumettre de nouvelles demandes directement vers le laboratoire de leur choix
 * 4. De suivre en direct l'avancement technique et les motifs d'éventuels refus
 * 5. De télécharger les procès-verbaux et rapports d'essais validés
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { Plus, Clock, FileText, CheckCircle, Package, AlertCircle, Settings as SettingsIcon, Building2, Filter, Download } from 'lucide-react';
import { RequestStatus, AnalysisRequest } from '../types';
import { NewRequestModal } from '../components/NewRequestModal';
import { EditRequestModal } from '../components/EditRequestModal';

export function RequesterPortal({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { currentUser, requests, allRequestTemplates, laboratories } = useLims();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<AnalysisRequest | null>(null);
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>('all');

  // Filtrage strict des demandes rattachées au demandeur connecté
  const myRequests = requests.filter(r => r.requesterId === currentUser?.id);

  // Filtrage par laboratoire
  const filteredRequests = myRequests.filter(req => {
    if (selectedLabFilter === 'all') return true;
    return req.labId === selectedLabFilter;
  });

  /**
   * Badges de statut visuels pour le demandeur
   */
  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'brouillon': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Brouillon</span>;
      case 'soumise': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Soumise</span>;
      case 'En Revue': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">En revue</span>;
      case 'validee': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Validée</span>;
      case 'assignee': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">Prise en charge</span>;
      case 'En Cours': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Analyse en cours</span>;
      case 'En Validation': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Contrôle Qualité</span>;
      case 'terminee': 
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Rapport disponible</span>;
      case 'rejetee': 
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <AlertCircle className="w-3.5 h-3.5 mr-1" /> Rejetée
          </span>
        );
    }
  };

  /**
   * Badge identifiant le laboratoire traitant
   */
  const getLabBadge = (labId?: string) => {
    const labIndex = laboratories.findIndex(l => l.id === labId);
    const lab = laboratories[labIndex];
    if (!lab) return null;
    const isPrimary = labIndex % 2 === 0;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
        isPrimary ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      }`}>
        <span className={`w-2 h-2 rounded-full ${isPrimary ? 'bg-blue-600' : 'bg-emerald-600'}`} />
        {lab.shortName} <span className="font-mono opacity-70">[{lab.code}]</span>
      </span>
    );
  };

  /**
   * Formatage lisible de la date
   */
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).format(new Date(dateString));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 1. En-tête supérieur du portail client */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-700 rounded-lg flex items-center justify-center shadow-xs">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-lg text-slate-900 block leading-tight">
                  Portail Client Unifié
                </span>
                <span className="text-xs text-slate-500">
                  {currentUser?.company || 'Espace Donneur d\'Ordre'} &bull; Multi-Laboratoires
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">{currentUser?.name}</p>
                <p className="text-xs text-slate-500">{currentUser?.email}</p>
              </div>
              <button 
                onClick={onOpenSettings} 
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200" 
                title="Mon profil et paramètres"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Titre & Action de création */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">Vos Demandes d'Analyses & d'Expertises</h1>
            <p className="text-sm text-slate-500 mt-1">
              Guichet unique pour déposer et suivre vos dossiers auprès de nos deux laboratoires spécialisés.
            </p>
          </div>
          <button 
            onClick={() => setIsNewModalOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Demande
          </button>
        </div>

        {/* Cartes de synthèse par laboratoire */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
            onClick={() => setSelectedLabFilter('all')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedLabFilter === 'all' ? 'bg-white border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Toutes Demandes</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{myRequests.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Dossiers déposés au total</p>
          </div>

          {laboratories.map((lab, index) => {
            const isPrimary = index % 2 === 0;
            return (
              <div
                key={lab.id}
                onClick={() => setSelectedLabFilter(lab.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedLabFilter === lab.id
                    ? (isPrimary ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-100 shadow-sm')
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isPrimary ? 'text-blue-700' : 'text-emerald-700'}`}>
                    <span className={`w-2 h-2 rounded-full ${isPrimary ? 'bg-blue-600' : 'bg-emerald-600'}`} /> {lab.name}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isPrimary ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {lab.code}
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {myRequests.filter(r => r.labId === lab.id).length}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{lab.description}</p>
              </div>
            );
          })}
        </div>

        {/* 3. Liste des demandes avec filtrage */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Filtre Laboratoire :
              </span>
              <span className="text-xs font-medium text-slate-600">
                {selectedLabFilter === 'all' ? 'Tous les laboratoires' : laboratories.find(l => l.id === selectedLabFilter)?.name}
              </span>
            </div>
            {selectedLabFilter !== 'all' && (
              <button 
                onClick={() => setSelectedLabFilter('all')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                Effacer le filtre
              </button>
            )}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-semibold text-slate-900">Aucune demande trouvée</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                {selectedLabFilter === 'all' 
                  ? "Vous n'avez pas encore soumis de demande d'analyse." 
                  : "Aucune demande déposée auprès de ce laboratoire."}
              </p>
              <button 
                onClick={() => setIsNewModalOpen(true)} 
                className="mt-4 text-blue-600 font-semibold text-sm hover:underline"
              >
                Déposer une nouvelle demande
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Référence</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Laboratoire Destinataire</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Objet / Titre</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                    <th scope="col" className="relative px-6 py-3 text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-slate-900 font-mono">{req.id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getLabBadge(req.labId)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-900">{req.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {allRequestTemplates.find(t => t.id === req.templateId)?.name || 'Formulaire personnalisé'}
                        </div>
                        {req.status === 'rejetee' && req.rejectionReason && (
                          <div className="text-xs text-red-700 mt-1.5 p-2 bg-red-50 rounded-lg border border-red-200">
                            <strong>Motif du rejet :</strong> {req.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(req.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {req.status === 'terminee' ? (
                          <button className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-800 font-semibold text-xs bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors">
                            <Download className="w-3.5 h-3.5" /> Rapport
                          </button>
                        ) : req.status === 'rejetee' ? (
                          <button 
                            onClick={() => setEditingRequest(req)} 
                            className="text-red-600 hover:text-red-800 font-semibold text-xs underline"
                          >
                            Corriger / Resoumettre
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">En traitement</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modales de création et modification */}
      <NewRequestModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} />
      {editingRequest && (
        <EditRequestModal 
          request={editingRequest} 
          isOpen={!!editingRequest} 
          onClose={() => setEditingRequest(null)} 
        />
      )}
    </div>
  );
}
