/**
 * Collecteur Global de Logs Côté Client (Frontend)
 *
 * Intercepte `console.log`, `console.info`, `console.warn`, `console.error`
 * ainsi que les erreurs globales `window.onerror` et `unhandledrejection`.
 * Les entrées sont stockées dans un tampon circulaire en mémoire (500 entrées max)
 * et exposées de manière réactive (pattern Observer) pour l'onglet "Logs Système"
 * dans la vue `Settings.tsx` réservée aux administrateurs.
 */

export interface LogEntry {
  /** Identifiant unique du log (préfixé par `fe-` côté client ou `be-` côté serveur) */
  id: string;
  /** Horodatage ISO 8601 de l'événement */
  timestamp: string;
  /** Niveau de sévérité */
  level: 'info' | 'warn' | 'error';
  /** Origine du log */
  source: 'frontend' | 'backend';
  /** Message principal (premier argument passé à console.*) */
  message: string;
  /** Détails complémentaires (arguments suivants ou pile d'exécution StackTrace) */
  details?: string;
}

/** Capacité maximale du tampon circulaire de logs en mémoire */
const MAX_FRONTEND_LOGS = 500;
/** Liste des logs enregistrés du plus récent au plus ancien */
let frontendLogs: LogEntry[] = [];
/** Ensemble des callbacks abonnés aux mises à jour du journal */
const listeners = new Set<() => void>();
/** Garde-fou empêchant d'encapsuler `console.*` plusieurs fois (ex: lors du HMR) */
let isInitialized = false;

/**
 * Notifie tous les composants React abonnés qu'une nouvelle entrée de log a été ajoutée
 * ou que le journal a été purgé.
 */
function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Formate un argument quelconque de `console.*` en chaîne lisible.
 * Extrait la trace de pile pour les instances de `Error` et sérialise les objets en JSON.
 *
 * @param arg Argument brut passé à une fonction de log
 * @returns Représentation textuelle sécurisée
 */
function formatArg(arg: any): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/**
 * Ajoute manuellement ou automatiquement une entrée dans le journal frontend.
 *
 * @param level Niveau de criticité ('info' | 'warn' | 'error')
 * @param args Liste des arguments originaux passés à la console
 */
export function addFrontendLog(level: LogEntry['level'], args: any[]) {
  const formattedArgs = args.map(formatArg);
  const mainMessage = formattedArgs[0] || '';
  const extraDetails = formattedArgs.slice(1).join('\n');

  // Ignore les messages internes de Vite HMR pour éviter de polluer la console d'administration
  if (mainMessage.includes('[vite]')) return;

  const entry: LogEntry = {
    id: `fe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    source: 'frontend',
    message: mainMessage,
    details: extraDetails || undefined,
  };

  frontendLogs = [entry, ...frontendLogs].slice(0, MAX_FRONTEND_LOGS);
  notifyListeners();
}

/**
 * Initialise l'interception globale des méthodes `console.*` et des événements
 * d'erreur du navigateur (`error` et `unhandledrejection`).
 * Doit être appelé une seule fois au démarrage dans `src/main.tsx`.
 */
export function initFrontendLogger() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Conservation des références natives pour maintenir l'affichage dans les DevTools du navigateur
  const origLog = console.log.bind(console);
  const origInfo = console.info.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: any[]) => {
    origLog(...args);
    addFrontendLog('info', args);
  };

  console.info = (...args: any[]) => {
    origInfo(...args);
    addFrontendLog('info', args);
  };

  console.warn = (...args: any[]) => {
    origWarn(...args);
    addFrontendLog('warn', args);
  };

  console.error = (...args: any[]) => {
    origError(...args);
    addFrontendLog('error', args);
  };

  // Capture des exceptions synchrones non interceptées
  window.addEventListener('error', (event) => {
    addFrontendLog('error', [
      `Erreur non interceptée : ${event.message}`,
      `Fichier: ${event.filename}:${event.lineno}:${event.colno}`,
      event.error?.stack || '',
    ]);
  });

  // Capture des rejets de promesses asynchrones sans bloc .catch()
  window.addEventListener('unhandledrejection', (event) => {
    addFrontendLog('error', [
      'Promesse rejetée non gérée (Unhandled Rejection)',
      event.reason,
    ]);
  });

  addFrontendLog('info', ['Moniteur de diagnostic Frontend initialisé.']);
}

/**
 * Retourne la liste actuelle des logs frontend en mémoire.
 */
export function getFrontendLogs(): LogEntry[] {
  return frontendLogs;
}

/**
 * Vide le tampon de logs frontend et notifie les observateurs.
 */
export function clearFrontendLogs() {
  frontendLogs = [];
  notifyListeners();
}

/**
 * Abonne un écouteur aux changements du journal frontend.
 *
 * @param listener Fonction de rappel déclenchée à chaque nouveau log ou purge
 * @returns Fonction de désabonnement (cleanup pour `useEffect`)
 */
export function subscribeFrontendLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
