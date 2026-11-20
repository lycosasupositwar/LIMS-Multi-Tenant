/**
 * Vue Métier : Planning de Charge & Tableau Kanban des Essais
 *
 * Offre deux perspectives opérationnelles pour piloter l'ordonnancement du laboratoire :
 * 1. Vue Kanban : visualisation des essais par colonne de statut (`planifie`, `En Cours`, `rejete`, `a_valider`, `valide`)
 *    avec planification de date (`plannedDate`) et lien direct vers l'équipement.
 * 2. Vue Charge : agrégation par Analyste (demandes, essais, heures estimées) et par Équipement.
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { AnalysisStatus } from '../types';
import { CalendarDays, Columns3, Users, Wrench, Clock, AlertTriangle } from 'lucide-react';
import { getCalibrationDaysRemaining } from './Equipments';

export function Planning() {
  const { analyses, analysisTemplates, samples, requests, users, equipments, updateAnalysisMeta, updateAnalysisStatus, activeLabId } = useLims();
  const [viewMode, setViewMode] = useState<'kanban' | 'workload'>('kanban');

  const columns: { status: AnalysisStatus; title: string; color: string }[] = [
    { status: 'planifie', title: 'Planifiés', color: 'border-slate-300 bg-slate-50' },
    { status: 'En Cours', title: 'En Cours', color: 'border-blue-300 bg-blue-50/50' },
    { status: 'rejete', title: 'À reprendre (Refusés)', color: 'border-red-300 bg-red-50/50' },
    { status: 'a_valider', title: 'À Valider (Manager)', color: 'border-amber-300 bg-amber-50/50' },
    { status: 'valide', title: 'Validés', color: 'border-emerald-300 bg-emerald-50/50' }
  ];

  // Analystes et managers du laboratoire actif
  const labStaff = users.filter(u =>
    (u.role === 'analyste' || u.role === 'manager') &&
    (!u.labId || u.labId === 'all' || u.labId === activeLabId)
  );

  const getTemplate = (id: string) => analysisTemplates.find(t => t.id === id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Planning & Charge Laboratoire</h2>
          <p className="text-sm text-slate-500 mt-1">Ordonnancement Kanban des essais, suivi des dates engagées et charge par analyste / équipement.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Columns3 className="w-4 h-4" /> Vue Kanban
          </button>
          <button
            onClick={() => setViewMode('workload')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${viewMode === 'workload' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Users className="w-4 h-4" /> Charge Analystes & Équipements
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {columns.map(col => {
            const colItems = analyses.filter(a => a.status === col.status);
            return (
              <div key={col.status} className={`rounded-xl border p-3 ${col.color} min-h-[420px] flex flex-col`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{col.title}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-white text-xs font-bold text-slate-700 border border-slate-200">{colItems.length}</span>
                </div>
                <div className="space-y-2.5 flex-1">
                  {colItems.map(a => {
                    const tpl = getTemplate(a.templateId);
                    const sample = samples.find(s => s.id === a.sampleId);
                    const req = sample?.requestId ? requests.find(r => r.id === sample.requestId) : null;
                    const eq = a.equipmentId ? equipments.find(e => e.id === a.equipmentId) : null;
                    const dueDate = req?.committedDueDate || req?.requestedDueDate;
                    const isLate = dueDate && new Date(dueDate) < new Date() && a.status !== 'valide' && a.status !== 'termine';
                    return (
                      <div key={a.id} className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-blue-700">{a.id}</span>
                          {tpl?.estimatedHours && (
                            <span className="inline-flex items-center text-[10px] text-slate-500">
                              <Clock className="w-3 h-3 mr-0.5" />{tpl.estimatedHours}h
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-900 leading-snug">{tpl?.name || a.templateId}</div>
                        <div className="text-[11px] text-slate-500">
                          Éch. <span className="font-mono">{a.sampleId}</span> • {a.technician || 'Non assigné'}
                        </div>
                        {eq && (
                          <div className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <Wrench className="w-3 h-3" /> {eq.code}
                          </div>
                        )}
                        {dueDate && (
                          <div className={`text-[10px] font-semibold flex items-center gap-1 ${isLate ? 'text-red-600' : 'text-slate-500'}`}>
                            {isLate && <AlertTriangle className="w-3 h-3" />}
                            Échéance : {new Date(dueDate).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                        <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-2">
                          <input
                            type="date"
                            value={a.plannedDate || ''}
                            onChange={e => updateAnalysisMeta(a.id, { plannedDate: e.target.value })}
                            className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 w-32"
                            title="Date planifiée d'exécution"
                          />
                          {a.status === 'planifie' && (
                            <button
                              onClick={() => updateAnalysisStatus(a.id, 'En Cours')}
                              className="text-[10px] font-semibold text-blue-600 hover:underline"
                            >
                              Démarrer →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {colItems.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400 italic">Aucun essai</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Charge par Analyste */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">Charge par Opérateur / Analyste</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {labStaff.map(member => {
                const activeReqs = requests.filter(r => r.assignedTo === member.id && !['terminee', 'rejetee'].includes(r.status));
                const activeAnalyses = analyses.filter(a => a.technician === member.name && ['planifie', 'En Cours', 'rejete'].includes(a.status));
                const totalHours = activeAnalyses.reduce((acc, a) => acc + (getTemplate(a.templateId)?.estimatedHours || 2), 0);
                const loadPct = Math.min(100, Math.round((totalHours / 35) * 100));
                return (
                  <div key={member.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{member.role} • {(member.qualifiedTemplateIds || []).length} habilitation(s)</p>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-bold text-slate-800">{activeAnalyses.length} essai(s) • ~{totalHours}h</div>
                        <div className="text-slate-500">{activeReqs.length} demande(s) active(s)</div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${loadPct > 85 ? 'bg-red-500' : loadPct > 60 ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${loadPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charge & Disponibilité par Équipement */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Occupation & Disponibilité des Équipements</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {equipments.map(eq => {
                const eqAnalyses = analyses.filter(a => a.equipmentId === eq.id && !['valide', 'termine'].includes(a.status));
                const daysLeft = getCalibrationDaysRemaining(eq.nextCalibrationDate);
                return (
                  <div key={eq.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{eq.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{eq.code} • {eq.location}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                        {eqAnalyses.length} essai(s) planifié(s)
                      </span>
                      <div className={`text-[11px] mt-1 font-medium ${daysLeft < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {daysLeft < 0 ? 'Étalonnage expiré' : `Étalonné (${daysLeft}j)`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
