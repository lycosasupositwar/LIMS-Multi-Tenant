import fs from 'fs';

let code = fs.readFileSync('src/views/Settings.tsx', 'utf8');

const oldHandleTable = `  const handleTableStyleChange = (field: string, value: string | number) => {
    setFormData({ 
      ...formData, 
      tableStyles: { 
        ...formData.tableStyles, 
        [field]: value 
      } as any 
    });
    setSaved(false);
  };`;

const newHandleTable = `  const handleTableStyleChange = (field: string, value: string | number) => {
    const newSettings = { 
      ...formData, 
      tableStyles: { 
        ...formData.tableStyles, 
        [field]: value 
      } as any 
    };
    setFormData(newSettings);
    updateLabSettings(newSettings); // Auto-save for styles
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };`;

code = code.replace(oldHandleTable, newHandleTable);

fs.writeFileSync('src/views/Settings.tsx', code);
