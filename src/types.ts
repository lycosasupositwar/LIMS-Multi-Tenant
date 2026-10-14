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

/**
 * Statut d'avancement d'un échantillon physique dans le laboratoire
 * - receptionne : Pris en charge à la réception, en attente de préparation
 * - en_preparation : En cours d'enrobage, tronçonnage, polissage ou attaque chimique
 * - en_essai : Actuellement sur banc de mesure / microscope / machine d'essai
 * - termine : Tous les essais associés ont été réalisés
 * - non_conforme : Échantillon endommagé ou non conforme aux spécifications d'entrée
 */
export type SampleStatus = 'receptionne' | 'en_preparation' | 'en_essai' | 'termine' | 'non_conforme';

/**
 * Statut du flux technique d'une analyse unitaire
 * - planifie : Programmée sur l'échantillon, technicien non encore assigné ou en attente
 * - en_cours : Mesures en cours d'acquisition par l'analyste
 * - a_valider : Données saisies, en attente de revue technique
 * - valide : Analyse validée techniquement par le responsable
 * - termine : Clôturée et intégrable dans le rapport
 * - rejete : Mesure non conforme ou essai à relancer
 */
export type AnalysisStatus = 'planifie' | 'en_cours' | 'a_valider' | 'valide' | 'termine' | 'rejete';

/**
 * Degré de priorité d'une demande ou d'un échantillon pour l'ordonnancement
 */
export type Priority = 'haute' | 'normale' | 'basse';

/**
 * Grandes familles de matériaux pris en charge par le laboratoire
 */
export type MaterialCategory = 'Céramique' | 'Métal' | 'Cermet' | 'Organique' | 'Composite' | 'Poudres' | 'Polymère';

/**
 * Forme physique ou état métallurgique de l'échantillon à réception
 */
export type MaterialState = 'Poudre' | 'Fritté' | 'Massif' | 'Liquide';

/**
 * Profils d'accès et droits dans l'application (RBAC)
 * - demandeur : Client ou donneur d'ordre externe/interne (dépôt et suivi de ses demandes)
 * - analyste : Technicien de laboratoire (réalisation des essais, saisie des mesures)
 * - manager : Responsable de laboratoire (revue, validation, administration, configuration)
 */
export type Role = 'demandeur' | 'analyste' | 'manager' | 'admin';

/**
 * Cycle de vie global d'une demande d'analyse déposée par un demandeur
 */
export type RequestStatus = 'brouillon' | 'soumise' | 'en_revue' | 'validee' | 'assignee' | 'en_cours' | 'en_validation' | 'terminee' | 'rejetee';

/**
 * Catégories de consommables pour la gestion des stocks de métallographie
 */
export type ConsumableCategory = 'Résine' | 'Abrasif' | 'Chimie' | 'Équipement';

/**
 * Entités de Gestion Multi-Laboratoires (Multi-Tenancy)
 * 
 * Permet d'isoler de manière étanche deux ou plusieurs laboratoires distincts
 * (ex: Métallographie vs Essais Mécaniques & Physico-Chimie) ayant chacun :
 * - Leurs propres catalogues d'essais et templates de CMS (analyses, formulaires, matériaux)
 * - Leurs propres équipes dédiées (managers et techniciens/analystes)
 * - Leurs propres consommables, stocks et équipements
 * Tout en conservant un point d'accès unifié pour les clients/demandeurs.
 */
export interface Laboratory {
  /** Identifiant unique et pérenne du laboratoire */
  id: string;
  /** Dénomination officielle complète */
  name: string;
  /** Nom abrégé pour les sélecteurs et étiquettes */
  shortName: string;
  /** Code trigramme officiel utilisé pour les préfixes documentaires (ex: 'MET', 'MEC') */
  code: string;
  /** Description des spécialités et domaines d'accréditation */
  description: string;
  /** Famille de couleur pour l'identité visuelle */
  themeColor: 'blue' | 'emerald' | 'purple' | 'amber';
  /** Classes CSS Tailwind pour les badges */
  badgeBg: string;
  badgeText: string;
  /** Paramètres administratifs et charte graphique du laboratoire */
  settings: LabSettings;
}

// ==========================================
// 2. Gestion des Consommables & Stocks
// ==========================================

/**
 * Article d'inventaire suivi en stock (résines, disques diamant, réactifs d'attaque)
 */
export interface Consumable {
  /** Identifiant unique du consommable */
  id: string;
  /** Laboratoire propriétaire de cet article en stock */
  labId: string;
  /** Désignation commerciale ou technique */
  name: string;
  /** Catégorie de stockage */
  category: ConsumableCategory;
  /** Quantité actuellement en stock */
  stockLevel: number;
  /** Seuil minimal d'alerte pour réapprovisionnement */
  minThreshold: number;
  /** Unité de mesure (ex: kg, flacons, boîtes, pièces) */
  unit: string;
  /** Date du dernier réapprovisionnement au format ISO */
  lastRestocked: string;
}

// ==========================================
// 3. Utilisateurs, Notifications & Audit
// ==========================================

/**
 * Représentation d'un utilisateur du système
 */
export interface User {
  /** Identifiant unique */
  id: string;
  /** Nom et prénom */
  name: string;
  /** Adresse email (identifiant de connexion unique) */
  email: string;
  /** Rôle applicatif déterminant les habilitations */
  role: Role;
  /** Nom de l'entreprise ou du service rattaché (pour les demandeurs) */
  company?: string;
  /** Rattachement à un laboratoire spécifique (non défini pour les demandeurs multi-labos, 'all' pour les directeurs de site) */
  labId?: string;
}

/**
 * Entrée de traçabilité dans la piste d'audit (exigences ISO 17025)
 */
export interface AuditLog {
  /** Identifiant de l'événement */
  id: string;
  /** Horodatage précis (ISO 8601) */
  timestamp: string;
  /** ID de l'utilisateur ayant exécuté l'action */
  userId: string;
  /** Nature de l'opération (ex: 'CREATE', 'UPDATE', 'VALIDATION') */
  action: string;
  /** Description détaillée des modifications apportées */
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
}

// ==========================================
// 4. Modèles Dynamiques & Champs Personnalisés
// ==========================================

/**
 * Définition d'un champ dynamique configurable via le CMS / Builder
 */
export interface CustomField {
  /** Clé interne du champ */
  id: string;
  /** Libellé affiché à l'écran */
  name: string;
  /** Type de saisie attendu */
  type: 'text' | 'number' | 'number_series' | 'select' | 'boolean' | 'multiselect' | 'date' | 'analyses' | 'image';
  /** Liste des valeurs possibles pour les types select et multiselect */
  options?: string[];
  /** Obligation de saisie pour valider le formulaire */
  required: boolean;
  /** Unité physique associée le cas échéant (ex: MPa, mm, °C) */
  unit?: string;
}

/**
 * Modèle de matériau configurable pour typer les échantillons
 */
export interface MaterialTemplate {
  /** Identifiant unique du modèle */
  id: string;
  /** Laboratoire propriétaire de ce gabarit de matériau */
  labId: string;
  /** Nom du matériau (ex: 'Inconel 718', 'Zircone Y-TZP') */
  name: string;
  /** Famille de matériau */
  category: MaterialCategory;
  /** Description technique */
  description: string;
  /** Indicateur d'activation dans les formulaires */
  isActive?: boolean;
  /** Liste des champs spécifiques requis pour ce matériau */
  fields: CustomField[];
}

/**
 * Valeur ou mesure attendue lors d'une analyse unitaire
 */
export interface ExpectedResult {
  /** Identifiant du paramètre */
  id: string;
  /** Désignation du paramètre mesuré (ex: 'Dureté Vickers HV10') */
  name: string;
  /** Format de la donnée collectée */
  type: 'number' | 'number_series' | 'text' | 'image' | 'boolean' | 'select' | 'multiselect';
  /** Options pour listes de choix */
  options?: string[];
  /** Unité de mesure (ex: 'HV', 'µm', '%') */
  unit?: string;
  /** Champ requis pour la clôture technique */
  required: boolean;
}

/**
 * Gabarit de méthode d'essai / analyse (ex: Métallographie, Traction, MEB)
 */
export interface AnalysisTemplate {
  /** Identifiant unique du gabarit */
  id: string;
  /** Laboratoire réalisant cet essai */
  labId: string;
  /** Nom de la méthode d'essai */
  name: string;
  /** Domaine d'essai (ex: 'Caractérisation Microstructurale', 'Essais Mécaniques') */
  category: string;
  /** Description de la méthode */
  description: string;
  /** Norme de référence applicable (ex: 'NF EN ISO 6507-1', 'ASTM E3') */
  standardRef?: string;
  /** Indicateur de disponibilité dans le catalogue */
  isActive?: boolean;
  /** Ensemble des grandeurs à relever pour cet essai */
  expectedResults: ExpectedResult[];
}

/**
 * Modèle de formulaire pour le portail demandeur
 */
export interface RequestTemplate {
  /** Identifiant du modèle */
  id: string;
  /** Laboratoire destinataire de ce type de formulaire */
  labId: string;
  /** Intitulé de la prestation type */
  name: string;
  /** Instructions pour le demandeur */
  description: string;
  /** Modèle actif ou archivé */
  isActive?: boolean;
  /** Champs obligatoires et optionnels à remplir par le client */
  fields: CustomField[];
}

// ==========================================
// 5. Demandes d'Analyses & Échantillons
// ==========================================

/**
 * Demande d'essais globale soumise par un demandeur
 */
export interface AnalysisRequest {
  /** Code de suivi unique de la demande (ex: 'REQ-MET-2026-001') */
  id: string;
  /** Laboratoire auquel la demande est adressée */
  labId: string;
  /** Identifiant du demandeur */
  requesterId: string;
  /** Modèle de formulaire utilisé */
  templateId: string;
  /** Titre ou objet de l'affaire */
  title: string;
  /** Statut d'instruction de la demande */
  status: RequestStatus;
  /** Date de dépôt */
  createdAt: string;
  /** Réponses aux champs dynamiques configurés */
  customData: Record<string, any>;
  /** Responsable d'analyse ou coordinateur assigné */
  assignedTo?: string;
  /** Journal des actions et changements d'états */
  auditTrail?: AuditLog[];
  /** Motif explicatif en cas de refus technique */
  rejectionReason?: string;
}

/**
 * Paramètres de préparation métallographique de l'échantillon
 */
export interface MountingInfo {
  /** Technique d'enrobage mise en œuvre */
  method: 'Enrobage à chaud' | 'Enrobage à froid' | 'Aucun';
  /** Nature de la résine utilisée */
  resinType?: string;
  /** Diamètre du plot d'enrobage en millimètres */
  diameter?: number;
  /** Étapes successives de polissage (granulométrie, disques, suspensions) */
  polishingSteps?: string[];
  /** Réactif d'attaque chimique micrographique (ex: Nital 3%, Villela) */
  etching?: string;
}

/**
 * Échantillon physique ou sous-échantillon suivi au laboratoire
 */
export interface Sample {
  /** Identifiant unique de l'échantillon (ex: 'ECH-001') */
  id: string;
  /** Laboratoire prenant en charge cet échantillon */
  labId: string;
  /** Référence de l'échantillon parent en cas de prélèvement dérivé */
  parentSampleId?: string;
  /** Demande rattachée le cas échéant */
  requestId?: string;
  /** Code-barres ou identifiant scannable pour étiquetage */
  barcode: string;
  /** Modèle de matériau associé */
  templateId: string;
  /** État physique initial */
  materialState: MaterialState;
  /** Statut courant dans le flux laboratoire */
  status: SampleStatus;
  /** Date et heure de réception physique */
  receivedAt: string;
  /** Donneur d'ordre ou client */
  client: string;
  /** Projet de recherche ou numéro de commande */
  project: string;
  /** Priorité de passage */
  priority: Priority;
  /** Données spécifiques selon le modèle de matériau */
  customData: Record<string, any>;
  /** Fiche suiveuse de préparation métallographique */
  mountingInfo?: MountingInfo;
  /** Clichés macroscopiques et microscopiques attachés */
  images: string[];
  /** Remarques ou observations particulières de l'opérateur */
  notes?: string;
}

// ==========================================
// 6. Résultats d'Analyses & Rapports
// ==========================================

/**
 * Enregistrement unitaire d'un résultat d'essai
 */
export interface AnalysisResult {
  /** Référence du paramètre mesuré */
  expectedResultId: string;
  /** Valeur brute, calculée ou booléenne */
  value: any;
}

/**
 * Fiche d'exécution d'une analyse sur un échantillon donné
 */
export interface Analysis {
  /** Identifiant unique de l'analyse */
  id: string;
  /** Laboratoire d'exécution de l'analyse */
  labId: string;
  /** Échantillon testé */
  sampleId: string;
  /** Méthode d'essai appliquée */
  templateId: string;
  /** Valeurs obtenues indexées par l'ID de chaque résultat attendu */
  results: Record<string, any>;
  /** Clichés et micrographies spécifiques à cet essai */
  images: string[];
  /** Statut de l'analyse */
  status: AnalysisStatus;
  /** Nom du technicien ayant opéré la mesure */
  technician: string;
  /** Date de dernière mise à jour */
  updatedAt: string;
  /** Commentaires techniques ou déviations constatées */
  notes?: string;
  /** Historique des modifications apportées aux résultats */
  auditTrail?: AuditLog[];
}

/**
 * Paramètres généraux d'identification et de charte graphique du laboratoire
 */
export interface LabSettings {
  /** Raison sociale du laboratoire */
  labName: string;
  /** Adresse postale officielle */
  labAddress: string;
  /** Adresse email de contact */
  contactEmail: string;
  /** Numéro de téléphone standard */
  phone: string;
  /** Accréditations et certifications (ex: ISO 17025, ISO 9001) */
  isoCertifications: string[];
  /** URL ou image encodée du logo d'en-tête */
  logoUrl: string;
  /** Personnalisation des tableaux générés dans les rapports */
  tableStyles?: {
    headerBgColor: string;
    borderColor: string;
    borderSize: number;
  };
  /** Préfixes utilisés pour l'incrémentation automatique des numéros */
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
}

/**
 * Modèle de document de rapport ou certificat d'analyse
 */
export interface ReportTemplate {
  /** Type de document */
  type?: 'report' | 'certificate';
  /** Identifiant unique */
  id: string;
  /** Laboratoire rattaché à ce modèle */
  labId: string;
  /** Titre du modèle */
  name: string;
  /** Brève description */
  description: string;
  /** Contenu textuel avec balises de publipostage (ex: {{client}}, {{date}}) */
  content?: string;
  /** Nom du fichier modèle Word (.docx) importé */
  fileName?: string;
  /** Fichier modèle encodé en base64 pour injection documentaire */
  fileData?: string;
  /** Modèle actif */
  isActive?: boolean;
}
