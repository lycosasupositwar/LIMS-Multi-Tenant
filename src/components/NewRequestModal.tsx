/**
 * Fenêtre Modale de Création d'une Demande d'Analyse (Multi-Laboratoires)
 * 
 * Permet au demandeur (ou à un opérateur interne) de créer une nouvelle demande :
 * 1. Sélection explicite du laboratoire technique destinataire (Métallographie ou Mécanique)
 * 2. Chargement dynamique des formulaires configurés dans le CMS pour ce laboratoire
 * 3. Affichage et validation des champs personnalisés (textes, listes, sélecteurs d'analyses)
 * 4. Génération de l'identifiant selon le préfixe propre au laboratoire (ex: REQ-MET-26-XXX ou REQ-MEC-26-XXX)
 */

import React, { useState, useEffect } from 'react';
import { X, Building2, Layers, CheckCircle2 } from 'lucide-react';
import { useLims } from '../store';
import { AnalysisRequest } from '../types';

interface Props {
  /** État d'ouverture de la modale */
  isOpen: boolean;
  /** Fonction de fermeture */
  onClose: () => void;
}

export function NewRequestModal({ isOpen, onClose }: Props) {
  const { 
    currentUser, 
    laboratories, 
    activeLabId, 
    allRequestTemplates, 
    allAnalysisTemplates, 
    addRequest 
  } = useLims();
  
  // Laboratoire sélectionné pour la demande (par défaut le lab actif ou le premier disponible)
  const [selectedLabId, setSelectedLabId] = useState<string>(activeLabId || laboratories[0]?.id || '');
  
  
  // Modèles de formulaires disponibles pour le laboratoire choisi
  const labTemplates = allRequestTemplates.filter(t => t.labId === selectedLabId && t.isActive !== false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const [title, setTitle] = useState('');
  const [customData, setCustomData] = useState<Record<string, any>>({});

  // Synchronisation du modèle par défaut lors du changement de laboratoire
  useEffect(() => {
    const available = allRequestTemplates.filter(t => t.labId === selectedLabId && t.isActive !== false);
    if (available.length > 0) {
      setSelectedTemplateId(available[0].id);
    } else {
      setSelectedTemplateId('');
    }
    setCustomData({});
  }, [selectedLabId, allRequestTemplates]);

  if (!isOpen) return null;

  const targetLab = laboratories.find(l => l.id === selectedLabId) || laboratories[0];
  const activeTemplate = labTemplates.find(t => t.id === selectedTemplateId) || labTemplates[0];
  
  // Analyses disponibles configurées dans le CMS pour ce laboratoire spécifique
  const availableAnalyses = allAnalysisTemplates.filter(a => a.labId === selectedLabId && a.isActive !== false);

  /**
   * Enregistrement de la nouvelle demande avec assignation du laboratoire
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeTemplate) return;

    const prefix = targetLab.settings?.idPrefixes?.request || 'REQ';
    const newRequest: AnalysisRequest = {
      id: `${prefix}-${new Date().getFullYear().toString().slice(2)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      labId: selectedLabId,
      requesterId: currentUser.id,
      templateId: activeTemplate.id,
      title,
      status: 'soumise',
      createdAt: new Date().toISOString(),
      customData,
      auditTrail: []
    };

    addRequest(newRequest);
    onClose();
  };

  const handleCustomDataChange = (fieldId: string, value: any) => {
    setCustomData(prev => ({ ...prev, [fieldId]: value }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center overflow-y-auto py-10">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl m-4 flex flex-col max-h-full border border-slate-200">
        {/* En-tête de la modale */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900">Nouvelle Demande d'Analyse</h2>
            <p className="text-xs text-slate-500 mt-1">
              Sélectionnez le laboratoire destinataire et renseignez les spécifications de votre commande
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Corps du formulaire */}
        <div className="p-6 overflow-y-auto">
          <form id="new-req-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Choix du laboratoire technique destinataire */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Laboratoire Destinataire *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {laboratories.map((lab, index) => {
                  const isSelected = lab.id === selectedLabId;
                  const color = getLabColor(index);
                  return (
                    <div
                      key={lab.id}
                      onClick={() => setSelectedLabId(lab.id)}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? `${color.borderDark} ${color.bgFade} ${color.ring}`
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 ${color.main}`} />
                          <span className="font-bold text-sm text-slate-900">{lab.shortName}</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${color.light} ${color.text}`}>
                          {lab.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {lab.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Informations générales de la commande */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Spécifications du Dossier
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Intitulé du projet / Réf. Pièce *
                </label>
                <input 
                  type="text" 
                  required 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Ex: Expertise métallurgique lot aube Inconel 718" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type de prestation / Formulaire CMS *
                </label>
                <select 
                  value={selectedTemplateId} 
                  onChange={e => {
                    setSelectedTemplateId(e.target.value);
                    setCustomData({});
                  }} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {labTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">{activeTemplate?.description}</p>
              </div>
            </div>

            {/* 3. Champs dynamiques générés selon le CMS du laboratoire */}
            {activeTemplate && activeTemplate.fields.length > 0 && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Paramètres d'analyse requis
                  </h3>
                </div>

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
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Sélectionner une option...</option>
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'analyses' ? (
                        /* Catalogue des essais du laboratoire actif */
                        <div className="flex flex-wrap gap-2 mt-2">
                          {availableAnalyses.map(tpl => {
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
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                  isSelected
                                     ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                     : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {tpl.name}
                              </button>
                            );
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
                                onClick={() => {
                                  const newValues = isSelected
                                    ? currentValues.filter((v: string) => v !== opt)
                                    : [...currentValues, opt];
                                  handleCustomDataChange(field.id, newValues);
                                }}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                                  isSelected 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : field.type === 'boolean' ? (
                         <div className="flex items-center mt-1">
                           <input 
                            type="checkbox"
                            id={`check-${field.id}`}
                            checked={customData[field.id] || false}
                            onChange={e => handleCustomDataChange(field.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                           />
                           <label htmlFor={`check-${field.id}`} className="ml-2 text-sm text-slate-700 cursor-pointer">
                             Confirmer (Oui)
                           </label>
                         </div>
                      ) : field.type === 'date' ? (
                        <input 
                          type="date"
                          required={field.required}
                          value={customData[field.id] || ''} 
                          onChange={e => handleCustomDataChange(field.id, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <input 
                          type={field.type === 'number' ? 'number' : 'text'} 
                          required={field.required}
                          value={customData[field.id] || ''} 
                          onChange={e => handleCustomDataChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
        
        {/* Actions en pied de modale */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            form="new-req-form" 
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs cursor-pointer"
          >
            Transmettre au laboratoire
          </button>
        </div>
      </div>
    </div>
  );
}
