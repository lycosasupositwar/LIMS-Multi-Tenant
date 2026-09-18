import fs from 'fs';

let repCode = fs.readFileSync('src/views/Reports.tsx', 'utf8');

const oldTarget = `      const baseObj: any = {
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

const newTarget = `      const sanitizeKey = (str: string) => str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '_');
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
      
      // Extraction dynamique pour les tableaux horizontaux`;

repCode = repCode.replace(oldTarget, newTarget);
fs.writeFileSync('src/views/Reports.tsx', repCode);
