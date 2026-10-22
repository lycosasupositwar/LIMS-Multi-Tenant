/**
 * Portail Demandeur Multi-Laboratoires (Espace Client Unifié)
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { Plus, FileText, Package, AlertCircle, Settings as SettingsIcon, Building2, Filter, Download, Search, Copy } from 'lucide-react';
import { RequestStatus, AnalysisRequest } from '../types';
import { getLabColor } from '../utils/colors';
import { NewRequestModal } from '../components/NewRequestModal';
import { EditRequestModal } from '../components/EditRequestModal';

export function RequesterPortal({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { currentUser, requests, reports, samples, allRequestTemplates, laboratories } = useLims();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<AnalysisRequest | null>(null);
  const [duplicateRequest, setDuplicateRequest] = useState<Partial<AnalysisRequest> | null>(null);
  const [selectedLabFilter, setSelectedLabFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingRequestId, setDownloadingRequestId] = useState<string | null>(null);

  const myRequests = requests.filter(r => r.requesterId === currentUser?.id);

  const filteredRequests = myRequests.filter(req => {
    const matchesLab = selectedLabFilter === 'all' || req.labId === selectedLabFilter;
    const matchesSearch = searchQuery === '' || 
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      req.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLab && matchesSearch;
  });

  /**
   * Vérifie si un rapport généré existe pour une demande donnée
   */
  const hasReportForRequest = (requestId: string) => {
    const reqSampleIds = new Set(samples.filter(s => s.requestId === requestId).map(s => s.id));
    return reports.some(
      r =>
        r.status === 'genere' &&
        (r.requestId === requestId ||
          (Array.isArray(r.sampleIds) && r.sampleIds.some(sId => reqSampleIds.has(sId))))
    );
  };

  /**
   * Génère un lien unique à usage unique pour la demande et déclenche le téléchargement direct
   */
  const handleDownloadRequestReport = async (requestId: string) => {
    try {
      setDownloadingRequestId(requestId);
      const res = await fetch(`/api/reports/by-request/${encodeURIComponent(requestId)}/generate-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.downloadUrl) {
        alert(data.error || 'Impossible de récupérer le rapport pour cette demande.');
        return;
      }

      // Déclenche le téléchargement via le lien unique (qui est invalidé côté serveur dès cet appel)
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erreur lors du téléchargement sécurisé du rapport :', error);
      alert('Erreur réseau lors du téléchargement du rapport.');
    } finally {
      setDownloadingRequestId(null);
    }
  };

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
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Revue technique</span>;
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

  const getLabBadge = (labId?: string) => {
    const labIndex = laboratories.findIndex(l => l.id === labId);
    const lab = laboratories[labIndex];
    if (!lab) return null;
    const color = getLabColor(labIndex);
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${color.bgFade} ${color.text} ${color.borderLight}`}>
        <span className={`w-2 h-2 rounded-full ${color.mainBg}`} />
        {lab.shortName} <span className="font-mono opacity-70">[{lab.code}]</span>
      </span>
    );
  };

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
                  Portail Demandeur
                </span>
                <span className="text-xs text-slate-500">
                  {currentUser?.company || 'Espace Demandeur'} &bull; Multi-Laboratoires
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
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">Vos Demandes d'Analyses & d'Expertises</h1>
            <p className="text-sm text-slate-500 mt-1">
              Plateforme unique pour déposer et suivre vos dossiers auprès de nos laboratoires spécialisés.
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
            const color = getLabColor(index);
            return (
              <div 
                key={lab.id}
                onClick={() => setSelectedLabFilter(lab.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedLabFilter === lab.id 
                    ? `${color.bgFade} ${color.borderDark} ${color.ring} shadow-sm`
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                   <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${color.main}`}>
                    <span className={`w-2 h-2 rounded-full ${color.mainBg}`} /> {lab.name}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${color.light} ${color.text}`}>
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
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
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
            
            <div className="relative w-full lg:w-64 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher une demande..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
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
                  {filteredRequests.map((req) => {
                    const isReportAvailable = req.status === 'terminee' || hasReportForRequest(req.id);
                    return (
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
                          {getStatusBadge(isReportAvailable ? 'terminee' : req.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            {isReportAvailable && (
                              <button
                                onClick={() => handleDownloadRequestReport(req.id)}
                                disabled={downloadingRequestId === req.id}
                                className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 font-semibold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                                title="Générer un lien sécurisé à usage unique et télécharger le rapport"
                              >
                                <Download className={`w-3.5 h-3.5 ${downloadingRequestId === req.id ? 'animate-bounce' : ''}`} />
                                {downloadingRequestId === req.id ? 'Lien sécurisé...' : 'Rapport'}
                              </button>
                            )}
                            <button 
                              onClick={() => setEditingRequest(req)} 
                              className="text-blue-600 hover:text-blue-800 font-semibold text-xs underline"
                            >
                              {req.status === 'rejetee' || req.status === 'brouillon' ? 'Modifier' : 'Voir'}
                            </button>
                            <button
                              onClick={() => { setDuplicateRequest(req); setIsNewModalOpen(true); }}
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                              title="Dupliquer la demande"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <NewRequestModal isOpen={isNewModalOpen} onClose={() => { setIsNewModalOpen(false); setDuplicateRequest(null); }} initialRequest={duplicateRequest || undefined} />
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