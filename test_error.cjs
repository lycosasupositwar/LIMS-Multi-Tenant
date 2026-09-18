const Docxtemplater = require("docxtemplater");
try {
    new Docxtemplater().loadZip({file: () => {}}).compile(`Hello {{ {{demande.id}} }}`);
} catch (e) {
    console.log(e.message);
    if (e.properties && e.properties.errors) {
        console.log(e.properties.errors.map(err => err.properties.explanation || err.message).join("\n"));
    }
}
