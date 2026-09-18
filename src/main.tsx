/**
 * Point d'Entrée Principal de l'Application React (Vite)
 * 
 * Initialise le nœud racine DOM ('root') et monte le composant racine
 * sous le mode strict (StrictMode) pour détecter d'éventuels effets de bord.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Montage de l'application dans l'élément racine du document HTML
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
