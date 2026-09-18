/**
 * Couche d'Accès aux Données - Authentification et Utilisateurs
 * 
 * Ce module gère la connexion SQLite (via node:sqlite DatabaseSync),
 * le schéma des tables d'authentification, les jetons de réinitialisation
 * de mot de passe, ainsi que les demandes de création de comptes demandeurs.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import bcrypt from 'bcryptjs';

/** Instance unique de connexion SQLite (pattern Singleton) */
let db: DatabaseSync | null = null;

/**
 * Obtient ou initialise l'instance unique de connexion à la base SQLite locale.
 * Le fichier physique est stocké à la racine du projet sous 'database.sqlite'.
 * 
 * @returns Instance de base de données synchrone
 */
export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(path.resolve('./database.sqlite'));
  }
  return db;
}

/**
 * Initialise le schéma relationnel pour la gestion des utilisateurs et de la sécurité :
 * 1. Table `users` : comptes utilisateurs, rôles et mots de passe hachés
 * 2. Table `reset_tokens` : codes temporaires de récupération de mot de passe
 * 3. Table `account_requests` : formulaires de demandes d'accès soumis par les demandeurs
 * 
 * Si la table `users` est vide lors du premier lancement, un jeu de comptes
 * de démonstration représentatif de chaque profil métier est automatiquement injecté.
 */
export async function initDb() {
  const database = getDb();
  
  // Création de la table des utilisateurs habilités
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      company TEXT,
      labId TEXT
    )
  `);

  // Migration douce du schéma si la colonne labId est absente
  try {
    database.exec('ALTER TABLE users ADD COLUMN labId TEXT');
  } catch (e) {
    // La colonne existe déjà dans le schéma
  }

  // Création de la table des codes temporaires de réinitialisation de mot de passe
  database.exec(`
    CREATE TABLE IF NOT EXISTS reset_tokens (
      email TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      expiry INTEGER NOT NULL
    )
  `);

  // Création de la table des demandes de création de compte en attente de validation manager
  database.exec(`
    CREATE TABLE IF NOT EXISTS account_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      message TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Comptes de référence représentatifs de l'architecture multi-laboratoires
  const referenceUsers = [
    // 1. Demandeur commun accédant aux deux laboratoires depuis une page unique
    { id: 'usr-1', email: 'jean.dupont@entreprise.com', name: 'Jean Dupont', role: 'demandeur', company: 'AeroTech Industries', labId: null },
    // 2. Équipe dédiée du Laboratoire 1 : Métallographie & Microstructure
    { id: 'usr-2', email: 'sophie.martin@labo.com', name: 'Sophie Martin', role: 'analyste', company: 'Laboratoire Métallographie', labId: 'lab-metallurgie' },
    { id: 'usr-3', email: 'marc.durand@labo.com', name: 'Dr. Marc Durand', role: 'manager', company: 'Laboratoire Métallographie', labId: 'lab-metallurgie' },
    // 3. Équipe dédiée du Laboratoire 2 : Essais Mécaniques & Physico-Chimie
    { id: 'usr-4', email: 'claire.leroy@labo-meca.com', name: 'Claire Leroy', role: 'analyste', company: 'Laboratoire Mécanique', labId: 'lab-mecanique' },
    { id: 'usr-5', email: 'alexandre.roux@labo-meca.com', name: 'Alexandre Roux', role: 'manager', company: 'Laboratoire Mécanique', labId: 'lab-mecanique' },
    // 4. Direction générale / Responsable Qualité multi-sites (accès global commutable)
    { id: 'usr-6', email: 'directeur@groupelabo.com', name: 'Dr. Hélène Voisin', role: 'manager', company: 'Direction des Laboratoires', labId: 'all' },
  ];

  // Hachage sécurisé du mot de passe initial avec un sel de coût 10
  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // Insertion ou mise à niveau des comptes de test sans collision d'ID ou d'email
  for (const refUser of referenceUsers) {
    const existingByEmail = database.prepare('SELECT id, labId FROM users WHERE email = ?').get(refUser.email) as { id: string; labId: string } | undefined;
    if (existingByEmail) {
      database.prepare('UPDATE users SET name = ?, role = ?, company = ?, labId = ? WHERE email = ?').run(
        refUser.name,
        refUser.role,
        refUser.company || '',
        refUser.labId,
        refUser.email
      );
    } else {
      const existingById = database.prepare('SELECT id FROM users WHERE id = ?').get(refUser.id);
      const safeId = existingById 
        ? `usr-ref-${refUser.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-')}` 
        : refUser.id;

      database.prepare('INSERT INTO users (id, email, passwordHash, name, role, company, labId) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        safeId,
        refUser.email,
        defaultPasswordHash,
        refUser.name,
        refUser.role,
        refUser.company || '',
        refUser.labId
      );
    }
  }
}

/**
 * Recherche un utilisateur par son adresse email.
 * 
 * @param email Adresse de messagerie
 * @returns L'enregistrement utilisateur complet (avec hash de mot de passe) ou undefined
 */
export async function getUserByEmail(email: string) {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as any;
}

/**
 * Recherche un utilisateur par son identifiant unique.
 * 
 * @param id Identifiant utilisateur (ex: 'usr-1')
 * @returns Données de l'utilisateur ou undefined
 */
export async function getUserById(id: string) {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as any;
}

/**
 * Insère un nouvel utilisateur dans la base de données.
 * 
 * @param id Identifiant généré pour l'utilisateur
 * @param email Adresse email unique
 * @param passwordHash Mot de passe préalablement haché
 * @param name Nom et prénom
 * @param role Habilitation ('demandeur', 'analyste', 'manager')
 * @param company Entreprise d'appartenance (optionnel)
 * @param labId Laboratoire d'affectation (optionnel)
 */
export async function createUser(id: string, email: string, passwordHash: string, name: string, role: string, company?: string, labId?: string) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO users (id, email, passwordHash, name, role, company, labId) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(id, email, passwordHash, name, role, company || '', labId || null);
}

/**
 * Récupère l'ensemble des utilisateurs enregistrés (sans exposer leurs hashs de mot de passe).
 * 
 * @returns Liste des utilisateurs du système avec leur laboratoire d'affectation
 */
export async function getUsers() {
  const database = getDb();
  const stmt = database.prepare('SELECT id, email, name, role, company, labId FROM users');
  return stmt.all() as any[];
}

/**
 * Met à jour le hash de mot de passe d'un utilisateur existant.
 * 
 * @param id Identifiant de l'utilisateur cible
 * @param newHash Nouveau condensat bcrypt
 */
export async function updatePassword(id: string, newHash: string) {
  const database = getDb();
  const stmt = database.prepare('UPDATE users SET passwordHash = ? WHERE id = ?');
  stmt.run(newHash, id);
}

/**
 * Enregistre ou actualise un code de récupération de mot de passe pour un email donné.
 * 
 * @param email Adresse de l'utilisateur
 * @param token Code à 6 chiffres
 * @param expiry Horodatage d'expiration en millisecondes
 */
export async function createResetToken(email: string, token: string, expiry: number) {
  const database = getDb();
  const stmt = database.prepare('INSERT OR REPLACE INTO reset_tokens (email, token, expiry) VALUES (?, ?, ?)');
  stmt.run(email, token, expiry);
}

/**
 * Récupère le code de récupération actif associé à une adresse email.
 * 
 * @param email Adresse de l'utilisateur demandant la réinitialisation
 * @returns L'enregistrement du token ou undefined
 */
export async function getResetToken(email: string) {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM reset_tokens WHERE email = ?');
  return stmt.get(email) as any;
}

/**
 * Supprime le token de réinitialisation après utilisation réussie ou expiration.
 * 
 * @param email Adresse de l'utilisateur
 */
export async function deleteResetToken(email: string) {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM reset_tokens WHERE email = ?');
  stmt.run(email);
}

/**
 * Enregistre une demande de création de compte soumise depuis la page publique de connexion.
 * 
 * @param id Identifiant de la demande
 * @param name Nom du demandeur
 * @param email Email de contact
 * @param company Entreprise
 * @param message Justification ou précisions sur le besoin
 */
export async function createAccountRequest(id: string, name: string, email: string, company: string, message: string) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO account_requests (id, name, email, company, message, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(id, name, email, company, message, Date.now());
}

/**
 * Récupère la liste de toutes les demandes de création de compte, triées par date décroissante.
 * 
 * @returns Liste des demandes d'accès en attente de traitement
 */
export async function getAccountRequests() {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM account_requests ORDER BY created_at DESC');
  return stmt.all() as any[];
}

/**
 * Supprime une demande de création de compte une fois traitée (approuvée ou rejetée) par le manager.
 * 
 * @param id Identifiant de la demande
 */
export async function deleteAccountRequest(id: string) {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM account_requests WHERE id = ?');
  stmt.run(id);
}
