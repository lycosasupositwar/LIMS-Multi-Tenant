import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Replace the column filtering logic in tables_analyses to completely exclude templates with number_series
  const target = `const columns = (t.expectedResults || []).filter((er: any) => er.type !== 'image' && er.type !== 'number_series');
            if (columns.length === 0) return; // Skip if no standard columns`;
            
  const replacement = `// If this analysis has ANY number_series, we skip it for tables_analyses (it belongs in tables_series)
            const hasSeries = (t.expectedResults || []).some((er: any) => er.type === 'number_series');
            if (hasSeries) return; 
            
            const columns = (t.expectedResults || []).filter((er: any) => er.type !== 'image');
            if (columns.length === 0) return; // Skip if no standard columns`;

  code = code.replace(target, replacement);
  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
