/**
 * Système de Gestion de Laboratoire (LIMS) - Définitions des types TypeScript
 * 
 * Ce fichier centralise l'ensemble des types, énumérations et interfaces métier
 * nécessaires au fonctionnement du LIMS (norme ISO/IEC 17025) :
 * - Gestion du cycle de vie des échantillons et sous-échantillons
 * - Définition dynamique des essais (templates de caractérisation et attendus)
 * - Traçabilité complète (piste d'audit, statuts, rôles utilisateurs)
 * - Gestion des demandes d'analyses clients et des rapports finaux
 */

// ==========================================
// 1. Énumérations & Types de Statuts Métier
// ==========================================

export type SampleStatus = 'receptionne' | 'en_preparation' | 'en_essai' | 'termine' | 'non_conforme';

export type AnalysisStatus = 'planifie' | 'En Cours' | 'a_valider' | 'valide' | 'termine' | 'rejete';

export type Priority = 'haute' | 'normale' | 'basse';

export type MaterialCategory = 'Céramique' | 'Métal' | 'Cermet' | 'Organique' | 'Composite' | 'Poudres' | 'Polymère';

export type MaterialState = 'Poudre' | 'Fritté' | 'Massif' | 'Liquide';

export type Role = 'demandeur' | 'analyste' | 'manager' | 'admin';

export type RequestStatus = 'brouillon' | 'soumise' | 'En Revue' | 'validee' | 'assignee' | 'En Cours' | 'En Validation' | 'terminee' | 'rejetee';

export type ConsumableCategory = 'Résine' | 'Abrasif' | 'Chimie' | 'Équipement';

export interface Laboratory {
  id: string;
  name: string;
  shortName: string;
  code: string;
  description: string;
  themeColor: 'blue' | 'emerald' | 'purple' | 'amber';
  badgeBg: string;
  badgeText: string;
  settings: LabSettings;
}

// ==========================================
// 2. Gestion des Consommables & Stocks
// ==========================================

export interface Consumable {
  id: string;
  labId: string;
  name: string;
  category: ConsumableCategory;
  stockLevel: number;
  minThreshold: number;
  unit: string;
  lastRestocked: string;
  expiryDate?: string;
}

// ==========================================
// 3. Utilisateurs, Notifications & Audit
// ==========================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company?: string;
  labId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  details: string;
}

/**
 * Notification système ou email adressée à un utilisateur
 */
export interface Notification {
  /** Identifiant de la notification */
  id: string;
  /** Destinataire */
  userId: string;
  /** Objet ou titre */
  title: string;
  /** Corps du message */
  message: string;
  /** Indicateur de lecture */
  read: boolean;
  /** Date de génération */
  createdAt: string;
  /** Canal d'acheminement */
  type: 'system' | 'email';
  /** Onglet cible lors du clic ('requests' | 'samples' | 'analyses' | 'reports' | 'inventory' | 'settings') */
  targetTab?: string;
  /** Identifiant précis de l'élément ciblé (ex: 'ESS-26-0612', 'REQ-MET-26-001') */
  targetId?: string;
  /** Identifiant du laboratoire concerné */
  labId?: string;
}

// ==========================================
// 4. Modèles Dynamiques & Champs Personnalisés
// ==========================================

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'number_series' | 'select' | 'boolean' | 'multiselect' | 'date' | 'analyses' | 'image';
  options?: string[];
  required: boolean;
  unit?: string;
}

export interface MaterialTemplate {
  id: string;
  labId: string;
  name: string;
  category: MaterialCategory;
  description: string;
  isActive?: boolean;
  fields: CustomField[];
}

export interface ExpectedResult {
  id: string;
  name: string;
  type: 'number' | 'number_series' | 'text' | 'image' | 'boolean' | 'select' | 'multiselect';
  options?: string[];
  unit?: string;
  required: boolean;
}

export interface AnalysisTemplate {
  id: string;
  labId: string;
  name: string;
  category: string;
  description: string;
  standardRef?: string;
  isActive?: boolean;
  expectedResults: ExpectedResult[];
}

export interface RequestTemplate {
  id: string;
  labId: string;
  name: string;
  description: string;
  isActive?: boolean;
  fields: CustomField[];
}

// ==========================================
// 5. Demandes d'Analyses & Échantillons
// ==========================================

export interface AnalysisRequest {
  id: string;
  labId: string;
  requesterId: string;
  templateId: string;
  title: string;
  status: RequestStatus;
  createdAt: string;
  customData: Record<string, any>;
  assignedTo?: string;
  auditTrail?: AuditLog[];
  rejectionReason?: string;
  priority?: 'basse' | 'normale' | 'haute';
}

export interface MountingInfo {
  method: 'Enrobage à chaud' | 'Enrobage à froid' | 'Aucun';
  resinType?: string;
  diameter?: number;
  polishingSteps?: string[];
  etching?: string;
}

export interface Sample {
  id: string;
  labId: string;
  parentSampleId?: string;
  requestId?: string;
  barcode: string;
  templateId: string;
  materialState: MaterialState;
  status: SampleStatus;
  receivedAt: string;
  client: string;
  project: string;
  priority: Priority;
  customData: Record<string, any>;
  mountingInfo?: MountingInfo;
  images: string[];
  notes?: string;
}

// ==========================================
// 6. Résultats d'Analyses & Rapports
// ==========================================

export interface AnalysisResult {
  expectedResultId: string;
  value: any;
}

export interface Analysis {
  id: string;
  labId: string;
  sampleId: string;
  templateId: string;
  results: Record<string, any>;
  images: string[];
  status: AnalysisStatus;
  technician: string;
  updatedAt: string;
  notes?: string;
  auditTrail?: AuditLog[];
}

export interface LabSettings {
  labName: string;
  labAddress: string;
  contactEmail: string;
  phone: string;
  isoCertifications: string[];
  logoUrl: string;
  tableStyles?: {
    headerBgColor: string;
    borderColor: string;
    borderSize: number;
  };
  idPrefixes?: {
    request: string;
    sample: string;
    subSample: string;
  };
}

/**
 * Rapport d'essai généré pour transmission au demandeur
 */
export interface Report {
  /** Identifiant du document */
  id: string;
  /** Laboratoire émetteur du rapport */
  labId: string;
  /** Titre officiel du rapport d'essai */
  title: string;
  /** Référence de la demande source */
  requestId?: string;
  /** Liste des échantillons inclus dans ce rapport */
  sampleIds: string[];
  /** Date d'émission */
  createdAt: string;
  /** État du document */
  status: 'genere' | 'brouillon';
  /** Format de sortie principal */
  format: 'PDF' | 'Word';
  /** Modèle de mise en page utilisé */
  templateId?: string;
  /** Nom du fichier stocké dans le dossier sécurisé storage/reports/ */
  storedFileName?: string;
}

export interface ReportTemplate {
  type?: 'report' | 'certificate';
  id: string;
  labId: string;
  name: string;
  description: string;
  content?: string;
  fileName?: string;
  fileData?: string;
  isActive?: boolean;
}