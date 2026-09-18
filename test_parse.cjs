const { parse } = require("docxtemplater/js/lexer.js");
try {
    parse("Hello {{ {{dema", { delimiters: { start: '{{', end: '}}' } });
} catch (e) {
    console.log(e.message);
}
