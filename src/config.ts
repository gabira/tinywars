export const TILE = 64;
export const SIM_HZ = 20;
export const SIM_DT = 1 / SIM_HZ;

export const MAP_W = 64;
export const MAP_H = 48;

/** Alturas das faixas do HUD (em pixels de tela). */
export const HUD_TOP = 40;
export const HUD_BOTTOM = 176;

export const FONT = '"Pixelify Sans", "Trebuchet MS", sans-serif';

export const COLORS = {
  water: 0x47aba9,
  select: 0x7cff7c,
  selectEnemy: 0xff6a6a,
  hpGood: 0x53d769,
  hpMid: 0xf2c94c,
  hpLow: 0xeb5757,
  text: '#fff8e7',
  textDark: '#3b2a1a',
  gold: '#f7d154',
  bad: '#ff7a7a',
};

/** Flags de depuração lidas da URL (?debug=anims, ?nofog, ?debug=perf, ?seed=123, ?fast). */
export const DEBUG = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  return {
    anims: q.get('debug') === 'anims',
    perf: q.get('debug') === 'perf',
    noFog: q.has('nofog'),
    seed: q.has('seed') ? Number(q.get('seed')) : null,
    fast: q.has('fast'),
  };
})();
