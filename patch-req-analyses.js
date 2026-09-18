import fs from 'fs';
let code = fs.readFileSync('src/views/RequestsInternal.tsx', 'utf8');

const target = `    if (requestedAnalyses.length === 0) {
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

const replacement = `    if (requestedAnalyses.length === 0) {
      Object.values(selectedRequest.customData).forEach(value => {
        if (Array.isArray(value)) {
          // If any value in this array matches an analysis template, assume this is the analyses field
          const hasMatch = value.some(v => analysisTemplates.some(t => t.id === String(v) || t.name === String(v)));
          if (hasMatch) {
            requestedAnalyses.push(...value.map(String));
          }
        } else if (typeof value === 'string') {
          // Fallback for single select fields storing just the name
          if (analysisTemplates.some(t => t.id === value || t.name === value)) {
             requestedAnalyses.push(value);
          }
        }
      });
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/views/RequestsInternal.tsx', code);
