import fs from 'fs';

let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

const targetList = `<ul className="space-y-2 text-sm">
                      {[
                        { label: "ID Demande", tag: "{{demande.id}}" },`;

const replacementList = `<div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-blue-800 mb-1">Tableaux dynamiques (Boucles)</h5>
                     <p className="text-[10px] text-blue-600 mb-2 leading-relaxed">
                       Pour un tableau propre (ex: listes de résultats multiples), créez un tableau dans Word et encadrez la ligne avec ces balises spéciales :
                     </p>
                     <div className="bg-white p-2 rounded border border-blue-200 mb-2">
                       <code className="text-[10px] block font-mono text-slate-700">{"{#analyses}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700 pl-2">Analyse: {"{{nom}}"} / {"{{technicien}}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700 pl-2">{"{#valeurs}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700 pl-4">- {"{{cle}}"} : {"{{valeur}}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700 pl-2">{"{/valeurs}"}</code>
                       <code className="text-[10px] block font-mono text-slate-700">{"{/analyses}"}</code>
                     </div>
                   </div>

                   <h5 className="font-semibold text-xs text-slate-800 mb-2 uppercase tracking-wide">Variables simples</h5>
                   <ul className="space-y-2 text-sm">
                      {[
                        { label: "ID Demande", tag: "{{demande.id}}" },`;

code = code.replace(targetList, replacementList);

fs.writeFileSync('src/views/BuilderCMS.tsx', code);
