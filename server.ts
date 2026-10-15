/**
 * Serveur Backend Express & Passerelle API LIMS
 * 
 * Ce fichier constitue le point d'entrée du serveur backend. Il expose :
 * - L'authentification par cookies de session sécurisés (JWT + HttpOnly)
 * - Les endpoints CRUD pour les collections métier synchronisées (SQLite)
 * - La gestion des habilitations utilisateurs et des demandes d'accès
 * - Le service de conversion documentaire Word -> PDF via LibreOffice
 * - L'intégration du middleware Vite en développement et le routage SPA en production
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
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

/** Clé secrète pour la signature cryptographique des jetons JWT */
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-pour-le-developpement-local';

/**
 * Extension de la requête Express pour inclure les données du payload JWT
 */
interface AuthRequest extends Request {
  user?: any;
}

/**
 * Middleware d'authentification vérifiant la validité du cookie de session JWT.
 * Bloque l'accès avec un code 401 si le cookie est absent ou si la signature est invalide.
 */
const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session invalide' });
  }
};

/**
 * Démarre et configure l'application Express ainsi que les bases de données.
 */
async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configuration des analyseurs de corps de requête et des cookies
  // Taille maximale de 50 Mo pour accepter les clichés micrographiques et modèles volumineux
  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Initialisation des schémas SQLite (utilisateurs et collections LIMS)
  await initDb();
  await initLimsDb();

  // ==========================================
  // 1. Endpoints Génériques pour les Collections
  // ==========================================

  /**
   * Récupère le contenu d'une collection métier sérialisée (échantillons, analyses, etc.)
   */
  app.get('/api/db/:collection', authenticate, async (req: AuthRequest, res) => {
    try {
      const data = await getCollection(req.params.collection);
      res.json(data || null);
    } catch (e) {
      res.status(500).json({ error: 'Erreur de lecture de la collection' });
    }
  });

  /**
   * Sauvegarde ou met à jour une collection métier complète
   */
  app.post('/api/db/:collection', authenticate, async (req: AuthRequest, res) => {
    try {
      console.log('Enregistrement de la collection :', req.params.collection, req.body?.length ?? 'objet');
      await setCollection(req.params.collection, req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Erreur d\'écriture de la collection' });
    }
  });

  // ==========================================
  // 2. Authentification & Gestion des Sessions
  // ==========================================

  /**
   * Connexion utilisateur : vérifie les identifiants et dépose un cookie HTTP-only
   */
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await getUserByEmail(email); 

      console.log('Tentative de connexion pour :', email);
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Comparaison du mot de passe fourni avec le condensat bcrypt
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Génération du jeton JWT valable 24h
      const token = jwt.sign({ id: user.id, role: user.role, labId: user.labId }, JWT_SECRET, { expiresIn: '24h' });
      
      // Dépôt du cookie sécurisé
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
      });

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
    res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ success: true });
  });

  /**
   * Vérification de la session active et renvoi des informations de l'utilisateur connecté
   */
  app.get('/api/auth/me', authenticate, async (req: AuthRequest, res) => {
    try {
      const user = await getUserById(req.user.id);
      if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
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
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ==========================================
  // 3. Administration des Utilisateurs
  // ==========================================

  /**
   * Liste l'ensemble des utilisateurs du système (réservé aux utilisateurs authentifiés)
   */
  app.get('/api/users', authenticate, async (req: AuthRequest, res) => {
    try {
      const users = await getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
  });

  /**
   * Création d'un nouvel utilisateur (restreinte au rôle 'manager')
   */
  app.post('/api/users', authenticate, async (req: AuthRequest, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé' });
      }
      
      const { email, password, name, role, company, labId } = req.body;
      const existingUser = await getUserByEmail(email);
      if (existingUser) return res.status(400).json({ error: 'Cet email est déjà utilisé' });

      const id = `usr-${Date.now()}`;
      const passwordHash = await bcrypt.hash(password, 10);
      await createUser(id, email, passwordHash, name, role, company, labId);
      
      res.status(201).json({ success: true, user: { id, email, name, role, company, labId } });
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
      const user = await getUserById(req.user.id);
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
   * Demande de réinitialisation de mot de passe oublié : génère un code à 6 chiffres
   */
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      const user = await getUserByEmail(email); 
      if (!user) {
        // Réponse générique pour éviter l'énumération des emails d'utilisateurs
        return res.json({ success: true, message: 'Si l\'email existe, un code a été envoyé.' });
      }

      // Génération d'un code numérique aléatoire à 6 chiffres
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 15 * 60 * 1000; // Valable 15 minutes
      
      await createResetToken(email, code, expiry);
      console.log(`[SIMULATION EMAIL] Code de réinitialisation pour ${email} : ${code}`);
      
      // En environnement de test/développement, on transmet le code pour simplifier les essais
      res.json({ success: true, message: 'Code généré avec succès', _devCode: code });
    } catch (error) {
      res.status(500).json({ error: 'Erreur système' });
    }
  });

  /**
   * Validation du code reçu et enregistrement du nouveau mot de passe
   */
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      const resetRecord = await getResetToken(email);
      
      if (!resetRecord || resetRecord.token !== code) {
        return res.status(400).json({ error: 'Code invalide ou expiré' });
      }
      if (Date.now() > resetRecord.expiry) {
        await deleteResetToken(email);
        return res.status(400).json({ error: 'Code expiré' });
      }

      const user = await getUserByEmail(email); 
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

      const newHash = await bcrypt.hash(newPassword, 10);
      await updatePassword(user.id, newHash);
      await deleteResetToken(email);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
  });

  // ==========================================
  // 5. Demandes de Création de Comptes (Portail)
  // ==========================================

  /**
   * Envoi d'une demande de compte par un demandeur externe
   */
  app.post('/api/auth/request-account', async (req, res) => {
    try {
      const { name, email, company, message } = req.body;
      const existingUser = await getUserByEmail(email);
      if (existingUser) return res.status(400).json({ error: 'Un compte existe déjà avec cet email.' });

      const id = `req-${Date.now()}`;
      await createAccountRequest(id, name, email, company || '', message || '');
      res.json({ success: true, message: 'Votre demande a été envoyée. Un manager la traitera prochainement.' });
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de l\'envoi de la demande.' });
    }
  });

  /**
   * Consultation des demandes de création de compte (manager uniquement)
   */
  app.get('/api/users/requests', authenticate, async (req: AuthRequest, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
      const requests = await getAccountRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Traitement ou suppression d'une demande de compte
   */
  app.delete('/api/users/requests/:id', authenticate, async (req: AuthRequest, res) => {
    try {
      if (req.user.role !== 'manager' && req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
      await deleteAccountRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.delete('/api/users/:id', authenticate, async (req: AuthRequest, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé. Seul un administrateur peut supprimer un utilisateur.' });
      const userIdToDelete = req.params.id;
      if (req.user.id === userIdToDelete) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
      }
      await deleteUser(userIdToDelete);
      res.json({ success: true });
    } catch (error) {
      console.error('Erreur lors de la suppression de l utilisateur:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
    }
  });

  // ==========================================
  // 6. Service de Conversion Word vers PDF
  // ==========================================

  /** Cache mémoire temporaire pour servir les PDF générés */
  const tempPdfs = new Map<string, { buffer: Buffer; timestamp: number }>();

  /**
   * Permet à l'interface client de visualiser directement un PDF généré via son URL temporaire
   */
  app.get('/api/temp-pdf/:id', (req, res) => {
    const pdf = tempPdfs.get(req.params.id);
    if (!pdf) return res.status(404).send('Document PDF introuvable ou expiré');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="rapport_previsualisation.pdf"');
    res.send(pdf.buffer);
  });

  /**
   * Reçoit un document Word (.docx) encodé en base64, le convertit au format PDF
   * à l'aide du binaire LibreOffice headless, et stocke le résultat dans le cache temporaire.
   */
  app.post('/api/convert-pdf', async (req, res) => {
    try {
      const { docxBase64 } = req.body;
      if (!docxBase64) return res.status(400).json({ error: 'Document Word base64 manquant' });
      
      const docxBuf = Buffer.from(docxBase64, 'base64');
      const pdfBuf = await libreConvertAsync(docxBuf, '.pdf', undefined);
      
      const id = crypto.randomUUID();
      tempPdfs.set(id, { buffer: pdfBuf, timestamp: Date.now() });
      
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
    }
  });

  // ==========================================
  // 7. Middleware Vite & Distribution SPA
  // ==========================================

  if (process.env.NODE_ENV !== "production") {
    // Mode développement : raccordement du serveur de développement Vite à Express
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Mode production : service des fichiers statiques compilés dans dist/
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Démarrage de l'écoute réseau sur toutes les interfaces (0.0.0.0) sur le port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur LIMS démarré et accessible sur http://localhost:${PORT}`);
  });
}

// Lancement effectif du serveur
startServer();
