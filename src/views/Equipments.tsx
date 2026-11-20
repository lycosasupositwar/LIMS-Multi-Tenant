/**
 * Vue Métier : Parc Équipements & Suivi Métrologique (ISO/IEC 17025 §6.4)
 *
 * Permet aux laboratoires de gérer leurs instruments de mesure (microscopes, duromètres,
 * machines de traction, granulomètres, etc.), de suivre les dates d'étalonnage,
 * d'alerter sur les échéances proches (< 30 jours) ou expirées, et de mettre à jour
 * l'état opérationnel d'un équipement.
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { ControlChart, Equipment, EquipmentStatus } from '../types';
import { Wrench, Plus, Search, CheckCircle2, AlertTriangle, XCircle, Calendar, Trash2, X, RefreshCw, Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { generateUniqueLimsId } from '../utils/idGenerator';

/**
 * Calcule le nombre de jours restants avant la date de prochain étalonnage (normalisé à minuit).
 */
export function getCalibrationDaysRemaining(nextCalibrationDate: string): number {
  const exp = new Date(nextCalibrationDate);
  exp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function Equipments() {
  const {
    equipments,
    allEquipments,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    controlCharts,
    addControlChart,
    addControlChartPoint,
    deleteControlChart,
    activeLabId,
    currentUser
  } = useLims();
  const [subTab, setSubTab] = useState<'park' | 'qc'>('park');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EquipmentStatus>('all');
  const [showModal, setShowModal] = useState(false);

  // États pour les Cartes de Contrôle Qualité Interne (CQ / Westgard ±2σ / ±3σ)
  const [showChartModal, setShowChartModal] = useState(false);
  const [newChart, setNewChart] = useState({ name: '', equipmentId: '', unit: 'HV', targetValue: 250, stdDev: 5 });
  const [pointInputs, setPointInputs] = useState<Record<string, { value: string; notes: string }>>({});

  const [newEq, setNewEq] = useState({
    name: '',
    code: '',
    serialNumber: '',
    manufacturer: '',
    category: 'Microstructure',
    location: '',
    lastCalibrationDate: new Date().toISOString().slice(0, 10),
    calibrationIntervalMonths: 12,
    notes: ''
  });

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  // Calcul des KPI métrologiques
  const expiredCount = equipments.filter(e => getCalibrationDaysRemaining(e.nextCalibrationDate) < 0).length;
  const soonCount = equipments.filter(e => {
    const d = getCalibrationDaysRemaining(e.nextCalibrationDate);
    return d >= 0 && d <= 30;
  }).length;
  const operationalCount = equipments.filter(e => e.status === 'operationnel' && getCalibrationDaysRemaining(e.nextCalibrationDate) >= 0).length;

  const filtered = equipments.filter(e => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchText = !q ||
      e.name.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      e.serialNumber.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q);
    return matchStatus && matchText;
  });

  /**
   * Calcule la date de prochain étalonnage en ajoutant `months` mois à une date ISO `YYYY-MM-DD`.
   */
  const computeNextDate = (baseDate: string, months: number) => {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + (Number(months) || 12));
    return d.toISOString().slice(0, 10);
  };

  /**
   * Enregistre un nouvel équipement dans le laboratoire actif.
   */
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEq.name.trim() || !newEq.code.trim()) return;
    const id = generateUniqueLimsId('EQ', allEquipments.map(eq => eq.id));
    const item: Equipment = {
      id,
      labId: activeLabId,
      name: newEq.name.trim(),
      code: newEq.code.trim().toUpperCase(),
      serialNumber: newEq.serialNumber.trim() || 'N/A',
      manufacturer: newEq.manufacturer.trim() || 'N/A',
      category: newEq.category,
      status: 'operationnel',
      lastCalibrationDate: newEq.lastCalibrationDate,
      nextCalibrationDate: computeNextDate(newEq.lastCalibrationDate, newEq.calibrationIntervalMonths),
      calibrationIntervalMonths: Number(newEq.calibrationIntervalMonths) || 12,
      location: newEq.location.trim() || 'Laboratoire',
      notes: newEq.notes.trim() || undefined
    };
    addEquipment(item);
    setShowModal(false);
    setNewEq({
      name: '',
      code: '',
      serialNumber: '',
      manufacturer: '',
      category: 'Microstructure',
      location: '',
      lastCalibrationDate: new Date().toISOString().slice(0, 10),
      calibrationIntervalMonths: 12,
      notes: ''
    });
  };

  /**
   * Renouvelle l'étalonnage d'un équipement à la date du jour et recalcule sa prochaine échéance.
   */
  const handleRenewCalibration = (eq: Equipment) => {
    const today = new Date().toISOString().slice(0, 10);
    updateEquipment(eq.id, {
      lastCalibrationDate: today,
      nextCalibrationDate: computeNextDate(today, eq.calibrationIntervalMonths || 12),
      status: 'operationnel'
    });
  };

  const getStatusBadge = (status: EquipmentStatus) => {
    switch (status) {
      case 'operationnel':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Opérationnel</span>;
      case 'en_maintenance':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Wrench className="w-3.5 h-3.5 mr-1" />En maintenance</span>;
      case 'hors_tolerance':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="w-3.5 h-3.5 mr-1" />Hors tolérance</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700"><XCircle className="w-3.5 h-3.5 mr-1" />Hors service</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Parc Équipements, Métrologie & CQ Interne</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi des instruments de mesure, étalonnages (ISO 17025 §6.4) et cartes de contrôle qualité (±2σ / ±3σ).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setSubTab('park')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                subTab === 'park' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" /> Parc ({equipments.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('qc')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                subTab === 'qc' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Cartes CQ ({controlCharts.length})
            </button>
          </div>
          {isManager && subTab === 'park' && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" /> Nouvel Équipement
            </button>
          )}
          {isManager && subTab === 'qc' && (
            <button
              onClick={() => setShowChartModal(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" /> Nouvelle Carte CQ
            </button>
          )}
        </div>
      </div>

      {/* Sous-vue B : Cartes de Contrôle Qualité Interne (Échantillons témoins ± 2σ / ± 3σ) */}
      {subTab === 'qc' && (
        <div className="space-y-5">
          {controlCharts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
              <Activity className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Aucune carte de contrôle qualité interne</p>
              <p className="text-xs text-slate-500">
                Créez une carte CQ (ex : Cale étalon Dureté 250 HV ± 5 HV) pour surveiller la dérive de vos instruments dans le temps.
              </p>
            </div>
          ) : (
            controlCharts.map(chart => {
              const eq = chart.equipmentId ? equipments.find(e => e.id === chart.equipmentId) : null;
              const ucl3 = chart.targetValue + 3 * chart.stdDev;
              const lcl3 = chart.targetValue - 3 * chart.stdDev;
              const uwl2 = chart.targetValue + 2 * chart.stdDev;
              const lwl2 = chart.targetValue - 2 * chart.stdDev;
              const lastPt = chart.points[chart.points.length - 1];
              const isOutOfControl = lastPt ? (lastPt.value > ucl3 || lastPt.value < lcl3) : false;
              const isWarning = !isOutOfControl && lastPt ? (lastPt.value > uwl2 || lastPt.value < lwl2) : false;
              const chartData = chart.points.map((p, idx) => ({
                label: `${new Date(p.date).toLocaleDateString('fr-FR')} (#${idx + 1})`,
                value: p.value,
                operator: p.operator
              }));
              const draft = pointInputs[chart.id] || { value: '', notes: '' };

              return (
                <div key={chart.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{chart.name}</h3>
                        {isOutOfControl ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            ⛔ Hors contrôle (&gt; ±3σ)
                          </span>
                        ) : isWarning ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            ⚠ Alerte dérive (&gt; ±2σ)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            ✓ Sous contrôle
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cible : <strong>{chart.targetValue} {chart.unit}</strong> • σ = {chart.stdDev} {chart.unit} • Limites ±3σ : [{lcl3.toFixed(2)} ; {ucl3.toFixed(2)}]
                        {eq ? ` • Machine : ${eq.code} (${eq.name})` : ''}
                      </p>
                    </div>
                    {isManager && (
                      <button
                        type="button"
                        onClick={() => deleteControlChart(chart.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        title="Supprimer cette carte CQ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="h-56">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                            <YAxis
                              domain={[Math.floor(lcl3 - chart.stdDev), Math.ceil(ucl3 + chart.stdDev)]}
                              tick={{ fontSize: 10, fill: '#64748b' }}
                            />
                            <Tooltip />
                            <ReferenceLine y={chart.targetValue} stroke="#10b981" strokeWidth={2} label={{ value: 'Cible', fontSize: 10, fill: '#059669' }} />
                            <ReferenceLine y={uwl2} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '+2σ', fontSize: 10, fill: '#d97706' }} />
                            <ReferenceLine y={lwl2} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '-2σ', fontSize: 10, fill: '#d97706' }} />
                            <ReferenceLine y={ucl3} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '+3σ', fontSize: 10, fill: '#dc2626' }} />
                            <ReferenceLine y={lcl3} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '-3σ', fontSize: 10, fill: '#dc2626' }} />
                            <Line type="monotone" dataKey="value" name={`Mesure (${chart.unit})`} stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                          Saisissez au moins un point de contrôle ci-dessous pour tracer la courbe.
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="number"
                        step="any"
                        placeholder={`Nouvelle mesure (${chart.unit})`}
                        value={draft.value}
                        onChange={e => setPointInputs(prev => ({ ...prev, [chart.id]: { ...draft, value: e.target.value } }))}
                        className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 w-44"
                      />
                      <input
                        type="text"
                        placeholder="Observation (optionnelle)..."
                        value={draft.notes}
                        onChange={e => setPointInputs(prev => ({ ...prev, [chart.id]: { ...draft, notes: e.target.value } }))}
                        className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 flex-1 min-w-[160px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const num = Number(draft.value);
                          if (draft.value === '' || isNaN(num)) return;
                          addControlChartPoint(chart.id, {
                            date: new Date().toISOString().slice(0, 10),
                            value: num,
                            notes: draft.notes.trim() || undefined
                          });
                          setPointInputs(prev => ({ ...prev, [chart.id]: { value: '', notes: '' } }));
                        }}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                      >
                        + Enregistrer point CQ
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Modale de création d'une Carte CQ */}
          {showChartModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Nouvelle Carte de Contrôle (CQ Interne)</h3>
                  <button onClick={() => setShowChartModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Intitulé de l'étalon / témoin *</label>
                    <input
                      type="text"
                      value={newChart.name}
                      onChange={e => setNewChart({ ...newChart, name: e.target.value })}
                      placeholder="Ex: Cale étalon Dureté 250 HV10"
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Équipement associé</label>
                    <select
                      value={newChart.equipmentId}
                      onChange={e => setNewChart({ ...newChart, equipmentId: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                    >
                      <option value="">-- Aucun --</option>
                      {equipments.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.code} — {eq.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Valeur Cible</label>
                      <input
                        type="number"
                        step="any"
                        value={newChart.targetValue}
                        onChange={e => setNewChart({ ...newChart, targetValue: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Écart-type (σ)</label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={newChart.stdDev}
                        onChange={e => setNewChart({ ...newChart, stdDev: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unité</label>
                      <input
                        type="text"
                        value={newChart.unit}
                        onChange={e => setNewChart({ ...newChart, unit: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setShowChartModal(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600">Annuler</button>
                    <button
                      type="button"
                      disabled={!newChart.name.trim()}
                      onClick={() => {
                        const item: ControlChart = {
                          id: `CQ-${Date.now()}`,
                          labId: activeLabId,
                          name: newChart.name.trim(),
                          equipmentId: newChart.equipmentId || undefined,
                          unit: newChart.unit.trim() || '',
                          targetValue: Number(newChart.targetValue) || 0,
                          stdDev: Math.max(0.001, Number(newChart.stdDev) || 1),
                          points: []
                        };
                        addControlChart(item);
                        setShowChartModal(false);
                        setNewChart({ name: '', equipmentId: '', unit: 'HV', targetValue: 250, stdDev: 5 });
                      }}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-40"
                    >
                      Créer la carte
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sous-vue A : Parc Équipements & Étalonnages */}
      {subTab === 'park' && (
      <>
      {/* Cartes KPI Métrologie */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Parc</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{equipments.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <p className="text-xs font-semibold text-emerald-700 uppercase">Conformes & Actifs</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{operationalCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
          <p className="text-xs font-semibold text-amber-700 uppercase">Étalonnage ≤ 30j</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{soonCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-xs">
          <p className="text-xs font-semibold text-red-700 uppercase">Étalonnage Expiré</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{expiredCount}</p>
        </div>
      </div>

      {/* Barre de recherche & filtres */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between bg-slate-50/70">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, code, n° série, salle..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700"
          >
            <option value="all">Tous les états</option>
            <option value="operationnel">Opérationnel</option>
            <option value="en_maintenance">En maintenance</option>
            <option value="hors_tolerance">Hors tolérance</option>
            <option value="hors_service">Hors service</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Équipement / Code</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fabricant / N° Série</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Localisation</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Étalonnage</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map(eq => {
                const daysLeft = getCalibrationDaysRemaining(eq.nextCalibrationDate);
                const isExpired = daysLeft < 0;
                const isSoon = daysLeft >= 0 && daysLeft <= 30;
                return (
                  <tr key={eq.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-sm text-slate-900">{eq.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{eq.code} • {eq.category}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      <div>{eq.manufacturer}</div>
                      <div className="text-xs text-slate-400 font-mono">S/N: {eq.serialNumber}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{eq.location}</td>
                    <td className="px-5 py-4 text-sm">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Échéance : {new Date(eq.nextCalibrationDate).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className={`text-xs font-semibold mt-0.5 ${isExpired ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isExpired ? `Expiré depuis ${Math.abs(daysLeft)}j — Saisie bloquée` : isSoon ? `À renouveler dans ${daysLeft}j` : `Valide (${daysLeft}j restants)`}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {isManager ? (
                        <select
                          value={eq.status}
                          onChange={e => updateEquipment(eq.id, { status: e.target.value as EquipmentStatus })}
                          className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white"
                        >
                          <option value="operationnel">Opérationnel</option>
                          <option value="en_maintenance">En maintenance</option>
                          <option value="hors_tolerance">Hors tolérance</option>
                          <option value="hors_service">Hors service</option>
                        </select>
                      ) : getStatusBadge(eq.status)}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      {isManager && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRenewCalibration(eq)}
                            title="Valider un nouvel étalonnage aujourd'hui"
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Étalonner
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (confirm(`Supprimer l'équipement "${eq.name}" ?`)) deleteEquipment(eq.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                    Aucun équipement trouvé pour ce laboratoire.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale d'ajout d'équipement */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Enregistrer un Équipement</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Désignation *</label>
                  <input required value={newEq.name} onChange={e => setNewEq({ ...newEq, name: e.target.value })} placeholder="Ex: Duromètre Vickers Duramin-40" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code interne *</label>
                  <input required value={newEq.code} onChange={e => setNewEq({ ...newEq, code: e.target.value })} placeholder="Ex: DUR-MET-03" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">N° de série</label>
                  <input value={newEq.serialNumber} onChange={e => setNewEq({ ...newEq, serialNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fabricant</label>
                  <input value={newEq.manufacturer} onChange={e => setNewEq({ ...newEq, manufacturer: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie</label>
                  <input value={newEq.category} onChange={e => setNewEq({ ...newEq, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dernier étalonnage</label>
                  <input type="date" required value={newEq.lastCalibrationDate} onChange={e => setNewEq({ ...newEq, lastCalibrationDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Périodicité (mois)</label>
                  <input type="number" min={1} max={60} value={newEq.calibrationIntervalMonths} onChange={e => setNewEq({ ...newEq, calibrationIntervalMonths: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Localisation / Salle</label>
                  <input value={newEq.location} onChange={e => setNewEq({ ...newEq, location: e.target.value })} placeholder="Ex: Salle Microscopie A1" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
