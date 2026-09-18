/**
 * Gestionnaire d'État Global & Multi-Laboratoires (LIMS React Context)
 * 
 * Ce module orchestre le fonctionnement applicatif côté client pour une
 * architecture multi-instances (Multi-Tenancy) :
 * 
 * 1. Isolation Étanche Multi-Laboratoires :
 *    - Gestion dynamique des entités Laboratoire (Métallographie vs Mécanique & Chimie)
 *    - Ségrégation stricte des collections métier selon le laboratoire actif :
 *      * Catalogues de gabarits (CMS Builder : analyses, formulaires, matériaux, rapports)
 *      * Équipes et habilitations (managers et techniciens rattachés)
 *      * Dossiers en cours (échantillons, essais, rapports, consommables)
 * 
 * 2. Portail Demandeur Unifié :
 *    - Point d'accès unique pour les donneurs d'ordre et clients externes
 *    - Vision consolidée de l'ensemble de leurs demandes tous laboratoires confondus
 *    - Sélection intuitive du laboratoire technique destinataire lors du dépôt
 * 
 * 3. Synchronisation & Traçabilité :
 *    - Synchronisation bidirectionnelle avec la base de données persistante SQLite
 *    - Enregistrement automatique des pistes d'audit (Audit Trail) garantissant l'intégrité ISO 17025
 *    - Alertes e-mail et notifications en temps réel
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { 
  Laboratory,
  Sample, 
  Analysis, 
  Report, 
  MaterialTemplate, 
  AnalysisTemplate, 
  User, 
  RequestTemplate, 
  AnalysisRequest, 
  Notification, 
  AuditLog, 
  Consumable, 
  LabSettings, 
  ReportTemplate 
} from './types';
import { 
  initialLaboratories,
  initialSamples, 
  initialAnalyses, 
  initialReports, 
  initialMaterialTemplates, 
  initialAnalysisTemplates, 
  initialRequestTemplates, 
  initialRequests, 
  initialConsumables, 
  initialReportTemplates 
} from './data';

/**
 * Contrat d'interface complet exposé par le contexte applicatif LIMS
 */
interface LimsContextType {
  // Recherche globale
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Session & Utilisateurs
  currentUser: User | null;
  users: User[];
  fetchUsers: () => Promise<void>;
  login: (user: User) => void;
  logout: () => void;
  
  // Multi-Tenancy & Laboratoires
  laboratories: Laboratory[];
  activeLabId: string;
  activeLab: Laboratory;
  setActiveLabId: (labId: string) => void;
  updateLaboratory: (id: string, updates: Partial<Laboratory>) => void;
  
  // Notifications système
  notifications: Notification[];
  markNotificationAsRead: (id: string) => void;
  addNotification: (userId: string, title: string, message: string, type?: 'system' | 'email') => void;
  
  // Modèles configurables (CMS Builder - filtrés selon le lab actif)
  materialTemplates: MaterialTemplate[];
  analysisTemplates: AnalysisTemplate[];
  requestTemplates: RequestTemplate[];
  reportTemplates: ReportTemplate[];
  
  // Collections brutes complètes (tous laboratoires confondus)
  allMaterialTemplates: MaterialTemplate[];
  allAnalysisTemplates: AnalysisTemplate[];
  allRequestTemplates: RequestTemplate[];
  allReportTemplates: ReportTemplate[];
  allSamples: Sample[];
  allAnalyses: Analysis[];
  allReports: Report[];
  allRequests: AnalysisRequest[];
  allConsumables: Consumable[];

  // Entités opérationnelles (filtrées selon le contexte actif)
  samples: Sample[];
  analyses: Analysis[];
  reports: Report[];
  requests: AnalysisRequest[];
  consumables: Consumable[];
  labSettings: LabSettings;
  
  // Opérations CMS - Matériaux
  addMaterialTemplate: (template: MaterialTemplate) => void;
  updateMaterialTemplate: (id: string, updates: Partial<MaterialTemplate>) => void;
  deleteMaterialTemplate: (id: string) => void;

  // Opérations CMS - Méthodes d'analyses
  addAnalysisTemplate: (template: AnalysisTemplate) => void;
  updateAnalysisTemplate: (id: string, updates: Partial<AnalysisTemplate>) => void;
  deleteAnalysisTemplate: (id: string) => void;

  // Opérations CMS - Formulaires de demandes
  addRequestTemplate: (template: RequestTemplate) => void;
  updateRequestTemplate: (id: string, updates: Partial<RequestTemplate>) => void;
  deleteRequestTemplate: (id: string) => void;

  // Opérations CMS - Modèles de rapports
  addReportTemplate: (template: ReportTemplate) => void;
  updateReportTemplate: (id: string, updates: Partial<ReportTemplate>) => void;
  deleteReportTemplate: (id: string) => void;
  
  // Cycle de vie des demandes clients
  addRequest: (request: AnalysisRequest) => void;
  updateRequestStatus: (id: string, status: AnalysisRequest['status'], comment?: string) => void;
  updateRequestData: (id: string, updates: Partial<AnalysisRequest>, summary: string) => void;
  rejectRequest: (id: string, reason: string) => void;
  resubmitRequest: (id: string, customData: Record<string, any>) => void;
  assignRequest: (requestId: string, analystId: string) => void;
  
  // Traitement et préparation des échantillons
  addSample: (sample: Sample) => void;
  updateSampleStatus: (id: string, status: Sample['status']) => void;
  updateSampleMounting: (id: string, mountingInfo: Sample['mountingInfo']) => void;
  addSampleImage: (id: string, imageUrl: string) => void;

  // Exécution et validation des analyses
  addAnalysis: (analysis: Analysis) => void;
  updateAnalysisStatus: (id: string, status: Analysis['status']) => void;
  updateAnalysisResult: (id: string, resultId: string, value: any) => void;
  addAnalysisImage: (id: string, imageUrl: string) => void;

  // Rapports et certificats
  addReport: (report: Report) => void;
  deleteReport: (id: string) => void;
  
  // Gestion de stock des consommables
  updateConsumableStock: (id: string, newLevel: number) => void;
  addConsumable: (consumable: Consumable) => void;
  deleteConsumable: (id: string) => void;
  
  // Paramétrage du laboratoire actif
  updateLabSettings: (settings: Partial<LabSettings>) => void;

  // Maintenance & Patches
  purgeData: (options: Record<string, boolean>) => void;
  applyPatch: (patch: any) => void;
}

/** Création de l'instance du contexte React */
const LimsContext = createContext<LimsContextType | undefined>(undefined);

/**
 * Hook de synchronisation avec la couche de persistance SQLite du serveur.
 * 
 * @param collection Identifiant unique de la collection en base
 * @param initialData Valeurs de repli lors du premier amorçage
 * @param isAuthenticated Conditionne les requêtes à la présence d'une session valide
 */
function useSyncedState<T>(collection: string, initialData: T, isAuthenticated: boolean) {
  const [data, setData] = useState<T>(initialData);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`/api/db/${collection}`)
      .then(res => res.json())
      .then(res => {
        if (res !== null && !res.error) {
          setData(res);
        } else if (res === null) {
          // Injection initiale de la collection dans SQLite
          fetch(`/api/db/${collection}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(initialData) 
          });
        }
      })
      .catch(console.error);
  }, [collection, isAuthenticated]);

  const setSyncedData = (action: React.SetStateAction<T>) => {
    setData(prev => {
      const next = typeof action === 'function' ? (action as any)(prev) : action;
      if (isAuthenticated) {
        fetch(`/api/db/${collection}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(next) 
        }).catch(console.error);
      }
      return next;
    });
  };

  return [data, setSyncedData] as const;
}

/**
 * Fournisseur principal du Contexte LIMS
 */
export const LimsProvider = ({ children }: { children: ReactNode }) => {
  // Recherche transversale rapide
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Gestion de la session utilisateur
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  /**
   * Recharge la liste des utilisateurs du système depuis le serveur
   */
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Erreur lors du chargement des utilisateurs :', e);
    }
  };

  /**
   * Vérifie la session active lors du chargement initial via le cookie de session
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          await fetchUsers();
        }
      } catch (e) {
        console.error('Échec de validation de la session :', e);
      } finally {
        setIsInitializing(false);
      }
    };
    checkSession();
  }, []);

  const isAuthenticated = !!currentUser;

  // ==========================================
  // 1. Collections Métier Synchronisées
  // ==========================================
  const [laboratories, setLaboratories] = useSyncedState<Laboratory[]>('laboratories', initialLaboratories, isAuthenticated);
  const [notifications, setNotifications] = useSyncedState<Notification[]>('notifications', [], isAuthenticated);
  
  const [rawMaterialTemplates, setMaterialTemplates] = useSyncedState<MaterialTemplate[]>('materialTemplates', initialMaterialTemplates, isAuthenticated);
  const [rawAnalysisTemplates, setAnalysisTemplates] = useSyncedState<AnalysisTemplate[]>('analysisTemplates', initialAnalysisTemplates, isAuthenticated);
  const [rawRequestTemplates, setRequestTemplates] = useSyncedState<RequestTemplate[]>('requestTemplates', initialRequestTemplates, isAuthenticated);
  const [rawReportTemplates, setReportTemplates] = useSyncedState<ReportTemplate[]>('reportTemplates', initialReportTemplates, isAuthenticated);
  
  const [rawSamples, setSamples] = useSyncedState<Sample[]>('samples', initialSamples, isAuthenticated);
  const [rawAnalyses, setAnalyses] = useSyncedState<Analysis[]>('analyses', initialAnalyses, isAuthenticated);
  const [rawReports, setReports] = useSyncedState<Report[]>('reports', initialReports, isAuthenticated);
  const [rawRequests, setRequests] = useSyncedState<AnalysisRequest[]>('requests', initialRequests, isAuthenticated);
  const [rawConsumables, setConsumables] = useSyncedState<Consumable[]>('consumables', initialConsumables, isAuthenticated);

  // ==========================================
  // 2. Sélection & Contexte du Laboratoire Actif
  // ==========================================
  const [activeLabId, setActiveLabIdState] = useState<string>('lab-metallurgie');

  // Ajustement automatique du laboratoire actif à la connexion selon le rattachement de l'utilisateur
  useEffect(() => {
    if (currentUser?.labId && currentUser.labId !== 'all') {
      setActiveLabIdState(currentUser.labId);
    }
  }, [currentUser]);

  const setActiveLabId = (labId: string) => {
    setActiveLabIdState(labId);
  };

  /**
   * Laboratoire actif résolu (ou repli sur le premier laboratoire enregistré)
   */
  const activeLab = useMemo(() => {
    return laboratories.find(l => l.id === activeLabId) || laboratories[0] || initialLaboratories[0];
  }, [laboratories, activeLabId]);

  /**
   * Paramètres de configuration du laboratoire actuellement sélectionné
   */
  const labSettings = activeLab.settings;

  /**
   * Met à jour les métadonnées ou paramètres d'un laboratoire
   */
  const updateLaboratory = (id: string, updates: Partial<Laboratory>) => {
    setLaboratories(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  /**
   * Met à jour les paramètres administratifs et charte du laboratoire actif
   */
  const updateLabSettings = (settings: Partial<LabSettings>) => {
    setLaboratories(prev => prev.map(l => {
      if (l.id === activeLabId) {
        return {
          ...l,
          settings: { ...l.settings, ...settings }
        };
      }
      return l;
    }));
  };

  // ==========================================
  // 3. Filtrage Dynamique selon le Rôle et le Contexte
  // ==========================================
  const isRequester = currentUser?.role === 'demandeur';

  // Pour les demandeurs : vision unifiée sur leurs demandes à travers tous les laboratoires
  // Pour le personnel interne (analystes, managers) : isolation stricte par laboratoire actif
  const requests = useMemo(() => {
    if (isRequester) {
      return rawRequests.filter(r => r.requesterId === currentUser?.id);
    }
    return rawRequests.filter(r => r.labId === activeLabId);
  }, [rawRequests, isRequester, currentUser, activeLabId]);

  const samples = useMemo(() => {
    if (isRequester) {
      // Les échantillons rattachés aux demandes du demandeur
      const myRequestIds = new Set(requests.map(r => r.id));
      return rawSamples.filter(s => s.requestId && myRequestIds.has(s.requestId));
    }
    return rawSamples.filter(s => s.labId === activeLabId);
  }, [rawSamples, isRequester, requests, activeLabId]);

  const analyses = useMemo(() => {
    if (isRequester) {
      const mySampleIds = new Set(samples.map(s => s.id));
      return rawAnalyses.filter(a => mySampleIds.has(a.sampleId));
    }
    return rawAnalyses.filter(a => a.labId === activeLabId);
  }, [rawAnalyses, isRequester, samples, activeLabId]);

  const reports = useMemo(() => {
    if (isRequester) {
      const myRequestIds = new Set(requests.map(r => r.id));
      return rawReports.filter(r => r.requestId && myRequestIds.has(r.requestId));
    }
    return rawReports.filter(r => r.labId === activeLabId);
  }, [rawReports, isRequester, requests, activeLabId]);

  const consumables = useMemo(() => {
    return rawConsumables.filter(c => c.labId === activeLabId);
  }, [rawConsumables, activeLabId]);

  // Pour le Builder CMS : affichage et configuration des templates du laboratoire actif
  // Pour le portail demandeur : possibilité d'accéder aux modèles selon le lab choisi
  const materialTemplates = useMemo(() => {
    if (isRequester) return rawMaterialTemplates;
    return rawMaterialTemplates.filter(t => t.labId === activeLabId);
  }, [rawMaterialTemplates, isRequester, activeLabId]);

  const analysisTemplates = useMemo(() => {
    if (isRequester) return rawAnalysisTemplates;
    return rawAnalysisTemplates.filter(t => t.labId === activeLabId);
  }, [rawAnalysisTemplates, isRequester, activeLabId]);

  const requestTemplates = useMemo(() => {
    if (isRequester) return rawRequestTemplates;
    return rawRequestTemplates.filter(t => t.labId === activeLabId);
  }, [rawRequestTemplates, isRequester, activeLabId]);

  const reportTemplates = useMemo(() => {
    if (isRequester) return rawReportTemplates;
    return rawReportTemplates.filter(t => t.labId === activeLabId);
  }, [rawReportTemplates, isRequester, activeLabId]);

  // ==========================================
  // 4. Authentification & Cycle de Session
  // ==========================================
  const login = async (user: User) => {
    setCurrentUser(user);
    if (user.labId && user.labId !== 'all') {
      setActiveLabIdState(user.labId);
    }
    await fetchUsers();
  };
  
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Erreur lors de la déconnexion :', e);
    }
    setCurrentUser(null);
  };

  // ==========================================
  // 5. Journalisation & Notifications
  // ==========================================
  const addNotification = (userId: string, title: string, message: string, type: 'system' | 'email' = 'system') => {
    const newNotif: Notification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      type
    };
    setNotifications(prev => [newNotif, ...prev]);
    if (type === 'email') {
      console.log(`[SIMULATION EMAIL vers Utilisateur ${userId}] ${title} - ${message}`);
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const createAuditLog = (action: string, details: string): AuditLog => ({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: currentUser?.id || 'SYSTEM',
    action,
    details
  });

  // ==========================================
  // 6. Opérations Métier (avec injection de labId)
  // ==========================================
  const addMaterialTemplate = (template: MaterialTemplate) => {
    const item = { ...template, labId: template.labId || activeLabId };
    setMaterialTemplates(prev => [...prev, item]);
  };
  const updateMaterialTemplate = (id: string, updates: Partial<MaterialTemplate>) => {
    setMaterialTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  const deleteMaterialTemplate = (id: string) => {
    setMaterialTemplates(prev => prev.filter(t => t.id !== id));
  };
  
  const addAnalysisTemplate = (template: AnalysisTemplate) => {
    const item = { ...template, labId: template.labId || activeLabId };
    setAnalysisTemplates(prev => [...prev, item]);
  };
  const updateAnalysisTemplate = (id: string, updates: Partial<AnalysisTemplate>) => {
    setAnalysisTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  const deleteAnalysisTemplate = (id: string) => {
    setAnalysisTemplates(prev => prev.filter(t => t.id !== id));
  };
  
  const addRequestTemplate = (template: RequestTemplate) => {
    const item = { ...template, labId: template.labId || activeLabId };
    setRequestTemplates(prev => [...prev, item]);
  };
  const updateRequestTemplate = (id: string, updates: Partial<RequestTemplate>) => {
    setRequestTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  const deleteRequestTemplate = (id: string) => {
    setRequestTemplates(prev => prev.filter(t => t.id !== id));
  };
  
  const addReportTemplate = (template: ReportTemplate) => {
    const item = { ...template, labId: template.labId || activeLabId };
    setReportTemplates(prev => [...prev, item]);
  };
  const updateReportTemplate = (id: string, updates: Partial<ReportTemplate>) => {
    setReportTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  const deleteReportTemplate = (id: string) => {
    setReportTemplates(prev => prev.filter(t => t.id !== id));
  };

  /**
   * Création d'une demande avec rattachement au laboratoire destinataire
   */
  const addRequest = (request: AnalysisRequest) => {
    const targetLabId = request.labId || activeLabId;
    const initialAudit = createAuditLog('Création', `Demande soumise au laboratoire [${targetLabId}]`);
    const newReq = { ...request, labId: targetLabId, auditTrail: [initialAudit] };
    setRequests(prev => [newReq, ...prev]);
    
    // Notification des managers rattachés à ce laboratoire spécifique
    const labManagers = users.filter(u => u.role === 'manager' && (u.labId === targetLabId || u.labId === 'all' || !u.labId));
    labManagers.forEach(m => addNotification(m.id, 'Nouvelle demande', `Demande ${request.id} soumise par ${currentUser?.name || 'le client'}.`, 'email'));
  };

  const updateRequestStatus = (id: string, status: AnalysisRequest['status'], comment?: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Changement de statut', `Statut passé à : ${status}.${comment ? ` Raison : ${comment}` : ''}`);
        addNotification(r.requesterId, 'Mise à jour de votre demande', `Votre demande ${r.id} est maintenant : ${status}`, 'email');
        return { ...r, status, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  const rejectRequest = (id: string, reason: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Rejetée', `Demande refusée. Motif : ${reason}`);
        addNotification(r.requesterId, 'Demande refusée', `Votre demande ${r.id} a été refusée. Motif : ${reason}`, 'email');
        return { ...r, status: 'rejetee', rejectionReason: reason, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  const resubmitRequest = (id: string, customData: Record<string, any>) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Resoumission', `Demande modifiée et resoumise par le demandeur.`);
        const labManagers = users.filter(u => u.role === 'manager' && (u.labId === r.labId || u.labId === 'all' || !u.labId));
        labManagers.forEach(m => addNotification(m.id, 'Demande resoumise', `La demande ${r.id} a été corrigée et resoumise.`, 'system'));
        return { ...r, status: 'soumise', customData, rejectionReason: undefined, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  const assignRequest = (requestId: string, analystId: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        const analyst = users.find(u => u.id === analystId);
        const audit = createAuditLog('Assignation', `Demande assignée à l'analyste : ${analyst?.name}`);
        
        addNotification(analystId, 'Nouvelle assignation', `La demande ${r.id} vous a été assignée.`, 'email');
        addNotification(r.requesterId, 'Demande prise en charge', `Votre demande ${r.id} a été assignée à un analyste.`, 'system');

        return { ...r, assignedTo: analystId, status: 'assignee', auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
    
    // Propagation du technicien assigné aux analyses associées
    const analystName = users.find(u => u.id === analystId)?.name || 'Non assigné';
    setAnalyses(prev => prev.map(a => {
      const isRelated = rawSamples.some(s => s.requestId === requestId && s.id === a.sampleId);
      if (isRelated) {
        const audit = createAuditLog('Assignation', `Analyste assigné : ${analystName} (Hérité de la demande)`);
        return { ...a, technician: analystName, auditTrail: [audit, ...(a.auditTrail || [])] };
      }
      return a;
    }));
  };

  const updateRequestData = (id: string, updates: Partial<AnalysisRequest>, summary: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Modification Manager', summary);
        return { ...r, ...updates, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  // ==========================================
  // 7. Échantillons & Préparations
  // ==========================================
  const addSample = (sample: Sample) => {
    const item = { ...sample, labId: sample.labId || activeLabId };
    setSamples(prev => [item, ...prev]);
  };
  
  const updateSampleStatus = (id: string, status: Sample['status']) => {
    setSamples(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };
  
  const updateSampleMounting = (id: string, mountingInfo: Sample['mountingInfo']) => {
    setSamples(prev => prev.map(s => s.id === id ? { ...s, mountingInfo } : s));
  };

  const addSampleImage = (id: string, imageUrl: string) => {
    setSamples(prev => prev.map(s => s.id === id ? { ...s, images: [...s.images, imageUrl] } : s));
  };

  // ==========================================
  // 8. Analyses & Mesures
  // ==========================================
  const addAnalysis = (analysis: Analysis) => {
    const item = { ...analysis, labId: analysis.labId || activeLabId };
    setAnalyses(prev => [item, ...prev]);
  };
  
  const updateAnalysisStatus = (id: string, status: Analysis['status']) => {
    setAnalyses(prev => prev.map(a => {
      if (a.id === id) {
        const audit = createAuditLog('Changement de statut', `Statut passé à : ${status}`);
        return { ...a, status, updatedAt: new Date().toISOString(), auditTrail: [audit, ...(a.auditTrail || [])] };
      }
      return a;
    }));
  };

  const updateAnalysisResult = (id: string, resultId: string, value: any) => {
    setAnalyses(prev => prev.map(a => {
      if (a.id === id) {
        const isManager = currentUser?.role === 'manager';
        // Verrouillage ISO 17025 pour les statuts validés
        const isLocked = (!isManager && (a.status === 'a_valider' || a.status === 'valide' || a.status === 'termine')) || (isManager && a.status === 'termine');
        if (isLocked) {
          console.warn('Modification refusée : l\'analyse est verrouillée pour ce profil.');
          return a;
        }

        const previous = a.results[resultId] ?? 'N/A';
        const audit = createAuditLog('Modification de résultat', `${resultId}: ${previous} -> ${value}`);
        return { 
          ...a, 
          results: { ...a.results, [resultId]: value }, 
          updatedAt: new Date().toISOString(), 
          auditTrail: [audit, ...(a.auditTrail || [])] 
        };
      }
      return a;
    }));
  };

  const addAnalysisImage = (id: string, imageUrl: string) => {
    setAnalyses(prev => prev.map(a => {
      if (a.id === id) {
        const isManager = currentUser?.role === 'manager';
        const isLocked = (!isManager && (a.status === 'a_valider' || a.status === 'valide' || a.status === 'termine')) || (isManager && a.status === 'termine');
        if (isLocked) return a;
        
        return { ...a, images: [...a.images, imageUrl], updatedAt: new Date().toISOString() };
      }
      return a;
    }));
  };

  // ==========================================
  // 9. Rapports & Consommables
  // ==========================================
  const addReport = (report: Report) => {
    const item = { ...report, labId: report.labId || activeLabId };
    setReports(prev => [item, ...prev]);
  };

  const deleteReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const addConsumable = (consumable: Consumable) => {
    const item = { ...consumable, labId: consumable.labId || activeLabId };
    setConsumables(prev => [item, ...prev]);
  };

  const deleteConsumable = (id: string) => {
    setConsumables(prev => prev.filter(c => c.id !== id));
  };

  const updateConsumableStock = (id: string, newLevel: number) => {
    setConsumables(prev => prev.map(c => {
      if (c.id === id) {
        const isReplenished = newLevel > c.stockLevel;
        return { 
          ...c, 
          stockLevel: newLevel,
          lastRestocked: isReplenished ? new Date().toISOString() : c.lastRestocked
        };
      }
      return c;
    }));
  };

  // ==========================================
  // 10. Patches & Maintenance
  // ==========================================
  const applyPatch = (patch: any) => {
    if (patch.laboratories) setLaboratories(patch.laboratories);
    if (patch.materialTemplates) setMaterialTemplates(patch.materialTemplates);
    if (patch.analysisTemplates) setAnalysisTemplates(patch.analysisTemplates);
    if (patch.requestTemplates) setRequestTemplates(patch.requestTemplates);
    if (patch.reportTemplates) setReportTemplates(patch.reportTemplates);
  };

  const purgeData = (options: Record<string, boolean>) => {
    if (options.samples) setSamples(prev => prev.filter(s => s.labId !== activeLabId));
    if (options.analyses) setAnalyses(prev => prev.filter(a => a.labId !== activeLabId));
    if (options.reports) setReports(prev => prev.filter(r => r.labId !== activeLabId));
    if (options.requests) setRequests(prev => prev.filter(r => r.labId !== activeLabId));
    if (options.notifications) setNotifications([]);
    if (options.consumables) setConsumables(prev => prev.filter(c => c.labId !== activeLabId));
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <LimsContext.Provider value={{
      globalSearchQuery, setGlobalSearchQuery,
      currentUser, users, fetchUsers, login, logout,
      laboratories, activeLabId, activeLab, setActiveLabId, updateLaboratory,
      notifications, markNotificationAsRead, addNotification,
      materialTemplates, analysisTemplates, requestTemplates, reportTemplates,
      allMaterialTemplates: rawMaterialTemplates,
      allAnalysisTemplates: rawAnalysisTemplates,
      allRequestTemplates: rawRequestTemplates,
      allReportTemplates: rawReportTemplates,
      allSamples: rawSamples,
      allAnalyses: rawAnalyses,
      allReports: rawReports,
      allRequests: rawRequests,
      allConsumables: rawConsumables,
      samples, analyses, reports, requests, consumables, labSettings,
      addMaterialTemplate, updateMaterialTemplate, deleteMaterialTemplate, 
      addAnalysisTemplate, updateAnalysisTemplate, deleteAnalysisTemplate,
      addRequestTemplate, updateRequestTemplate, deleteRequestTemplate, 
      addReportTemplate, updateReportTemplate, deleteReportTemplate, 
      addRequest, updateRequestStatus, updateRequestData, rejectRequest, resubmitRequest, assignRequest,
      addSample, updateSampleStatus, 
      updateSampleMounting, addSampleImage, 
      addAnalysis, updateAnalysisStatus, 
      updateAnalysisResult, addAnalysisImage, 
      addReport, deleteReport, 
      addConsumable, deleteConsumable, updateConsumableStock, 
      updateLabSettings, purgeData, applyPatch
    }}>
      {children}
    </LimsContext.Provider>
  );
};

/**
 * Hook d'accès rapide au contexte LIMS
 */
export const useLims = () => {
  const context = useContext(LimsContext);
  if (context === undefined) {
    throw new Error('useLims doit obligatoirement être utilisé à l\'intérieur d\'un LimsProvider');
  }
  return context;
};
