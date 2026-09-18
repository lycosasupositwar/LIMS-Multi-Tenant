const libre = require('libreoffice-convert');
const { promisify } = require('util');
const libreConvertAsync = promisify(libre.convert);
console.log(libreConvertAsync);
