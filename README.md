# LIMS — Gestion de laboratoire

Application web de gestion de laboratoire (LIMS, *Laboratory Information Management System*) construite avec React, TypeScript, Vite et Express. Elle regroupe le suivi des demandes clients, des échantillons, des analyses, des rapports et des consommables, ainsi que la configuration des formulaires et des modèles métier.

> **État du document :** cette documentation décrit la structure et les commandes visibles dans le dépôt. Les étapes de déploiement et les fonctions doivent être validées dans l’environnement cible avant une mise en production.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Démarrage et commandes](#démarrage-et-commandes)
- [Configuration](#configuration)
- [Comptes, rôles et accès](#comptes-rôles-et-accès)
- [Utilisation](#utilisation)
- [Builder CMS et formulaires clients](#builder-cms-et-formulaires-clients)
- [Stockage et sauvegardes](#stockage-et-sauvegardes)
- [Sécurité](#sécurité)
- [Dépannage](#dépannage)
- [Structure du projet](#structure-du-projet)

## Fonctionnalités

- **Tableau de bord** : vue d’ensemble de l’activité, génération d’un bilan PDF opérationnel et export d’un classeur Excel multi-feuilles (Dashboard, Demandes, Échantillons, Analyses, Stocks, Modèles matériaux et Modèles analyses). Les exports reprennent les données accessibles au compte connecté au moment de la génération.
- **Demandes** : création, consultation et suivi des demandes clients.
- **Portail demandeur** : espace client dédié pour déposer et suivre les demandes et, selon leur état, les modifier ou les soumettre à nouveau.
- **Échantillons** : gestion et suivi des échantillons associés aux demandes.
- **Essais et analyses** : gestion des analyses et saisie des résultats attendus.
- **Rapports** : gestion des modèles et des rapports, avec prise en charge de documents Word et de fichiers PDF dans les flux concernés.
- **Inventaire** : gestion des éléments d’inventaire/consommables.
- **Builder CMS** : création et configuration des modèles de matériaux, des modèles d’analyses, des formulaires de demande et des modèles de rapports.
- **Utilisateurs et laboratoires** : gestion des comptes, rôles et périmètres de laboratoire.
- **Notifications par e-mail** : configuration SMTP depuis l’application.
- **Journaux système** : consultation des journaux d’administration disponibles dans l’application.

Les fonctions disponibles dans l’interface peuvent varier selon le rôle de l’utilisateur.

## Technologies

- React 19 et TypeScript
- Vite et Tailwind CSS
- Express 5 (serveur HTTP et API)
- SQLite via `node:sqlite` pour les données persistantes
- JWT et `bcryptjs` pour l’authentification et le hachage des mots de passe
- Bibliothèques de génération/lecture de documents et de visualisation, notamment `docxtemplater`, `docx-preview`, `jspdf` et `react-pdf`

## Prérequis

- **Node.js 22 ou supérieur** recommandé (le projet utilise `node:sqlite`).
- npm, fourni avec Node.js. Bun est présent dans le dépôt, mais les commandes ci-dessous utilisent npm.
- Pour convertir certains documents Word en PDF côté serveur, une installation fonctionnelle de **LibreOffice** peut être nécessaire selon le système et le flux utilisé.

## Installation

Placez-vous dans le répertoire du projet, celui qui contient `package.json`.

```bash
npm install
```

Créez un fichier `.env` à la racine du projet. Exemple minimal :

```dotenv
NODE_ENV=development
JWT_SECRET=remplacer-par-une-cle-aleatoire-longue-et-secrete
```

Générez une clé aléatoire, par exemple avec Node.js :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copiez le résultat dans `JWT_SECRET`. Ne publiez pas ce fichier et ne partagez pas sa valeur.

### Installation assistée

Le dépôt contient un script `install.sh` destiné aux environnements Linux compatibles. Il peut installer Node.js et les dépendances, créer un fichier `.env` si nécessaire et configurer un compte administrateur.

```bash
chmod +x install.sh
./install.sh
```

**Attention :** examinez le script avant de l’exécuter, notamment sur un serveur existant. Il peut utiliser `sudo`, installer des paquets système et créer ou réinitialiser le compte administrateur. Choisissez un mot de passe fort et unique. Si l’installation manuelle est préférable, utilisez les étapes précédentes.

## Démarrage et commandes

### Développement

```bash
npm run dev
```

Le serveur Express démarre sur le **port 3000**. Ouvrez ensuite [http://localhost:3000](http://localhost:3000). Le serveur intègre les middlewares Vite en mode développement.

### Vérification TypeScript

```bash
npm run lint
```

Cette commande exécute `tsc --noEmit` : elle vérifie les types, mais ne remplace pas un test fonctionnel complet.

### Compilation et production

```bash
npm run build
npm run start
```

La compilation produit les fichiers frontend dans `dist/` et le serveur compilé dans `dist/server.cjs`. `npm run start` lance le serveur de production. Définissez `NODE_ENV=production` et fournissez obligatoirement un `JWT_SECRET` robuste avant le démarrage.

Autres commandes :

```bash
npm run preview # prévisualisation Vite du frontend compilé
npm run clean   # supprime les artefacts ciblés par le script
```

Le serveur définit actuellement son port dans `server.ts` à `3000` ; la variable `PORT` écrite par le script d’installation n’est donc pas utilisée par cette version. Pour changer le port, adaptez le code serveur et vérifiez la configuration de déploiement.

## Configuration

### Variables d’environnement

| Variable | Utilisation | Recommandation |
|---|---|---|
| `JWT_SECRET` | Signature et vérification des jetons d’authentification | Obligatoire en production ; clé aléatoire, longue et privée |
| `NODE_ENV` | Sélection du comportement développement/production | Définir `production` en production |
| `DISABLE_HMR` | Référencée par la configuration serveur pour le comportement HMR | À utiliser uniquement si nécessaire dans l’environnement de développement |

Le port est actuellement fixé à `3000` dans `server.ts`. La configuration SMTP se fait depuis l’interface d’administration, si les droits nécessaires sont disponibles : renseignez l’hôte, le port, le mode sécurisé, l’utilisateur, le mot de passe et l’adresse d’expédition. Effectuez un envoi de test après configuration.

## Comptes, rôles et accès

Les rôles utilisés dans l’application comprennent :

- **`demandeur`** : accès au portail client, pour créer et suivre ses demandes.
- **`analyste`** : accès aux vues opérationnelles internes autorisées, notamment les échantillons et les analyses.
- **`manager`** : accès aux vues de gestion, aux paramètres correspondants et au Builder CMS.
- **`admin`** : rôle d’administration système, notamment pour la gestion des utilisateurs.

Les vues et les données disponibles sont filtrées selon le rôle et, pour les utilisateurs internes, le laboratoire associé lorsque cette règle est applicable. Vérifiez les droits avec plusieurs comptes avant la mise en production.

La base d’authentification crée les tables nécessaires au premier démarrage. Si aucun utilisateur n’est présent, le code initialise le schéma ; la création du compte super-administrateur peut être effectuée avec le script d’installation. Ne supposez pas qu’un mot de passe de démonstration est sûr : définissez un identifiant et un mot de passe propres à votre installation.

## Utilisation

### Demandes et portail client

1. Connectez-vous avec un compte autorisé.
2. Le demandeur utilise son portail pour créer et suivre une demande.
3. Le personnel interne consulte les demandes dans la vue **Demandes**.
4. Les échantillons, analyses et rapports sont ensuite gérés dans leurs vues respectives, selon les droits attribués.

### Échantillons, analyses et rapports

- Associez les échantillons à la demande correspondante et renseignez les informations de suivi.
- Utilisez les modèles d’analyses pour définir les champs et les résultats attendus.
- Configurez les modèles de rapports et les fichiers de modèle requis par votre processus. Vérifiez les documents générés et leur mise en page avant de les utiliser officiellement.

## Bilan PDF depuis le tableau de bord

Depuis le tableau de bord de pilotage, le bouton **Générer Bilan PDF** télécharge un bilan d’activité construit à partir des données disponibles dans l’application au moment de la génération. Le document comprend :

- les informations d’identification du laboratoire et la date de génération ;
- une synthèse des demandes, échantillons, analyses, validations en attente et alertes de consommables ;
- la répartition des demandes, échantillons et analyses par statut ;
- des listes récentes de demandes, échantillons et analyses pour faciliter le suivi ;
- un aperçu des modèles de matériaux et des propriétés configurées ;
- les stocks sous seuil et une section de points d’attention ;
- une pagination et un pied de page daté.

Le périmètre suit le laboratoire associé au compte connecté lorsque ce périmètre est renseigné. Le bilan est un outil de pilotage : il ne remplace pas un rapport d’essai officiel approuvé, une revue qualité, ni une démonstration de conformité ISO/IEC 17025. Les indicateurs de délai ne sont pas calculés si les dates d’échéance et les horodatages nécessaires ne sont pas disponibles. Vérifiez les chiffres et les autorisations d’accès dans l’environnement cible avant d’utiliser le document pour une décision qualité ou réglementaire.


### Bilan et export Excel du tableau de bord

Depuis le tableau de bord de direction, deux exports sont proposés :

- **Générer Bilan PDF** : rapport d’activité paginé avec synthèse, statuts, échantillons, analyses, modèles, stocks et points d’attention.
- **Exporter Dashboard Excel** : classeur compatible Microsoft Excel, avec une feuille de synthèse et des feuilles de détail pour les demandes, échantillons, analyses, stocks et modèles.

Les fichiers sont générés côté navigateur à partir des données déjà chargées dans l’application. Le périmètre est limité au laboratoire du compte connecté lorsque celui-ci est défini ; un compte dont le laboratoire est `all` voit les données accessibles globalement. Le classeur est un export ponctuel : il ne se synchronise pas ensuite avec le LIMS. Pour actualiser les chiffres, générez un nouvel export.

**Limites et usage qualité :** les indicateurs sont calculés à partir des statuts et dates réellement disponibles. Les délais moyens, le respect des délais contractuels, les non-conformités formelles et la piste d’audit complète ne sont pas déduits lorsqu’ils ne sont pas enregistrés de façon structurée. Le bilan ne remplace pas une revue qualité et n’atteste pas, à lui seul, la conformité ISO/IEC 17025. Vérifiez les chiffres et les règles métier du laboratoire avant de diffuser le rapport.

## Builder CMS et formulaires clients

Le **Builder CMS** est réservé aux utilisateurs disposant du rôle `manager`. Il comporte quatre zones principales : **Matériaux**, **Analyses**, **Formulaires** et **Rapports**.

### Modèles de matériaux

La zone **Matériaux** sert à définir les modèles de matériaux, leurs champs/propriétés et leur disponibilité pour le laboratoire concerné. Activez les modèles qui doivent pouvoir être proposés dans un formulaire client.

### Modèles d’analyses

La zone **Analyses** sert à configurer les modèles d’analyse et les résultats attendus : nom du champ, type, unité éventuelle, options et caractère obligatoire selon le type de champ.

### Formulaires de demande côté client

La configuration du formulaire client se fait dans **Builder CMS → Formulaires** — et non dans la zone **Matériaux**.

Pour proposer les matériaux au client :

1. Ouvrez **Builder CMS → Formulaires** et créez ou modifiez le formulaire de demande concerné.
2. Ajoutez un champ de formulaire de type **Matériaux du modèle** (`materials`).
3. Enregistrez le formulaire.
4. Dans le portail client, les modèles de matériaux actifs associés au laboratoire de la demande sont proposés à la sélection.
5. Lorsque le client sélectionne un modèle, les propriétés configurées pour ce matériau sont affichées avec leur type de saisie (texte, nombre, date, liste, choix multiples ou Oui/Non, selon la définition de la propriété).
6. Les valeurs saisies sont enregistrées dans les données personnalisées de la demande et sont réaffichées dans le formulaire de modification.

Si aucun matériau n’apparaît, vérifiez que le modèle est actif et associé au même laboratoire que la demande, puis vérifiez que le champ `materials` est bien présent dans le formulaire client.

> Les libellés précis affichés dans l’interface peuvent dépendre de la version de l’application. La clé technique du type de champ est `materials`.

### Modèles de rapports

La zone **Rapports** permet de gérer les modèles de rapport et, dans les flux concernés, d’importer un document Word (`.docx`). Testez les balises, images et conversions avec un document non critique avant de généraliser le modèle.

## Stockage et sauvegardes

- **Base de données SQLite :** `database.sqlite` à la racine du projet. Elle contient les comptes et les collections métier sérialisées en JSON.
- **Rapports enregistrés :** `storage/reports/`.
- **Fichiers temporaires et artefacts :** certains fichiers peuvent être créés pendant la génération ou la consultation de documents.

Avant toute mise à jour, arrêtez l’application et effectuez une sauvegarde cohérente de `database.sqlite` ainsi que du répertoire `storage/`. Stockez les sauvegardes hors du serveur, limitez-en l’accès et testez périodiquement leur restauration. Ne supprimez pas la base de données pour résoudre un problème sans avoir effectué une sauvegarde.

## Sécurité

- Utilisez un `JWT_SECRET` robuste et différent pour chaque environnement ; il est obligatoire en production.
- N’utilisez pas de mots de passe par défaut ou partagés. Changez immédiatement les identifiants initialement créés.
- Ne commitez jamais `.env`, les bases de données, les documents clients ou les sauvegardes dans le dépôt.
- Servez l’application derrière HTTPS en production et limitez l’accès réseau au serveur.
- Restreignez l’accès au fichier SQLite, aux rapports générés et aux sauvegardes aux seuls comptes système nécessaires.
- Configurez SMTP avec des identifiants dédiés et protégez-les comme des secrets.
- Testez les permissions, les scénarios de réinitialisation de mot de passe et l’accès inter-laboratoires avant la mise en service.
- Les journaux peuvent contenir des détails techniques : évitez d’y écrire des données personnelles ou confidentielles et contrôlez leur accès.

Cette documentation ne constitue pas une certification de conformité réglementaire. Pour une utilisation en environnement réglementé, définissez et validez vos procédures de sauvegarde, de traçabilité, de validation et de contrôle d’accès.

## Dépannage

- **Le serveur ne démarre pas :** vérifiez `node -v` (Node.js 22+), puis exécutez `npm install` et consultez les messages du terminal.
- **Le port 3000 est déjà utilisé :** arrêtez le service qui l’occupe ou adaptez le port dans `server.ts` et vérifiez les paramètres de déploiement.
- **Erreur de jeton en production :** vérifiez que `JWT_SECRET` est défini avant de lancer le serveur.
- **Le formulaire ne propose aucun matériau :** vérifiez le laboratoire sélectionné, l’état actif du modèle et la présence du champ de type `materials` dans **Builder CMS → Formulaires**.
- **Un rapport Word/PDF échoue :** vérifiez le fichier modèle, les droits d’écriture sur `storage/reports/` et la disponibilité de LibreOffice si une conversion est requise.
- **Une modification ne semble pas enregistrée :** vérifiez les messages du serveur et la sauvegarde de `database.sqlite` avant de tenter une réparation.

## Structure du projet

```text
.
├── server.ts                 # Serveur Express, API et service de fichiers
├── install.sh                # Script d’installation assistée Linux
├── package.json              # Dépendances et commandes npm
├── index.html                # Point d’entrée HTML
├── vite.config.ts            # Configuration Vite
├── tsconfig.json             # Configuration TypeScript
└── src/
    ├── App.tsx               # Navigation et contrôle d’accès par rôle
    ├── main.tsx              # Point d’entrée React
    ├── store.tsx             # État et données partagées de l’application
    ├── types.ts              # Types TypeScript
    ├── data.ts               # Données/configurations initiales
    ├── db/                   # Accès aux bases SQLite
    ├── components/           # Modales et composants partagés
    ├── views/                # Écrans métier
    └── utils/                # Utilitaires
```

## Contribution et maintenance

Avant de livrer une modification :

1. Exécutez `npm run lint`.
2. Exécutez `npm run build`.
3. Testez les parcours concernés avec des comptes de rôles différents.
4. Vérifiez la création, la modification et la persistance des demandes, notamment les propriétés des matériaux si le formulaire utilise le champ `materials`.
5. Sauvegardez la base et les fichiers avant le déploiement.

---

*Document maintenu avec le projet. Mettez-le à jour à chaque changement de comportement, de configuration ou de procédure d’installation.*
