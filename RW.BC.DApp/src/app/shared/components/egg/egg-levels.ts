export interface EggLevelConfig {
  level: number;
  shellTop: string;
  shellBottom: string;
  circuit: string;
  accent: string;
  emissive: number;
  metalness: number;
  roughness: number;
  modules: number;
  bosses: boolean;
  antenna: boolean;
  screen: boolean;
  glowColor: string;
  rings: number;
  spin: number;
  glowCss: string;
  accentCss: string;
  particles: number;
}

const PALETTE: readonly (readonly [string, string, string, string, string])[] = [
  ['#8793a6', '#2b313f', '#aeb9c9', '#c4cee0', '#93a6c0'],
  ['#c47a2f', '#3a2109', '#ff9d44', '#ffc27a', '#ff8a1e'],
  ['#c2a52c', '#37300a', '#ffd84d', '#ffe98a', '#ffc61f'],
  ['#5aa72f', '#173309', '#9ef05a', '#c6f78f', '#74e024'],
  ['#2f9a78', '#0e3a2e', '#54efc0', '#8af0d8', '#1fe7a8'],
  ['#2f93b8', '#0e3040', '#5fd8ff', '#8ae6ff', '#22c4ff'],
  ['#3f63c0', '#121a4a', '#7d9bff', '#a6bbff', '#4f7dff'],
  ['#7a4fc8', '#221a54', '#b58aff', '#d2b6ff', '#9a5bff'],
  ['#b8458f', '#3a1438', '#ff8ad8', '#ffb6e8', '#ff45c4'],
  ['#c2414f', '#3e1018', '#ff8497', '#ffd24d', '#ff4d59'],
];

const RANGES = {
  modules: [0, 2, 3, 4, 5, 6, 7, 8, 9, 9],
  emissive: [0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.3, 1.45],
  metalness: [0.45, 0.5, 0.55, 0.6, 0.65, 0.68, 0.72, 0.76, 0.8, 0.85],
  roughness: [0.5, 0.46, 0.42, 0.39, 0.36, 0.34, 0.32, 0.3, 0.28, 0.25],
  rings: [0, 0, 0, 0, 0, 0, 1, 2, 2, 3],
  spin: [0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2],
  particles: [0, 4, 6, 8, 10, 12, 14, 16, 18, 22],
};

export function clampLevel(level: number): number {
  return Math.min(10, Math.max(1, Math.round(level || 1)));
}

export function getLevelConfig(level: number): EggLevelConfig {
  const clamped = clampLevel(level);
  const i = clamped - 1;
  const [shellTop, shellBottom, circuit, accent, glowColor] = PALETTE[i];
  return {
    level: clamped,
    shellTop,
    shellBottom,
    circuit,
    accent,
    glowColor,
    emissive: RANGES.emissive[i],
    metalness: RANGES.metalness[i],
    roughness: RANGES.roughness[i],
    modules: RANGES.modules[i],
    bosses: clamped >= 3,
    antenna: clamped >= 4,
    screen: clamped >= 5,
    rings: RANGES.rings[i],
    spin: RANGES.spin[i],
    glowCss: glowColor,
    accentCss: accent,
    particles: RANGES.particles[i],
  };
}

export function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const n = parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
