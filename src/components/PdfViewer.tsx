/**
 * Visualiseur Intégré de Documents PDF (react-pdf)
 * 
 * Permet le rendu haute fidélité des rapports d'essais et certificats
 * directement au sein de l'application sans nécessiter de téléchargement préalable :
 * - Configuration du worker PDF.js optimisé pour Vite
 * - Rendu multi-pages avec conteneur défilable et gestion de la largeur
 * - Indicateur de progression et animation de chargement
 */

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialisation du worker PDF.js depuis le package distribué
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * Propriétés attendues par le visualiseur PDF
 */
interface PdfViewerProps {
  /** URL ou blob source du fichier PDF */
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  // Nombre total de pages du document chargé
  const [numPages, setNumPages] = useState<number>();

  /**
   * Callback déclenché à la fin de l'analyse du document PDF
   */
  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  return (
    <div className="flex flex-col items-center w-full bg-slate-200 max-h-[800px] overflow-y-auto p-4 custom-scrollbar">
      <div className="flex flex-col gap-6">
        <Document 
          file={url} 
          onLoadSuccess={onDocumentLoadSuccess} 
          loading={
            <div className="flex flex-col items-center justify-center h-[500px] w-[800px] bg-white shadow-xl mx-auto">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-600 font-medium">Chargement du PDF...</p>
            </div>
          }
        >
          {/* Génération de chaque page avec largeur calibrée à 800px */}
          {Array.from(new Array(numPages || 0), (el, index) => (
            <div key={`page_${index + 1}`} className="shadow-xl bg-white mb-6 last:mb-0">
              <Page 
                pageNumber={index + 1} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={800}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}
