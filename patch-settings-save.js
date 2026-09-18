import fs from 'fs';

let code = fs.readFileSync('src/views/Settings.tsx', 'utf8');

// We need to make sure setSaved(false) is called when the table styles are changed.
// Let's create a specific handler for table styles to keep it clean.

const targetHandler = `const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setSaved(false);
  };`;

const newHandler = `const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setSaved(false);
  };
  
  const handleTableStyleChange = (field: string, value: string | number) => {
    setFormData({ 
      ...formData, 
      tableStyles: { 
        ...formData.tableStyles, 
        [field]: value 
      } as any 
    });
    setSaved(false);
  };`;

code = code.replace(targetHandler, newHandler);

// Now update the onChange events in the form
code = code.replace(/onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, tableStyles: \{ \.\.\.formData\.tableStyles, headerBgColor: e\.target\.value\.replace\('#', ''\)\.toUpperCase\(\) \} as any \}\)\}/g, "onChange={(e) => handleTableStyleChange('headerBgColor', e.target.value.replace('#', '').toUpperCase())}");
code = code.replace(/onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, tableStyles: \{ \.\.\.formData\.tableStyles, borderColor: e\.target\.value\.replace\('#', ''\)\.toUpperCase\(\) \} as any \}\)\}/g, "onChange={(e) => handleTableStyleChange('borderColor', e.target.value.replace('#', '').toUpperCase())}");
code = code.replace(/onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, tableStyles: \{ \.\.\.formData\.tableStyles, borderSize: parseInt\(e\.target\.value\) \} as any \}\)\}/g, "onChange={(e) => handleTableStyleChange('borderSize', parseInt(e.target.value))}");

fs.writeFileSync('src/views/Settings.tsx', code);
