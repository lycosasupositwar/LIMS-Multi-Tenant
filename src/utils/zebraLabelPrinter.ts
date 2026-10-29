/**
 * Utilitaire d'impression d'étiquettes Échantillons (Imprimantes Thermiques Zebra & ZPL) - Format 70x37mm
 */

import { Sample } from '../types';

export interface LabelPrintData {
  sample: Sample;
  materialName: string;
  labCode?: string;
}

/**
 * 1. Génère le code natif ZPL II (Zebra Programming Language) pour étiquettes 70x37mm (203 dpi)
 * Largeur 70mm (~560 dots) x Hauteur 37mm (~296 dots) à 203 dpi
 */
export function generateZplForSamples(items: LabelPrintData[]): string {
  return items
    .map(({ sample, materialName, labCode }) => {
      const dateStr = new Date(sample.receivedAt).toLocaleDateString('fr-FR');
      const reqRef = sample.requestId || 'INDEPENDANT';
      const cleanClient = (sample.client || '').substring(0, 28);
      const cleanProject = (sample.project || '').substring(0, 32);
      const cleanMat = `${materialName} (${sample.materialState})`.substring(0, 32);

      return [
        '^XA',
        '^CI28', // Encodage UTF-8 pour les accents français
        '^PW560', // Largeur 70mm à 203 dpi (8 dots/mm = 560 dots)
        '^LL296', // Hauteur 37mm à 203 dpi (296 dots)
        '^LH0,0',

        // QR Code à gauche (agrandi pour un meilleur scan)
        '^FO20,25^BQN,2,5^FDQA,' + sample.barcode + '^FS',
        '^FO20,195^A0N,18,18^FD' + sample.barcode + '^FS',

        // Informations textuelles à droite du QR Code
        '^FO180,20^A0N,28,28^FD' + sample.id + '^FS',
        '^FO460,20^A0N,22,22^FD[' + (labCode || 'LIMS') + ']^FS',
        '^FO180,55^GB360,2,2^FS', // Ligne de séparation

        '^FO180,68^A0N,22,22^FDDem: ' + reqRef + '^FS',
        '^FO180,98^A0N,22,22^FDCli: ' + cleanClient + '^FS',
        '^FO180,128^A0N,20,20^FDPrj: ' + cleanProject + '^FS',
        '^FO180,154^A0N,20,20^FDMat: ' + cleanMat + '^FS',
        '^FO180,184^A0N,18,18^FDRec: ' + dateStr + ' | Prio: ' + sample.priority.toUpperCase() + '^FS',

        '^XZ'
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * 2. Ouvre une fenêtre d'impression calibrée pour rouleau d'étiquettes Zebra 70mm x 37mm
 */
export function printZebraLabelsWindow(items: LabelPrintData[]) {
  if (items.length === 0) return;

  const printWin = window.open('', '_blank', 'width=700,height=600');
  if (!printWin) {
    alert('Veuillez autoriser les pop-ups pour imprimer les étiquettes.');
    return;
  }

  const labelsHtml = items
    .map(({ sample, materialName, labCode }) => {
      const dateStr = new Date(sample.receivedAt).toLocaleDateString('fr-FR');
      // QR code dimensionné pour le format 70x37
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(
        sample.barcode
      )}`;

      return `
        <div class="zebra-label">
          <div class="qr-col">
            <img src="${qrUrl}" alt="QR ${sample.barcode}" class="qr-img" />
            <div class="barcode-text">${sample.barcode}</div>
          </div>
          <div class="info-col">
            <div class="header-row">
              <span class="sample-id">${sample.id}</span>
              <span class="lab-badge">${labCode || 'LIMS'}</span>
            </div>
            <div class="meta-line"><strong>Dem :</strong> ${sample.requestId || 'N/A'}</div>
            <div class="meta-line"><strong>Cli :</strong> ${sample.client}</div>
            <div class="meta-line truncate"><strong>Prj :</strong> ${sample.project}</div>
            <div class="meta-line"><strong>Mat :</strong> ${materialName} (${sample.materialState})</div>
            <div class="footer-row">
              <span>Récep: ${dateStr}</span>
              <span class="prio">${sample.priority.toUpperCase()}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>Impression Étiquettes Zebra 70x37 (${items.length})</title>
      <style>
        @page {
          size: 70mm 37mm;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f1f5f9;
          color: #000;
        }
        .no-print-bar {
          padding: 10px 14px;
          background: #0f172a;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }
        .no-print-bar button {
          background: #2563eb;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
        }
        .zebra-label {
          width: 70mm;
          height: 37mm;
          background: #fff;
          padding: 2.5mm;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 3mm;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
          border: 1px dashed #cbd5e1;
          margin: 8px auto;
        }
        .qr-col {
          width: 20mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .qr-img {
          width: 18mm;
          height: 18mm;
          display: block;
        }
        .barcode-text {
          font-family: monospace;
          font-size: 6pt;
          font-weight: bold;
          margin-top: 1mm;
          text-align: center;
          word-break: break-all;
        }
        .info-col {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          border-bottom: 0.4mm solid #000;
          padding-bottom: 0.6mm;
          margin-bottom: 0.8mm;
        }
        .sample-id {
          font-size: 9pt;
          font-weight: 900;
          font-family: monospace;
        }
        .lab-badge {
          font-size: 6.5pt;
          font-weight: bold;
          border: 0.3mm solid #000;
          padding: 0 1.2mm;
        }
        .meta-line {
          font-size: 7.2pt;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .footer-row {
          display: flex;
          justify-content: space-between;
          font-size: 6.2pt;
          font-weight: bold;
          border-top: 0.3mm solid #000;
          padding-top: 0.6mm;
          margin-top: auto;
        }
        @media print {
          body { background: #fff; }
          .no-print-bar { display: none !important; }
          .zebra-label {
            margin: 0;
            border: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <span>Aperçu Zebra (Format 70 × 37 mm) — ${items.length} étiquette(s)</span>
        <button onclick="window.print()">Lancer l'impression Zebra</button>
      </div>
      ${labelsHtml}
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}