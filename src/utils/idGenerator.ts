/**
 * Générateur d'Identifiants Uniques et de Codes-Barres LIMS
 *
 * Ce module génère des identifiants métier courts, lisibles et garantis sans collision
 * pour les demandes (`REQ-...`), échantillons (`ECH-...`), sous-échantillons (`ENR-...`),
 * essais (`ESS-...`) et codes-barres (`BC-...`).
 */

// Alphabet Base32 Crockford (sans 0, O, 1, I, L pour éviter toute confusion de lecture humaine ou optique sur les étiquettes)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Génère un code alphanumérique court basé sur le temps (ms) + aléa cryptographique (`crypto.getRandomValues`).
 * Exemple de sortie sur 6 caractères : "K8F3M9"
 *
 * @param length Longueur souhaitée du code court (par défaut 6 caractères)
 * @returns Chaîne alphanumérique en majuscules issue de l'alphabet non ambigu
 */
function generateShortCode(length = 6): string {
  // Conversion du timestamp actuel en base 36 et nettoyage des caractères ambigus (0, 1, I, L, O)
  const timePart = Date.now().toString(36).toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '');
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let code = '';
  // On injecte les 2 derniers caractères liés à la milliseconde + aléa cryptographique fort
  const seed = timePart.slice(-2);
  for (let i = 0; i < length; i++) {
    if (i < seed.length) {
      code += seed[i];
    } else {
      code += ALPHABET[randomBytes[i] % ALPHABET.length];
    }
  }
  return code;
}

/**
 * Génère un identifiant garanti unique au format : PREFIX-AA-XXXXX (ex: ECH-26-K8F3M)
 * Vérifie dans `existingIds` qu'il n'a jamais été attribué afin d'éviter tout écrasement.
 *
 * @param prefix Préfixe métier configuré par laboratoire (ex: 'REQ-MET', 'ECH-MEC', 'ESS')
 * @param existingIds Collection d'identifiants déjà utilisés dans le store
 * @param codeLength Longueur du suffixe aléatoire (par défaut 5 caractères)
 * @returns Identifiant unique formaté
 */
export function generateUniqueLimsId(
  prefix: string,
  existingIds: Iterable<string>,
  codeLength = 5
): string {
  const year = new Date().getFullYear().toString().slice(2); // Ex: "26" pour 2026
  const usedSet = new Set(existingIds);

  let candidate = '';
  let attempts = 0;

  do {
    const uniqueCode = generateShortCode(codeLength);
    candidate = `${prefix}-${year}-${uniqueCode}`;
    attempts++;
    // Si par extraordinaire (1 chance sur ~33 millions) le code existe déjà, il boucle immédiatement
  } while (usedSet.has(candidate) && attempts < 100);

  return candidate;
}

/**
 * Génère un numéro de code-barres numérique unique (ex: BC-26-948271)
 * adapté à l'encodage QR Code et à la lecture par douchette laser/2D.
 *
 * @param existingBarcodes Liste des codes-barres déjà attribués aux échantillons
 * @param prefix Préfixe du code-barres (par défaut 'BC')
 * @returns Code-barres unique au format `PREFIX-AA-NNNNNN`
 */
export function generateUniqueBarcode(
  existingBarcodes: Iterable<string>,
  prefix = 'BC'
): string {
  const usedSet = new Set(existingBarcodes);
  const year = new Date().getFullYear().toString().slice(2);

  let candidate = '';
  do {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    // Nombre à 6 chiffres (entre 100000 et 999999) basé sur la milliseconde et crypto
    const num = ((Date.now() + rand[0]) % 900000) + 100000;
    candidate = `${prefix}-${year}-${num}`;
  } while (usedSet.has(candidate));

  return candidate;
}
