import { describe, expect, it } from 'vitest';
import { NavGrid } from '../../map/NavGrid';
import { AStar, goalDistance } from './AStar';

function grid(rows: string[]): NavGrid {
  const h = rows.length;
  const w = rows[0].length;
  const land = new Uint8Array(w * h);
  const g = new NavGrid(w, h, land);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      land[y * w + x] = c === '~' ? 0 : 1;
      if (c === '#') g.blockRect(x, y, 1, 1);
    }
  return g;
}

const xy = (g: NavGrid, i: number) => [i % g.w, Math.floor(i / g.w)];

describe('AStar', () => {
  it('encontra caminho reto', () => {
    const g = grid(['.....', '.....', '.....']);
    const path = new AStar(g).find(0, 1, { rx: 4, ry: 1, rw: 1, rh: 1, range: 0 });
    expect(path.length).toBe(4);
    expect(xy(g, path[path.length - 1])).toEqual([4, 1]);
  });

  it('contorna obstáculos', () => {
    const g = grid(['.....', '.###.', '.....']);
    const path = new AStar(g).find(0, 1, { rx: 4, ry: 1, rw: 1, rh: 1, range: 0 });
    expect(xy(g, path[path.length - 1])).toEqual([4, 1]);
    for (const i of path) expect(g.walkableIdx(i)).toBe(true);
  });

  it('não corta cantos na diagonal', () => {
    const g = grid(['.#', '#.']);
    const path = new AStar(g).find(0, 0, { rx: 1, ry: 1, rw: 1, rh: 1, range: 0 });
    // sem passagem: devolve caminho vazio até o mais próximo (o próprio início)
    expect(path.length).toBe(0);
  });

  it('para ao lado de um retângulo bloqueado (range 1)', () => {
    const g = grid(['......', '..##..', '..##..', '......']);
    const goal = { rx: 2, ry: 1, rw: 2, rh: 2, range: 1 };
    const path = new AStar(g).find(0, 0, goal);
    const [x, y] = xy(g, path[path.length - 1]);
    expect(goalDistance(x, y, goal)).toBeLessThanOrEqual(1);
  });

  it('objetivo inalcançável leva ao ponto mais próximo', () => {
    const g = grid(['...~...', '...~...', '...~...']);
    const path = new AStar(g).find(0, 1, { rx: 6, ry: 1, rw: 1, rh: 1, range: 0 });
    const [x] = xy(g, path[path.length - 1]);
    expect(x).toBe(2);
  });
});
