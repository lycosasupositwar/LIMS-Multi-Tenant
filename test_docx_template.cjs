const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const zip = new PizZip();
const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
  <w:body>
    <w:p><w:r><w:t>Hello {{demande.id}}</w:t></w:r></w:p>
    <mc:AlternateContent>
      <mc:Choice Requires="wps">
        <w:p><w:r><w:t>{{demande.id}}</w:t></w:r></w:p>
      </mc:Choice>
      <mc:Fallback>
        <w:p><w:r><w:t>{{demande.id}}</w:t></w:r></w:p>
      </mc:Fallback>
    </mc:AlternateContent>
  </w:body>
</w:document>`;

zip.file("word/document.xml", xml);
zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);

try {
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });
    console.log("Success");
} catch(e) {
    console.log("Error:", e.message);
    if (e.properties && e.properties.errors) {
        console.log(e.properties.errors.map(err => err.properties.explanation || err.message).join("\n"));
    }
}
