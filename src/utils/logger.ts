/**
 * Collecteur global de logs côté client (Frontend)
 * Intercepte console.log, console.info, console.warn, console.error
 * ainsi que les erreurs globales window.onerror et unhandledrejection.
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: 'frontend' | 'backend';
  message: string;
  details?: string;
}

const MAX_FRONTEND_LOGS = 500;
let frontendLogs: LogEntry[] = [];
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

export function addFrontendLog(level: LogEntry['level'], args: any[]) {
  const formattedArgs = args.map(formatArg);
  const mainMessage = formattedArgs[0] || '';
  const extraDetails = formattedArgs.slice(1).join('\n');

  // Ignore les messages internes de Vite HMR pour éviter de polluer la console
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

export function initFrontendLogger() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

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

  window.addEventListener('error', (event) => {
    addFrontendLog('error', [
      `Erreur non interceptée : ${event.message}`,
      `Fichier: ${event.filename}:${event.lineno}:${event.colno}`,
      event.error?.stack || '',
    ]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    addFrontendLog('error', [
      'Promesse rejetée non gérée (Unhandled Rejection)',
      event.reason,
    ]);
  });

  addFrontendLog('info', ['Moniteur de diagnostic Frontend initialisé.']);
}

export function getFrontendLogs(): LogEntry[] {
  return frontendLogs;
}

export function clearFrontendLogs() {
  frontendLogs = [];
  notifyListeners();
}

export function subscribeFrontendLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}