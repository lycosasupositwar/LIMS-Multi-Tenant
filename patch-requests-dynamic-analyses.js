import fs from 'fs';
let code = fs.readFileSync('src/views/RequestsInternal.tsx', 'utf8');

const target = `    const requester = users.find(u => u.id === selectedRequest.requesterId);
    
    const requestedAnalyses = selectedRequest.customData['analyses_demandees'] || [];`;

const replacement = `    const requester = users.find(u => u.id === selectedRequest.requesterId);
    
    // Find all custom fields of type 'analyses' for this request's template
    const template = requestTemplates.find(t => t.id === selectedRequest.templateId);
    let requestedAnalyses: string[] = [];
    if (template) {
      const analysesFields = template.fields.filter(f => f.type === 'analyses');
      analysesFields.forEach(f => {
        if (selectedRequest.customData[f.id] && Array.isArray(selectedRequest.customData[f.id])) {
           requestedAnalyses.push(...selectedRequest.customData[f.id]);
        }
      });
    }
    // Fallback
    if (requestedAnalyses.length === 0) {
      requestedAnalyses = selectedRequest.customData['analyses_demandees'] || [];
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/views/RequestsInternal.tsx', code);
