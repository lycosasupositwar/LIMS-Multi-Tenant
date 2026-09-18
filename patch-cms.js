import fs from 'fs';
let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const targetStr = `                   <p className="text-xs text-slate-500 mb-4">Insérez ces variables directement dans votre fichier Word.</p>`;
const insertionStr = `                   <p className="text-xs text-slate-500 mb-4">Insérez ces variables directement dans votre fichier Word.</p>
                   
                   <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-emerald-800 mb-1">Affichage Conditionnel (ex: Photos)</h5>
                     <p className="text-[10px] text-emerald-600 mb-2 leading-relaxed">
                       Affichez un contenu <strong>uniquement</strong> si l'analyse correspond à un certain type (ex: Métallographie). Le nom de l'analyse est converti en minuscules sans accents.
                     </p>
                     <div className="bg-white p-2 rounded border border-emerald-200 mb-2">
                       <code className="text-[10px] block font-mono text-slate-700">{"{{#analyses}}"}</code>
                       <code className="text-[10px] block font-mono text-emerald-700 font-bold ml-2">{"{{#is_metallographie}}"}</code>
                       <code className="text-[10px] block font-mono text-slate-600 ml-4">Section réservée à la métallographie...</code>
                       <code className="text-[10px] block font-mono text-emerald-700 font-bold ml-2">{"{{/is_metallographie}}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700 mt-1">{"{{/analyses}}"}</code>
                     </div>
                     <p className="text-[9px] text-slate-500 italic mt-1">Fonctionne avec n'importe quelle analyse : {"is_durete_vickers"}, {"is_granulometrie"}, etc.</p>
                   </div>`;

code = code.replace(targetStr, insertionStr);
fs.writeFileSync('src/views/BuilderCMS.tsx', code);
