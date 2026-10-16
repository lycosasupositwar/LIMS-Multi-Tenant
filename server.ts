/**
 * Serveur Backend Express & Passerelle API LIMS (Version Sécurisée)
 * 
 * Ce fichier constitue le point d'entrée du serveur backend. Il expose :
 * - L'authentification par cookies de session sécurisés (JWT + HttpOnly + SameSite Lax)
 * - Une protection anti-bruteforce sur les routes sensibles
 * - Les endpoints CRUD pour les collections métier avec contrôle d'accès par rôle (RBAC)
 * - La gestion cloisonnée des habilitations utilisateurs et des demandes d'accès
 * - Le service de conversion documentaire Word -> PDF authentifié et limité en concurrence
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

/** 
 * Clé secrète pour la signature cryptographique des jetons JWT.
 * En production, l'absence de variable d'environnement bloque le démarrage.
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

  // Initialisation des schémas SQLite (utilisateurs et collections LIMS)
  await initDb();
  await initLimsDb();

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
        return res.status(429).json({ error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' });
      }

      const { email, password } = req.body;
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
      }

      const user = await getUserByEmail(email.trim()); 
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const token = jwt.sign({ id: user.id, role: user.role, labId: user.labId }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, COOKIE_OPTIONS);

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
      res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  });

  /**
   * Création d'un nouvel utilisateur (avec prévention d'escalade de privilèges)
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
      res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
  });

  /**
   * Demande de réinitialisation de mot de passe oublié (SANS fuite de _devCode)
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

      if (!IS_PROD) {
        console.log(`[SIMULATION EMAIL DEV] Code de réinitialisation pour ${email} : ${code}`);
      }
      
      // Correctif : _devCode n'est jamais exposé dans la réponse HTTP
      res.json({ success: true, message: 'Si l\'email existe, un code a été envoyé.' });
    } catch (error) {
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
      res.json({ success: true, message: 'Votre demande a été envoyée. Un manager la traitera prochainement.' });
    } catch (error) {
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
