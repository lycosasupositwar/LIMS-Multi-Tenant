/**
 * Couche d'Accès aux Données - Module Collections LIMS
 * 
 * Ce module gère la persistance locale des collections métier de l'application
 * (échantillons, analyses, modèles dynamiques, rapports, consommables, etc.)
 * au format JSON dans une base SQLite synchrone.
 */

import { getDb } from './auth';

/**
 * Initialise la table des collections LIMS si elle n'existe pas déjà.
 * Chaque collection métier est indexée par sa clé unique (id) et stocke
 * son état sous forme de chaîne sérialisée (JSON).
 */
export async function initLimsDb() {
  const database = getDb();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);
}

/**
 * Récupère le contenu désérialisé d'une collection métier par son identifiant.
 * 
 * @param id Clé de la collection (ex: 'samples', 'analyses', 'materialTemplates')
 * @returns Le tableau ou l'objet JSON stocké, ou null si la collection n'existe pas.
 */
export async function getCollection(id: string) {
  const database = getDb();
  const stmt = database.prepare('SELECT data FROM collections WHERE id = ?');
  const row = stmt.get(id) as any;
  if (row) {
    return JSON.parse(row.data);
  }
  return null;
}

/**
 * Enregistre ou remplace les données d'une collection dans la base SQLite.
 * Les données fournies sont sérialisées en JSON.
 * 
 * @param id Clé de la collection à persister
 * @param data Données à sauvegarder (tableau d'entités ou configuration)
 */
export async function setCollection(id: string, data: any) {
  const database = getDb();
  const stmt = database.prepare('INSERT OR REPLACE INTO collections (id, data) VALUES (?, ?)');
  stmt.run(id, JSON.stringify(data));
}
