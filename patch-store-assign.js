import fs from 'fs';
let code = fs.readFileSync('src/store.tsx', 'utf8');

const regex = /const assignRequest = \(requestId: string, analystId: string\) => \{[\s\S]*?\n  \};\n/;

const newFunc = `const assignRequest = (requestId: string, analystId: string) => {
    setRequests(requests.map(r => {
      if (r.id === requestId) {
        const analyst = users.find(u => u.id === analystId);
        const audit = createAuditLog('Assignation', \`Demande assignée à l'analyste : \${analyst?.name}\`);
        
        // Notify the analyst
        addNotification(analystId, 'Nouvelle assignation', \`La demande \${r.id} vous a été assignée.\`, 'email');
        // Notify requester
        addNotification(r.requesterId, 'Demande prise en charge', \`Votre demande \${r.id} a été assignée à un analyste.\`, 'system');

        return { ...r, assignedTo: analystId, status: 'assignee', auditTrail: [audit, ...r.auditTrail] };
      }
      return r;
    }));
    
    // Cascade to analyses
    const analystName = users.find(u => u.id === analystId)?.name || 'Non assigné';
    setAnalyses(prev => prev.map(a => {
      const isRelated = samples.some(s => s.requestId === requestId && s.id === a.sampleId);
      if (isRelated) {
        const audit = createAuditLog('Assignation', \`Analyste assigné : \${analystName} (Hérité de la demande)\`);
        return { ...a, technician: analystName, auditTrail: [audit, ...(a.auditTrail || [])] };
      }
      return a;
    }));
  };
`;

code = code.replace(regex, newFunc);
fs.writeFileSync('src/store.tsx', code);
