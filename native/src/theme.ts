// A quiet, wind-down palette. Warm paper, soft ink — not a dopamine machine.
export const colors = {
  bg: '#f6f1e7', // warm paper
  bgDeep: '#efe8d8',
  ink: '#2b2620', // soft near-black
  inkSoft: '#6b6357',
  inkFaint: '#a59d8d',
  accent: '#9a7b4f', // muted bronze
  line: '#e3dac6',
  card: '#fbf7ee',
  heart: '#c0563f',
};

// Hebrew serif with real nikkud support, bundled in M3 (see assets/fonts).
// Falls back to the platform serif until the font is wired up.
export const fonts = {
  serif: 'FrankRuhlLibre',
  serifFallback: 'serif',
};

export const type = {
  title: 26,
  body: 22,
  bodySmall: 19,
  meta: 15,
  small: 13,
};
