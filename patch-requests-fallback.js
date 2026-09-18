import fs from 'fs';
let code = fs.readFileSync('src/views/RequestsInternal.tsx', 'utf8');

const target = `    if (requestedAnalyses.length === 0) {
      requestedAnalyses = selectedRequest.customData['analyses_demandees'] || [];
    }`;

const replacement = `    if (requestedAnalyses.length === 0) {
      requestedAnalyses = selectedRequest.customData['analyses_demandees'] || [];
    }
    // Deep fallback: if still empty, search all customData arrays for analysis template matches
    if (requestedAnalyses.length === 0) {
      Object.values(selectedRequest.customData).forEach(value => {
        if (Array.isArray(value)) {
          // If any value in this array matches an analysis template, assume this is the analyses field
          const hasMatch = value.some(v => analysisTemplates.some(t => t.id === v || t.name === v));
          if (hasMatch) {
            requestedAnalyses.push(...value);
          }
        }
      });
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/views/RequestsInternal.tsx', code);
