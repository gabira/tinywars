import { TILE } from '../config';
import type { Vec } from '../core/math';
import type { Unit } from '../entities/Entity';
import type { PathGoal } from './pathfinding/AStar';
import { lineClear } from './pathfinding/smoothPath';
import type { World } from './World';

const goalKeyOf = (g: PathGoal) => `${g.rx},${g.ry},${g.rw},${g.rh},${g.range}`;

/** Pede um caminho até o objetivo (não repete se o objetivo não mudou). */
export function moveToGoal(world: World, u: Unit, goal: PathGoal, final: Vec | null = null): void {
  const key = goalKeyOf(goal);
  if (u.goalKey === key && (u.pathPending || u.pathIdx < u.path.length)) {
    if (final) u.finalPoint = final;
    return;
  }
  u.goalKey = key;
  u.goal = goal;
  u.finalPoint = final;
  world.paths.request(u);
}

/** Move até um ponto do mundo. */
export function moveToPoint(world: World, u: Unit, x: number, y: number): void {
  moveToGoal(world, u, { rx: Math.floor(x / TILE), ry: Math.floor(y / TILE), rw: 1, rh: 1, range: 0 }, { x, y });
}

/** Anda em linha reta (usado na aproximação final de alvos próximos). */
export function steerTo(world: World, u: Unit, x: number, y: number): boolean {
  if (!lineClear(world.nav, u.x, u.y, x, y, 6)) return false;
  u.path = [{ x, y }];
  u.pathIdx = 0;
  u.pathPending = false;
  u.goalKey = 'direct';
  u.goal = null;
  return true;
}

export function stopMoving(u: Unit): void {
  u.path = [];
  u.pathIdx = 0;
  u.pathPending = false;
  u.goal = null;
  u.goalKey = '';
  u.finalPoint = null;
  u.moving = false;
}

export function hasPath(u: Unit): boolean {
  return u.pathPending || u.pathIdx < u.path.length;
}

export function updateMovement(world: World, dt: number): void {
  const nav = world.nav;
  for (const u of world.units) {
    if (!u.alive || u.hidden) continue;
    if (u.pathPending || u.pathIdx >= u.path.length) {
      u.moving = false;
      continue;
    }

    // o mapa mudou (nova construção/árvore removida): confere se o caminho ainda vale
    if (u.pathVersion !== nav.version && u.goal) {
      u.pathVersion = nav.version;
      for (let i = u.pathIdx; i < u.path.length; i++) {
        const p = u.path[i];
        if (!nav.walkable(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) {
          world.paths.request(u);
          break;
        }
      }
    }

    const wp = u.path[u.pathIdx];
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const d = Math.hypot(dx, dy);
    const step = u.def.speed * dt;
    if (d <= step || d < 2) {
      u.x = wp.x;
      u.y = wp.y;
      u.pathIdx++;
    } else {
      const nx = u.x + (dx / d) * step;
      const ny = u.y + (dy / d) * step;
      if (canMove(nav, u.x, u.y, nx, ny)) {
        u.x = nx;
        u.y = ny;
      } else if (canMove(nav, u.x, u.y, nx, u.y)) {
        u.x = nx;
      } else if (canMove(nav, u.x, u.y, u.x, ny)) {
        u.y = ny;
      }
      if (Math.abs(dx) > 0.5) u.facingX = Math.sign(dx);
      u.facingY = dy / d;
    }
    u.moving = true;

    // detecção de travamento
    u.stuckTimer += dt;
    if (u.stuckTimer >= 1) {
      const prog = Math.hypot(u.x - u.lastProgress.x, u.y - u.lastProgress.y);
      u.stuckTimer = 0;
      u.lastProgress = { x: u.x, y: u.y };
      if (prog < 8) {
        u.stuckCount++;
        if (u.stuckCount > 3) {
          stopMoving(u);
          u.stuckCount = 0;
        } else if (u.goal) {
          world.paths.request(u);
        }
      } else {
        u.stuckCount = 0;
      }
    }
  }
}

const neighbors: Unit[] = [];

/** Separação simples entre unidades (evita que fiquem empilhadas). */
export function updateSeparation(world: World, dt: number): void {
  const nav = world.nav;
  for (const u of world.units) {
    if (!u.alive || u.hidden) continue;
    world.unitHash.query(u.x, u.y, 48, neighbors);
    let px = 0;
    let py = 0;
    for (const o of neighbors) {
      if (o === u || o.hidden || !o.alive) continue;
      let dx = u.x - o.x;
      let dy = u.y - o.y;
      let d = Math.hypot(dx, dy);
      const min = (u.radius + o.radius) * 1.05;
      if (d >= min) continue;
      if (d < 0.01) {
        dx = ((u.id * 7919) % 13) - 6;
        dy = ((u.id * 104729) % 11) - 5;
        d = Math.hypot(dx, dy) || 1;
      }
      // quem está parado cede espaço para quem está andando
      const weight = u.moving && !o.moving ? 0.2 : !u.moving && o.moving ? 1.2 : 0.6;
      const overlap = (min - d) * weight;
      px += (dx / d) * overlap;
      py += (dy / d) * overlap;
    }
    if (px === 0 && py === 0) continue;
    const maxPush = 90 * dt;
    const len = Math.hypot(px, py);
    if (len > maxPush) {
      px = (px / len) * maxPush;
      py = (py / len) * maxPush;
    }
    const nx = u.x + px;
    const ny = u.y + py;
    if (canMove(nav, u.x, u.y, nx, ny)) {
      u.x = nx;
      u.y = ny;
    }
  }
}

/** Pode ir de um ponto a outro (mesmo tile, ou tile vizinho respeitando nível e rampas)? */
function canMove(nav: World['nav'], x0: number, y0: number, x1: number, y1: number): boolean {
  const ax = Math.floor(x0 / TILE);
  const ay = Math.floor(y0 / TILE);
  const bx = Math.floor(x1 / TILE);
  const by = Math.floor(y1 / TILE);
  if (ax === bx && ay === by) return nav.walkable(bx, by) || !nav.walkable(ax, ay);
  if (Math.abs(bx - ax) > 1 || Math.abs(by - ay) > 1) return false;
  if (ax !== bx && ay !== by) return (nav.canStep(ax, ay, bx, ay) && nav.canStep(bx, ay, bx, by)) || (nav.canStep(ax, ay, ax, by) && nav.canStep(ax, by, bx, by));
  return nav.canStep(ax, ay, bx, by);
}
