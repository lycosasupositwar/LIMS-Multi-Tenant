import fs from 'fs';
let code = fs.readFileSync('src/views/RequestsInternal.tsx', 'utf8');

code = code.replace(
  /technician: 'Non assigné', \/\/ Can be updated later by manager/g,
  `technician: selectedRequest.assignedTo ? (users.find(u => u.id === selectedRequest.assignedTo)?.name || 'Non assigné') : 'Non assigné',`
);

fs.writeFileSync('src/views/RequestsInternal.tsx', code);
