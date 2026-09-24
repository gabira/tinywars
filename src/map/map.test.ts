import { describe, expect, it } from 'vitest';
import { RESOURCES } from '../data/resources';
import { generateMap, MAIN_H, MAIN_W, reliefBlocked } from './MapGenerator';
import { autotileIndex, cliffIndex, GRASS_BASE, PLATEAU_BASE } from './autotile';

describe('MapGenerator', () => {
  for (const seed of [1, 2, 3, 42, 1234]) {
    it(`mapa ${seed} é simétrico e as bases ficam em terra`, () => {
      const m = generateMap(seed);
      const N = m.w * m.h;
      for (let i = 0; i < N; i++) expect(m.land[i]).toBe(m.land[N - 1 - i]);
      for (const s of m.starts)
        for (let y = s.ty; y < s.ty + MAIN_H; y++)
          for (let x = s.tx; x < s.tx + MAIN_W; x++) expect(m.land[y * m.w + x]).toBe(1);
      // cada recurso tem seu espelho (rotação de 180°) e nenhum fica sobre o relevo
      const keys = new Set(m.resources.map((r) => `${r.kind}:${r.tx},${r.ty}`));
      for (const r of m.resources) {
        const { w: rw, h: rh } = RESOURCES[r.kind];
        expect(keys.has(`${r.kind}:${m.w - r.tx - rw},${m.h - r.ty - rh}`)).toBe(true);
        for (let y = r.ty; y < r.ty + rh; y++) for (let x = r.tx; x < r.tx + rw; x++) expect(reliefBlocked(m, x, y)).toBe(false);
      }
      // o relevo bloqueia o mesmo número de tiles dos dois lados, e nunca as bases
      let top = 0;
      let bottom = 0;
      for (let i = 0; i < N; i++) {
        const blocked = m.plateau[i] === 1 || m.cliff[i] === 1;
        if (!blocked) continue;
        expect(m.land[i]).toBe(1);
        if (i < N / 2) top++;
        else bottom++;
      }
      expect(top).toBe(bottom);
      for (const s of m.starts)
        for (let y = s.ty; y < s.ty + MAIN_H; y++) for (let x = s.tx; x < s.tx + MAIN_W; x++) expect(reliefBlocked(m, x, y)).toBe(false);
      expect(m.resources.filter((r) => r.kind === 'goldMine').length).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('autotile', () => {
  const set = new Set(['1,1', '2,1', '3,1', '1,2', '2,2', '3,2', '1,3', '2,3', '3,3']);
  const get = (x: number, y: number) => set.has(`${x},${y}`);
  it('usa o bloco 3x3 para uma área cheia', () => {
    expect(autotileIndex(get, 1, 1, GRASS_BASE)).toBe(0); // canto sup. esq.
    expect(autotileIndex(get, 2, 2, GRASS_BASE)).toBe(10); // centro
    expect(autotileIndex(get, 3, 3, GRASS_BASE)).toBe(20); // canto inf. dir.
  });
  it('tile isolado', () => {
    expect(autotileIndex((x, y) => x === 0 && y === 0, 0, 0, GRASS_BASE)).toBe(30);
  });
  it('planalto usa as colunas 5..8 e o penhasco a linha 4', () => {
    expect(autotileIndex(get, 2, 2, PLATEAU_BASE)).toBe(15);
    const row = (x: number, y: number) => y === 0 && x >= 0 && x <= 2;
    expect(cliffIndex(row, 0, 0)).toBe(4 * 9 + 5); // ponta esquerda
    expect(cliffIndex(row, 1, 0)).toBe(4 * 9 + 6); // meio
    expect(cliffIndex(row, 2, 0)).toBe(4 * 9 + 7); // ponta direita
  });
});
