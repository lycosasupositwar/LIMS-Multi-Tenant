/**
 * Vue Métier : Gestion des Non-Conformités (NC) & Actions Correctives CAPA (ISO/IEC 17025 §7.10)
 *
 * Permet de déclarer, investiguer (cause racine), traiter (action corrective) et clôturer
 * tout écart qualité sur un échantillon, un essai, un équipement ou une méthode.
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { NonConformity, NonConformitySeverity, NonConformityStatus } from '../types';
import { AlertOctagon, Plus, CheckCircle2, Search, X, Trash2 } from 'lucide-react';
import { generateUniqueLimsId } from '../utils/idGenerator';

export function NonConformities() {
  const {
    nonConformities,
    allNonConformities,
    addNonConformity,
    updateNonConformity,
    deleteNonConformity,
    requests,
    samples,
    analyses,
    equipments,
    activeLabId,
    currentUser
  } = useLims();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | NonConformityStatus>('all');
  const [selectedNcId, setSelectedNcId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    type: 'echantillon' as NonConformity['type'],
    severity: 'mineure' as NonConformitySeverity,
    linkedRequestId: '',
    linkedSampleId: '',
    linkedAnalysisId: '',
    linkedEquipmentId: '',
    description: ''
  });

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const selectedNc = nonConformities.find(nc => nc.id === selectedNcId) || null;

  const filtered = nonConformities.filter(nc => {
    const matchStatus = statusFilter === 'all' || nc.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchText = !q ||
      nc.id.toLowerCase().includes(q) ||
      nc.title.toLowerCase().includes(q) ||
      nc.description.toLowerCase().includes(q) ||
      (nc.linkedRequestId || '').toLowerCase().includes(q) ||
      (nc.linkedSampleId || '').toLowerCase().includes(q);
    return matchStatus && matchText;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    const id = generateUniqueLimsId('NC', allNonConformities.map(n => n.id));
    const item: NonConformity = {
      id,
      labId: activeLabId,
      title: form.title.trim(),
      type: form.type,
      severity: form.severity,
      status: 'ouverte',
      linkedRequestId: form.linkedRequestId || undefined,
      linkedSampleId: form.linkedSampleId || undefined,
      linkedAnalysisId: form.linkedAnalysisId || undefined,
      linkedEquipmentId: form.linkedEquipmentId || undefined,
      description: form.description.trim(),
      clientNotified: false,
      createdBy: currentUser?.name || 'Utilisateur',
      createdAt: new Date().toISOString()
    };
    addNonConformity(item);
    setSelectedNcId(id);
    setShowModal(false);
    setForm({ title: '', type: 'echantillon', severity: 'mineure', linkedRequestId: '', linkedSampleId: '', linkedAnalysisId: '', linkedEquipmentId: '', description: '' });
  };

  const severityBadge = (sev: NonConformitySeverity) => {
    if (sev === 'critique') return 'bg-red-100 text-red-800 border-red-200';
    if (sev === 'majeure') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const statusLabel: Record<NonConformityStatus, string> = {
    ouverte: 'Ouverte',
    en_analyse: 'En analyse cause',
    action_en_cours: 'CAPA en cours',
    cloturee: 'Clôturée'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Non-Conformités & CAPA</h2>
          <p className="text-sm text-slate-500 mt-1">Déclaration d'écarts, analyse de cause racine et actions correctives (ISO/IEC 17025 §7.10).</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> Déclarer une Non-Conformité
        </button>
      </div>

      {/* Synthèse rapide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total NC</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{nonConformities.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200">
          <p className="text-xs text-red-700 font-semibold uppercase">Ouvertes / Actives</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{nonConformities.filter(n => n.status !== 'cloturee').length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200">
          <p className="text-xs text-amber-700 font-semibold uppercase">Majeures / Critiques</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{nonConformities.filter(n => n.status !== 'cloturee' && (n.severity === 'majeure' || n.severity === 'critique')).length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200">
          <p className="text-xs text-emerald-700 font-semibold uppercase">Clôturées</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{nonConformities.filter(n => n.status === 'cloturee').length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Liste des fiches NC */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Filtrer NC..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="text-xs border border-slate-300 rounded-lg px-2 bg-white">
              <option value="all">Tous</option>
              <option value="ouverte">Ouvertes</option>
              <option value="en_analyse">En analyse</option>
              <option value="action_en_cours">CAPA</option>
              <option value="cloturee">Clôturées</option>
            </select>
          </div>
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {filtered.map(nc => (
              <div
                key={nc.id}
                onClick={() => setSelectedNcId(nc.id)}
                className={`p-4 cursor-pointer transition-colors ${selectedNc?.id === nc.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-600">{nc.id}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${severityBadge(nc.severity)}`}>{nc.severity}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-1">{nc.title}</p>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                  <span>{statusLabel[nc.status]}</span>
                  <span>{new Date(nc.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">Aucune non-conformité enregistrée.</div>
            )}
          </div>
        </div>

        {/* Panneau de traitement CAPA */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          {selectedNc ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-5 h-5 text-red-600" />
                    <span className="font-mono text-sm font-bold text-slate-600">{selectedNc.id}</span>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full border ${severityBadge(selectedNc.severity)}`}>{selectedNc.severity}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedNc.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Déclarée par {selectedNc.createdBy} le {new Date(selectedNc.createdAt).toLocaleDateString('fr-FR')}</p>
                </div>
                {isManager && (
                  <button
                    onClick={() => { if (confirm('Supprimer cette fiche NC ?')) { deleteNonConformity(selectedNc.id); setSelectedNcId(null); } }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-3.5 text-sm text-slate-700 border border-slate-200">
                <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Description de l'écart</span>
                {selectedNc.description}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {selectedNc.linkedRequestId && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md font-mono">Demande: {selectedNc.linkedRequestId}</span>}
                {selectedNc.linkedSampleId && <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md font-mono">Échantillon: {selectedNc.linkedSampleId}</span>}
                {selectedNc.linkedAnalysisId && <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md font-mono">Analyse: {selectedNc.linkedAnalysisId}</span>}
                {selectedNc.linkedEquipmentId && <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md font-mono">Équipement: {selectedNc.linkedEquipmentId}</span>}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Statut de traitement</label>
                  <select
                    value={selectedNc.status}
                    disabled={selectedNc.status === 'cloturee' && !isManager}
                    onChange={e => {
                      const next = e.target.value as NonConformityStatus;
                      updateNonConformity(selectedNc.id, {
                        status: next,
                        closedAt: next === 'cloturee' ? new Date().toISOString() : undefined,
                        closedBy: next === 'cloturee' ? (currentUser?.name || 'Manager') : undefined
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="ouverte">Ouverte</option>
                    <option value="en_analyse">En analyse de cause racine</option>
                    <option value="action_en_cours">Action corrective (CAPA) en cours</option>
                    <option value="cloturee">Clôturée</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Analyse de cause racine</label>
                  <textarea
                    rows={2}
                    value={selectedNc.rootCause || ''}
                    onChange={e => updateNonConformity(selectedNc.id, { rootCause: e.target.value })}
                    placeholder="Identifier la cause technique ou organisationnelle..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Action corrective / préventive (CAPA)</label>
                  <textarea
                    rows={3}
                    value={selectedNc.correctiveAction || ''}
                    onChange={e => updateNonConformity(selectedNc.id, { correctiveAction: e.target.value })}
                    placeholder="Mesures prises, ré-essai éventuel, vérification d'efficacité..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedNc.clientNotified)}
                    onChange={e => updateNonConformity(selectedNc.id, { clientNotified: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Client informé de la non-conformité et de son impact éventuel
                </label>

                {selectedNc.closedAt && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Clôturée par {selectedNc.closedBy} le {new Date(selectedNc.closedAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-slate-400 text-sm">
              <AlertOctagon className="w-10 h-10 mb-2 opacity-30" />
              Sélectionnez une fiche de non-conformité pour consulter ou éditer son plan CAPA.
            </div>
          )}
        </div>
      </div>

      {/* Modale de déclaration NC */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-red-50">
              <h3 className="text-lg font-bold text-red-900">Déclarer une Non-Conformité</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Titre de l'écart *</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="echantillon">Échantillon</option>
                    <option value="equipement">Équipement / Métrologie</option>
                    <option value="analyse">Analyse / Résultat</option>
                    <option value="methode">Méthode / Procédure</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gravité</label>
                  <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="mineure">Mineure</option>
                    <option value="majeure">Majeure</option>
                    <option value="critique">Critique</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Demande liée</label>
                  <select value={form.linkedRequestId} onChange={e => setForm({ ...form, linkedRequestId: e.target.value })} className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="">Aucune</option>
                    {requests.map(r => <option key={r.id} value={r.id}>{r.id} - {r.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Échantillon lié</label>
                  <select value={form.linkedSampleId} onChange={e => setForm({ ...form, linkedSampleId: e.target.value })} className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="">Aucun</option>
                    {samples.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Analyse liée</label>
                  <select value={form.linkedAnalysisId} onChange={e => setForm({ ...form, linkedAnalysisId: e.target.value })} className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="">Aucune</option>
                    {analyses.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Équipement lié</label>
                  <select value={form.linkedEquipmentId} onChange={e => setForm({ ...form, linkedEquipmentId: e.target.value })} className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="">Aucun</option>
                    {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.code} - {eq.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description détaillée *</label>
                <textarea required rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-lg hover:bg-red-700">Créer la fiche NC</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
