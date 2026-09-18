import fs from 'fs';
let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const target = `<h5 className="text-xs font-bold text-slate-700 mb-2">Boucles (Listes & Tableaux)</h5>
                     <p className="text-[10px] text-slate-500 mb-2">
                       Utilisez <code>{"{#nom_boucle}"}</code> pour commencer et <code>{"{/nom_boucle}"}</code> pour terminer.
                     </p>
                     <div className="space-y-3">
                       <div>
                         <code className="text-xs font-mono font-bold text-blue-600 block mb-1">{"{#analyses} ... {/analyses}"}</code>
                         <p className="text-[10px] text-slate-600">Répète le contenu pour chaque analyse du rapport.</p>
                       </div>`;

const replacement = `<h5 className="text-xs font-bold text-slate-700 mb-2">Boucles (Listes & Tableaux)</h5>
                     <p className="text-[10px] text-slate-500 mb-2">
                       Utilisez <code>{"{#nom_boucle}"}</code> pour commencer et <code>{"{/nom_boucle}"}</code> pour terminer. (Attention à bien les placer seuls sur leur propre ligne dans Word pour conserver la mise en forme !)
                     </p>
                     <div className="space-y-3">
                       <div className="bg-blue-50 p-2 rounded border border-blue-100">
                         <code className="text-xs font-mono font-bold text-blue-600 block mb-1">{"{#echantillons} ... {/echantillons}"}</code>
                         <p className="text-[10px] text-slate-600 mb-1">Répète le contenu pour chaque échantillon. Variables internes :</p>
                         <ul className="text-[10px] text-slate-600 list-disc list-inside">
                           <li><code>{"{{id}}"}</code></li>
                           <li><code>{"{{barcode}}"}</code></li>
                           <li><code>{"{{materiau}}"}</code></li>
                           <li><code>{"{{projet}}"}</code></li>
                         </ul>
                       </div>
                       <div className="bg-slate-50 p-2 rounded border border-slate-100">
                         <code className="text-xs font-mono font-bold text-slate-700 block mb-1">{"{#analyses} ... {/analyses}"}</code>
                         <p className="text-[10px] text-slate-600">Répète le contenu pour chaque analyse du rapport.</p>
                       </div>`;

if (code.includes('Boucles (Listes & Tableaux)')) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/views/BuilderCMS.tsx', code);
} else {
    console.log("Target not found. Doing manual insertion.");
}
