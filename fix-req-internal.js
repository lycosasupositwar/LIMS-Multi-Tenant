import fs from 'fs';
let code = fs.readFileSync('src/views/RequestsInternal.tsx', 'utf8');

const target = `                        if (typeof value === 'boolean') {
                          displayValue = value ? 'Oui' : 'Non';
                        } else if (Array.isArray(value)) {
                          displayValue = value.join(', ');
                        }`;

const replacement = `                        if (typeof value === 'boolean') {
                          displayValue = value ? 'Oui' : 'Non';
                        } else if (field?.type === 'analyses' && Array.isArray(value)) {
                          displayValue = value.map(id => analysisTemplates.find(a => a.id === id)?.name || id).join(', ');
                        } else if (Array.isArray(value)) {
                          displayValue = value.join(', ');
                        }`;

code = code.replace(target, replacement);

const target2 = `                                  Array.isArray(value) ? (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {value.map(v => (
                                        <span key={v} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-medium">
                                          {v}`;

const replacement2 = `                                  Array.isArray(value) ? (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {value.map(v => (
                                        <span key={v} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-medium">
                                          {field?.type === 'analyses' ? (analysisTemplates.find(a => a.id === v)?.name || v) : v}`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/views/RequestsInternal.tsx', code);
