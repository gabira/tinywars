import { TILE } from '../config';
import { distToRect } from '../core/math';
import { BALANCE } from '../data/balance';
import type { BuildingDef, ResType, Team } from '../data/types';
import { UNITS } from '../data/units';
import { SHEEP_RESPAWN } from '../data/resources';
import type { Building, ResourceNode, Unit } from '../entities/Entity';
import { moveToPoint } from './movement';
import type { World } from './World';

export function computePopCap(world: World, team: Team): number {
  let cap = 0;
  for (const b of world.buildings) if (b.alive && b.team === team && b.complete) cap += b.def.pop;
  return Math.min(BALANCE.popHardCap, cap);
}

export function recomputePop(world: World): void {
  for (const p of world.players) {
    p.pop = 0;
    p.popCap = computePopCap(world, p.team);
  }
  for (const u of world.units) if (u.alive) world.players[u.team].pop += u.def.pop;
}

/** Depósito (castelo/casa) completo mais próximo. */
export function nearestDropoff(world: World, u: Unit): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of world.buildings) {
    if (!b.alive || b.team !== u.team || !b.complete || !b.def.dropoff) continue;
    const d = distToRect(u.x, u.y, b.rect);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function deposit(world: World, u: Unit, b: Building): void {
  if (!u.carry || u.carry.amount <= 0) return;
  const p = world.players[u.team];
  const amount = Math.round(u.carry.amount * p.gatherMult);
  p.res[u.carry.res] += amount;
  p.stats.gathered += amount;
  world.events.emit({ type: 'deposit', team: u.team, res: u.carry.res, amount, x: b.x, y: b.y - TILE });
  u.carry = null;
}

/** Nó de recurso do mesmo tipo mais próximo (opcionalmente dentro de um raio). */
export function nearestNode(
  world: World,
  x: number,
  y: number,
  res: ResType,
  maxDist = Infinity,
  exclude = 0,
): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestD = Infinity;
  for (const r of world.resources) {
    if (!r.alive || r.id === exclude || r.def.res !== res || r.amount <= 0) continue;
    const d = Math.hypot(r.x - x, r.y - y) + (r.def.maxWorkers && r.workers.size >= r.def.maxWorkers ? 200 : 0);
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

export function depleteNode(world: World, r: ResourceNode): void {
  if (!r.alive) return;
  r.alive = false;
  r.amount = 0;
  if (r.def.blocking) world.nav.unblockRect(r.tx, r.ty, r.def.w, r.def.h);
  if (r.def.kind === 'sheep') world.respawns.push({ tx: r.tx, ty: r.ty, at: world.time + SHEEP_RESPAWN });
  world.events.emit({ type: 'resourceDepleted', id: r.id });
}

export type PlacementError = 'invalidPlacement' | null;

/** Verifica se a construção cabe no local (terra livre, explorada para o jogador, sem unidades inimigas). */
export function canPlace(world: World, team: Team, def: BuildingDef, tx: number, ty: number): boolean {
  if (tx < 1 || ty < 1 || tx + def.w > world.map.w - 1 || ty + def.h > world.map.h - 1) return false;
  if (!world.nav.rectFree(tx, ty, def.w, def.h)) return false;
  // inteira num só nível (chão ou topo do planalto) e sem tapar rampas
  if (!world.nav.rectOneLevel(tx, ty, def.w, def.h)) return false;
  if (team === 0 && world.vision.enabled) {
    for (let y = ty; y < ty + def.h; y++)
      for (let x = tx; x < tx + def.w; x++) if (!world.vision.isExplored(x, y)) return false;
  }
  // sem inimigos em cima
  const rect = { x: tx * TILE, y: ty * TILE, w: def.w * TILE, h: def.h * TILE };
  for (const u of world.units) {
    if (u.alive && u.team !== team && distToRect(u.x, u.y, rect) < 4) return false;
  }
  // sheep/meat piles também ocupam espaço
  for (const r of world.resources) {
    if (r.alive && !r.def.blocking && distToRect(r.x, r.y, rect) < 8) return false;
  }
  return true;
}

/** Ponto livre ao redor de uma construção, de preferência voltado para `toward`. */
export function spawnPoint(world: World, b: Building, toward: { x: number; y: number } | null): { x: number; y: number } {
  const { tx, ty } = b;
  const { w, h } = b.def;
  const candidates: { x: number; y: number; d: number }[] = [];
  const tgt = toward ?? { x: b.x, y: (ty + h + 2) * TILE };
  // a unidade nasce no mesmo nível da construção (não "cai" do planalto)
  const lv = world.nav.level(tx, ty);
  for (let ring = 0; ring < 4; ring++) {
    for (let y = ty - 1 - ring; y <= ty + h + ring; y++)
      for (let x = tx - 1 - ring; x <= tx + w + ring; x++) {
        const onRing = x === tx - 1 - ring || x === tx + w + ring || y === ty - 1 - ring || y === ty + h + ring;
        if (!onRing || !world.nav.walkable(x, y) || world.nav.level(x, y) !== lv) continue;
        const px = x * TILE + TILE / 2;
        const py = y * TILE + TILE / 2;
        candidates.push({ x: px, y: py, d: Math.hypot(px - tgt.x, py - tgt.y) });
      }
    if (candidates.length) break;
  }
  if (!candidates.length) return { x: b.x, y: b.y + (h * TILE) / 2 + 20 };
  candidates.sort((a, c) => a.d - c.d);
  const c = candidates[0];
  return { x: c.x + world.rng.range(-10, 10), y: c.y + world.rng.range(-10, 10) };
}

export function updateProduction(world: World, dt: number): void {
  for (const b of world.buildings) {
    if (!b.alive || !b.complete || !b.queue.length) continue;
    const item = b.queue[0];
    const def = UNITS[item.unit];
    const player = world.players[b.team];
    if (item.t < def.trainTime) {
      item.t = Math.min(def.trainTime, item.t + dt);
      continue;
    }
    // pronto: precisa de espaço na população
    if (player.pop + def.pop > player.popCap) {
      if (world.time - player.lastPopAlert > 8) {
        player.lastPopAlert = world.time;
        world.events.emit({ type: 'popCapped', team: b.team });
      }
      continue;
    }
    b.queue.shift();
    const rally = b.rally;
    const p = spawnPoint(world, b, rally);
    const u = world.spawnUnit(b.team, item.unit, p.x, p.y);
    player.pop += def.pop;
    player.stats.trained++;
    world.events.emit({ type: 'unitTrained', id: u.id, team: b.team });
    if (rally) {
      const node = rally.targetId ? world.getResource(rally.targetId) : undefined;
      if (node && node.alive && u.isWorker) u.order = { type: 'gather', nodeId: node.id };
      else if (Math.hypot(rally.x - u.x, rally.y - u.y) > 40) {
        u.order = { type: 'move', x: rally.x, y: rally.y };
        moveToPoint(world, u, rally.x, rally.y);
      }
    }
  }
}

/** Ovelhas passeiam perto de onde nasceram até virarem carne. */
export function updateSheep(world: World, dt: number): void {
  if (world.respawns.length && world.tick % 20 === 0) {
    world.respawns = world.respawns.filter((s) => {
      if (world.time < s.at) return true;
      if (!world.nav.walkable(s.tx, s.ty)) return world.time < s.at + 120;
      world.addResource('sheep', s.tx, s.ty);
      return false;
    });
  }
  for (const r of world.resources) {
    if (!r.alive || r.def.kind !== 'sheep' || r.isPile) continue;
    r.wanderTimer -= dt;
    if (r.wanderTimer <= 0) {
      r.wanderTimer = world.rng.range(3, 7);
      const tx = r.homeX + world.rng.range(-70, 70);
      const ty = r.homeY + world.rng.range(-50, 50);
      // só passeia no mesmo nível em que nasceu (planalto ou chão)
      const homeLevel = world.nav.levelAt(r.homeX, r.homeY);
      if (world.nav.walkable(Math.floor(tx / TILE), Math.floor(ty / TILE)) && world.nav.levelAt(tx, ty) === homeLevel && !world.nav.isRamp(Math.floor(tx / TILE), Math.floor(ty / TILE))) {
        r.targetX = tx;
        r.targetY = ty;
      }
    }
    const dx = r.targetX - r.x;
    const dy = r.targetY - r.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const s = Math.min(d, 22 * dt);
      const nx = r.x + (dx / d) * s;
      const ny = r.y + (dy / d) * s;
      if (world.nav.levelAt(nx, ny) === world.nav.levelAt(r.homeX, r.homeY) && world.nav.walkable(Math.floor(nx / TILE), Math.floor(ny / TILE))) {
        r.x = nx;
        r.y = ny;
      } else {
        r.targetX = r.x;
        r.targetY = r.y;
      }
    }
  }
}
