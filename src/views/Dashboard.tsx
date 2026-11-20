/**
 * Vue Tableau de Bord & Indicateurs Clés de Performance (Dashboard)
 * 
 * Cette vue propose un affichage adapté selon le profil utilisateur connecté :
 * 1. Profil Analyste / Opérateur :
 *    - Résumé des dossiers et analyses assignés personnellement
 *    - Décompte des échantillons en attente de préparation ou d'essais
 *    - Liste des dossiers prioritaires avec accès direct
 * 2. Profil Manager / Responsable Laboratoire :
 *    - Vue d'ensemble des indicateurs de charge (demandes à revoir, échantillons, essais en cours)
 *    - Graphique en barres Recharts illustrant la répartition des demandes par statut
 *    - Graphique circulaire Recharts surveillant le niveau des stocks de consommables critiques
 */

import React from 'react';
import { useLims } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Box, Activity, CheckCircle, Factory, FileText, AlertCircle } from 'lucide-react';
import { RequestStatus } from '../types';

export function Dashboard() {
  const { currentUser, samples, analyses, requests, materialTemplates, consumables } = useLims();

  /**
   * Génère le badge visuel coloré correspondant à un statut de demande
   */
  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'brouillon': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Brouillon</span>;
      case 'soumise': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Nouvelle Soumission</span>;
      case 'en_revue': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">En Revue</span>;
      case 'validee': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Validée</span>;
      case 'assignee': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">Assignée</span>;
      case 'en_cours': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">En Cours</span>;
      case 'en_validation': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">En Validation finale</span>;
      case 'terminee': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Terminée</span>;
      case 'rejetee': 
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">Rejetée</span>;
    }
  };

  /* =========================================================================
   * 1. TABLEAU DE BORD OPÉRATEUR (ANALYSTE)
   * ========================================================================= */
  if (currentUser?.role === 'analyste') {
    // Dossiers en cours assignés à cet opérateur
    const assignedRequests = requests.filter(
      r => r.assignedTo === currentUser.id && ['assignee', 'en_cours', 'en_validation'].includes(r.status)
    );
    const pendingSamples = samples.filter(s => s.status === 'receptionne' || s.status === 'en_preparation');
    const myAnalyses = analyses.filter(a => a.technician === currentUser.name && a.status === 'en_cours');

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">Bonjour {currentUser.name}</h2>
            <p className="text-sm text-slate-500 mt-1">Voici un résumé de vos tâches et dossiers en cours pour aujourd'hui.</p>
          </div>
        </div>

        {/* Cartes de synthèse analyste */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-slate-500">Dossiers assignés</h3>
              <p className="text-2xl font-bold font-display text-slate-900">{assignedRequests.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
              <Activity className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-slate-500">Analyses en cours</h3>
              <p className="text-2xl font-bold font-display text-slate-900">{myAnalyses.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
              <Box className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-slate-500">Échantillons à préparer</h3>
              <p className="text-2xl font-bold font-display text-slate-900">{pendingSamples.length}</p>
            </div>
          </div>
        </div>

        {/* Liste des dossiers en cours de traitement */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
            Vos dossiers prioritaires
          </div>
          {assignedRequests.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              Aucun dossier ne vous est actuellement assigné.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assignedRequests.map(r => (
                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-slate-900">{r.id}</span>
                      {getStatusBadge(r.status)}
                    </div>
                    <div className="text-sm text-slate-600">{r.title}</div>
                  </div>
                  <button className="text-blue-600 text-sm font-medium hover:underline">
                    Ouvrir le dossier
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 2. TABLEAU DE BORD MANAGER (KPIs & ANALYTICS)
   * ========================================================================= */
  const totalSamples = samples.length;
  const inProgressAnalyses = analyses.filter(a => a.status === 'en_cours' || a.status === 'a_valider').length;
  const pendingRequests = requests.filter(r => ['soumise', 'en_revue'].includes(r.status)).length;

  // Répartition statistique par statut des demandes
  const requestStatusCount = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(requestStatusCount).map(([status, count]) => ({
    name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    count
  }));

  // Surveillance des stocks consommables
  const lowStockConsumables = consumables.filter(c => c.stockLevel <= c.minThreshold);
  const pieData = [
    { name: 'Stock OK', value: consumables.length - lowStockConsumables.length },
    { name: 'Stock Bas / Rupture', value: lowStockConsumables.length }
  ];

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

  /**
   * Composant carte d'indicateur individuel
   */
  const StatCard = ({ title, value, icon: Icon, colorClass, highlight }: any) => (
    <div className={`bg-white rounded-xl p-6 border ${highlight ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-slate-200 shadow-sm'} flex items-center relative overflow-hidden`}>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="ml-4 z-10">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className="text-2xl font-bold font-display text-slate-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Direction & KPI Laboratoire</h2>
          <p className="text-sm text-slate-500 mt-1">Métriques globales et supervision des demandes en attente de revue.</p>
        </div>
        <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors">
          Générer Bilan
        </button>
      </div>

      {/* Cartes d'indicateurs synthétiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Demandes à Revoir" 
          value={pendingRequests} 
          icon={AlertCircle} 
          colorClass="bg-red-100 text-red-600" 
          highlight={pendingRequests > 0} 
        />
        <StatCard 
          title="Échantillons analysés" 
          value={totalSamples} 
          icon={Box} 
          colorClass="bg-blue-100 text-blue-600" 
        />
        <StatCard 
          title="Analyses en cours" 
          value={inProgressAnalyses} 
          icon={Activity} 
          colorClass="bg-amber-100 text-amber-600" 
        />
      </div>

      {/* Graphiques interactifs Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique à barres : Répartition des statuts */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-display font-semibold text-slate-900 mb-6">Répartition par Statut de Demande</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique en anneau : État des stocks consommables */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-display font-semibold text-slate-900 mb-6">Alertes Consommables</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center flex-wrap gap-4 mt-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center text-xs text-slate-600">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  {entry.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
