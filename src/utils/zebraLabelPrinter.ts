/**
 * Utilitaire d'impression d'étiquettes Échantillons (Imprimantes Thermiques Zebra & ZPL)
 */

import { Sample } from '../types';

export interface LabelPrintData {
  sample: Sample;
  materialName: string;
  labCode?: string;
}

/**
 * 1. Génère le code natif ZPL II (Zebra Programming Language) pour étiquettes 50x30mm (203 dpi)
 * Commande ^BQN pour le QR Code contenant le barcode de l'échantillon
 */
export function generateZplForSamples(items: LabelPrintData[]): string {
  return items
    .map(({ sample, materialName, labCode }) => {
      const dateStr = new Date(sample.receivedAt).toLocaleDateString('fr-FR');
      const reqRef = sample.requestId || 'INDEPENDANT';
      const cleanClient = (sample.client || '').substring(0, 22);
      const cleanProject = (sample.project || '').substring(0, 24);
      const cleanMat = `${materialName} (${sample.materialState})`.substring(0, 24);

      return [
        '^XA',
        '^CI28', // Encodage UTF-8 pour les accents français
        '^PW400', // Largeur 50mm à 203 dpi (8 dots/mm = 400 dots)
        '^LL240', // Hauteur 30mm à 203 dpi (240 dots)
        '^LH0,0',

        // QR Code à gauche (contient le barcode exact pour la recherche directe)
        '^FO16,20^BQN,2,4^FDQA,' + sample.barcode + '^FS',
        '^FO16,165^A0N,16,16^FD' + sample.barcode + '^FS',

        // Informations textuelles à droite du QR Code
        '^FO145,18^A0N,24,24^FD' + sample.id + '^FS',
        '^FO325,18^A0N,18,18^FD[' + (labCode || 'LIMS') + ']^FS',
        '^FO145,46^GB240,1,1^FS', // Ligne de séparation

        '^FO145,55^A0N,18,18^FDDem: ' + reqRef + '^FS',
        '^FO145,78^A0N,18,18^FDCli: ' + cleanClient + '^FS',
        '^FO145,101^A0N,16,16^FDPrj: ' + cleanProject + '^FS',
        '^FO145,122^A0N,16,16^FDMat: ' + cleanMat + '^FS',
        '^FO145,145^A0N,15,15^FDRec: ' + dateStr + ' | Prio: ' + sample.priority.toUpperCase() + '^FS',

        '^XZ'
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * 2. Ouvre une fenêtre d'impression calibrée pour rouleau d'étiquettes Zebra (ex: 50mm x 30mm)
 */
export function printZebraLabelsWindow(items: LabelPrintData[]) {
  if (items.length === 0) return;

  const printWin = window.open('', '_blank', 'width=600,height=500');
  if (!printWin) {
    alert('Veuillez autoriser les pop-ups pour imprimer les étiquettes.');
    return;
  }

  const labelsHtml = items
    .map(({ sample, materialName, labCode }) => {
      const dateStr = new Date(sample.receivedAt).toLocaleDateString('fr-FR');
      // Le QR code encode directement sample.barcode pour que le scan dans "Rechercher partout" trouve l'échantillon
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(
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
            <div class="meta-line truncate">${sample.project}</div>
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
      <title>Impression Étiquettes Zebra (${items.length})</title>
      <style>
        @page {
          size: 50mm 30mm;
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
          width: 50mm;
          height: 30mm;
          background: #fff;
          padding: 1.8mm;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 2mm;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
          border: 1px dashed #cbd5e1;
          margin: 8px auto;
        }
        .qr-col {
          width: 15mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .qr-img {
          width: 14mm;
          height: 14mm;
          display: block;
        }
        .barcode-text {
          font-family: monospace;
          font-size: 5.5pt;
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
          border-bottom: 0.3mm solid #000;
          padding-bottom: 0.4mm;
          margin-bottom: 0.5mm;
        }
        .sample-id {
          font-size: 7.5pt;
          font-weight: 900;
          font-family: monospace;
        }
        .lab-badge {
          font-size: 5.5pt;
          font-weight: bold;
          border: 0.2mm solid #000;
          padding: 0 1mm;
        }
        .meta-line {
          font-size: 5.8pt;
          line-height: 1.22;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .footer-row {
          display: flex;
          justify-content: space-between;
          font-size: 5pt;
          font-weight: bold;
          border-top: 0.2mm solid #000;
          padding-top: 0.4mm;
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
        <span>Aperçu Zebra (Format 50 × 30 mm) — ${items.length} étiquette(s)</span>
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