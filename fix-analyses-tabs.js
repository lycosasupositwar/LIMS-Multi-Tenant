import fs from 'fs';
let code = fs.readFileSync('src/views/Analyses.tsx', 'utf8');

const target = `<h2 className="text-2xl font-display font-bold text-slate-900">Suivi des Analyses & Essais</h2>`;
const replacement = `<h2 className="text-2xl font-display font-bold text-slate-900">Suivi des Analyses & Essais</h2>
        
        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shrink-0">
          <button
            onClick={() => setFilterMode('actives')}
            className={\`px-4 py-1.5 text-sm font-medium rounded-md transition-colors \${filterMode === 'actives' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}\`}
          >
            En cours
          </button>
          <button
            onClick={() => setFilterMode('historique')}
            className={\`px-4 py-1.5 text-sm font-medium rounded-md transition-colors \${filterMode === 'historique' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}\`}
          >
            Historique
          </button>
        </div>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/views/Analyses.tsx', code);
