/**
 * Composant Racine et Routeur d'Affichage Applicatif
 * 
 * Ce composant gère l'aiguillage des vues principales en fonction :
 * 1. De l'état d'authentification (affichage de l'écran de Login si non connecté)
 * 2. Du rôle de l'utilisateur :
 *    - Demandeur : portail dédié orienté soumission de commandes et suivi de statut
 *    - Personnel interne (Analyste / Manager) : console LIMS complète avec Layout latéral
 * 3. De l'onglet actif sélectionné dans la navigation
 */

import React, { useState } from 'react';
import { LimsProvider, useLims } from './store';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { Samples } from './views/Samples';
import { Analyses } from './views/Analyses';
import { Reports } from './views/Reports';
import { BuilderCMS } from './views/BuilderCMS';
import { Inventory } from './views/Inventory';
import { Settings } from './views/Settings';
import { Login } from './views/Login';
import { RequesterPortal } from './views/RequesterPortal';
import { RequestsInternal } from './views/RequestsInternal';
import { LogOut } from 'lucide-react';

/**
 * Gestionnaire principal de navigation conditionnelle
 */
function Main() {
  // Onglet actuellement affiché à l'écran
  const [activeTab, setActiveTab] = useState('dashboard');
  const { currentUser, logout } = useLims();

  // Redirection vers le formulaire d'identification si aucune session n'est ouverte
  if (!currentUser) return <Login />;
  
  // Vue simplifiée et dédiée pour les clients et donneurs d'ordres
  if (currentUser.role === 'demandeur') {
    return (
      <>
        {activeTab === 'settings' ? (
          <Settings onBack={() => setActiveTab('dashboard')} />
        ) : (
          <RequesterPortal onOpenSettings={() => setActiveTab('settings')} />
        )}
        {/* Bouton flottant de déconnexion rapide pour les demandeurs */}
        <button 
          onClick={logout} 
          title="Se déconnecter"
          className="fixed bottom-6 right-6 bg-white shadow-xl border border-slate-200 rounded-full p-4 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors z-50"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </>
    );
  }

  /**
   * Rendu de la vue opérationnelle sélectionnée pour l'équipe interne du laboratoire
   */
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'requests':
        return <RequestsInternal />;
      case 'samples':
        return <Samples />;
      case 'analyses':
        return <Analyses />;
      case 'reports':
        return <Reports />;
      case 'inventory':
        return <Inventory />;
      case 'builder':
        // Le module de conception de formulaires et templates est réservé aux managers
        return currentUser.role === 'manager' ? <BuilderCMS /> : <Dashboard />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

/**
 * Composant d'encapsulation racine fournissant le contexte global LimsProvider
 */
export default function App() {
  return (
    <LimsProvider>
      <Main />
    </LimsProvider>
  );
}
