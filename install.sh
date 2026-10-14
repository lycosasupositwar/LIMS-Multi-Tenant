#!/bin/bash
echo "========================================="
echo "   Installation complète du système      "
echo "========================================="

echo ""
echo "[1/4] Installation des dépendances NPM..."
npm install

echo ""
echo "[2/4] Configuration des variables d'environnement..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Fichier .env copié depuis .env.example."
  else
    echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" > .env
    echo "PORT=3000" >> .env
    echo "Fichier .env généré avec un JWT_SECRET sécurisé."
  fi
else
  echo "Le fichier .env existe déjà."
fi

echo ""
echo "[3/4] Configuration du Super Administrateur"
read -p "Email de l'administrateur [admin@admin.com] : " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@admin.com}

read -p "Mot de passe [admin123] : " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}

read -p "Nom de l'administrateur [Super Administrateur] : " ADMIN_NAME
ADMIN_NAME=${ADMIN_NAME:-Super Administrateur}

echo ""
echo "[4/4] Création du compte dans la base de données..."

cat << 'JS_EOF' > temp-admin-setup.js
import { initDb, getDb } from './src/db/auth.js';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4];

  await initDb();
  const db = getDb();

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  const passwordHash = await bcrypt.hash(password, 10);

  if (existingUser) {
    db.prepare('UPDATE users SET passwordHash = ?, name = ?, role = ?, labId = ?, company = ? WHERE email = ?').run(
      passwordHash, name, 'admin', 'all', 'Administration Système', email
    );
    console.log(`Compte existant mis à jour avec les droits admin : ${email}`);
  } else {
    const id = `usr-admin-${Date.now()}`;
    db.prepare('INSERT INTO users (id, email, passwordHash, name, role, company, labId) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, email, passwordHash, name, 'admin', 'Administration Système', 'all'
    );
    console.log(`Nouveau compte super administrateur créé : ${email}`);
  }
}

createAdmin().catch(err => {
  console.error("Erreur :", err);
  process.exit(1);
});
JS_EOF

# Utilisation de tsx (installé dans node_modules) pour pouvoir importer le TS si nécessaire
npx tsx temp-admin-setup.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_NAME"
rm temp-admin-setup.js

echo ""
echo "========================================="
echo "Installation terminée avec succès !"
echo "Vous pouvez vous connecter avec :"
echo "  Email : $ADMIN_EMAIL"
echo "  Mot de passe : $ADMIN_PASSWORD"
echo "========================================="
echo "Pour démarrer le serveur, lancez : npm run dev"
