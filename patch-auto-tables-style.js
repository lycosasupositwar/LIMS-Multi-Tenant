import fs from 'fs';

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // We want to remove the hardcoded borders and shading, leaving only tblStyle so the user can style it in Word.
  // The current tbl string starts with:
  // let xml = \`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>...<w:tblCellMar>...
  
  // Let's replace the whole xml initialization
  const oldInit = /let xml = `(?:[^`]+)`\;/g;
  const newInit = 'let xml = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>`;';
  
  code = code.replace(oldInit, newInit);
  
  // For the header, we remove the shading (F2F2F2). Wait, if I remove shading, the header might look like normal text, unless the style specifies a header row.
  // We can keep the w:b (bold) for header.
  const oldHeaderTc = /<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"\/><w:vAlign w:val="center"\/><\/w:tcPr>/g;
  const newHeaderTc = '<w:tcPr><w:vAlign w:val="center"/></w:tcPr>';
  
  code = code.replace(oldHeaderTc, newHeaderTc);

  fs.writeFileSync(filePath, code);
}

updateFile('src/views/Reports.tsx');
updateFile('src/components/ReportPreviewModal.tsx');
