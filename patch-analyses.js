import fs from 'fs';
let code = fs.readFileSync('src/views/Analyses.tsx', 'utf8');

// 1. Add the state for the filter
if (!code.includes("const [filterMode, setFilterMode]")) {
  code = code.replace(
    /const \[groupBy, setGroupBy\] = useState<'none' \| 'request'>\('none'\);/,
    "const [groupBy, setGroupBy] = useState<'none' | 'request'>('none');\n  const [filterMode, setFilterMode] = useState<'actives' | 'historique'>('actives');"
  );
}

// 2. Modify the filtering logic to hide "valide" and "termine" in actives, and only show them in historique
const filterLogicRegex = /const filteredAnalyses = analyses\.filter\(a => \{[\s\S]*?\}\);/;
const newFilterLogic = `const filteredAnalyses = analyses.filter(a => {
    // Basic filter by mode
    if (filterMode === 'actives' && (a.status === 'valide' || a.status === 'termine' || a.status === 'rejete')) {
      return false;
    }
    if (filterMode === 'historique' && (a.status !== 'valide' && a.status !== 'termine' && a.status !== 'rejete')) {
      return false;
    }

    // Hide analyses if their associated request is terminated/rejected (unless we are in historique, maybe we want to see them?)
    const sample = samples.find(s => s.id === a.sampleId);
    if (filterMode === 'actives' && sample && sample.requestId) {
      const request = requests.find(r => r.id === sample.requestId);
      if (request && (request.status === 'terminee' || request.status === 'rejetee')) {
        return false;
      }
    }

    // Search filter
    const matchesSearch = a.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (a.sampleId && a.sampleId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Global search
    if (globalSearchQuery) {
      const template = analysisTemplates.find(t => t.id === a.templateId);
      const q = globalSearchQuery.toLowerCase();
      if (!a.id.toLowerCase().includes(q) &&
          !a.sampleId?.toLowerCase().includes(q) &&
          !template?.name.toLowerCase().includes(q)) {
        return false;
      }
    }
    
    return matchesSearch;
  });`;

code = code.replace(filterLogicRegex, newFilterLogic);

// 3. Add the toggle buttons to the UI near the search/groupBy
const headerRegex = /<div className="flex flex-col sm:flex-row gap-4">[\s\S]*?<div className="relative flex-1">/;
const newHeader = `<div className="flex flex-col sm:flex-row gap-4 mb-4">
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
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">`;

if (!code.includes("setFilterMode('actives')")) {
  code = code.replace(/<div className="flex flex-col sm:flex-row gap-4">\s*<div className="relative flex-1">/, newHeader);
}

fs.writeFileSync('src/views/Analyses.tsx', code);
