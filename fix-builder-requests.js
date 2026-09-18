import fs from 'fs';
let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const target = `<option value="multiselect">Sélection multiple</option>
                          <option value="boolean">Oui / Non (Case à cocher)</option>`;

const replacement = `<option value="multiselect">Sélection multiple</option>
                          <option value="boolean">Oui / Non (Case à cocher)</option>
                          <option value="analyses">Analyses (Modèles actifs)</option>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/views/BuilderCMS.tsx', code);
