import fs from 'fs';

let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

code = code.replace(/\{"\{\{stats\}\{\/series_resultats\}"\}/g, '{"{{stats}}{{/series_resultats}}"}');
// Wait, the original in line 1035 is: `{"{{stats}}{/series_resultats}"}`
code = code.replace(/\{"\{\{stats\}\}\{\/series_resultats\}"\}/g, '{"{{stats}}{{/series_resultats}}"}');

// Let's replace any remaining `{#` or `{/` inside JSX text strings `{"..."}` that wasn't caught.
// Like `{"{{stats}}{/series_resultats}"}` -> `{"{{stats}}{{/series_resultats}}"}`
code = code.replace(/\{\/series_resultats\}/g, '{{/series_resultats}}');
// Wait, doing this globally might break actual JSX? No, inside strings it's fine.
code = code.replace(/\{"\{\{stats\}\}\{\{\/series_resultats\}\}"\}/g, '{"{{stats}}{{/series_resultats}}"}'); // if double already

// And in line 1020: `{"{{#series_resultats}"}` -> `{"{{#series_resultats}}"}`
code = code.replace(/\{"\{\{#series_resultats\}"\}/g, '{"{{#series_resultats}}"}');

fs.writeFileSync('src/views/BuilderCMS.tsx', code);
