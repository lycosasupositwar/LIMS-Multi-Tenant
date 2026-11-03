/**
 * Palette de Couleurs Thématiques Multi-Laboratoires (Tailwind CSS)
 *
 * Ce module définit les classes utilitaires Tailwind associées à chaque laboratoire
 * pour assurer une distinction visuelle claire dans l'interface (badges, bordures,
 * arrière-plans actifs et anneaux de focus).
 *
 * REMARQUE : Les classes doivent être écrites en toutes lettres (non concaténées
 * dynamiquement) afin que le compilateur JIT de Tailwind CSS puisse les détecter
 * lors du scan statique du code source.
 */

export const LAB_COLORS = [
  // Index 0 : Thème Bleu (ex: Laboratoire Métallographie)
  { main: 'text-blue-600', mainBg: 'bg-blue-600', light: 'bg-blue-100', text: 'text-blue-800', bgFade: 'bg-blue-50/50', ring: 'ring-blue-100', border: 'border-blue-500', hoverBg: 'hover:bg-blue-100', borderLight: 'border-blue-200', activeBg: 'bg-blue-200/70', activeText: 'text-blue-900', hoverBgLight: 'bg-blue-50 hover:bg-blue-100', borderDark: 'border-blue-600' },
  // Index 1 : Thème Émeraude (ex: Laboratoire Mécanique & Chimie)
  { main: 'text-emerald-600', mainBg: 'bg-emerald-600', light: 'bg-emerald-100', text: 'text-emerald-800', bgFade: 'bg-emerald-50/50', ring: 'ring-emerald-100', border: 'border-emerald-500', hoverBg: 'hover:bg-emerald-100', borderLight: 'border-emerald-200', activeBg: 'bg-emerald-200/70', activeText: 'text-emerald-900', hoverBgLight: 'bg-emerald-50 hover:bg-emerald-100', borderDark: 'border-emerald-600' },
  // Index 2 : Thème Violet
  { main: 'text-purple-600', mainBg: 'bg-purple-600', light: 'bg-purple-100', text: 'text-purple-800', bgFade: 'bg-purple-50/50', ring: 'ring-purple-100', border: 'border-purple-500', hoverBg: 'hover:bg-purple-100', borderLight: 'border-purple-200', activeBg: 'bg-purple-200/70', activeText: 'text-purple-900', hoverBgLight: 'bg-purple-50 hover:bg-purple-100', borderDark: 'border-purple-600' },
  // Index 3 : Thème Ambre
  { main: 'text-amber-600', mainBg: 'bg-amber-600', light: 'bg-amber-100', text: 'text-amber-800', bgFade: 'bg-amber-50/50', ring: 'ring-amber-100', border: 'border-amber-500', hoverBg: 'hover:bg-amber-100', borderLight: 'border-amber-200', activeBg: 'bg-amber-200/70', activeText: 'text-amber-900', hoverBgLight: 'bg-amber-50 hover:bg-amber-100', borderDark: 'border-amber-600' },
  // Index 4 : Thème Rose
  { main: 'text-rose-600', mainBg: 'bg-rose-600', light: 'bg-rose-100', text: 'text-rose-800', bgFade: 'bg-rose-50/50', ring: 'ring-rose-100', border: 'border-rose-500', hoverBg: 'hover:bg-rose-100', borderLight: 'border-rose-200', activeBg: 'bg-rose-200/70', activeText: 'text-rose-900', hoverBgLight: 'bg-rose-50 hover:bg-rose-100', borderDark: 'border-rose-600' },
  // Index 5 : Thème Cyan
  { main: 'text-cyan-600', mainBg: 'bg-cyan-600', light: 'bg-cyan-100', text: 'text-cyan-800', bgFade: 'bg-cyan-50/50', ring: 'ring-cyan-100', border: 'border-cyan-500', hoverBg: 'hover:bg-cyan-100', borderLight: 'border-cyan-200', activeBg: 'bg-cyan-200/70', activeText: 'text-cyan-900', hoverBgLight: 'bg-cyan-50 hover:bg-cyan-100', borderDark: 'border-cyan-600' }
];

/**
 * Retourne le jeu de couleurs correspondant à l'indice d'un laboratoire
 * avec repli circulaire (modulo) si le nombre de laboratoires dépasse la palette.
 *
 * @param index Indice numérique du laboratoire dans la collection (>= 0)
 * @returns Objet contenant les classes Tailwind du thème
 */
export const getLabColor = (index: number) => {
  return LAB_COLORS[Math.abs(index) % LAB_COLORS.length] || LAB_COLORS[0];
};
