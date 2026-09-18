import fs from 'fs';

let code = fs.readFileSync('src/views/Reports.tsx', 'utf8');

code = code.replace(
  /const \{ reports, requests, samples, analyses, analysisTemplates, currentUser, users, reportTemplates \} = useLims\(\);/g,
  'const { reports, requests, samples, analyses, analysisTemplates, currentUser, users, reportTemplates, labSettings } = useLims();'
);

// Now patch the table initialization in both Reports.tsx and ReportPreviewModal.tsx
function patchXml(code) {
  // Replace the XML initialization with dynamic values from labSettings.tableStyles
  const oldTableInit = /let xml = \`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"\/><w:tblW w:w="5000" w:type="pct"\/><w:tblBorders>.*?<\/w:tblCellMar><\/w:tblPr>\`;/g;
  
  const newTableInit = `
            const tColor = labSettings?.tableStyles?.borderColor || "000000";
            const tSize = labSettings?.tableStyles?.borderSize ?? 4;
            let xml = \`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="\${tSize > 0 ? 'single' : 'none'}" w:sz="\${tSize}" w:space="0" w:color="\${tColor}"/><w:left w:val="\${tSize > 0 ? 'single' : 'none'}" w:sz="\${tSize}" w:space="0" w:color="\${tColor}"/><w:bottom w:val="\${tSize > 0 ? 'single' : 'none'}" w:sz="\${tSize}" w:space="0" w:color="\${tColor}"/><w:right w:val="\${tSize > 0 ? 'single' : 'none'}" w:sz="\${tSize}" w:space="0" w:color="\${tColor}"/><w:insideH w:val="\${tSize > 0 ? 'single' : 'none'}" w:sz="\${tSize}" w:space="0" w:color="\${tColor}"/><w:insideV w:val="\${tSize > 0 ? 'single' : 'none'}" w:sz="\${tSize}" w:space="0" w:color="\${tColor}"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>\`;`;

  code = code.replace(oldTableInit, newTableInit);

  // Replace header cells
  const oldHeaderInit = /const addHeaderCell = \(text: string\) => \{ xml \+= \`<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"\/><w:vAlign w:val="center"\/><\/w:tcPr>/g;
  
  const newHeaderInit = 'const addHeaderCell = (text: string) => { xml += `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${labSettings?.tableStyles?.headerBgColor || "E2E8F0"}"/><w:vAlign w:val="center"/></w:tcPr>';

  code = code.replace(oldHeaderInit, newHeaderInit);
  
  return code;
}

code = patchXml(code);
fs.writeFileSync('src/views/Reports.tsx', code);

let previewCode = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');
previewCode = patchXml(previewCode);
fs.writeFileSync('src/components/ReportPreviewModal.tsx', previewCode);

