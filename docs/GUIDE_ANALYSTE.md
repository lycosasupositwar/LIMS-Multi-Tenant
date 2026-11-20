# Guide Utilisateur — Analyste / Technicien Laboratoire

Ce guide s'adresse aux **Analystes et Techniciens**. Il couvre le travail quotidien sur paillasse : suivi de planning, gestion des échantillons, saisie des résultats et traçabilité qualité.

---

## 1. Votre Espace de Travail

À la connexion, votre interface est filtrée sur votre laboratoire :
- **Tableau de bord** : vue opérationnelle listant vos dossiers assignés, vos échantillons en attente de préparation et vos essais à traiter.
- **Mon Planning** : accès exclusif à votre **calendrier personnel en lecture seule** (vues **Mois / Semaine / Jour**), filtré uniquement sur **vos essais**. Cliquez sur un essai pour consulter sa durée (essai + préparation), ses étapes de préparation et son éventuel numéro de lot (`LOT-X`).
- **QuickScan QR** *(bouton dans la barre supérieure)* : scannez un code-barres / QR code d'échantillon à la douchette pour ouvrir directement sa fiche.

> **Note** : les modules d'administration (`Config. CMS`, `Équipements & Métrologie`, vues Kanban/Charge et édition du planning) sont réservés aux managers.

---

## 2. Réception, Préparation & Chaîne de Garde des Échantillons

Dans **Échantillons & Préparations** :
1. **Découpe / Enrobage (sous-échantillons)** : créez des sous-échantillons (ex. plots enrobés) en renseignant le type de résine, le diamètre, la gamme de polissage et l'attaque chimique.
2. **Étiquetage thermique Zebra** : imprimez l'étiquette 70×37 mm avec QR Code (impression directe ou code ZPL II).
3. **Traçabilité & Fin de vie** : renseignez l'emplacement de stockage (`Armoire / Tiroir`), la date limite de conservation, les **lots de consommables utilisés**, puis tracez la restitution ou la destruction en fin d'étude.

---

## 3. Exécution & Saisie des Analyses

Dans **Essais & Analyses** :
1. **Démarrer un essai** : passez un essai `Planifié` au statut `En Cours`.
2. **Consulter le Mode Opératoire / Norme (PDF)** : si un PDF est rattaché à la méthode, cliquez sur le badge **📄 Mode Opératoire** directement sous le titre de l'essai.
3. **Sélectionner l'équipement & les lots de consommables** :
   - Choisissez l'instrument utilisé dans la liste **Équipement de mesure (ISO 17025)**. Les appareils expirés ou hors service sont **automatiquement bloqués** pour garantir la validité métrologique.
   - Enregistrez les numéros de lots de consommables/réactifs utilisés.
4. **Saisir ou importer les résultats** :
   - **Valeurs numériques** : si des tolérances (`minSpec` / `maxSpec`) sont définies, le badge *Conforme / Non conforme* se calcule en temps réel.
   - **Séries numériques** *(ex. dureté)* : ajoutez les mesures ou cliquez sur **Importer CSV** pour charger un export machine (`.csv` / `.txt`). La moyenne et l'écart-type sont calculés automatiquement.
   - **Tableaux verticaux** *(ex. ICP/OES)* : importez un fichier CSV ou collez directement un tableau copié depuis Excel.
   - **Micrographies** : importez vos clichés, renseignez le grossissement et les commentaires.
5. **Soumettre à validation** : une fois tous les champs obligatoires remplis, soumettez l'essai au manager (`À Valider`). En cas de rejet (`À reprendre`), le motif du manager s'affiche en rouge en haut de la fiche pour correction.

---

## 4. Non-Conformités (CAPA) & Consommables

- **Non-Conformités (CAPA)** : signalez tout incident (échantillon endommagé, anomalie machine, dérive d'essai) en ouvrant une fiche NC liée à l'échantillon ou à l'essai concerné.
- **Consommables** : mettez à jour les niveaux de stock après prélèvement ; les alertes de stock bas et de péremption proche sont remontées automatiquement.
