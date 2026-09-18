import fs from 'fs';
let code = fs.readFileSync('src/components/ReportPreviewModal.tsx', 'utf8');

const replacement = `
  const generatePDF = async () => {
    if (isDocx && report?.templateId) {
      alert("La conversion PDF directe des modèles Word personnalisés n'est pas supportée sur ce serveur.\\n\\nVeuillez utiliser le bouton 'Télécharger DOCX', puis utiliser l'option 'Enregistrer sous PDF' dans Word ou LibreOffice.");
      return;
    } else {
`;

code = code.replace(/const generatePDF = async \(\) => \{\n    if \(isDocx && report\?\.templateId\) \{[\s\S]*?\} else \{/, replacement.trim() + " {");
fs.writeFileSync('src/components/ReportPreviewModal.tsx', code);
