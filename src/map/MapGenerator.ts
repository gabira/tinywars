import { MAP_H, MAP_W } from '../config';
import { Rng } from '../core/rng';
import type { ResourceKind } from '../data/types';
import { RESOURCES } from '../data/resources';

export interface PlacedResource {
  kind: ResourceKind;
  tx: number;
  ty: number;
  /** Quantidade inicial (se diferente do padrão do recurso). */
  amount?: number;
}

export interface Decor {
  key: string;
  tx: number;
  ty: number;
  /** Deslocamento em px dentro do tile. */
  ox: number;
  oy: number;
}

/** Tiles de rampa: parte de cima (no nível do planalto) e de baixo (no chão), à esquerda ou à direita. */
export const RAMP = { upLeft: 1, downLeft: 2, upRight: 3, downRight: 4 } as const;

export interface GameMap {
  w: number;
  h: number;
  seed: number;
  /** 1 = terra, 0 = água */
  land: Uint8Array;
  /** 1 = mancha de grama em outro tom (apenas visual, caminhável) */
  patch: Uint8Array;
  /** 1 = topo de planalto (caminhável, nível 1) */
  plateau: Uint8Array;
  /** 1 = face do penhasco logo abaixo de um planalto (intransponível) */
  cliff: Uint8Array;
  /** Rampas (valores de RAMP): ligam o chão ao topo do planalto */
  ramp: Uint8Array;
  /** Canto superior esquerdo do footprint 5x3 da base principal de cada time. */
  starts: [{ tx: number; ty: number }, { tx: number; ty: number }];
  resources: PlacedResource[];
  decor: Decor[];
  /** Planaltos gerados (os canônicos e os seus espelhos). */
  plateaus: Plateau[];
}

/** Tile intransponível por causa do relevo (face do penhasco)? */
export function reliefBlocked(map: GameMap, x: number, y: number): boolean {
  return map.cliff[y * map.w + x] === 1;
}

/** Nível do tile: 1 no topo do planalto e na parte de cima das rampas, 0 no resto. */
export function elevationAt(map: GameMap, x: number, y: number): number {
  const i = y * map.w + x;
  const r = map.ramp[i];
  return map.plateau[i] === 1 || r === RAMP.upLeft || r === RAMP.upRight ? 1 : 0;
}

export const MAIN_W = 5;
export const MAIN_H = 3;

/** Quantidade de ouro por tipo de jazida (maior onde é mais arriscado). */
export const GOLD_AMOUNT = { base: 1500, basePlateau: 2000, field: 2500, contested: 3000 } as const;

/** Rampa de um planalto: (x, y) é o tile de cima; o de baixo fica em (x, y + 1). */
export interface PlateauRamp {
  x: number;
  y: number;
  /** Lado para onde a rampa desce. */
  dir: 'left' | 'right';
}

/** Formato do planalto: retângulo ou degraus na borda sul (a rampa fica no canto de dentro). */
export type PlateauShape = 'rect' | 'stepLeft' | 'stepRight' | 'notch' | 'tongue';

export interface Plateau {
  /** Retângulo envolvente (o topo é sempre reto; a borda de baixo varia por coluna). */
  tx: number;
  ty: number;
  pw: number;
  ph: number;
  shape: PlateauShape;
  /** Última linha do topo em cada coluna (pw valores). */
  bottoms: number[];
  ramps: PlateauRamp[];
  /** Planalto ao lado de uma base (menor recompensa) ou disputado no meio do mapa. */
  nearBase: boolean;
  /** Gerado na metade de cima (o outro é o seu espelho). */
  canonical: boolean;
}

/**
 * Perfil da borda sul: `d` é a altura do degrau (≥ 2 para caber uma rampa no canto de dentro).
 * - stepLeft: parte funda à esquerda (L); stepRight: à direita
 * - notch: fundo nas pontas e entalhe no meio (U); tongue: língua funda no meio (T)
 */
export function plateauBottoms(shape: PlateauShape, ty: number, pw: number, ph: number, a: number, b: number, d: number): number[] {
  const deep = ty + ph - 1;
  const shallow = deep - d;
  return Array.from({ length: pw }, (_, i) => {
    switch (shape) {
      case 'rect':
        return deep;
      case 'stepLeft':
        return i < a ? deep : shallow;
      case 'stepRight':
        return i >= pw - a ? deep : shallow;
      case 'notch':
        return i < a || i >= pw - b ? deep : shallow;
      case 'tongue':
        return i >= a && i < pw - b ? deep : shallow;
    }
  });
}

/** Rampas possíveis: nas pontas de fora e nos cantos de dentro dos degraus (desnível ≥ 2). */
export function rampSpots(tx: number, bottoms: number[]): { outerLeft: PlateauRamp; outerRight: PlateauRamp; inner: PlateauRamp[] } {
  const pw = bottoms.length;
  const inner: PlateauRamp[] = [];
  for (let i = 0; i < pw - 1; i++) {
    const diff = bottoms[i] - bottoms[i + 1];
    if (diff >= 2) inner.push({ x: tx + i + 1, y: bottoms[i], dir: 'right' });
    if (diff <= -2) inner.push({ x: tx + i, y: bottoms[i + 1], dir: 'left' });
  }
  return {
    outerLeft: { x: tx - 1, y: bottoms[0], dir: 'left' },
    outerRight: { x: tx + pw, y: bottoms[pw - 1], dir: 'right' },
    inner,
  };
}

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

  // --- ocupação (reservas) e recursos
  const occ = new Uint8Array(N);
  /** Tiles ocupados por recursos (para a decoração não cair em cima). */
  const resOcc = new Uint8Array(N);
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

  const plateau = new Uint8Array(N);
  const ramp = new Uint8Array(N);
  const onPlateau = (tx: number, ty: number, rw: number, rh: number) => {
    for (let y = ty; y < ty + rh; y++) for (let x = tx; x < tx + rw; x++) if (plateau[idx(x, y)]) return true;
    return false;
  };
  /** Todo o retângulo no mesmo nível (tudo no topo do planalto ou tudo no chão). */
  const oneLevel = (tx: number, ty: number, rw: number, rh: number) => {
    let top = 0;
    for (let y = ty; y < ty + rh; y++) for (let x = tx; x < tx + rw; x++) top += plateau[idx(x, y)];
    return top === 0 || top === rw * rh;
  };

  const resources: PlacedResource[] = [];
  /** Coloca um recurso em `a` e o seu par em `b` (os dois ou nenhum). */
  const addAt = (kind: ResourceKind, a: { tx: number; ty: number }, b: { tx: number; ty: number }, margin = 0, amount?: number): boolean => {
    const def = RESOURCES[kind];
    if (!canUse(a.tx, a.ty, def.w, def.h, margin) || !canUse(b.tx, b.ty, def.w, def.h, margin)) return false;
    if (!oneLevel(a.tx, a.ty, def.w, def.h) || !oneLevel(b.tx, b.ty, def.w, def.h)) return false;
    // evita sobreposição com o próprio espelho perto do centro
    if (Math.abs(a.tx - b.tx) < def.w + margin && Math.abs(a.ty - b.ty) < def.h + margin) return false;
    resources.push({ kind, tx: a.tx, ty: a.ty, amount }, { kind, tx: b.tx, ty: b.ty, amount });
    for (const o of [a, b]) {
      reserve(o.tx, o.ty, def.w, def.h);
      for (let y = o.ty; y < o.ty + def.h; y++) for (let x = o.tx; x < o.tx + def.w; x++) resOcc[idx(x, y)] = 1;
    }
    return true;
  };
  /** Recurso no chão e o seu espelho (rotação de 180°). */
  const addPair = (kind: ResourceKind, tx: number, ty: number, margin = 0, amount?: number): boolean => {
    const def = RESOURCES[kind];
    return addAt(kind, { tx, ty }, mirrorRect(tx, ty, def.w, def.h), margin, amount);
  };

  const c0 = baseCenter(p0);
  const c1 = baseCenter(p1);

  // jazida de ouro e ovelhas de cada base (antes dos planaltos, para terem prioridade)
  const mineSpots = [
    [8, -6],
    [9, -5],
    [7, -7],
    [10, -3],
    [2, -9],
    [11, 0],
    [-3, -8],
  ];
  for (const [dx, dy] of mineSpots) if (addPair('goldMine', Math.round(c0.x + dx), Math.round(c0.y + dy), 1, GOLD_AMOUNT.base)) break;
  let sheep = 0;
  for (let tries = 0; tries < 80 && sheep < 8; tries++) {
    const x = Math.round(c0.x + rng.range(5, 9));
    const y = Math.round(c0.y + rng.range(-1, 3));
    if (addPair('sheep', x, y)) sheep++;
  }

  // --- planaltos (um nível): topo caminhável, penhasco ao sul e rampas nas laterais de baixo.
  // Gerados na metade de cima (onde fica a base da IA) e espelhados só na horizontal: o penhasco
  // fica sempre virado para o sul (o tileset só tem essa face) e as rampas trocam de lado.
  const pairs: [Plateau, Plateau][] = [];
  const stampPlateau = (p: Plateau) => {
    p.bottoms.forEach((bottom, i) => {
      for (let y = p.ty; y <= bottom; y++) plateau[idx(p.tx + i, y)] = 1;
    });
    // margem de chão em volta, incluindo o recuo embaixo dos degraus (o topo fica livre)
    for (let y = p.ty - 1; y <= p.ty + p.ph + 1; y++)
      for (let x = p.tx - 2; x <= p.tx + p.pw + 1; x++) if (inB(x, y) && !plateau[idx(x, y)]) occ[idx(x, y)] = 1;
    for (const r of p.ramps) {
      const left = r.dir === 'left';
      ramp[idx(r.x, r.y)] = left ? RAMP.upLeft : RAMP.upRight;
      ramp[idx(r.x, r.y + 1)] = left ? RAMP.downLeft : RAMP.downRight;
      reserve(left ? r.x + 1 : r.x - 2, r.y - 1, 2, 2); // chegada no topo
      reserve(left ? r.x - 2 : r.x + 1, r.y - 1, 2, 4); // acesso pelo chão
    }
  };
  /** Espelho do planalto: mesma posição da rotação de 180°, mas só invertido na horizontal. */
  const mirrorPlateau = (p: Plateau): Plateau => {
    const m = mirrorRect(p.tx, p.ty, p.pw, p.ph);
    return {
      ...p,
      tx: m.tx,
      ty: m.ty,
      shape: p.shape === 'stepLeft' ? 'stepRight' : p.shape === 'stepRight' ? 'stepLeft' : p.shape,
      bottoms: p.bottoms.map((_, i) => m.ty + p.bottoms[p.pw - 1 - i] - p.ty),
      ramps: p.ramps.map((r) => ({ x: w - 1 - r.x, y: m.ty + r.y - p.ty, dir: r.dir === 'left' ? 'right' : 'left' })),
      canonical: false,
    };
  };
  /**
   * Sorteia o formato e as rampas. Nos planaltos disputados o lado da rampa varia (esquerda,
   * direita ou as duas); com degraus, a rampa fica no canto de dentro, no meio da face sul.
   * `nearBase`: a rampa desce para a direita, o lado da base da IA.
   */
  const shapePlateau = (tx: number, ty: number, pw: number, ph: number, nearBase: boolean): Plateau => {
    let shape: PlateauShape = rng.pick<PlateauShape>(nearBase ? ['rect', 'rect', 'stepLeft'] : ['rect', 'stepLeft', 'stepRight', 'notch', 'tongue']);
    // o degrau deixa pelo menos 4 linhas atravessando o planalto inteiro
    const d = Math.min(rng.int(2, 3), ph - 4);
    let a = 0;
    let b = 0;
    if (shape === 'stepLeft' || shape === 'stepRight') a = rng.int(3, pw - 4);
    else if (shape === 'notch' || shape === 'tongue') {
      a = rng.int(3, 4);
      b = rng.int(3, 4);
    }
    if (d < 2 || (shape === 'notch' && pw - a - b < 4) || (shape === 'tongue' && pw - a - b < 3)) shape = 'rect';
    const bottoms = plateauBottoms(shape, ty, pw, ph, a, b, d);
    const spots = rampSpots(tx, bottoms);
    let ramps: PlateauRamp[];
    if (nearBase) ramps = shape === 'rect' ? [spots.outerRight] : spots.inner.filter((r) => r.dir === 'right');
    else if (shape === 'rect') {
      const roll = rng.next();
      ramps = roll < 0.4 ? [spots.outerLeft, spots.outerRight] : roll < 0.7 ? [spots.outerLeft] : [spots.outerRight];
    } else if (shape === 'stepLeft' || shape === 'stepRight') {
      ramps = [...spots.inner];
      if (rng.chance(0.5)) ramps.push(rng.chance(0.5) ? spots.outerLeft : spots.outerRight);
    } else {
      ramps = rng.chance(0.3) ? [rng.pick(spots.inner)] : [...spots.inner];
    }
    return { tx, ty, pw, ph, shape, bottoms, ramps, nearBase, canonical: true };
  };
  const tryPlateau = (tx: number, ty: number, pw: number, ph: number, nearBase: boolean): boolean => {
    if (ty + ph + 1 > Math.floor(h / 2) - 2) return false; // bloco inteiro na metade de cima
    const block = (x: number, y: number) => canUse(x - 1, y, pw + 2, ph + 1, 1);
    const m = mirrorRect(tx, ty, pw, ph);
    if (!block(tx, ty) || !block(m.tx, m.ty)) return false;
    const a = shapePlateau(tx, ty, pw, ph, nearBase);
    const b = mirrorPlateau(a);
    stampPlateau(a);
    stampPlateau(b);
    pairs.push([a, b]);
    return true;
  };

  // um planalto perto de cada base (a oeste, ao sul ou a sudoeste dela), com a rampa virada para ela
  for (let tries = 0; tries < 90; tries++) {
    const pw = rng.int(9, 12);
    const ph = rng.int(5, 7);
    const side = tries % 3;
    let tx: number;
    let ty: number;
    if (side === 0) {
      tx = Math.round(c1.x - 7 - pw - rng.range(0, 4));
      ty = Math.round(c1.y - 1 + rng.range(0, 5));
    } else if (side === 1) {
      tx = Math.round(c1.x - pw / 2 + rng.range(-5, 2));
      ty = Math.round(c1.y + 6 + rng.range(0, 4));
    } else {
      tx = Math.round(c1.x - pw - rng.range(3, 8));
      ty = Math.round(c1.y + rng.range(4, 10));
    }
    if (tryPlateau(tx, ty, pw, ph, true)) break;
  }
  // planaltos disputados no meio do mapa
  const contested = Math.max(1, Math.round(k * 0.7));
  for (let placed = 0, tries = 0; placed < contested && tries < 250; tries++) {
    const pw = rng.int(8, 13);
    const ph = rng.int(6, 7);
    const tx = rng.int(Math.floor(w * 0.1), Math.floor(w * 0.7));
    const ty = rng.int(3, Math.floor(h / 2) - ph - 3);
    const cx = tx + pw / 2;
    const cy = ty + ph / 2;
    if (Math.hypot(cx - c1.x, cy - c1.y) < 16 || Math.hypot(cx - c0.x, cy - c0.y) < 16) continue;
    if (tryPlateau(tx, ty, pw, ph, false)) placed++;
  }

  // recursos no topo: jazida grande no meio, floresta na borda de trás e ovelhas.
  // O par de cada recurso vai para o mesmo ponto do planalto espelhado.
  for (const [a, b] of pairs) {
    const top = (x: number, y: number, rw: number, rh: number) => {
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) if (!inB(xx, yy) || !plateau[idx(xx, yy)]) return false;
      return true;
    };
    const put = (kind: ResourceKind, x: number, y: number, amount?: number) => {
      const def = RESOURCES[kind];
      const m = { tx: w - x - def.w, ty: b.ty + y - a.ty };
      return top(x, y, def.w, def.h) && top(m.tx, m.ty, def.w, def.h) && addAt(kind, { tx: x, ty: y }, m, 0, amount);
    };
    // linhas que atravessam o planalto inteiro (acima dos degraus)
    const body = Math.min(...a.bottoms) - a.ty + 1;
    put('goldMine', a.tx + Math.floor(a.pw / 2) - 1, a.ty + Math.floor(body / 2) - 1, a.nearBase ? GOLD_AMOUNT.basePlateau : GOLD_AMOUNT.contested);
    for (let x = a.tx + 1; x < a.tx + a.pw - 1; x++) {
      if (rng.chance(0.85)) put('tree', x, a.ty);
      if (rng.chance(0.35)) put('tree', x, a.ty + 1);
    }
    let sheep = 0;
    for (let t = 0; t < 30 && sheep < 3; t++) {
      if (put('sheep', rng.int(a.tx + 1, a.tx + a.pw - 2), rng.int(a.ty + 2, a.ty + a.ph - 2))) sheep++;
    }
  }

  // florestas no chão (as dos planaltos já foram postas)
  const forest = (cx: number, cy: number, r: number, density: number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r || !inB(x, y) || plateau[idx(x, y)]) continue;
        const dBase = Math.min(Math.hypot(x - c0.x, y - c0.y), Math.hypot(w - 1 - x - c0.x, h - 1 - y - c0.y));
        if (dBase < 5.5) continue;
        if (rng.chance(density * (1 - (d / r) * 0.5))) addPair('tree', x, y);
      }
  };
  forest(c0.x - 1, c0.y - 9, 3.6, 0.85); // floresta acima da base
  forest(c0.x + 12, c0.y + 3.5, 3, 0.8); // floresta à direita da base

  // jazidas contestadas no chão, no meio do mapa
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
    if (!onPlateau(x, y, 2, 2) && addPair('goldMine', x, y, 1, GOLD_AMOUNT.field)) minesPlaced++;
  }

  // rebanhos neutros no meio do mapa
  for (let flock = 0; flock < Math.round(k * 1.5) - 1; flock++) {
    const fx = rng.range(8, w - 8);
    const fy = rng.range(6, h / 2);
    if (Math.hypot(fx - c0.x, fy - c0.y) < 14 || Math.hypot(w - 1 - fx - c0.x, h - 1 - fy - c0.y) < 14) continue;
    for (let s = 0; s < 3; s++) {
      const x = Math.round(fx + rng.range(-2, 2));
      const y = Math.round(fy + rng.range(-1.5, 1.5));
      if (!onPlateau(x, y, 1, 1)) addPair('sheep', x, y);
    }
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

  // --- penhascos: a linha logo abaixo do topo de cada planalto (menos onde há rampa)
  const cliff = new Uint8Array(N);
  for (let y = 1; y < h; y++)
    for (let x = 0; x < w; x++) if (plateau[idx(x, y - 1)] && !plateau[idx(x, y)] && !ramp[idx(x, y)]) cliff[idx(x, y)] = 1;

  // --- conectividade: garante caminho pelo chão entre as bases
  const blockingRes = new Uint8Array(N);
  const markBlocking = () => {
    blockingRes.fill(0);
    for (const r of resources) {
      const d = RESOURCES[r.kind];
      if (!d.blocking) continue;
      for (let y = r.ty; y < r.ty + d.h; y++) for (let x = r.tx; x < r.tx + d.w; x++) blockingRes[idx(x, y)] = 1;
    }
  };
  const walkGround = (x: number, y: number) =>
    inB(x, y) && land[idx(x, y)] === 1 && !plateau[idx(x, y)] && !cliff[idx(x, y)] && !ramp[idx(x, y)] && !blockingRes[idx(x, y)];
  const connected = () => {
    markBlocking();
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
        if (walkGround(nx, ny) && !seen[idx(nx, ny)]) {
          seen[idx(nx, ny)] = 1;
          q.push({ x: nx, y: ny });
        }
      }
    }
    return false;
  };
  if (!connected()) {
    // abre um corredor em linha reta removendo árvores e aterrando água (sem mexer nos planaltos)
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
          if (!inB(x, y) || plateau[idx(x, y)] || cliff[idx(x, y)] || ramp[idx(x, y)]) continue;
          land[idx(x, y)] = 1;
          for (let i = resources.length - 1; i >= 0; i--) {
            const r = resources[i];
            if (r.kind === 'tree' && r.tx === x && r.ty === y) resources.splice(i, 1);
          }
        }
    }
  }

  // --- manchas de grama em outro tom (decorativas, só no chão)
  const patch = new Uint8Array(N);
  for (let i = 0; i < Math.round(4 * k); i++) {
    const cx = rng.range(6, w - 6);
    const cy = rng.range(4, h / 2);
    const r = rng.range(1.8, 3.2);
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if (inB(x, y) && Math.hypot(x - cx, y - cy) <= r) patch[idx(x, y)] = 1;
  }
  mirrorTiles(patch);
  for (let i = 0; i < N; i++) if (!land[i]) patch[i] = 0;
  // longe da costa (evita conflito visual com a espuma)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (!patch[i]) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (!inB(x + dx, y + dy) || !land[idx(x + dx, y + dy)]) patch[i] = 0;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (!patch[i]) continue;
      const S = (a: number, b: number) => inB(a, b) && patch[idx(a, b)] === 1;
      if (!(S(x - 1, y) || S(x + 1, y)) || !(S(x, y - 1) || S(x, y + 1))) patch[i] = 0;
    }

  // --- decoração (não bloqueia): arbustos e pedras no chão e no topo dos planaltos
  const decor: Decor[] = [];
  const groundDeco = ['bush1', 'bush2', 'bush3', 'bush4', 'bush1', 'bush2', 'rock1', 'rock2', 'rock3', 'rock4'];
  for (let i = 0; i < Math.round(70 * k); i++) {
    const x = rng.int(1, w - 2);
    const y = rng.int(1, h - 2);
    const j = idx(x, y);
    if (!land[j] || cliff[j] || ramp[j] || resOcc[j]) continue;
    if (occ[j] && !plateau[j]) continue;
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

  return { w, h, seed, land, patch, plateau, cliff, ramp, starts: [p0, p1], resources, decor, plateaus: pairs.flat() };
}
