/**
 * Gabarit Principal de l'Interface Laboratoire (Layout LIMS)
 * 
 * Fournit la structure globale de l'application pour le personnel interne :
 * - Barre latérale fixe (Sidebar) avec navigation contextuelle par onglet et badge d'alertes
 * - En-tête supérieur (Topbar) intégrant la recherche transversale et le centre de notifications
 * - Zone de contenu dynamique avec animations de transition fluides (motion)
 * - Gestion du polling automatique des demandes de comptes pour les managers
 */

import React, { ReactNode, useState } from 'react';
import { LayoutDashboard, Box, Activity, FileText, Settings, Bell, Search, User, Blocks, LogOut, Archive, Building2, ChevronDown, Check } from 'lucide-react';
import * as motion from 'motion/react-client';
import { useLims } from '../store';

/**
 * Propriétés attendues par le composant Layout
 */
interface LayoutProps {
  /** Contenu de la vue active */
  children: ReactNode;
  /** Identifiant de l'onglet actif */
  activeTab: string;
  /** Fonction de changement d'onglet */
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { 
    currentUser, 
    logout, 
    notifications, 
    addNotification, 
    markNotificationAsRead, 
    globalSearchQuery, 
    setGlobalSearchQuery,
    laboratories,
    activeLabId,
    activeLab,
    setActiveLabId
  } = useLims();

  // Menu déroulant de changement d'instance de laboratoire
  const [isLabMenuOpen, setIsLabMenuOpen] = useState(false);

  // Nombre de demandes de création de comptes en attente d'approbation manager
  const [pendingRequestsCount, setPendingRequestsCount] = React.useState(0);
  const notifiedCountRef = React.useRef(0);

  /**
   * Polling périodique (toutes les 15s) pour alerter le manager des nouvelles demandes d'accès
   */
  React.useEffect(() => {
    if (currentUser?.role !== 'manager') return;
    
    const checkRequests = async () => {
      try {
        const res = await fetch('/api/users/requests');
        if (res.ok) {
          const data = await res.json();
          setPendingRequestsCount(data.length);
          
          // Déclenchement d'une notification si de nouvelles demandes sont détectées
          if (data.length > notifiedCountRef.current) {
            const newCount = data.length - notifiedCountRef.current;
            addNotification(
              currentUser.id, 
              'Demande de compte', 
              `Vous avez ${newCount} nouvelle(s) demande(s) en attente.`, 
              'system'
            );
          }
          notifiedCountRef.current = data.length;
        }
      } catch (e) {
        console.error('Erreur lors de la vérification des demandes de compte :', e);
      }
    };
    
    checkRequests();
    const interval = setInterval(checkRequests, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Éléments du menu de navigation interne
  let navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'requests', label: 'Demandes & Workflow', icon: FileText },
    { id: 'samples', label: 'Échantillons & Préparations', icon: Box },
    { id: 'analyses', label: 'Essais & Analyses', icon: Activity },
    { id: 'reports', label: 'Rapports', icon: FileText },
    { id: 'inventory', label: 'Consommables', icon: Archive },
  ];

  // Le constructeur CMS / modèles est restreint aux profils managers
  if (currentUser?.role === 'manager') {
    navItems.push({ id: 'builder', label: 'Config. CMS', icon: Blocks });
  }
  
  navItems.push({ id: 'settings', label: 'Paramètres', icon: Settings });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* 1. Barre Latérale de Navigation (Sidebar) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        {/* En-tête et logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center mr-3 shadow-sm">
            <Blocks className="text-white w-5 h-5" />
          </div>
          <h1 className="font-display font-bold text-xl text-slate-900 tracking-tight">
            Materio<span className="text-blue-600">Lab</span>
          </h1>
        </div>
        
        {/* Badge Instance Laboratoire Active */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`w-2 h-2 rounded-full shrink-0 ${activeLab.id === 'lab-metallurgie' ? 'bg-blue-600' : 'bg-emerald-600'}`} />
              <span className="text-xs font-bold text-slate-800 truncate" title={activeLab.name}>
                {activeLab.shortName}
              </span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
              activeLab.id === 'lab-metallurgie' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {activeLab.code}
            </span>
          </div>
        </div>
        
        {/* Liens de navigation */}
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center">
                  <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-left leading-tight">{item.label}</span>
                </div>
                {item.id === 'settings' && pendingRequestsCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        {/* Profil utilisateur en pied de barre latérale */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm">
                <User className="w-5 h-5" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-slate-900 truncate max-w-[100px]">{currentUser?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{currentUser?.role}</p>
              </div>
            </div>
            <button 
              onClick={logout} 
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" 
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Zone de Contenu Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barre Supérieure (Topbar) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
          {/* Champ de recherche globale */}
          <div className="flex-1 flex items-center">
            <div className="max-w-md w-full relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Rechercher partout (demandes, échantillons, analyses)..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
              />
            </div>
          </div>

          {/* Sélecteur d'Instance de Laboratoire */}
          <div className="relative mr-3">
            <button
              type="button"
              onClick={() => setIsLabMenuOpen(!isLabMenuOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-xs transition-all ${
                activeLab.id === 'lab-metallurgie'
                  ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium">{activeLab.name}</span>
              <span className="sm:hidden font-mono">[{activeLab.code}]</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                activeLab.id === 'lab-metallurgie' ? 'bg-blue-200/70 text-blue-900' : 'bg-emerald-200/70 text-emerald-900'
              }`}>
                {activeLab.code}
              </span>
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-60" />
            </button>

            {isLabMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsLabMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Instances Laboratoires</p>
                    <p className="text-[11px] text-slate-500">Chaque instance dispose de son CMS, ses essais, son personnel et ses consommables.</p>
                  </div>
                  <div className="space-y-1">
                    {laboratories.filter(lab => {
                      if (!currentUser) return true;
                      if (currentUser.role === 'admin') return true;
                      if (currentUser.role === 'manager' || currentUser.role === 'analyste') {
                        return !currentUser.labId || currentUser.labId === 'all' || currentUser.labId === lab.id;
                      }
                      return true;
                    }).map(lab => {
                      const isSelected = lab.id === activeLabId;
                      return (
                        <button
                          key={lab.id}
                          type="button"
                          onClick={() => {
                            setActiveLabId(lab.id);
                            setIsLabMenuOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start justify-between ${
                            isSelected ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${lab.id === 'lab-metallurgie' ? 'bg-blue-600' : 'bg-emerald-600'}`} />
                              <span>{lab.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">[{lab.code}]</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{lab.description}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Menu déroulant des notifications */}
          <div className="ml-4 flex items-center md:ml-6 relative group">
            <button className="p-2 text-slate-400 hover:text-blue-600 relative rounded-full hover:bg-slate-100 transition-colors focus:outline-none">
              <Bell className="h-5 w-5" />
              {notifications.filter(n => !n.read && n.userId === currentUser?.id).length > 0 && (
                <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              )}
            </button>
            
            {/* Volet déroulant des alertes */}
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden flex flex-col max-h-96">
              <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700 text-sm">
                Notifications (Simulateur Email)
              </div>
              <div className="flex-1 overflow-y-auto">
                {notifications.filter(n => n.userId === currentUser?.id).length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">Aucune notification.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.filter(n => n.userId === currentUser?.id).map(notif => (
                      <div 
                        key={notif.id} 
                        className={`p-3 text-sm transition-colors cursor-pointer hover:bg-slate-50 ${!notif.read ? 'bg-blue-50/50' : ''}`} 
                        onClick={() => {
                          markNotificationAsRead(notif.id);
                          if (notif.title === 'Demande de compte') {
                            setActiveTab('settings');
                            setTimeout(() => window.dispatchEvent(new CustomEvent('open-users-tab')), 50);
                          } else if (notif.title.includes('Demande') || notif.title.includes('demande') || notif.title.includes('assignation')) {
                            setActiveTab('requests');
                          }
                        }}
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold text-slate-900">{notif.title}</span>
                          {notif.type === 'email' && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                              Email Envoyé
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-xs line-clamp-2">{notif.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Corps de la page avec animation au changement d'onglet */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
