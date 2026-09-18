import fs from 'fs';

let code = fs.readFileSync('src/views/BuilderCMS.tsx', 'utf8');

// Replace {#...} with {{#...}} and {/...} with {{/...}} and {@...} with {{@...}} in the text strings and JSX expressions.

code = code.replace(/\{"\{#/g, '{"{{#');
code = code.replace(/\{"\{\//g, '{"{{/');
code = code.replace(/\{"\{@/g, '{"{{@');

// Also fix in raw text strings that don't use JSX expression brackets
code = code.replace(/<code>\{#/g, '<code>{{#');
code = code.replace(/<code>\{\//g, '<code>{{/');

// And inside descriptions
code = code.replace(/<code>\{"\{\#/g, '<code>{"{{#');
code = code.replace(/<code>\{"\{\//g, '<code>{"{{/');

fs.writeFileSync('src/views/BuilderCMS.tsx', code);
