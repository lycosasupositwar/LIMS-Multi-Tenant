import fs from 'fs';

let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

// The current state is `{"{{#tables_series}"}`
// We need to fix it to `{"{{#tables_series}}"}`

// Let's just do a clean regex replacement on all loop and raw tags.
// Match `{"{{#something}"}` and make it `{"{{#something}}"}`
code = code.replace(/\{"\{\{#([^}]+)\}"\}/g, '{"{{#$1}}"}');
code = code.replace(/\{"\{\{\/([^}]+)\}"\}/g, '{"{{/$1}}"}');
code = code.replace(/\{"\{\{@([^}]+)\}"\}/g, '{"{{@$1}}"}');

// What about text inside JSX that was `{"{#series_resultats}{{echantillon}}"}` ?
// Currently it might be `{"{{#series_resultats}{{echantillon}}"}`
code = code.replace(/\{"\{\{#([^}]+)\}\{\{([^}]+)\}\}"\}/g, '{"{{#$1}}{{ $2 }}"}');

// Let's just fix it manually using string replacements for the exact strings in the file.
code = code.replace(/\{"\{\{#tables_series\}"\}/g, '{"{{#tables_series}}"}');
code = code.replace(/\{"\{\{\/tables_series\}"\}/g, '{"{{/tables_series}}"}');
code = code.replace(/\{"\{\{@xml\}"\}/g, '{"{{@xml}}"}');

code = code.replace(/\{"\{\{#analyses\}"\}/g, '{"{{#analyses}}"}');
code = code.replace(/\{"\{\{\/analyses\}"\}/g, '{"{{/analyses}}"}');

code = code.replace(/\{"\{\{#has_series\}"\}/g, '{"{{#has_series}}"}');
code = code.replace(/\{"\{\{\/has_series\}"\}/g, '{"{{/has_series}}"}');

code = code.replace(/\{"\{\{#valeurs\}"\}/g, '{"{{#valeurs}}"}');
code = code.replace(/\{"\{\{\/valeurs\}"\}/g, '{"{{/valeurs}}"}');

code = code.replace(/\{"\{\{#echantillons\}"\}/g, '{"{{#echantillons}}"}');
code = code.replace(/\{"\{\{\/echantillons\}"\}/g, '{"{{/echantillons}}"}');

// The one with sample inside:
code = code.replace(/\{"\{\{#series_resultats\}\{\{echantillon\}\}"\}/g, '{"{{#series_resultats}}{{echantillon}}"}');
code = code.replace(/\{"\{\{\/series_resultats\}"\}/g, '{"{{/series_resultats}}"}');
// Wait, the previous replacement did `code.replace(/\{"\{#/g, '{"{{#');`
// So `{"{#series_resultats}{{echantillon}}"}` became `{"{{#series_resultats}{{echantillon}}"}`.
// I need to change `{"{{#series_resultats}{{echantillon}}"}` to `{"{{#series_resultats}}{{echantillon}}"}`.
code = code.replace(/\{"\{\{#series_resultats\}\{\{echantillon\}\}"\}/g, '{"{{#series_resultats}}{{echantillon}}"}');

fs.writeFileSync('src/views/BuilderCMS.tsx', code);
