import fs from 'fs';

let code = fs.readFileSync('src/views/Samples.tsx', 'utf8');

code = code.replace(
  'const { samples, requests, materialTemplates, addSampleImage, updateSampleStatus, updateSampleMounting, globalSearchQuery } = useLims();',
  'const { samples, requests, materialTemplates, addSampleImage, updateSampleStatus, updateSampleMounting, globalSearchQuery, addSample } = useLims();'
);

// We need a function to create sub-samples
const targetHeader = `<div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Détails Échantillon</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedSample.id}</p>
              </div>`;

const newHeader = `<div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Détails Échantillon</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedSample.id} 
                  {selectedSample.parentSampleId && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded-md">Découpé de {selectedSample.parentSampleId}</span>}
                </p>
              </div>`;

code = code.replace(targetHeader, newHeader);

const actionsTarget = `<div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-2">
                <button 
                  onClick={() => { updateSampleStatus(selectedSample.id, 'en_preparation'); setSelectedSample({...selectedSample, status: 'en_preparation'}); }}
                  disabled={selectedSample.status === 'en_preparation'}`;

const actionsNew = `<div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => {
                    const num = parseInt(window.prompt('Combien d\\'enrobages (sous-échantillons) voulez-vous créer à partir de celui-ci ?', '2') || '0');
                    if (num > 0) {
                      for (let i = 1; i <= num; i++) {
                        const subSample = {
                          ...selectedSample,
                          id: \`\${selectedSample.id}-\${i}\`,
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
                  className="w-full flex-1 justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Créer Enrobages (Découpe)
                </button>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { updateSampleStatus(selectedSample.id, 'en_preparation'); setSelectedSample({...selectedSample, status: 'en_preparation'}); }}
                  disabled={selectedSample.status === 'en_preparation'}`;
                  
code = code.replace(actionsTarget, actionsNew);

fs.writeFileSync('src/views/Samples.tsx', code);
