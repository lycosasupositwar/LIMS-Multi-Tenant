/**
 * Gestionnaire d'État Global & Multi-Laboratoires (LIMS React Context)
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

interface LimsContextType {
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  currentUser: User | null;
  users: User[];
  fetchUsers: () => Promise<void>;
  login: (user: User) => void;
  logout: () => void;

  laboratories: Laboratory[];
  activeLabId: string;
  activeLab: Laboratory;
  setActiveLabId: (labId: string) => void;
  updateLaboratory: (id: string, updates: Partial<Laboratory>) => void;
  addLaboratory: (lab: Laboratory) => void;
  deleteLaboratory: (id: string) => void;

  notifications: Notification[];
  markNotificationAsRead: (id: string) => void;
  addNotification: (userId: string, title: string, message: string, type?: 'system' | 'email') => void;

  materialTemplates: MaterialTemplate[];
  analysisTemplates: AnalysisTemplate[];
  requestTemplates: RequestTemplate[];
  reportTemplates: ReportTemplate[];

  allMaterialTemplates: MaterialTemplate[];
  allAnalysisTemplates: AnalysisTemplate[];
  allRequestTemplates: RequestTemplate[];
  allReportTemplates: ReportTemplate[];
  allSamples: Sample[];
  allAnalyses: Analysis[];
  allReports: Report[];
  allRequests: AnalysisRequest[];
  allConsumables: Consumable[];

  samples: Sample[];
  analyses: Analysis[];
  reports: Report[];
  requests: AnalysisRequest[];
  consumables: Consumable[];
  labSettings: LabSettings;

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

  addRequest: (request: AnalysisRequest) => void;
  updateRequestStatus: (id: string, status: AnalysisRequest['status'], comment?: string) => void;
  updateRequestData: (id: string, updates: Partial<AnalysisRequest>, summary: string) => void;
  rejectRequest: (id: string, reason: string) => void;
  resubmitRequest: (id: string, customData: Record<string, any>) => void;
  assignRequest: (requestId: string, analystId: string) => void;

  addSample: (sample: Sample) => void;
  updateSampleStatus: (id: string, status: Sample['status']) => void;
  updateSampleMounting: (id: string, mountingInfo: Sample['mountingInfo']) => void;
  addSampleImage: (id: string, imageUrl: string) => void;

  addAnalysis: (analysis: Analysis) => void;
  updateAnalysisStatus: (id: string, status: Analysis['status']) => void;
  updateAnalysisResult: (id: string, resultId: string, value: any) => void;
  addAnalysisImage: (id: string, imageUrl: string) => void;

  addReport: (report: Report) => void;
  deleteReport: (id: string) => void;

  updateConsumableStock: (id: string, newLevel: number) => void;
  addConsumable: (consumable: Consumable) => void;
  deleteConsumable: (id: string) => void;

  updateLabSettings: (settings: Partial<LabSettings>) => void;

  purgeData: (options: Record<string, boolean>) => void;
  applyPatch: (patch: any) => void;
}

const LimsContext = createContext<LimsContextType | undefined>(undefined);

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

export const LimsProvider = ({ children }: { children: ReactNode }) => {
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

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

  useEffect(() => {
    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'analyste')) {
      if (currentUser.labId && currentUser.labId !== 'all') {
        setActiveLabIdState(currentUser.labId);
      }
    }
  }, [currentUser]);

  const isAuthenticated = !!currentUser;

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

  const setActiveLabId = (labId: string) => {
    if (currentUser?.role === 'manager' || currentUser?.role === 'analyste') {
      if (currentUser.labId && currentUser.labId !== 'all' && currentUser.labId !== labId) {
        console.warn('Accès refusé : Vous ne pouvez pas sélectionner un laboratoire auquel vous n\'êtes pas assigné.');
        return;
      }
    }
    setActiveLabIdState(labId);
  };

  const activeLab = useMemo(() => {
    return laboratories.find(l => l.id === activeLabId) || laboratories[0] || initialLaboratories[0];
  }, [laboratories, activeLabId]);

  const labSettings = activeLab.settings;

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

  const isRequester = currentUser?.role === 'demandeur';

  const requests = useMemo(() => {
    if (isRequester) {
      return rawRequests.filter(r => r.requesterId === currentUser?.id);
    }
    return rawRequests.filter(r => r.labId === activeLabId);
  }, [rawRequests, isRequester, currentUser, activeLabId]);

  const samples = useMemo(() => {
    if (isRequester) {
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
   * Ajoute une notification dans l'application ET déclenche systématiquement
   * l'envoi d'un e-mail au destinataire via le serveur SMTP configuré.
   */

  const addNotification = (
    userId: string,
    title: string,
    message: string,
    type: 'system' | 'email' = 'email'
  ) => {

    console.trace('[addNotification] Appel', {
      userId,
      title,
      message,
      type,
      timestamp: new Date().toISOString()
    });



    // La notification est toujours enregistrée dans le système.
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

    // Le canal e-mail est indépendant de la notification interne.
    // Les appels de type "system" ne déclenchent pas de mail.
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

          // Lire la réponse même en cas d'erreur HTTP
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
            console.info(
              `[Notification Mail] E-mail envoyé avec succès pour ${userId}`
            );
          } else {
            console.warn(
              `[Notification Mail] Envoi non confirmé pour ${userId}`,
              data
            );
          }
        } catch (error) {
          console.error(
            `[Notification Mail] Erreur réseau pour ${userId}`,
            error
          );
        }
      })();
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

  const addRequest = (request: AnalysisRequest) => {
    const targetLabId = request.labId || activeLabId;
    const initialAudit = createAuditLog('Création', `Demande soumise au laboratoire [${targetLabId}]`);
    const newReq = { ...request, labId: targetLabId, auditTrail: [initialAudit] };
    setRequests(prev => [newReq, ...prev]);

    const labManagers = users.filter(u => (u.role === 'manager' || u.role === 'admin') && (u.labId === targetLabId || u.labId === 'all' || !u.labId));
    labManagers.forEach(m => addNotification(m.id, 'Nouvelle demande d\'analyse', `La demande ${request.id} ("${request.title}") a été soumise par ${currentUser?.name || 'un client'}.`, 'email'));
  };

  const updateRequestStatus = (id: string, status: AnalysisRequest['status'], comment?: string) => {
    const reqToUpdate = rawRequests.find(r => r.id === id);
    if (reqToUpdate) {
      addNotification(reqToUpdate.requesterId, `Mise à jour de votre demande ${reqToUpdate.id}`, `Votre demande "${reqToUpdate.title}" (${reqToUpdate.id}) est passée au statut : ${status}.${comment ? `\nCommentaire : ${comment}` : ''}`, 'email');
    }
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Changement de statut', `Statut passé à : ${status}.${comment ? ` Raison : ${comment}` : ''}`);
        return { ...r, status, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  const rejectRequest = (id: string, reason: string) => {
    const reqToUpdate = rawRequests.find(r => r.id === id);
    if (reqToUpdate) {
      addNotification(reqToUpdate.requesterId, `Demande ${reqToUpdate.id} refusée`, `Votre demande "${reqToUpdate.title}" (${reqToUpdate.id}) a été refusée.\nMotif : ${reason}`, 'email');
    }
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Rejetée', `Demande refusée. Motif : ${reason}`);
        return { ...r, status: 'rejetee', rejectionReason: reason, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  const resubmitRequest = (id: string, customData: Record<string, any>) => {
    const reqToUpdate = rawRequests.find(r => r.id === id);
    if (reqToUpdate) {
      const labManagers = users.filter(u => (u.role === 'manager' || u.role === 'admin') && (u.labId === reqToUpdate.labId || u.labId === 'all' || !u.labId));
      labManagers.forEach(m => addNotification(m.id, `Demande ${reqToUpdate.id} resoumise`, `La demande ${reqToUpdate.id} ("${reqToUpdate.title}") a été corrigée et resoumise par le client.`, 'email'));
    }
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Resoumission', `Demande modifiée et resoumise par le demandeur.`);
        return { ...r, status: 'soumise', customData, rejectionReason: undefined, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

  const assignRequest = (requestId: string, analystId: string) => {
    const reqToUpdate = rawRequests.find(r => r.id === requestId);
    if (reqToUpdate) {
      const analyst = users.find(u => u.id === analystId);
      if (analystId) {
        addNotification(analystId, `Nouvelle assignation (${reqToUpdate.id})`, `La demande ${reqToUpdate.id} ("${reqToUpdate.title}") vous a été assignée pour réalisation des essais.`, 'email');
        addNotification(reqToUpdate.requesterId, `Demande ${reqToUpdate.id} prise en charge`, `Votre demande "${reqToUpdate.title}" (${reqToUpdate.id}) a été assignée à notre équipe technique (${analyst?.name || 'Analyste'}).`, 'email');
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

  const updateRequestData = (id: string, updates: Partial<AnalysisRequest>, summary: string) => {
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        const audit = createAuditLog('Modification Manager', summary);
        return { ...r, ...updates, auditTrail: [audit, ...(r.auditTrail || [])] };
      }
      return r;
    }));
  };

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

  const addAnalysis = (analysis: Analysis) => {
    const item = { ...analysis, labId: analysis.labId || activeLabId };
    setAnalyses(prev => [item, ...prev]);
  };

  const updateAnalysisStatus = (id: string, status: Analysis['status']) => {
    if (status === 'a_valider') {
      const a = rawAnalyses.find(analysis => analysis.id === id);
      if (a) {
        const labManagers = users.filter(u => (u.role === 'manager' || u.role === 'admin') && (u.labId === a.labId || u.labId === 'all' || !u.labId));
        labManagers.forEach(m => addNotification(m.id, `Analyse ${a.id} à valider`, `L'analyse ${a.id} sur l'échantillon ${a.sampleId} est prête pour validation technique.`, 'email'));
      }
    }

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
        const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
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
        const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
        const isLocked = (!isManager && (a.status === 'a_valider' || a.status === 'valide' || a.status === 'termine')) || (isManager && a.status === 'termine');
        if (isLocked) return a;

        return { ...a, images: [...a.images, imageUrl], updatedAt: new Date().toISOString() };
      }
      return a;
    }));
  };

  const addReport = (report: Report) => {
    const item = { ...report, labId: report.labId || activeLabId };
    setReports(prev => [item, ...prev]);

    // Notifie automatiquement le client par e-mail lorsque son rapport est généré
    if (item.requestId) {
      const parentReq = rawRequests.find(r => r.id === item.requestId);
      if (parentReq) {
        addNotification(
          parentReq.requesterId,
          `Nouveau rapport disponible (${item.id})`,
          `Le rapport d'analyse "${item.title}" (${item.id}) concernant votre demande ${parentReq.id} a été publié et est disponible sur votre espace client.`,
          'email'
        );
      }
    }
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
    const c = rawConsumables.find(cons => cons.id === id);
    if (c) {
      if (newLevel <= c.minThreshold && c.stockLevel > c.minThreshold) {
        const labManagers = users.filter(u => (u.role === 'manager' || u.role === 'admin') && (u.labId === c.labId || u.labId === 'all' || !u.labId));
        labManagers.forEach(m => addNotification(
          m.id,
          `Alerte Stock Bas : ${c.name}`,
          `Le niveau de stock pour "${c.name}" est passé sous le seuil minimal (${newLevel} ${c.unit} restants, seuil fixé à ${c.minThreshold} ${c.unit}).`,
          'email'
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
      laboratories, activeLabId, activeLab, setActiveLabId, updateLaboratory, addLaboratory, deleteLaboratory,
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

export const useLims = () => {
  const context = useContext(LimsContext);
  if (context === undefined) {
    throw new Error('useLims doit obligatoirement être utilisé à l\'intérieur d\'un LimsProvider');
  }
  return context;
};