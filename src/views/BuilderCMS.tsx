import React, { useState, useRef, useEffect } from 'react';
import { useLims } from '../store';
import { Plus, Settings2, GripVertical, Database, Layers, TestTube2, Check, X, FileText, ArrowUp, ArrowDown, Trash2, Copy, Edit2, UploadCloud, Building2 } from 'lucide-react';
import { MaterialTemplate, CustomField, AnalysisTemplate, ExpectedResult, RequestTemplate, ReportTemplate } from '../types';

export function BuilderCMS() {
  const {
    materialTemplates, analysisTemplates, requestTemplates, reportTemplates,
    updateMaterialTemplate, updateRequestTemplate, updateAnalysisTemplate, updateReportTemplate,
    addMaterialTemplate, addAnalysisTemplate, addRequestTemplate, addReportTemplate,
    deleteMaterialTemplate, deleteAnalysisTemplate, deleteRequestTemplate, deleteReportTemplate,
    activeLabId, activeLab, laboratories, setActiveLabId
  } = useLims();
  const [builderTab, setBuilderTab] = useState<'materials' | 'analyses' | 'requests' | 'reports'>('materials');
  const [activeMaterialTpl, setActiveMaterialTpl] = useState<MaterialTemplate | null>(materialTemplates[0] || null);
  const [activeAnalysisTpl, setActiveAnalysisTpl] = useState<AnalysisTemplate | null>(analysisTemplates[0] || null);
  const [activeRequestTpl, setActiveRequestTpl] = useState<RequestTemplate | null>(requestTemplates[0] || null);
  const [activeReportTpl, setActiveReportTpl] = useState<ReportTemplate | null>(reportTemplates?.[0] || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronise les données du modèle sélectionné sans perdre la sélection
  // lorsque le store est mis à jour pendant la saisie.
  useEffect(() => {
    setActiveMaterialTpl(current => {
      const selected = current && materialTemplates.find(tpl => tpl.id === current.id);
      return selected || materialTemplates[0] || null;
    });
  }, [activeLabId, materialTemplates]);

  useEffect(() => {
    setActiveAnalysisTpl(current => {
      const selected = current && analysisTemplates.find(tpl => tpl.id === current.id);
      return selected || analysisTemplates[0] || null;
    });
  }, [activeLabId, analysisTemplates]);

  useEffect(() => {
    setActiveRequestTpl(current => {
      const selected = current && requestTemplates.find(tpl => tpl.id === current.id);
      return selected || requestTemplates[0] || null;
    });
  }, [activeLabId, requestTemplates]);

  useEffect(() => {
    setActiveReportTpl(current => {
      const selected = current && reportTemplates?.find(tpl => tpl.id === current.id);
      return selected || reportTemplates?.[0] || null;
    });
  }, [activeLabId, reportTemplates]);

  const [isAddingField, setIsAddingField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<string>('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag).then(() => {
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
    }).catch(err => {
      // Fallback for iframes where navigator.clipboard might fail without permission
      const textArea = document.createElement("textarea");
      textArea.value = tag;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedTag(tag);
        setTimeout(() => setCopiedTag(null), 2000);
      } catch (e) {
        console.warn("Failed to copy", e);
      }
      document.body.removeChild(textArea);
    });
  };

  const handleEditFieldClick = (field: any) => {
    setEditingFieldId(field.id);
    setNewFieldName(field.name);
    setNewFieldType(field.type);
    setNewFieldUnit(field.unit || '');
    setNewFieldOptions(field.options ? field.options.join(', ') : '');
    setNewFieldRequired(field.required || false);
    setIsAddingField(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (activeReportTpl && event.target?.result) {
          const base64Data = event.target.result.toString();
          const updated = { ...activeReportTpl, fileName: file.name, fileData: base64Data };
          updateReportTemplate(activeReportTpl.id, updated);
          setActiveReportTpl(updated);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn("Erreur lors de l'import Word:", err);
      alert("Erreur lors de la lecture du fichier Word. Assurez-vous qu'il s'agit bien d'un .docx");
    }
  };


  const handleAddField = () => {
    if (!newFieldName) return;

    const parsedOptions = ['select', 'multiselect', 'vertical_table'].includes(newFieldType) && newFieldOptions.trim()
      ? newFieldOptions.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
      : undefined;

    const newFieldId = editingFieldId || `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    if (builderTab === 'analyses' && activeAnalysisTpl) {
      const newResult: ExpectedResult = {
        id: newFieldId,
        name: newFieldName,
        type: newFieldType as ExpectedResult['type'],
        unit: newFieldUnit || undefined,
        options: parsedOptions,
        required: newFieldRequired
      };
      const updatedTemplate = {
        ...activeAnalysisTpl,
        expectedResults: editingFieldId
          ? activeAnalysisTpl.expectedResults.map(f => f.id === editingFieldId ? newResult : f)
          : [...activeAnalysisTpl.expectedResults, newResult]
      };
      updateAnalysisTemplate(activeAnalysisTpl.id, updatedTemplate);
      setActiveAnalysisTpl(updatedTemplate);
    } else {
      const newField: CustomField = {
        id: newFieldId,
        name: newFieldName,
        type: newFieldType as CustomField['type'],
        unit: newFieldUnit || undefined,
        options: parsedOptions,
        required: newFieldRequired
      };

      if (builderTab === 'materials' && activeMaterialTpl) {
        const updatedTemplate = {
          ...activeMaterialTpl,
          fields: editingFieldId
            ? activeMaterialTpl.fields.map(f => f.id === editingFieldId ? newField : f)
            : [...activeMaterialTpl.fields, newField]
        };
        updateMaterialTemplate(activeMaterialTpl.id, updatedTemplate);
        setActiveMaterialTpl(updatedTemplate);
      } else if (builderTab === 'requests' && activeRequestTpl) {
        const updatedTemplate = {
          ...activeRequestTpl,
          fields: editingFieldId
            ? activeRequestTpl.fields.map(f => f.id === editingFieldId ? newField : f)
            : [...activeRequestTpl.fields, newField]
        };
        updateRequestTemplate(activeRequestTpl.id, updatedTemplate);
        setActiveRequestTpl(updatedTemplate);
      }
    }

    setIsAddingField(false);
    setEditingFieldId(null);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldUnit('');
    setNewFieldOptions('');
    setNewFieldRequired(false);
  };

  const handleRemoveField = (idToRemove: string) => {
    if (builderTab === 'materials' && activeMaterialTpl) {
      const updatedTemplate = {
        ...activeMaterialTpl,
        fields: activeMaterialTpl.fields.filter(f => f.id !== idToRemove)
      };
      updateMaterialTemplate(activeMaterialTpl.id, updatedTemplate);
      setActiveMaterialTpl(updatedTemplate);
    } else if (builderTab === 'requests' && activeRequestTpl) {
      const updatedTemplate = {
        ...activeRequestTpl,
        fields: activeRequestTpl.fields.filter(f => f.id !== idToRemove)
      };
      updateRequestTemplate(activeRequestTpl.id, updatedTemplate);
      setActiveRequestTpl(updatedTemplate);
    } else if (builderTab === 'analyses' && activeAnalysisTpl) {
      const updatedTemplate = {
        ...activeAnalysisTpl,
        expectedResults: activeAnalysisTpl.expectedResults.filter(f => f.id !== idToRemove)
      };
      updateAnalysisTemplate(activeAnalysisTpl.id, updatedTemplate);
      setActiveAnalysisTpl(updatedTemplate);
    }
  };

  const handleAddTemplate = () => {
    if (builderTab === 'materials') {
      const newId = `MAT-${Date.now()}`;
      const newTpl: MaterialTemplate = {
        id: newId,
        labId: activeLabId,
        name: 'Nouveau Matériau',
        category: 'Métal',
        description: 'Description du matériau',
        fields: []
      };
      addMaterialTemplate(newTpl);
      setActiveMaterialTpl(newTpl);
    } else if (builderTab === 'analyses') {
      const newId = `ANA-${Date.now()}`;
      const newTpl: AnalysisTemplate = {
        id: newId,
        labId: activeLabId,
        name: 'Nouvelle Analyse',
        category: 'Général',
        description: 'Description de l\'analyse',
        expectedResults: []
      };
      addAnalysisTemplate(newTpl);
      setActiveAnalysisTpl(newTpl);
    } else if (builderTab === 'requests') {
      const newId = `REQ-${Date.now()}`;
      const newTpl: RequestTemplate = {
        id: newId,
        labId: activeLabId,
        name: 'Nouveau Formulaire',
        description: 'Description du formulaire',
        fields: []
      };
      addRequestTemplate(newTpl);
      setActiveRequestTpl(newTpl);
    } else if (builderTab === 'reports') {
      const newId = `RPT-${Date.now()}`;
      const newTpl: ReportTemplate = {
        id: newId,
        labId: activeLabId,
        name: 'Nouveau Rapport',
        description: 'Description du modèle',
        content: '<h1>Nouveau Rapport</h1><p>Tapez votre contenu ici...</p>'
      };
      addReportTemplate(newTpl);
      setActiveReportTpl(newTpl);
    }
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (builderTab === 'materials' && activeMaterialTpl) {
      const fields = [...activeMaterialTpl.fields];
      if (direction === 'up' && index > 0) {
        [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
      } else if (direction === 'down' && index < fields.length - 1) {
        [fields[index + 1], fields[index]] = [fields[index], fields[index + 1]];
      }
      const updated = { ...activeMaterialTpl, fields };
      updateMaterialTemplate(activeMaterialTpl.id, updated);
      setActiveMaterialTpl(updated);
    } else if (builderTab === 'requests' && activeRequestTpl) {
      const fields = [...activeRequestTpl.fields];
      if (direction === 'up' && index > 0) {
        [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]];
      } else if (direction === 'down' && index < fields.length - 1) {
        [fields[index + 1], fields[index]] = [fields[index], fields[index + 1]];
      }
      const updated = { ...activeRequestTpl, fields };
      updateRequestTemplate(activeRequestTpl.id, updated);
      setActiveRequestTpl(updated);
    } else if (builderTab === 'analyses' && activeAnalysisTpl) {
      const expectedResults = [...activeAnalysisTpl.expectedResults];
      if (direction === 'up' && index > 0) {
        [expectedResults[index - 1], expectedResults[index]] = [expectedResults[index], expectedResults[index - 1]];
      } else if (direction === 'down' && index < expectedResults.length - 1) {
        [expectedResults[index + 1], expectedResults[index]] = [expectedResults[index], expectedResults[index + 1]];
      }
      const updated = { ...activeAnalysisTpl, expectedResults };
      updateAnalysisTemplate(activeAnalysisTpl.id, updated);
      setActiveAnalysisTpl(updated);
    }
  };

  const handleDeleteTemplate = () => {
    setShowDeleteConfirm(true);
  };

  const executeDelete = () => {
    if (builderTab === 'materials' && activeMaterialTpl) {
      deleteMaterialTemplate(activeMaterialTpl.id);
      const remaining = materialTemplates.filter(t => t.id !== activeMaterialTpl.id);
      setActiveMaterialTpl(remaining.length > 0 ? remaining[0] : null);
    } else if (builderTab === 'analyses' && activeAnalysisTpl) {
      deleteAnalysisTemplate(activeAnalysisTpl.id);
      const remaining = analysisTemplates.filter(t => t.id !== activeAnalysisTpl.id);
      setActiveAnalysisTpl(remaining.length > 0 ? remaining[0] : null);
    } else if (builderTab === 'requests' && activeRequestTpl) {
      deleteRequestTemplate(activeRequestTpl.id);
      const remaining = requestTemplates.filter(t => t.id !== activeRequestTpl.id);
      setActiveRequestTpl(remaining.length > 0 ? remaining[0] : null);
    } else if (builderTab === 'reports' && activeReportTpl) {
      deleteReportTemplate(activeReportTpl.id);
      const remaining = reportTemplates?.filter(t => t.id !== activeReportTpl.id) || [];
      setActiveReportTpl(remaining.length > 0 ? remaining[0] : null);
    }
    setShowDeleteConfirm(false);
  };

  const handleCloneTemplate = () => {
    if (builderTab === 'materials' && activeMaterialTpl) {
      const newId = `MAT-${Date.now()}`;
      const newTpl: MaterialTemplate = {
        ...activeMaterialTpl,
        id: newId,
        name: `${activeMaterialTpl.name} (Copie)`,
      };
      addMaterialTemplate(newTpl);
      setActiveMaterialTpl(newTpl);
    } else if (builderTab === 'analyses' && activeAnalysisTpl) {
      const newId = `ANA-${Date.now()}`;
      const newTpl: AnalysisTemplate = {
        ...activeAnalysisTpl,
        id: newId,
        name: `${activeAnalysisTpl.name} (Copie)`,
      };
      addAnalysisTemplate(newTpl);
      setActiveAnalysisTpl(newTpl);
    } else if (builderTab === 'requests' && activeRequestTpl) {
      const newId = `REQ-${Date.now()}`;
      const newTpl: RequestTemplate = {
        ...activeRequestTpl,
        id: newId,
        name: `${activeRequestTpl.name} (Copie)`,
      };
      addRequestTemplate(newTpl);
      setActiveRequestTpl(newTpl);
    } else if (builderTab === 'reports' && activeReportTpl) {
      const newId = `RPT-${Date.now()}`;
      const newTpl: ReportTemplate = {
        ...activeReportTpl,
        id: newId,
        name: `${activeReportTpl.name} (Copie)`,
      };
      addReportTemplate(newTpl);
      setActiveReportTpl(newTpl);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">CMS Modulaire & Configuration</h2>
          <p className="text-sm text-slate-500 mt-1">Gérez les types de matériaux, les processus de préparation, et les formulaires de demande.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setBuilderTab('materials')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${builderTab === 'materials' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Modèles Matériaux
          </button>
          <button
            onClick={() => setBuilderTab('analyses')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${builderTab === 'analyses' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Modèles Analyses
          </button>
          <button
            onClick={() => setBuilderTab('requests')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${builderTab === 'requests' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Formulaires Client
          </button>
          <button
            onClick={() => setBuilderTab('reports')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${builderTab === 'reports' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Modèles Rapports
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Sidebar */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 flex items-center justify-between">
            <div className="flex items-center">
              {builderTab === 'materials' && <Layers className="w-5 h-5 mr-2 text-slate-400" />}
              {builderTab === 'analyses' && <TestTube2 className="w-5 h-5 mr-2 text-slate-400" />}
              {builderTab === 'requests' && <FileText className="w-5 h-5 mr-2 text-slate-400" />}
              {builderTab === 'reports' && <FileText className="w-5 h-5 mr-2 text-slate-400" />}
              {builderTab === 'materials' ? 'Matériaux' : builderTab === 'analyses' ? 'Analyses' : builderTab === 'requests' ? 'Formulaires' : 'Rapports'}
            </div>
            <button onClick={handleAddTemplate} className="text-blue-600 p-1 hover:bg-blue-50 rounded"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {builderTab === 'materials' && materialTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setActiveMaterialTpl(tpl)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors border ${activeMaterialTpl?.id === tpl.id
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                  } ${tpl.isActive === false ? 'opacity-50 grayscale' : ''}`}
              >
                <div className="font-medium flex justify-between">
                  <span>{tpl.name}</span>
                  {tpl.isActive === false && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Inactif</span>}
                </div>
                <div className="text-xs mt-0.5 opacity-70">{tpl.category}</div>
              </button>
            ))}
            {builderTab === 'reports' && reportTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setActiveReportTpl(tpl)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors border ${activeReportTpl?.id === tpl.id
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                  } ${tpl.isActive === false ? 'opacity-50 grayscale' : ''}`}
              >
                <div className="font-medium flex justify-between">
                  <span>{tpl.name}</span>
                  {tpl.isActive === false && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Inactif</span>}
                </div>
                <div className="text-xs mt-0.5 opacity-70 flex justify-between">
                  <span>{tpl.type === 'certificate' ? 'Certificat' : 'Rapport'}</span>
                  <span>{tpl.fileName ? 'Word (.docx)' : 'HTML'}</span>
                </div>
              </button>
            ))}


            {builderTab === 'analyses' && analysisTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setActiveAnalysisTpl(tpl)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors border ${activeAnalysisTpl?.id === tpl.id
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                  } ${tpl.isActive === false ? 'opacity-50 grayscale' : ''}`}
              >
                <div className="font-medium flex justify-between">
                  <span>{tpl.name}</span>
                  {tpl.isActive === false && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Inactif</span>}
                </div>
                <div className="text-xs mt-0.5 opacity-70">{tpl.category}</div>
              </button>
            ))}

            {builderTab === 'requests' && requestTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setActiveRequestTpl(tpl)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors border ${activeRequestTpl?.id === tpl.id
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-700'
                  } ${tpl.isActive === false ? 'opacity-50 grayscale' : ''}`}
              >
                <div className="font-medium flex justify-between">
                  <span>{tpl.name}</span>
                  {tpl.isActive === false && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Inactif</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Builder Area */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {builderTab === 'materials' && activeMaterialTpl && (
            <>
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    value={activeMaterialTpl.name}
                    onChange={e => {
                      const updated = { ...activeMaterialTpl, name: e.target.value };
                      updateMaterialTemplate(activeMaterialTpl.id, updated);
                      setActiveMaterialTpl(updated);
                    }}
                    className="font-semibold text-lg text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-full placeholder-slate-400"
                    placeholder="Nom du Modèle de Matériau"
                  />
                  <input
                    type="text"
                    value={activeMaterialTpl.description}
                    onChange={e => {
                      const updated = { ...activeMaterialTpl, description: e.target.value };
                      updateMaterialTemplate(activeMaterialTpl.id, updated);
                      setActiveMaterialTpl(updated);
                    }}
                    className="text-xs text-slate-500 mt-0.5 bg-transparent border-none focus:ring-0 p-0 w-full placeholder-slate-300"
                    placeholder="Description..."
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={activeMaterialTpl.isActive !== false}
                        onChange={e => {
                          const updated = { ...activeMaterialTpl, isActive: e.target.checked };
                          updateMaterialTemplate(activeMaterialTpl.id, updated);
                          setActiveMaterialTpl(updated);
                        }}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${activeMaterialTpl.isActive !== false ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${activeMaterialTpl.isActive !== false ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-medium text-slate-700">
                      {activeMaterialTpl.isActive !== false ? 'Actif' : 'Inactif'}
                    </div>
                  </label>
                  <button onClick={() => setIsOptionsOpen(true)} className="text-sm font-medium text-slate-600 hover:text-blue-700 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Settings2 className="w-4 h-4 mr-1.5" />
                    Options
                  </button>
                  <button onClick={handleCloneTemplate} className="text-sm font-medium text-slate-600 hover:text-emerald-600 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Copy className="w-4 h-4 mr-1.5" />
                    Dupliquer
                  </button>
                  <button onClick={handleDeleteTemplate} className="text-sm font-medium text-slate-600 hover:text-red-600 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Formulaire de Prélèvement (Champs Personnalisés)</h4>
                <div className="space-y-3">
                  {activeMaterialTpl.fields.map((field, index) => (
                    <div key={field.id} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex items-center group transition-all hover:border-blue-300">
                      <div className="flex flex-col text-slate-300 mr-3 gap-1">
                        <button onClick={() => handleMoveField(index, 'up')} disabled={index === 0} className="hover:text-blue-500 disabled:opacity-30 p-0.5"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => handleMoveField(index, 'down')} disabled={index === activeMaterialTpl.fields.length - 1} className="hover:text-blue-500 disabled:opacity-30 p-0.5"><ArrowDown className="w-4 h-4" /></button>
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <div className="flex flex-col">
                          <div className="font-medium text-sm text-slate-900">{field.name}</div>
                          {field.options && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {field.options.map(opt => (
                                <span key={opt} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{opt}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs flex items-center ml-4">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono">
                            <Database className="w-3 h-3 mr-1" />
                            {field.type}
                          </span>
                          {field.unit && <span className="ml-2 text-slate-500 font-mono">[{field.unit}]</span>}
                        </div>
                        <div className="text-xs text-right text-slate-500 flex items-center justify-end gap-2 ml-4">
                          {field.required ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded font-medium">Requis</span> : <span>Optionnel</span>}
                          <button onClick={() => handleEditFieldClick(field)} className="text-slate-400 hover:text-blue-500 transition-colors p-1" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveField(field.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Supprimer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingField ? (
                  <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm">
                    <h5 className="text-sm font-semibold text-blue-900 mb-3">{editingFieldId ? "Modifier la Propriété" : "Nouvelle Propriété"}</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-blue-800 mb-1">Nom du champ</label>
                        <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Ex: Température" className="w-full text-sm px-2 py-1.5 rounded border border-blue-200" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-800 mb-1">Type</label>
                        <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as any)} className="w-full text-sm px-2 py-1.5 rounded border border-blue-200">
                          <option value="text">Texte</option>
                          <option value="number">Nombre</option>
                          <option value="date">Date</option>
                          <option value="select">Liste déroulante</option>
                          <option value="multiselect">Sélection multiple</option>
                          <option value="boolean">Oui / Non</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-800 mb-1">Unité (opt.)</label>
                        <input type="text" value={newFieldUnit} onChange={e => setNewFieldUnit(e.target.value)} placeholder="Ex: °C, MPa" className="w-full text-sm px-2 py-1.5 rounded border border-blue-200" />
                      </div>
                      {['select', 'multiselect'].includes(newFieldType) && (
                        <div className="col-span-2 sm:col-span-4">
                          <label className="block text-xs font-medium text-blue-800 mb-1">Options (séparées par des virgules)</label>
                          <input type="text" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder="Ex: Option 1, Option 2, Option 3" className="w-full text-sm px-2 py-1.5 rounded border border-blue-200" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-4 border-t border-blue-200/50 pt-3">
                      <label className="flex items-center text-sm text-blue-900">
                        <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)} className="rounded border-blue-300 text-blue-600 mr-2" />
                        Champ requis obligatoirement
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setIsAddingField(false)} className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded font-medium">Annuler</button>
                        <button onClick={handleAddField} className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm flex items-center"><Check className="w-4 h-4 mr-1" /> Ajouter</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingField(true)} className="mt-6 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-500 hover:text-blue-600 w-full rounded-lg py-4 flex flex-col items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 mb-1" />
                    <span className="text-sm font-medium">Ajouter une propriété</span>
                  </button>
                )}
              </div>
            </>
          )}

          {builderTab === 'analyses' && activeAnalysisTpl && (
            <>
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    value={activeAnalysisTpl.name}
                    onChange={e => {
                      const updated = { ...activeAnalysisTpl, name: e.target.value };
                      updateAnalysisTemplate(activeAnalysisTpl.id, updated);
                      setActiveAnalysisTpl(updated);
                    }}
                    className="font-semibold text-lg text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-full placeholder-slate-400"
                    placeholder="Nom de l'Analyse"
                  />
                  <div className="text-xs text-slate-500 mt-0.5 flex gap-2 items-center">
                    <input
                      type="text"
                      value={activeAnalysisTpl.description}
                      onChange={e => {
                        const updated = { ...activeAnalysisTpl, description: e.target.value };
                        updateAnalysisTemplate(activeAnalysisTpl.id, updated);
                        setActiveAnalysisTpl(updated);
                      }}
                      className="bg-transparent border-none focus:ring-0 p-0 flex-1 placeholder-slate-300"
                      placeholder="Description..."
                    />
                    {activeAnalysisTpl.standardRef && (
                      <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">{activeAnalysisTpl.standardRef}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={activeAnalysisTpl.isActive !== false}
                        onChange={e => {
                          const updated = { ...activeAnalysisTpl, isActive: e.target.checked };
                          updateAnalysisTemplate(activeAnalysisTpl.id, updated);
                          setActiveAnalysisTpl(updated);
                        }}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${activeAnalysisTpl.isActive !== false ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${activeAnalysisTpl.isActive !== false ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-medium text-slate-700">
                      {activeAnalysisTpl.isActive !== false ? 'Actif' : 'Inactif'}
                    </div>
                  </label>
                  <button onClick={() => setIsOptionsOpen(true)} className="text-sm font-medium text-slate-600 hover:text-blue-700 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Settings2 className="w-4 h-4 mr-1.5" />
                    Options
                  </button>
                  <button onClick={handleCloneTemplate} className="text-sm font-medium text-slate-600 hover:text-emerald-600 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Copy className="w-4 h-4 mr-1.5" />
                    Dupliquer
                  </button>
                  <button onClick={handleDeleteTemplate} className="text-sm font-medium text-slate-600 hover:text-red-600 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Résultats Attendus (Outputs)</h4>
                <div className="space-y-3">
                  {activeAnalysisTpl.expectedResults.map((result, index) => (
                    <div key={result.id} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex items-center group transition-all hover:border-indigo-300">
                      <div className="flex flex-col text-slate-300 mr-3 gap-1">
                        <button onClick={() => handleMoveField(index, 'up')} disabled={index === 0} className="hover:text-indigo-500 disabled:opacity-30 p-0.5"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => handleMoveField(index, 'down')} disabled={index === activeAnalysisTpl.expectedResults.length - 1} className="hover:text-indigo-500 disabled:opacity-30 p-0.5"><ArrowDown className="w-4 h-4" /></button>
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <div className="flex flex-col">
                          <div className="font-medium text-sm text-slate-900">{result.name}</div>
                          {result.options && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {result.options.map(opt => (
                                <span key={opt} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{opt}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs flex items-center ml-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded font-mono ${result.type === 'image' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                            {result.type}
                          </span>
                          {result.unit && <span className="ml-2 text-slate-500 font-mono">[{result.unit}]</span>}
                        </div>
                        <div className="text-xs text-right text-slate-500 flex items-center justify-end gap-2 ml-4">
                          {result.required ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded font-medium">Requis</span> : <span>Optionnel</span>}
                          <button onClick={() => handleEditFieldClick(result)} className="text-slate-400 hover:text-indigo-500 transition-colors p-1" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveField(result.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Supprimer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingField ? (
                  <div className="mt-4 bg-indigo-50 border border-indigo-200 p-4 rounded-lg shadow-sm">
                    <h5 className="text-sm font-semibold text-indigo-900 mb-3">{editingFieldId ? "Modifier le Résultat Attendu" : "Nouveau Résultat Attendu"}</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Nom du résultat</label>
                        <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Ex: Dureté HV" className="w-full text-sm px-2 py-1.5 rounded border border-indigo-200" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Type</label>
                        <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as any)} className="w-full text-sm px-2 py-1.5 rounded border border-indigo-200">
                          <option value="text">Texte</option>
                          <option value="number">Nombre unique</option>
                          <option value="number_series">Série de nombres (Calcul Moyenne/Écart-type)</option>
                          <option value="vertical_table">Tableau vertical (Ex: ICP multi-éléments)</option>
                          <option value="image">Image unique</option>
                          <option value="micrography">Micrographie (images multiples + commentaires)</option>
                          <option value="select">Liste déroulante</option>
                          <option value="multiselect">Sélection multiple</option>
                          <option value="boolean">Conforme / Non Conforme</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Unité par défaut (opt.)</label>
                        <input type="text" value={newFieldUnit} onChange={e => setNewFieldUnit(e.target.value)} placeholder="Ex: ppm, %, mg/L" className="w-full text-sm px-2 py-1.5 rounded border border-indigo-200" />
                      </div>
                      {['select', 'multiselect', 'vertical_table'].includes(newFieldType) && (
                        <div className="col-span-2 sm:col-span-4">
                          <label className="block text-xs font-medium text-indigo-800 mb-1">
                            {newFieldType === 'vertical_table'
                              ? 'Éléments / Paramètres prédéfinis du tableau (séparés par des virgules)'
                              : 'Options (séparées par des virgules)'}
                          </label>
                          <input
                            type="text"
                            value={newFieldOptions}
                            onChange={e => setNewFieldOptions(e.target.value)}
                            placeholder={newFieldType === 'vertical_table' ? "Ex: Fe,Si,Mn,P,S,Cr,Ni,Mo,Cu,Al,Ti,V,Co,W,Pb,Sn,Zn,As,Bi,Sb,B,Zr,Nb,Ca,Mg,Na,K,Li,Ba,Sr" : "Ex: Option 1, Option 2, Option 3"}
                            className="w-full text-sm px-2 py-1.5 rounded border border-indigo-200"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-4 border-t border-indigo-200/50 pt-3">
                      <label className="flex items-center text-sm text-indigo-900">
                        <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)} className="rounded border-indigo-300 text-indigo-600 mr-2" />
                        Résultat requis obligatoirement
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => { setIsAddingField(false); setEditingFieldId(null); }} className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-100 rounded font-medium">Annuler</button>
                        <button onClick={handleAddField} className="px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded font-medium shadow-sm flex items-center"><Check className="w-4 h-4 mr-1" /> {editingFieldId ? "Enregistrer" : "Ajouter"}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingField(true)} className="mt-6 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 w-full rounded-lg py-4 flex flex-col items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 mb-1" />
                    <span className="text-sm font-medium">Ajouter un résultat attendu (Image, Valeur, etc.)</span>
                  </button>
                )}
              </div>
            </>
          )}
          {builderTab === 'requests' && activeRequestTpl && (
            <>
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    value={activeRequestTpl.name}
                    onChange={e => {
                      const updated = { ...activeRequestTpl, name: e.target.value };
                      updateRequestTemplate(activeRequestTpl.id, updated);
                      setActiveRequestTpl(updated);
                    }}
                    className="font-semibold text-lg text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-full placeholder-slate-400"
                    placeholder="Nom du Formulaire"
                  />
                  <input
                    type="text"
                    value={activeRequestTpl.description}
                    onChange={e => {
                      const updated = { ...activeRequestTpl, description: e.target.value };
                      updateRequestTemplate(activeRequestTpl.id, updated);
                      setActiveRequestTpl(updated);
                    }}
                    className="text-xs text-slate-500 mt-0.5 bg-transparent border-none focus:ring-0 p-0 w-full placeholder-slate-300"
                    placeholder="Description..."
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={activeRequestTpl.isActive !== false}
                        onChange={e => {
                          const updated = { ...activeRequestTpl, isActive: e.target.checked };
                          updateRequestTemplate(activeRequestTpl.id, updated);
                          setActiveRequestTpl(updated);
                        }}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${activeRequestTpl.isActive !== false ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${activeRequestTpl.isActive !== false ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-medium text-slate-700">
                      {activeRequestTpl.isActive !== false ? 'Actif' : 'Inactif'}
                    </div>
                  </label>
                  <button onClick={() => setIsOptionsOpen(true)} className="text-sm font-medium text-slate-600 hover:text-blue-700 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Settings2 className="w-4 h-4 mr-1.5" />
                    Options
                  </button>
                  <button onClick={handleCloneTemplate} className="text-sm font-medium text-slate-600 hover:text-emerald-600 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Copy className="w-4 h-4 mr-1.5" />
                    Dupliquer
                  </button>
                  <button onClick={handleDeleteTemplate} className="text-sm font-medium text-slate-600 hover:text-red-600 flex items-center whitespace-nowrap bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Supprimer
                  </button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Formulaire de Demande (Côté Client)</h4>
                <div className="space-y-3">
                  {activeRequestTpl.fields.map((field, index) => (
                    <div key={field.id} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex items-center group transition-all hover:border-blue-300">
                      <div className="flex flex-col text-slate-300 mr-3 gap-1">
                        <button onClick={() => handleMoveField(index, 'up')} disabled={index === 0} className="hover:text-blue-500 disabled:opacity-30 p-0.5"><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={() => handleMoveField(index, 'down')} disabled={index === activeRequestTpl.fields.length - 1} className="hover:text-blue-500 disabled:opacity-30 p-0.5"><ArrowDown className="w-4 h-4" /></button>
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <div className="flex flex-col">
                          <div className="font-medium text-sm text-slate-900">{field.name}</div>
                          {field.options && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {field.options.map(opt => (
                                <span key={opt} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{opt}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs flex items-center ml-4">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono">
                            <Database className="w-3 h-3 mr-1" />
                            {field.type}
                          </span>
                        </div>
                        <div className="text-xs text-right text-slate-500 flex items-center justify-end gap-2 ml-4">
                          {field.required ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded font-medium">Requis</span> : <span>Optionnel</span>}
                          <button onClick={() => handleEditFieldClick(field)} className="text-slate-400 hover:text-blue-500 transition-colors p-1" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveField(field.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Supprimer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingField ? (
                  <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm">
                    <h5 className="text-sm font-semibold text-blue-900 mb-3">{editingFieldId ? "Modifier la Propriété (Demande)" : "Nouvelle Propriété (Demande)"}</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-blue-800 mb-1">Question / Libellé</label>
                        <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Ex: Type de défaillance..." className="w-full text-sm px-2 py-1.5 rounded border border-blue-200" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-blue-800 mb-1">Type de réponse</label>
                        <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as any)} className="w-full text-sm px-2 py-1.5 rounded border border-blue-200">
                          <option value="text">Texte libre</option>
                          <option value="number">Nombre</option>
                          <option value="date">Date</option>
                          <option value="select">Liste déroulante</option>
                          <option value="multiselect">Sélection multiple</option>
                          <option value="boolean">Oui / Non (Case à cocher)</option>
                          <option value="analyses">Analyses (Modèles actifs)</option>
                          <option value="materials">Matériaux (Modèles actifs)</option>
                        </select>
                      </div>
                      {['select', 'multiselect'].includes(newFieldType) && (
                        <div className="col-span-2 sm:col-span-4">
                          <label className="block text-xs font-medium text-blue-800 mb-1">Options (séparées par des virgules)</label>
                          <input type="text" value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder="Ex: Option 1, Option 2, Option 3" className="w-full text-sm px-2 py-1.5 rounded border border-blue-200" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-4 border-t border-blue-200/50 pt-3">
                      <label className="flex items-center text-sm text-blue-900">
                        <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)} className="rounded border-blue-300 text-blue-600 mr-2" />
                        Réponse obligatoire
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => { setIsAddingField(false); setEditingFieldId(null); }} className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded font-medium">Annuler</button>
                        <button onClick={handleAddField} className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded font-medium shadow-sm flex items-center"><Check className="w-4 h-4 mr-1" /> {editingFieldId ? "Enregistrer" : "Ajouter"}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingField(true)} className="mt-6 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-500 hover:text-blue-600 w-full rounded-lg py-4 flex flex-col items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 mb-1" />
                    <span className="text-sm font-medium">Ajouter un champ au formulaire</span>
                  </button>
                )}
              </div>
            </>
          )}

          {builderTab === 'reports' && activeReportTpl && (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    value={activeReportTpl.name}
                    onChange={e => {
                      const updated = { ...activeReportTpl, name: e.target.value };
                      updateReportTemplate(activeReportTpl.id, updated);
                      setActiveReportTpl(updated);
                    }}
                    className="font-semibold text-lg text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-full placeholder-slate-400"
                    placeholder="Nom du Modèle de Rapport"
                  />
                  <input
                    type="text"
                    value={activeReportTpl.description}
                    onChange={e => {
                      const updated = { ...activeReportTpl, description: e.target.value };
                      updateReportTemplate(activeReportTpl.id, updated);
                      setActiveReportTpl(updated);
                    }}
                    className="text-sm text-slate-500 bg-transparent border-none focus:ring-0 p-0 mt-1 w-full placeholder-slate-400"
                    placeholder="Description du modèle"
                  />
                  <div className="mt-2 flex items-center">
                    <span className="text-sm text-slate-500 mr-2">Type :</span>
                    <select
                      value={activeReportTpl.type || 'report'}
                      onChange={e => {
                        const updated = { ...activeReportTpl, type: e.target.value as 'report' | 'certificate' };
                        updateReportTemplate(activeReportTpl.id, updated);
                        setActiveReportTpl(updated);
                      }}
                      className="text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1"
                    >
                      <option value="report">Rapport d'Analyse</option>
                      <option value="certificate">Certificat de Conformité</option>
                    </select>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="file"
                    accept=".docx"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors border border-blue-200"
                    title="Importer un fichier Word (.docx)"
                  >
                    <UploadCloud className="w-4 h-4 mr-1.5" />
                    Importer (.docx)
                  </button>
                  <button onClick={handleCloneTemplate} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded transition-colors" title="Dupliquer le modèle">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={handleDeleteTemplate} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors" title="Supprimer le modèle">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 p-8 overflow-y-auto bg-slate-50 border-r border-slate-200 flex flex-col items-center justify-center">
                  {activeReportTpl.fileName ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center max-w-md w-full">
                      <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-slate-800 mb-2">Modèle Word importé</h3>
                      <p className="text-slate-600 mb-6 font-medium">{activeReportTpl.fileName}</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                      >
                        Remplacer le fichier
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white p-10 rounded-xl shadow-sm border border-dashed border-slate-300 text-center max-w-md w-full">
                      <UploadCloud className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-700 mb-2">Aucun fichier modèle</h3>
                      <p className="text-sm text-slate-500 mb-6">Importez un fichier Word (.docx) contenant vos variables pour générer vos futurs rapports.</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                      >
                        Importer un modèle (.docx)
                      </button>
                    </div>
                  )}
                </div>
                <div className="w-80 bg-slate-50 p-4 overflow-y-auto">
                  <h4 className="font-semibold text-sm text-slate-800 mb-3">Variables disponibles (.docx)</h4>
                  <p className="text-xs text-slate-500 mb-4">Insérez ces variables directement dans votre fichier Word.</p>

                  <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    <h5 className="text-xs font-bold text-emerald-800 mb-1">Affichage Conditionnel (ex: Photos)</h5>
                    <p className="text-[10px] text-emerald-600 mb-2 leading-relaxed">
                      Affichez un contenu <strong>uniquement</strong> si l'analyse correspond à un certain type (ex: Métallographie). Le nom de l'analyse est converti en minuscules sans accents.
                    </p>
                    <div className="bg-white p-2 rounded border border-emerald-200 mb-2">
                      <code className="text-[10px] block font-mono text-slate-700">{"{{#analyses}}"}</code>
                      <code className="text-[10px] block font-mono text-emerald-700 font-bold ml-2">{"{{#is_metallographie}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-600 ml-4">Section réservée à la métallographie...</code>
                      <code className="text-[10px] block font-mono text-emerald-700 font-bold ml-2">{"{{/is_metallographie}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700 mt-1">{"{{/analyses}}"}</code>
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-1">Fonctionne avec n'importe quelle analyse : {"is_durete_vickers"}, {"is_granulometrie"}, etc.</p>
                  </div>
                  <div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <h5 className="text-xs font-bold text-purple-800 mb-1">Tableaux Auto-Générés (Séries de valeurs)</h5>
                    <p className="text-[10px] text-purple-600 mb-2 leading-relaxed">
                      Si le nombre de mesures varie (ex: 3 mesures parfois, 15 mesures d'autres fois), le système peut <strong>générer automatiquement le tableau complet</strong>.
                    </p>
                    <div className="bg-white p-2 rounded border border-purple-200 mb-2">
                      <code className="text-[9px] block font-mono text-slate-700 mb-1">{"{{#tables_series}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2">{"{{titre}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2 font-bold text-blue-600">{"{{@xml}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mt-1">{"{{/tables_series}}"}</code>
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-1">N'utilisez pas de tableaux Word. Écrivez juste ces balises à la suite, et le tableau natif s'insérera à la place de {"{{@xml}}"}.</p>
                  </div>
                  <div className="mb-4 bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                     <h5 className="text-xs font-bold text-cyan-900 mb-1">Tableaux Verticaux Auto-Générés (Ex: ICP 30 éléments)</h5>
                     <p className="text-[10px] text-cyan-700 mb-2 leading-relaxed">
                       Génère automatiquement un tableau vertical complet (Élément | Résultat | Unité) pour chaque analyse de type Tableau vertical :
                     </p>
                     <div className="bg-white p-2 rounded border border-cyan-200 mb-2">
                       <code className="text-[9px] block font-mono text-slate-700 mb-1">{"{{#tables_verticales}}"}</code>
                       <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2">{"{{titre}} ({{echantillon}})"}</code>
                       <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2 font-bold text-blue-600">{"{{@xml}}"}</code>
                       <code className="text-[9px] block font-mono text-slate-700 mt-1">{"{{/tables_verticales}}"}</code>
                     </div>
                   </div>
                  <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                    <h5 className="text-xs font-bold text-indigo-800 mb-1">Tableaux Auto-Générés (Regroupement d'analyses)</h5>
                    <p className="text-[10px] text-indigo-600 mb-2 leading-relaxed">
                      Pour créer un tableau regroupant tous vos échantillons et lister les résultats (ex: D10, D50, D90) en colonnes :
                    </p>
                    <div className="bg-white p-2 rounded border border-indigo-200 mb-2">
                      <code className="text-[9px] block font-mono text-slate-700 mb-1">{"{{#tables_analyses}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2">{"{{titre}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2 font-bold text-blue-600">{"{{@xml}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mt-1">{"{{/tables_analyses}}"}</code>
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-1">Cette boucle rassemble tous les échantillons dans un tableau Word complet pour une analyse donnée.</p>
                  </div>

                  <div className="mb-4 bg-purple-50 border border-purple-100 rounded-lg p-3 hidden">
                    <h5 className="text-xs font-bold text-purple-800 mb-1">Tableaux Horizontaux Dynamiques</h5>
                    <p className="text-[10px] text-purple-600 mb-2 leading-relaxed">
                      Pour afficher <strong>n'importe quelle série de mesures</strong> en colonnes, utilisez la boucle <code className="font-mono text-purple-800">{"{{#series_resultats}}"}</code>. Elle affichera un tableau générique pour tous les paramètres multi-valeurs de l'analyse, peu importe leur nom.
                    </p>
                    <div className="bg-white p-2 rounded border border-purple-200 mb-2 overflow-x-auto">
                      <code className="text-[9px] block font-mono text-slate-700 mb-1">{"{{#analyses}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mb-1 ml-2">{"{{#has_series}}"}</code>
                      <table className="text-[9px] w-full border-collapse ml-2">
                        <thead>
                          <tr><th className="border p-1 text-left">Echantillon</th><th className="border p-1 text-left">Paramètre</th><th className="border p-1 text-left">Mesure 1</th><th className="border p-1 text-left">Mesure 2</th><th className="border p-1 text-left">Moyenne</th></tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border p-1 font-mono">{"{{#series_resultats}}{{ echantillon }}"}</td>
                            <td className="border p-1 font-mono">{"{{nom_parametre}}"}</td>
                            <td className="border p-1 font-mono">{"{{v1}}"}</td>
                            <td className="border p-1 font-mono">{"{{v2}}"}</td>
                            <td className="border p-1 font-mono">{"{{stats}}{{/series_resultats}}"}</td>
                          </tr>
                        </tbody>
                      </table>
                      <code className="text-[9px] block font-mono text-slate-700 mt-1 ml-2">{"{{/has_series}}"}</code>
                      <code className="text-[9px] block font-mono text-slate-700 mt-1">{"{{/analyses}}"}</code>
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-1">Variables disp: {"{{v1}} à {{v10}}, {{moyenne}}, {{ecart_type}}, {{stats}}"}</p>
                  </div>

                  <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <h5 className="text-xs font-bold text-blue-800 mb-1">Tableaux Verticaux (Boucles)</h5>
                    <p className="text-[10px] text-blue-600 mb-2 leading-relaxed">
                      Pour un tableau propre (ex: listes de résultats multiples), créez un tableau dans Word et encadrez la ligne avec ces balises spéciales :
                    </p>
                    <div className="bg-white p-2 rounded border border-blue-200 mb-2">
                      <code className="text-[10px] block font-mono text-slate-700">{"{{#analyses}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700 pl-2">Analyse: {"{{nom}}"} / {"{{technicien}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700 pl-2">{"{{#valeurs}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700 pl-4">- {"{{cle}}"} : {"{{valeur}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700 pl-2">{"{{/valeurs}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700">{"{{/analyses}}"}</code>
                    </div>
                  </div>

                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h5 className="text-xs font-bold text-amber-900 mb-1">Galerie de micrographies avec images intégrées</h5>
                    <p className="text-[10px] text-amber-800 mb-2 leading-relaxed">
                      Cette boucle répète automatiquement une section pour chaque image enregistrée dans les résultats d’analyse. Le tag image est spécial : il insère le fichier dans Word, pas une URL ni du texte.
                    </p>
                    <div className="bg-white p-2 rounded border border-amber-200 mb-2">
                      <code className="text-[10px] block font-mono text-slate-700">{"{{#micrographies}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700 ml-2">Image {"{{numero}}"} — {"{{nom}}"}</code>
                      <code className="text-[10px] block font-mono text-blue-700 font-bold ml-2">{"{{%image}}"} <span className="font-normal text-slate-500">← insère la vraie image</span></code>
                      <code className="text-[10px] block font-mono text-slate-700 ml-2">Commentaire : {"{{commentaire}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700">{"{{/micrographies}}"}</code>
                    </div>
                    <p className="text-[9px] text-amber-900 italic">Placez chaque balise dans un paragraphe Word distinct si possible. Les images sont ajustées à la largeur disponible sans déformation.</p>
                  </div>

                  <div className="mb-4 bg-teal-50 border border-teal-100 rounded-lg p-3">
                    <h5 className="text-xs font-bold text-teal-800 mb-1">Liste des échantillons</h5>
                    <p className="text-[10px] text-teal-600 mb-2 leading-relaxed">
                      Pour lister tous les échantillons de ce rapport, utilisez cette boucle :
                    </p>
                    <div className="bg-white p-2 rounded border border-teal-200 mb-2">
                      <code className="text-[10px] block font-mono text-slate-700">{"{{#echantillons}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700 pl-4">- {"{{id}} | {{barcode}} | {{materiau}} | {{projet}}"}</code>
                      <code className="text-[10px] block font-mono text-slate-700">{"{{/echantillons}}"}</code>
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-1">N'oubliez pas les doubles accolades autour des variables internes !</p>
                  </div>

                  <h5 className="font-semibold text-xs text-slate-800 mb-2 uppercase tracking-wide">Variables simples</h5>
                  <ul className="space-y-2 text-sm">
                    {[
                      { label: "ID Demande", tag: "{{demande.id}}" },
                      { label: "Conclusion de la demande", tag: "{{demande.conclusion}}" },
                      { label: "Date de création", tag: "{{date.jour}}" },
                      { label: "Demandeur - Nom", tag: "{{demandeur.nom}}" },
                      { label: "Demandeur - Email", tag: "{{demandeur.email}}" },
                      { label: "Demandeur - Entreprise", tag: "{{demandeur.entreprise}}" },
                      { label: "Échantillon - ID", tag: "{{echantillon.id}}" },
                      { label: "Échantillon - Code Barre", tag: "{{echantillon.barcode}}" },
                      { label: "Échantillon - Matériau", tag: "{{echantillon.materiau}}" },
                      { label: "Échantillon - Projet", tag: "{{echantillon.projet}}" },
                      { label: "Analyse - Nom", tag: "{{analyse.nom}}" },
                      { label: "Analyse - Norme", tag: "{{analyse.norme}}" },
                      { label: "Analyse - Technicien", tag: "{{analyse.technicien}}" },
                      { label: "Résultats - Tableau", tag: "{{resultats.tableau}}" },
                      { label: "Images - Nombre / indication galerie (texte)", tag: "{{images.galerie}}" },
                      { label: "Remarques", tag: "{{analyse.remarques}}" },
                      // Custom fields for Request
                      ...requestTemplates.flatMap(tpl => tpl.fields.map(f => ({
                        label: `Demande: ${f.name}`,
                        tag: `{{demande.custom.${f.id}}}`
                      }))),
                      // Custom fields for Material
                      ...materialTemplates.flatMap(tpl => tpl.fields.map(f => ({
                        label: `Échantillon: ${f.name}`,
                        tag: `{{echantillon.custom.${f.id}}}`
                      })))
                    ].reduce((unique, o) => {
                      if (!unique.some(obj => obj.tag === o.tag)) {
                        unique.push(o);
                      }
                      return unique;
                    }, [] as { label: string, tag: string }[]).map(v => (
                      <li key={v.tag}>
                        <button
                          onClick={() => handleCopyTag(v.tag)}
                          className="w-full text-left px-3 py-2 bg-white border border-slate-200 rounded hover:border-blue-300 hover:text-blue-600 transition-colors flex justify-between items-center"
                        >
                          <div>
                            <div className="font-mono text-xs font-bold">{v.tag}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{v.label}</div>
                          </div>
                          {copiedTag === v.tag ? (
                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center">
                              <Check className="w-3 h-3 mr-0.5" />
                              Copié
                            </span>
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-red-100 bg-red-50 flex items-center">
              <Trash2 className="w-5 h-5 text-red-600 mr-2" />
              <h3 className="font-semibold text-red-800">Confirmer la suppression</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-6">Êtes-vous sûr de vouloir supprimer ce modèle ? Cette action est irréversible.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Annuler</button>
                <button onClick={executeDelete} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOptionsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800">Options du Modèle</h3>
              <button onClick={() => setIsOptionsOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {builderTab === 'materials' && activeMaterialTpl && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={activeMaterialTpl.category}
                    onChange={e => {
                      const updated = { ...activeMaterialTpl, category: e.target.value as any };
                      updateMaterialTemplate(activeMaterialTpl.id, updated);
                      setActiveMaterialTpl(updated);
                    }}
                    className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Métal">Métal</option>
                    <option value="Polymère">Polymère</option>
                    <option value="Céramique">Céramique</option>
                    <option value="Composite">Composite</option>
                    <option value="Organique">Organique</option>
                    <option value="Cermet">Cermet</option>
                  </select>
                </div>
              )}
              {builderTab === 'analyses' && activeAnalysisTpl && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                    <input
                      type="text"
                      value={activeAnalysisTpl.category}
                      onChange={e => {
                        const updated = { ...activeAnalysisTpl, category: e.target.value };
                        updateAnalysisTemplate(activeAnalysisTpl.id, updated);
                        setActiveAnalysisTpl(updated);
                      }}
                      className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Norme / Référence (Optionnel)</label>
                    <input
                      type="text"
                      value={activeAnalysisTpl.standardRef || ''}
                      onChange={e => {
                        const updated = { ...activeAnalysisTpl, standardRef: e.target.value };
                        updateAnalysisTemplate(activeAnalysisTpl.id, updated);
                        setActiveAnalysisTpl(updated);
                      }}
                      placeholder="Ex: ISO 9001, ASTM E112"
                      className="w-full text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
              {builderTab === 'requests' && activeRequestTpl && (
                <div className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-100">
                  Aucune option supplémentaire pour les formulaires de demande pour le moment.
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setIsOptionsOpen(false)} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Terminer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
