/**
 * Fenêtre Modale de Correction et Resoumission d'une Demande Rejetée
 * 
 * Permet au demandeur de modifier les paramètres d'une demande ayant fait
 * l'objet d'un refus technique par le manager de laboratoire :
 * - Rappel visible du motif du rejet formulé par le laboratoire
 * - Rechargement des valeurs préalablement saisies dans les champs dynamiques
 * - Modification des options et réactivation de la demande au statut 'soumise'
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLims } from '../store';
import { AnalysisRequest } from '../types';

/**
 * Propriétés attendues par la modale d'édition
 */
interface Props {
  /** Demande d'analyse cible */
  request: AnalysisRequest;
  /** Indicateur d'affichage de la modale */
  isOpen: boolean;
  /** Fonction de fermeture */
  onClose: () => void;
}

export function EditRequestModal({ request, isOpen, onClose }: Props) {
  const { requestTemplates, resubmitRequest, analysisTemplates, materialTemplates } = useLims();
  const [customData, setCustomData] = useState<Record<string, any>>({});

  const isReadOnly = request.status !== 'rejetee' && request.status !== 'brouillon';

  // Synchronisation des données personnalisées à l'ouverture de la modale
  useEffect(() => {
    if (isOpen) {
      setCustomData(request.customData);
    }
  }, [isOpen, request]);

  if (!isOpen) return null;

  // Récupération du gabarit de formulaire associé à cette demande
  const activeTemplate = requestTemplates.find(t => t.id === request.templateId);

  /**
   * Validation des corrections et transmission au gestionnaire d'état
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTemplate) return;

    resubmitRequest(request.id, customData);
    onClose();
  };

  /**
   * Met à jour une entrée dynamique dans le dictionnaire local
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
            <h2 className="text-xl font-display font-bold text-slate-900">
              {isReadOnly ? `Détails de la demande ${request.id}` : `Modifier la demande ${request.id}`}
            </h2>
            {!isReadOnly && (
              <p className="text-xs text-slate-500 mt-1">
                Corrigez les informations suite au refus du laboratoire
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Contenu et formulaire de correction */}
        <div className="p-6 overflow-y-auto">
          {/* Encadré d'avertissement avec le motif du rejet */}
          {request.rejectionReason && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <span className="font-semibold block mb-1">Motif du refus :</span>
              {request.rejectionReason}
            </div>
          )}

          <form id="edit-req-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Titre de la demande / Projet
                </label>
                <input 
                  type="text" 
                  disabled 
                  value={request.title} 
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg text-sm cursor-not-allowed" 
                />
                <p className="text-xs text-slate-400 mt-1">Le titre initial ne peut pas être modifié.</p>
              </div>
            </div>

            {/* Formulaire dynamique paramétré */}
            {activeTemplate && activeTemplate.fields.length > 0 && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center">
                  Informations complémentaires
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeTemplate.fields.map(field => (
                    <div key={field.id} className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {field.name} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      
                      {field.type === 'select' ? (
                        <select 
                          required={field.required}
                          value={customData[field.id] || ''} 
                          onChange={e => handleCustomDataChange(field.id, e.target.value)}
                          disabled={isReadOnly}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 ${isReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                        >
                          <option value="">Sélectionner...</option>
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'analyses' ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {analysisTemplates.filter(t => t.isActive !== false).map(tpl => {
                            const currentValues = customData[field.id] || [];
                            const isSelected = currentValues.includes(tpl.id);
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => {
                                  const newValues = isSelected
                                    ? currentValues.filter((v: string) => v !== tpl.id)
                                    : [...currentValues, tpl.id];
                                  handleCustomDataChange(field.id, newValues);
                                }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${!isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'} ${
                                  isSelected
                                     ? 'bg-blue-100 text-blue-800 border-blue-300'
                                     : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                } ${isReadOnly && !isSelected ? 'opacity-50' : ''}`}
                              >
                                {tpl.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : field.type === 'materials' ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {materialTemplates.filter(t => t.labId === request.labId && t.isActive !== false).map(tpl => {
                            const currentValues = customData[field.id] || [];
                            const isSelected = currentValues.includes(tpl.id);
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => {
                                  const newValues = isSelected
                                    ? currentValues.filter((v: string) => v !== tpl.id)
                                    : [...currentValues, tpl.id];
                                  handleCustomDataChange(field.id, newValues);
                                }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${isSelected ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white text-slate-600 border-slate-200'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                              >
                                {tpl.name}
                              </button>
                            );
                          })}
                          {materialTemplates.filter(t => t.labId === request.labId && t.isActive !== false && (customData[field.id] || []).includes(t.id)).map(tpl => {
                            const propertiesKey = `${field.id}__material_properties`;
                            const allProperties = customData[propertiesKey] || {};
                            const materialProperties = allProperties[tpl.id] || {};
                            const updateProperty = (propertyId: string, value: any) => handleCustomDataChange(propertiesKey, { ...allProperties, [tpl.id]: { ...materialProperties, [propertyId]: value } });
                            return <div key={`properties-${tpl.id}`} className="w-full mt-3 rounded-lg border border-emerald-200 bg-white p-3">
                              <h4 className="text-sm font-semibold text-emerald-800 mb-3">Propriétés — {tpl.name}</h4>
                              {tpl.fields.length === 0 ? <p className="text-xs text-slate-500">Ce modèle ne contient aucune propriété.</p> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {tpl.fields.map(property => <div key={property.id}>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">{property.name}{property.unit ? ` (${property.unit})` : ''}{property.required && <span className="text-red-500"> *</span>}</label>
                                  {property.type === 'select' ? <select required={property.required} disabled={isReadOnly} value={materialProperties[property.id] ?? ''} onChange={e => updateProperty(property.id, e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"><option value="">Sélectionner...</option>{property.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
                                  : property.type === 'multiselect' ? <div className="flex flex-wrap gap-2">{property.options?.map(opt => { const values = materialProperties[property.id] || []; const checked = values.includes(opt); return <button key={opt} type="button" disabled={isReadOnly} onClick={() => updateProperty(property.id, checked ? values.filter((v: string) => v !== opt) : [...values, opt])} className={`px-2 py-1 rounded border text-xs ${checked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'} ${isReadOnly ? 'opacity-70' : ''}`}>{opt}</button>; })}</div>
                                  : property.type === 'boolean' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={isReadOnly} checked={!!materialProperties[property.id]} onChange={e => updateProperty(property.id, e.target.checked)} />Oui</label>
                                  : <input type={property.type === 'number' ? 'number' : property.type === 'date' ? 'date' : 'text'} required={property.required} disabled={isReadOnly} value={materialProperties[property.id] ?? ''} onChange={e => updateProperty(property.id, property.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} className={`w-full px-2 py-1.5 border border-slate-300 rounded text-sm ${isReadOnly ? 'bg-slate-100 text-slate-500' : ''}`} />}
                                </div>)}
                              </div>}
                            </div>;
                          })}
                        </div>
                      ) : field.type === 'multiselect' ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.options?.map(opt => {
                            const currentValues = customData[field.id] || [];
                            const isSelected = currentValues.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => {
                                  const newValues = isSelected
                                    ? currentValues.filter((v: string) => v !== opt)
                                    : [...currentValues, opt];
                                  handleCustomDataChange(field.id, newValues);
                                }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${!isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'} ${
                                  isSelected 
                                    ? 'bg-blue-100 text-blue-800 border-blue-300' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                } ${isReadOnly && !isSelected ? 'opacity-50' : ''}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : field.type === 'boolean' ? (
                         <div className="flex items-center h-full">
                           <input 
                            type="checkbox"
                            checked={customData[field.id] || false}
                            onChange={e => handleCustomDataChange(field.id, e.target.checked)}
                            disabled={isReadOnly}
                            className={`w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 ${isReadOnly ? 'cursor-not-allowed' : ''}`}
                           />
                           <span className="ml-2 text-sm text-slate-600">Oui</span>
                         </div>
                      ) : field.type === 'date' ? (
                        <input 
                          type="date"
                          required={field.required}
                          value={customData[field.id] || ''} 
                          onChange={e => handleCustomDataChange(field.id, e.target.value)}
                          disabled={isReadOnly}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 ${isReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                        />
                      ) : (
                        <input 
                          type={field.type === 'number' ? 'number' : 'text'} 
                          required={field.required}
                          value={customData[field.id] || ''} 
                          onChange={e => handleCustomDataChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                          disabled={isReadOnly}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 ${isReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
        
        {/* Boutons d'action */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl shrink-0 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            {isReadOnly ? 'Fermer' : 'Annuler'}
          </button>
          {!isReadOnly && (
            <button 
              type="submit" 
              form="edit-req-form" 
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              Mettre à jour et Resoumettre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
