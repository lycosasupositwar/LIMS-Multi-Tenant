/**
 * Gestionnaire d'État Global & Multi-Laboratoires (LIMS React Context)
 *
 * Ce module constitue le cœur réactif de l'application côté client :
 * 1. Synchronisation bidirectionnelle avec l'API SQLite (`/api/db/:collection`) via le hook `useSyncedState`.
 * 2. Isolation Multi-Tenant par laboratoire (`activeLabId`) et par rôle (`demandeur` vs personnel interne).
 * 3. Orchestration des workflows métier ISO/IEC 17025 :
 *    - Création, revue, validation, rejet, resoumission et assignation des demandes (`AnalysisRequest`).
 *    - Enregistrement des échantillons/sous-échantillons et suivi d'enrobage (`Sample`).
 *    - Saisie des résultats d'essais, verrouillage selon statut et transition automatique vers `En Validation` (`Analysis`).
 *    - Émission des rapports et clôture automatique de la demande associée (`Report`).
 *    - Surveillance des seuils critiques et dates de péremption des stocks (`Consumable`).
 *    - Piste d'audit (`AuditLog`) et notifications multi-canaux (in-app + e-mail SMTP).
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
import { generateUniqueLimsId } from './utils/idGenerator';

/**
 * Métadonnées optionnelles de routage attachées à une notification
 * pour permettre la navigation directe vers l'élément concerné au clic dans `Layout.tsx`.
 */
interface NotificationMeta {
  /** Onglet cible à ouvrir ('requests' | 'samples' | 'analyses' | 'reports' | 'inventory' | 'settings') */
  targetTab?: string;
  /** Identifiant de l'entité à mettre en évidence ou à pré-filtrer dans la barre de recherche globale */
  targetId?: string;
  /** Identifiant du laboratoire sur lequel basculer lors du clic */
  labId?: string;
}

/**
 * Interface complète exposée par le contexte React `useLims()`
 */
interface LimsContextType {
  // --- Recherche Globale ---
  /** Chaîne de filtrage globale partagée entre l'en-tête (`Layout`) et les vues métier */
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // --- Authentification & Utilisateurs ---
  /** Utilisateur actuellement connecté (ou `null` si non authentifié) */
  currentUser: User | null;
  /** Liste des utilisateurs accessibles selon les habilitations du compte connecté */
  users: User[];
  /** Recharge la liste des utilisateurs depuis `GET /api/users` */
  fetchUsers: () => Promise<void>;
  /** Connecte un utilisateur et ajuste le laboratoire actif selon son profil */
  login: (user: User) => void;
  /** Déconnecte l'utilisateur et détruit le cookie JWT côté serveur */
  logout: () => void;

  // --- Gestion Multi-Laboratoires (Multi-Tenancy) ---
  /** Liste de tous les laboratoires configurés dans l'instance */
  laboratories: Laboratory[];
  /** Identifiant du laboratoire actuellement sélectionné dans l'interface */
  activeLabId: string;
  /** Objet complet du laboratoire actuellement actif */
  activeLab: Laboratory;
  /** Change le laboratoire actif (avec contrôle d'accès selon `currentUser.labId`) */
  setActiveLabId: (labId: string) => void;
  updateLaboratory: (id: string, updates: Partial<Laboratory>) => void;
  addLaboratory: (lab: Laboratory) => void;
  deleteLaboratory: (id: string) => void;

  // --- Notifications ---
  /** Liste globale des notifications */
  notifications: Notification[];
  /** Supprime/acquitte une notification par son identifiant */
  markNotificationAsRead: (id: string) => void;
  /** Purge toutes les notifications appartenant à l'utilisateur connecté */
  clearUserNotifications: () => void;
  /** Crée une notification in-app et déclenche optionnellement un e-mail via `/api/notifications/send-email` */
  addNotification: (userId: string, title: string, message: string, type?: 'system' | 'email', meta?: NotificationMeta) => void;

  // --- Modèles CMS filtrés pour le laboratoire actif ---
  materialTemplates: MaterialTemplate[];
  analysisTemplates: AnalysisTemplate[];
  requestTemplates: RequestTemplate[];
  reportTemplates: ReportTemplate[];

  // --- Collections Brutes Multi-Laboratoires (pour vues transversales / Portail Demandeur / Admin) ---
  allMaterialTemplates: MaterialTemplate[];
  allAnalysisTemplates: AnalysisTemplate[];
  allRequestTemplates: RequestTemplate[];
  allReportTemplates: ReportTemplate[];
  allSamples: Sample[];
  allAnalyses: Analysis[];
  allReports: Report[];
  allRequests: AnalysisRequest[];
  allConsumables: Consumable[];

  // --- Collections Filtrées (selon `activeLabId` ou `currentUser.id` pour un demandeur) ---
  samples: Sample[];
  analyses: Analysis[];
  reports: Report[];
  requests: AnalysisRequest[];
  consumables: Consumable[];
  /** Raccourci vers `activeLab.settings` */
  labSettings: LabSettings;

  // --- Actions CRUD sur les Modèles CMS (Manager / Admin) ---
  addMaterialTemplate: (template: MaterialTemplate) => void;
  updateMaterialTemplate: (id: string, updates: Partial<MaterialTemplate>) => void;
  deleteMaterialTemplate: (id: string) => void;

  addAnalysisTemplate: (template: AnalysisTemplate) => void;
  updateAnalysisTemplate: (id: string, updates: Partial<AnalysisTemplate>) => void;
  deleteAnalysisTemplate: (id: string) => void;

  addRequestTemplate: (template: RequestTemplate) => void;
  updateRequestTemplate: (id: string, updates: Partial<RequestTemplate>) => void;
  deleteRequestTemplate: (id: string) => void;

  addReportTemplate: (template: ReportTemplate) => void;
  updateReportTemplate: (id: string, updates: Partial<ReportTemplate>) => void;
  deleteReportTemplate: (id: string) => void;

  // --- Actions sur le Cycle de Vie des Demandes d'Analyses ---
  addRequest: (request: AnalysisRequest) => void;
  updateRequestStatus: (id: string, status: AnalysisRequest['status'], comment?: string) => void;
  updateRequestData: (id: string, updates: Partial<AnalysisRequest>, summary: string) => void;
  rejectRequest: (id: string, reason: string) => void;
  resubmitRequest: (id: string, customData: Record<string, any>) => void;
  assignRequest: (requestId: string, analystId: string) => void;

  // --- Actions sur les Échantillons & Sous-Échantillons ---
  addSample: (sample: Sample) => void;
  deleteSample: (id: string) => void;
  updateSampleStatus: (id: string, status: Sample['status']) => void;
  updateSampleMounting: (id: string, mountingInfo: Sample['mountingInfo']) => void;
  addSampleImage: (id: string, imageUrl: string) => void;

  // --- Actions sur les Essais & Résultats d'Analyses ---
  addAnalysis: (analysis: Analysis) => void;
  deleteAnalysis: (id: string) => void;
  updateAnalysisStatus: (id: string, status: Analysis['status'], comment?: string) => void;
  updateAnalysisResult: (id: string, resultId: string, value: any) => void;
  addAnalysisImage: (id: string, imageUrl: string) => void;

  // --- Actions sur les Rapports d'Essais ---
  addReport: (report: Report) => void;
  deleteReport: (id: string) => void;

  // --- Actions sur l'Inventaire des Consommables ---
  updateConsumableStock: (id: string, newLevel: number) => void;
  addConsumable: (consumable: Consumable) => void;
  deleteConsumable: (id: string) => void;

  // --- Administration & Maintenance ---
  updateLabSettings: (settings: Partial<LabSettings>) => void;
  purgeData: (options: Record<string, boolean>) => void;
  applyPatch: (patch: any) => void;
}

const LimsContext = createContext<LimsContextType | undefined>(undefined);

/**
 * Hook générique de synchronisation d'une collection React avec la base SQLite du serveur.
 *
 * Fonctionnement :
 * 1. Au montage (ou dès que `isAuthenticated` passe à `true`), interroge `GET /api/db/:collection`.
 * 2. Si la collection existe en base, remplace l'état local par les données persistées.
 * 3. Si la collection n'existe pas encore (`null`), initialise la base avec `initialData` via `POST`.
 * 4. À chaque appel à `setSyncedData`, met à jour l'état React immédiatement (UI optimiste)
 *    et persiste le nouveau tableau en arrière-plan via `POST /api/db/:collection`.
 *
 * @param collection Nom de la collection autorisée côté serveur (ex: 'samples', 'requests')
 * @param initialData Valeur par défaut issue de `src/data.ts`
 * @param isAuthenticated Indique si une session utilisateur valide est active
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
          // Première initialisation de la collection dans SQLite avec le jeu de démonstration
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
 * Fournisseur de contexte principal englobant toute l'application (`App.tsx`)
 */
export const LimsProvider = ({ children }: { children: ReactNode }) => {
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  /**
   * Récupère la liste des utilisateurs depuis le serveur.
   * Note : Le serveur filtre automatiquement les données selon le rôle de l'appelant.
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

  // Vérification automatique de la session existante (cookie HTTP-Only `token`) au démarrage
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

  // Force la sélection du laboratoire d'affectation pour les managers et analystes mono-labo
  useEffect(() => {
    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'analyste')) {
      if (currentUser.labId && currentUser.labId !== 'all') {
        setActiveLabIdState(currentUser.labId);
      }
    }
  }, [currentUser]);

  const isAuthenticated = !!currentUser;

  // --- États Synchronisés avec SQLite ---
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

  const [activeLabId, setActiveLabIdState] = useState<string>(initialLaboratories[0]?.id || '');

  useEffect(() => {
    if (currentUser?.labId && currentUser.labId !== 'all') {
      setActiveLabIdState(currentUser.labId);
    }
  }, [currentUser]);

  /**
   * Modifie le laboratoire actif dans l'interface tout en empêchant un membre
   * assigné à un laboratoire spécifique de basculer sur un autre laboratoire.
   */
  const setActiveLabId = (labId: string) => {
    if (currentUser?.role === 'manager' || currentUser?.role === 'analyste') {
      if (currentUser.labId && currentUser.labId !== 'all' && currentUser.labId !== labId) {
        console.warn('Accès refusé : Vous ne pouvez pas sélectionner un laboratoire auquel vous n\'êtes pas assigné.');
        return;
      }
    }
    setActiveLabIdState(labId);
  };

  /** Résolution mémoïsée du laboratoire actif (avec repli sécurisé sur le premier laboratoire) */
  const activeLab = useMemo(() => {
    return laboratories.find(l => l.id === activeLabId) || laboratories[0] || initialLaboratories[0];
  }, [laboratories, activeLabId]);

  const labSettings = activeLab.settings;

  // --- Gestion des Laboratoires ---
  const updateLaboratory = (id: string, updates: Partial<Laboratory>) => {
    setLaboratories(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const addLaboratory = (lab: Laboratory) => {
    setLaboratories(prev => [...prev, lab]);
  };

  const deleteLaboratory = (id: string) => {
    setLaboratories(prev => prev.filter(l => l.id !== id));
    if (activeLabId === id) {
      setActiveLabIdState(laboratories.find(l => l.id !== id)?.id || '');
    }
  };

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

  // --- Filtrage Contextuel des Collections (Multi-Tenant & Isolation Demandeur) ---
  const isRequester = currentUser?.role === 'demandeur';

  /** Demandes filtrées : celles du client connecté (si demandeur) ou celles du laboratoire actif */
  const requests = useMemo(() => {
    if (isRequester) {
      return rawRequests.filter(r => r.requesterId === currentUser?.id);
    }
    return rawRequests.filter(r => r.labId === activeLabId);
  }, [rawRequests, isRequester, currentUser, activeLabId]);

  /** Échantillons filtrés : ceux rattachés aux demandes du client (si demandeur) ou ceux du labo actif */
  const samples = useMemo(() => {
    if (isRequester) {
      const myRequestIds = new Set(requests.map(r => r.id));
      return rawSamples.filter(s => s.requestId && myRequestIds.has(s.requestId));
    }
    return rawSamples.filter(s => s.labId === activeLabId);
  }, [rawSamples, isRequester, requests, activeLabId]);

  /** Analyses filtrées : celles des échantillons du client (si demandeur) ou celles du labo actif */
  const analyses = useMemo(() => {
    if (isRequester) {
      const mySampleIds = new Set(samples.map(s => s.id));
      return rawAnalyses.filter(a => mySampleIds.has(a.sampleId));
    }
    return rawAnalyses.filter(a => a.labId === activeLabId);
  }, [rawAnalyses, isRequester, samples, activeLabId]);

  /** Rapports filtrés : ceux rattachés aux demandes/échantillons du client ou ceux du labo actif */
  const reports = useMemo(() => {
    if (isRequester) {
      const myRequestIds = new Set(requests.map(r => r.id));
      const mySampleIds = new Set(samples.map(s => s.id));
      return rawReports.filter(
        r =>
          (r.requestId && myRequestIds.has(r.requestId)) ||
          (Array.isArray(r.sampleIds) && r.sampleIds.some(sId => mySampleIds.has(sId)))
      );
    }
    return rawReports.filter(r => r.labId === activeLabId);
  }, [rawReports, isRequester, requests, samples, activeLabId]);

  /** Consommables filtrés par laboratoire actif */
  const consumables = useMemo(() => {
    return rawConsumables.filter(c => c.labId === activeLabId);
  }, [rawConsumables, activeLabId]);

  /** Modèles CMS : un demandeur voit les modèles de tous les laboratoires pour soumettre ses commandes */
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

  // --- Connexion / Déconnexion ---
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

  /**
   * Ajoute une notification enrichie (targetTab, targetId, labId) dans l'application
   * ET déclenche l'envoi d'un e-mail au destinataire via le serveur SMTP configuré.
   */
  const addNotification = (
    userId: string,
    title: string,
    message: string,
    type: 'system' | 'email' = 'email',
    meta?: NotificationMeta
  ) => {
    const newNotif: Notification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      type,
      targetTab: meta?.targetTab,
      targetId: meta?.targetId,
      labId: meta?.labId
    };

    setNotifications(prev => [newNotif, ...prev]);

    // Si le canal 'email' est demandé, sollicite l'API backend qui utilisera Nodemailer si SMTP est actif
    if (type === 'email') {
      void (async () => {
        try {
          const res = await fetch('/api/notifications/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId,
              title,
              message
            })
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            console.warn('[Notification Mail] Échec HTTP', {
              userId,
              status: res.status,
              title,
              error: data.error ?? data.message ?? 'Erreur inconnue',
              details: data
            });
            return;
          }

          if (data.sent === true) {
            console.info(`[Notification Mail] E-mail envoyé avec succès pour ${userId}`);
          }
        } catch (error) {
          console.error(`[Notification Mail] Erreur réseau pour ${userId}`, error);
        }
      })();
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearUserNotifications = () => {
    if (!currentUser) return;
    // Supprime toutes les notifications de l'utilisateur connecté
    setNotifications(prev => prev.filter(n => n.userId !== currentUser.id));
  };

  /**
   * Fabrique une entrée d'audit horodatée signée par l'utilisateur courant
   */
  const createAuditLog = (action: string, details: string): AuditLog => ({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: currentUser?.id || 'SYSTEM',
    action,
    details
  });

  // --- CRUD Modèles CMS ---
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

  // --- Workflow des Demandes d'Analyses ---

  /**
   * Enregistre une nouvelle demande d'analyse avec génération d'identifiant unique
   * et notifie automatiquement tous les managers habilités sur le laboratoire cible.
   */
  const addRequest = async (request: AnalysisRequest) => {
    const targetLabId = request.labId || activeLabId;
    const targetLab = laboratories.find(l => l.id === targetLabId);
    const reqPrefix = targetLab?.settings?.idPrefixes?.request || `REQ-${targetLab?.code || 'LAB'}`;

    // Garantit un ID unique non-séquentiel (ou remplace l'ID s'il existe déjà)
    const existingReqIds = new Set(rawRequests.map(r => r.id));
    const uniqueReqId = (!request.id || existingReqIds.has(request.id))
      ? generateUniqueLimsId(reqPrefix, existingReqIds)
      : request.id;

    const initialAudit = createAuditLog('Création', `Demande soumise au laboratoire [${targetLabId}]`);
    const newReq = { ...request, id: uniqueReqId, labId: targetLabId, auditTrail: [initialAudit] };
    setRequests(prev => [newReq, ...prev]);

    let currentUsers = users;
    if (currentUsers.length === 0) {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          currentUsers = await res.json();
          setUsers(currentUsers);
        } else {
          console.error(`[Notification] Échec de récupération de /api/users (Statut HTTP ${res.status}) pour l'utilisateur ${currentUser?.email} [${currentUser?.role}]`);
        }
      } catch (e) {
        console.error('[Notification] Erreur réseau sur /api/users :', e);
      }
    }

    // Filtrage souple (insensible à la casse sur le rôle) des managers du laboratoire cible
    let labManagers = currentUsers.filter(u => {
      const role = (u.role || '').toLowerCase();
      const isManager = role === 'manager';
      const matchesLab = !u.labId || u.labId === 'all' || u.labId === targetLabId;
      return isManager && matchesLab;
    });

    // Fallback : si aucun manager n'a le labId exact, on prend tous les managers existants
    if (labManagers.length === 0) {
      labManagers = currentUsers.filter(u => (u.role || '').toLowerCase() === 'manager');
    }

    console.info(`[Notification] Création demande ${uniqueReqId} (Lab: ${targetLabId}) -> ${labManagers.length} manager(s) trouvé(s) sur ${currentUsers.length} utilisateur(s) chargé(s).`);

    labManagers.forEach(m =>
      addNotification(
        m.id,
        'Nouvelle demande d\'analyse',
        `La demande ${uniqueReqId} ("${request.title}") a été soumise par ${currentUser?.name || 'un client'}.`,
        'email',
        { targetTab: 'requests', targetId: uniqueReqId, labId: targetLabId }
      )
    );
  };

  /**
   * Met à jour le statut d'une demande d'analyse, enrichit sa piste d'audit
   * et notifie le demandeur lors du franchissement des jalons clés.
   */
  const updateRequestStatus = (id: string, status: AnalysisRequest['status'], comment?: string) => {
    const reqToUpdate = rawRequests.find(r => r.id === id);

    if (reqToUpdate && reqToUpdate.status !== status) {
      // Dictionnaire UNIQUEMENT des étapes clés qui doivent notifier le demandeur
      const keyStageLabels: Record<string, string> = {
        'validee': 'Validée et prise en compte par le laboratoire',
        'En Cours': 'Analyses en cours de réalisation',
        'en_cours': 'Analyses en cours de réalisation',
        'En Validation': 'Résultats en cours de validation finale',
        'en_validation': 'Résultats en cours de validation finale',
        'a_valider': 'Résultats en cours de validation finale',
        'terminee': 'Terminée'
      };

      const stageLabel = keyStageLabels[status];

      // On notifie uniquement si le nouveau statut fait partie des étapes clés
      if (stageLabel) {
        addNotification(
          reqToUpdate.requesterId,
          `Avancement de votre demande ${reqToUpdate.id}`,
          `Votre demande "${reqToUpdate.title}" (${reqToUpdate.id}) a atteint une étape clé : ${stageLabel}.${comment ? `\nCommentaire : ${comment}` : ''}`,
          'email',
          { targetTab: 'requests', targetId: reqToUpdate.id, labId: reqToUpdate.labId }
        );
      }
    }

    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Changement de statut', `Statut passé à : ${status}.${comment ? ` Raison : ${comment}` : ''}`);
        return { ...r, status, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  /**
   * Refuse une demande client avec un motif obligatoire et notifie le demandeur.
   */
  const rejectRequest = (id: string, reason: string) => {
    const reqToUpdate = rawRequests.find(r => r.id === id);
    if (reqToUpdate) {
      addNotification(
        reqToUpdate.requesterId,
        `Demande ${reqToUpdate.id} refusée`,
        `Votre demande "${reqToUpdate.title}" (${reqToUpdate.id}) a été refusée.\nMotif : ${reason}`,
        'email',
        { targetTab: 'requests', targetId: reqToUpdate.id, labId: reqToUpdate.labId }
      );
    }
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Rejetée', `Demande refusée. Motif : ${reason}`);
        return { ...r, status: 'rejetee', rejectionReason: reason, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  /**
   * Permet au demandeur de corriger et resoumettre une demande précédemment refusée.
   */
  const resubmitRequest = (id: string, customData: Record<string, any>) => {
    const reqToUpdate = rawRequests.find(r => r.id === id);
    if (reqToUpdate) {
      const labManagers = users.filter(u => (u.role === 'manager') && (u.labId === reqToUpdate.labId || u.labId === 'all' || !u.labId));
      labManagers.forEach(m =>
        addNotification(
          m.id,
          `Demande ${reqToUpdate.id} resoumise`,
          `La demande ${reqToUpdate.id} ("${reqToUpdate.title}") a été corrigée et resoumise par le client.`,
          'email',
          { targetTab: 'requests', targetId: reqToUpdate.id, labId: reqToUpdate.labId }
        )
      );
    }
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Resoumission', `Demande modifiée et resoumise par le demandeur.`);
        return { ...r, status: 'soumise', customData, rejectionReason: undefined, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  /**
   * Assigne (ou désassigne) une demande à un analyste, répercute le nom du technicien
   * sur toutes les analyses rattachées aux échantillons de la demande, et notifie les parties.
   */
  const assignRequest = (requestId: string, analystId: string) => {
    const reqToUpdate = rawRequests.find(r => r.id === requestId);
    if (reqToUpdate) {
      const analyst = users.find(u => u.id === analystId);
      if (analystId) {
        addNotification(
          analystId,
          `Nouvelle assignation (${reqToUpdate.id})`,
          `La demande ${reqToUpdate.id} ("${reqToUpdate.title}") vous a été assignée pour réalisation des essais.`,
          'email',
          { targetTab: 'requests', targetId: reqToUpdate.id, labId: reqToUpdate.labId }
        );
        addNotification(
          reqToUpdate.requesterId,
          `Demande ${reqToUpdate.id} prise en charge`,
          `Votre demande "${reqToUpdate.title}" (${reqToUpdate.id}) a été assignée à notre équipe technique (${analyst?.name || 'Analyste'}).`,
          'email',
          { targetTab: 'requests', targetId: reqToUpdate.id, labId: reqToUpdate.labId }
        );
      }
    }

    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        const analyst = users.find(u => u.id === analystId);
        const audit = createAuditLog(analystId ? 'Assignation' : 'Désassignation', analystId ? `Demande assignée à l'analyste : ${analyst?.name}` : `Demande non assignée`);
        return { ...r, assignedTo: analystId || undefined, status: analystId ? 'assignee' : (r.status === 'assignee' ? 'validee' : r.status), auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));

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

  /**
   * Modifie les données ou la priorité d'une demande par un manager (avec propagation de la priorité aux échantillons).
   */
  const updateRequestData = (id: string, updates: Partial<AnalysisRequest>, summary: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Modification Manager', summary);
        return { ...r, ...updates, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
    if (updates.priority) {
      setSamples(prev => prev.map(s => s.requestId === id ? { ...s, priority: updates.priority as any } : s));
    }
  };

  // --- Gestion des Échantillons & Sous-Échantillons ---

  /**
   * Ajoute un nouvel échantillon ou sous-échantillon en garantissant l'unicité de son ID.
   */
  const addSample = (sample: Sample) => {
    setSamples(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const prefix = labSettings?.idPrefixes?.sample || 'ECH';
      const uniqueId = (!sample.id || existingIds.has(sample.id))
        ? generateUniqueLimsId(prefix, existingIds)
        : sample.id;

      const item = { ...sample, id: uniqueId, labId: sample.labId || activeLabId };
      return [item, ...prev];
    });
  };

  /**
   * Supprime un échantillon, ses sous-échantillons enfants éventuels, ainsi que toutes leurs analyses rattachées.
   */
  const deleteSample = (id: string) => {
    const childSampleIds = new Set(rawSamples.filter(s => s.parentSampleId === id).map(s => s.id));
    setSamples(prev => prev.filter(s => s.id !== id && s.parentSampleId !== id));
    setAnalyses(prev => prev.filter(a => a.sampleId !== id && !childSampleIds.has(a.sampleId)));
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

  // --- Gestion des Analyses & Résultats d'Essais ---

  /**
   * Crée une nouvelle fiche d'analyse avec génération d'un identifiant unique `ESS-AA-XXXXX`.
   */
  const addAnalysis = (analysis: Analysis) => {
    setAnalyses(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const uniqueId = (!analysis.id || existingIds.has(analysis.id))
        ? generateUniqueLimsId('ESS', existingIds)
        : analysis.id;

      const item = { ...analysis, id: uniqueId, labId: analysis.labId || activeLabId };
      return [item, ...prev];
    });
  };

  const deleteAnalysis = (id: string) => {
    setAnalyses(prev => prev.filter(a => a.id !== id));
  };

  /**
   * Met à jour le statut d'une analyse et orchestre les transitions automatiques avec la demande parente :
   * - Si `status === 'rejete'` : notifie l'analyste et rouvre la demande (`En Cours`) si elle était `En Validation`.
   * - Si `status === 'a_valider'` : notifie les managers du laboratoire.
   * - Si tous les échantillons et analyses d'une demande sont prêts (`a_valider`, `valide` ou `termine`),
   *   bascule automatiquement la demande parente au statut `En Validation`.
   */
  const updateAnalysisStatus = (id: string, status: Analysis['status'], comment?: string) => {
    setAnalyses(prevAnalyses => {
      const updatedAnalyses = prevAnalyses.map(analysis => {
        if (analysis.id === id) {
          const audit = createAuditLog(
            status === 'rejete' ? 'Essai refusé' : 'Changement de statut',
            `Statut passé à : ${status}${comment ? ` — Motif : ${comment}` : ''}`
          );
          return {
            ...analysis,
            status,
            rejectionReason: status === 'rejete' ? (comment || 'Résultats à reprendre') : (status === 'a_valider' ? undefined : analysis.rejectionReason),
            updatedAt: new Date().toISOString(),
            auditTrail: [audit, ...(analysis.auditTrail || [])]
          };
        }
        return analysis;
      });

      const targetAnalysis = updatedAnalyses.find(an => an.id === id);

      // Si le manager rejette l'analyse : on notifie l'analyste et on remet la demande "En Cours" si elle était "En Validation"
      if (targetAnalysis && status === 'rejete') {
        const sample = rawSamples.find(s => s.id === targetAnalysis.sampleId);
        const parentReq = sample?.requestId ? rawRequests.find(r => r.id === sample.requestId) : undefined;
        if (parentReq?.assignedTo) {
          addNotification(
            parentReq.assignedTo,
            `Analyse ${targetAnalysis.id} refusée`,
            `L'analyse ${targetAnalysis.id} (échantillon ${targetAnalysis.sampleId}) a été refusée par le manager.${comment ? `\nMotif : ${comment}` : ''}\nVeuillez corriger les résultats et la resoumettre.`,
            'email',
            { targetTab: 'analyses', targetId: targetAnalysis.id, labId: targetAnalysis.labId }
          );
        }
        if (parentReq && parentReq.status === 'En Validation') {
          setTimeout(() => {
            updateRequestStatus(parentReq.id, 'En Cours', `Réouverture suite au refus de l'analyse ${targetAnalysis.id}`);
          }, 0);
        }
      }

      // Si l'essai passe à "a_valider" ou "valide" ou "termine"
      if (targetAnalysis && (status === 'a_valider' || status === 'valide' || status === 'termine')) {
        if (status === 'a_valider') {
          const labManagers = users.filter(
            u => (u.role === 'manager') && (u.labId === targetAnalysis.labId || u.labId === 'all' || !u.labId)
          );
          labManagers.forEach(m =>
            addNotification(
              m.id,
              `Analyse ${targetAnalysis.id} à valider`,
              `L'analyse ${targetAnalysis.id} sur l'échantillon ${targetAnalysis.sampleId} est prête pour validation technique.`,
              'email',
              { targetTab: 'analyses', targetId: targetAnalysis.id, labId: targetAnalysis.labId }
            )
          );
        }

        const sample = rawSamples.find(s => s.id === targetAnalysis.sampleId);
        const parentRequestId = sample?.requestId || (
          sample?.parentSampleId ? rawSamples.find(p => p.id === sample.parentSampleId)?.requestId : undefined
        );

        if (parentRequestId) {
          const parentReq = rawRequests.find(r => r.id === parentRequestId);

          if (parentReq && parentReq.status !== 'En Validation' && parentReq.status !== 'terminee') {
            const reqSamples = rawSamples.filter(
              s => s.requestId === parentRequestId || (s.parentSampleId && rawSamples.some(p => p.id === s.parentSampleId && p.requestId === parentRequestId))
            );
            const reqSampleIds = new Set(reqSamples.map(s => s.id));
            const reqAnalyses = updatedAnalyses.filter(an => reqSampleIds.has(an.sampleId));

            const allSamplesInTestingOrDone = reqSamples.every(
              s => s.status === 'en_essai' || s.status === 'termine' || s.status === 'non_conforme'
            );

            const allAnalysesReady =
              reqAnalyses.length > 0 &&
              reqAnalyses.every(an => an.status === 'a_valider' || an.status === 'valide' || an.status === 'termine');

            if (allSamplesInTestingOrDone && allAnalysesReady) {
              setTimeout(() => {
                updateRequestStatus(parentReq.id, 'En Validation' as AnalysisRequest['status']);
              }, 0);
            }
          }
        }
      }

      return updatedAnalyses;
    });
  };

  /**
   * Enregistre ou met à jour la valeur d'un résultat attendu dans une analyse,
   * sous réserve que l'analyse ne soit pas verrouillée pour le rôle de l'utilisateur courant.
   * Chaque modification est inscrite dans la piste d'audit avec l'ancienne et la nouvelle valeur.
   */
  const updateAnalysisResult = (id: string, resultId: string, value: any) => {
    setAnalyses(prev => prev.map(a => {
      if (a.id === id) {
        const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
        // Un analyste ne peut plus modifier dès le statut 'a_valider' ; un manager peut corriger jusqu'au statut 'termine'
        const isLocked = (!isManager && (a.status === 'a_valider' || a.status === 'valide' || a.status === 'termine')) || (isManager && a.status === 'termine');
        if (isLocked) {
          console.warn('Modification refusée : l\'analyse est verrouillée pour ce profil.');
          return a;
        }

        const formatAuditVal = (v: any) => {
          if (v && typeof v === 'object' && Array.isArray(v.images)) {
            return `${v.images.length} micrographie(s) (${v.images.map((i: any) => i.name).join(', ')})`;
          }
          return typeof v === 'object' ? JSON.stringify(v) : (v ?? 'N/A');
        };

        const previous = formatAuditVal(a.results[resultId]);
        const nextVal = formatAuditVal(value);
        const audit = createAuditLog('Modification de résultat', `${resultId}: ${previous} -> ${nextVal}`);
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
        const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
        const isLocked = (!isManager && (a.status === 'a_valider' || a.status === 'valide' || a.status === 'termine')) || (isManager && a.status === 'termine');
        if (isLocked) return a;

        return { ...a, images: [...a.images, imageUrl], updatedAt: new Date().toISOString() };
      }
      return a;
    }));
  };

  // --- Gestion des Rapports ---

  /**
   * Ajoute un rapport officiel, résout automatiquement la demande parente si non spécifiée,
   * clôture la demande parente au statut `terminee` et notifie le client demandeur.
   */
  const addReport = (report: Report) => {
    // Résolution automatique du requestId à partir des échantillons liés s'il n'est pas fourni
    let resolvedRequestId = report.requestId;
    if (!resolvedRequestId && Array.isArray(report.sampleIds) && report.sampleIds.length > 0) {
      const sampleWithReq = rawSamples.find(s => report.sampleIds.includes(s.id) && s.requestId);
      if (sampleWithReq?.requestId) {
        resolvedRequestId = sampleWithReq.requestId;
      }
    }

    const item: Report = {
      ...report,
      requestId: resolvedRequestId,
      labId: report.labId || activeLabId
    };
    setReports(prev => [item, ...prev]);

    // Passe automatiquement la demande parente au statut 'terminee' et notifie le client
    if (resolvedRequestId) {
      const parentReq = rawRequests.find(r => r.id === resolvedRequestId);
      if (parentReq) {
        if (parentReq.status !== 'terminee') {
          setRequests(prev =>
            prev.map(r => {
              if (r.id === resolvedRequestId) {
                const audit = createAuditLog('Rapport généré', `Rapport ${item.id} publié et mis à disposition du demandeur.`);
                return { ...r, status: 'terminee', auditTrail: [audit, ...(r.auditTrail || [])] };
              }
              return r;
            })
          );
        }

        addNotification(
          parentReq.requesterId,
          `Nouveau rapport disponible (${item.id})`,
          `Le rapport d'analyse "${item.title}" (${item.id}) concernant votre demande ${parentReq.id} a été publié et est disponible au téléchargement sur votre espace client.`,
          'email',
          { targetTab: 'reports', targetId: item.id, labId: item.labId }
        );
      }
    }
  };

  const deleteReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
  };

  // --- Gestion des Consommables & Stocks ---

  const addConsumable = (consumable: Consumable) => {
    const item = { ...consumable, labId: consumable.labId || activeLabId };
    setConsumables(prev => [item, ...prev]);
  };

  const deleteConsumable = (id: string) => {
    setConsumables(prev => prev.filter(c => c.id !== id));
  };

  /**
   * Met à jour le stock d'un consommable, actualise la date de réapprovisionnement en cas d'ajout
   * et déclenche une alerte aux managers si le stock franchit à la baisse le seuil minimal.
   */
  const updateConsumableStock = (id: string, newLevel: number) => {
    const c = rawConsumables.find(cons => cons.id === id);
    if (c) {
      if (newLevel <= c.minThreshold && c.stockLevel > c.minThreshold) {
        const labManagers = users.filter(u => (u.role === 'manager') && (u.labId === c.labId || u.labId === 'all' || !u.labId));
        labManagers.forEach(m => addNotification(
          m.id,
          `Alerte Stock Bas : ${c.name}`,
          `Le niveau de stock pour "${c.name}" est passé sous le seuil minimal (${newLevel} ${c.unit} restants, seuil fixé à ${c.minThreshold} ${c.unit}).`,
          'email',
          { targetTab: 'inventory', targetId: c.id, labId: c.labId }
        ));
      }
    }

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

  // Vérification de la péremption des consommables (horizon 60 jours)
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'manager' && currentUser.role !== 'analyste')) return;

    const now = new Date();
    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(now.getDate() + 60);

    consumables.forEach(c => {
      if (c.expiryDate) {
        const expDate = new Date(c.expiryDate);
        if (expDate <= sixtyDaysLater) {
          const isExpired = expDate < now;
          const title = isExpired ? `Péremption Dépassée : ${c.name}` : `Alerte Péremption Proche : ${c.name}`;
          const message = isExpired
            ? `Le consommable "${c.name}" a dépassé sa date de péremption (${c.expiryDate}).`
            : `Le consommable "${c.name}" arrive à expiration le ${c.expiryDate}.`;

          // Évite de recréer une notification si une alerte existe déjà pour ce consommable
          const alreadyNotified = notifications.some(
            n => n.targetTab === 'inventory' && n.targetId === c.id && n.title === title
          );
          if (!alreadyNotified) {
            const labManagers = users.filter(u => (u.role === 'manager') && (u.labId === c.labId || u.labId === 'all' || !u.labId));
            labManagers.forEach(m => addNotification(
              m.id,
              title,
              message,
              'email',
              { targetTab: 'inventory', targetId: c.id, labId: c.labId }
            ));
          }
          console.warn(`[ALERTE PÉREMPTION] ${message}`);
        }
      }
    });
  }, [consumables, currentUser]);

  /**
   * Restaure un jeu de configurations CMS complet (import JSON depuis `Settings.tsx`).
   */
  const applyPatch = (patch: any) => {
    if (patch.laboratories) setLaboratories(patch.laboratories);
    if (patch.materialTemplates) setMaterialTemplates(patch.materialTemplates);
    if (patch.analysisTemplates) setAnalysisTemplates(patch.analysisTemplates);
    if (patch.requestTemplates) setRequestTemplates(patch.requestTemplates);
    if (patch.reportTemplates) setReportTemplates(patch.reportTemplates);
  };

  /**
   * Purge sélectivement les collections opérationnelles du laboratoire actif (`Settings.tsx`).
   */
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
      laboratories, activeLabId, activeLab, setActiveLabId, updateLaboratory, addLaboratory, deleteLaboratory,
      notifications, markNotificationAsRead, addNotification, clearUserNotifications,
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
      addSample, deleteSample, updateSampleStatus,
      updateSampleMounting, addSampleImage,
      addAnalysis, deleteAnalysis, updateAnalysisStatus,
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
 * Hook personnalisé d'accès au contexte global LIMS.
 * Lève une exception explicite s'il est appelé en dehors de `<LimsProvider>`.
 */
export const useLims = () => {
  const context = useContext(LimsContext);
  if (context === undefined) {
    throw new Error('useLims doit obligatoirement être utilisé à l\'intérieur d\'un LimsProvider');
  }
  return context;
};
