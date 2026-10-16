/**
 * Jeux de Données Initiaux & Architecture Multi-Instances (Multi-Tenancy)
 * 
 * Ce module définit les données par défaut du système pour deux laboratoires étanches :
 * 1. Laboratoire de Métallographie & Microstructure (Code: MET)
 *    - Spécialités : Enrobage, polissage, microscopie optique, dureté Vickers, attaques chimiques
 *    - Équipe : Dr. Marc Durand (Manager), Sophie Martin (Analyste)
 * 2. Laboratoire d'Essais Mécaniques & Physico-Chimie (Code: MEC)
 *    - Spécialités : Traction, Charpy, granulométrie laser, BET, pycnométrie, dosages C/S
 *    - Équipe : Alexandre Roux (Manager), Claire Leroy (Analyste)
 * 
 * Les demandeurs (ex: Jean Dupont) disposent d'un portail unifié unique à partir
 * duquel ils peuvent soumettre des demandes à l'un ou l'autre laboratoire.
 */

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
  Consumable, 
  ReportTemplate 
} from './types';

/**
 * Définition des deux laboratoires indépendants
 */
export const initialLaboratories: Laboratory[] = [
  {
    id: 'lab-metallurgie',
    name: 'Laboratoire de Métallographie & Microstructure',
    shortName: 'Métallographie',
    code: 'MET',
    description: 'Expertise micrographique, préparation d\'échantillons (tronçonnage, enrobage, polissage miroir, attaques chimiques), microscopie optique et microdureté Vickers.',
    themeColor: 'blue',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeText: 'Métallographie (MET)',
    settings: {
      labName: 'Laboratoire de Métallographie & Microstructure',
      labAddress: '12 Rue des Alliages, Pôle Matériaux, 68100 Mulhouse',
      contactEmail: 'metallo@materiolab.fr',
      phone: '+33 3 89 00 11 22',
      isoCertifications: ['ISO 9001:2015', 'ISO 17025:2017 (Essais Micrographiques)'],
      logoUrl: '',
      tableStyles: {
        headerBgColor: '1E3A8A',
        borderColor: 'CBD5E1',
        borderSize: 2
      },
      idPrefixes: {
        request: 'REQ-MET',
        sample: 'ECH-MET',
        subSample: 'ENR-MET'
      }
    }
  },
  {
    id: 'lab-mecanique',
    name: 'Laboratoire d\'Essais Mécaniques & Physico-Chimie',
    shortName: 'Mécanique & Chimie',
    code: 'MEC',
    description: 'Essais de traction uniaxiale, résilience mouton-pendule Charpy, granulométrie laser par diffraction, surface spécifique BET et spectrométrie de combustion C/S.',
    themeColor: 'emerald',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeText: 'Mécanique & Chimie (MEC)',
    settings: {
      labName: 'Laboratoire d\'Essais Mécaniques & Physico-Chimie',
      labAddress: '45 Boulevard de la Rupture, Campus Technologique, 69007 Lyon',
      contactEmail: 'mecanique@materiolab.fr',
      phone: '+33 4 72 00 33 44',
      isoCertifications: ['ISO 9001:2015', 'ISO 17025:2017 (Essais Mécaniques & Granulométrie)'],
      logoUrl: '',
      tableStyles: {
        headerBgColor: '065F46',
        borderColor: 'A7F3D0',
        borderSize: 2
      },
      idPrefixes: {
        request: 'REQ-MEC',
        sample: 'ECH-MEC',
        subSample: 'EPR-MEC'
      }
    }
  }
];

/**
 * Utilisateurs de démonstration
 */


/**
 * Modèles de formulaires de demandes configurés par laboratoire
 */
export const initialRequestTemplates: RequestTemplate[] = [
  // 1. Laboratoire Métallographie
  {
    id: 'REQ-TPL-METALLO',
    labId: 'lab-metallurgie',
    name: 'Demande d\'Expertise Métallographique & Microstructure',
    description: 'Préparation métallographique, recherche de défauts, mesure de porosité et profil de microdureté.',
    isActive: true,
    fields: [
      { id: 'reference_commande', name: 'Référence Commande / Affaire', type: 'text', required: true },
      { id: 'date_souhaitee', name: 'Date de rendu souhaitée', type: 'date', required: false },
      { id: 'contexte', name: 'Contexte de l\'expertise', type: 'select', options: ['Expertise Défaillance', 'Qualification Procédé', 'Contrôle Réception', 'R&D'], required: true },
      { 
        id: 'analyses_demandees', 
        name: 'Prestations demandées', 
        type: 'multiselect', 
        options: [
          'Tronçonnage et Enrobage à chaud',
          'Polissage miroir 1µm + Silice colloïdale',
          'Attaque chimique micrographique (Nital / Villela / Kroll)',
          'Taux de porosité surfacique',
          'Taille de grains (ISO 643 / ASTM E112)',
          'Filiation de microdureté Vickers (HV0.5 ou HV1)',
          'Microscopie optique haute résolution'
        ], 
        required: true 
      },
      { id: 'retour_echantillons', name: 'Retour des plots enrobés après examen ?', type: 'boolean', required: true }
    ]
  },
  // 2. Laboratoire Mécanique & Chimie
  {
    id: 'REQ-TPL-MECA',
    labId: 'lab-mecanique',
    name: 'Demande d\'Essais Mécaniques & Caractérisation Poudres',
    description: 'Essais de caractérisation de poudres pour fabrication additive ou essais mécaniques destructifs.',
    isActive: true,
    fields: [
      { id: 'reference_commande', name: 'Référence Commande / Lot', type: 'text', required: true },
      { id: 'date_souhaitee', name: 'Date limite de livraison du PV', type: 'date', required: false },
      { id: 'temperature_essai', name: 'Température d\'essai d\'intérêt', type: 'select', options: ['Ambiante (23°C)', 'Haute température (+250°C)', 'Cryogénique (-40°C)'], required: true },
      { 
        id: 'analyses_demandees', 
        name: 'Essais programmés', 
        type: 'multiselect', 
        options: [
          'Traction uniaxiale (Rp0.2, Rm, A%, Z%)',
          'Résilience Charpy à 20°C (KCV / KV)',
          'Résilience Charpy à -40°C (KV)',
          'Granulométrie laser en voie sèche',
          'Granulométrie laser en voie liquide',
          'Surface spécifique BET (adsorption azote)',
          'Densité vraie par pycnomètre Hélium',
          'Dosage élémentaire Carbone / Soufre'
        ], 
        required: true 
      },
      { id: 'retour_echantillons', name: 'Restitution des poudres / chutes ?', type: 'boolean', required: true }
    ]
  }
];

/**
 * Modèles de matériaux propres à chaque laboratoire
 */
export const initialMaterialTemplates: MaterialTemplate[] = [
  // Laboratoire Métallographie
  { 
    id: 'TPL-METAL-FRITTE',
    labId: 'lab-metallurgie',
    name: 'Superalliage & Métal Fritté', 
    category: 'Métal',
    description: 'Superalliages base Nickel (Inconel 718, Hastelloy) et aciers austénitiques.', 
    isActive: true,
    fields: [
      { id: 'nuance', name: 'Nuance matière (ex: Inconel 718, 316L)', type: 'text', required: true },
      { id: 'traitement_thermique', name: 'État métallurgique / Traitement thermique', type: 'text', required: false },
      { id: 'attaque_recommandee', name: 'Réactif d\'attaque préconisé', type: 'select', options: ['Nital 3%', 'Villela', 'Kallings n°2', 'Eau régale', 'Kroll'], required: false }
    ] 
  },
  { 
    id: 'TPL-CERMET',
    labId: 'lab-metallurgie',
    name: 'Carbure & Cermet WC-Co', 
    category: 'Cermet',
    description: 'Matériaux durs frittés pour outils de coupe et pièces d\'usure.', 
    isActive: true,
    fields: [
      { id: 'teneur_cobalt', name: 'Taux de liant Cobalt (%)', type: 'number', unit: '%', required: true },
      { id: 'taille_grains_carbure', name: 'Classe de granulométrie WC', type: 'select', options: ['Submicronique (<0.5µm)', 'Fine (0.5-1µm)', 'Moyenne (1-3µm)', 'Grossière (>3µm)'], required: false }
    ] 
  },
  { 
    id: 'TPL-ACIER-OUTIL',
    labId: 'lab-metallurgie',
    name: 'Acier à Outils Trempé', 
    category: 'Métal',
    description: 'Aciers rapides et aciers pour travail à chaud/à froid (ex: Z160CDV12, 1.2343).', 
    isActive: true,
    fields: [
      { id: 'durete_attendue', name: 'Dureté approximative (HRC)', type: 'number', unit: 'HRC', required: false },
      { id: 'profondeur_traitement', name: 'Zone cémentée ou nitrurée ?', type: 'boolean', required: false }
    ] 
  },

  // Laboratoire Mécanique & Chimie
  { 
    id: 'TPL-CERAM-POUDRE',
    labId: 'lab-mecanique',
    name: 'Poudre Céramique & Métallique', 
    category: 'Poudres',
    description: 'Poudres fines pour frittage SPS, HIP ou fabrication additive (SLM/EBM).', 
    isActive: true,
    fields: [
      { id: 'composition', name: 'Composition nominale (ex: AlSi10Mg, Ti6Al4V, ZrO2)', type: 'text', required: true },
      { id: 'procede_atomisation', name: 'Mode de fabrication', type: 'select', options: ['Atomisation Gaz', 'Atomisation Plasma', 'Atomisation Eau', 'Broyage mécanique'], required: false },
      { id: 'purete', name: 'Pureté garantie (%)', type: 'number', unit: '%', required: false }
    ] 
  },
  { 
    id: 'TPL-ALLIAGE-ALU',
    labId: 'lab-mecanique',
    name: 'Alliage d\'Aluminium Aéronautique', 
    category: 'Métal',
    description: 'Profilés, tôles et pièces forgées séries 2000, 6000 et 7000.', 
    isActive: true,
    fields: [
      { id: 'nuance_alu', name: 'Nuance (ex: 2024-T3, 7075-T651)', type: 'text', required: true },
      { id: 'sens_prelevement', name: 'Sens de prélèvement de l\'éprouvette', type: 'select', options: ['Sens Longitudinal (L)', 'Sens Travers Long (TL)', 'Sens Travers Court (TC)'], required: true }
    ] 
  },
  { 
    id: 'TPL-COMPOSITE',
    labId: 'lab-mecanique',
    name: 'Composite Fibres de Carbone', 
    category: 'Composite',
    description: 'Stratifiés carbone/époxy pour applications aéronautiques et sportives.', 
    isActive: true,
    fields: [
      { id: 'orientation_fibres', name: 'Empilement / Tissage', type: 'text', required: true },
      { id: 'taux_fibres', name: 'Fraction volumique théorique (%)', type: 'number', unit: '%', required: false }
    ] 
  }
];

/**
 * Catalogue des méthodes d'essais configuré par laboratoire
 */
export const initialAnalysisTemplates: AnalysisTemplate[] = [
  // ==========================================
  // Essais Laboratoire Métallographie (MET)
  // ==========================================
  {
    id: 'ANA-METALLO',
    labId: 'lab-metallurgie',
    name: 'Métallographie Optique & Porosité',
    category: 'Microstructure',
    description: 'Examen de la microstructure et détection des porosités résiduelles par analyse d\'image.',
    standardRef: 'ISO 643 / ASTM E3',
    isActive: true,
    expectedResults: [
      { id: 'porosite', name: 'Taux de porosité surfacique', type: 'number', unit: '%', required: true },
      { id: 'phases', name: 'Description des phases observées', type: 'text', required: true },
      { id: 'taille_defaut_max', name: 'Dimension du plus grand pore', type: 'number', unit: 'µm', required: false },
      { id: 'micrographie', name: 'Micrographie représentative', type: 'image', required: true }
    ]
  },
  {
    id: 'ANA-DURETE-HV',
    labId: 'lab-metallurgie',
    name: 'Microdureté Vickers',
    category: 'Microstructure',
    description: 'Mesure de dureté par pénétration d\'une pyramide diamant sous charge de 0.1 à 10 kgf.',
    standardRef: 'NF EN ISO 6507-1',
    isActive: true,
    expectedResults: [
      { id: 'charge', name: 'Charge d\'essai', type: 'select', options: ['HV0.1', 'HV0.3', 'HV0.5', 'HV1', 'HV5'], required: true },
      { id: 'hv_moyen', name: 'Dureté Vickers Moyenne', type: 'number', unit: 'HV', required: true },
      { id: 'ecart_type', name: 'Écart-type mesuré', type: 'number', unit: 'HV', required: false },
      { id: 'empreinte_img', name: 'Cliché de l\'empreinte', type: 'image', required: false }
    ]
  },
  {
    id: 'ANA-TAILLE-GRAINS',
    labId: 'lab-metallurgie',
    name: 'Taille de Grains Micrographique',
    category: 'Microstructure',
    description: 'Détermination de l\'indice de grosseur de grain par méthode des intersections.',
    standardRef: 'ASTM E112 / NF EN ISO 643',
    isActive: true,
    expectedResults: [
      { id: 'indice_g', name: 'Indice de grosseur de grain (G)', type: 'number', required: true },
      { id: 'diametre_moyen', name: 'Diamètre moyen équivalent', type: 'number', unit: 'µm', required: true },
      { id: 'homogeneite', name: 'Distribution granulométrique', type: 'select', options: ['Monodisperse', 'Bimodale', 'Graduelle'], required: false }
    ]
  },
  {
    id: 'ANA-BROUILLARD-SALIN',
    labId: 'lab-metallurgie',
    name: 'Corrosion en Brouillard Salin Neutre',
    category: 'Corrosion',
    description: 'Tenue en chambre de corrosion saline 5% NaCl à 35°C.',
    standardRef: 'NF EN ISO 9227',
    isActive: true,
    expectedResults: [
      { id: 'duree_exposition', name: 'Durée d\'exposition', type: 'number', unit: 'heures', required: true },
      { id: 'aspect_surface', name: 'Verdict d\'oxydation', type: 'select', options: ['Conforme sans piqûre', 'Oxydation blanche superficielle', 'Rouille rouge / Perforation'], required: true },
      { id: 'cliche_corrosion', name: 'Photographie après test', type: 'image', required: false }
    ]
  },

  // ==========================================
  // Essais Laboratoire Mécanique & Chimie (MEC)
  // ==========================================
  {
    id: 'ANA-TRACTION',
    labId: 'lab-mecanique',
    name: 'Essai de Traction Uniaxiale',
    category: 'Mécanique',
    description: 'Caractérisation des propriétés mécaniques élasto-plastiques à température ambiante.',
    standardRef: 'NF EN ISO 6892-1',
    isActive: true,
    expectedResults: [
      { id: 'rp02', name: 'Limite conventionnelle d\'élasticité Rp0.2', type: 'number', unit: 'MPa', required: true },
      { id: 'rm', name: 'Résistance à la traction Rm', type: 'number', unit: 'MPa', required: true },
      { id: 'allongement', name: 'Allongement pour cent après rupture (A%)', type: 'number', unit: '%', required: true },
      { id: 'striction', name: 'Coefficient de striction (Z%)', type: 'number', unit: '%', required: false },
      { id: 'courbe_traction', name: 'Courbe Contrainte-Déformation', type: 'image', required: true }
    ]
  },
  {
    id: 'ANA-CHARPY',
    labId: 'lab-mecanique',
    name: 'Résilience Mouton-Pendule Charpy',
    category: 'Mécanique',
    description: 'Énergie absorbée lors de la rupture par choc d\'une éprouvette entaillée en V.',
    standardRef: 'NF EN ISO 148-1',
    isActive: true,
    expectedResults: [
      { id: 'temperature_choc', name: 'Température d\'essai', type: 'number', unit: '°C', required: true },
      { id: 'energie_kv', name: 'Énergie de rupture absorbée (KV)', type: 'number', unit: 'Joules', required: true },
      { id: 'aspect_cassure', name: 'Pourcentage de rupture ductile', type: 'number', unit: '%', required: false }
    ]
  },
  {
    id: 'ANA-GRANULO',
    labId: 'lab-mecanique',
    name: 'Granulométrie Laser par Diffraction',
    category: 'Poudres',
    description: 'Distribution granulométrique complète des poudres fines en voie sèche ou liquide.',
    standardRef: 'ISO 13320',
    isActive: true,
    expectedResults: [
      { id: 'd10', name: 'D10 (10% en volume)', type: 'number', unit: 'µm', required: true },
      { id: 'd50', name: 'D50 - Médiane volumique', type: 'number', unit: 'µm', required: true },
      { id: 'd90', name: 'D90 (90% en volume)', type: 'number', unit: 'µm', required: true },
      { id: 'span', name: 'Largeur de distribution (Span)', type: 'number', required: false },
      { id: 'courbe_granulo', name: 'Distribution granulométrique cumulée', type: 'image', required: true }
    ]
  },
  {
    id: 'ANA-BET',
    labId: 'lab-mecanique',
    name: 'Surface Spécifique BET',
    category: 'Physico-Chimie',
    description: 'Mesure de surface spécifique par physisorption d\'azote à 77 K (méthode multipoint).',
    standardRef: 'NF EN ISO 9277',
    isActive: true,
    expectedResults: [
      { id: 'surface_bet', name: 'Surface spécifique multipoint', type: 'number', unit: 'm²/g', required: true },
      { id: 'coefficient_c', name: 'Constante C de BET', type: 'number', required: false },
      { id: 'isotherme_img', name: 'Isotherme d\'adsorption', type: 'image', required: false }
    ]
  },
  {
    id: 'ANA-DENSITE-HE',
    labId: 'lab-mecanique',
    name: 'Densité Vraie par Pycnométrie Hélium',
    category: 'Physico-Chimie',
    description: 'Mesure du volume et de la masse volumique absolue de solides poreux ou divisés.',
    standardRef: 'ISO 12154',
    isActive: true,
    expectedResults: [
      { id: 'densite_vraie', name: 'Masse volumique réelle', type: 'number', unit: 'g/cm³', required: true },
      { id: 'temperature_cellule', name: 'Température de mesure', type: 'number', unit: '°C', required: true }
    ]
  },
  {
    id: 'ANA-DOSAGE-CS',
    labId: 'lab-mecanique',
    name: 'Dosage Carbone & Soufre par Combustion',
    category: 'Physico-Chimie',
    description: 'Dosage élémentaire C/S par combustion en four à induction et détection IR.',
    standardRef: 'NF EN ISO 15350',
    isActive: true,
    expectedResults: [
      { id: 'teneur_carbone', name: 'Taux de Carbone (C)', type: 'number', unit: 'ppm', required: true },
      { id: 'teneur_soufre', name: 'Taux de Soufre (S)', type: 'number', unit: 'ppm', required: true }
    ]
  }
];

/**
 * Inventaire des consommables dédié à chaque laboratoire
 */
export const initialConsumables: Consumable[] = [
  // 1. Laboratoire Métallographie (MET)
  { id: 'CONS-MET-001', labId: 'lab-metallurgie', name: 'Résine Phénolique Noire (Enrobage à chaud)', category: 'Résine', stockLevel: 15.0, minThreshold: 5.0, unit: 'kg', lastRestocked: '2026-03-01T08:00:00Z' },
  { id: 'CONS-MET-002', labId: 'lab-metallurgie', name: 'Résine Époxy Transparente (Enrobage à froid)', category: 'Résine', stockLevel: 3.5, minThreshold: 2.0, unit: 'Litres', lastRestocked: '2026-02-15T08:00:00Z' },
  { id: 'CONS-MET-003', labId: 'lab-metallurgie', name: 'Disques Abrasifs SiC Grain 800 (Ø 250mm)', category: 'Abrasif', stockLevel: 45, minThreshold: 100, unit: 'disques', lastRestocked: '2026-01-20T08:00:00Z' },
  { id: 'CONS-MET-004', labId: 'lab-metallurgie', name: 'Disques Abrasifs SiC Grain 1200 (Ø 250mm)', category: 'Abrasif', stockLevel: 120, minThreshold: 80, unit: 'disques', lastRestocked: '2026-03-10T08:00:00Z' },
  { id: 'CONS-MET-005', labId: 'lab-metallurgie', name: 'Suspension Diamantée Polycristalline 3 µm', category: 'Abrasif', stockLevel: 2.5, minThreshold: 1.5, unit: 'Flacons 1L', lastRestocked: '2026-02-28T08:00:00Z' },
  { id: 'CONS-MET-006', labId: 'lab-metallurgie', name: 'Réactif Nital 4% (Attaque aciers)', category: 'Chimie', stockLevel: 1.2, minThreshold: 1.0, unit: 'Litres', lastRestocked: '2026-03-05T08:00:00Z' },
  { id: 'CONS-MET-007', labId: 'lab-metallurgie', name: 'Réactif de Kroll (Attaque Titane)', category: 'Chimie', stockLevel: 0.8, minThreshold: 0.5, unit: 'Litres', lastRestocked: '2026-02-10T08:00:00Z' },

  // 2. Laboratoire Mécanique & Chimie (MEC)
  { id: 'CONS-MEC-001', labId: 'lab-mecanique', name: 'Couteaux de frappe Mouton Charpy 300 Joules', category: 'Équipement', stockLevel: 4, minThreshold: 2, unit: 'pièces', lastRestocked: '2026-01-10T08:00:00Z' },
  { id: 'CONS-MEC-002', labId: 'lab-mecanique', name: 'Mors de serrage hydrauliques Traction 100 kN', category: 'Équipement', stockLevel: 2, minThreshold: 1, unit: 'jeux', lastRestocked: '2025-11-20T08:00:00Z' },
  { id: 'CONS-MEC-003', labId: 'lab-mecanique', name: 'Gaz Hélium 5.0 Haute Pureté (Bouteille B50)', category: 'Chimie', stockLevel: 3, minThreshold: 1, unit: 'bouteilles', lastRestocked: '2026-02-01T08:00:00Z' },
  { id: 'CONS-MEC-004', labId: 'lab-mecanique', name: 'Azote liquide pour cellules de sorption BET', category: 'Chimie', stockLevel: 25.0, minThreshold: 15.0, unit: 'Litres', lastRestocked: '2026-03-12T08:00:00Z' },
  { id: 'CONS-MEC-005', labId: 'lab-mecanique', name: 'Creusets céramiques pour analyseur C/S', category: 'Abrasif', stockLevel: 450, minThreshold: 200, unit: 'creusets', lastRestocked: '2026-02-18T08:00:00Z' },
  { id: 'CONS-MEC-006', labId: 'lab-mecanique', name: 'Accélérateur Tungstène / Étain pour combustion', category: 'Chimie', stockLevel: 5.0, minThreshold: 2.0, unit: 'kg', lastRestocked: '2026-01-15T08:00:00Z' }
];

/**
 * Demandes d'analyses de démonstration
 */
export const initialRequests: AnalysisRequest[] = [
  // Demande adressée au Laboratoire Métallographie
  {
    id: 'REQ-MET-26-001',
    labId: 'lab-metallurgie',
    requesterId: 'usr-1',
    templateId: 'REQ-TPL-METALLO',
    title: 'Expertise Microstructure Aubage Inconel 718',
    status: 'soumise',
    createdAt: '2026-03-14T09:30:00Z',
    customData: {
      'reference_commande': 'PO-SAFRAN-8849',
      'date_souhaitee': '2026-03-25',
      'contexte': 'Expertise Défaillance',
      'analyses_demandees': [
        'Tronçonnage et Enrobage à chaud',
        'Polissage miroir 1µm + Silice colloïdale',
        'Attaque chimique micrographique (Nital / Villela / Kroll)',
        'Filiation de microdureté Vickers (HV0.5 ou HV1)'
      ],
      'retour_echantillons': true
    },
    auditTrail: [
      {
        id: 'AUD-MET-001',
        timestamp: '2026-03-14T09:30:00Z',
        userId: 'usr-1',
        action: 'Création',
        details: 'Demande déposée sur le portail client pour le Laboratoire Métallographie.'
      }
    ]
  },
  // Demande adressée au Laboratoire Mécanique
  {
    id: 'REQ-MEC-26-001',
    labId: 'lab-mecanique',
    requesterId: 'usr-1',
    templateId: 'REQ-TPL-MECA',
    title: 'Essais de Traction & Granulométrie Poudre AlSi10Mg',
    status: 'en_cours',
    createdAt: '2026-03-12T14:15:00Z',
    assignedTo: 'usr-4',
    customData: {
      'reference_commande': 'CMD-AIRBUS-1029',
      'date_souhaitee': '2026-03-22',
      'temperature_essai': 'Ambiante (23°C)',
      'analyses_demandees': [
        'Traction uniaxiale (Rp0.2, Rm, A%, Z%)',
        'Granulométrie laser en voie sèche',
        'Surface spécifique BET (adsorption azote)'
      ],
      'retour_echantillons': false
    },
    auditTrail: [
      {
        id: 'AUD-MEC-001',
        timestamp: '2026-03-12T14:15:00Z',
        userId: 'usr-1',
        action: 'Création',
        details: 'Demande déposée pour le Laboratoire d\'Essais Mécaniques.'
      },
      {
        id: 'AUD-MEC-002',
        timestamp: '2026-03-13T08:00:00Z',
        userId: 'usr-5',
        action: 'Validation',
        details: 'Demande validée techniquement et assignée à Claire Leroy.'
      }
    ]
  }
];

/**
 * Échantillons physiques enregistrés
 */
export const initialSamples: Sample[] = [
  // Échantillon Laboratoire Métallographie
  { 
    id: 'ECH-MET-001', 
    labId: 'lab-metallurgie',
    requestId: 'REQ-MET-26-001', 
    barcode: 'MET-26-001092', 
    templateId: 'TPL-METAL-FRITTE', 
    materialState: 'Fritté',
    status: 'en_essai', 
    receivedAt: '2026-03-15T08:30:00Z', 
    client: 'AeroTech Industries', 
    project: 'Aubage Turbine HP', 
    priority: 'haute', 
    customData: { nuance: 'Inconel 718', traitement_thermique: 'Traitement de mise en solution + double revenu 718°C', attaque_recommandee: 'Kallings n°2' },
    mountingInfo: { 
      method: 'Enrobage à chaud', 
      resinType: 'Phénolique noire', 
      diameter: 30, 
      polishingSteps: ['SiC 320', 'SiC 800', 'SiC 1200', 'Diamant 3µm', 'Silice colloïdale 0.05µm'], 
      etching: 'Kallings n°2 (15s immersion)' 
    },
    images: ['https://images.unsplash.com/photo-1574169208507-84376144848b?auto=format&fit=crop&q=80&w=400'],
    notes: 'Section longitudinale de l\'aube à polir dans le plan de traction.'
  },
  // Échantillon Laboratoire Mécanique
  { 
    id: 'ECH-MEC-001', 
    labId: 'lab-mecanique',
    requestId: 'REQ-MEC-26-001', 
    barcode: 'MEC-26-008431', 
    templateId: 'TPL-CERAM-POUDRE', 
    materialState: 'Poudre',
    status: 'en_essai', 
    receivedAt: '2026-03-13T10:00:00Z', 
    client: 'AeroTech Industries', 
    project: 'Poudre AlSi10Mg SLM', 
    priority: 'normale', 
    customData: { composition: 'AlSi10Mg', procede_atomisation: 'Atomisation Gaz', purete: 99.8 },
    images: [],
    notes: 'Flacon étanche de 500g sous argon.'
  }
];

/**
 * Fiches d'analyses exécutées
 */
export const initialAnalyses: Analysis[] = [
  // Analyse Métallographie
  { 
    id: 'ESS-MET-101', 
    labId: 'lab-metallurgie',
    sampleId: 'ECH-MET-001', 
    templateId: 'ANA-METALLO', 
    status: 'en_cours', 
    technician: 'Sophie Martin', 
    updatedAt: '2026-03-15T11:00:00Z',
    results: { 'porosite': 0.35, 'phases': 'Matrice gamma, précipités gamma prime et carbures TiC intragranulaires.' },
    images: ['https://images.unsplash.com/photo-1614935151651-0bea6508abb0?auto=format&fit=crop&q=80&w=400'],
    notes: 'Microstructure homogène, absence de criques de solidification.'
  },
  { 
    id: 'ESS-MET-102', 
    labId: 'lab-metallurgie',
    sampleId: 'ECH-MET-001', 
    templateId: 'ANA-DURETE-HV', 
    status: 'planifie', 
    technician: 'Sophie Martin', 
    updatedAt: '2026-03-15T14:00:00Z',
    results: {},
    images: []
  },

  // Analyse Mécanique
  { 
    id: 'ESS-MEC-101', 
    labId: 'lab-mecanique',
    sampleId: 'ECH-MEC-001', 
    templateId: 'ANA-GRANULO', 
    status: 'valide', 
    technician: 'Claire Leroy', 
    updatedAt: '2026-03-14T15:30:00Z',
    results: { 'd10': 18.4, 'd50': 34.2, 'd90': 58.7, 'span': 1.18 },
    images: ['https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=400'],
    notes: 'Distribution sphérique typique d\'une poudre atomisée gaz.'
  }
];

/**
 * Rapports d'essais finaux émis
 */
export const initialReports: Report[] = [
  { 
    id: 'RAP-MET-001', 
    labId: 'lab-metallurgie',
    title: 'Expertise Métallographique Aube Inconel 718 (ECH-MET-001)', 
    sampleIds: ['ECH-MET-001'], 
    createdAt: '2026-03-15T16:00:00Z', 
    status: 'brouillon', 
    format: 'PDF',
    templateId: 'RPT-MET-STD'
  },
  { 
    id: 'RAP-MEC-001', 
    labId: 'lab-mecanique',
    title: 'Procès-Verbal Granulométrique Poudre AlSi10Mg', 
    sampleIds: ['ECH-MEC-001'], 
    createdAt: '2026-03-14T17:00:00Z', 
    status: 'genere', 
    format: 'PDF',
    templateId: 'RPT-MEC-STD'
  }
];

/**
 * Modèles de mise en page des rapports par laboratoire
 */
export const initialReportTemplates: ReportTemplate[] = [
  {
    id: 'RPT-MET-STD',
    labId: 'lab-metallurgie',
    name: 'Rapport d\'Expertise Micrographique ISO 17025',
    description: 'En-tête officiel Métallographie avec inclusion des clichés de microstructure et cartographies de dureté.',
    type: 'report',
    isActive: true
  },
  {
    id: 'RPT-MEC-STD',
    labId: 'lab-mecanique',
    name: 'Procès-Verbal d\'Essais Mécaniques & Granulométrie',
    description: 'En-tête officiel Mécanique avec courbes de traction et diagrammes granulométriques.',
    type: 'report',
    isActive: true
  }
];
