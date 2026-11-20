# LIMS Multi-Tenant — Plateforme de Gestion de Laboratoire (ISO/IEC 17025)

Application web complète de gestion de laboratoire (**LIMS**, *Laboratory Information Management System*) multi-laboratoires orientée essais matériaux (Métallographie, Microstructure, Essais Mécaniques, Physico-Chimie, Poudres), construite avec **React 19, TypeScript, Vite 6, Tailwind CSS 4, Express 5 et SQLite (`node:sqlite`)**.

---

## Sommaire

- [Fonctionnalités principales](#fonctionnalités-principales)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Démarrage et commandes](#démarrage-et-commandes)
- [Configuration](#configuration)
- [Comptes, rôles et cloisonnement (RBAC)](#comptes-rôles-et-cloisonnement-rbac)
- [Builder CMS, GED & Modèles de Rapports](#builder-cms-ged--modèles-de-rapports)
- [Stockage et sauvegardes automatiques](#stockage-et-sauvegardes-automatiques)
- [Sécurité et conformité ISO 17025](#sécurité-et-conformité-iso-17025)
- [Guides par profil utilisateur](#guides-par-profil-utilisateur)
- [Structure du projet](#structure-du-projet)

---

## Fonctionnalités principales

### Pilotage & Tableaux de Bord
- **KPI structurés en 4 catégories** :
  1. *Pilotage Demandes, Délais & Valorisation* (retards sur `committedDueDate`, demandes à revoir, taux de clôture, valorisation `€ HT` & respect OTD).
  2. *Production & Charge Laboratoire* (charge active **essais + préparation optimisée par lots**, échantillons suivis, analyses à valider).
  3. *Qualité & Conformité ISO 17025* (taux de validation, essais repris/rejetés, fiches Non-Conformités / CAPA ouvertes).
  4. *Ressources, Métrologie & Stocks* (étalonnages expirés ou ≤ 30 jours, alertes de stock et péremptions).
- **Exports de pilotage** : Bilan PDF paginé et classeur Excel multi-feuilles (`.xlsx` OpenXML natif avec graphiques intégrés).

### Demandes, Devis & Portail Demandeur
- **Portail Client dédié (`demandeur`)** : dépôt de demandes multi-laboratoires avec **Packs d'essais en 1 clic**, saisie du nombre d'échantillons, **estimation instantanée de la durée (essais + préparation)** et du coût, **barre de progression visuelle en 5 étapes** (*Soumise → Revue → Essais → Validation → Rapport*), fil de discussion intégré et téléchargement sécurisé par lien à usage unique.
- **Revue de contrat ISO 17025 §7.1** : validation de faisabilité (méthodes, ressources, personnel habilité) et engagement de date de rendu (`committedDueDate`).
- **Option Devis PDF Commercial** *(activable par laboratoire dans Paramètres → Laboratoire)* : génération de devis PDF A4 (HT, TVA 20 %, TTC), suivi du statut (`genere`, `envoye`, `approuve`, `refuse`) et saisie du N° de bon de commande client.

### Échantillons, Essais & Traçabilité
- **Chaîne de garde & fin de vie** : réception, découpe en sous-échantillons/enrobages, impression d'étiquettes thermiques **Zebra ZPL II / QR Code (70×37 mm)**, scan rapide douchette (**QuickScan QR**), localisation physique, conservation, restitution ou destruction tracée.
- **Saisie d'analyses avancée** :
  - Types de résultats riches : valeurs numériques avec bornes `minSpec`/`maxSpec` et incertitude `± U` (verdict Conforme/Non conforme automatique), **séries numériques avec calcul Moyenne/Écart-type et import CSV/TXT machine**, **tableaux verticaux (ex. ICP/OES) avec import CSV et collage Excel**, galeries de micrographies.
  - **Assignation par essai** avec **contrôle bloquant des habilitations opérateurs** (y compris dates d'expiration).
  - **Verrouillage métrologique strict** : blocage des instruments expirés ou hors service (dérogation manager traçable obligatoire).
  - **GED légère** : accès en 1 clic au PDF du mode opératoire / norme rattaché à la méthode.

### Planning, Charge & Planification Intelligente
- **Calendrier interactif (Mois / Semaine / Jour)** : glisser-déposer des essais, affichage des échéances, étalonnages, lots et jauges de charge **Essais + Préparation**.
- **Planification Intelligente (Auto)** :
  - Préemption sélective des urgences (`haute`) sans déplacer les essais déjà démarrés ou épinglés (`isScheduleLocked`).
  - **Regroupement dynamique en lots de préparation** configurable par laboratoire (ex. *Enrobage à chaud* 1 à la fois vs *Polissage automatique* jusqu'à 6 plots d'un même alliage).
  - **Gestion des absences opérateurs et maintenances machines** prise en compte automatiquement dans la capacité journalière.
- **Accès Analyste (« Mon Planning »)** : vue calendrier uniquement (Mois/Semaine/Jour), **strictement en lecture seule** et filtrée sur ses propres essais.
- **Vues Kanban & Charge** *(managers/admins)* : répartition par statut et charge par analyste/équipement.

### Qualité, Métrologie & Rapports ISO 17025
- **Parc Équipements & Cartes de Contrôle (CQ Interne)** *(managers/admins)* : suivi des étalonnages (alertes ≤ 30j / expiré) et **cartes de contrôle qualité Recharts** (valeur cible, limites ±2σ et ±3σ avec alertes de dérive).
- **Non-Conformités & CAPA (§7.10)** : fiches NC, analyse cause racine, actions correctives et clôture tracée.
- **Rapports Officiels (Word `.docx` & HTML A4 PDF)** :
  - Fusion Docxtemplater + conversion PDF LibreOffice, ou gabarit HTML A4 natif.
  - **Traçabilité métrologique intégrée** : tableau récapitulatif des équipements utilisés (code, désignation, fabricant/modèle, n° série, validité étalonnage) dans le rapport de base et via balises dynamiques (`{{@table_equipements}}`, `{{#equipements}}`, `{{equipement}}`).
  - **Immutabilité & Révisions (§7.8.8)** : empreinte cryptographique **SHA-256**, verrouillage après publication, création de révisions (`Rev2`, `Rev3`...) via modale dédiée avec motif d'amendement obligatoire et notification e-mail client.

---

## Technologies

- **Frontend** : React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, `lucide-react`, `recharts`.
- **Backend** : Node.js >= 22, Express 5, `node:sqlite` (`DatabaseSync`), JWT (`HttpOnly`), `bcryptjs`, `nodemailer`.
- **Moteurs documentaires** : `docxtemplater`, `pizzip`, `libreoffice-convert`, `jspdf`, `dom-to-image-more`, `react-pdf`, `qrcode`.

---

## Prérequis

- **Node.js 22 ou supérieur** (requis pour `node:sqlite`).
- **LibreOffice** (optionnel, requis uniquement pour la conversion serveur `.docx` → `.pdf` ; en son absence, le `.docx` fusionné reste téléchargeable).

---

## Installation

```bash
npm install
```

Créez un fichier `.env` à la racine du projet :

```dotenv
NODE_ENV=development
PORT=3000
JWT_SECRET=remplacer-par-une-cle-aleatoire-longue-et-secrete
BACKUP_RETENTION_DAYS=30
```

Générez un secret JWT sécurisé :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

> Un script Linux d'installation assistée (`install.sh`) est également fourni à la racine.

---

## Démarrage et commandes

```bash
npm run dev     # Serveur Express + Vite HMR (http://localhost:3000)
npm run lint    # Vérification TypeScript complète (tsc --noEmit)
npm run build   # Compilation frontend (dist/) et backend (dist/server.cjs)
npm run start   # Démarrage en mode production
```

---

## Configuration

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port HTTP d'écoute du serveur Express | `3000` |
| `JWT_SECRET` | Clé de signature des cookies de session JWT (obligatoire en prod) | Clé dev |
| `NODE_ENV` | `development` ou `production` | `development` |
| `BACKUP_RETENTION_DAYS` | Durée de rétention (en jours) des sauvegardes SQLite automatiques | `30` |
| `DISABLE_HMR` | Désactive le Hot Module Replacement Vite si `true` | `false` |

Les paramètres SMTP, les règles de planification/préparation, l'option **Devis PDF** et les préfixes d'identifiants se configurent directement dans **Paramètres**.

---

## Comptes, rôles et cloisonnement (RBAC)

| Rôle | Accès & Périmètre |
|---|---|
| **`demandeur`** | Portail client uniquement : soumission, suivi visuel 5 étapes, commentaires, téléchargement sécurisé des rapports. |
| **`analyste`** | Console opérationnelle de son laboratoire : Dashboard opérateur, Demandes assignées, Échantillons, Analyses, **Mon Planning (calendrier en lecture seule de ses essais)**, Rapports, NC/CAPA, Consommables. *Pas d'accès à Équipements/Métrologie, Kanban, Charge, ni Builder CMS.* |
| **`manager`** | Toutes les vues de son laboratoire + **Planning & Charge complet (Planification Auto, Absences)**, **Équipements & Cartes CQ**, **Builder CMS**, **Habilitations opérateurs (strictement limité au personnel et méthodes de son laboratoire)**, **Devis PDF (si activé)**. |
| **`admin`** | Accès transversal multi-laboratoires (`all`), gestion des laboratoires, comptes utilisateurs, SMTP, journaux système et téléchargement des sauvegardes SQLite. |

---

## Builder CMS, GED & Modèles de Rapports

Réservé aux `manager` et `admin` :
- **Matériaux** : champs personnalisés dynamiques réutilisés dans les formulaires clients (`type: 'materials'`).
- **Analyses** : résultats attendus (`number`, `number_series`, `vertical_table`, `micrography`, etc.), spécifications `minSpec`/`maxSpec`, incertitude, tarif HT, durée, étapes de préparation et **upload du Mode Opératoire PDF (GED légère)**.
- **Formulaires** : configuration des formulaires de demande client.
- **Rapports** : import de modèles Word `.docx` avec aide-mémoire intégré des balises (`{{demande.*}}`, `{{#analyses}}`, `{{#echantillons}}`, `{{#equipements}}`, `{{@table_equipements}}`, `{{#tables_series}}`, `{{#tables_verticales}}`, `{{#micrographies}}`).

---

## Stockage et sauvegardes automatiques

- **Base SQLite** : `database.sqlite` à la racine (tables `users`, `reset_tokens`, `account_requests`, `collections`).
- **Rapports archivés** : `storage/reports/` (fichiers PDF/DOCX finaux verrouillés avec hash SHA-256).
- **Sauvegardes automatiques planifiées** : une copie quotidienne automatique des bases SQLite **et un fichier JSON de configuration complet par laboratoire** (`config-lab-<code_ou_id>.json`) sont créés dans `storage/backups/backup-YYYY-MM-DD_HH-mm-ss-auto/` avec purge automatique au-delà de `BACKUP_RETENTION_DAYS` (30 jours par défaut). Déclenchement manuel, export/restauration JSON par laboratoire et téléchargement sont disponibles dans **Paramètres → Système**.

---

## Guides par profil utilisateur

- **[Guide Manager / Responsable Laboratoire](docs/GUIDE_MANAGER.md)** : KPI, revue de contrat, devis PDF optionnel, planning intelligent & absences, métrologie & cartes CQ, habilitations, Builder CMS, rapports et sauvegardes.
- **[Guide Analyste / Technicien](docs/GUIDE_ANALYSTE.md)** : Mon Planning (lecture seule), échantillons & étiquetage Zebra/QR, saisie d'analyses, modes opératoires PDF, import CSV, NC et stocks.
- **[Guide Demandeur / Client](docs/GUIDE_DEMANDEUR.md)** : dépôt de demandes avec packs d'essais, suivi visuel 5 étapes, fil de discussion, resoumission et téléchargement sécurisé des rapports.
- **[Guide Développeur & Audit](docs/GUIDE_DEVELOPPEUR_ET_AUDIT.md)** : architecture technique, RBAC, persistance SQLite et détail fichier par fichier.

---

## Sécurité et conformité ISO 17025

- Authentification par cookie JWT `HttpOnly` + rate limiting anti-bruteforce.
- Contrôle multi-tenant strict côté serveur sur toutes les routes `/api/db/*` et `/api/users/:id/qualifications`.
- Contrôle bloquant des habilitations opérateurs (y compris dates d'expiration) et verrouillage métrologique des équipements expirés.
- Piste d'audit horodatée (`auditTrail`) sur les demandes, essais et rapports, et liens de téléchargement client à usage unique.

---

## Structure du projet

```text
.
├── server.ts                          # Serveur Express 5, API REST, LibreOffice, Backups SQLite
├── install.sh                         # Script d'installation assistée Linux
├── docs/GUIDE_DEVELOPPEUR_ET_AUDIT.md # Architecture détaillée & guide développeur
└── src/
    ├── App.tsx                        # Routeur principal par rôle
    ├── store.tsx                      # État global multi-tenant synchronisé SQLite
    ├── types.ts                       # Modèle de données TypeScript complet
    ├── data.ts                        # Données et configurations initiales
    ├── db/                            # Couche SQLite (auth.ts, lims.ts)
    ├── utils/                         # smartScheduler.ts, zebraLabelPrinter.ts, idGenerator.ts...
    ├── components/                    # Layout, ReportPreviewModal, QuickScanModal, NewRequestModal...
    └── views/                         # Dashboard, RequestsInternal, Samples, Analyses, Planning,
                                       # Equipments, NonConformities, Reports, Inventory,
                                       # BuilderCMS, Settings, RequesterPortal, Login
```
