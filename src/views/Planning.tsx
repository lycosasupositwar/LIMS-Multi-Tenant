/**
 * Vue Métier : Planning de Charge, Calendrier Interactif & Tableau Kanban des Essais
 *
 * Offre trois perspectives complémentaires réservées aux Managers et Administrateurs :
 * 1. Vue Calendrier Mensuel Interactif (par défaut) :
 *    - Affiche sur chaque journée les essais planifiés (`plannedDate`), les échéances engagées des demandes
 *      (`committedDueDate` / `requestedDueDate`), les échéances d'étalonnage d'équipements (`nextCalibrationDate`)
 *      et la charge horaire cumulée du jour (jauge verte / ambre / rouge si > 7h).
 *    - Glisser-déposer (Drag & Drop natif) pour planifier un essai depuis la file "Non planifiés"
 *      ou reprogrammer un essai d'un jour à un autre.
 *    - Modale rapide au clic sur un essai pour ajuster sa date, son équipement ou le démarrer.
 * 2. Vue Kanban : visualisation des essais par colonne de statut (`planifie`, `En Cours`, `rejete`, `a_valider`, `valide`).
 * 3. Vue Charge : agrégation par Analyste (demandes, essais, heures estimées) et par Équipement.
 */

import React, { useState, useMemo } from 'react';
import { useLims } from '../store';
import { Analysis, AnalysisStatus } from '../types';
import {
  CalendarDays,
  Columns3,
  Users,
  Wrench,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flag,
  X,
  PlayCircle,
  Sparkles,
  Lock,
  Unlock,
  Layers,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { getCalibrationDaysRemaining } from './Equipments';
import { computeSmartSchedule, SchedulingProposal } from '../utils/smartScheduler';

/**
 * Formate un objet Date local au format `YYYY-MM-DD`.
 */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Planning() {
  const {
    analyses,
    analysisTemplates,
    samples,
    requests,
    users,
    equipments,
    labSettings,
    updateAnalysisMeta,
    applyScheduleProposal,
    updateAnalysisStatus,
    activeLabId
  } = useLims();

  /** Mode d'affichage actif : 'calendar' (par défaut), 'kanban' ou 'workload' */
  const [viewMode, setViewMode] = useState<'calendar' | 'kanban' | 'workload'>('calendar');
  /** Mois actuellement affiché dans la vue calendrier */
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  /** Filtre optionnel par technicien dans le calendrier */
  const [staffFilter, setStaffFilter] = useState<string>('all');
  /** Identifiant de l'essai actuellement survolé/glissé (Drag & Drop) */
  const [draggedAnalysisId, setDraggedAnalysisId] = useState<string | null>(null);
  /** Date cible survolée lors d'un glisser-déposer */
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  /** Essai ouvert dans la modale d'édition rapide du calendrier */
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  /** Proposition de planification intelligente en cours de prévisualisation (Dry-Run) */
  const [proposal, setProposal] = useState<SchedulingProposal | null>(null);

  /** Lance la simulation du moteur de planification intelligente sans rien modifier en base */
  const handleRunSmartSchedule = () => {
    const result = computeSmartSchedule({
      analyses,
      samples,
      requests,
      analysisTemplates,
      equipments,
      config: labSettings?.schedulingConfig
    });
    setProposal(result);
  };

  const selectedAnalysis = analyses.find(a => a.id === selectedAnalysisId) || null;
  const getTemplate = (id: string) => analysisTemplates.find(t => t.id === id);

  // Analystes et managers du laboratoire actif
  const labStaff = users.filter(
    u =>
      (u.role === 'analyste' || u.role === 'manager') &&
      (!u.labId || u.labId === 'all' || u.labId === activeLabId)
  );

  // Essais filtrés par opérateur pour le calendrier
  const calendarAnalyses = useMemo(() => {
    return analyses.filter(a => staffFilter === 'all' || a.technician === staffFilter);
  }, [analyses, staffFilter]);

  // Essais actifs sans date planifiée (file d'attente à glisser sur le calendrier)
  const unscheduledAnalyses = useMemo(() => {
    return calendarAnalyses.filter(a => !a.plannedDate && a.status !== 'valide' && a.status !== 'termine');
  }, [calendarAnalyses]);

  // Demandes actives n'ayant pas encore d'échantillons générés mais portant une estimation horaire
  const pendingEstimatedRequests = useMemo(() => {
    return requests.filter(r => !['terminee', 'rejetee'].includes(r.status) && (r.estimatedHours || r.committedDueDate));
  }, [requests]);

  // Génération de la grille mensuelle (Lundi -> Dimanche, 35 ou 42 cases)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Lundi = 0, Dimanche = 6
    const startDate = new Date(year, month, 1 - startOffset);

    const lastDay = new Date(year, month + 1, 0);
    const totalCells = startOffset + lastDay.getDate() > 35 ? 42 : 35;

    const days: { date: Date; iso: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayIso = toIsoDate(new Date());
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = toIsoDate(d);
      days.push({
        date: d,
        iso,
        isCurrentMonth: d.getMonth() === month,
        isToday: iso === todayIso
      });
    }
    return days;
  }, [currentMonth]);

  /** Style couleur d'une pastille d'essai sur le calendrier selon son statut */
  const getAnalysisChipStyle = (status: AnalysisStatus) => {
    switch (status) {
      case 'En Cours':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'rejete':
        return 'bg-red-100 text-red-900 border-red-300';
      case 'a_valider':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'valide':
      case 'termine':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  /** Gestion du dépôt d'un essai sur une journée du calendrier */
  const handleDropOnDay = (isoDate: string) => {
    if (draggedAnalysisId) {
      updateAnalysisMeta(draggedAnalysisId, { plannedDate: isoDate });
    }
    setDraggedAnalysisId(null);
    setDragOverDate(null);
  };

  const columns: { status: AnalysisStatus; title: string; color: string }[] = [
    { status: 'planifie', title: 'Planifiés', color: 'border-slate-300 bg-slate-50' },
    { status: 'En Cours', title: 'En Cours', color: 'border-blue-300 bg-blue-50/50' },
    { status: 'rejete', title: 'À reprendre (Refusés)', color: 'border-red-300 bg-red-50/50' },
    { status: 'a_valider', title: 'À Valider (Manager)', color: 'border-amber-300 bg-amber-50/50' },
    { status: 'valide', title: 'Validés', color: 'border-emerald-300 bg-emerald-50/50' }
  ];

  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentMonth);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Planning & Charge Laboratoire</h2>
          <p className="text-sm text-slate-500 mt-1">
            Calendrier interactif (glisser-déposer), ordonnancement Kanban et suivi de charge par analyste / équipement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRunSmartSchedule}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            title="Optimiser automatiquement le planning selon les urgences et les lots de préparation du laboratoire"
          >
            <Sparkles className="w-4 h-4" /> Planification Intelligente (Auto)
          </button>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
              viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="w-4 h-4" /> Calendrier
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
              viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Columns3 className="w-4 h-4" /> Kanban
          </button>
          <button
            onClick={() => setViewMode('workload')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
              viewMode === 'workload' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" /> Charge
          </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. VUE CALENDRIER MENSUEL INTERACTIF       */}
      {/* ========================================== */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Colonne latérale : File des essais à planifier (glisser-déposer vers le calendrier) */}
          <div className="xl:col-span-3 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  À planifier ({unscheduledAnalyses.length})
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Glissez un essai sur une journée du calendrier pour fixer sa date.
              </p>
            </div>
            <div className="p-2.5 space-y-2 max-h-[520px] overflow-y-auto">
              {unscheduledAnalyses.map(a => {
                const tpl = getTemplate(a.templateId);
                const hrs = tpl?.estimatedHours ?? 2;
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDraggedAnalysisId(a.id)}
                    onDragEnd={() => {
                      setDraggedAnalysisId(null);
                      setDragOverDate(null);
                    }}
                    onClick={() => setSelectedAnalysisId(a.id)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40 cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-bold text-blue-700">{a.id}</span>
                      <span className="inline-flex items-center text-slate-500 font-medium">
                        <Clock className="w-3 h-3 mr-0.5" />{hrs}h
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{tpl?.name || a.templateId}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {a.sampleId} • {a.technician || 'Non assigné'}
                    </div>
                  </div>
                );
              })}
              {unscheduledAnalyses.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  Tous les essais actifs ont une date planifiée.
                </div>
              )}
            </div>

            {/* Rappel des demandes avec estimation préliminaire */}
            {pendingEstimatedRequests.length > 0 && (
              <div className="border-t border-slate-200 p-3 bg-indigo-50/40 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                  Estimations demandes actives
                </p>
                {pendingEstimatedRequests.slice(0, 4).map(r => (
                  <div key={r.id} className="text-[11px] flex items-center justify-between text-slate-700 bg-white px-2 py-1 rounded border border-indigo-100">
                    <span className="font-mono font-semibold truncate mr-2">{r.id}</span>
                    <span className="shrink-0 font-bold text-indigo-700">
                      {r.sampleCount ? `${r.sampleCount} éch.` : ''} {r.estimatedHours ? `~${r.estimatedHours}h` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grille Calendrier Mensuelle */}
          <div className="xl:col-span-9 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Barre d'outils calendrier */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                  title="Mois précédent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                  title="Mois suivant"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <h3 className="ml-2 text-base font-bold text-slate-900 capitalize">{monthLabel}</h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={staffFilter}
                  onChange={e => setStaffFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
                >
                  <option value="all">Tous les opérateurs</option>
                  {labStaff.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-200 border border-blue-400" /> Essai</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-200 border border-purple-400" /> Échéance</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-400" /> Étalonnage</span>
                </div>
              </div>
            </div>

            {/* En-tête jours de la semaine */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-bold uppercase text-slate-500">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                <div key={day} className="py-2 border-r last:border-r-0 border-slate-200">{day}</div>
              ))}
            </div>

            {/* Cases du calendrier */}
            <div className="grid grid-cols-7">
              {calendarDays.map(cell => {
                const dayAnalyses = calendarAnalyses.filter(a => a.plannedDate === cell.iso);
                const dayDeadlines = requests.filter(
                  r => !['terminee', 'rejetee'].includes(r.status) && (r.committedDueDate === cell.iso || (!r.committedDueDate && r.requestedDueDate === cell.iso))
                );
                const dayCalibrations = equipments.filter(eq => eq.nextCalibrationDate === cell.iso);
                const dayHours = dayAnalyses.reduce((sum, a) => sum + (getTemplate(a.templateId)?.estimatedHours ?? 2), 0);
                const isDropTarget = dragOverDate === cell.iso;

                return (
                  <div
                    key={cell.iso}
                    onDragOver={e => {
                      e.preventDefault();
                      if (dragOverDate !== cell.iso) setDragOverDate(cell.iso);
                    }}
                    onDragLeave={() => {
                      if (dragOverDate === cell.iso) setDragOverDate(null);
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      handleDropOnDay(cell.iso);
                    }}
                    className={`min-h-[116px] p-1.5 border-r border-b border-slate-200 flex flex-col gap-1 transition-colors ${
                      !cell.isCurrentMonth ? 'bg-slate-50/70 text-slate-400' : 'bg-white'
                    } ${isDropTarget ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : ''}`}
                  >
                    <div className="flex items-center justify-between px-0.5">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          cell.isToday ? 'bg-blue-600 text-white' : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {dayHours > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            dayHours > 8
                              ? 'bg-red-100 text-red-700'
                              : dayHours >= 6
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                          }`}
                          title={`Charge planifiée : ${dayHours}h`}
                        >
                          {dayHours}h
                        </span>
                      )}
                    </div>

                    {/* Échéances de demandes */}
                    {dayDeadlines.map(req => (
                      <div
                        key={`dl-${req.id}`}
                        className="px-1.5 py-0.5 rounded bg-purple-100 border border-purple-300 text-purple-900 text-[10px] font-semibold truncate flex items-center gap-1"
                        title={`Échéance demande ${req.id} : ${req.title}`}
                      >
                        <Flag className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{req.id}</span>
                      </div>
                    ))}

                    {/* Échéances d'étalonnage */}
                    {dayCalibrations.map(eq => (
                      <div
                        key={`cal-${eq.id}`}
                        className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-semibold truncate flex items-center gap-1"
                        title={`Étalonnage prévu : ${eq.name}`}
                      >
                        <Wrench className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Étal. {eq.code}</span>
                      </div>
                    ))}

                    {/* Essais planifiés (déplaçables par drag & drop) */}
                    {dayAnalyses.map(a => {
                      const tpl = getTemplate(a.templateId);
                      return (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={() => setDraggedAnalysisId(a.id)}
                          onDragEnd={() => {
                            setDraggedAnalysisId(null);
                            setDragOverDate(null);
                          }}
                          onClick={() => setSelectedAnalysisId(a.id)}
                          className={`px-1.5 py-1 rounded border text-[10px] cursor-grab active:cursor-grabbing hover:shadow-xs transition-shadow ${getAnalysisChipStyle(a.status)}`}
                          title={`${a.id} — ${tpl?.name || a.templateId} (${a.technician || 'Non assigné'})`}
                        >
                          <div className="font-bold truncate flex items-center justify-between gap-1">
                            <span className="truncate">{tpl?.name || a.id}</span>
                            {a.isScheduleLocked && <Lock className="w-2.5 h-2.5 shrink-0 opacity-75" />}
                          </div>
                          <div className="text-[9px] opacity-80 truncate flex items-center justify-between gap-1">
                            <span>{a.sampleId} • {tpl?.estimatedHours ?? 2}h</span>
                            {a.scheduledBatchId && (
                              <span className="px-1 rounded bg-white/70 font-mono font-bold">{a.scheduledBatchId}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. VUE KANBAN PAR STATUT                   */}
      {/* ========================================== */}
      {viewMode === 'kanban' && (
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
      )}

      {/* ========================================== */}
      {/* 3. VUE CHARGE ANALYSTES & ÉQUIPEMENTS      */}
      {/* ========================================== */}
      {viewMode === 'workload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Modale d'édition rapide d'un essai cliqué sur le calendrier */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-blue-700">{selectedAnalysis.id}</span>
                <h4 className="text-sm font-bold text-slate-900">{getTemplate(selectedAnalysis.templateId)?.name || selectedAnalysis.templateId}</h4>
              </div>
              <button onClick={() => setSelectedAnalysisId(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="text-xs text-slate-600">
                Échantillon : <strong className="font-mono text-slate-900">{selectedAnalysis.sampleId}</strong> • Opérateur : <strong>{selectedAnalysis.technician || 'Non assigné'}</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date planifiée</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={selectedAnalysis.plannedDate || ''}
                    onChange={e => updateAnalysisMeta(selectedAnalysis.id, { plannedDate: e.target.value || undefined })}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                  {selectedAnalysis.plannedDate && (
                    <button
                      type="button"
                      onClick={() => updateAnalysisMeta(selectedAnalysis.id, { plannedDate: undefined })}
                      className="px-2.5 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Déplanifier
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Équipement affecté</label>
                <select
                  value={selectedAnalysis.equipmentId || ''}
                  onChange={e => updateAnalysisMeta(selectedAnalysis.id, { equipmentId: e.target.value || undefined })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Non affecté --</option>
                  {equipments.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.code} — {eq.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={Boolean(selectedAnalysis.isScheduleLocked)}
                  onChange={e => updateAnalysisMeta(selectedAnalysis.id, { isScheduleLocked: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600"
                />
                {selectedAnalysis.isScheduleLocked ? <Lock className="w-3.5 h-3.5 text-indigo-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                Épingler cette date (ne pas décaler lors de la planification auto)
              </label>
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                {selectedAnalysis.status === 'planifie' ? (
                  <button
                    type="button"
                    onClick={() => {
                      updateAnalysisStatus(selectedAnalysis.id, 'En Cours');
                      setSelectedAnalysisId(null);
                    }}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" /> Démarrer l'essai
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Statut : <strong>{selectedAnalysis.status}</strong></span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAnalysisId(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modale de Simulation & Validation de la Planification Intelligente */}
      {proposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-5 bg-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-base">Simulation — Planification Intelligente</h3>
                  <p className="text-xs text-indigo-200">
                    Capacité : {labSettings?.schedulingConfig?.dailyCapacityHours || 7}h/jour • Préemption urgences : {labSettings?.schedulingConfig?.allowUrgentPreemption !== false ? 'Active' : 'Désactivée'}
                  </p>
                </div>
              </div>
              <button onClick={() => setProposal(null)} className="text-indigo-200 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* KPI de synthèse */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Essais planifiés</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{proposal.assignments.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-[11px] font-semibold text-red-700 uppercase">Urgences priorisées</p>
                  <p className="text-xl font-bold text-red-700 mt-0.5">{proposal.urgentPrioritizedCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase">Essais décalés</p>
                  <p className="text-xl font-bold text-amber-800 mt-0.5">{proposal.shiftedCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase">Temps gagné (lots)</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">+{proposal.totalSavedHours}h</p>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                <strong>{proposal.lockedCount}</strong> essai(s) déjà démarré(s) ou épinglé(s) n'ont pas été déplacés.
              </p>

              {/* Alertes éventuelles */}
              {proposal.warnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Points d'attention ({proposal.warnings.length})
                  </p>
                  {proposal.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-800">• {w}</p>
                  ))}
                </div>
              )}

              {/* Lots de préparation optimisés */}
              {proposal.batches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> Lots de préparation regroupés ({proposal.batches.length})
                  </h4>
                  <div className="space-y-2">
                    {proposal.batches.map(b => (
                      <div key={b.id} className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-mono font-bold text-indigo-900 mr-2">{b.id}</span>
                          <strong className="text-slate-900">{b.stepName}</strong> — <span className="text-indigo-800">{b.groupLabel}</span>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {b.sampleIds.length} échantillon(s) sur capacité max {b.batchCapacity} • Prévu le {new Date(b.plannedDate).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            -{b.savedHours}h gagnées ({b.optimizedHours}h vs {b.naiveHours}h)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Détail des mouvements Avant -> Après */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Affectations proposées ({proposal.assignments.length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Essai / Éch.</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Prio.</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Durée (Essai + Prépa)</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Date (Avant → Après)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {proposal.assignments.map(a => (
                        <tr key={a.analysisId} className={a.wasShifted ? 'bg-amber-50/40' : ''}>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">{a.templateName}</div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {a.analysisId} • {a.sampleId} {a.scheduledBatchId ? `• ${a.scheduledBatchId}` : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              a.priority === 'haute' ? 'bg-red-100 text-red-800' : a.priority === 'basse' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-800'
                            }`}>{a.priority}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-700">
                            {a.effectiveHours}h <span className="text-[10px] text-slate-400">({a.analysisHours}h + {a.prepHours}h)</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="text-slate-400">{a.oldDate ? new Date(a.oldDate).toLocaleDateString('fr-FR') : 'Non plan.'}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="font-bold text-indigo-700">{new Date(a.newDate).toLocaleDateString('fr-FR')}</span>
                            </div>
                            {a.shiftReason && <div className="text-[10px] text-amber-700 mt-0.5">{a.shiftReason}</div>}
                          </td>
                        </tr>
                      ))}
                      {proposal.assignments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-400 italic">
                            Aucun essai planifiable (`planifie` ou `rejete`) disponible.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={proposal.assignments.length === 0}
                onClick={() => {
                  applyScheduleProposal(
                    proposal.assignments.map(a => ({
                      id: a.analysisId,
                      plannedDate: a.newDate,
                      scheduledBatchId: a.scheduledBatchId
                    }))
                  );
                  setProposal(null);
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Appliquer ce planning ({proposal.assignments.length} essai(s))
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
