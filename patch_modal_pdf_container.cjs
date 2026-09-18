const fs = require('fs');
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

// The docx component renderer nests the content in a shadow DOM or complex wrapper that html2pdf can't parse easily.
// Instead of trying to parse the docx renderer, we use html2pdf directly on the modal's scrollable container!

code = code.replace(/const generatePDF = \(\) => \{\s*const element = report\.templateId \? docxContainerRef\.current : pdfRef\.current;\s*if \(!element\) return;\s*const opt = \{[\s\S]*?html2pdf\(\)\.set\(opt\)\.from\(element\)\.save\(\);\s*\};/, 
`const generatePDF = () => {
    // If it's a Word template, we capture the parent container of the docx viewer
    // otherwise we capture the standard PDF ref.
    const element = report.templateId ? docxContainerRef.current?.parentElement : pdfRef.current;
    if (!element) return;
    const opt = {
      margin:       10,
      filename:     \`rapport-\${report.id}.pdf\`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };`);
  
fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
