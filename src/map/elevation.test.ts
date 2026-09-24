import { describe, expect, it } from 'vitest';
import { TILE } from '../config';
import { BUILDINGS } from '../data/buildings';
import { canAttack, canSeeTarget, inAttackRange } from '../systems/combat';
import { canPlace } from '../systems/economy';
import { AStar } from '../systems/pathfinding/AStar';
import { World } from '../systems/World';
import { generateMap, GOLD_AMOUNT, RAMP } from './MapGenerator';
import { NavGrid } from './NavGrid';

/**
 * Grade de teste: planalto (P) no nível 1 com rampa na lateral de baixo (u em cima, d embaixo).
 *   ..........
 *   ...PPPP...
 *   ...PPPP...
 *   ..uPPPP...
 *   ..d####...   (# = penhasco)
 *   ..........
 */
function gridWithPlateau(): NavGrid {
  const rows = ['..........', '...PPPP...', '...PPPP...', '..uPPPP...', '..d####...', '..........'];
  const h = rows.length;
  const w = rows[0].length;
  const g = new NavGrid(w, h, new Uint8Array(w * h).fill(1));
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const i = y * w + x;
      if (c === 'P' || c === 'u') g.elev[i] = 1;
      if (c === 'u' || c === 'd') g.ramp[i] = 1;
      if (c === '#') g.blockRect(x, y, 1, 1);
    }),
  );
  return g;
}

describe('relevo: navegação', () => {
  it('não se sobe pela borda do planalto, só pela rampa', () => {
    const g = gridWithPlateau();
    expect(g.canStep(3, 0, 3, 1)).toBe(false); // chão → topo pela borda norte
    expect(g.canStep(7, 2, 6, 2)).toBe(false); // chão → topo pela borda leste
    expect(g.canStep(2, 4, 2, 3)).toBe(true); // rampa de baixo → rampa de cima
    expect(g.canStep(2, 3, 3, 3)).toBe(true); // rampa de cima → topo
    expect(g.canStep(1, 3, 2, 3)).toBe(false); // chão ao lado → rampa de cima
  });

  it('o A* sobe pela rampa para chegar ao topo', () => {
    const g = gridWithPlateau();
    const path = new AStar(g).find(5, 0, { rx: 5, ry: 2, rw: 1, rh: 1, range: 0 });
    const tiles = path.map((i) => [i % g.w, Math.floor(i / g.w)]);
    expect(tiles[tiles.length - 1]).toEqual([5, 2]);
    expect(tiles.some(([x, y]) => x === 2 && y === 4)).toBe(true); // passou pela rampa
  });

  it('construções ficam inteiras num nível e longe da rampa', () => {
    const g = gridWithPlateau();
    expect(g.rectOneLevel(4, 1, 2, 2)).toBe(true); // no topo
    expect(g.rectOneLevel(6, 1, 2, 2)).toBe(false); // metade no topo, metade no chão
    expect(g.rectOneLevel(3, 2, 2, 2)).toBe(false); // encostada na rampa
  });
});

describe('relevo: mapa gerado', () => {
  for (const seed of [1, 7, 42]) {
    it(`mapa ${seed}: planaltos com rampa, recursos no topo e ouro em tamanhos diferentes`, () => {
      const m = generateMap(seed);
      const N = m.w * m.h;
      for (let i = 0; i < N; i++) expect(m.plateau[i]).toBe(m.plateau[N - 1 - i]);
      // toda rampa de cima encosta num tile de planalto
      let ramps = 0;
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const r = m.ramp[y * m.w + x];
          if (r === RAMP.upLeft) expect(m.plateau[y * m.w + x + 1]).toBe(1);
          if (r === RAMP.upRight) expect(m.plateau[y * m.w + x - 1]).toBe(1);
          if (r) ramps++;
        }
      expect(ramps).toBeGreaterThanOrEqual(4);
      const onTop = m.resources.filter((r) => m.plateau[r.ty * m.w + r.tx] === 1);
      expect(new Set(onTop.map((r) => r.kind))).toEqual(new Set(['goldMine', 'tree', 'sheep']));
      const golds = m.resources.filter((r) => r.kind === 'goldMine').map((r) => r.amount);
      expect(new Set(golds).size).toBeGreaterThanOrEqual(3);
      expect(golds).toContain(GOLD_AMOUNT.base);
      expect(golds).toContain(GOLD_AMOUNT.contested);
    });
  }
});

describe('relevo: partida', () => {
  const world = new World({ seed: 7, difficulty: 'normal', fog: false });
  const nav = world.nav;
  /** Um tile de topo de planalto longe das bordas. */
  const topTile = (() => {
    for (let y = 1; y < nav.h - 1; y++)
      for (let x = 1; x < nav.w - 1; x++)
        if (nav.level(x, y) === 1 && nav.level(x + 1, y) === 1 && nav.level(x, y + 1) === 1 && nav.level(x + 1, y + 1) === 1 && nav.rectFree(x, y, 2, 2) && nav.rectOneLevel(x, y, 2, 2))
          return { x, y };
    throw new Error('sem planalto');
  })();

  it('dá para construir no topo, mas não atravessando a borda', () => {
    expect(canPlace(world, 0, BUILDINGS.house, topTile.x, topTile.y)).toBe(true);
    let edge: { x: number; y: number } | null = null;
    for (let y = 1; y < nav.h - 2 && !edge; y++)
      for (let x = 1; x < nav.w - 2 && !edge; x++)
        if (nav.level(x, y) === 1 && nav.level(x - 1, y) === 0 && nav.walkable(x - 1, y) && nav.walkable(x, y)) edge = { x: x - 1, y };
    expect(edge).not.toBeNull();
    expect(canPlace(world, 0, BUILDINGS.house, edge!.x, edge!.y)).toBe(false);
  });

  it('arqueiro no alto alcança mais longe e não é visto de baixo', () => {
    const topX = topTile.x * TILE + 32;
    const topY = topTile.y * TILE + 32;
    // procura um tile de chão livre a ~5,3 tiles do arqueiro
    let ground: { x: number; y: number } | null = null;
    for (let a = 0; a < 64 && !ground; a++) {
      const gx = topX + Math.cos(a) * 340;
      const gy = topY + Math.sin(a) * 340;
      const tx = Math.floor(gx / TILE);
      const ty = Math.floor(gy / TILE);
      if (nav.walkable(tx, ty) && nav.level(tx, ty) === 0 && !nav.isRamp(tx, ty)) ground = { x: gx, y: gy };
    }
    expect(ground).not.toBeNull();
    const high = world.spawnUnit(0, 'archer', topX, topY);
    const low = world.spawnUnit(1, 'archer', ground!.x, ground!.y);
    expect(canAttack(high, low)).toBe(true);
    expect(inAttackRange(world, high, low)).toBe(true); // 300 + bônus de altura
    expect(inAttackRange(world, low, high)).toBe(false); // de baixo, só o alcance normal
    expect(canSeeTarget(world, low, high)).toBe(false);
    expect(canSeeTarget(world, high, low)).toBe(true);
    high.alive = false;
    low.alive = false;
  });

  it('peão sobe pela rampa e coleta madeira no topo', () => {
    const w = new World({ seed: 7, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const tree = w.resources
      .filter((r) => r.def.kind === 'tree' && w.nav.level(r.tx, r.ty) === 1)
      .sort((a, b) => Math.hypot(a.x - castle.x, a.y - castle.y) - Math.hypot(b.x - castle.x, b.y - castle.y))[0];
    expect(tree).toBeDefined();
    const pawn = w.units.find((u) => u.team === 0)!;
    const wood = w.players[0].res.wood;
    w.issue(0, { type: 'gather', unitIds: [pawn.id], nodeId: tree.id });
    let wasUp = false;
    for (let t = 0; t < 150 * 20; t++) {
      w.step(0.05);
      if (w.nav.levelAt(pawn.x, pawn.y) === 1) wasUp = true;
    }
    expect(wasUp).toBe(true);
    expect(w.players[0].res.wood).toBeGreaterThan(wood);
  }, 30_000);
});
