import { MAP_H, MAP_W } from '../config';
import { Rng } from '../core/rng';
import type { ResourceKind } from '../data/types';
import { RESOURCES } from '../data/resources';

export interface PlacedResource {
  kind: ResourceKind;
  tx: number;
  ty: number;
}

export interface Decor {
  key: string;
  tx: number;
  ty: number;
  /** Deslocamento em px dentro do tile. */
  ox: number;
  oy: number;
}

export interface GameMap {
  w: number;
  h: number;
  seed: number;
  /** 1 = terra, 0 = água */
  land: Uint8Array;
  /** 1 = mancha de grama em outro tom (apenas visual, caminhável) */
  patch: Uint8Array;
  /** 1 = topo de planalto rochoso (intransponível) */
  plateau: Uint8Array;
  /** 1 = face do penhasco logo abaixo de um planalto (intransponível) */
  cliff: Uint8Array;
  /** Canto superior esquerdo do footprint 5x3 da base principal de cada time. */
  starts: [{ tx: number; ty: number }, { tx: number; ty: number }];
  resources: PlacedResource[];
  decor: Decor[];
}

/** Tile bloqueado pelo relevo (planalto ou penhasco)? */
export function reliefBlocked(map: GameMap, x: number, y: number): boolean {
  const i = y * map.w + x;
  return map.plateau[i] === 1 || map.cliff[i] === 1;
}

export const MAIN_W = 5;
export const MAIN_H = 3;

/** Gera um mapa de ilha com simetria central (justo para os dois lados). */
export function generateMap(seed: number, w = MAP_W, h = MAP_H): GameMap {
  const rng = new Rng(seed);
  /** Quanto o mapa é maior (em área) que o 64x48 original: escala a quantidade de elementos. */
  const k = (w * h) / (64 * 48);
  const N = w * h;
  const idx = (x: number, y: number) => y * w + x;
  const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;

  // --- ruído de valor para bordas irregulares
  const gw = Math.round(w / 8) + 1;
  const gh = Math.round(h / 8) + 1;
  const grid = Array.from({ length: gw * gh }, () => rng.next());
  const noise = (x: number, y: number) => {
    const fx = (x / (w - 1)) * (gw - 1);
    const fy = (y / (h - 1)) * (gh - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(gw - 1, x0 + 1);
    const y1 = Math.min(gh - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x1] * tx;
    const b = grid[y1 * gw + x0] * (1 - tx) + grid[y1 * gw + x1] * tx;
    return a * (1 - ty) + b * ty;
  };

  let land = new Uint8Array(N);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      land[idx(x, y)] = edge >= 2 + Math.round(noise(x, y) * 3) ? 1 : 0;
    }

  // lagos pequenos (espelhados depois)
  const lakes = rng.int(1, 2) + Math.round(k) - 1;
  for (let i = 0; i < lakes; i++) {
    const cx = rng.int(Math.floor(w * 0.3), Math.floor(w * 0.45));
    const cy = rng.int(Math.floor(h * 0.15), Math.floor(h * 0.4));
    const r = rng.range(1.6, 2.6);
    for (let y = -3; y <= 3; y++)
      for (let x = -3; x <= 3; x++) if (x * x + y * y <= r * r && inB(cx + x, cy + y)) land[idx(cx + x, cy + y)] = 0;
  }

  // suavização por autômato celular
  for (let it = 0; it < 2; it++) {
    const next = new Uint8Array(N);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, y + dy) && land[idx(x + dx, y + dy)]) c++;
        next[idx(x, y)] = c >= 5 ? 1 : 0;
      }
    land = next;
  }

  const mirrorTiles = (arr: Uint8Array) => {
    for (let i = 0; i < N / 2; i++) arr[N - 1 - i] = arr[i];
  };
  mirrorTiles(land);

  // --- bases
  const p0 = { tx: 5, ty: h - 10 };
  const p1 = { tx: w - p0.tx - MAIN_W, ty: h - p0.ty - MAIN_H };
  const baseCenter = (p: { tx: number; ty: number }) => ({ x: p.tx + MAIN_W / 2, y: p.ty + MAIN_H / 2 });
  for (const p of [p0, p1]) {
    const c = baseCenter(p);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (d < 9 && edge >= 1) land[idx(x, y)] = 1;
      }
  }

  // remove tiles de terra finos demais (sem vizinho em nenhum eixo)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!land[idx(x, y)]) continue;
        const L = (a: number, b: number) => inB(a, b) && land[idx(a, b)] === 1;
        const horiz = L(x - 1, y) || L(x + 1, y);
        const vert = L(x, y - 1) || L(x, y + 1);
        if (!horiz || !vert) land[idx(x, y)] = 0;
      }
    mirrorTiles(land);
  }

  // --- ocupação (recursos e reservas)
  const occ = new Uint8Array(N);
  const reserve = (tx: number, ty: number, rw: number, rh: number, margin = 0) => {
    for (let y = ty - margin; y < ty + rh + margin; y++)
      for (let x = tx - margin; x < tx + rw + margin; x++) if (inB(x, y)) occ[idx(x, y)] = 1;
  };
  const canUse = (tx: number, ty: number, rw: number, rh: number, margin = 0) => {
    for (let y = ty - margin; y < ty + rh + margin; y++)
      for (let x = tx - margin; x < tx + rw + margin; x++) {
        if (!inB(x, y) || !land[idx(x, y)] || occ[idx(x, y)]) return false;
      }
    return true;
  };
  const mirrorRect = (tx: number, ty: number, rw: number, rh: number) => ({ tx: w - tx - rw, ty: h - ty - rh });

  reserve(p0.tx, p0.ty, MAIN_W, MAIN_H, 2);
  reserve(p1.tx, p1.ty, MAIN_W, MAIN_H, 2);

  const resources: PlacedResource[] = [];
  const addPair = (kind: ResourceKind, tx: number, ty: number, margin = 0): boolean => {
    const def = RESOURCES[kind];
    const m = mirrorRect(tx, ty, def.w, def.h);
    if (!canUse(tx, ty, def.w, def.h, margin) || !canUse(m.tx, m.ty, def.w, def.h, margin)) return false;
    // evita sobreposição com o próprio espelho perto do centro
    if (Math.abs(tx - m.tx) < def.w + margin && Math.abs(ty - m.ty) < def.h + margin) return false;
    resources.push({ kind, tx, ty }, { kind, tx: m.tx, ty: m.ty });
    reserve(tx, ty, def.w, def.h);
    reserve(m.tx, m.ty, def.w, def.h);
    return true;
  };

  const c0 = baseCenter(p0);

  // --- planaltos rochosos (intransponíveis), sempre com o penhasco virado para o sul
  const plateau = new Uint8Array(N);
  const plateauCount = Math.round(2 * k);
  for (let placed = 0, tries = 0; placed < plateauCount && tries < 80; tries++) {
    const pw = rng.int(3, 6);
    const ph = rng.int(2, 3);
    const tx = rng.int(4, w - pw - 4);
    const ty = rng.int(3, Math.floor(h / 2) - ph - 2);
    const cx = tx + pw / 2;
    const cy = ty + ph / 2;
    if (Math.hypot(cx - c0.x, cy - c0.y) < 13 || Math.hypot(w - 1 - cx - c0.x, h - 1 - cy - c0.y) < 13) continue;
    // o bloco inclui a linha do penhasco (ph + 1) e 1 tile de terra livre em volta
    const m = mirrorRect(tx, ty, pw, ph + 1);
    if (!canUse(tx, ty, pw, ph + 1, 1) || !canUse(m.tx, m.ty, pw, ph + 1, 1)) continue;
    if (Math.abs(tx - m.tx) < pw + 3 && Math.abs(ty - m.ty) < ph + 4) continue;
    for (const o of [{ tx, ty }, m]) {
      for (let y = o.ty; y < o.ty + ph; y++) for (let x = o.tx; x < o.tx + pw; x++) plateau[idx(x, y)] = 1;
      reserve(o.tx, o.ty, pw, ph + 1, 1);
    }
    placed++;
  }

  // mina de ouro de cada base
  const mineSpots = [
    [8, -6],
    [9, -5],
    [7, -7],
    [10, -3],
  ];
  for (const [dx, dy] of mineSpots) if (addPair('goldMine', Math.round(c0.x + dx), Math.round(c0.y + dy), 1)) break;

  // ovelhas perto da base
  let sheep = 0;
  for (let tries = 0; tries < 80 && sheep < 8; tries++) {
    const x = Math.round(c0.x + rng.range(5, 9));
    const y = Math.round(c0.y + rng.range(-1, 3));
    if (addPair('sheep', x, y)) sheep++;
  }

  // florestas
  const forest = (cx: number, cy: number, r: number, density: number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const dBase = Math.min(Math.hypot(x - c0.x, y - c0.y), Math.hypot(w - 1 - x - c0.x, h - 1 - y - c0.y));
        if (dBase < 5.5) continue;
        if (rng.chance(density * (1 - (d / r) * 0.5))) addPair('tree', x, y);
      }
  };
  forest(c0.x - 1, c0.y - 9, 3.6, 0.85); // floresta acima da base
  forest(c0.x + 12, c0.y + 3.5, 3, 0.8); // floresta à direita da base

  // minas contestadas no meio
  const midMines = [
    [Math.floor(w / 2) - 9, Math.floor(h / 2) + 1],
    [Math.floor(w / 2) - 11, Math.floor(h / 2) - 2],
    [Math.floor(w / 2) - 7, Math.floor(h / 2) + 4],
    [Math.floor(w * 0.3), Math.floor(h * 0.25)],
    [Math.floor(w * 0.45), Math.floor(h * 0.15)],
    [Math.floor(w * 0.2), Math.floor(h * 0.4)],
  ];
  const minePairs = Math.max(1, Math.round(k * 0.9));
  let minesPlaced = 0;
  for (const [x, y] of midMines) {
    if (minesPlaced >= minePairs) break;
    if (addPair('goldMine', x, y, 1)) minesPlaced++;
  }

  // rebanhos neutros no meio do mapa (mais carne no mapa maior)
  for (let flock = 0; flock < Math.round(k * 1.5) - 1; flock++) {
    const fx = rng.range(8, w - 8);
    const fy = rng.range(6, h / 2);
    if (Math.hypot(fx - c0.x, fy - c0.y) < 14 || Math.hypot(w - 1 - fx - c0.x, h - 1 - fy - c0.y) < 14) continue;
    for (let s = 0; s < 3; s++) addPair('sheep', Math.round(fx + rng.range(-2, 2)), Math.round(fy + rng.range(-1.5, 1.5)));
  }

  // florestas espalhadas
  for (let i = 0; i < Math.round(7 * k); i++) {
    const x = rng.range(4, w - 4);
    const y = rng.range(3, h / 2);
    const dA = Math.hypot(x - c0.x, y - c0.y);
    const dB = Math.hypot(w - 1 - x - c0.x, h - 1 - y - c0.y);
    if (dA < 11 || dB < 11) continue;
    forest(x, y, rng.range(1.5, 3), 0.7);
  }

  // --- conectividade: garante caminho entre as bases
  const cliffBelow = (x: number, y: number) => inB(x, y - 1) && plateau[idx(x, y - 1)] === 1 && plateau[idx(x, y)] === 0;
  const walk = (x: number, y: number) =>
    inB(x, y) && land[idx(x, y)] === 1 && !plateau[idx(x, y)] && !cliffBelow(x, y) && !isBlockingAt(x, y);
  function isBlockingAt(x: number, y: number) {
    for (const r of resources) {
      const d = RESOURCES[r.kind];
      if (d.blocking && x >= r.tx && x < r.tx + d.w && y >= r.ty && y < r.ty + d.h) return true;
    }
    return false;
  }
  const connected = () => {
    const seen = new Uint8Array(N);
    const start = { x: p0.tx + 2, y: p0.ty + MAIN_H + 1 };
    const goal = { x: p1.tx + 2, y: p1.ty - 2 };
    const q = [start];
    seen[idx(start.x, start.y)] = 1;
    while (q.length) {
      const c = q.pop()!;
      if (c.x === goal.x && c.y === goal.y) return true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (walk(nx, ny) && !seen[idx(nx, ny)]) {
          seen[idx(nx, ny)] = 1;
          q.push({ x: nx, y: ny });
        }
      }
    }
    return false;
  };
  if (!connected()) {
    // abre um corredor em linha reta removendo árvores e aterrando água
    const a = baseCenter(p0);
    const b = baseCenter(p1);
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(a.x + ((b.x - a.x) * s) / steps);
      const cy = Math.round(a.y + ((b.y - a.y) * s) / steps);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (!inB(x, y)) continue;
          land[idx(x, y)] = 1;
          plateau[idx(x, y)] = 0;
          if (inB(x, y - 1)) plateau[idx(x, y - 1)] = 0;
          for (let i = resources.length - 1; i >= 0; i--) {
            const r = resources[i];
            if (r.kind === 'tree' && r.tx === x && r.ty === y) resources.splice(i, 1);
          }
        }
    }
  }

  // planaltos cortados pelo corredor: remove pedaços finos demais (autotile precisa de 2x2)
  for (let pass = 0; pass < 2; pass++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!plateau[idx(x, y)]) continue;
        const P = (a: number, b: number) => inB(a, b) && plateau[idx(a, b)] === 1;
        if (!(P(x - 1, y) || P(x + 1, y)) || !(P(x, y - 1) || P(x, y + 1))) plateau[idx(x, y)] = 0;
      }
  const cliff = new Uint8Array(N);
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) if (cliffBelow(x, y)) cliff[idx(x, y)] = 1;

  // --- manchas de grama em outro tom (decorativas)
  const sand = new Uint8Array(N);
  for (let i = 0; i < Math.round(4 * k); i++) {
    const cx = rng.range(6, w - 6);
    const cy = rng.range(4, h / 2);
    const r = rng.range(1.8, 3.2);
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if (inB(x, y) && Math.hypot(x - cx, y - cy) <= r) sand[idx(x, y)] = 1;
  }
  mirrorTiles(sand);
  for (let i = 0; i < N; i++) {
    if (!land[i]) sand[i] = 0;
  }
  // areia só onde a terra não é borda (evita conflito visual com a costa)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (!sand[i]) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (!inB(x + dx, y + dy) || !land[idx(x + dx, y + dy)]) sand[i] = 0;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (!sand[i]) continue;
      const S = (a: number, b: number) => inB(a, b) && sand[idx(a, b)] === 1;
      if (!(S(x - 1, y) || S(x + 1, y)) || !(S(x, y - 1) || S(x, y + 1))) sand[i] = 0;
    }

  // --- decoração (não bloqueia): arbustos e pedras no chão e no topo dos planaltos
  const decor: Decor[] = [];
  const groundDeco = ['bush1', 'bush2', 'bush3', 'bush4', 'bush1', 'bush2', 'rock1', 'rock2', 'rock3', 'rock4'];
  for (let i = 0; i < Math.round(70 * k); i++) {
    const x = rng.int(1, w - 2);
    const y = rng.int(1, h - 2);
    if (!land[idx(x, y)] || cliff[idx(x, y)]) continue;
    if (occ[idx(x, y)] && !plateau[idx(x, y)]) continue;
    decor.push({ key: rng.pick(groundDeco), tx: x, ty: y, ox: rng.int(-14, 14), oy: rng.int(-14, 10) });
  }
  // na água: pedras perto da costa e um patinho de borracha
  const nearLand = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inB(x + dx, y + dy) && land[idx(x + dx, y + dy)]) return true;
    return false;
  };
  let waterRocks = 0;
  for (let i = 0; i < 600 && waterRocks < Math.round(10 * k); i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(0, h - 1);
    if (land[idx(x, y)] || nearLand(x, y, 1) || !nearLand(x, y, 2)) continue;
    decor.push({ key: `water_rock${rng.int(1, 4)}`, tx: x, ty: y, ox: rng.int(-12, 12), oy: rng.int(-12, 12) });
    waterRocks++;
  }
  for (let i = 0; i < 200; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(Math.floor(h / 2), h - 1);
    if (land[idx(x, y)] || nearLand(x, y, 1) || !nearLand(x, y, 3)) continue;
    decor.push({ key: 'duck', tx: x, ty: y, ox: 0, oy: 0 });
    break;
  }

  return { w, h, seed, land, patch: sand, plateau, cliff, starts: [p0, p1], resources, decor };
}
