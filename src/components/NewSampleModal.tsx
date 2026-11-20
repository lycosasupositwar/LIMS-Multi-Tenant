/**
 * Fenêtre Modale de Réception et Enregistrement d'un Échantillon Physique
 * 
 * Ce composant permet aux techniciens de réception du laboratoire :
 * 1. D'enregistrer un nouvel échantillon (Client, Projet, Priorité)
 * 2. De classifier la matière selon un gabarit de matériau (Poudre, Fritté, Massif, Liquide)
 * 3. De renseigner les caractéristiques techniques dynamiques définies pour ce matériau
 * 4. De générer automatiquement un code-barres unique et un identifiant d'échantillon
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLims } from '../store';
import { Sample, Priority, MaterialState, SampleStatus } from '../types';

/**
 * Propriétés attendues par la modale
 */
interface Props {
  /** Contrôle de visibilité */
  isOpen: boolean;
  /** Callback de fermeture */
  onClose: () => void;
}

export function NewSampleModal({ isOpen, onClose }: Props) {
  const { materialTemplates, addSample, labSettings, activeLabId } = useLims();
  const activeTemplates = materialTemplates.filter(t => t.isActive !== false);
  
  // États locaux du formulaire
  const [selectedTemplateId, setSelectedTemplateId] = useState(activeTemplates[0]?.id || '');
  const [client, setClient] = useState('');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState<Priority>('normale');
  const [materialState, setMaterialState] = useState<MaterialState>('Massif');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const activeTemplate = activeTemplates.find(t => t.id === selectedTemplateId);

  /**
   * Création et insertion de l'échantillon dans le catalogue
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;

    const prefix = labSettings?.idPrefixes?.sample || 'ECH';
    const newSample: Sample = {
      // Génération de l'ID séquentiel
      id: `${prefix}-${new Date().getFullYear().toString().slice(2)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      labId: activeLabId,
      // Génération du code-barres basé sur la catégorie matière
      barcode: `${activeTemplate.category.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`,
      templateId: activeTemplate.id,
      materialState,
      status: 'receptionne',
      receivedAt: new Date().toISOString(),
      client,
      project,
      priority,
      customData,
      images: [],
      notes
    };

    addSample(newSample);
    onClose();
  };

  /**
   * Enregistrement des valeurs des champs dynamiques
   */
  const handleCustomDataChange = (fieldId: string, value: any) => {
    setCustomData(prev => ({ ...prev, [fieldId]: value }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center overflow-y-auto py-10">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl m-4 flex flex-col max-h-full">
        {/* En-tête de la modale */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900">Enregistrer un Échantillon</h2>
            <p className="text-xs text-slate-500 mt-1">Saisie des informations et métadonnées du prélèvement</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="new-sample-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Informations Administratives Générales */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Informations Générales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                  <input 
                    type="text" 
                    required 
                    value={client} 
                    onChange={e => setClient(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" 
                    placeholder="Nom du client" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projet / Chantier</label>
                  <input 
                    type="text" 
                    required 
                    value={project} 
                    onChange={e => setProject(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" 
                    placeholder="Référence projet" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value as Priority)} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Typage et État Physique du Matériau */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Classification Matériau</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie / Modèle (CMS)</label>
                  <select 
                    value={selectedTemplateId} 
                    onChange={e => {
                      setSelectedTemplateId(e.target.value);
                      setCustomData({}); // Réinitialisation des attributs spécifiques lors d'un changement de modèle
                    }} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 font-medium text-blue-700 bg-blue-50"
                  >
                    {activeTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">État physique</label>
                  <select 
                    value={materialState} 
                    onChange={e => setMaterialState(e.target.value as MaterialState)} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Massif">Massif (Pièce, Lingot...)</option>
                    <option value="Fritté">Fritté</option>
                    <option value="Poudre">Poudre</option>
                    <option value="Liquide">Liquide / Pâte</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Champs Spécifiques Configurés pour ce Modèle */}
            {activeTemplate && activeTemplate.fields.length > 0 && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center">
                  Propriétés Spécifiques ({activeTemplate.name})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeTemplate.fields.map(field => (
                    <div key={field.id} className="sm:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {field.name} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      
                      {field.type === 'select' ? (
                        <select 
                          required={field.required}
                          value={customData[field.id] || ''} 
                          onChange={e => handleCustomDataChange(field.id, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Sélectionner...</option>
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'multiselect' ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.options?.map(opt => {
                            const currentValues = customData[field.id] || [];
                            const isSelected = currentValues.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  const newValues = isSelected
                                    ? currentValues.filter((v: string) => v !== opt)
                                    : [...currentValues, opt];
                                  handleCustomDataChange(field.id, newValues);
                                }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-100 text-blue-800 border-blue-300' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="relative">
                          <input 
                            type={field.type === 'number' ? 'number' : 'text'} 
                            required={field.required}
                            value={customData[field.id] || ''} 
                            onChange={e => handleCustomDataChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                          {field.unit && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-slate-500 sm:text-sm">{field.unit}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remarques libres de l'opérateur */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Observations</label>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                rows={3} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" 
                placeholder="Remarques éventuelles lors de la réception..." 
              />
            </div>

          </form>
        </div>
        
        {/* Pied de modale avec validation */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl shrink-0 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            form="new-sample-form" 
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
          >
            Enregistrer l'échantillon
          </button>
        </div>
      </div>
    </div>
  );
}
