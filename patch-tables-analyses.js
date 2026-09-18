import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // We will insert `tables_analyses` logic just below the `tables_series` logic.
  // Look for `Object.values(seriesGroups).forEach(group => { ... });`
  // and insert after it.
  
  const targetSplit = `    Object.values(seriesGroups).forEach(group => {`;
  
  // Actually, let's find where `tables_series` loop ends.
  const regex = /tables_series\.push\(\{ titre: group\.paramName, xml: xml \}\);\n        \}\n    \}\);/g;

  const tablesAnalysesCode = `
    const tables_analyses: any[] = [];
    const analysesGroups: Record<string, { templateName: string, columns: any[], rows: any[] }> = {};
    
    // Group analyses by templateId
    (typeof reportAnalyses !== 'undefined' ? reportAnalyses : (typeof anals !== 'undefined' ? anals : analyses.filter((a: any) => req?.sampleIds?.includes(a.sampleId)))).forEach((a: any) => {
        const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
        if (!t) return;
        
        if (!analysesGroups[a.templateId]) {
            // Determine columns for this analysis (excluding images and number_series if we only want standard fields, or maybe include them as strings?)
            const columns = (t.expectedResults || []).filter((er: any) => er.type !== 'image' && er.type !== 'number_series');
            if (columns.length === 0) return; // Skip if no standard columns
            analysesGroups[a.templateId] = { templateName: t.name, columns: columns, rows: [] };
        }
        
        analysesGroups[a.templateId].rows.push(a);
    });

    Object.values(analysesGroups).forEach(group => {
        if (group.rows.length > 0 && group.columns.length > 0) {
            let xml = \`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>\`;
            xml += \`<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>\`;
            const addHeaderCell = (text: string) => { xml += \`<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>\${escapeXML(text)}</w:t></w:r></w:p></w:tc>\`; };
            const addDataCell = (text: string) => { xml += \`<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>\${escapeXML(text)}</w:t></w:r></w:p></w:tc>\`; };
            
            addHeaderCell("Echantillon");
            group.columns.forEach(col => addHeaderCell(col.name));
            xml += \`</w:tr>\`;
            
            group.rows.forEach(r => {
                xml += \`<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>\`;
                // Try to find sample name/barcode
                // in Reports.tsx we have 'samps', in ReportPreviewModal we have 'reportSamples'
                let sampleStr = r.sampleId;
                const sampleList = typeof samps !== 'undefined' ? samps : (typeof reportSamples !== 'undefined' ? reportSamples : []);
                const sObj = sampleList.find((s: any) => s.id === r.sampleId);
                if (sObj) {
                    sampleStr = sObj.barcode || sObj.id;
                }
                
                addDataCell(sampleStr);
                
                group.columns.forEach(col => {
                    const v = (r.results || {})[col.id];
                    let textVal = "-";
                    if (v !== undefined && v !== null && v !== "") {
                        textVal = Array.isArray(v) ? v.join(", ") : String(v);
                    }
                    addDataCell(textVal);
                });
                
                xml += \`</w:tr>\`;
            });
            xml += \`</w:tbl>\`;
            tables_analyses.push({ titre: group.templateName, xml: xml });
        }
    });
`;

  code = code.replace(
    /tables_series\.push\(\{ titre: group\.paramName, xml: xml \}\);\n\s*\}\n\s*\}\);/g,
    `tables_series.push({ titre: group.paramName, xml: xml });\n        }\n    });\n` + tablesAnalysesCode
  );

  // Add tables_analyses to return object
  // Find '"tables_series": tables_series,'
  code = code.replace(
    /"tables_series": tables_series,/g,
    `"tables_series": tables_series,\n      "tables_analyses": tables_analyses,`
  );

  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
