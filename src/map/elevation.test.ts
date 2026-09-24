import { describe, expect, it } from 'vitest';
import { TILE } from '../config';
import { BUILDINGS } from '../data/buildings';
import { canAttack, canSeeTarget, inAttackRange } from '../systems/combat';
import { canPlace } from '../systems/economy';
import { AStar } from '../systems/pathfinding/AStar';
import { World } from '../systems/World';
import { generateMap, GOLD_AMOUNT, plateauBottoms, RAMP, rampSpots } from './MapGenerator';
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
      // cada planalto tem um espelho na mesma posição da rotação de 180°, com a mesma forma
      // invertida só na horizontal (o penhasco continua virado para o sul)
      const canon = m.plateaus.filter((p) => p.canonical);
      const mirrors = m.plateaus.filter((p) => !p.canonical);
      expect(mirrors.length).toBe(canon.length);
      canon.forEach((p, i) => {
        const q = mirrors[i];
        expect([q.tx, q.ty]).toEqual([m.w - p.tx - p.pw, m.h - p.ty - p.ph]);
        for (let c = 0; c < p.pw; c++) expect(q.bottoms[c] - q.ty).toBe(p.bottoms[p.pw - 1 - c] - p.ty);
        expect(p.ramps.length).toBeGreaterThan(0);
        expect(q.ramps.length).toBe(p.ramps.length);
      });
      // toda rampa de cima encosta num tile de planalto e tem a parte de baixo logo abaixo
      let ramps = 0;
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const r = m.ramp[y * m.w + x];
          if (r === RAMP.upLeft) {
            expect(m.plateau[y * m.w + x + 1]).toBe(1);
            expect(m.ramp[(y + 1) * m.w + x]).toBe(RAMP.downLeft);
          }
          if (r === RAMP.upRight) {
            expect(m.plateau[y * m.w + x - 1]).toBe(1);
            expect(m.ramp[(y + 1) * m.w + x]).toBe(RAMP.downRight);
          }
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

  it('as rampas variam: um lado só, os dois lados e no meio da face sul (planaltos em degrau)', () => {
    const contested = Array.from({ length: 20 }, (_, i) => generateMap(i + 1).plateaus.filter((p) => p.canonical && !p.nearBase)).flat();
    const sides = (p: (typeof contested)[number]) => p.ramps.map((r) => r.dir).sort().join(',');
    expect(contested.some((p) => sides(p) === 'left')).toBe(true);
    expect(contested.some((p) => sides(p) === 'right')).toBe(true);
    expect(contested.some((p) => sides(p) === 'left,right')).toBe(true);
    const shapes = new Set(contested.map((p) => p.shape));
    for (const s of ['rect', 'stepLeft', 'stepRight', 'notch', 'tongue']) expect(shapes.has(s as never)).toBe(true);
    // rampa no canto de dentro: entre a primeira e a última coluna do planalto
    const inner = contested.flatMap((p) => p.ramps.filter((r) => r.x >= p.tx && r.x < p.tx + p.pw));
    expect(inner.length).toBeGreaterThan(5);
  });

  it('as formas em degrau deixam a rampa no canto de dentro', () => {
    // L com a parte funda à esquerda: degrau de 2 e rampa descendo para a direita
    const b = plateauBottoms('stepLeft', 10, 9, 6, 3, 0, 2);
    expect(b).toEqual([15, 15, 15, 13, 13, 13, 13, 13, 13]);
    expect(rampSpots(20, b).inner).toEqual([{ x: 23, y: 15, dir: 'right' }]);
    // U: entalhe no meio com uma rampa em cada canto
    const u = plateauBottoms('notch', 0, 10, 7, 3, 3, 3);
    expect(rampSpots(0, u).inner).toEqual([
      { x: 3, y: 6, dir: 'right' },
      { x: 6, y: 6, dir: 'left' },
    ]);
  });

  for (const seed of [2, 4, 7, 12]) {
    it(`mapa ${seed}: todo o topo dos planaltos é alcançável pelas rampas`, () => {
      const world = new World({ seed, difficulty: 'normal', fog: false });
      const nav = world.nav;
      const castle = world.mainBuilding(0)!;
      const seen = new Uint8Array(nav.w * nav.h);
      const q: number[] = [];
      for (let x = castle.tx - 1; x <= castle.tx + castle.def.w && !q.length; x++) {
        const y = castle.ty + castle.def.h;
        if (nav.walkable(x, y)) q.push(y * nav.w + x);
      }
      seen[q[0]] = 1;
      while (q.length) {
        const i = q.pop()!;
        const x = i % nav.w;
        const y = Math.floor(i / nav.w);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const j = (y + dy) * nav.w + x + dx;
            if ((dx || dy) && nav.inBounds(x + dx, y + dy) && !seen[j] && nav.canStep(x, y, x + dx, y + dy)) {
              seen[j] = 1;
              q.push(j);
            }
          }
      }
      // abaixo das duas linhas de floresta, todo tile livre do topo é alcançável
      for (const p of world.map.plateaus)
        p.bottoms.forEach((bottom, c) => {
          for (let y = p.ty + 2; y <= bottom; y++) {
            const x = p.tx + c;
            if (nav.walkable(x, y)) expect(seen[y * nav.w + x], `tile ${x},${y} (${p.shape})`).toBe(1);
          }
        });
    });
  }
});

describe('relevo: partida', () => {
  const world = new World({ seed: 7, difficulty: 'normal', fog: false });
  const nav = world.nav;
  /** Um lugar no topo de um planalto onde cabe uma casa. */
  const topTile = (() => {
    for (let y = 1; y < nav.h - 1; y++)
      for (let x = 1; x < nav.w - 1; x++) if (nav.level(x, y) === 1 && canPlace(world, 0, BUILDINGS.house, x, y)) return { x, y };
    throw new Error('sem planalto');
  })();

  it('dá para construir no topo, mas não atravessando a borda', () => {
    expect(nav.rectOneLevel(topTile.x, topTile.y, 2, 2)).toBe(true);
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
