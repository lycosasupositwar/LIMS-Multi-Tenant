/**
 * Moteur de Planification Intelligente & Optimisation des Lots de Préparation (Multi-Laboratoires)
 *
 * Ce module pur (sans effet de bord) calcule une proposition de planning optimisée à partir
 * des règles dynamiques propres à chaque laboratoire (`LabSchedulingConfig`) :
 *
 * 1. Préemption sélective des urgences :
 *    - Les essais déjà démarrés (`En Cours`, `a_valider`, `valide`, `termine`) ou verrouillés
 *      manuellement (`isScheduleLocked`) sont immuables et réservent leur charge sur leur journée.
 *    - Les essais non commencés (`planifie`, `rejete`) sont classés par priorité (`haute > normale > basse`),
 *      puis date d'échéance engagée (`committedDueDate`), puis date de création (FIFO).
 *    - Une urgence est insérée au plus tôt et décale les essais `planifie` de priorité inférieure
 *      si `config.allowUrgentPreemption` est activé.
 *
 * 2. Regroupement dynamique en lots de préparation (Batching) :
 *    - Chaque étape de préparation (`PreparationStepTemplate`) définit sa durée (`durationMinutes`),
 *      sa capacité simultanée (`batchCapacity`) et sa règle de regroupement (`batchGroupBy`) :
 *        * `'none'`          : séquentiel (ex. Enrobage à chaud, 1 échantillon à la fois)
 *        * `'same_material'` : regroupement uniquement entre échantillons du même alliage/matériau
 *                              (ex. Polissage automatique jusqu'à 6 enrobages d'un même alliage)
 *        * `'same_template'` : regroupement entre échantillons subissant le même essai
 *        * `'any'`           : regroupement libre sur la même machine (ex. Dégazage BET 4 postes)
 */

import {
  Analysis,
  AnalysisRequest,
  AnalysisTemplate,
  Equipment,
  LabSchedulingConfig,
  PreparationStepTemplate,
  Sample
} from '../types';

/** Lot de préparation optimisé généré par le moteur */
export interface ScheduledBatch {
  id: string;
  stepName: string;
  groupLabel: string;
  plannedDate: string;
  analysisIds: string[];
  sampleIds: string[];
  batchCapacity: number;
  /** Durée optimisée en heures (avec regroupement) */
  optimizedHours: number;
  /** Durée naïve en heures (sans regroupement, 1 à la fois) */
  naiveHours: number;
  /** Gain en heures obtenu par le regroupement */
  savedHours: number;
}

/** Proposition d'affectation d'un essai sur une journée */
export interface ScheduleAssignment {
  analysisId: string;
  sampleId: string;
  requestId?: string;
  templateName: string;
  priority: 'haute' | 'normale' | 'basse';
  oldDate?: string;
  newDate: string;
  wasShifted: boolean;
  shiftReason?: string;
  /** Durée de l'essai seul (en heures) */
  analysisHours: number;
  /** Durée de préparation imputée à cet essai (après amortissement des lots) */
  prepHours: number;
  /** Durée totale effective imputée sur la journée */
  effectiveHours: number;
  scheduledBatchId?: string;
  isUrgentInsertion: boolean;
}

/** Résultat complet d'une simulation de planification intelligente */
export interface SchedulingProposal {
  assignments: ScheduleAssignment[];
  batches: ScheduledBatch[];
  lockedCount: number;
  shiftedCount: number;
  urgentPrioritizedCount: number;
  totalSavedHours: number;
  warnings: string[];
}

/** Configuration par défaut utilisée si un laboratoire n'a pas encore personnalisé ses règles */
export function getDefaultLabSchedulingConfig(): LabSchedulingConfig {
  return {
    dailyCapacityHours: 7,
    workingDays: [1, 2, 3, 4, 5],
    allowUrgentPreemption: true,
    batchWindowDays: 3,
    preparationSteps: [
      { id: 'PREP-ENROB', name: 'Enrobage à chaud', durationMinutes: 15, batchCapacity: 1, batchGroupBy: 'none' },
      { id: 'PREP-POLIS', name: 'Polissage automatique', durationMinutes: 45, batchCapacity: 6, batchGroupBy: 'same_material' }
    ]
  };
}

/** Formate une Date locale en `YYYY-MM-DD` */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Avance jusqu'au prochain jour ouvré (inclus si déjà ouvré) */
function nextWorkingDate(from: Date, workingDays: number[]): Date {
  const validDays = workingDays.length > 0 ? workingDays : [1, 2, 3, 4, 5];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (!validDays.includes(d.getDay()) && guard < 14) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

/**
 * Construit une clé normalisée d'alliage / matériau pour un échantillon afin de regrouper
 * uniquement les échantillons compatibles au polissage (`batchGroupBy: 'same_material'`).
 */
export function getSampleMaterialKey(sample?: Sample): { key: string; label: string } {
  if (!sample) return { key: 'inconnu', label: 'Matériau non défini' };
  const cd = sample.customData || {};
  const alloy = String(cd.nuance || cd.nuance_alu || cd.composition || '').trim();
  const label = alloy ? `${alloy} (${sample.materialState})` : `${sample.templateId} (${sample.materialState})`;
  const key = `${sample.templateId}::${alloy.toLowerCase() || sample.materialState.toLowerCase()}`;
  return { key, label };
}

/**
 * Calcule le temps estimatif complet (préparation optimisée par lots + essais)
 * dès la soumission d'une demande client dans `NewRequestModal.tsx`.
 */
export function estimateRequestDurationWithPrep(
  sampleCount: number,
  selectedTemplates: AnalysisTemplate[],
  config?: LabSchedulingConfig
): { totalHours: number; prepHours: number; testHours: number; savedHours: number } {
  const safeCount = Math.max(1, sampleCount);
  const cfg = config || getDefaultLabSchedulingConfig();

  // Durée des essais eux-mêmes
  const testHours = selectedTemplates.reduce((sum, t) => sum + (t.estimatedHours ?? 2), 0) * safeCount;

  // Union dédupliquée des étapes de préparation requises par les essais de la demande
  const neededStepIds = new Set<string>();
  selectedTemplates.forEach(t => {
    if (t.requiresPreparation && Array.isArray(t.preparationStepIds)) {
      t.preparationStepIds.forEach(id => neededStepIds.add(id));
    }
  });

  let prepMinutesOptimized = 0;
  let prepMinutesNaive = 0;

  neededStepIds.forEach(stepId => {
    const step = cfg.preparationSteps.find(s => s.id === stepId);
    if (!step) return;
    const cap = Math.max(1, step.batchCapacity || 1);
    const cycles = step.batchGroupBy === 'none' || cap === 1 ? safeCount : Math.ceil(safeCount / cap);
    prepMinutesOptimized += cycles * step.durationMinutes;
    prepMinutesNaive += safeCount * step.durationMinutes;
  });

  const prepHours = Math.round((prepMinutesOptimized / 60) * 100) / 100;
  const savedHours = Math.round(((prepMinutesNaive - prepMinutesOptimized) / 60) * 100) / 100;
  const totalHours = Math.round((testHours + prepHours) * 10) / 10;

  return { totalHours, prepHours, testHours: Math.round(testHours * 10) / 10, savedHours };
}

/** Détail de charge calculé pour un essai donné (essai seul + préparation amortie) */
export interface AnalysisWorkloadDetail {
  testHours: number;
  prepHours: number;
  totalHours: number;
  prepStepNames: string[];
}

/** Synthèse de charge pour un ensemble d'analyses (une journée, un analyste ou tout un laboratoire) */
export interface WorkloadSummary {
  testHours: number;
  prepHours: number;
  totalHours: number;
  savedHours: number;
  byAnalysisId: Record<string, AnalysisWorkloadDetail>;
}

/**
 * Calcule la charge horaire consolidée (essais + préparation optimisée par lots)
 * pour un ensemble d'analyses donné (ex: une journée du calendrier, la file d'un analyste
 * ou la charge active globale du laboratoire dans les KPI du Dashboard).
 */
export function calculateAnalysesWorkload(
  analyses: Analysis[],
  samples: Sample[],
  analysisTemplates: AnalysisTemplate[],
  config?: LabSchedulingConfig
): WorkloadSummary {
  const cfg = config || getDefaultLabSchedulingConfig();
  const sampleMap = new Map(samples.map(s => [s.id, s]));
  const templateMap = new Map(analysisTemplates.map(t => [t.id, t]));
  const stepMap = new Map(cfg.preparationSteps.map(s => [s.id, s]));

  const prepHoursMap = new Map<string, number>();
  const prepNamesMap = new Map<string, string[]>();
  let totalTestHours = 0;
  let totalNaivePrepMinutes = 0;
  let totalOptimizedPrepMinutes = 0;

  // Préparation des métadonnées par essai
  const items = analyses.map(a => {
    const sample = sampleMap.get(a.sampleId);
    const template = templateMap.get(a.templateId);
    const testHours = template?.estimatedHours ?? 2;
    totalTestHours += testHours;
    const prepSteps =
      template?.requiresPreparation && Array.isArray(template.preparationStepIds)
        ? template.preparationStepIds.map(id => stepMap.get(id)).filter((s): s is PreparationStepTemplate => Boolean(s))
        : [];
    prepNamesMap.set(a.id, prepSteps.map(s => s.name));
    prepHoursMap.set(a.id, 0);
    return { analysis: a, sample, template, testHours, prepSteps };
  });

  // 1. Étapes séquentielles (batchCapacity <= 1 ou batchGroupBy === 'none')
  for (const it of items) {
    let seqMin = 0;
    for (const step of it.prepSteps) {
      if (step.batchCapacity <= 1 || step.batchGroupBy === 'none') {
        seqMin += step.durationMinutes;
      }
    }
    if (seqMin > 0) {
      totalNaivePrepMinutes += seqMin;
      totalOptimizedPrepMinutes += seqMin;
      prepHoursMap.set(it.analysis.id, (prepHoursMap.get(it.analysis.id) || 0) + seqMin / 60);
    }
  }

  // 2. Étapes regroupables en lots (same_material / same_template / any)
  const multiCapSteps = cfg.preparationSteps.filter(s => s.batchCapacity > 1 && s.batchGroupBy !== 'none');
  for (const step of multiCapSteps) {
    const matching = items.filter(it => it.prepSteps.some(s => s.id === step.id));
    if (matching.length === 0) continue;

    const buckets = new Map<string, typeof matching>();
    for (const it of matching) {
      let key = 'ALL';
      if (step.batchGroupBy === 'same_material') {
        key = getSampleMaterialKey(it.sample).key;
      } else if (step.batchGroupBy === 'same_template') {
        key = it.analysis.templateId;
      }
      const list = buckets.get(key) || [];
      list.push(it);
      buckets.set(key, list);
    }

    for (const list of buckets.values()) {
      for (let i = 0; i < list.length; i += step.batchCapacity) {
        const chunk = list.slice(i, i + step.batchCapacity);
        const optMin = step.durationMinutes;
        const naiveMin = chunk.length * step.durationMinutes;
        totalOptimizedPrepMinutes += optMin;
        totalNaivePrepMinutes += naiveMin;
        const amortizedHours = optMin / 60 / chunk.length;
        chunk.forEach(it => {
          prepHoursMap.set(it.analysis.id, (prepHoursMap.get(it.analysis.id) || 0) + amortizedHours);
        });
      }
    }
  }

  const byAnalysisId: Record<string, AnalysisWorkloadDetail> = {};
  for (const it of items) {
    const pHours = Math.round((prepHoursMap.get(it.analysis.id) || 0) * 100) / 100;
    const tHours = Math.round(it.testHours * 100) / 100;
    byAnalysisId[it.analysis.id] = {
      testHours: tHours,
      prepHours: pHours,
      totalHours: Math.round((tHours + pHours) * 100) / 100,
      prepStepNames: prepNamesMap.get(it.analysis.id) || []
    };
  }

  const testHours = Math.round(totalTestHours * 10) / 10;
  const prepHours = Math.round((totalOptimizedPrepMinutes / 60) * 10) / 10;
  const totalHours = Math.round((totalTestHours + totalOptimizedPrepMinutes / 60) * 10) / 10;
  const savedHours = Math.round(((totalNaivePrepMinutes - totalOptimizedPrepMinutes) / 60) * 10) / 10;

  return { testHours, prepHours, totalHours, savedHours, byAnalysisId };
}

/**
 * Calcule une proposition complète de planification intelligente pour le laboratoire actif.
 */
export function computeSmartSchedule(params: {
  analyses: Analysis[];
  samples: Sample[];
  requests: AnalysisRequest[];
  analysisTemplates: AnalysisTemplate[];
  equipments: Equipment[];
  config?: LabSchedulingConfig;
  startDate?: Date;
}): SchedulingProposal {
  const { analyses, samples, requests, analysisTemplates, equipments } = params;
  const config = params.config || getDefaultLabSchedulingConfig();
  const dailyCap = Math.max(1, config.dailyCapacityHours || 7);
  const workingDays = config.workingDays?.length ? config.workingDays : [1, 2, 3, 4, 5];
  const baseStart = nextWorkingDate(params.startDate || new Date(), workingDays);

  const sampleMap = new Map(samples.map(s => [s.id, s]));
  const requestMap = new Map(requests.map(r => [r.id, r]));
  const templateMap = new Map(analysisTemplates.map(t => [t.id, t]));
  const stepMap = new Map(config.preparationSteps.map(s => [s.id, s]));

  const priorityRank: Record<string, number> = { haute: 3, normale: 2, basse: 1 };

  // Charge déjà occupée par journée (YYYY-MM-DD -> heures)
  const dayLoad = new Map<string, number>();
  const addLoad = (iso: string, hrs: number) => {
    dayLoad.set(iso, Math.round(((dayLoad.get(iso) || 0) + hrs) * 100) / 100);
  };

  // 1. Partitionnement : essais figés (déjà démarrés ou verrouillés) vs essais planifiables
  const lockedAnalyses: Analysis[] = [];
  const movableAnalyses: Analysis[] = [];

  for (const a of analyses) {
    const isStartedOrDone = a.status !== 'planifie' && a.status !== 'rejete';
    if (isStartedOrDone || a.isScheduleLocked) {
      lockedAnalyses.push(a);
      if (a.plannedDate && (a.status === 'En Cours' || a.status === 'a_valider' || a.isScheduleLocked)) {
        const tpl = templateMap.get(a.templateId);
        addLoad(a.plannedDate, tpl?.estimatedHours ?? 2);
      }
    } else {
      movableAnalyses.push(a);
    }
  }

  // Métadonnées enrichies pour chaque essai planifiable
  interface MovableItem {
    analysis: Analysis;
    sample?: Sample;
    request?: AnalysisRequest;
    template?: AnalysisTemplate;
    priority: 'haute' | 'normale' | 'basse';
    dueDateTs: number;
    createdTs: number;
    testHours: number;
    prepSteps: PreparationStepTemplate[];
  }

  const enriched: MovableItem[] = movableAnalyses.map(a => {
    const sample = sampleMap.get(a.sampleId);
    const request = sample?.requestId ? requestMap.get(sample.requestId) : undefined;
    const template = templateMap.get(a.templateId);
    const priority = (request?.priority || sample?.priority || 'normale') as 'haute' | 'normale' | 'basse';
    const dueStr = request?.committedDueDate || request?.requestedDueDate;
    const dueDateTs = dueStr ? new Date(dueStr).getTime() : Number.MAX_SAFE_INTEGER;
    const createdTs = request?.createdAt ? new Date(request.createdAt).getTime() : new Date(a.updatedAt).getTime();
    const prepSteps =
      template?.requiresPreparation && Array.isArray(template.preparationStepIds)
        ? template.preparationStepIds.map(id => stepMap.get(id)).filter((s): s is PreparationStepTemplate => Boolean(s))
        : [];
    return {
      analysis: a,
      sample,
      request,
      template,
      priority,
      dueDateTs,
      createdTs,
      testHours: template?.estimatedHours ?? 2,
      prepSteps
    };
  });

  // 2. Tri : si préemption urgente active, priorité haute > normale > basse -> échéance -> FIFO
  enriched.sort((a, b) => {
    if (config.allowUrgentPreemption) {
      const pDiff = (priorityRank[b.priority] || 2) - (priorityRank[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
    }
    if (a.dueDateTs !== b.dueDateTs) return a.dueDateTs - b.dueDateTs;
    return a.createdTs - b.createdTs;
  });

  // 3. Regroupement des étapes de préparation en LOTS optimisés (ex: 6 enrobages d'un même alliage au polissage)
  // On calcule pour chaque essai la durée de préparation amortie et son éventuel identifiant de lot.
  const prepHoursByAnalysis = new Map<string, number>();
  const batchIdByAnalysis = new Map<string, string>();
  const batches: ScheduledBatch[] = [];
  let batchSeq = 1;

  // Regroupement par étape multi-capacité (> 1 et batchGroupBy !== 'none')
  const multiCapSteps = config.preparationSteps.filter(s => s.batchCapacity > 1 && s.batchGroupBy !== 'none');

  // D'abord : ajouter les étapes séquentielles (batchCapacity === 1 ou batchGroupBy === 'none', ex: Enrobage)
  for (const item of enriched) {
    let seqMinutes = 0;
    for (const step of item.prepSteps) {
      if (step.batchCapacity <= 1 || step.batchGroupBy === 'none') {
        seqMinutes += step.durationMinutes;
      }
    }
    prepHoursByAnalysis.set(item.analysis.id, seqMinutes / 60);
  }

  // Ensuite : former les lots pour chaque étape regroupable (ex: Polissage cap=6 par même alliage)
  for (const step of multiCapSteps) {
    const itemsNeedingStep = enriched.filter(it => it.prepSteps.some(s => s.id === step.id));
    // Regroupement par clé selon la règle du laboratoire
    const buckets = new Map<string, { label: string; items: MovableItem[] }>();
    for (const it of itemsNeedingStep) {
      let key = 'ALL';
      let label = 'Lot commun';
      if (step.batchGroupBy === 'same_material') {
        const mat = getSampleMaterialKey(it.sample);
        key = mat.key;
        label = mat.label;
      } else if (step.batchGroupBy === 'same_template') {
        key = it.analysis.templateId;
        label = it.template?.name || it.analysis.templateId;
      }
      const bucket = buckets.get(key) || { label, items: [] };
      bucket.items.push(it);
      buckets.set(key, bucket);
    }

    // Découpe chaque bucket en chunks de taille <= step.batchCapacity (ex: 6)
    for (const bucket of buckets.values()) {
      for (let i = 0; i < bucket.items.length; i += step.batchCapacity) {
        const chunk = bucket.items.slice(i, i + step.batchCapacity);
        const batchId = `LOT-${batchSeq++}`;
        const optimizedHours = Math.round((step.durationMinutes / 60) * 100) / 100;
        const naiveHours = Math.round(((chunk.length * step.durationMinutes) / 60) * 100) / 100;
        const savedHours = Math.round((naiveHours - optimizedHours) * 100) / 100;
        const amortizedPerItem = optimizedHours / chunk.length;

        chunk.forEach(it => {
          prepHoursByAnalysis.set(it.analysis.id, (prepHoursByAnalysis.get(it.analysis.id) || 0) + amortizedPerItem);
          if (!batchIdByAnalysis.has(it.analysis.id)) {
            batchIdByAnalysis.set(it.analysis.id, batchId);
          }
        });

        batches.push({
          id: batchId,
          stepName: step.name,
          groupLabel: bucket.label,
          plannedDate: '',
          analysisIds: chunk.map(c => c.analysis.id),
          sampleIds: Array.from(new Set(chunk.map(c => c.analysis.sampleId))),
          batchCapacity: step.batchCapacity,
          optimizedHours,
          naiveHours,
          savedHours
        });
      }
    }
  }

  // 4. Placement jour par jour en respectant la capacité journalière (avec regroupement sur la même journée si lot)
  const assignments: ScheduleAssignment[] = [];
  const warnings: string[] = [];
  const hasUrgentItem = enriched.some(it => it.priority === 'haute');

  // Stocke la date choisie pour un lot afin que les essais d'un même lot tombent autant que possible le même jour
  const batchDateMap = new Map<string, string>();

  const findSlotDate = (hoursNeeded: number, preferredIso?: string): string => {
    let cursor = preferredIso ? nextWorkingDate(new Date(preferredIso), workingDays) : new Date(baseStart);
    if (cursor < baseStart) cursor = new Date(baseStart);

    for (let safety = 0; safety < 180; safety++) {
      cursor = nextWorkingDate(cursor, workingDays);
      const iso = toIsoDate(cursor);
      const currentLoad = dayLoad.get(iso) || 0;
      // Autorise un léger dépassement si l'essai seul est plus long que dailyCap et que la journée est vide
      if (currentLoad + hoursNeeded <= dailyCap || (currentLoad === 0 && hoursNeeded > dailyCap)) {
        return iso;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return toIsoDate(baseStart);
  };

  for (const item of enriched) {
    const prepHours = Math.round((prepHoursByAnalysis.get(item.analysis.id) || 0) * 100) / 100;
    const effectiveHours = Math.round((item.testHours + prepHours) * 100) / 100;
    const batchId = batchIdByAnalysis.get(item.analysis.id);
    const preferredBatchDate = batchId ? batchDateMap.get(batchId) : undefined;

    const newDate = findSlotDate(effectiveHours, preferredBatchDate);
    addLoad(newDate, effectiveHours);

    if (batchId && !batchDateMap.has(batchId)) {
      batchDateMap.set(batchId, newDate);
    }

    const oldDate = item.analysis.plannedDate;
    const wasShifted = Boolean(oldDate && oldDate !== newDate);
    let shiftReason: string | undefined;
    if (wasShifted) {
      if (item.priority === 'haute' && oldDate && newDate < oldDate) {
        shiftReason = 'Avancé en priorité (Urgence Haute)';
      } else if (hasUrgentItem && oldDate && newDate > oldDate) {
        shiftReason = 'Décalé pour libérer un créneau aux analyses urgentes';
      } else if (batchId) {
        shiftReason = `Regroupé dans ${batchId} pour optimiser la préparation`;
      } else {
        shiftReason = 'Rééquilibrage selon la capacité journalière';
      }
    }

    // Contrôle dépassement d'échéance engagée
    const dueStr = item.request?.committedDueDate || item.request?.requestedDueDate;
    if (dueStr && newDate > dueStr) {
      warnings.push(
        `L'essai ${item.analysis.id} (${item.template?.name || item.analysis.templateId}) est planifié au ${new Date(newDate).toLocaleDateString('fr-FR')}, après l'échéance du ${new Date(dueStr).toLocaleDateString('fr-FR')}.`
      );
    }

    // Contrôle étalonnage si un équipement est déjà affecté
    if (item.analysis.equipmentId) {
      const eq = equipments.find(e => e.id === item.analysis.equipmentId);
      if (eq && (eq.status !== 'operationnel' || eq.nextCalibrationDate < newDate)) {
        warnings.push(`Équipement ${eq.code} (${eq.name}) hors validité métrologique pour ${item.analysis.id}.`);
      }
    }

    assignments.push({
      analysisId: item.analysis.id,
      sampleId: item.analysis.sampleId,
      requestId: item.request?.id,
      templateName: item.template?.name || item.analysis.templateId,
      priority: item.priority,
      oldDate,
      newDate,
      wasShifted,
      shiftReason,
      analysisHours: item.testHours,
      prepHours,
      effectiveHours,
      scheduledBatchId: batchId,
      isUrgentInsertion: item.priority === 'haute'
    });
  }

  // Met à jour la date retenue sur chaque lot
  batches.forEach(b => {
    b.plannedDate = batchDateMap.get(b.id) || toIsoDate(baseStart);
  });

  const totalSavedHours = Math.round(batches.reduce((s, b) => s + b.savedHours, 0) * 100) / 100;

  return {
    assignments,
    batches: batches.filter(b => b.analysisIds.length > 1), // Ne met en avant que les lots multi-échantillons réellement optimisés
    lockedCount: lockedAnalyses.length,
    shiftedCount: assignments.filter(a => a.wasShifted).length,
    urgentPrioritizedCount: assignments.filter(a => a.isUrgentInsertion).length,
    totalSavedHours,
    warnings
  };
}
