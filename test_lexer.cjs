const Lexer = require("docxtemplater/js/lexer.js");
try {
    const lexer = new Lexer({ tags: { 0: "Hello {{ {{demande.id}} }}" } });
    lexer.parse();
} catch (e) {
    console.log(e.message);
    if (e.properties && e.properties.errors) {
        console.log(e.properties.errors.map(err => err.properties.explanation || err.message).join("\n"));
    }
}
