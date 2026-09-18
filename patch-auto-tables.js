import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Check if we already applied this
  if (code.includes("const tables_series: any[] = [];")) {
    console.log("Already patched " + filePath);
    return;
  }

  const endMarker = "    return {";
  const replacement = `
    const tables_series: any[] = [];
    const seriesGroups: Record<string, { paramName: string, rows: any[] }> = {};
    const escapeXML = (str: string) => {
      if(str === null || str === undefined) return "";
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    };

    anals.forEach((a: any) => {
        const t = analysisTemplates.find((tpl: any) => tpl.id === a.templateId);
        if (!t) return;
        Object.entries(a.results || {}).forEach(([k, v]) => {
            const expected = t.expectedResults?.find((er: any) => er.id === k);
            if (expected?.type === 'number_series' && Array.isArray(v) && v.length > 0) {
                if (!seriesGroups[k]) seriesGroups[k] = { paramName: expected.name, rows: [] };
                const numVals = v.map(Number).filter((n: number) => !isNaN(n));
                let stats = "-";
                if (numVals.length > 0) {
                   const mean = numVals.reduce((sum: number, n: number) => sum + n, 0) / numVals.length;
                   const variance = numVals.length > 1 ? numVals.reduce((sum: number, n: number) => sum + Math.pow(n - mean, 2), 0) / (numVals.length - 1) : 0;
                   const stdDev = numVals.length > 1 ? Math.sqrt(variance) : 0;
                   stats = \`\${mean.toFixed(2)} ± \${stdDev.toFixed(2)}\`;
                }
                seriesGroups[k].rows.push({ echantillon: a.sampleId, valeurs: v, stats: stats });
            }
        });
    });

    Object.values(seriesGroups).forEach(group => {
        let maxVals = 0;
        group.rows.forEach(r => { if (r.valeurs.length > maxVals) maxVals = r.valeurs.length; });
        if (maxVals > 0) {
            let xml = \`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders><w:tblCellMar><w:top w:w="115" w:type="dxa"/><w:left w:w="115" w:type="dxa"/><w:bottom w:w="115" w:type="dxa"/><w:right w:w="115" w:type="dxa"/></w:tblCellMar></w:tblPr>\`;
            xml += \`<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>\`;
            const addHeaderCell = (text: string) => { xml += \`<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>\${escapeXML(text)}</w:t></w:r></w:p></w:tc>\`; };
            addHeaderCell("Echantillon");
            for (let i = 1; i <= maxVals; i++) addHeaderCell(\`Mesure \${i}\`);
            addHeaderCell("Moyenne");
            xml += \`</w:tr>\`;
            group.rows.forEach(r => {
                xml += \`<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>\`;
                const addDataCell = (text: string) => { xml += \`<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>\${escapeXML(text)}</w:t></w:r></w:p></w:tc>\`; };
                addDataCell(r.echantillon);
                for (let i = 0; i < maxVals; i++) addDataCell(r.valeurs[i] !== undefined ? String(r.valeurs[i]) : "-");
                addDataCell(r.stats);
                xml += \`</w:tr>\`;
            });
            xml += \`</w:tbl>\`;
            tables_series.push({ titre: group.paramName, xml: xml });
        }
    });

    return {
      "tables_series": tables_series,`;

  const startIndex = code.indexOf(endMarker);
  if(startIndex > -1) {
    code = code.substring(0, startIndex) + replacement + code.substring(startIndex + endMarker.length);
  }
  
  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
