import fs from 'fs';

let code = fs.readFileSync('src/views/Samples.tsx', 'utf8');

const targetBtn = `<div className="p-4 border-t border-slate-200 bg-slate-50">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                Voir toutes les analyses associées
              </button>
            </div>`;

const newBtn = `<div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <button
                onClick={() => {
                  const numStr = window.prompt('Combien d\\'enrobages (sous-échantillons) voulez-vous créer à partir de celui-ci ?', '2');
                  const num = parseInt(numStr || '0');
                  if (num > 0) {
                    const prefix = labSettings?.idPrefixes?.subSample || 'ENR';
                    const parentIdBase = selectedSample.id.split('-').slice(1).join('-'); // Usually yy-xxx
                    for (let i = 1; i <= num; i++) {
                      const newId = \`\${prefix}-\${parentIdBase}-\${i}\`;
                      const subSample = {
                        ...selectedSample,
                        id: newId,
                        barcode: \`\${selectedSample.barcode}-\${i}\`,
                        parentSampleId: selectedSample.id,
                        images: [],
                        mountingInfo: undefined,
                        status: 'receptionne' as const,
                        receivedAt: new Date().toISOString()
                      };
                      addSample(subSample);
                    }
                    alert(\`\${num} enrobage(s) créé(s) avec succès.\`);
                  }
                }}
                className="w-full flex justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm items-center"
              >
                <Plus className="w-4 h-4 mr-2" /> Créer Enrobages (Découpe)
              </button>
              <button className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                Voir toutes les analyses associées
              </button>
            </div>`;

code = code.replace(targetBtn, newBtn);
fs.writeFileSync('src/views/Samples.tsx', code);
