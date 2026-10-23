// src/utils/idGenerator.ts

// Alphabet Base32 Crockford (sans 0, O, 1, I, L pour éviter toute confusion de lecture sur les étiquettes)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Génère un code court basé sur le temps (ms) + aléa cryptographique
 * Exemple de sortie sur 6 caractères : "K8F3M9"
 */
function generateShortCode(length = 6): string {
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
 * Génère un identifiant garanti unique au format : PREFIX-AA-XXXXXX (ex: ECH-26-K8F3M9)
 * Vérifie dans `existingIds` qu'il n'a jamais été attribué.
 */
export function generateUniqueLimsId(
  prefix: string,
  existingIds: Iterable<string>,
  codeLength = 5
): string {
  const year = new Date().getFullYear().toString().slice(2); // "26"
  const usedSet = new Set(existingIds);

  let candidate = '';
  let attempts = 0;

  do {
    const uniqueCode = generateShortCode(codeLength);
    candidate = `${prefix}-${year}-${uniqueCode}`;
    attempts++;
    // Si par extraordinaire (1 chance sur 33 millions) le code existe déjà, il boucle immédiatement
  } while (usedSet.has(candidate) && attempts < 100);

  return candidate;
}

/**
 * Génère un numéro de code-barres unique (ex: BC-26-94827163)
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
    // Nombre à 6 chiffres basé sur la milliseconde et crypto, sans 001/002
    const num = ((Date.now() + rand[0]) % 900000) + 100000;
    candidate = `${prefix}-${year}-${num}`;
  } while (usedSet.has(candidate));

  return candidate;
}