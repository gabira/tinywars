import { describe, expect, it } from 'vitest';
import { generateMap, MAIN_H, MAIN_W } from './MapGenerator';
import { autotileIndex, GRASS_BASE } from './autotile';

describe('MapGenerator', () => {
  for (const seed of [1, 2, 3, 42, 1234]) {
    it(`mapa ${seed} é simétrico e as bases ficam em terra`, () => {
      const m = generateMap(seed);
      const N = m.w * m.h;
      for (let i = 0; i < N; i++) expect(m.land[i]).toBe(m.land[N - 1 - i]);
      for (const s of m.starts)
        for (let y = s.ty; y < s.ty + MAIN_H; y++)
          for (let x = s.tx; x < s.tx + MAIN_W; x++) expect(m.land[y * m.w + x]).toBe(1);
      // cada recurso tem seu espelho (rotação de 180°)
      const size: Record<string, [number, number]> = { goldMine: [3, 2], tree: [1, 1], sheep: [1, 1] };
      const keys = new Set(m.resources.map((r) => `${r.kind}:${r.tx},${r.ty}`));
      for (const r of m.resources) {
        const [rw, rh] = size[r.kind];
        expect(keys.has(`${r.kind}:${m.w - r.tx - rw},${m.h - r.ty - rh}`)).toBe(true);
      }
      expect(m.resources.filter((r) => r.kind === 'goldMine').length).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('autotile', () => {
  const set = new Set(['1,1', '2,1', '3,1', '1,2', '2,2', '3,2', '1,3', '2,3', '3,3']);
  const get = (x: number, y: number) => set.has(`${x},${y}`);
  it('usa o bloco 3x3 para uma área cheia', () => {
    expect(autotileIndex(get, 1, 1, GRASS_BASE)).toBe(0); // canto sup. esq.
    expect(autotileIndex(get, 2, 2, GRASS_BASE)).toBe(11); // centro
    expect(autotileIndex(get, 3, 3, GRASS_BASE)).toBe(22); // canto inf. dir.
  });
  it('tile isolado', () => {
    expect(autotileIndex((x, y) => x === 0 && y === 0, 0, 0, GRASS_BASE)).toBe(33);
  });
});
