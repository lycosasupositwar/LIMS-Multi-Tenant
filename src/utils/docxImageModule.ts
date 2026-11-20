/**
 * Module d'Injection d'Images Dynamiques pour Modèles Word (.docx)
 *
 * Support des images intégrées dans les modèles Word (.docx) via `docxtemplater`.
 * Nécessite le paquet `docxtemplater-image-module-free`.
 * Les images de micrographie ou les clichés d'essais sont enregistrés sous forme
 * de Data URL (`data:image/jpeg;base64,...` ou `data:image/png;base64,...`).
 * Ce module décode le flux binaire et inspecte les en-têtes binaires (PNG IHDR / JPEG SOF)
 * pour calculer automatiquement un redimensionnement homothétique adapté à une page A4.
 */

// @ts-ignore - le module image ne fournit pas toujours de types TypeScript.
import ImageModule from 'docxtemplater-image-module-free';

/**
 * Décode une chaîne Data URL ou Base64 brute en tableau d'octets `Uint8Array`.
 *
 * @param value Chaîne base64 ou Data URL issue d'un champ image/micrographie
 * @returns Octets de l'image ou tableau vide si la valeur est absente/invalide
 */
const decodeDataUrl = (value: unknown): Uint8Array => {
  if (typeof value !== 'string' || !value) return new Uint8Array();
  // Retire le préfixe MIME "data:image/...;base64," s'il est présent
  const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * Extrait les dimensions natives (largeur et hauteur en pixels) directement
 * depuis les octets d'en-tête d'une image PNG ou JPEG, sans passer par un élément DOM `<img>`
 * (car `docxtemplater` exige une résolution synchrone des dimensions dans `getSize`).
 *
 * @param bytes Tableau d'octets de l'image décodée
 * @returns Dimensions `{ width, height }` en pixels (repli 1200x800 si format non reconnu)
 */
const readDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  // PNG : signature magique 89 50 4E 47, largeur/hauteur codées en Big-Endian dans le bloc IHDR aux offsets 16 et 20.
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG : signature FF D8, parcours séquentiel des marqueurs jusqu'au segment SOF (Start Of Frame) contenant les dimensions.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      // Marqueurs SOF0 à SOF15 (hors DHT 0xC4, JPG 0xC8 et DAC 0xCC)
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  // Dimensions par défaut si le format binaire n'est ni PNG ni JPEG standard
  return { width: 1200, height: 800 };
};

/**
 * Instancie et configure le plugin `ImageModule` pour `Docxtemplater`.
 * Les balises d'image dans le modèle Word doivent être préfixées par `%` (ex: `{%image}`).
 *
 * @returns Instance configurée de `ImageModule`
 */
export const createDocxImageModule = () => new ImageModule({
  // Fournit le flux binaire de l'image à insérer dans l'archive ZIP (.docx)
  getImage: (tagValue: unknown) => decodeDataUrl(tagValue),
  // Calcule la taille d'affichage dans le document Word en conservant le ratio d'aspect
  getSize: (_image: Uint8Array, tagValue: unknown) => {
    const { width, height } = readDimensions(decodeDataUrl(tagValue));
    const maxWidth = 420;  // Largeur maximale en points (env. 14.8 cm, adaptée à la largeur utile d'une page A4)
    const maxHeight = 300; // Hauteur maximale en points (env. 10.5 cm)
    const ratio = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
    return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
  },
});
