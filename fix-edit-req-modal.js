import fs from 'fs';
let code = fs.readFileSync('src/components/EditRequestModal.tsx', 'utf8');

if (!code.includes('analysisTemplates')) {
  code = code.replace(/const \{ updateRequest, requestTemplates \} = useLims\(\);/, 'const { updateRequest, requestTemplates, analysisTemplates } = useLims();');
}

const target = `) : field.type === 'multiselect' ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.options?.map(opt => {`;

const replacement = `) : field.type === 'analyses' ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {analysisTemplates.filter(t => t.isActive !== false).map(tpl => {
                            const currentValues = customData[field.id] || [];
                            const isSelected = currentValues.includes(tpl.id);
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => {
                                  const newValues = isSelected
                                    ? currentValues.filter((v: string) => v !== tpl.id)
                                    : [...currentValues, tpl.id];
                                  handleCustomDataChange(field.id, newValues);
                                }}
                                className={\`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors \${
                                  isSelected
                                     ? 'bg-blue-100 text-blue-800 border-blue-300'
                                     : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }\`}
                              >
                                {tpl.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : field.type === 'multiselect' ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.options?.map(opt => {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/EditRequestModal.tsx', code);
