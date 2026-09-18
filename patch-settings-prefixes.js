import fs from 'fs';

let code = fs.readFileSync('src/views/Settings.tsx', 'utf8');

const targetCertSection = `        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Certifications (séparées par des virgules)</label>
            <input
              type="text"
              name="isoCertifications"
              value={formData.isoCertifications.join(', ')}
              onChange={handleIsoChange}
              placeholder="ISO 9001:2015, ISO 17025:2017"
              className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-2">
              Ces certifications apparaîtront en bas de chaque rapport généré pour certifier la conformité des analyses.
            </p>
          </div>
        </div>
      </div>`;

const newPrefixSection = `        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Certifications (séparées par des virgules)</label>
            <input
              type="text"
              name="isoCertifications"
              value={formData.isoCertifications.join(', ')}
              onChange={handleIsoChange}
              placeholder="ISO 9001:2015, ISO 17025:2017"
              className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-2">
              Ces certifications apparaîtront en bas de chaque rapport généré pour certifier la conformité des analyses.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center">
            <Building className="w-5 h-5 mr-2 text-slate-400" />
            Configuration des Identifiants (Préfixes)
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Préfixe Demandes</label>
            <input
              type="text"
              value={formData.idPrefixes?.request || ''}
              onChange={(e) => {
                setFormData({ ...formData, idPrefixes: { ...formData.idPrefixes, request: e.target.value } as any });
                setSaved(false);
              }}
              className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="REQ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Préfixe Échantillons</label>
            <input
              type="text"
              value={formData.idPrefixes?.sample || ''}
              onChange={(e) => {
                setFormData({ ...formData, idPrefixes: { ...formData.idPrefixes, sample: e.target.value } as any });
                setSaved(false);
              }}
              className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="ECH"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Préfixe Enrobages</label>
            <input
              type="text"
              value={formData.idPrefixes?.subSample || ''}
              onChange={(e) => {
                setFormData({ ...formData, idPrefixes: { ...formData.idPrefixes, subSample: e.target.value } as any });
                setSaved(false);
              }}
              className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="ENR"
            />
          </div>
        </div>
      </div>`;

code = code.replace(targetCertSection, newPrefixSection);
fs.writeFileSync('src/views/Settings.tsx', code);
