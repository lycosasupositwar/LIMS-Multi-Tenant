import fs from 'fs';
let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const targetList = `<div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-purple-800 mb-1">Tableaux Horizontaux Dynamiques</h5>`;

const replacementList = `<div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-purple-800 mb-1">Tableaux Auto-Générés (Nombres de colonnes dynamique)</h5>
                     <p className="text-[10px] text-purple-600 mb-2 leading-relaxed">
                       Si le nombre de mesures varie (ex: 3 mesures parfois, 15 mesures d'autres fois), le système peut <strong>générer automatiquement le tableau complet</strong>.
                     </p>
                     <div className="bg-white p-2 rounded border border-purple-200 mb-2">
                       <code className="text-[9px] block font-mono text-slate-700 mb-1">{"{#tables_series}"}</code>
                       <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2">{"{{titre}}"}</code>
                       <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2 font-bold text-blue-600">{"{@xml}"}</code>
                       <code className="text-[9px] block font-mono text-slate-700 mt-1">{"{/tables_series}"}</code>
                     </div>
                     <p className="text-[9px] text-slate-500 italic mt-1">N'utilisez pas de tableaux Word. Écrivez juste ces balises à la suite, et le tableau natif s'insérera à la place de {"{@xml}"}.</p>
                   </div>
                   
                   <div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3 hidden">
                     <h5 className="text-xs font-bold text-purple-800 mb-1">Tableaux Horizontaux Dynamiques</h5>`;

code = code.replace(targetList, replacementList);
fs.writeFileSync('src/views/BuilderCMS.tsx', code);
