import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Replace table initialization to include explicit borders and cell margins
  const oldTableInit = /let xml = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"\/><w:tblW w:w="5000" w:type="pct"\/><\/w:tblPr>`;/g;
  
  const newTableInit = `let xml = \`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>\`;`;

  code = code.replace(oldTableInit, newTableInit);

  // Add grey shading to the headers
  const headerSearch = /const addHeaderCell = \(text: string\) => \{ xml \+= `<w:tc><w:tcPr><w:vAlign w:val="center"\/><\/w:tcPr>/g;
  const headerReplace = 'const addHeaderCell = (text: string) => { xml += `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:vAlign w:val="center"/></w:tcPr>';
  
  code = code.replace(headerSearch, headerReplace);

  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
