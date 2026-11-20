/**
 * Vue Authentification, Réinitialisation de Mot de Passe & Demande de Compte (Login)
 * 
 * Ce composant gère l'ensemble des flux d'accès au système LIMS :
 * 1. Connexion sécurisée par email et mot de passe avec persistance de session
 * 2. Procédure de mot de passe oublié avec génération et vérification d'un code OTP à 6 chiffres
 * 3. Formulaire de demande d'accès pour les nouveaux clients ou collaborateurs
 * 4. Présentation des comptes de démonstration pour les deux instances de laboratoire
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { Lock, Shield, TestTube, Users, Mail, Building2 } from 'lucide-react';

export function Login() {
  const { login } = useLims();
  
  // États de saisie des identifiants
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Mode d'affichage : 'login' (connexion), 'forgot' (demande code), 'reset' (saisie nouveau mdp), 'request' (demande de compte)
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset' | 'request'>('login');
  const [resetCode, setResetCode] = useState('');
  const [devCode, setDevCode] = useState('');
  
  // États spécifiques au formulaire de demande de création de compte
  const [reqName, setReqName] = useState('');
  const [reqCompany, setReqCompany] = useState('');
  const [reqMessage, setReqMessage] = useState('');

  /**
   * Traitement de la connexion utilisateur
   * Envoie les identifiants au serveur backend (/api/auth/login) et charge le profil dans le store
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
      login(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Envoi de la demande de réinitialisation de mot de passe
   * Génère un code OTP côté serveur et bascule sur l'écran de réinitialisation
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur système');
      
      setSuccessMsg(data.message);
      if (data._devCode) setDevCode(data._devCode);
      setMode('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validation du code OTP et mise à jour du mot de passe
   */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: resetCode, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la réinitialisation');
      
      setSuccessMsg('Mot de passe mis à jour avec succès. Vous pouvez vous connecter.');
      setMode('login');
      setPassword('');
      setResetCode('');
      setDevCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Soumission d'une demande de création de compte par un demandeur externe
   * Notifie les managers du laboratoire pour validation
   */
  const handleAccountRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/request-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: reqName, company: reqCompany, message: reqMessage }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la demande');
      
      setSuccessMsg(data.message);
      setMode('login');
      setEmail('');
      setReqName('');
      setReqCompany('');
      setReqMessage('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Logo & Titre de l'application */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-700 mb-4">
          <TestTube className="w-12 h-12" />
        </div>
        <h2 className="text-center text-3xl font-display font-bold text-slate-900 tracking-tight">
          Materio<span className="text-blue-600">Lab</span>
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Système LIMS Multi-Laboratoires & Portail Client Unifié
        </p>
      </div>

      {/* Carte principale de formulaire */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm sm:rounded-2xl sm:px-10 border border-slate-200">
          
          {/* En-tête contextuel selon le mode actif */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-slate-400" />
              {mode === 'login' ? 'Connexion sécurisée' : mode === 'forgot' ? 'Mot de passe oublié' : mode === 'request' ? 'Demander un compte' : 'Réinitialisation'}
            </h3>
            <p className="text-xs text-slate-500">
              {mode === 'login' ? 'Veuillez saisir vos identifiants pour accéder à votre espace.' : mode === 'forgot' ? 'Entrez votre email professionnel pour recevoir un code à 6 chiffres.' : mode === 'request' ? 'Remplissez ce formulaire pour qu\'un responsable de laboratoire valide votre accès.' : 'Entrez le code reçu et définissez votre nouveau mot de passe.'}
            </p>
          </div>

          {/* Bannière d'erreur */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          {/* Bannière de confirmation */}
          {successMsg && (
            <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm border border-emerald-200">
              {successMsg}
              {devCode && (
                <div className="mt-2 text-xs font-mono bg-white p-2 rounded border border-emerald-200">
                  <span className="font-bold">Code de test :</span> {devCode}
                </div>
              )}
            </div>
          )}

          {/* 1. Formulaire de connexion standard */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Adresse Email</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: jean.dupont@aero-tech.fr"
                />
              </div>
              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-slate-700">Mot de passe</label>
                  <button 
                    type="button" 
                    onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }} 
                    className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
              <div className="flex justify-center mt-4">
                <button 
                  type="button" 
                  onClick={() => { setMode('request'); setError(''); setSuccessMsg(''); }} 
                  className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Nouveau demandeur ? Demander un compte
                </button>
              </div>
            </form>
          )}

          {/* 2. Formulaire de mot de passe oublié */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Adresse Email</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !email}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? 'Génération du code...' : 'Recevoir le code de vérification'}
              </button>
              <button 
                type="button" 
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} 
                className="w-full text-center text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Retour à l'écran de connexion
              </button>
            </form>
          )}

          {/* 3. Formulaire de validation du code et réinitialisation */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Code de réinitialisation (6 chiffres)</label>
                <input 
                  type="text" 
                  required 
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm tracking-widest text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !resetCode || !password}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? 'Enregistrement...' : 'Valider le nouveau mot de passe'}
              </button>
              <button 
                type="button" 
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} 
                className="w-full text-center text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Annuler
              </button>
            </form>
          )}

          {/* 4. Formulaire de demande de création de compte */}
          {mode === 'request' && (
            <form onSubmit={handleAccountRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nom complet *</label>
                <input 
                  type="text" 
                  required 
                  value={reqName}
                  onChange={e => setReqName(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Adresse Email professionnelle *</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Société / Établissement</label>
                <input 
                  type="text" 
                  value={reqCompany}
                  onChange={e => setReqCompany(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Besoins / Types d'essais souhaités</label>
                <textarea 
                  value={reqMessage}
                  onChange={e => setReqMessage(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Ex: Essais de traction et contrôle métallographique de soudures..."
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !email || !reqName}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading ? 'Transmission...' : 'Envoyer ma demande d\'accès'}
              </button>
              <button 
                type="button" 
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} 
                className="w-full text-center text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Retour à la connexion
              </button>
            </form>
          )}

          {/* 5. Guide des profils et comptes de démonstration */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Comptes de test (Mot de passe: password123)
            </h4>
            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="pb-1.5 border-b border-slate-200">
                <span className="font-bold text-blue-700">Portail Client Unifié :</span><br />
                <span className="font-mono text-slate-800">jean.dupont@aero-tech.fr</span> (Demandeur)
              </div>
              <div className="pb-1.5 border-b border-slate-200">
                <span className="font-bold text-slate-800">Lab Métallographie (MET) :</span><br />
                <span className="font-mono text-slate-700">marc.durand@materiolab.fr</span> (Manager)<br />
                <span className="font-mono text-slate-700">sophie.martin@materiolab.fr</span> (Laborant)
              </div>
              <div>
                <span className="font-bold text-emerald-800">Lab Mécanique & Poudres (MEC) :</span><br />
                <span className="font-mono text-slate-700">claire.rousseau@materiolab.fr</span> (Manager)<br />
                <span className="font-mono text-slate-700">thomas.bernard@materiolab.fr</span> (Laborant)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
