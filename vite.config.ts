import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Écoute sur toutes les interfaces réseau pour permettre l'accès externe
      host: '0.0.0.0',
      // Autorise explicitement votre nom de domaine (requis sur Vite 6+)
      allowedHosts: ['lims.atomlab.fr'],
      
      // Le rechargement à chaud (HMR) peut être désactivé via la variable d'environnement DISABLE_HMR.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Désactive la surveillance des fichiers lorsque DISABLE_HMR vaut 'true' pour économiser le CPU.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
