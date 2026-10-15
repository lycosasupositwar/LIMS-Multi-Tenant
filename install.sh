#!/bin/bash
# Arrête le script à la moindre erreur
set -e

echo "========================================="
echo "   Installation complète du système      "
echo "========================================="

echo ""
echo "[1/5] Vérification et installation des prérequis (Node.js v22+ & npm)..."

SUDO=''
if (( $EUID != 0 )); then
    SUDO='sudo'
fi

# Fonction pour vérifier si Node.js est installé et au moins en version 22
check_node_version() {
    if command -v node &> /dev/null; then
        local NODE_VERSION=$(node -v | grep -oE '^v[0-9]+' | sed 's/v//')
        if [ "$NODE_VERSION" -ge 22 ]; then
            return 0
        fi
    fi
    return 1
}

if ! check_node_version; then
    echo "Node.js v22+ n'est pas installé ou la version est trop ancienne. Installation en cours..."
    
    if command -v apt-get &> /dev/null; then
        # Utilisation de -qq pour rendre l'update silencieux et éviter les erreurs d'arguments
        $SUDO apt-get update -qq \vert{}\vert{} true$SUDO apt-get install -y curl ca-certificates
        curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash -$SUDO apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        $SUDO yum install -y curl ca-certificates
        curl -fsSL https://rpm.nodesource.com/setup_22.x | $SUDO bash -$SUDO yum install -y nodejs
    elif command -v apk &> /dev/null; then
        $SUDO apk add --no-cache curl nodejs npm
    else
        echo "Erreur : Gestionnaire de paquets non reconnu. Veuillez installer Node.js v22+ manuellement."
        exit 1
    fi
else
    echo "Node.js v22+ et npm sont déjà installés."
fi

# Vérification finale pour s'assurer que npm est bien disponible avant de continuer
if ! command -v npm &> /dev/null; then
    echo "Erreur fatale : npm n'a pas pu être installé."
    exit 1
fi

echo ""
echo "[2/5] Installation des dépendances NPM..."
npm install

echo ""
echo "[3/5] Configuration des variables d'environnement..."
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
echo "[4/5] Configuration du Super Administrateur"
read -p "Email de l'administrateur [admin@admin.com] : " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@admin.com}

read -p "Mot de passe [admin123] : " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}

read -p "Nom de l'administrateur [Super Administrateur] : " ADMIN_NAME
ADMIN_NAME=${ADMIN_NAME:-Super Administrateur}

echo ""
echo "[5/5] Création du compte dans la base de données..."

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

# Utilisation de tsx (installé dans node_modules) pour pouvoir importer le TS
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
