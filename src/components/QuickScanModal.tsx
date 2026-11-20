/**
 * Modale de Scan Douchette Rapide (QR Code / Code-barres Zebra)
 *
 * Accessible depuis l'en-tête principal (`Layout.tsx`), cette modale permet à un opérateur
 * de scanner une étiquette d'échantillon à la volée pour :
 * - Identifier instantanément l'échantillon et sa demande parente
 * - Faire avancer son statut physique en un clic (En préparation, En essai, Terminé, Restitué, Détruit)
 * - Mettre à jour son emplacement physique de stockage (`storageLocation`)
 */

import React, { useState, useRef, useEffect } from 'react';
import { QrCode, X, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLims } from '../store';
import { SampleStatus } from '../types';

interface QuickScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export function QuickScanModal({ isOpen, onClose, onNavigate }: QuickScanModalProps) {
  const { allSamples, updateSampleStatus, updateSampleCustody, setActiveLabId, setGlobalSearchQuery, currentUser } = useLims();
  const [scanInput, setScanInput] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScanInput('');
      setFeedback('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = scanInput.trim().toLowerCase();
  const matchedSample = q
    ? allSamples.find(s => s.barcode.toLowerCase() === q || s.id.toLowerCase() === q)
    : null;

  const applyQuickStatus = (status: SampleStatus) => {
    if (!matchedSample) return;
    if (status === 'restitue' || status === 'detruit') {
      updateSampleCustody(matchedSample.id, {
        status,
        disposalDate: new Date().toISOString(),
        disposalMethod: status === 'restitue' ? 'restitution' : 'destruction',
        disposalBy: currentUser?.name || 'Opérateur'
      });
    } else {
      updateSampleStatus(matchedSample.id, status);
    }
    setFeedback(`Statut de ${matchedSample.id} mis à jour : ${status}`);
  };

  const applyLocation = () => {
    if (!matchedSample || !locationDraft.trim()) return;
    updateSampleCustody(matchedSample.id, { storageLocation: locationDraft.trim() });
    setFeedback(`Emplacement enregistré : ${locationDraft.trim()}`);
    setLocationDraft('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-base">Scan Douchette Rapide (QR / Code-barres)</h3>
              <p className="text-xs text-slate-400">Scannez une étiquette Zebra ou saisissez l'ID d'un échantillon</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={e => { setScanInput(e.target.value); setFeedback(''); }}
            placeholder="Scannez ici (ex: MET-26-001092 ou ECH-MET-001)..."
            className="w-full px-4 py-3 border-2 border-blue-400 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {feedback && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {feedback}
            </div>
          )}

          {matchedSample ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-sm font-bold text-slate-900">{matchedSample.id}</span>
                  <span className="ml-2 text-xs font-mono text-slate-500">[{matchedSample.barcode}]</span>
                  <p className="text-xs text-slate-600 mt-1">{matchedSample.client} — {matchedSample.project}</p>
                  {matchedSample.storageLocation && (
                    <p className="text-xs text-indigo-700 font-medium mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Stockage : {matchedSample.storageLocation}
                    </p>
                  )}
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">{matchedSample.status}</span>
              </div>

              {/* Changement de statut 1 clic */}
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Changement de statut immédiat</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['en_preparation', 'en_essai', 'termine', 'restitue', 'detruit'] as SampleStatus[]).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => applyQuickStatus(st)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${matchedSample.status === st ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50'}`}
                    >
                      {st === 'en_preparation' ? 'En préparation' : st === 'en_essai' ? 'En essai' : st === 'termine' ? 'Terminé' : st === 'restitue' ? 'Restitué client' : 'Détruit'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mise à jour emplacement physique */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationDraft}
                  onChange={e => setLocationDraft(e.target.value)}
                  placeholder="Nouvel emplacement (ex: Armoire B / Tiroir 2)"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={applyLocation}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
                >
                  Localiser
                </button>
              </div>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    if (matchedSample.labId) setActiveLabId(matchedSample.labId);
                    setGlobalSearchQuery(matchedSample.id);
                    onNavigate('samples');
                    onClose();
                  }}
                  className="w-full py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5"
                >
                  Ouvrir la fiche complète dans Échantillons <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : q ? (
            <div className="p-6 text-center text-sm text-slate-500">Aucun échantillon ne correspond au code « {scanInput} ».</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
