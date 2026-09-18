const fs = require('fs');
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

// The LibreOffice conversion is failing on the environment because LibreOffice is blocking during install
// We need to revert back to using the robust client-side HTML2PDF method to ensure the customer has a working solution.

code = code.replace(/const generatePDF = async \(\) => \{[\s\S]*?html2pdf\(\)\.set\(opt\)\.from\(element\)\.save\(\);\s*\};/, 
`const generatePDF = () => {
    const element = report.templateId ? docxContainerRef.current : pdfRef.current;
    if (!element) return;
    const opt = {
      margin:       10,
      filename:     \`rapport-\${report.id}.pdf\`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };`);
  
fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
