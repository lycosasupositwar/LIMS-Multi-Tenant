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
import { jsPDF } from 'jspdf';
import { useLims } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Box, Activity, CheckCircle, Factory, FileText, AlertCircle, ClipboardClock, Download } from 'lucide-react';
import { RequestStatus } from '../types';

export function Dashboard() {
  const { currentUser, samples, analyses, requests, materialTemplates, consumables, analysisTemplates, labSettings } = useLims() as any;

  /**
   * Génère le badge visuel coloré correspondant à un statut de demande
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

  /* =========================================================================
   * 1. TABLEAU DE BORD OPÉRATEUR (ANALYSTE)
   * ========================================================================= */
  if (currentUser?.role === 'analyste') {
    // Dossiers en cours assignés à cet opérateur
    const assignedRequests = requests.filter(
      r => r.assignedTo === currentUser.id && ['assignee', 'En Cours', 'En Validation'].includes(r.status)
    );
    const pendingSamples = samples.filter(s => s.status === 'receptionne' || s.status === 'en_preparation');
    const myAnalyses = analyses.filter(a => a.technician === currentUser.name && a.status === 'En Cours');

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
  const inProgressAnalyses = analyses.filter(a => a.status === 'En Cours' || a.status === 'a_valider').length;
  const pendingRequests = requests.filter(r => ['soumise', 'En Revue'].includes(r.status)).length;
  const inProgressRequests = requests.filter(r => ['assignee', 'En Cours', 'En Validation'].includes(r.status)).length;

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
   * Produit un bilan PDF de pilotage à partir des données réellement disponibles dans le LIMS.
   * Les chiffres sont calculés à la génération et les données manquantes ne sont pas inventées.
   */
  const generateBilan = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    const generatedAt = new Date();
    const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(generatedAt);
    const labName = labSettings?.labName || 'Laboratoire';
    const labAddress = labSettings?.labAddress || '';
    const labContact = [labSettings?.contactEmail, labSettings?.phone].filter(Boolean).join(' · ');
    const scopedLabId = currentUser?.labId;
    const inScope = (item: any) => !scopedLabId || item?.labId === scopedLabId;
    const scopedRequests = requests.filter(inScope);
    const scopedSamples = samples.filter(inScope);
    const scopedAnalyses = analyses.filter(inScope);
    const scopedConsumables = consumables.filter(inScope);
    const scopedMaterials = materialTemplates.filter(inScope);
    const scopedAnalysisTemplates = (analysisTemplates || []).filter(inScope);
    const statusCount = (items: any[]) => items.reduce((acc: Record<string, number>, item: any) => {
      const status = String(item.status || 'Non défini'); acc[status] = (acc[status] || 0) + 1; return acc;
    }, {});
    const reqStatuses = statusCount(scopedRequests);
    const sampleStatuses = statusCount(scopedSamples);
    const analysisStatuses = statusCount(scopedAnalyses);
    const lowStock = scopedConsumables.filter((c: any) => Number(c.stockLevel) <= Number(c.minThreshold));
    const validatedAnalyses = scopedAnalyses.filter((a: any) => ['valide', 'termine'].includes(a.status)).length;
    const completedRequests = scopedRequests.filter((r: any) => r.status === 'terminee').length;
    const pendingValidation = scopedAnalyses.filter((a: any) => a.status === 'a_valider').length;
    const openRequests = scopedRequests.filter((r: any) => !['terminee', 'rejetee', 'brouillon'].includes(r.status)).length;
    const pct = (n: number, d: number) => d ? `${Math.round(n / d * 100)} %` : 'N/D';
    let y = 18;

    const ensureSpace = (needed = 16) => { if (y + needed > pageHeight - 17) { doc.addPage(); y = 18; } };
    const section = (title: string) => {
      ensureSpace(17); doc.setFillColor(30, 64, 104); doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(title, margin + 3, y + 5.4);
      y += 13; doc.setTextColor(35, 45, 58); doc.setFont('helvetica', 'normal');
    };
    const line = (label: string, value: string | number) => {
      const lines = doc.splitTextToSize(`${label} : ${value}`, contentWidth - 4);
      ensureSpace(lines.length * 5 + 2); doc.setFontSize(9); doc.text(lines, margin + 2, y); y += lines.length * 4.8 + 1.8;
    };
    const table = (headers: string[], rows: string[][], widths?: number[]) => {
      const cols = widths || headers.map(() => contentWidth / headers.length);
      const drawRow = (cells: string[], header = false) => {
        const wrapped = cells.map((c, i) => doc.splitTextToSize(String(c ?? '—'), cols[i] - 3));
        const rowH = Math.max(7, ...wrapped.map(w => w.length * 4 + 3));
        ensureSpace(rowH + 1);
        let x = margin;
        cells.forEach((_, i) => {
          if (header) doc.setFillColor(226, 232, 240); else doc.setFillColor(255, 255, 255);
          doc.setDrawColor(203, 213, 225); doc.rect(x, y - 3.5, cols[i], rowH, 'FD');
          doc.setTextColor(35, 45, 58); doc.setFont('helvetica', header ? 'bold' : 'normal'); doc.setFontSize(8);
          doc.text(wrapped[i], x + 1.5, y + 0.5); x += cols[i];
        });
        y += rowH;
      };
      drawRow(headers, true); rows.forEach(row => drawRow(row)); y += 4;
    };

    // Page de garde / identification
    doc.setFillColor(15, 45, 78); doc.rect(0, 0, pageWidth, 43, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.text('BILAN D’ACTIVITÉ DU LABORATOIRE', margin, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(labName, margin, 27);
    doc.setFontSize(8.5); doc.text(`Généré le ${dateLabel}`, margin, 34);
    doc.setTextColor(35, 45, 58); y = 52;
    if (labAddress) line('Adresse', labAddress);
    if (labContact) line('Contact', labContact);
    line('Périmètre', scopedLabId ? 'Données du laboratoire associé au compte connecté' : 'Toutes les données accessibles au compte connecté');
    line('Préparé par', currentUser?.name || 'Utilisateur connecté');

    section('1. Synthèse exécutive');
    table(['Indicateur', 'Valeur', 'Lecture'], [
      ['Demandes enregistrées', String(scopedRequests.length), `${openRequests} ouvertes / en traitement`],
      ['Demandes terminées', String(completedRequests), pct(completedRequests, scopedRequests.length) + ' des demandes'],
      ['Échantillons enregistrés', String(scopedSamples.length), `${scopedSamples.filter((s: any) => s.status === 'termine').length} terminés`],
      ['Analyses enregistrées', String(scopedAnalyses.length), `${validatedAnalyses} validées ou terminées`],
      ['Analyses en attente de validation', String(pendingValidation), pendingValidation ? 'Action requise' : 'Aucune en attente'],
      ['Consommables sous seuil', String(lowStock.length), lowStock.length ? 'Risque d’approvisionnement' : 'Aucune alerte de seuil']
    ], [contentWidth * .42, contentWidth * .18, contentWidth * .40]);

    section('2. Activité des demandes');
    line('Demandes à revoir', scopedRequests.filter((r: any) => ['soumise', 'En Revue'].includes(r.status)).length);
    line('Taux de clôture', pct(completedRequests, scopedRequests.length));
    table(['Statut', 'Nombre'], (Object.entries(reqStatuses) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]), [contentWidth * .7, contentWidth * .3]);
    const recentRequests = [...scopedRequests].sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 12);
    table(['Référence', 'Demande', 'Statut', 'Créée le'], recentRequests.map((r: any) => [r.id, r.title || 'Sans titre', r.status, r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : 'N/D']), [contentWidth * .22, contentWidth * .36, contentWidth * .23, contentWidth * .19]);

    section('3. Échantillons et traçabilité');
    table(['Statut échantillon', 'Nombre'], (Object.entries(sampleStatuses) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]), [contentWidth * .7, contentWidth * .3]);
    const recentSamples = [...scopedSamples].sort((a: any, b: any) => String(b.receivedAt || '').localeCompare(String(a.receivedAt || ''))).slice(0, 12);
    table(['Code-barres', 'Demande', 'Client / projet', 'Statut'], recentSamples.map((s: any) => [s.barcode || s.id, s.requestId || '—', [s.client, s.project].filter(Boolean).join(' / ') || '—', s.status]), [contentWidth * .24, contentWidth * .2, contentWidth * .34, contentWidth * .22]);

    section('4. Analyses et validation technique');
    line('Analyses validées / terminées', `${validatedAnalyses} (${pct(validatedAnalyses, scopedAnalyses.length)})`);
    line('Analyses en cours', scopedAnalyses.filter((a: any) => a.status === 'En Cours').length);
    line('Analyses en attente de validation', pendingValidation);
    table(['Statut analyse', 'Nombre'], (Object.entries(analysisStatuses) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]), [contentWidth * .7, contentWidth * .3]);
    const recentAnalyses = [...scopedAnalyses].sort((a: any, b: any) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 15);
    table(['Échantillon', 'Méthode / modèle', 'Technicien', 'Statut', 'Mise à jour'], recentAnalyses.map((a: any) => [a.sampleId, scopedAnalysisTemplates.find((t: any) => t.id === a.templateId)?.name || a.templateId, a.technician || 'Non assigné', a.status, a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('fr-FR') : 'N/D']), [contentWidth * .19, contentWidth * .28, contentWidth * .19, contentWidth * .17, contentWidth * .19]);

    section('5. Matériaux et modèles disponibles');
    line('Modèles de matériaux configurés', scopedMaterials.length);
    line('Modèles de matériaux actifs', scopedMaterials.filter((m: any) => m.isActive !== false).length);
    line('Modèles d’analyses configurés', scopedAnalysisTemplates.length);
    table(['Modèle matériau', 'Catégorie', 'Propriétés définies'], scopedMaterials.slice(0, 20).map((m: any) => [m.name, m.category || '—', String(m.fields?.length || 0)]), [contentWidth * .48, contentWidth * .28, contentWidth * .24]);

    section('6. Stocks et risques opérationnels');
    line('Références de consommables suivies', scopedConsumables.length);
    line('Références sous seuil minimum', lowStock.length);
    table(['Consommable', 'Stock', 'Seuil mini', 'Unité', 'État'], lowStock.concat(scopedConsumables.filter((c: any) => Number(c.stockLevel) > Number(c.minThreshold)).slice(0, 8)).slice(0, 20).map((c: any) => [c.name, String(c.stockLevel), String(c.minThreshold), c.unit || '—', Number(c.stockLevel) <= Number(c.minThreshold) ? 'ALERTE' : 'OK']), [contentWidth * .34, contentWidth * .15, contentWidth * .17, contentWidth * .13, contentWidth * .21]);

    section('7. Points d’attention et limites du bilan');
    const risks = [] as string[];
    if (pendingValidation) risks.push(`${pendingValidation} analyse(s) attend(ent) une validation technique.`);
    if (openRequests) risks.push(`${openRequests} demande(s) ne sont pas clôturées.`);
    if (lowStock.length) risks.push(`${lowStock.length} consommable(s) sont au seuil minimum ou en dessous.`);
    if (!risks.length) risks.push('Aucune alerte automatique identifiée parmi les indicateurs suivis. Cela ne remplace pas une revue qualité.');
    risks.forEach(r => line('•', r));
    line('Données de délai', 'Les délais moyens et le respect des échéances ne sont pas calculés car les données de dates d’échéance et d’étapes horodatées ne sont pas uniformément disponibles.');
    line('Interprétation', 'Ce bilan est un rapport opérationnel généré à partir des données disponibles au moment de l’export. Il ne constitue pas, à lui seul, une preuve de conformité ISO/IEC 17025 ni un rapport d’essai validé.');

    // Pied de page paginé
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setDrawColor(203, 213, 225); doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text(`${labName} · Bilan généré le ${generatedAt.toLocaleDateString('fr-FR')}`, margin, pageHeight - 7);
      doc.text(`Page ${i}/${pages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }
    const fileDate = generatedAt.toISOString().slice(0, 10);
    doc.save(`bilan-laboratoire-${fileDate}.pdf`);
  };

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
        <button onClick={generateBilan} className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-800 transition-colors shadow-sm" title="Télécharger un bilan PDF complet de l’activité du laboratoire">
          <Download className="w-4 h-4" />
          Générer Bilan PDF
        </button>
      </div>

      {/* Cartes d'indicateurs synthétiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
          title="Demandes en cours" 
          value={inProgressRequests} 
          icon={ClipboardClock} 
          colorClass="bg-amber-100 text-amber-600" 
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
