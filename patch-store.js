import fs from 'fs';

let code = fs.readFileSync('src/store.tsx', 'utf8');

const target = `const defaultLabSettings: LabSettings = {
  labName: 'Laboratoire Central d\\'Expertise',
  labAddress: '123 Avenue des Sciences, 75000 Paris, France',
  contactEmail: 'contact@labo-expertise.fr',
  phone: '+33 1 23 45 67 89',
  isoCertifications: ['ISO 9001:2015', 'ISO 17025:2017'],
  logoUrl: ''
};`;

const replacement = `const defaultLabSettings: LabSettings = {
  labName: 'Laboratoire Central d\\'Expertise',
  labAddress: '123 Avenue des Sciences, 75000 Paris, France',
  contactEmail: 'contact@labo-expertise.fr',
  phone: '+33 1 23 45 67 89',
  isoCertifications: ['ISO 9001:2015', 'ISO 17025:2017'],
  logoUrl: '',
  tableStyles: {
    headerBgColor: 'E2E8F0',
    borderColor: '000000',
    borderSize: 4
  }
};`;

code = code.replace(target, replacement);
fs.writeFileSync('src/store.tsx', code);
