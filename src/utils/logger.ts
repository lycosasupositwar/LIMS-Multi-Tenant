/**
 * Intercepteur et Collecteur Global de Logs Front-End (Application Logger)
 * 
 * Capture en mémoire :
 * - console.log, console.info, console.warn, console.error
 * - Les exceptions globales (window.onerror)
 * - Les rejets de promesses non gérés (unhandledrejection)
 * - Les requêtes fetch en échec (HTTP 4xx / 5xx ou erreurs réseau)
 */

export interface AppLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: 'frontend' | 'backend' | 'network' | 'audit';
  message: string;
  details?: string;
}

const MAX_FRONTEND_LOGS = 500;
let frontendLogs: AppLogEntry[] = [];
const listeners = new Set<() => void>();
let isInitialized = false;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

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

export function addAppLog(
  level: AppLogEntry['level'],
  source: AppLogEntry['source'],
  message: string,
  details?: string
) {
  const entry: AppLogEntry = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    details,
  };

  frontendLogs = [entry, ...frontendLogs].slice(0, MAX_FRONTEND_LOGS);
  notifyListeners();
}

export function getFrontendLogs(): AppLogEntry[] {
  return frontendLogs;
}

export function clearFrontendLogs() {
  frontendLogs = [];
  notifyListeners();
}

export function subscribeToLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function initGlobalLogger() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);

  console.log = (...args: any[]) => {
    originalLog(...args);
    const msg = args.map(formatArg).join(' ');
    // Ignore les messages internes de Vite HMR pour garder la console propre
    if (!msg.includes('[vite]')) {
      addAppLog('info', 'frontend', msg);
    }
  };

  console.info = (...args: any[]) => {
    originalInfo(...args);
    addAppLog('info', 'frontend', args.map(formatArg).join(' '));
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    addAppLog('warn', 'frontend', args.map(formatArg).join(' '));
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    const formatted = args.map(formatArg);
    addAppLog('error', 'frontend', formatted[0] || 'Erreur inconnue', formatted.slice(1).join('\n') || undefined);
  };

  // Capture des erreurs d'exécution JavaScript non interceptées
  window.addEventListener('error', (event) => {
    addAppLog(
      'error',
      'frontend',
      `Exception non gérée : ${event.message}`,
      `${event.filename || 'inconnu'}:${event.lineno || 0}:${event.colno || 0}\n${event.error?.stack || ''}`
    );
  });

  // Capture des promesses rejetées sans .catch()
  window.addEventListener('unhandledrejection', (event) => {
    const reason = formatArg(event.reason);
    addAppLog('error', 'frontend', `Promesse rejetée non gérée`, reason);
  });

  // Surveillance des appels réseau fetch (détection automatique des erreurs HTTP 4xx/5xx)
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || 'URL inconnue';
    const method = (args[1]?.method || 'GET').toUpperCase();

    try {
      const response = await originalFetch(...args);
      if (!response.ok && !url.includes('/api/admin/logs')) {
        // Clone pour lire le détail d'erreur sans consommer le flux principal
        const clone = response.clone();
        clone.text().then((bodyText) => {
          addAppLog(
            response.status >= 500 ? 'error' : 'warn',
            'network',
            `HTTP ${response.status} sur ${method} ${url}`,
            bodyText.slice(0, 500)
          );
        }).catch(() => {});
      }
      return response;
    } catch (error: any) {
      if (!url.includes('/api/admin/logs')) {
        addAppLog('error', 'network', `Échec réseau sur ${method} ${url}`, error?.message || String(error));
      }
      throw error;
    }
  };

  addAppLog('info', 'frontend', 'Moniteur de diagnostic initialisé avec succès.');
}