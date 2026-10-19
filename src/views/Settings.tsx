/**
 * Vue Paramètres Généraux & Administration Système (Settings)
 * 
 * Cette vue centralise la gouvernance et le paramétrage du laboratoire :
 * 1. Sécurité du profil utilisateur
 * 2. Gestion des utilisateurs & habilitations (Manager & Admin)
 * 3. Configuration et identité du laboratoire
 * 4. Sauvegarde, Patchs & Déploiement à chaud
 * 5. Configuration du Serveur Mail SMTP (Admin uniquement)
 * 6. Console de Diagnostic & Logs (Admin uniquement)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLims } from '../store';
import { 
  Building, 
  Phone, 
  Mail, 
  Award, 
  Save, 
  Key, 
  UserPlus, 
  Users, 
  Shield, 
  Clock, 
  Check, 
  X, 
  ArrowLeft, 
  AlertTriangle, 
  Download, 
  Upload, 
  Settings2, 
  Trash2, 
  Plus, 
  Terminal, 
  RefreshCw, 
  Search, 
  Bug,
  Server,
  Send
} from 'lucide-react';
import { 
  LogEntry, 
  getFrontendLogs, 
  clearFrontendLogs, 
  subscribeFrontendLogs 
} from '../utils/logger';

export function Settings({ onBack }: { onBack?: () => void }) {
  const { 
    labSettings, 
    updateLabSettings, 
    currentUser, 
    users, 
    fetchUsers, 
    purgeData, 
    applyPatch, 
    materialTemplates, 
    analysisTemplates, 
    requestTemplates, 
    reportTemplates,
    laboratories,
    addLaboratory,
    deleteLaboratory
  } = useLims();

  // Navigation par onglets ('smtp' et 'logs' sont réservés aux admins)
  const [activeTab, setActiveTab] = useState<'profile' | 'lab' | 'users' | 'system' | 'smtp' | 'logs'>('profile');
  
  // Options de la zone de purge
  const [purgeOptions, setPurgeOptions] = useState({
    requests: false,
    samples: false,
    analyses: false,
    reports: false,
    notifications: false,
    consumables: false
  });
  const [purgeMsg, setPurgeMsg] = useState({ type: '', text: '' });
  const [confirmPurge, setConfirmPurge] = useState(false);

  // Écoute de l'événement d'ouverture directe de l'onglet utilisateurs
  useEffect(() => {
    const handleOpenUsers = () => setActiveTab('users');
    window.addEventListener('open-users-tab', handleOpenUsers);
    return () => window.removeEventListener('open-users-tab', handleOpenUsers);
  }, []);
  
  // États de mise à jour du mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  
  // États de création d'utilisateurs et approbation
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'demandeur', company: '', labId: '' });
  const [userMsg, setUserMsg] = useState({ type: '', text: '' });
  const [accountRequests, setAccountRequests] = useState<any[]>([]);

  // ==========================================
  // États Configuration Serveur Mail SMTP (Admin uniquement)
  // ==========================================
  const [smtpConfig, setSmtpConfig] = useState({
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'LIMS Laboratoire',
    fromEmail: ''
  });
  const [smtpMsg, setSmtpMsg] = useState({ type: '', text: '' });
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);

  const fetchSmtpConfig = async () => {
    if (currentUser?.role !== 'admin') return;
    try {
      const res = await fetch('/api/admin/smtp');
      if (res.ok) {
        const data = await res.json();
        setSmtpConfig({
          enabled: Boolean(data.enabled),
          host: data.host || '',
          port: data.port || 587,
          secure: Boolean(data.secure),
          user: data.user || '',
          pass: data.pass || '',
          fromName: data.fromName || 'LIMS Laboratoire',
          fromEmail: data.fromEmail || ''
        });
        if (!testEmailAddress && currentUser?.email) {
          setTestEmailAddress(currentUser.email);
        }
      }
    } catch (e) {
      console.error('Erreur lors du chargement de la configuration SMTP :', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'smtp' && currentUser?.role === 'admin') {
      fetchSmtpConfig();
    }
  }, [activeTab, currentUser]);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpMsg({ type: '', text: '' });
    setIsSavingSmtp(true);
    try {
      const res = await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de sauvegarde');
      setSmtpMsg({ type: 'success', text: 'Paramètres du serveur mail enregistrés avec succès.' });
      fetchSmtpConfig();
    } catch (err: any) {
      setSmtpMsg({ type: 'error', text: err.message });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setSmtpMsg({ type: '', text: '' });
    setIsTestingSmtp(true);
    try {
      // On sauvegarde d'abord la configuration courante avant de lancer le test
      await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig)
      });

      const res = await fetch('/api/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail: testEmailAddress || currentUser?.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec du test SMTP');
      setSmtpMsg({ type: 'success', text: data.message });
    } catch (err: any) {
      setSmtpMsg({ type: 'error', text: err.message });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  // ==========================================
  // États de la Console de Logs (Admin uniquement)
  // ==========================================
  const [frontendLogs, setFrontendLogs] = useState<LogEntry[]>(() => getFrontendLogs());
  const [backendLogs, setBackendLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [logSourceFilter, setLogSourceFilter] = useState<'all' | 'frontend' | 'backend'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  useEffect(() => {
    return subscribeFrontendLogs(() => {
      setFrontendLogs([...getFrontendLogs()]);
    });
  }, []);

  const fetchBackendLogs = async () => {
    if (currentUser?.role !== 'admin') return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/logs');
      if (res.ok) {
        const data = await res.json();
        setBackendLogs(data.logs || []);
      }
    } catch {
      // Silencieux si l'API n'est pas joignable momentanément
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && currentUser?.role === 'admin') {
      fetchBackendLogs();
      if (autoRefreshLogs) {
        const interval = setInterval(fetchBackendLogs, 4000);
        return () => clearInterval(interval);
      }
    }
  }, [activeTab, currentUser, autoRefreshLogs]);

  const handleClearAllLogs = async () => {
    clearFrontendLogs();
    if (currentUser?.role === 'admin') {
      try {
        await fetch('/api/admin/logs', { method: 'DELETE' });
        await fetchBackendLogs();
      } catch (e) {
        console.error('Erreur lors de la purge des logs serveur:', e);
      }
    }
  };

  const exportLogsJson = () => {
    const combined = [...frontendLogs, ...backendLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const blob = new Blob([JSON.stringify(combined, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lims_diagnostics_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = useMemo(() => {
    const merged = [...frontendLogs, ...backendLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return merged.filter((log) => {
      if (logLevelFilter !== 'all' && log.level !== logLevelFilter) return false;
      if (logSourceFilter !== 'all' && log.source !== logSourceFilter) return false;
      if (logSearchQuery.trim() !== '') {
        const q = logSearchQuery.toLowerCase();
        const matchMsg = log.message.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q) || false;
        if (!matchMsg && !matchDetails) return false;
      }
      return true;
    });
  }, [frontendLogs, backendLogs, logLevelFilter, logSourceFilter, logSearchQuery]);

  const errorCount = useMemo(
    () => [...frontendLogs, ...backendLogs].filter((l) => l.level === 'error').length,
    [frontendLogs, backendLogs]
  );

  const warnCount = useMemo(
    () => [...frontendLogs, ...backendLogs].filter((l) => l.level === 'warn').length,
    [frontendLogs, backendLogs]
  );

  /**
   * Récupération des demandes de création de compte en attente
   */
  const fetchRequests = async () => {
    if (currentUser?.role === 'manager' || currentUser?.role === 'admin') {
      try {
        const res = await fetch('/api/users/requests');
        if (res.ok) setAccountRequests(await res.json());
      } catch (e) {
        console.error("Erreur lors de la récupération des demandes d'accès:", e);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchRequests();
      fetchUsers();
    }
  }, [activeTab, currentUser]);

  const handleApproveRequest = async (req: any) => {
    try {
      const tempPassword = Math.random().toString(36).slice(-8);
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: req.name,
          email: req.email,
          password: tempPassword,
          role: 'demandeur',
          company: req.company || ''
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      await fetch(`/api/users/requests/${req.id}`, { method: 'DELETE' });
      fetchRequests();
      fetchUsers();
      setUserMsg({ type: 'success', text: `Demande approuvée. Utilisateur créé avec le mot de passe temporaire : ${tempPassword}` });
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUserMsg({ type: 'success', text: 'Utilisateur supprimé avec succès.' });
      fetchUsers();
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message });
    }
  };

  const deleteRequest = async (id: string) => {
    try {
      await fetch(`/api/users/requests/${id}`, { method: 'DELETE' });
      fetchRequests();
    } catch (e) {
      console.error("Erreur lors de la suppression de la demande:", e);
    }
  };

  const [patchMsg, setPatchMsg] = useState({ type: '', text: '' });

  const exportPatch = () => {
    const patchData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      materialTemplates,
      analysisTemplates,
      requestTemplates,
      reportTemplates,
      labSettings
    };
    const blob = new Blob([JSON.stringify(patchData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lims_config_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importPatch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const patchData = JSON.parse(content);
        
        if (!patchData.materialTemplates || !patchData.analysisTemplates) {
          throw new Error("Le fichier ne semble pas être un patch valide.");
        }
        
        applyPatch(patchData);
        setPatchMsg({ type: 'success', text: "Configuration appliquée avec succès. L'application a été mise à jour sans corrompre les données existantes." });
      } catch (err: any) {
        setPatchMsg({ type: 'error', text: 'Erreur lors de la lecture de la configuration: ' + err.message });
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };
  
  const [formData, setFormData] = useState(labSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFormData(labSettings);
  }, [labSettings]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPwdMsg({ type: 'success', text: 'Mot de passe mis à jour avec succès.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.message });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUserMsg({ type: 'success', text: 'Utilisateur créé avec succès.' });
      setNewUser({ name: '', email: '', password: '', role: 'demandeur', company: '', labId: '' });
      fetchUsers();
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message });
    }
  };

  const handleIsoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const certs = e.target.value.split(',').map(s => s.trim());
    setFormData({ ...formData, isoCertifications: certs });
    setSaved(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setSaved(false);
  };
  
  const handleTableStyleChange = (field: string, value: string | number) => {
    const newSettings = { 
      ...formData, 
      tableStyles: { 
        ...formData.tableStyles, 
        [field]: value 
      } as any 
    };
    setFormData(newSettings);
    updateLabSettings(newSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSave = () => {
    updateLabSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {onBack && (
        <button onClick={onBack} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour à l'espace client
        </button>
      )}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Paramètres</h2>
          <p className="text-sm text-slate-500 mt-1">Gérez votre profil, le laboratoire et les paramètres système.</p>
        </div>
        {activeTab === 'lab' && (
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
          >
            <Save className="w-5 h-5 mr-2" />
            {saved ? 'Enregistré !' : 'Enregistrer'}
          </button>
        )}
      </div>

      {/* Onglets de configuration */}
      <div className="flex flex-wrap space-x-1 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-2 px-4 text-sm font-medium border-b-2 outline-none transition-colors ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Sécurité du profil
        </button>
        {(currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
          <>
            <button
              onClick={() => setActiveTab('lab')}
              className={`py-2 px-4 text-sm font-medium border-b-2 outline-none transition-colors ${activeTab === 'lab' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Building className="w-4 h-4 inline mr-2" />
              Laboratoire
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-4 text-sm font-medium border-b-2 outline-none transition-colors ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Utilisateurs
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`py-2 px-4 text-sm font-medium border-b-2 outline-none transition-colors ${activeTab === 'system' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Settings2 className="w-4 h-4 inline mr-2" />
              Sauvegarde Config.
            </button>
          </>
        )}
        {/* Onglets strictement réservés aux Administrateurs après Sauvegarde Config. */}
        {currentUser?.role === 'admin' && (
          <>
            <button
              onClick={() => setActiveTab('smtp')}
              className={`py-2 px-4 text-sm font-medium border-b-2 outline-none transition-colors flex items-center ${activeTab === 'smtp' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Mail className="w-4 h-4 inline mr-2" />
              Serveur Mail (SMTP)
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-2 px-4 text-sm font-medium border-b-2 outline-none transition-colors flex items-center ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Terminal className="w-4 h-4 inline mr-2" />
              Console Logs
              {errorCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
                  {errorCount}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* Onglet 1 : Sécurité du profil */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
              <Key className="w-5 h-5 mr-2 text-slate-400" />
              Changer mon mot de passe
            </h3>
          </div>
          <div className="p-6">
            {pwdMsg.text && (
              <div className={`mb-4 p-3 rounded-md text-sm border ${pwdMsg.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {pwdMsg.text}
              </div>
            )}
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={!currentPassword || !newPassword}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Mettre à jour
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Onglet 2 : Gestion des utilisateurs */}
      {activeTab === 'users' && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
        <div className="space-y-6">
          {accountRequests.length > 0 && (
            <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden">
              <div className="p-4 border-b border-amber-200 bg-amber-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-800 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Demandes de création de compte en attente ({accountRequests.length})
                </h3>
              </div>
              <div className="divide-y divide-amber-100">
                {accountRequests.map(req => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-amber-900">{req.name} <span className="text-amber-700 font-normal">({req.email})</span></div>
                      <div className="text-sm text-amber-800">{req.company}</div>
                      {req.message && <div className="text-xs text-amber-700 mt-1 italic">"{req.message}"</div>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleApproveRequest(req)} className="flex items-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700">
                        <Check className="w-3 h-3 mr-1" /> Approuver
                      </button>
                      <button onClick={() => deleteRequest(req.id)} className="flex items-center px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200">
                        <X className="w-3 h-3 mr-1" /> Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-slate-400" />
                Créer un utilisateur
              </h3>
            </div>
            <div className="p-6">
              {userMsg.text && (
                <div className={`mb-4 p-3 rounded-md text-sm border ${userMsg.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {userMsg.text}
                </div>
              )}
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
                  <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe temporaire</label>
                  <input type="text" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
                  <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="demandeur">Demandeur (Client)</option>
                    <option value="analyste">Analyste (Labo)</option>
                    <option value="manager">Manager</option>
                    {currentUser?.role === 'admin' && (<option value="admin">Admin</option>)}
                  </select>
                </div>
                {(newUser.role === 'demandeur' || newUser.role === 'manager' || newUser.role === 'analyste') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Entreprise / Laboratoire</label>
                    <input type="text" value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                  </div>
                )}
                {(newUser.role === 'manager' || newUser.role === 'analyste') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Laboratoire assigné</label>
                    <select
                      value={newUser.labId || ''}
                      onChange={e => setNewUser({...newUser, labId: e.target.value})}
                      className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Aucun (Accès global)</option>
                      <option value="all">Tous les laboratoires (all)</option>
                      {laboratories.map(lab => (
                        <option key={lab.id} value={lab.id}>{lab.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-2 mt-2">
                  <button type="submit" className="w-full sm:w-auto flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700">
                    <UserPlus className="w-4 h-4 mr-2" /> Créer le compte
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Users className="w-5 h-5 mr-2 text-slate-400" />
                Utilisateurs existants ({users.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {users.map(u => (
                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-sm text-slate-500">{u.email} {u.company && `- ${u.company}`}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`text-xs px-2 py-1 rounded-full ${(u.role === 'manager' || u.role === 'admin') ? 'bg-purple-100 text-purple-700' : u.role === 'analyste' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {u.role.toUpperCase()}
                    </div>
                    {currentUser?.role === 'admin' && currentUser.id !== u.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Supprimer l'utilisateur"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Onglet 3 : Paramètres du laboratoire */}
      {activeTab === 'lab' && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Building className="w-5 h-5 mr-2 text-slate-400" />
                Identité
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom du Laboratoire</label>
                  <input
                    type="text"
                    name="labName"
                    value={formData.labName}
                    onChange={handleChange}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL du Logo (Optionnel)</label>
                  <input
                    type="text"
                    name="logoUrl"
                    value={formData.logoUrl || ''}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adresse complète</label>
                  <textarea
                    name="labAddress"
                    value={formData.labAddress}
                    onChange={handleChange}
                    rows={2}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-slate-400" />
                Contact
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                    <Mail className="w-4 h-4 mr-1 text-slate-400" /> Email public
                  </label>
                  <input
                    type="email"
                    name="contactEmail"
                    value={formData.contactEmail}
                    onChange={handleChange}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                    <Phone className="w-4 h-4 mr-1 text-slate-400" /> Téléphone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Award className="w-5 h-5 mr-2 text-slate-400" />
                Accréditations
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Certifications (séparées par des virgules)</label>
                <input
                  type="text"
                  name="isoCertifications"
                  value={formData.isoCertifications.join(', ')}
                  onChange={handleIsoChange}
                  placeholder="ISO 9001:2015, ISO 17025:2017"
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Ces certifications apparaîtront en bas de chaque rapport généré pour certifier la conformité des analyses.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Building className="w-5 h-5 mr-2 text-slate-400" />
                Configuration des Identifiants (Préfixes)
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Préfixe Demandes</label>
                <input
                  type="text"
                  value={formData.idPrefixes?.request || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, idPrefixes: { ...formData.idPrefixes, request: e.target.value } as any });
                    setSaved(false);
                  }}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="REQ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Préfixe Échantillons</label>
                <input
                  type="text"
                  value={formData.idPrefixes?.sample || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, idPrefixes: { ...formData.idPrefixes, sample: e.target.value } as any });
                    setSaved(false);
                  }}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="ECH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Préfixe Enrobages</label>
                <input
                  type="text"
                  value={formData.idPrefixes?.subSample || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, idPrefixes: { ...formData.idPrefixes, subSample: e.target.value } as any });
                    setSaved(false);
                  }}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="ENR"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2 text-slate-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M21 9H3"/><path d="M21 15H3"/><path d="M12 3v18"/></svg>
                Design des tableaux générés (Rapports)
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-slate-600 mb-4">Personnalisez l'apparence des tableaux de résultats (XML) générés automatiquement par l'application pour vos rapports Word/PDF.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Couleur d'en-tête (Hex)</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={"#" + (formData.tableStyles?.headerBgColor || "E2E8F0")}
                      onChange={(e) => handleTableStyleChange('headerBgColor', e.target.value.replace('#', '').toUpperCase())}
                      className="w-10 h-10 rounded border-slate-300 shadow-sm cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.tableStyles?.headerBgColor || "E2E8F0"}
                      onChange={(e) => handleTableStyleChange('headerBgColor', e.target.value.replace('#', '').toUpperCase())}
                      className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
                      placeholder="E2E8F0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Couleur des bordures (Hex)</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={"#" + (formData.tableStyles?.borderColor || "000000")}
                      onChange={(e) => handleTableStyleChange('borderColor', e.target.value.replace('#', '').toUpperCase())}
                      className="w-10 h-10 rounded border-slate-300 shadow-sm cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.tableStyles?.borderColor || "000000"}
                      onChange={(e) => handleTableStyleChange('borderColor', e.target.value.replace('#', '').toUpperCase())}
                      className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
                      placeholder="000000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Épaisseur des bordures</label>
                  <select
                    value={formData.tableStyles?.borderSize || 4}
                    onChange={(e) => handleTableStyleChange('borderSize', parseInt(e.target.value))}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="0">Aucune</option>
                    <option value="2">Très fine (0.25pt)</option>
                    <option value="4">Standard (0.5pt)</option>
                    <option value="8">Épaisse (1pt)</option>
                    <option value="12">Très épaisse (1.5pt)</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 border rounded-lg p-4 bg-slate-50">
                 <h4 className="text-sm font-medium text-slate-700 mb-2">Aperçu du rendu</h4>
                 <table className="w-full text-sm bg-white" style={{ borderCollapse: 'collapse' }}>
                   <thead>
                     <tr>
                       <th style={{ backgroundColor: "#" + (formData.tableStyles?.headerBgColor || "E2E8F0"), border: `${(formData.tableStyles?.borderSize || 4) / 8}px solid #${formData.tableStyles?.borderColor || "000000"}`, padding: '8px' }}>En-tête 1</th>
                       <th style={{ backgroundColor: "#" + (formData.tableStyles?.headerBgColor || "E2E8F0"), border: `${(formData.tableStyles?.borderSize || 4) / 8}px solid #${formData.tableStyles?.borderColor || "000000"}`, padding: '8px' }}>En-tête 2</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr>
                       <td style={{ border: `${(formData.tableStyles?.borderSize || 4) / 8}px solid #${formData.tableStyles?.borderColor || "000000"}`, padding: '8px' }}>Donnée 1</td>
                       <td style={{ border: `${(formData.tableStyles?.borderSize || 4) / 8}px solid #${formData.tableStyles?.borderColor || "000000"}`, padding: '8px' }}>Donnée 2</td>
                     </tr>
                   </tbody>
                 </table>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 overflow-hidden mt-8">
            <div className="p-6 border-b border-red-200">
              <h3 className="text-lg font-semibold text-red-800 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Zone de danger
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-red-700 mb-4">
                Sélectionnez les données à purger du système. Cette action est irréversible.
              </p>
              
              <div className="space-y-3 mb-6 bg-white/50 p-4 rounded-lg border border-red-100">
                {Object.keys(purgeOptions).map((key) => {
                  const labels: Record<string, string> = {
                    requests: 'Demandes (Requests)',
                    samples: 'Échantillons (Samples)',
                    analyses: 'Analyses',
                    reports: 'Rapports (Reports)',
                    notifications: 'Notifications',
                    consumables: 'Consommables / Inventaire'
                  };
                  return (
                    <label key={key} className="flex items-center space-x-3 text-sm text-red-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(purgeOptions as any)[key]}
                        onChange={(e) => { setPurgeOptions({...purgeOptions, [key]: e.target.checked}); setConfirmPurge(false); setPurgeMsg({ type: '', text: '' }); }}
                        className="rounded border-red-300 text-red-600 focus:ring-red-500"
                      />
                      <span>{labels[key]}</span>
                    </label>
                  );
                })}
              </div>

              {purgeMsg.text && (
                <div className={`mb-4 p-3 rounded-md text-sm border ${purgeMsg.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {purgeMsg.text}
                </div>
              )}

              <button
                onClick={() => {
                  const selectedCount = Object.values(purgeOptions).filter(Boolean).length;
                  if (selectedCount === 0) {
                    setPurgeMsg({ type: 'error', text: 'Veuillez sélectionner au moins un type de données à supprimer.' });
                    setConfirmPurge(false);
                    return;
                  }
                  
                  if (!confirmPurge) {
                    setConfirmPurge(true);
                    setPurgeMsg({ type: 'error', text: 'Êtes-vous sûr ? Cliquez à nouveau pour confirmer la suppression définitive.' });
                    return;
                  }

                  purgeData(purgeOptions);
                  setPurgeMsg({ type: 'success', text: 'Les données sélectionnées ont été supprimées avec succès.' });
                  setConfirmPurge(false);
                  setTimeout(() => setPurgeMsg({ type: '', text: '' }), 4000);
                }}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors ${confirmPurge ? 'bg-red-800 hover:bg-red-900 ring-2 ring-red-300 ring-offset-1' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {confirmPurge ? 'Oui, confirmer la suppression' : 'Supprimer les données sélectionnées'}
              </button>
              {confirmPurge && (
                <button
                  onClick={() => {
                    setConfirmPurge(false);
                    setPurgeMsg({ type: '', text: '' });
                  }}
                  className="px-4 py-2 ml-4 text-slate-600 font-medium hover:text-slate-800 transition-colors"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION ADMIN: GESTION DES LABORATOIRES */}
      {activeTab === 'lab' && currentUser?.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
              <Building className="w-5 h-5 mr-2 text-slate-400" />
              Gestion des Laboratoires
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {laboratories?.map(lab => (
                 <div key={lab.id} className="p-4 border rounded-lg flex justify-between items-center">
                    <div>
                      <div className="font-bold">{lab.name}</div>
                      <div className="text-sm text-gray-500">{lab.code}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Voulez-vous vraiment supprimer ce laboratoire ?')) {
                          deleteLaboratory(lab.id);
                        }
                      }}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
               ))}
            </div>

            <button
              onClick={() => {
                const name = prompt('Nom du nouveau laboratoire :');
                if (name) {
                  const code = prompt('Code court (ex: MET) :') || 'NEW';
                  addLaboratory({
                    id: `lab-${Date.now()}`,
                    name,
                    shortName: name,
                    code,
                    description: '',
                    themeColor: 'blue',
                    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
                    badgeText: `${name} (${code})`,
                    settings: {
                      labName: name,
                      labAddress: '',
                      contactEmail: '',
                      phone: '',
                      isoCertifications: [],
                      logoUrl: '',
                      tableStyles: {
                        headerBgColor: 'F8FAFC',
                        borderColor: 'E2E8F0',
                        borderSize: 2
                      }
                    }
                  });
                }
              }}
              className="mt-4 flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Créer un laboratoire
            </button>
          </div>
        </div>
      )}

      {/* Onglet 4 : Sauvegarde et Patchs de configuration */}
      {activeTab === 'system' && (currentUser?.role === 'manager' || currentUser?.role === 'admin') && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Download className="w-5 h-5 mr-2 text-blue-500" />
                Exporter la Configuration (Templates)
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Générez un fichier JSON contenant toute la configuration structurelle de l'application (Templates d'analyses, modèles de matériaux, modèles de rapports, et paramètres du laboratoire). Les données métier (échantillons, demandes, etc.) ne sont pas exportées afin de préserver la traçabilité.
              </p>
            </div>
            <div className="p-6 bg-slate-50 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Ceci est particulièrement utile avant une mise à jour majeure.
              </div>
              <button
                onClick={exportPatch}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger lims_config.json
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-emerald-500" />
                Importer une Configuration
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Importez un fichier JSON contenant de nouveaux paramètres ou de nouveaux modèles d'analyses/matériaux. Le déploiement s'effectuera à chaud et <strong>mettra à jour la structure sans effacer vos échantillons ou demandes en cours</strong>.
              </p>
            </div>
            <div className="p-6">
              {patchMsg.text && (
                <div className={`mb-4 p-4 rounded-md text-sm border ${patchMsg.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} flex items-center`}>
                  {patchMsg.type === 'success' ? <Check className="w-5 h-5 mr-2" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
                  {patchMsg.text}
                </div>
              )}
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-10 hover:bg-slate-50 transition-colors">
                <Upload className="w-10 h-10 text-slate-300 mb-3" />
                <div className="text-slate-600 font-medium mb-1">Glissez-déposez un patch JSON ou cliquez pour parcourir</div>
                <div className="text-slate-400 text-xs mb-4">Seuls les fichiers lims_config_*.json sont acceptés</div>
                <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors">
                  Parcourir les fichiers
                  <input type="file" accept=".json" className="hidden" onChange={importPatch} />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglet 5 : Serveur Mail SMTP (Uniquement visible pour les Admins) */}
      {activeTab === 'smtp' && currentUser?.role === 'admin' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                  <Server className="w-5 h-5 mr-2 text-blue-600" />
                  Configuration du Serveur Mail (SMTP)
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Paramétrez le serveur SMTP utilisé pour envoyer automatiquement toutes les notifications de l'application par e-mail (nouvelles demandes, validations, assignations, rapports publiés, alertes de stock).
                </p>
              </div>
              <label className="flex items-center space-x-3 bg-slate-100 px-4 py-2.5 rounded-lg border border-slate-200 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={smtpConfig.enabled}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm font-semibold ${smtpConfig.enabled ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {smtpConfig.enabled ? 'Envoi Mail Activé' : 'Envoi Mail Désactivé'}
                </span>
              </label>
            </div>

            <form onSubmit={handleSaveSmtp} className="p-6 space-y-6">
              {smtpMsg.text && (
                <div className={`p-4 rounded-lg text-sm border flex items-center ${smtpMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {smtpMsg.type === 'error' ? <AlertTriangle className="w-5 h-5 mr-2 shrink-0" /> : <Check className="w-5 h-5 mr-2 shrink-0" />}
                  <span>{smtpMsg.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Serveur Hôte SMTP</label>
                  <input
                    type="text"
                    placeholder="ex: smtp.office365.com, smtp.gmail.com, mail.domaine.fr"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Port SMTP</label>
                  <input
                    type="number"
                    placeholder="587"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value, 10) || 587 })}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Utilisateur / Identifiant SMTP</label>
                  <input
                    type="text"
                    placeholder="ex: notifications@laboratoire.fr"
                    value={smtpConfig.user}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe SMTP / Clé d'application</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={smtpConfig.pass}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom d'expéditeur affiché</label>
                  <input
                    type="text"
                    placeholder="ex: LIMS MaterioLab"
                    value={smtpConfig.fromName}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adresse e-mail d'expéditeur (From)</label>
                  <input
                    type="email"
                    placeholder="ex: noreply@materiolab.fr"
                    value={smtpConfig.fromEmail}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="smtp-secure"
                  checked={smtpConfig.secure}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="smtp-secure" className="text-sm text-slate-700 cursor-pointer">
                  Utiliser une connexion SSL/TLS directe (cocher uniquement pour le port <strong>465</strong> ; laisser décoché pour STARTTLS sur le port <strong>587</strong> ou <strong>25</strong>)
                </label>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSavingSmtp}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSavingSmtp ? 'Enregistrement...' : 'Enregistrer la configuration SMTP'}
                </button>
              </div>
            </form>
          </div>

          {/* Carte de test d'envoi d'e-mail */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                <Send className="w-5 h-5 mr-2 text-emerald-600" />
                Tester l'envoi d'e-mail
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Vérifiez immédiatement la connexion à votre serveur SMTP en envoyant un e-mail de test.
              </p>
            </div>
            <div className="p-6 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <input
                type="email"
                placeholder="Adresse e-mail de réception du test..."
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="flex-1 border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp || !smtpConfig.host}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center disabled:opacity-50 shrink-0"
              >
                <Send className="w-4 h-4 mr-2" />
                {isTestingSmtp ? 'Envoi en cours...' : 'Envoyer un mail de test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onglet 6 : Console de Logs Applicatifs (Uniquement visible pour les Admins) */}
      {activeTab === 'logs' && currentUser?.role === 'admin' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Bandeau de synthèse des anomalies */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Événements</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{frontendLogs.length + backendLogs.length}</div>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                <Terminal className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">Avertissements (Warn)</div>
                <div className="text-2xl font-bold text-amber-700 mt-1">{warnCount}</div>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-red-600">Erreurs & Bugs (Error)</div>
                <div className="text-2xl font-bold text-red-700 mt-1">{errorCount}</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-red-600">
                <Bug className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Console principale */}
          <div className="bg-slate-950 rounded-xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
            {/* Barre d'outils de la console */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                </div>
                <h3 className="text-sm font-mono font-bold text-slate-200 flex items-center">
                  <Terminal className="w-4 h-4 mr-2 text-blue-400" />
                  Console Système (Frontend + Backend)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Recherche */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Filtrer un message, stack..."
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Filtre Source */}
                <select
                  value={logSourceFilter}
                  onChange={(e) => setLogSourceFilter(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Source : Toutes</option>
                  <option value="frontend">Frontend (Navigateur)</option>
                  <option value="backend">Backend (Serveur API)</option>
                </select>

                {/* Filtre Niveau */}
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Niveau : Tous</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error (Bugs)</option>
                </select>

                {/* Auto-refresh */}
                <label className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefreshLogs}
                    onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                    className="rounded border-slate-600 text-blue-500 focus:ring-0"
                  />
                  <span>Live (4s)</span>
                </label>

                {/* Rafraîchir manuellement */}
                <button
                  onClick={fetchBackendLogs}
                  disabled={isLoadingLogs}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors"
                  title="Actualiser les logs serveur"
                >
                  <RefreshCw className={`w-4 h-4 text-blue-400 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </button>

                {/* Exporter JSON */}
                <button
                  onClick={exportLogsJson}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center"
                  title="Exporter les logs en JSON"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Exporter
                </button>

                {/* Vider */}
                <button
                  onClick={handleClearAllLogs}
                  className="px-2.5 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-800 text-xs font-medium rounded-lg transition-colors flex items-center"
                  title="Vider tous les logs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Vider
                </button>
              </div>
            </div>

            {/* Flux des logs */}
            <div className="p-4 font-mono text-xs max-h-[560px] overflow-y-auto space-y-2 divide-y divide-slate-900">
              {filteredLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  Aucun événement à afficher pour les filtres sélectionnés.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const levelBadge =
                    log.level === 'error'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : log.level === 'warn'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

                  const sourceBadge =
                    log.source === 'backend'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

                  return (
                    <div
                      key={log.id}
                      className={`pt-2 first:pt-0 rounded px-2 py-1.5 ${
                        log.level === 'error'
                          ? 'bg-red-950/30'
                          : log.level === 'warn'
                          ? 'bg-amber-950/20'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="text-slate-500 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${sourceBadge}`}>
                          {log.source === 'backend' ? 'API' : 'UI'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${levelBadge}`}>
                          {log.level}
                        </span>
                        <span className="text-slate-200 break-all whitespace-pre-wrap flex-1">
                          {log.message}
                        </span>
                      </div>
                      {log.details && (
                        <pre className="mt-1.5 ml-14 p-2 bg-slate-900/90 border border-slate-800 rounded text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                          {log.details}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}