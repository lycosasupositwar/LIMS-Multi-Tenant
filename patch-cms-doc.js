import fs from 'fs';

let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const targetList = `<div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-blue-800 mb-1">Tableaux dynamiques (Boucles)</h5>`;

const replacementList = `<div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-purple-800 mb-1">Tableaux Horizontaux Avancés</h5>
                     <p className="text-[10px] text-purple-600 mb-2 leading-relaxed">
                       Pour afficher des mesures multiples en colonnes (Dureté 1, 2, 3...), le système "aplatit" vos variables. Remplacez le nom du champ par une version sans espaces/accents (ex: Dureté Vickers = durete_vickers).
                     </p>
                     <div className="bg-white p-2 rounded border border-purple-200 mb-2 overflow-x-auto">
                       <table className="text-[9px] w-full border-collapse">
                         <thead>
                           <tr><th className="border p-1 text-left">Echantillon</th><th className="border p-1 text-left">Dureté 1</th><th className="border p-1 text-left">Dureté 2</th><th className="border p-1 text-left">Moyenne</th></tr>
                         </thead>
                         <tbody>
                           <tr>
                             <td className="border p-1 font-mono">{"{#analyses}{{echantillon}}"}</td>
                             <td className="border p-1 font-mono">{"{{res_durete_vickers_v1}}"}</td>
                             <td className="border p-1 font-mono">{"{{res_durete_vickers_v2}}"}</td>
                             <td className="border p-1 font-mono">{"{{res_durete_vickers_stats}}{/analyses}"}</td>
                           </tr>
                         </tbody>
                       </table>
                     </div>
                   </div>

                   <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-blue-800 mb-1">Tableaux Verticaux (Boucles)</h5>`;

code = code.replace(targetList, replacementList);
fs.writeFileSync('src/views/BuilderCMS.tsx', code);
