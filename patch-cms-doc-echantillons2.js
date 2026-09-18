import fs from 'fs';
let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const target = `<h5 className="font-semibold text-xs text-slate-800 mb-2 uppercase tracking-wide">Variables simples</h5>`;

const replacement = `<div className="mb-4 bg-teal-50 border border-teal-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-teal-800 mb-1">Liste des échantillons</h5>
                     <p className="text-[10px] text-teal-600 mb-2 leading-relaxed">
                       Pour lister tous les échantillons de ce rapport, utilisez cette boucle :
                     </p>
                     <div className="bg-white p-2 rounded border border-teal-200 mb-2">
                       <code className="text-[10px] block font-mono text-slate-700">{"{#echantillons}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700 pl-4">- {"{{id}} | {{barcode}} | {{materiau}} | {{projet}}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700">{"{/echantillons}"}</code>
                     </div>
                     <p className="text-[9px] text-slate-500 italic mt-1">N'oubliez pas les doubles accolades autour des variables internes !</p>
                   </div>

                   <h5 className="font-semibold text-xs text-slate-800 mb-2 uppercase tracking-wide">Variables simples</h5>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/views/BuilderCMS.tsx', code);
