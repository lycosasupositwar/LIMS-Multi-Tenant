import fs from 'fs';

let code = fs.readFileSync('src/views/Samples.tsx', 'utf8');

// 1. Add analyses and analysisTemplates to useLims
code = code.replace(
  'const { samples, requests, materialTemplates, addSampleImage, updateSampleStatus, updateSampleMounting, globalSearchQuery, addSample, labSettings } = useLims();',
  'const { samples, requests, materialTemplates, addSampleImage, updateSampleStatus, updateSampleMounting, globalSearchQuery, addSample, labSettings, analyses, analysisTemplates } = useLims();'
);

// 2. Add activeAnalysisTab state
code = code.replace(
  'const [enrobageCount, setEnrobageCount] = useState(2);',
  `const [enrobageCount, setEnrobageCount] = useState(2);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'pending'|'history'>('pending');`
);

// 3. Add getAnalysisName helper
code = code.replace(
  'const getTemplateName = (templateId: string) => {',
  `const getAnalysisName = (templateId: string) => {
    return analysisTemplates.find(t => t.id === templateId)?.name || templateId;
  };
  
  const getTemplateName = (templateId: string) => {`
);

// 4. Build the Status Stepper at the top of the detail panel
const detailHeaderTarget = `<div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">Détails Échantillon</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedSample.id} 
                  {selectedSample.parentSampleId && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded-md">Découpé de {selectedSample.parentSampleId}</span>}
                </p>
              </div>
              <button onClick={() => setSelectedSample(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>`;

const statusStepper = `
            <div className="bg-white border-b border-slate-200 p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900">Détails Échantillon</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {selectedSample.id} 
                    {selectedSample.parentSampleId && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded-md">Découpé de {selectedSample.parentSampleId}</span>}
                  </p>
                </div>
                <button onClick={() => setSelectedSample(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Stepper */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progression / Statut</h4>
                <div className="flex items-center gap-1">
                  {['receptionne', 'en_preparation', 'en_essai', 'termine'].map((step, index) => {
                    const stepLabels: Record<string, string> = {
                      'receptionne': 'Réceptionné',
                      'en_preparation': 'Préparation',
                      'en_essai': 'En essai',
                      'termine': 'Terminé'
                    };
                    const statusOrder = ['receptionne', 'en_preparation', 'en_essai', 'termine'];
                    const currentIndex = statusOrder.indexOf(selectedSample.status);
                    
                    let stateClass = "bg-slate-200 text-slate-500 border border-slate-300"; // pending
                    let isClickable = false;
                    
                    if (selectedSample.status === 'non_conforme') {
                      stateClass = "bg-red-50 border border-red-200 text-red-500";
                    } else if (index < currentIndex) {
                      stateClass = "bg-blue-100 border border-blue-200 text-blue-700"; // done
                      isClickable = true;
                    } else if (index === currentIndex) {
                      stateClass = "bg-blue-600 border border-blue-600 text-white font-bold shadow-sm"; // active
                    } else if (index === currentIndex + 1) {
                      stateClass = "bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 cursor-pointer border-dashed"; // next step available
                      isClickable = true;
                    }

                    return (
                      <React.Fragment key={step}>
                        <button 
                          onClick={() => {
                            if (isClickable) {
                              updateSampleStatus(selectedSample.id, step as SampleStatus);
                              setSelectedSample({...selectedSample, status: step as SampleStatus});
                            }
                          }}
                          disabled={!isClickable && index !== currentIndex}
                          className={\`flex-1 py-1.5 px-2 text-[10px] md:text-xs rounded-md transition-all text-center \${stateClass}\`}
                        >
                          {stepLabels[step]}
                        </button>
                        {index < 3 && <div className="w-2 h-px bg-slate-300 shrink-0" />}
                      </React.Fragment>
                    );
                  })}
                </div>
                {selectedSample.status !== 'non_conforme' && selectedSample.status !== 'termine' && (
                  <div className="mt-2 text-right">
                    <button 
                      onClick={() => {
                        updateSampleStatus(selectedSample.id, 'non_conforme');
                        setSelectedSample({...selectedSample, status: 'non_conforme'});
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700 hover:underline font-medium"
                    >
                      Marquer Non Conforme
                    </button>
                  </div>
                )}
                {selectedSample.status === 'non_conforme' && (
                   <div className="mt-2 text-right">
                   <button 
                     onClick={() => {
                       updateSampleStatus(selectedSample.id, 'receptionne');
                       setSelectedSample({...selectedSample, status: 'receptionne'});
                     }}
                     className="text-[10px] text-slate-500 hover:text-slate-700 hover:underline font-medium"
                   >
                     Annuler la non-conformité
                   </button>
                 </div>
                )}
              </div>
            </div>
`;

code = code.replace(detailHeaderTarget, statusStepper);

// 5. Replace "Voir toutes les analyses associées" with inline tabbed view
const dummyButtonTarget = `<button className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                Voir toutes les analyses associées
              </button>`;

const analysisView = `
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col mt-4">
                <div className="flex border-b border-slate-200">
                  <button 
                    onClick={() => setActiveAnalysisTab('pending')}
                    className={\`flex-1 py-2 text-xs font-bold \${activeAnalysisTab === 'pending' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}\`}
                  >
                    Essais en cours
                  </button>
                  <button 
                    onClick={() => setActiveAnalysisTab('history')}
                    className={\`flex-1 py-2 text-xs font-bold \${activeAnalysisTab === 'history' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}\`}
                  >
                    Historique (Terminés)
                  </button>
                </div>
                <div className="p-0 bg-white max-h-48 overflow-y-auto">
                  {(() => {
                    const sampleAnalyses = analyses.filter(a => a.sampleId === selectedSample.id);
                    const displayed = activeAnalysisTab === 'pending' 
                      ? sampleAnalyses.filter(a => a.status !== 'terminee')
                      : sampleAnalyses.filter(a => a.status === 'terminee');

                    if (displayed.length === 0) {
                      return <div className="p-4 text-center text-xs text-slate-500 italic">Aucun essai {activeAnalysisTab === 'pending' ? 'en cours' : 'terminé'}.</div>;
                    }
                    
                    return displayed.map((analysis) => (
                      <div key={analysis.id} className="p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{getAnalysisName(analysis.templateId)}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{analysis.id}</div>
                        </div>
                        <div>
                          <span className={\`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium \${
                            analysis.status === 'terminee' ? 'bg-emerald-100 text-emerald-800' : 
                            analysis.status === 'en_cours' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                          }\`}>
                            {analysis.status === 'terminee' ? 'Terminée' : analysis.status === 'en_cours' ? 'En cours' : 'À planifier'}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
`;

code = code.replace(dummyButtonTarget, analysisView);

fs.writeFileSync('src/views/Samples.tsx', code);
