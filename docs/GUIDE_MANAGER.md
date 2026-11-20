# Guide Utilisateur — Manager / Responsable Laboratoire

Ce guide s'adresse aux **Managers** (Responsables de Laboratoire) et **Administrateurs**. Il détaille l'ensemble des opérations de pilotage, de planification, de qualité ISO/IEC 17025 et de paramétrage du laboratoire.

---

## 1. Tableau de Bord & KPI Laboratoire

Le tableau de bord présente **12 indicateurs clés** répartis en **4 catégories** filtrables par période (`7j`, `30j`, `90j`, `Année`, `Personnalisée`) et par laboratoire (pour les comptes transverses) :

1. **Pilotage Demandes, Délais & Valorisation** : demandes en retard (calculées en priorité sur la date engagée `committedDueDate`), demandes à revoir, taux de clôture et valorisation `€ HT` / taux OTD.
2. **Production & Charge Laboratoire** : charge horaire active (**essais + temps de préparation optimisé par lots** + équivalent jours ouvrés), échantillons suivis et analyses en attente de validation.
3. **Qualité & Conformité (ISO 17025)** : taux de validation qualité, essais repris/rejetés et fiches Non-Conformités (CAPA) ouvertes.
4. **Ressources, Métrologie & Stocks** : étalonnages expirés ou à échéance ≤ 30 jours et alertes de consommables sous seuil / péremption.

- **Exports de direction** : cliquez sur **Générer Bilan** pour exporter un **Bilan PDF** paginé ou un **Classeur Excel (`.xlsx`)** multi-feuilles avec graphiques natifs.

---

## 2. Traitement des Demandes, Revue de Contrat & Devis PDF

Dans **Demandes & Workflow** :
1. **Revue de contrat ISO 17025 §7.1** : vérifiez l'adéquation des méthodes, des ressources et du personnel, puis fixez la **date d'échéance engagée (`committedDueDate`)**.
2. **Option Devis Commercial (PDF)** *(si activée dans Paramètres → Laboratoire)* :
   - Cliquez sur **Générer Devis PDF** pour télécharger un devis A4 (HT, TVA 20 %, TTC).
   - Suivez l'état du devis (`Non émis`, `Généré`, `Envoyé`, `Accord / BC reçu`, `Refusé`) et renseignez le **N° de Bon de commande**.
3. **Assignation avec contrôle bloquant d'habilitations** :
   - Le sélecteur **Assignation Analyste** bloque automatiquement tout opérateur non habilité (ou dont l'habilitation a expiré) sur l'une des méthodes du dossier.
   - Pour les dossiers multi-techniques, vous pouvez également **assigner chaque essai individuellement** à un analyste différent directement dans la vue **Essais & Analyses**.
4. **Réception & génération d'échantillons** : ajustez la quantité (pré-remplie depuis la demande client), validez les propriétés matériaux et générez les échantillons + essais associés.
5. **Conclusion & Fil de discussion** : rédigez la conclusion technique (`{{demande.conclusion}}`) qui alimentera automatiquement le rapport, et échangez avec le demandeur ou en note interne.

---

## 3. Planning, Charge & Planification Intelligente

Dans **Planning & Charge** :
- **Calendrier interactif (Mois / Semaine / Jour)** :
  - Glissez-déposez les essais depuis la file **« À planifier »** ou d'une journée à l'autre.
  - Les jauges horaires incluent **temps d'essais + temps de préparation optimisé par lots**.
  - Cliquez sur un essai pour modifier sa date, son équipement, le démarrer ou **l'épingler** (`isScheduleLocked`) afin qu'il ne soit jamais déplacé par l'auto-planificateur.
- **Absences & Maintenances** : cliquez sur **Absences / Maint.** pour déclarer les congés opérateurs (avec réduction de capacité horaire/jour) et les maintenances machines.
- **Planification Intelligente (Auto)** :
  - Lance une **simulation (Dry-Run)** sans rien modifier en base.
  - Priorise les urgences (`haute`) en décalant uniquement les essais non démarrés (`planifie`) et non épinglés.
  - Regroupe automatiquement les préparations en lots selon vos règles (ex. *6 enrobages d'un même alliage au polissage*) et affiche le temps gagné avant validation.
- **Vues Kanban & Charge** : suivi des essais par statut et charge hebdomadaire par analyste (essais + prépa) et par équipement.

---

## 4. Parc Équipements, Métrologie & Cartes de Contrôle (CQ)

Dans **Équipements & Métrologie** :
- **Onglet Parc** : enregistrez vos machines, suivez leurs dates d'étalonnage (alertes ≤ 30j / expiré), renouvelez un étalonnage en un clic ou basculez un appareil en `En maintenance` / `Hors service`.
- **Verrouillage métrologique** : un appareil expiré ou hors service est bloqué pour les analystes lors de la saisie d'essais ; en tant que manager, une dérogation exceptionnelle impose une justification traçable (`calibrationOverrideReason`).
- **Onglet Cartes CQ** : créez des cartes de contrôle qualité interne (cale étalon, éprouvette témoin) avec **valeur cible** et **écart-type σ**. Saisissez les points de contrôle périodiques et surveillez les dérives visuellement sur le graphique **±2σ (alerte)** et **±3σ (hors contrôle)**.

---

## 5. Validation des Essais, Rapports & Révisions ISO 17025

- **Validation d'essais** : dans **Essais & Analyses**, contrôlez les résultats (conformité aux tolérances `minSpec`/`maxSpec`), validez (`valide`) ou rejetez (`rejete`) avec motif obligatoire.
- **Émission de rapports** : dans **Rapports**, générez un rapport depuis le gabarit HTML A4 standard ou un modèle Word (`.docx`). Les équipements utilisés et leurs dates d'étalonnage sont automatiquement repris.
- **Immutabilité & Révisions** : une fois publié, le rapport est verrouillé avec une **empreinte SHA-256**. Toute correction passe par le bouton **Révision** (modale dédiée avec motif d'amendement obligatoire), générant `Rev2`, `Rev3`... et notifiant automatiquement le demandeur par e-mail.

---

## 6. Habilitations, Builder CMS, GED & Sauvegardes

- **Habilitations opérateurs (Paramètres → Utilisateurs)** :
  - Vous voyez et gérez **exclusivement le personnel et les méthodes de votre laboratoire**.
  - Cliquez sur une méthode pour habiliter/retirer un opérateur et renseignez optionnellement sa **date d'expiration** (alerte ≤ 30j et blocage automatique après expiration).
- **Builder CMS** :
  - Configurez les modèles de **Matériaux**, **Analyses** (résultats, tarifs, durées, étapes de préparation et **Mode Opératoire PDF** en GED légère), **Formulaires clients** et **Rapports Word** (aide-mémoire des balises intégré, dont `{{@table_equipements}}`).
- **Paramètres Laboratoire & Sauvegardes** :
  - Configurez l'option **Devis PDF**, les règles de planification et les **étapes de préparation** propres à votre laboratoire.
  - Dans **Paramètres → Système**, déclenchez des sauvegardes manuelles, exportez/restaurez la **configuration JSON complète de votre laboratoire** (`config-lab-*.json`) et téléchargez les archives de configuration.
