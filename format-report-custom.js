import fs from 'fs';
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

const target = `      demande: { 
        id: request?.id || "N/A",
        custom: request?.customData || {}
      },`;

const replacement = `      demande: { 
        id: request?.id || "N/A",
        custom: Object.fromEntries(
          Object.entries(request?.customData || {}).map(([k, v]) => {
            if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && v[0].includes('-')) {
              // Try to map UUIDs to Analysis Template Names (if it's the analyses custom field)
              const mapped = v.map(id => analysisTemplates.find(a => a.id === id)?.name || id);
              return [k, mapped.join(', ')];
            }
            if (Array.isArray(v)) return [k, v.join(', ')];
            return [k, v];
          })
        )
      },`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
