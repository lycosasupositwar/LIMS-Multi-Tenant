// Support des images intégrées dans les modèles Word (.docx).
// Nécessite le paquet `docxtemplater-image-module-free`.
// Les images de micrographie sont enregistrées sous forme de data URL JPEG.
// Le module accepte aussi les PNG/JPEG en base64.
// @ts-ignore - le module image ne fournit pas toujours de types TypeScript.
import ImageModule from 'docxtemplater-image-module-free';

const decodeDataUrl = (value: unknown): Uint8Array => {
  if (typeof value !== 'string' || !value) return new Uint8Array();
  const base64 = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const readDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  // PNG: largeur/hauteur dans IHDR, offsets 16 et 20.
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: parcours des marqueurs jusqu'au segment SOF contenant les dimensions.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
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
  return { width: 1200, height: 800 };
};

export const createDocxImageModule = () => new ImageModule({
  getImage: (tagValue: unknown) => decodeDataUrl(tagValue),
  getSize: (_image: Uint8Array, tagValue: unknown) => {
    const { width, height } = readDimensions(decodeDataUrl(tagValue));
    const maxWidth = 420;  // points, adapté à la largeur utile d'une page A4
    const maxHeight = 300;
    const ratio = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
    return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
  },
});
