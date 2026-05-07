export type ProfileTheme = {
  id: string;
  name: string;
  colors: string[];
  pattern?: 'dots' | 'grid' | 'waves' | 'lines' | 'noise' | 'none' | 'circuit' | 'stars';
  type: 'gradient' | 'mesh' | 'abstract' | 'minimal' | 'image';
  imageUrl?: string;
};

const COLOR_PALETTES = [
  ['#3b82f6', '#8b5cf6'], // Blue-Violet
  ['#10b981', '#3b82f6'], // Emerald-Blue
  ['#f43f5e', '#fb923c'], // Rose-Orange
  ['#d946ef', '#6366f1'], // Fuchsia-Indigo
  ['#f59e0b', '#d97706'], // Amber-Orange
  ['#06b6d4', '#14b8a6'], // Cyan-Teal
  ['#ef4444', '#7f1d1d'], // Red-Dark
  ['#000000', '#1e293b'], // Black-Slate
  ['#ffffff', '#f1f5f9'], // White-Slate
  ['#1e1b4b', '#4338ca'], // Indigo-Deep
];

const PATTERNS: ('dots' | 'grid' | 'waves' | 'lines' | 'noise' | 'none' | 'circuit' | 'stars')[] = [
  'dots', 'grid', 'waves', 'lines', 'noise', 'circuit', 'stars', 'none'
];

function generateThemes(): ProfileTheme[] {
  const themes: ProfileTheme[] = [
    { id: 'default', name: 'Standard', colors: ['#3b82f6'], type: 'minimal', pattern: 'none' },
    { id: 'glass', name: 'Glassmorphism', colors: ['#ffffff'], type: 'minimal', pattern: 'none' },
    { id: 'mesh', name: 'Industrial Mesh', colors: ['#64748b'], type: 'mesh', pattern: 'noise' },
    { id: 'aurora', name: 'Northern Lights', colors: ['#10b981', '#3b82f6'], type: 'mesh', pattern: 'none' },
    { id: 'sunset', name: 'Golden Hour', colors: ['#f97316', '#e11d48'], type: 'gradient', pattern: 'none' },
    { id: 'cyber', name: 'Neon City', colors: ['#d946ef', '#06b6d4'], type: 'mesh', pattern: 'grid' },
    { id: 'stardust', name: 'Galactic', colors: ['#1e1b4b', '#000000'], type: 'mesh', pattern: 'stars' },
    { id: 'tech', name: 'Circuitry', colors: ['#0f172a', '#3b82f6'], type: 'minimal', pattern: 'circuit' },
  ];

  // Generate 100+ curated variations
  for (let i = 0; i < 120; i++) {
    const palette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    const type = ['gradient', 'mesh', 'abstract'][Math.floor(Math.random() * 3)] as any;
    
    themes.push({
      id: `theme-${i}`,
      name: `Design ${i + 1}`,
      colors: palette,
      pattern,
      type
    });
  }

  return themes;
}

export const ALL_THEMES = generateThemes();
