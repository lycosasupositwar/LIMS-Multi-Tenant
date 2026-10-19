/**
 * Serveur Backend Express & Passerelle API LIMS (Version Sécurisée + SMTP)
 * 
 * Ce fichier constitue le point d'entrée du serveur backend. Il expose :
 * - L'authentification par cookies de session sécurisés (JWT + HttpOnly + SameSite Lax)
 * - Une protection anti-bruteforce sur les routes sensibles
 * - Les endpoints CRUD pour les collections métier avec contrôle d'accès par rôle (RBAC)
 * - La gestion cloisonnée des habilitations utilisateurs et des demandes d'accès
 * - Le service de conversion documentaire Word -> PDF authentifié et limité en concurrence
 * - Le service de notifications par e-mail (SMTP via Nodemailer) administrable par les admins
 * - Le journal d'événements et d'erreurs système réservé aux administrateurs
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import libre from 'libreoffice-convert';
import { promisify } from 'util';
const libreConvertAsync = promisify(libre.convert);
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import {
  initDb,
  getUserByEmail,
  createUser,
  getUserById,
  getUsers,
  updatePassword,
  createResetToken,
  getResetToken,
  deleteResetToken,
  createAccountRequest,
  getAccountRequests,
  deleteAccountRequest,
  deleteUser
} from './src/db/auth.js';
import { initLimsDb, getCollection, setCollection } from './src/db/lims.js';

const IS_PROD = process.env.NODE_ENV === 'production';

// ==========================================
// Collecteur de Logs Système (Backend)
// ==========================================
interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: 'backend';
  message: string;
  details?: string;
}

const MAX_SERVER_LOGS = 500;
const serverLogs: ServerLogEntry[] = [];

const origConsoleLog = console.log.bind(console);
const origConsoleInfo = console.info.bind(console);
const origConsoleWarn = console.warn.bind(console);
const origConsoleError = console.error.bind(console);

function formatServerArg(arg: any): string {
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

function recordServerLog(level: 'info' | 'warn' | 'error', args: any[]) {
  const formatted = args.map(formatServerArg);
  const message = formatted[0] || '';
  const details = formatted.slice(1).join('\n');

  serverLogs.unshift({
    id: `be-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    source: 'backend',
    message,
    details: details || undefined,
  });

  if (serverLogs.length > MAX_SERVER_LOGS) {
    serverLogs.length = MAX_SERVER_LOGS;
  }
}

console.log = (...args: any[]) => {
  origConsoleLog(...args);
  recordServerLog('info', args);
};
console.info = (...args: any[]) => {
  origConsoleInfo(...args);
  recordServerLog('info', args);
};
console.warn = (...args: any[]) => {
  origConsoleWarn(...args);
  recordServerLog('warn', args);
};
console.error = (...args: any[]) => {
  origConsoleError(...args);
  recordServerLog('error', args);
};

// ==========================================
// Configuration & Service d'Envoi SMTP
// ==========================================
export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromName: 'LIMS Laboratoire',
  fromEmail: 'noreply@laboratoire.fr'
};

async function getSmtpConfig(): Promise<SmtpConfig> {
  try {
    const saved = await getCollection('smtpSettings');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      return { ...DEFAULT_SMTP_CONFIG, ...saved };
    }
  } catch (e) {
    console.error('Erreur lors de la lecture de la configuration SMTP :', e);
  }
  return DEFAULT_SMTP_CONFIG;
}

/**
 * Construit un gabarit HTML propre et professionnel pour les e-mails envoyés par le LIMS
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlEmailTemplate(
  title: string,
  message: string,
  recipientName?: string
): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeRecipientName = recipientName
    ? escapeHtml(recipientName)
    : "";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${safeTitle}</title>
</head>
<body style="
  margin: 0;
  padding: 0;
  background-color: #f1f5f9;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
  -webkit-font-smoothing: antialiased;
">

  <!-- Pré-en-tête affiché dans la boîte de réception -->
  <div style="
    display: none;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    color: transparent;
  ">
    Notification LIMS : ${safeTitle}
  </div>

  <table role="presentation" width="100%" cellpadding="0"
    cellspacing="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 36px 16px;">

        <table role="presentation" width="100%" cellpadding="0"
          cellspacing="0" border="0"
          style="
            max-width: 600px;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            overflow: hidden;
          ">

          <!-- En-tête -->
          <tr>
            <td style="
              padding: 28px 32px 30px;
              background-color: #0f2747;
              background-image: linear-gradient(135deg, #0f2747, #174477);
            ">
              <table role="presentation" width="100%"
                cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0"
                      cellspacing="0" border="0">
                      <tr>
                        <td valign="middle">
                          <div style="
                            color: #ffffff;
                            font-size: 16px;
                            font-weight: 700;
                            letter-spacing: 1.5px;
                          ">LIMS</div>
                          <div style="
                            margin-top: 3px;
                            color: #a9c5e5;
                            font-size: 10px;
                            letter-spacing: 1.6px;
                            text-transform: uppercase;
                          ">Laboratory Management System</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 28px;">
                    <div style="
                      display: inline-block;
                      padding: 5px 10px;
                      border: 1px solid #35618c;
                      border-radius: 20px;
                      color: #b9dcff;
                      font-size: 10px;
                      font-weight: 700;
                      letter-spacing: 1.2px;
                      text-transform: uppercase;
                    ">Notification système</div>

                    <h1 style="
                      margin: 14px 0 0;
                      color: #ffffff;
                      font-size: 25px;
                      line-height: 1.35;
                      font-weight: 700;
                      letter-spacing: -0.4px;
                    ">${safeTitle}</h1>

                    <div style="
                      margin-top: 16px;
                      width: 44px;
                      height: 4px;
                      background-color: #38bdf8;
                      border-radius: 4px;
                      font-size: 0;
                      line-height: 0;
                    ">&nbsp;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding: 32px;">

              ${safeRecipientName
      ? `
                    <p style="
                      margin: 0 0 22px;
                      color: #334155;
                      font-size: 15px;
                      line-height: 1.7;
                    ">
                      Bonjour <strong style="color: #0f2747;">
                        ${safeRecipientName}
                      </strong>,
                    </p>
                  `
      : ""
    }

              <p style="
                margin: 0 0 14px;
                color: #64748b;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 1.2px;
                text-transform: uppercase;
              ">Détails de la notification</p>

              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0"
                style="
                  border: 1px solid #dbeafe;
                  border-radius: 10px;
                  background-color: #f8fbff;
                ">
                <tr>
                  <td width="4" style="
                    background-color: #0ea5e9;
                    border-radius: 10px 0 0 10px;
                    font-size: 0;
                  ">&nbsp;</td>
                  <td style="
                    padding: 22px 20px;
                    color: #334155;
                    font-size: 14px;
                    line-height: 1.9;
                    white-space: pre-line;
                    overflow-wrap: anywhere;
                  ">${safeMessage}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0" style="margin-top: 28px;">
                <tr>
                  <td valign="top" width="34" style="padding-right: 12px;">
                    <div style="
                      width: 30px;
                      height: 30px;
                      line-height: 30px;
                      text-align: center;
                      border-radius: 50%;
                      background-color: #e0f2fe;
                      color: #0369a1;
                      font-size: 16px;
                      font-weight: 700;
                    ">i</div>
                  </td>
                  <td valign="top" style="
                    color: #64748b;
                    font-size: 12px;
                    line-height: 1.8;
                  ">
                    Connectez-vous à votre portail LIMS pour consulter
                    les informations complémentaires et accéder aux détails
                    du dossier concerné.
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="
              padding: 22px 32px;
              background-color: #f8fafc;
              border-top: 1px solid #e2e8f0;
              text-align: center;
            ">
              <p style="
                margin: 0;
                color: #475569;
                font-size: 12px;
                font-weight: 600;
                line-height: 1.7;
              ">Notification automatique du système LIMS</p>

              <p style="
                margin: 7px 0 0;
                color: #94a3b8;
                font-size: 11px;
                line-height: 1.7;
              ">
                Cet e-mail a été généré automatiquement.
                Merci de ne pas répondre directement à ce message.
              </p>

              <div style="
                margin-top: 18px;
                padding-top: 14px;
                border-top: 1px solid #e2e8f0;
                color: #94a3b8;
                font-size: 10px;
                letter-spacing: 0.3px;
              ">© LIMS · Gestion de laboratoire</div>
            </td>
          </tr>

        </table>

        <p style="
          margin: 18px 0 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.6;
          text-align: center;
        ">
          Ce message contient des informations relatives à votre activité LIMS.
        </p>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/**
 * Envoie un e-mail via le serveur SMTP configuré
 */
async function sendMailViaSmtp(toEmail: string, subject: string, textMessage: string, recipientName?: string): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config.enabled) {
    console.info(`[EMAIL IGNORÉ - SMTP DÉSACTIVÉ] Destinataire: ${toEmail} | Sujet: ${subject}`);
    return false;
  }

  if (!config.host || !config.port) {
    console.warn(`[EMAIL ÉCHEC] Hôte ou port SMTP non configuré. Destinataire: ${toEmail}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host.trim(),
    port: Number(config.port),
    secure: Boolean(config.secure),
    auth: config.user ? {
      user: config.user.trim(),
      pass: config.pass,
    } : undefined,
    tls: {
      rejectUnauthorized: false // Permet le fonctionnement avec les relais SMTP internes d'entreprise
    }
  });

  const fromHeader = config.fromName
    ? `"${config.fromName.replace(/"/g, '')}" <${config.fromEmail || config.user}>`
    : (config.fromEmail || config.user);

  await transporter.sendMail({
    from: fromHeader,
    to: toEmail,
    subject: `[LIMS] ${subject}`,
    text: textMessage,
    html: buildHtmlEmailTemplate(subject, textMessage, recipientName),
  });

  console.info(`[EMAIL ENVOYÉ] Vers: ${toEmail} | Sujet: "${subject}"`);
  return true;
}

/** 
 * Clé secrète pour la signature cryptographique des jetons JWT.
 */
if (IS_PROD && !process.env.JWT_SECRET) {
  console.error('ERREUR CRITIQUE : La variable d\'environnement JWT_SECRET est obligatoire en production.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-pour-le-developpement-local-uniquement';

/** Options sécurisées pour le cookie de session (Protection XSS & CSRF) */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000 // 24 heures
};

/** Liste blanche des collections autorisées dans SQLite */
const ALLOWED_COLLECTIONS = new Set([
  'laboratories',
  'notifications',
  'materialTemplates',
  'analysisTemplates',
  'requestTemplates',
  'reportTemplates',
  'samples',
  'analyses',
  'reports',
  'requests',
  'consumables'
]);

/** Collections de configuration réservées aux managers et administrateurs en écriture */
const MANAGER_ONLY_COLLECTIONS = new Set([
  'laboratories',
  'materialTemplates',
  'analysisTemplates',
  'requestTemplates',
  'reportTemplates'
]);

/** Collections accessibles en écriture par un demandeur externe */
const REQUESTER_WRITABLE_COLLECTIONS = new Set([
  'requests',
  'notifications'
]);

/**
 * Extension de la requête Express pour inclure les données de l'utilisateur authentifié
 */
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    company?: string;
    labId?: string | null;
  };
}

// ==========================================
// Protection Anti-Bruteforce & Rate Limiting (En mémoire)
// ==========================================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const otpFailedAttempts = new Map<string, number>();

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxAttempts) {
    return false;
  }
  record.count += 1;
  return true;
}

/**
 * Middleware d'authentification vérifiant la validité du cookie JWT
 * ET l'existence / les droits actuels de l'utilisateur en base de données.
 */
const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const currentUser = await getUserById(decoded.id);
    if (!currentUser) {
      res.clearCookie('token', COOKIE_OPTIONS);
      return res.status(401).json({ error: 'Compte utilisateur introuvable ou révoqué' });
    }
    req.user = {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
      company: currentUser.company,
      labId: currentUser.labId
    };
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session invalide ou expirée' });
  }
};

/**
 * Démarre et configure l'application Express ainsi que les bases de données.
 */
async function startServer() {
  const app = express();
  const PORT = 3000;

  // En-têtes de sécurité HTTP de base
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Configuration des analyseurs de corps de requête et des cookies
  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Journalisation automatique des erreurs d'API (4xx et 5xx)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api') && req.path !== '/api/admin/logs' && res.statusCode >= 400) {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? 'error' : 'warn';
        recordServerLog(level, [
          `[HTTP ${res.statusCode}] ${req.method} ${req.originalUrl} (${duration}ms)`
        ]);
      }
    });
    next();
  });

  // Initialisation des schémas SQLite (utilisateurs et collections LIMS)
  await initDb();
  await initLimsDb();

  // ==========================================
  // 0. Endpoints Console de Logs & Configuration SMTP (Admin uniquement)
  // ==========================================

  app.get('/api/admin/logs', authenticate, (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    res.json({ logs: serverLogs });
  });

  app.delete('/api/admin/logs', authenticate, (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    serverLogs.length = 0;
    console.info(`Journal des logs serveur purgé par l'administrateur (${req.user.email}).`);
    res.json({ success: true });
  });

  /**
   * Récupère la configuration SMTP (Admin uniquement, mot de passe masqué)
   */
  app.get('/api/admin/smtp', authenticate, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    const config = await getSmtpConfig();
    res.json({
      ...config,
      pass: config.pass ? '••••••••' : '',
      hasPassword: Boolean(config.pass)
    });
  });

  /**
   * Sauvegarde la configuration SMTP (Admin uniquement)
   */
  app.post('/api/admin/smtp', authenticate, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    try {
      const current = await getSmtpConfig();
      const { enabled, host, port, secure, user, pass, fromName, fromEmail } = req.body;

      const updated: SmtpConfig = {
        enabled: Boolean(enabled),
        host: typeof host === 'string' ? host.trim() : current.host,
        port: Number(port) || 587,
        secure: Boolean(secure),
        user: typeof user === 'string' ? user.trim() : current.user,
        // Conserve le mot de passe existant si l'admin n'a pas saisi un nouveau mot de passe
        pass: (typeof pass === 'string' && pass !== '••••••••' && pass !== '') ? pass : (pass === '' ? '' : current.pass),
        fromName: typeof fromName === 'string' ? fromName.trim() : current.fromName,
        fromEmail: typeof fromEmail === 'string' ? fromEmail.trim() : current.fromEmail,
      };

      await setCollection('smtpSettings', updated);
      console.info(`Configuration SMTP mise à jour par l'administrateur (${req.user.email}). Service actif: ${updated.enabled}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Erreur lors de la sauvegarde SMTP :', e);
      res.status(500).json({ error: 'Impossible d\'enregistrer la configuration SMTP.' });
    }
  });

  /**
   * Envoie un e-mail de test pour valider les paramètres SMTP (Admin uniquement)
   */
  app.post('/api/admin/smtp/test', authenticate, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    try {
      const targetEmail = (req.body.testEmail || req.user.email || '').trim();
      if (!targetEmail) {
        return res.status(400).json({ error: 'Veuillez renseigner une adresse e-mail destinataire pour le test.' });
      }

      const config = await getSmtpConfig();
      if (!config.host || !config.port) {
        return res.status(400).json({ error: 'Veuillez d\'abord enregistrer l\'hôte et le port du serveur SMTP.' });
      }

      const transporter = nodemailer.createTransport({
        host: config.host.trim(),
        port: Number(config.port),
        secure: Boolean(config.secure),
        auth: config.user ? {
          user: config.user.trim(),
          pass: config.pass,
        } : undefined,
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.verify();

      const fromHeader = config.fromName
        ? `"${config.fromName.replace(/"/g, '')}" <${config.fromEmail || config.user}>`
        : (config.fromEmail || config.user);

      await transporter.sendMail({
        from: fromHeader,
        to: targetEmail,
        subject: '[LIMS] Test de connexion SMTP réussi',
        text: 'Félicitations, votre serveur SMTP est correctement configuré sur votre application LIMS.',
        html: buildHtmlEmailTemplate(
          'Test de configuration SMTP réussi',
          `Votre serveur d'envoi d'e-mails (${config.host}:${config.port}) est parfaitement opérationnel.\nToutes les notifications de l'application LIMS seront désormais acheminées par ce canal.`,
          req.user.name
        ),
      });

      console.info(`[TEST SMTP RÉUSSI] E-mail de test envoyé à ${targetEmail} par ${req.user.email}`);
      res.json({ success: true, message: `E-mail de test envoyé avec succès à ${targetEmail}` });
    } catch (e: any) {
      console.error('Échec du test de connexion SMTP :', e);
      res.status(500).json({ error: `Échec SMTP : ${e.message || 'Erreur de connexion au serveur mail'}` });
    }
  });

  /**
   * Endpoint appelé automatiquement par le Frontend lors de chaque création de notification
   * pour envoyer la notification par e-mail à l'utilisateur concerné.
   */
  app.post('/api/notifications/send-email', authenticate, async (req: AuthRequest, res) => {
    try {
      const { userId, title, message } = req.body;
      if (!userId || !title || !message) {
        return res.status(400).json({ error: 'Paramètres de notification incomplets.' });
      }

      const recipient = await getUserById(userId);
      if (!recipient || !recipient.email) {
        console.warn(`[EMAIL NOTIFICATION] Utilisateur ${userId} introuvable ou sans adresse e-mail.`);
        return res.status(404).json({ error: 'Destinataire introuvable.' });
      }

      const sent = await sendMailViaSmtp(recipient.email, title, message, recipient.name);
      res.json({ success: true, sent });
    } catch (e: any) {
      console.error('Erreur lors de l\'envoi de l\'e-mail de notification :', e);
      res.status(500).json({ error: e.message || 'Erreur lors de l\'envoi de l\'e-mail' });
    }
  });

  // ==========================================
  // 1. Endpoints Sécurisés pour les Collections
  // ==========================================

  /**
   * Récupère le contenu d'une collection métier sérialisée avec filtrage selon le rôle
   */
  app.get('/api/db/:collection', authenticate, async (req: AuthRequest, res) => {
    try {
      const { collection } = req.params;
      if (!ALLOWED_COLLECTIONS.has(collection)) {
        return res.status(400).json({ error: 'Collection non autorisée' });
      }

      const data = await getCollection(collection);
      if (!data || !Array.isArray(data)) {
        return res.json(data || null);
      }

      // Filtrage de confidentialité pour les demandeurs externes
      if (req.user?.role === 'demandeur') {
        if (collection === 'requests') {
          return res.json(data.filter((r: any) => r.requesterId === req.user?.id));
        }
        if (collection === 'notifications') {
          return res.json(data.filter((n: any) => n.userId === req.user?.id));
        }
        if (collection === 'consumables') {
          return res.json([]); // Les clients externes n'ont pas à voir les stocks internes
        }
      }

      res.json(data);
    } catch (e) {
      console.error(`Erreur de lecture de la collection ${req.params.collection}:`, e);
      res.status(500).json({ error: 'Erreur de lecture de la collection' });
    }
  });

  /**
   * Sauvegarde ou met à jour une collection métier avec contrôle d'accès (RBAC & Multi-Tenant)
   */
  app.post('/api/db/:collection', authenticate, async (req: AuthRequest, res) => {
    try {
      const { collection } = req.params;
      const user = req.user!;

      if (!ALLOWED_COLLECTIONS.has(collection)) {
        return res.status(400).json({ error: 'Collection non autorisée' });
      }

      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Format de données invalide (tableau attendu)' });
      }

      // 1. Protection des collections de configuration (CMS & Laboratoires)
      if (MANAGER_ONLY_COLLECTIONS.has(collection) && user.role !== 'manager' && user.role !== 'admin') {
        return res.status(403).json({ error: 'Seul un manager peut modifier la configuration CMS.' });
      }

      // 2. Restriction stricte pour les demandeurs externes
      if (user.role === 'demandeur') {
        if (!REQUESTER_WRITABLE_COLLECTIONS.has(collection)) {
          return res.status(403).json({ error: 'Action non autorisée pour le profil demandeur.' });
        }

        // Fusion sécurisée : un demandeur ne peut pas écraser ou supprimer les données des autres clients
        const existingData = (await getCollection(collection)) || [];
        if (collection === 'requests') {
          const otherUsersRequests = existingData.filter((r: any) => r.requesterId !== user.id);
          const myUpdatedRequests = req.body
            .filter((r: any) => r.requesterId === user.id)
            .map((r: any) => {
              const prev = existingData.find((ex: any) => ex.id === r.id);
              // Empêche un demandeur de s'auto-valider une demande côté client
              if (prev && prev.status !== r.status && r.status !== 'soumise') {
                return { ...r, status: prev.status };
              }
              return r;
            });
          await setCollection(collection, [...myUpdatedRequests, ...otherUsersRequests]);
          return res.json({ success: true });
        }
      }

      // 3. Protection Multi-Tenant pour le personnel rattaché à un laboratoire spécifique
      if ((user.role === 'analyste' || user.role === 'manager') && user.labId && user.labId !== 'all') {
        if (collection !== 'laboratories' && collection !== 'notifications') {
          const existingData = (await getCollection(collection)) || [];
          const otherLabsData = existingData.filter((item: any) => item.labId && item.labId !== user.labId);
          const myLabData = req.body.filter((item: any) => !item.labId || item.labId === user.labId);
          await setCollection(collection, [...myLabData, ...otherLabsData]);
          return res.json({ success: true });
        }
      }

      await setCollection(collection, req.body);
      res.json({ success: true });
    } catch (e) {
      console.error(`Erreur d'écriture de la collection ${req.params.collection}:`, e);
      res.status(500).json({ error: 'Erreur d\'écriture de la collection' });
    }
  });

  // ==========================================
  // 2. Authentification & Gestion des Sessions
  // ==========================================

  /**
   * Connexion utilisateur : vérifie les identifiants avec protection anti-bruteforce
   */
  app.post('/api/auth/login', async (req, res) => {
    try {
      const ip = req.ip || 'unknown';
      if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
        console.warn(`Tentative de connexion bloquée (rate limit) depuis l'IP ${ip}`);
        return res.status(429).json({ error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' });
      }

      const { email, password } = req.body;
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
      }

      const user = await getUserByEmail(email.trim());
      if (!user) {
        console.warn(`Échec de connexion : compte introuvable (${email.trim()})`);
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        console.warn(`Échec de connexion : mot de passe incorrect pour ${email.trim()}`);
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const token = jwt.sign({ id: user.id, role: user.role, labId: user.labId }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, COOKIE_OPTIONS);

      console.info(`Connexion réussie : ${user.name} (${user.email}) [${user.role}]`);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: user.company,
          labId: user.labId
        }
      });
    } catch (error) {
      console.error('Erreur lors du login :', error);
      res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  });

  /**
   * Déconnexion : suppression du cookie de session
   */
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', COOKIE_OPTIONS);
    res.json({ success: true });
  });

  /**
   * Vérification de la session active
   */
  app.get('/api/auth/me', authenticate, async (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  // ==========================================
  // 3. Administration des Utilisateurs
  // ==========================================

  /**
   * Liste les utilisateurs (filtrée selon le rôle de l'appelant)
   */
  app.get('/api/users', authenticate, async (req: AuthRequest, res) => {
    try {
      const caller = req.user!;
      const users = await getUsers();

      // Un demandeur externe n'a pas accès à l'annuaire des utilisateurs et clients
      if (caller.role === 'demandeur') {
        return res.json([caller]);
      }

      // Un analyste ou manager rattaché à un labo voit uniquement son labo, la direction et les demandeurs
      if (caller.role !== 'admin' && caller.labId && caller.labId !== 'all') {
        const filtered = users.filter(u => !u.labId || u.labId === 'all' || u.labId === caller.labId);
        return res.json(filtered);
      }

      res.json(users);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs :', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  });

  /**
   * Création d'un nouvel utilisateur (avec prévention d'escalade de privilèges et notification e-mail)
   */
  app.post('/api/users', authenticate, async (req: AuthRequest, res) => {
    try {
      const caller = req.user!;
      if (caller.role !== 'manager' && caller.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé' });
      }

      const { email, password, name, role, company, labId } = req.body;
      if (!email || !password || password.length < 8 || !name || !role) {
        return res.status(400).json({ error: 'Données invalides (le mot de passe doit contenir au moins 8 caractères).' });
      }

      // Seul un admin peut créer un autre admin
      const allowedRoles = caller.role === 'admin'
        ? ['demandeur', 'analyste', 'manager', 'admin']
        : ['demandeur', 'analyste', 'manager'];

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à attribuer ce rôle.' });
      }

      // Un manager lié à un laboratoire ne peut pas créer du personnel interne pour un autre laboratoire
      const enforcedLabId = (caller.role === 'manager' && caller.labId && caller.labId !== 'all' && role !== 'demandeur')
        ? caller.labId
        : labId;

      const existingUser = await getUserByEmail(email);
      if (existingUser) return res.status(400).json({ error: 'Cet email est déjà utilisé' });

      const id = `usr-${crypto.randomUUID()}`;
      const passwordHash = await bcrypt.hash(password, 10);
      await createUser(id, email, passwordHash, name, role, company, enforcedLabId);

      console.info(`Nouvel utilisateur créé : ${email} (${role}) par ${caller.email}`);

      // Envoi automatique des identifiants par e-mail si SMTP est activé
      sendMailViaSmtp(
        email.trim(),
        'Création de votre compte LIMS',
        `Votre compte d'accès au portail LIMS a été créé.\n\nIdentifiant : ${email.trim()}\nMot de passe temporaire : ${password}\nRôle : ${role}\n\nNous vous invitons à modifier votre mot de passe dès votre première connexion dans l'onglet Paramètres.`,
        name
      ).catch((err) => console.warn('Impossible d\'envoyer l\'e-mail de bienvenue :', err.message));

      res.status(201).json({ success: true, user: { id, email, name, role, company, labId: enforcedLabId } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
    }
  });

  // ==========================================
  // 4. Gestion des Mots de Passe & Réinitialisation
  // ==========================================

  /**
   * Changement de mot de passe autonome par l'utilisateur connecté
   */
  app.post('/api/auth/change-password', authenticate, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      }

      const user = await getUserById(req.user!.id);
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

      const newHash = await bcrypt.hash(newPassword, 10);
      await updatePassword(user.id, newHash);
      res.json({ success: true });
    } catch (error) {
      console.error('Erreur changement de mot de passe :', error);
      res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
  });

  /**
   * Demande de réinitialisation de mot de passe oublié (envoi via SMTP si actif)
   */
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const ip = req.ip || 'unknown';
      if (!checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Trop de demandes. Veuillez patienter 15 minutes.' });
      }

      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email requis' });
      }

      const user = await getUserByEmail(email.trim());
      if (!user) {
        return res.json({ success: true, message: 'Si l\'email existe, un code a été envoyé.' });
      }

      // Génération cryptographiquement sûre d'un code à 6 chiffres
      const code = crypto.randomInt(100000, 1000000).toString();
      const expiry = Date.now() + 15 * 60 * 1000; // Valable 15 minutes

      await createResetToken(email.trim(), code, expiry);
      otpFailedAttempts.delete(email.trim());

      // Envoi réel via SMTP si configuré
      sendMailViaSmtp(
        email.trim(),
        'Code de réinitialisation de votre mot de passe',
        `Vous avez demandé la réinitialisation de votre mot de passe LIMS.\n\nVotre code de vérification à 6 chiffres est : ${code}\n\nCe code est valable pendant 15 minutes.`,
        user.name
      ).catch((err) => console.error('Erreur envoi mail code reset :', err.message));

      if (!IS_PROD) {
        console.log(`[CODE RESET MOT DE PASSE] Pour ${email} : ${code}`);
      }

      res.json({ success: true, message: 'Si l\'email existe, un code a été envoyé.' });
    } catch (error) {
      console.error('Erreur forgot-password :', error);
      res.status(500).json({ error: 'Erreur système' });
    }
  });

  /**
   * Validation du code reçu avec révocation automatique au bout de 3 échecs
   */
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const ip = req.ip || 'unknown';
      if (!checkRateLimit(`reset:${ip}`, 10, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Trop de tentatives. Veuillez patienter 15 minutes.' });
      }

      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Paramètres invalides ou mot de passe trop court (8 caractères min).' });
      }

      const cleanEmail = email.trim();
      const resetRecord = await getResetToken(cleanEmail);

      if (!resetRecord || Date.now() > resetRecord.expiry) {
        await deleteResetToken(cleanEmail);
        return res.status(400).json({ error: 'Code invalide ou expiré' });
      }

      // Protection contre le bruteforce du code à 6 chiffres (max 3 essais)
      if (resetRecord.token !== code) {
        const attempts = (otpFailedAttempts.get(cleanEmail) || 0) + 1;
        otpFailedAttempts.set(cleanEmail, attempts);
        if (attempts >= 3) {
          await deleteResetToken(cleanEmail);
          otpFailedAttempts.delete(cleanEmail);
          return res.status(400).json({ error: 'Code révoqué suite à trop de tentatives erronées.' });
        }
        return res.status(400).json({ error: 'Code invalide ou expiré' });
      }

      const user = await getUserByEmail(cleanEmail);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

      const newHash = await bcrypt.hash(newPassword, 10);
      await updatePassword(user.id, newHash);
      await deleteResetToken(cleanEmail);
      otpFailedAttempts.delete(cleanEmail);

      res.json({ success: true });
    } catch (error) {
      console.error('Erreur reset-password :', error);
      res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
  });

  // ==========================================
  // 5. Demandes de Création de Comptes (Portail)
  // ==========================================

  app.post('/api/auth/request-account', async (req, res) => {
    try {
      const ip = req.ip || 'unknown';
      if (!checkRateLimit(`req-account:${ip}`, 5, 60 * 60 * 1000)) {
        return res.status(429).json({ error: 'Trop de demandes envoyées. Veuillez réessayer plus tard.' });
      }

      const { name, email, company, message } = req.body;
      if (!name || !email) return res.status(400).json({ error: 'Nom et email obligatoires.' });

      const existingUser = await getUserByEmail(email.trim());
      if (existingUser) return res.status(400).json({ error: 'Un compte existe déjà avec cet email.' });

      const id = `req-${crypto.randomUUID()}`;
      await createAccountRequest(id, name.trim(), email.trim(), company || '', message || '');
      console.info(`Nouvelle demande de compte déposée par ${name.trim()} (${email.trim()})`);
      res.json({ success: true, message: 'Votre demande a été envoyée. Un manager la traitera prochainement.' });
    } catch (error) {
      console.error('Erreur request-account :', error);
      res.status(500).json({ error: 'Erreur lors de l\'envoi de la demande.' });
    }
  });

  app.get('/api/users/requests', authenticate, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé' });
      }
      const requests = await getAccountRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.delete('/api/users/requests/:id', authenticate, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé' });
      }
      await deleteAccountRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.delete('/api/users/:id', authenticate, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé. Seul un administrateur peut supprimer un utilisateur.' });
      }
      const userIdToDelete = req.params.id;
      if (req.user!.id === userIdToDelete) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
      }
      await deleteUser(userIdToDelete);
      console.info(`Utilisateur ${userIdToDelete} supprimé par l'admin ${req.user!.email}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
    }
  });

  // ==========================================
  // 6. Service de Conversion Word vers PDF (Authentifié & Isolé)
  // ==========================================

  /** Cache mémoire temporaire rattaché à l'utilisateur qui a généré le PDF */
  const tempPdfs = new Map<string, { buffer: Buffer; timestamp: number; ownerId: string; labId?: string | null }>();
  let activePdfConversions = 0;
  const MAX_CONCURRENT_CONVERSIONS = 2;

  /**
   * Visualisation d'un PDF temporaire (authentification et contrôle propriétaire requis)
   */
  app.get('/api/temp-pdf/:id', authenticate, (req: AuthRequest, res) => {
    const pdf = tempPdfs.get(req.params.id);
    if (!pdf) return res.status(404).send('Document PDF introuvable ou expiré');

    const user = req.user!;
    const isOwner = pdf.ownerId === user.id;
    const isSameLab = user.role !== 'demandeur' && (user.labId === 'all' || !user.labId || user.labId === pdf.labId);

    if (!isOwner && !isSameLab && user.role !== 'admin') {
      return res.status(403).send('Accès refusé à ce document PDF');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="rapport_previsualisation.pdf"');
    res.send(pdf.buffer);
  });

  /**
   * Conversion Word (.docx) vers PDF (authentifiée et protégée contre la saturation CPU/RAM)
   */
  app.post('/api/convert-pdf', authenticate, async (req: AuthRequest, res) => {
    if (activePdfConversions >= MAX_CONCURRENT_CONVERSIONS) {
      return res.status(503).json({ error: 'Service de conversion occupé, veuillez réessayer dans quelques secondes.' });
    }

    try {
      const { docxBase64 } = req.body;
      if (!docxBase64 || typeof docxBase64 !== 'string') {
        return res.status(400).json({ error: 'Document Word base64 manquant' });
      }

      const docxBuf = Buffer.from(docxBase64, 'base64');
      // Vérification minimale de la signature ZIP/DOCX (PK\x03\x04) et de la taille (max 15 Mo)
      if (docxBuf.length > 15 * 1024 * 1024 || docxBuf.length < 4 || docxBuf[0] !== 0x50 || docxBuf[1] !== 0x4b) {
        return res.status(400).json({ error: 'Fichier DOCX invalide ou trop volumineux (max 15 Mo).' });
      }

      activePdfConversions++;
      const pdfBuf = await libreConvertAsync(docxBuf, '.pdf', undefined);

      const id = crypto.randomUUID();
      tempPdfs.set(id, {
        buffer: pdfBuf,
        timestamp: Date.now(),
        ownerId: req.user!.id,
        labId: req.user!.labId
      });

      // Purge des fichiers temporaires conservés depuis plus d'une heure
      for (const [key, value] of tempPdfs.entries()) {
        if (Date.now() - value.timestamp > 3600000) tempPdfs.delete(key);
      }

      res.json({
        pdfBase64: pdfBuf.toString('base64'),
        pdfUrl: `/api/temp-pdf/${id}`
      });
    } catch (error) {
      console.error('Erreur lors de la conversion PDF :', error);
      res.status(500).json({ error: 'Erreur lors de la génération du document PDF' });
    } finally {
      activePdfConversions = Math.max(0, activePdfConversions - 1);
    }
  });

  // ==========================================
  // 7. Middleware Vite & Distribution SPA
  // ==========================================

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur LIMS démarré et accessible sur http://localhost:${PORT}`);
  });
}

startServer();