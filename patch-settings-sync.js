import fs from 'fs';

let code = fs.readFileSync('src/views/Settings.tsx', 'utf8');

const search = `  // Lab Settings State
  const [formData, setFormData] = useState(labSettings);
  const [saved, setSaved] = useState(false);`;

const replacement = `  // Lab Settings State
  const [formData, setFormData] = useState(labSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFormData(labSettings);
  }, [labSettings]);`;

code = code.replace(search, replacement);

fs.writeFileSync('src/views/Settings.tsx', code);
