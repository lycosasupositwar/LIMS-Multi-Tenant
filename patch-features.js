import fs from 'fs';

// 1. Update RequestsInternal.tsx
let reqCode = fs.readFileSync('src/views/RequestsInternal.tsx', 'utf8');
const oldCondition = `{(selectedRequest.status === 'validee' || selectedRequest.status === 'assignee') && (`;
const newCondition = `{(selectedRequest.status === 'validee' || selectedRequest.status === 'assignee' || (selectedRequest.status === 'en_cours' && currentUser?.role === 'manager')) && (`;
reqCode = reqCode.replace(oldCondition, newCondition);
fs.writeFileSync('src/views/RequestsInternal.tsx', reqCode);

// 2. Update Reports.tsx
let repCode = fs.readFileSync('src/views/Reports.tsx', 'utf8');
const oldBaseObj = `      const baseObj: any = {
        nom: t?.name || "Non défini",
        norme: t?.standardRef || "Non défini",
        technicien: a.technician && a.technician !== 'Non assigné' ? a.technician : (users.find((u: any) => u.id === req?.assignedTo)?.name || "Non défini"),
        remarques: a.notes || "Aucune",
        echantillon: a.sampleId,
        date: a.date ? new Intl.DateTimeFormat("fr-FR").format(new Date(a.date)) : formattedDate,
        valeurs: Object.entries(a.results || {}).map(([k, v]) => ({ cle: t?.expectedResults?.find((er: any) => er.id === k)?.name || k, valeur: Array.isArray(v) ? v.join(', ') : v }))
      };
      
      // Extraction dynamique pour les tableaux horizontaux (res_durete_vickers_v1, res_durete_vickers_moyenne, etc.)
      const sanitizeKey = (str: string) => str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '_');`;

const newBaseObj = `      const sanitizeKey = (str: string) => str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '_');
      const safeAnalysisName = sanitizeKey(t?.name || "inconnu");
      
      const baseObj: any = {
        nom: t?.name || "Non défini",
        norme: t?.standardRef || "Non défini",
        technicien: a.technician && a.technician !== 'Non assigné' ? a.technician : (users.find((u: any) => u.id === req?.assignedTo)?.name || "Non défini"),
        remarques: a.notes || "Aucune",
        echantillon: a.sampleId,
        date: a.date ? new Intl.DateTimeFormat("fr-FR").format(new Date(a.date)) : formattedDate,
        valeurs: Object.entries(a.results || {}).map(([k, v]) => ({ cle: t?.expectedResults?.find((er: any) => er.id === k)?.name || k, valeur: Array.isArray(v) ? v.join(', ') : v })),
        [\`is_\${safeAnalysisName}\`]: true
      };
      
      const series_resultats: any[] = [];`;

repCode = repCode.replace(oldBaseObj, newBaseObj);

// Also need to remove the duplicate `const series_resultats: any[] = [];` that was right after `sanitizeKey` initially.
// Let's actually use a regex or string split to be safe.
