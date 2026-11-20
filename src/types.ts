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
 * Statuts du cycle de vie physique d'un échantillon ou sous-échantillon :
 * - `receptionne` : Échantillon enregistré à l'arrivée au laboratoire
 * - `en_preparation` : En cours d'usinage, découpe, enrobage ou polissage
 * - `en_essai` : Actuellement sur banc d'essai ou microscope
 * - `termine` : Tous les essais sur cet échantillon sont achevés
 * - `non_conforme` : Échantillon endommagé, pollué ou impropre à l'essai
 * - `restitue` : Échantillon retourné au client (fin de vie tracée)
 * - `detruit` : Échantillon mis au rebut / détruit après durée de conservation
 */
export type SampleStatus = 'receptionne' | 'en_preparation' | 'en_essai' | 'termine' | 'non_conforme' | 'restitue' | 'detruit';

/**
 * Statuts du cycle de vie d'une fiche d'analyse (essai individuel) :
 * - `planifie` : Essai créé mais pas encore démarré par l'analyste
 * - `En Cours` : Saisie des mesures ou observations en cours
 * - `a_valider` : Résultats soumis par l'analyste, en attente de revue technique Manager
 * - `valide` : Résultats approuvés techniquement par le Manager
 * - `termine` : Essai clôturé et verrouillé
 * - `rejete` : Résultats refusés par le Manager (retour à l'analyste avec motif)
 */
export type AnalysisStatus = 'planifie' | 'En Cours' | 'a_valider' | 'valide' | 'termine' | 'rejete';

/** Niveau d'urgence de traitement d'une demande ou d'un échantillon */
export type Priority = 'haute' | 'normale' | 'basse';

/** Grandes familles de matériaux gérées dans le Builder CMS */
export type MaterialCategory = 'Céramique' | 'Métal' | 'Cermet' | 'Organique' | 'Composite' | 'Poudres' | 'Polymère';

/** État physique macroscopique de l'échantillon à réception */
export type MaterialState = 'Poudre' | 'Fritté' | 'Massif' | 'Liquide';

/**
 * Rôles d'habilitation RBAC (Role-Based Access Control) :
 * - `demandeur` : Client interne/externe (accès restreint au Portail Demandeur et à ses propres dossiers)
 * - `analyste` : Technicien de laboratoire (exécution des essais, préparation d'échantillons, stocks)
 * - `manager` : Responsable de laboratoire (validation technique, assignation, Builder CMS, paramètres labo)
 * - `admin` : Super-administrateur système (accès multi-laboratoires, comptes, SMTP, logs serveur, sauvegardes)
 */
export type Role = 'demandeur' | 'analyste' | 'manager' | 'admin';

/**
 * Statuts d'avancement d'une demande d'analyse (`AnalysisRequest`) :
 * - `brouillon` : En cours de rédaction (non soumise)
 * - `soumise` : Déposée par le client, en attente de revue par le Manager
 * - `En Revue` : En cours d'examen de faisabilité technique
 * - `validee` : Acceptée par le laboratoire
 * - `assignee` : Attribuée à un analyste référent
 * - `En Cours` : Échantillons réceptionnés et essais en cours
 * - `En Validation` : Tous les essais liés sont prêts à être validés par le Manager
 * - `terminee` : Rapport officiel généré et publié au client
 * - `rejetee` : Demande refusée par le Manager (le client peut la corriger et la resoumettre)
 */
export type RequestStatus = 'brouillon' | 'soumise' | 'En Revue' | 'validee' | 'assignee' | 'En Cours' | 'En Validation' | 'terminee' | 'rejetee';

/** Catégories d'articles d'inventaire et de consommables de laboratoire */
export type ConsumableCategory = 'Résine' | 'Abrasif' | 'Chimie' | 'Équipement';

/**
 * Entité représentant un laboratoire indépendant dans l'architecture Multi-Tenant.
 * Chaque laboratoire possède son propre périmètre de données, ses modèles CMS et ses préfixes d'ID.
 */
export interface Laboratory {
  /** Identifiant unique du laboratoire (ex: 'lab-metallurgie') */
  id: string;
  /** Nom complet officiel du laboratoire */
  name: string;
  /** Nom court pour la barre latérale et les onglets */
  shortName: string;
  /** Code trigramme (ex: 'MET', 'MEC') utilisé sur les étiquettes Zebra et préfixes */
  code: string;
  /** Description des spécialités techniques du laboratoire */
  description: string;
  /** Couleur thématique principale dans l'interface */
  themeColor: 'blue' | 'emerald' | 'purple' | 'amber';
  /** Classes Tailwind pour l'arrière-plan des badges de ce laboratoire */
  badgeBg: string;
  /** Libellé affiché dans le badge du laboratoire */
  badgeText: string;
  /** Paramètres administratifs, graphiques et normatifs propres au laboratoire */
  settings: LabSettings;
}

// ==========================================
// 2. Gestion des Consommables & Stocks
// ==========================================

/**
 * Article de stock ou réactif suivi dans le module Inventaire
 */
export interface Consumable {
  /** Identifiant unique du consommable (ex: 'CONS-MET-001') */
  id: string;
  /** Identifiant du laboratoire propriétaire */
  labId: string;
  /** Désignation commerciale ou technique */
  name: string;
  /** Famille de consommable */
  category: ConsumableCategory;
  /** Quantité actuellement disponible en stock */
  stockLevel: number;
  /** Seuil critique déclenchant une alerte de réapprovisionnement */
  minThreshold: number;
  /** Unité de gestion (ex: 'kg', 'Litres', 'disques', 'pièces') */
  unit: string;
  /** Date ISO du dernier réapprovisionnement */
  lastRestocked: string;
  /** Date d'expiration (YYYY-MM-DD) optionnelle pour les produits périssables/chimiques */
  expiryDate?: string;
  /** Numéro de lot fabricant pour traçabilité ISO 17025 sur les préparations et essais */
  lotNumber?: string;
  /** Fournisseur du consommable */
  supplier?: string;
}

/**
 * Référence d'un lot de consommable utilisé lors d'une préparation ou d'un essai
 */
export interface ConsumableLotUsage {
  consumableId: string;
  name: string;
  lotNumber?: string;
  quantityUsed?: number;
  usedAt?: string;
}

// ==========================================
// 3. Utilisateurs, Notifications & Audit
// ==========================================

/**
 * Profil utilisateur authentifié (sans le condensat `passwordHash` qui reste côté serveur)
 */
export interface User {
  /** Identifiant unique (ex: 'usr-1' ou UUID) */
  id: string;
  /** Nom complet affiché dans l'interface et les pistes d'audit */
  name: string;
  /** Adresse email servant d'identifiant de connexion et de cible SMTP */
  email: string;
  /** Rôle déterminant les droits d'accès RBAC */
  role: Role;
  /** Société ou service d'appartenance (utile pour les demandeurs) */
  company?: string;
  /** Périmètre laboratoire ('all' pour accès transversal, ou ID d'un laboratoire précis) */
  labId?: string;
  /** Liste des identifiants d'`AnalysisTemplate` sur lesquels l'opérateur est habilité (ISO 17025 §6.2) */
  qualifiedTemplateIds?: string[];
  /** Dates d'expiration des habilitations opérateur par `templateId` (`{ [templateId]: 'YYYY-MM-DD' }`) */
  qualificationExpiries?: Record<string, string>;
}

/**
 * Entrée immuable de piste d'audit (conformité traçabilité ISO/IEC 17025)
 */
export interface AuditLog {
  /** Identifiant de l'événement d'audit */
  id: string;
  /** Horodatage ISO 8601 de l'action */
  timestamp: string;
  /** Identifiant de l'utilisateur auteur de la modification */
  userId: string;
  /** Type d'opération (ex: 'Création', 'Changement de statut', 'Modification de résultat') */
  action: string;
  /** Description détaillée des valeurs avant/après ou motif */
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

/**
 * Définition d'un champ dynamique configurable dans le Builder CMS
 * (utilisé dans les modèles de matériaux et les formulaires de demandes clients).
 */
export interface CustomField {
  /** Clé technique du champ (utilisée comme clé dans `customData` et balise dans les rapports Word) */
  id: string;
  /** Libellé affiché à l'utilisateur dans les formulaires */
  name: string;
  /**
   * Type de contrôle de saisie :
   * - `text`, `number`, `date`, `boolean`, `select`, `multiselect`, `image` : champs classiques
   * - `number_series` : série de valeurs numériques avec calcul automatique moyenne/écart-type
   * - `analyses` : sélecteur dynamique lié au catalogue des modèles d'essais actifs du laboratoire
   * - `materials` : sélecteur dynamique de modèles de matériaux avec sous-propriétés embarquées
   */
  type: 'text' | 'number' | 'number_series' | 'select' | 'boolean' | 'multiselect' | 'date' | 'analyses' | 'materials' | 'image';
  /** Liste des valeurs possibles pour les types `select` et `multiselect` */
  options?: string[];
  /** Indique si la saisie est obligatoire pour valider le formulaire */
  required: boolean;
  /** Unité physique optionnelle (ex: 'MPa', 'µm', '°C', '%') */
  unit?: string;
}

/**
 * Modèle de caractérisation d'une famille de matériaux (configurable dans Builder CMS -> Matériaux)
 */
export interface MaterialTemplate {
  /** Identifiant unique du modèle (ex: 'TPL-METAL-FRITTE') */
  id: string;
  /** Laboratoire auquel appartient ce modèle */
  labId: string;
  /** Nom du modèle de matériau */
  name: string;
  /** Catégorie macroscopique */
  category: MaterialCategory;
  /** Description technique */
  description: string;
  /** S'il est actif (`true`), il est proposé à la sélection lors de la création de demandes/échantillons */
  isActive?: boolean;
  /** Liste des propriétés intrinsèques à renseigner pour ce matériau */
  fields: CustomField[];
}

/**
 * Définition d'un résultat attendu au sein d'un modèle d'analyse (`AnalysisTemplate`)
 */
export interface ExpectedResult {
  /** Clé technique du résultat (sert aussi de balise `{id}` dans le modèle Word de rapport) */
  id: string;
  /** Libellé de la grandeur mesurée */
  name: string;
  /**
   * Type de saisie du résultat :
   * - `number` : valeur numérique simple
   * - `number_series` : série de mesures répétées (calcul auto de moyenne, min, max, écart-type)
   * - `vertical_table` : tableau multi-colonnes structuré (colonnes définies dans `options`)
   * - `text` : observation textuelle libre
   * - `image` : image unique en Base64/DataURL
   * - `micrography` : galerie de clichés micrographiques avec légendes, grossissements et échelles
   * - `boolean`, `select`, `multiselect` : valeurs discrètes
   */
  type: 'number' | 'number_series' | 'vertical_table' | 'text' | 'image' | 'micrography' | 'boolean' | 'select' | 'multiselect';
  /** Options de liste (`select`/`multiselect`) ou noms des colonnes (`vertical_table`) */
  options?: string[];
  /** Unité de mesure (ex: 'HV', 'MPa', 'µm') */
  unit?: string;
  /** Caractère obligatoire pour soumettre l'essai à la validation Manager */
  required: boolean;
  /** Borne minimale de spécification / tolérance (calcul automatique Conforme / Non conforme) */
  minSpec?: number;
  /** Borne maximale de spécification / tolérance (calcul automatique Conforme / Non conforme) */
  maxSpec?: number;
  /** Incertitude élargie de mesure (± U) dans la même unité que la grandeur */
  uncertainty?: number;
  /** Règle de décision ISO 17025 §7.8.6 (ex: 'Acceptation simple', 'Bande de garde') */
  decisionRule?: string;
}

/**
 * Modèle de méthode d'essai ou d'analyse (configurable dans Builder CMS -> Analyses)
 */
export interface AnalysisTemplate {
  /** Identifiant unique de la méthode d'essai (ex: 'ANA-TRACTION') */
  id: string;
  /** Laboratoire propriétaire */
  labId: string;
  /** Intitulé de l'essai */
  name: string;
  /** Domaine technique (ex: 'Microstructure', 'Mécanique', 'Physico-Chimie') */
  category: string;
  /** Description du protocole */
  description: string;
  /** Référence normative (ex: 'NF EN ISO 6892-1') */
  standardRef?: string;
  /** Indique si la méthode est actuellement ouverte aux nouvelles demandes */
  isActive?: boolean;
  /** Tarif unitaire indicatif (€ HT) pour valorisation des demandes / devis */
  unitPrice?: number;
  /** Temps standard estimé (en heures) pour le planning de charge */
  estimatedHours?: number;
  /** Catégorie d'équipement requise pour réaliser cet essai (ex: 'Microscopie', 'Dureté', 'Traction') */
  requiredEquipmentCategory?: string;
  /** Indique si cette analyse nécessite des étapes de préparation d'échantillon préalables */
  requiresPreparation?: boolean;
  /** Identifiants ordonnés des étapes de préparation du laboratoire (`LabSchedulingConfig.preparationSteps`) */
  preparationStepIds?: string[];
  /** Document normatif / mode opératoire PDF rattaché à la méthode (GED légère ISO 17025) */
  sopDocumentName?: string;
  /** Contenu DataURL Base64 du document PDF mode opératoire / norme */
  sopDocumentData?: string;
  /** Indice de version / révision du mode opératoire (ex: 'v2.1 — ISO 6892-1:2019') */
  sopVersion?: string;
  /** Liste des grandeurs, tableaux ou clichés attendus lors de l'exécution de l'essai */
  expectedResults: ExpectedResult[];
}

/**
 * Modèle de formulaire de demande client (configurable dans Builder CMS -> Formulaires)
 */
export interface RequestTemplate {
  /** Identifiant unique du formulaire (ex: 'REQ-TPL-METALLO') */
  id: string;
  /** Laboratoire destinataire des demandes issues de ce formulaire */
  labId: string;
  /** Titre du formulaire affiché aux demandeurs */
  name: string;
  /** Description guidant le client dans le choix du formulaire */
  description: string;
  /** Visibilité sur le portail demandeur */
  isActive?: boolean;
  /** Champs dynamiques à remplir par le demandeur */
  fields: CustomField[];
}

// ==========================================
// 5. Demandes d'Analyses & Échantillons
// ==========================================

/**
 * Message horodaté dans le fil de discussion intégré d'une demande d'analyse
 */
export interface RequestComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  message: string;
  createdAt: string;
  /** Si true, visible uniquement par le personnel interne du laboratoire (non visible par le demandeur) */
  isInternal?: boolean;
}

/**
 * Enregistrement formel de la revue de demande / contrat (ISO/IEC 17025 §7.1)
 */
export interface ContractReview {
  reviewedBy: string;
  reviewedAt: string;
  methodsAdequate: boolean;
  resourcesAvailable: boolean;
  staffQualified: boolean;
  notes?: string;
}

/**
 * Demande d'analyse soumise par un demandeur à un laboratoire donné
 */
export interface AnalysisRequest {
  /** Numéro unique de la demande (ex: 'REQ-MET-26-001') */
  id: string;
  /** Identifiant du laboratoire cible */
  labId: string;
  /** Identifiant de l'utilisateur demandeur (`User.id`) */
  requesterId: string;
  /** Identifiant du formulaire `RequestTemplate` utilisé */
  templateId: string;
  /** Objet / Titre synthétique de la demande */
  title: string;
  /** État courant dans le workflow de traitement */
  status: RequestStatus;
  /** Date ISO de création */
  createdAt: string;
  /** Données saisies dans les champs dynamiques du formulaire (clé = `CustomField.id`) */
  customData: Record<string, any>;
  /** Identifiant de l'analyste assigné par le manager (`User.id`) */
  assignedTo?: string;
  /** Historique complet des actions sur cette demande */
  auditTrail?: AuditLog[];
  /** Motif de refus renseigné par le manager si `status === 'rejetee'` */
  rejectionReason?: string;
  /** Niveau de priorité attribué ou réévalué par le manager */
  priority?: 'basse' | 'normale' | 'haute';
  /** Conclusion générale ou synthèse technique rédigée par le laboratoire pour le rapport */
  conclusion?: string;
  /** Date de rendu souhaitée par le client (YYYY-MM-DD) */
  requestedDueDate?: string;
  /** Date de rendu contractuelle engagée par le laboratoire lors de la revue (YYYY-MM-DD) */
  committedDueDate?: string;
  /** Revue de faisabilité et de contrat ISO 17025 §7.1 */
  contractReview?: ContractReview;
  /** Fil de discussion client / laboratoire attaché au dossier */
  comments?: RequestComment[];
  /** Nombre d'échantillons annoncé par le demandeur lors de la soumission */
  sampleCount?: number;
  /** Temps total estimé de réalisation des essais (en heures) calculé dès la demande */
  estimatedHours?: number;
  /** Valorisation financière estimée (€ HT) calculée à partir des tarifs des essais */
  estimatedCost?: number;
  /** Statut du devis commercial optionnel (activable par laboratoire via `LabSettings.enableQuotes`) */
  quoteStatus?: 'aucun' | 'genere' | 'envoye' | 'approuve' | 'refuse';
  /** Numéro du devis généré (ex: 'DEV-MET-26-001') */
  quoteNumber?: string;
  /** Date ISO de génération du devis PDF */
  quoteGeneratedAt?: string;
  /** Référence du bon de commande client associé au devis */
  purchaseOrderRef?: string;
}

/**
 * Paramètres de préparation métallographique d'un échantillon ou sous-échantillon (plot enrobé)
 */
export interface MountingInfo {
  /** Mode d'enrobage utilisé */
  method: 'Enrobage à chaud' | 'Enrobage à froid' | 'Aucun';
  /** Nature de la résine (ex: 'Phénolique noire', 'Époxy transparente') */
  resinType?: string;
  /** Diamètre du plot enrobé en millimètres (ex: 30, 40) */
  diameter?: number;
  /** Gamme de polissage appliquée (ex: ['SiC 320', 'SiC 800', 'Diamant 3µm']) */
  polishingSteps?: string[];
  /** Réactif et durée d'attaque chimique éventuelle (ex: 'Nital 3% - 10s') */
  etching?: string;
}

/**
 * Échantillon physique ou sous-échantillon (éprouvette / plot enrobé) tracé dans le LIMS
 */
export interface Sample {
  /** Identifiant unique de l'échantillon (ex: 'ECH-MET-26-K8F3M' ou sous-échantillon 'ENR-MET-...') */
  id: string;
  /** Laboratoire en charge de l'échantillon */
  labId: string;
  /** Si renseigné, indique que cet élément est un sous-échantillon découpé/préparé à partir d'un échantillon parent */
  parentSampleId?: string;
  /** Référence de la demande client d'origine (`AnalysisRequest.id`) */
  requestId?: string;
  /** Code-barres unique encodé dans le QR Code des étiquettes Zebra */
  barcode: string;
  /** Référence du modèle de matériau (`MaterialTemplate.id`) */
  templateId: string;
  /** État physique à réception */
  materialState: MaterialState;
  /** Statut d'avancement physique */
  status: SampleStatus;
  /** Date ISO de réception au laboratoire */
  receivedAt: string;
  /** Nom de l'entreprise ou du client */
  client: string;
  /** Nom du projet ou de l'affaire */
  project: string;
  /** Priorité de traitement */
  priority: Priority;
  /** Valeurs des propriétés spécifiques au matériau (clé = `CustomField.id`) */
  customData: Record<string, any>;
  /** Informations d'enrobage/polissage (si préparation métallographique) */
  mountingInfo?: MountingInfo;
  /** Liste d'URLs ou DataURLs de photos macroscopiques de l'échantillon */
  images: string[];
  /** Remarques ou consignes de découpe/préparation */
  notes?: string;
  /** Emplacement physique de stockage au laboratoire (ex: 'Armoire B / Tiroir 3') */
  storageLocation?: string;
  /** Date limite de conservation prévue (YYYY-MM-DD) */
  retentionUntil?: string;
  /** Date ISO de restitution au client ou de destruction tracée */
  disposalDate?: string;
  /** Mode de fin de vie physique ('restitution' ou 'destruction') */
  disposalMethod?: 'restitution' | 'destruction';
  /** Opérateur ayant effectué la restitution ou la destruction */
  disposalBy?: string;
  /** Commentaire / bordereau de restitution ou de mise au rebut */
  disposalNotes?: string;
  /** Lots de consommables utilisés lors de la préparation / enrobage */
  consumableLotsUsed?: ConsumableLotUsage[];
}

// ==========================================
// 6. Résultats d'Analyses & Rapports
// ==========================================

/**
 * Couple clé-valeur représentant un résultat unitaire d'analyse
 */
export interface AnalysisResult {
  expectedResultId: string;
  value: any;
}

/**
 * Instance d'essai/analyse exécutée sur un échantillon donné selon un `AnalysisTemplate`
 */
export interface Analysis {
  /** Identifiant unique de l'essai (ex: 'ESS-26-X9B4P') */
  id: string;
  /** Laboratoire réalisant l'essai */
  labId: string;
  /** Identifiant de l'échantillon ou sous-échantillon testé (`Sample.id`) */
  sampleId: string;
  /** Identifiant de la méthode d'essai (`AnalysisTemplate.id`) */
  templateId: string;
  /** Dictionnaire des résultats mesurés (clé = `ExpectedResult.id`) */
  results: Record<string, any>;
  /** Images ou graphiques généraux rattachés à l'essai */
  images: string[];
  /** Statut d'avancement et de validation de l'essai */
  status: AnalysisStatus;
  /** Nom de l'analyste/technicien en charge */
  technician: string;
  /** Date ISO de dernière modification des résultats */
  updatedAt: string;
  /** Commentaires techniques de l'opérateur */
  notes?: string;
  /** Motif de refus en cas d'invalidation par le manager */
  rejectionReason?: string;
  /** Piste d'audit traçant toutes les saisies et changements de statut de l'essai */
  auditTrail?: AuditLog[];
  /** Identifiant de l'équipement de mesure utilisé (`Equipment.id`, ISO 17025 §6.4) */
  equipmentId?: string;
  /** Lots de consommables/réactifs utilisés durant l'essai */
  consumableLotsUsed?: ConsumableLotUsage[];
  /** Verdict de conformité global calculé automatiquement selon les tolérances `minSpec`/`maxSpec` */
  conformityStatus?: 'conforme' | 'non_conforme' | 'indetermine';
  /** Date planifiée d'exécution (YYYY-MM-DD) pour le module Planning */
  plannedDate?: string;
  /** Verrou manuel du manager empêchant l'auto-planificateur de décaler cet essai */
  isScheduleLocked?: boolean;
  /** Identifiant du lot de préparation optimisé (ex: 'LOT-POL-1') auquel cet essai est rattaché */
  scheduledBatchId?: string;
  /** Justification traçable en cas de dérogation manager sur un équipement hors validité métrologique */
  calibrationOverrideReason?: string;
}

/** Période d'indisponibilité d'un opérateur (congé/absence) ou d'un équipement (maintenance) */
export interface LabUnavailability {
  id: string;
  targetType: 'staff' | 'equipment';
  targetId: string;
  targetName: string;
  /** Date de début inclusive (YYYY-MM-DD) */
  startDate: string;
  /** Date de fin inclusive (YYYY-MM-DD) */
  endDate: string;
  reason: string;
  /** Réduction de capacité journalière (en heures) pour une absence opérateur */
  capacityReductionHours?: number;
}

/** Point de mesure d'une carte de contrôle qualité interne (CQ / Westgard) */
export interface ControlChartPoint {
  id: string;
  date: string;
  value: number;
  operator: string;
  notes?: string;
}

/** Carte de contrôle qualité interne (échantillon témoin / cale de référence, moyenne ± 2σ / ± 3σ) */
export interface ControlChart {
  id: string;
  labId: string;
  name: string;
  equipmentId?: string;
  unit: string;
  targetValue: number;
  stdDev: number;
  points: ControlChartPoint[];
}

/** Règle de regroupement d'une étape de préparation en lot simultané */
export type BatchGroupRule = 'none' | 'same_material' | 'same_template' | 'any';

/**
 * Définition d'une étape de préparation configurable propre à chaque laboratoire
 * (ex: Enrobage à chaud cap=1 séquentiel vs Polissage automatique cap=6 pour un même alliage).
 */
export interface PreparationStepTemplate {
  id: string;
  /** Intitulé de l'étape (ex: "Enrobage à chaud", "Polissage automatique", "Dégazage BET") */
  name: string;
  /** Durée d'un cycle en minutes (par échantillon si batchCapacity=1, par lot si batchCapacity>1) */
  durationMinutes: number;
  /** Nombre maximal d'échantillons traitables simultanément (1 = séquentiel, 6 = 6 plots au polissage) */
  batchCapacity: number;
  /** Critère de regroupement autorisé ('none', 'same_material', 'same_template', 'any') */
  batchGroupBy: BatchGroupRule;
}

/**
 * Paramètres dynamiques du moteur de planification intelligente propres à un laboratoire
 */
export interface LabSchedulingConfig {
  /** Capacité de travail journalière du laboratoire en heures (ex: 7h ou 14h) */
  dailyCapacityHours: number;
  /** Jours ouvrés (0=Dim, 1=Lun, ..., 6=Sam ; défaut [1,2,3,4,5]) */
  workingDays: number[];
  /** Autorise une analyse urgente ('haute') à décaler les essais 'planifie' non démarrés */
  allowUrgentPreemption: boolean;
  /** Horizon de regroupement en jours pour optimiser les lots de préparation */
  batchWindowDays: number;
  /** Catalogue dynamique des étapes de préparation propres à ce laboratoire */
  preparationSteps: PreparationStepTemplate[];
  /** Absences opérateurs et maintenances équipements prises en compte par le planning */
  unavailabilities?: LabUnavailability[];
}

/**
 * Paramètres généraux et de personnalisation documentaire d'un laboratoire
 */
export interface LabSettings {
  /** Nom officiel affiché sur les en-têtes de rapports */
  labName: string;
  /** Adresse postale complète */
  labAddress: string;
  /** Email de contact du laboratoire */
  contactEmail: string;
  /** Numéro de téléphone */
  phone: string;
  /** Liste des accréditations et certifications (ex: 'ISO 17025:2017') */
  isoCertifications: string[];
  /** Logo du laboratoire (URL ou DataURL Base64) */
  logoUrl: string;
  /** Personnalisation visuelle des tableaux générés dans les rapports Word/PDF */
  tableStyles?: {
    /** Couleur hexadécimale sans '#' de l'en-tête des tableaux (ex: '1E3A8A') */
    headerBgColor: string;
    /** Couleur hexadécimale sans '#' des bordures (ex: 'CBD5E1') */
    borderColor: string;
    /** Épaisseur des bordures */
    borderSize: number;
  };
  /** Préfixes personnalisés pour la génération automatique des identifiants */
  idPrefixes?: {
    /** Préfixe des demandes (ex: 'REQ-MET') */
    request: string;
    /** Préfixe des échantillons maîtres (ex: 'ECH-MET') */
    sample: string;
    /** Préfixe des sous-échantillons / enrobages (ex: 'ENR-MET') */
    subSample: string;
  };
  /** Configuration dynamique du moteur de planification intelligente et des lots de préparation */
  schedulingConfig?: LabSchedulingConfig;
  /** Active l'option de génération et de suivi des Devis PDF avant validation (désactivée par défaut) */
  enableQuotes?: boolean;
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
  /** Numéro de version / révision (1 par défaut, incrémenté lors d'un amendement ISO 17025 §7.8.8) */
  version?: number;
  /** Identifiant du rapport parent en cas de révision / amendement */
  parentReportId?: string;
  /** Motif obligatoire de réédition ou d'amendement d'un rapport déjà publié */
  amendmentReason?: string;
  /** Empreinte cryptographique SHA-256 du fichier archivé garantissant son intégrité */
  sha256Hash?: string;
  /** Verrou d'immuabilité (true dès publication officielle) */
  isLocked?: boolean;
  /** Horodatage ISO de publication officielle */
  publishedAt?: string;
  /** Nom du responsable signataire au moment de la publication */
  signedBy?: string;
}

// ==========================================
// 7. Parc Équipements, Non-Conformités & Packs d'Essais
// ==========================================

/** État opérationnel et métrologique d'un instrument de laboratoire */
export type EquipmentStatus = 'operationnel' | 'en_maintenance' | 'hors_tolerance' | 'hors_service';

/**
 * Équipement ou instrument de mesure suivi en métrologie (ISO/IEC 17025 §6.4)
 */
export interface Equipment {
  id: string;
  labId: string;
  /** Désignation de l'équipement (ex: 'Duromètre Vickers Struers Duramin-40') */
  name: string;
  /** Code interne de parc (ex: 'EQ-MET-01') */
  code: string;
  serialNumber: string;
  manufacturer: string;
  /** Famille technique (ex: 'Microscopie', 'Dureté', 'Traction', 'Granulométrie') */
  category: string;
  status: EquipmentStatus;
  /** Date du dernier étalonnage / vérification (YYYY-MM-DD) */
  lastCalibrationDate: string;
  /** Date d'échéance du prochain étalonnage (YYYY-MM-DD) */
  nextCalibrationDate: string;
  /** Périodicité d'étalonnage en mois (ex: 12) */
  calibrationIntervalMonths: number;
  /** Salle ou paillasse d'implantation */
  location: string;
  /** Observations ou référence de certificat d'étalonnage */
  notes?: string;
}

/** Gravité d'une fiche de non-conformité */
export type NonConformitySeverity = 'mineure' | 'majeure' | 'critique';
/** Statut de traitement d'une fiche de non-conformité (CAPA) */
export type NonConformityStatus = 'ouverte' | 'en_analyse' | 'action_en_cours' | 'cloturee';

/**
 * Fiche de Non-Conformité (NC) et Action Corrective / Préventive (CAPA - ISO 17025 §7.10)
 */
export interface NonConformity {
  id: string;
  labId: string;
  title: string;
  type: 'echantillon' | 'equipement' | 'analyse' | 'methode' | 'autre';
  severity: NonConformitySeverity;
  status: NonConformityStatus;
  linkedRequestId?: string;
  linkedSampleId?: string;
  linkedAnalysisId?: string;
  linkedEquipmentId?: string;
  description: string;
  rootCause?: string;
  correctiveAction?: string;
  clientNotified?: boolean;
  createdBy: string;
  createdAt: string;
  closedAt?: string;
  closedBy?: string;
}

/**
 * Pack / Gamme préconfigurée d'essais sélectionnable en un clic lors d'une demande
 */
export interface AnalysisPack {
  id: string;
  labId: string;
  name: string;
  description: string;
  analysisTemplateIds: string[];
  /** Remise commerciale / forfaitaire optionnelle (%) */
  discountPercent?: number;
  isActive?: boolean;
}

/**
 * Modèle de document de rapport (configurable dans Builder CMS -> Rapports)
 */
export interface ReportTemplate {
  /** Catégorie de document ('report' = rapport complet, 'certificate' = certificat de conformité) */
  type?: 'report' | 'certificate';
  /** Identifiant unique du modèle (ex: 'RPT-MET-STD') */
  id: string;
  /** Laboratoire propriétaire */
  labId: string;
  /** Intitulé du modèle de rapport */
  name: string;
  /** Description de l'usage du modèle */
  description: string;
  /** Contenu ou structure textuelle optionnelle */
  content?: string;
  /** Nom du fichier modèle Word (.docx) importé */
  fileName?: string;
  /** Fichier binaire Word (.docx) encodé en Base64 contenant les balises `{...}` pour `docxtemplater` */
  fileData?: string;
  /** Indique si le modèle est utilisable lors de l'émission d'un rapport */
  isActive?: boolean;
}
