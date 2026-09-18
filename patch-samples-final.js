import fs from 'fs';

let code = fs.readFileSync('src/views/Samples.tsx', 'utf8');

code = code.replace(
  'const { samples, requests, materialTemplates, addSampleImage, updateSampleStatus, updateSampleMounting, globalSearchQuery, addSample, labSettings, analyses, analysisTemplates } = useLims();',
  'const { samples, requests, materialTemplates, addSampleImage, updateSampleStatus, updateSampleMounting, globalSearchQuery, addSample, labSettings, analyses, analysisTemplates, currentUser } = useLims();'
);

const oldTableActions = `                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === sample.id ? null : sample.id);
                        }}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {openMenuId === sample.id && (
                        <div className="absolute right-8 top-10 w-48 bg-white border border-slate-200 shadow-lg rounded-lg z-50 overflow-hidden flex flex-col text-left">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">Changer statut</div>
                          <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'receptionne'); setOpenMenuId(null); setSelectedSample(prev => prev?.id === sample.id ? {...prev, status: 'receptionne'} : prev); }} className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-left">Réceptionné</button>
                          <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'en_preparation'); setOpenMenuId(null); setSelectedSample(prev => prev?.id === sample.id ? {...prev, status: 'en_preparation'} : prev); }} className="px-4 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 text-left">En préparation</button>
                          <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'en_essai'); setOpenMenuId(null); setSelectedSample(prev => prev?.id === sample.id ? {...prev, status: 'en_essai'} : prev); }} className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-left">En essai</button>
                          <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'termine'); setOpenMenuId(null); setSelectedSample(prev => prev?.id === sample.id ? {...prev, status: 'termine'} : prev); }} className="px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 text-left">Terminé</button>
                          <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'non_conforme'); setOpenMenuId(null); setSelectedSample(prev => prev?.id === sample.id ? {...prev, status: 'non_conforme'} : prev); }} className="px-4 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 text-left">Non Conforme</button>
                        </div>
                      )}
                    </td>`;

const newTableActions = `                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {sample.status === 'receptionne' && (
                        <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'en_preparation'); if (selectedSample?.id === sample.id) setSelectedSample({...selectedSample, status: 'en_preparation'}); }} className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm">Préparer</button>
                      )}
                      {sample.status === 'en_preparation' && (
                        <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'en_essai'); if (selectedSample?.id === sample.id) setSelectedSample({...selectedSample, status: 'en_essai'}); }} className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm">Passer en essai</button>
                      )}
                      {sample.status === 'en_essai' && (
                        <button onClick={(e) => { e.stopPropagation(); updateSampleStatus(sample.id, 'termine'); if (selectedSample?.id === sample.id) setSelectedSample({...selectedSample, status: 'termine'}); }} className="text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm">Terminer</button>
                      )}
                      {(sample.status === 'termine' || sample.status === 'non_conforme') && (
                        <span className="text-xs text-slate-400 font-medium px-3 py-1.5">Clôturé</span>
                      )}
                    </td>`;

code = code.replace(oldTableActions, newTableActions);

const oldStepperLogic = `                    if (selectedSample.status === 'non_conforme') {
                      stateClass = "bg-red-50 border border-red-200 text-red-500";
                    } else if (index < currentIndex) {
                      stateClass = "bg-blue-100 border border-blue-200 text-blue-700"; // done
                      isClickable = true;
                    } else if (index === currentIndex) {
                      stateClass = "bg-blue-600 border border-blue-600 text-white font-bold shadow-sm"; // active
                    } else if (index === currentIndex + 1) {
                      stateClass = "bg-white border border-blue-300 text-blue-600 hover:bg-blue-50 cursor-pointer border-dashed"; // next step available
                      isClickable = true;
                    }`;

const newStepperLogic = `                    if (selectedSample.status === 'non_conforme') {
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

                    if (currentUser?.role === 'manager' && index !== currentIndex) {
                      isClickable = true;
                      if (!stateClass.includes('hover:')) {
                        stateClass += " hover:bg-slate-100 cursor-pointer";
                      }
                    }`;

code = code.replace(oldStepperLogic, newStepperLogic);

const oldAnalysisTarget = `              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col mt-4">`;
const newAnalysisTarget = `              {(selectedSample.status === 'en_essai' || selectedSample.status === 'termine') && (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col mt-4">`;

code = code.replace(oldAnalysisTarget, newAnalysisTarget);

// We have exactly one closing div missing for the conditional rendering.
// We can find `</div>\n              </div>\n            </div>\n          </div>\n        )}`
// and replace it.
const endTarget = `                </div>
              </div>
            </div>
          </div>
        )}
      </div>`;
const newEndTarget = `                </div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>`;

code = code.replace(endTarget, newEndTarget);

fs.writeFileSync('src/views/Samples.tsx', code);
