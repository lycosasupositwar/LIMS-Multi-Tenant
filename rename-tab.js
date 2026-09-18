import fs from 'fs';

let code = fs.readFileSync('src/views/Settings.tsx', 'utf8');

code = code.replace(
  'Système & Patchs',
  'Sauvegarde Config.'
);

code = code.replace(
  'Exporter un Patch (Sauvegarde de Configuration)',
  'Exporter la Configuration (Templates)'
);

code = code.replace(
  'Télécharger lims_patch.json',
  'Télécharger lims_config.json'
);

code = code.replace(
  'lims_patch_${new Date().toISOString().split(\'T\')[0]}.json',
  'lims_config_${new Date().toISOString().split(\'T\')[0]}.json'
);

code = code.replace(
  "Déployer un Patch (Mise à jour de l'application)",
  "Importer une Configuration"
);

code = code.replace(
  'lims_patch_*.json',
  'lims_config_*.json'
);

code = code.replace(
  'Patch appliqué avec succès.',
  'Configuration appliquée avec succès.'
);

code = code.replace(
  'Erreur lors de la lecture du patch',
  'Erreur lors de la lecture de la configuration'
);

fs.writeFileSync('src/views/Settings.tsx', code);
