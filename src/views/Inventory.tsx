/**
 * Module de Gestion des Stocks & Consommables (Inventory)
 * 
 * Ce composant supervise l'ensemble des consommables critiques du laboratoire :
 * - Résines d'enrobage (à chaud / à froid)
 * - Produits chimiques (attaques métallographiques : Nital, Kroll, Villela, etc.)
 * - Disques abrasifs et draps de polissage (SiC, diamant, alumine)
 * - Équipements de protection et verrerie
 * 
 * Fonctionnalités clés :
 * 1. Surveillance en temps réel des seuils critiques (Alerte rupture et stock bas)
 * 2. Incrémentation / Décrémentation rapide au poste de travail (ajustement décimal pour liquides / poudres)
 * 3. Réassort automatique rapide basé sur le double du seuil de sécurité
 * 4. Création et suppression de références consommables
 */

import React, { useState } from 'react';
import { useLims } from '../store';
import { Archive, AlertTriangle, Plus, Minus, Search, Droplet, Layers, Wrench, Settings, Trash2, X } from 'lucide-react';
import { ConsumableCategory } from '../types';

export function Inventory() {
  const { consumables, updateConsumableStock, addConsumable, deleteConsumable } = useLims();
  
  // États de recherche et filtrage
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  
  // État du formulaire de création d'un article
  const [newConsumable, setNewConsumable] = useState({
    name: '',
    category: 'Chimie' as ConsumableCategory,
    stockLevel: 0,
    minThreshold: 0,
    unit: 'L',
  });

  // Filtrage combiné (nom, référence, catégorie)
  const filteredConsumables = consumables.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Retourne l'icône représentative de la catégorie de consommable
   */
  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'Résine': return <Layers className="w-5 h-5 text-purple-500" />;
      case 'Chimie': return <Droplet className="w-5 h-5 text-emerald-500" />;
      case 'Abrasif': return <Settings className="w-5 h-5 text-amber-500" />;
      default: return <Wrench className="w-5 h-5 text-slate-500" />;
    }
  };

  /**
   * Ajuste la quantité en stock avec arrondi au dixième (supporte les volumes liquides et masses)
   */
  const handleAdjust = (id: string, currentLevel: number, amount: number) => {
    const newLevel = Math.max(0, currentLevel + amount);
    const roundedLevel = Math.round(newLevel * 10) / 10;
    updateConsumableStock(id, roundedLevel);
  };

  /**
   * Création d'une nouvelle référence d'inventaire
   */
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConsumable.name || !newConsumable.unit) return;
    
    const id = `csm-${Math.random().toString(36).substr(2, 6)}`;
    addConsumable({
      id,
      name: newConsumable.name,
      category: newConsumable.category,
      stockLevel: Number(newConsumable.stockLevel),
      minThreshold: Number(newConsumable.minThreshold),
      unit: newConsumable.unit,
      lastRestocked: new Date().toISOString()
    });
    
    setShowNewModal(false);
    setNewConsumable({
      name: '',
      category: 'Chimie',
      stockLevel: 0,
      minThreshold: 0,
      unit: 'L',
    });
  };

  // Calcul du nombre de références sous le seuil d'alerte
  const lowStockCount = consumables.filter(c => c.stockLevel <= c.minThreshold).length;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* En-tête et alertes */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Stocks & Consommables</h2>
          <p className="text-sm text-slate-500 mt-1">Gestion de l'inventaire du laboratoire pour la préparation et l'analyse.</p>
        </div>
        <div className="flex items-center gap-3">
          {lowStockCount > 0 && (
            <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-red-100 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {lowStockCount} article(s) en rupture ou stock bas
            </div>
          )}
          <button 
            onClick={() => setShowNewModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Produit
          </button>
        </div>
      </div>

      {/* Tableau d'inventaire */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Barre de recherche */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Rechercher un produit, une référence..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <select className="w-full sm:w-auto border-slate-300 rounded-md text-sm text-slate-700 focus:ring-blue-500">
               <option value="all">Toutes les catégories</option>
               <option value="resine">Résines</option>
               <option value="chimie">Produits Chimiques</option>
               <option value="abrasif">Abrasifs</option>
             </select>
          </div>
        </div>

        {/* Liste tabulaire avec sticky header */}
        <div className="flex-1 overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Produit</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Catégorie</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Niveau Actuel</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Dernier Réassort</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ajuster le stock</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredConsumables.map((item) => {
                const isLow = item.stockLevel <= item.minThreshold;
                const isCritical = item.stockLevel === 0;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                        <span className="text-xs text-slate-500 font-mono mt-0.5">{item.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getCategoryIcon(item.category)}
                        <span className="ml-2 text-sm text-slate-700">{item.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-bold text-slate-900 w-16 text-right mr-2">
                          {item.stockLevel} <span className="text-slate-500 font-normal text-xs">{item.unit}</span>
                        </div>
                        {isCritical ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Rupture
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            Stock Bas (Seuil: {item.minThreshold})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                            Optimal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(item.lastRestocked).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {/* Boutons d'ajustement unitaire & rapide */}
                        <div className="flex items-center space-x-1 border border-slate-200 rounded-lg inline-flex p-0.5 bg-slate-50">
                          <button 
                            onClick={() => handleAdjust(item.id, item.stockLevel, -1)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-white rounded shadow-sm transition-colors"
                            title="Retirer 1 unité"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleAdjust(item.id, item.stockLevel, -0.1)}
                            className="p-1 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-white rounded shadow-sm transition-colors"
                            title="Retirer 0.1 unité"
                          >
                            -.1
                          </button>
                          <button 
                            onClick={() => handleAdjust(item.id, item.stockLevel, 1)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded shadow-sm transition-colors"
                            title="Ajouter 1 unité"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleAdjust(item.id, item.stockLevel, item.minThreshold * 2 || 10)}
                            className="px-2 py-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded shadow-sm transition-colors ml-2 border border-blue-100"
                            title="Réassort rapide recommandé"
                          >
                            Réassort
                          </button>
                        </div>
                        {/* Suppression de l'article */}
                        <button 
                          onClick={() => {
                            if (window.confirm('Voulez-vous supprimer ce produit de l\'inventaire ?')) {
                              deleteConsumable(item.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer le produit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fenêtre modale : Création d'un consommable */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Nouveau Produit</h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du produit *</label>
                <input
                  type="text"
                  required
                  value={newConsumable.name}
                  onChange={e => setNewConsumable({...newConsumable, name: e.target.value})}
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie *</label>
                <select
                  required
                  value={newConsumable.category}
                  onChange={e => setNewConsumable({...newConsumable, category: e.target.value as ConsumableCategory})}
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="Résine">Résine</option>
                  <option value="Chimie">Chimie</option>
                  <option value="Abrasif">Abrasif</option>
                  <option value="Équipement">Équipement</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Initial</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={newConsumable.stockLevel}
                    onChange={e => setNewConsumable({...newConsumable, stockLevel: Number(e.target.value)})}
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unité</label>
                  <input
                    type="text"
                    required
                    value={newConsumable.unit}
                    onChange={e => setNewConsumable({...newConsumable, unit: e.target.value})}
                    placeholder="L, kg, pcs..."
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Seuil d'alerte (Stock bas)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  value={newConsumable.minThreshold}
                  onChange={e => setNewConsumable({...newConsumable, minThreshold: Number(e.target.value)})}
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
