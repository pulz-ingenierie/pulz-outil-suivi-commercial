// ============================================================================
// moeïa — preset Tailwind partagé (source de vérité unique)
// Réf. : moeia-direction-artistique.md §2 — ne jamais dupliquer ces valeurs.
// Usage (Tailwind CDN) :  tailwind.config = { presets: [moeiaPreset] }
// Usage (build)        :  module.exports = { presets: [require('./moeia.tailwind.preset')] }
// ============================================================================
const moeiaPreset = {
  theme: {
    extend: {
      colors: {
        ink:  { 900: '#221F1A', 700: '#57534E', 600: '#6E6961', 500: '#8F8A82' },
        base: { bg: '#F6F5F2', card: '#FBFAF8', paper: '#FFFFFF', line: '#E5E2DC', line2: '#EEECE7' },
        cyan: {
          DEFAULT: '#04B7F9',   // SIGNAL — jamais texte, jamais fond sous texte blanc (2,3:1)
          action:  '#0273C4',   // boutons IA, liens (4,9:1 AA)
          hover:   '#01599A',
          soft:    '#E9F6FD',
          border:  '#C4E9FA',
          track:   '#D3EEFB',   // piste des barres de progression
        },
        ok:   { DEFAULT: '#3E7A4E', soft: '#EAF2EC' },
        warn: { DEFAULT: '#855900', soft: '#F8F0DC' },
        err:  { DEFAULT: '#B3352B', soft: '#F9EAE8' },
        // Couleurs de série — GRAPHIQUES UNIQUEMENT (jamais UI)
        serie: { 1: '#0273C4', 2: '#3E7A4E', 3: '#855900', 4: '#6B5CA5', 5: '#A34E68', 6: '#57534E' },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', lg: '8px', xl: '10px' },
      boxShadow: {
        sm:    '0 1px 2px rgba(34,31,26,.06)',
        pop:   '0 4px 16px rgba(34,31,26,.10)',
        modal: '0 12px 36px rgba(34,31,26,.14)',
      },
    },
  },
};
if (typeof module !== 'undefined') module.exports = moeiaPreset;
