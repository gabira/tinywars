import { TILE } from '../config';
import { closestPointInRect, distToRect } from '../core/math';
import { BALANCE } from '../data/balance';
import { CARRY_CAPACITY } from '../data/resources';
import type { Building, ResourceNode, Unit } from '../entities/Entity';
import type { Order } from '../entities/orders';
import { canAttack, faceTowards, findTarget, inAttackRange, aimPoint, resolveAttack, startAttack } from './combat';
import { deposit, depleteNode, nearestDropoff, nearestNode, recomputePop } from './economy';
import { hasPath, moveToGoal, moveToPoint, steerTo, stopMoving } from './movement';
import type { World } from './World';

/** Distância (borda a borda) para considerar que o trabalhador alcançou o alvo. */
const REACH = 14;

/** Dá uma ordem à unidade (ou enfileira com Shift). */
export function setOrder(world: World, u: Unit, order: Order | null, queue = false): void {
  if (queue && (u.order || u.queue.length)) {
    if (order) u.queue.push(order);
    return;
  }
  leaveMine(world, u);
  u.order = order;
  u.queue = [];
  u.phase = 0;
  u.timer = 0;
  u.anchor = null;
  u.targetId = 0;
  if (u.anim === 'chop' || u.anim === 'build') u.anim = 'idle';
}

function completeOrder(u: Unit): void {
  u.order = u.queue.shift() ?? null;
  u.phase = 0;
  u.timer = 0;
  u.targetId = 0;
  if (!u.order) stopMoving(u);
}

function leaveMine(world: World, u: Unit): void {
  if (!u.hidden) return;
  for (const r of world.resources) if (r.workers.delete(u.id)) exitMine(u, r);
  u.hidden = false;
}

function exitMine(u: Unit, r: ResourceNode): void {
  u.hidden = false;
  u.x = r.x + ((u.id % 5) - 2) * 10;
  u.y = r.rect.y + r.rect.h + 18;
  u.prevX = u.x;
  u.prevY = u.y;
}

export function updateBehaviors(world: World, dt: number): void {
  for (const u of world.units) {
    if (!u.alive) continue;
    u.cooldown -= dt;
    if (u.windupTimer >= 0) {
      u.windupTimer -= dt;
      if (u.windupTimer < 0) resolveAttack(world, u);
      if (!u.alive) continue;
    }
    if (!u.order && u.queue.length) {
      u.order = u.queue.shift()!;
      u.phase = 0;
    }
    const o = u.order;
    if (!o) idle(world, u, dt);
    else {
      switch (o.type) {
        case 'move':
          doMove(world, u, o);
          break;
        case 'attackMove':
          doAttackMove(world, u, o, dt);
          break;
        case 'attack':
          doAttack(world, u, o);
          break;
        case 'gather':
          doGather(world, u, o, dt);
          break;
        case 'returnCargo':
          doReturn(world, u);
          break;
        case 'build':
          doBuild(world, u, o, dt);
          break;
        case 'hold':
          doHold(world, u, dt);
          break;
      }
    }
    updateAnim(u);
  }
}

function updateAnim(u: Unit): void {
  if (u.windupTimer >= 0 || (u.anim === 'attack' && u.cooldown > u.def.cooldown - 0.6)) {
    u.anim = 'attack';
    return;
  }
  if (u.anim === 'chop' || u.anim === 'build') return; // mantidos pelo comportamento de trabalho
  const walking = u.moving || hasPath(u);
  if (u.carry && u.carry.amount > 0) u.anim = walking ? 'carryRun' : 'carryIdle';
  else u.anim = walking ? 'run' : 'idle';
}

function clearWorkAnim(u: Unit): void {
  if (u.anim === 'chop' || u.anim === 'build') u.anim = 'idle';
}

function scanReady(u: Unit, dt: number): boolean {
  u.scanTimer -= dt;
  if (u.scanTimer > 0) return false;
  u.scanTimer = BALANCE.aggroScanInterval;
  return true;
}

function idle(world: World, u: Unit, dt: number): void {
  clearWorkAnim(u);
  if (u.isWorker || hasPath(u)) return;
  if (!scanReady(u, dt)) return;
  const t = findTarget(world, u, u.def.sight * TILE);
  if (t) {
    u.order = { type: 'attack', targetId: t.id, auto: true };
    u.anchor = { x: u.x, y: u.y };
  }
}

function doMove(world: World, u: Unit, o: Extract<Order, { type: 'move' }>): void {
  clearWorkAnim(u);
  if (u.phase === 0) {
    moveToPoint(world, u, o.x, o.y);
    u.phase = 1;
    return;
  }
  if (!hasPath(u)) completeOrder(u);
}

function doAttackMove(world: World, u: Unit, o: Extract<Order, { type: 'attackMove' }>, dt: number): void {
  clearWorkAnim(u);
  if (!u.isWorker && scanReady(u, dt)) {
    const t = findTarget(world, u, u.def.sight * TILE);
    if (t) {
      // interrompe a marcha para lutar e depois continua
      u.queue.unshift({ type: 'attackMove', x: o.x, y: o.y });
      u.order = { type: 'attack', targetId: t.id, auto: true };
      u.phase = 0;
      u.anchor = null;
      return;
    }
  }
  if (u.phase === 0) {
    moveToPoint(world, u, o.x, o.y);
    u.phase = 1;
    return;
  }
  if (!hasPath(u)) completeOrder(u);
}

function doHold(world: World, u: Unit, dt: number): void {
  clearWorkAnim(u);
  if (hasPath(u)) stopMoving(u);
  let t = u.targetId ? world.get(u.targetId) : undefined;
  if (!canAttack(u, t) || !inAttackRange(u, t)) {
    t = undefined;
    u.targetId = 0;
    if (scanReady(u, dt)) {
      const c = findTarget(world, u, u.def.range + 48);
      if (c && inAttackRange(u, c)) {
        u.targetId = c.id;
        t = c;
      }
    }
  }
  if (canAttack(u, t) && u.cooldown <= 0 && u.windupTimer < 0) startAttack(u, t);
}

function doAttack(world: World, u: Unit, o: Extract<Order, { type: 'attack' }>): void {
  clearWorkAnim(u);
  const t = world.get(o.targetId);
  if (!canAttack(u, t)) {
    const anchor = u.anchor;
    completeOrder(u);
    // ataque automático: procura outro alvo perto ou volta para onde estava
    if (!u.order && o.auto && anchor) {
      const next = findTarget(world, u, u.def.sight * TILE);
      if (next) {
        u.order = { type: 'attack', targetId: next.id, auto: true };
        u.anchor = anchor;
      } else if (Math.hypot(anchor.x - u.x, anchor.y - u.y) > TILE) {
        u.order = { type: 'move', x: anchor.x, y: anchor.y };
      }
    }
    return;
  }
  // perseguição automática tem limite
  if (o.auto && u.anchor && Math.hypot(u.x - u.anchor.x, u.y - u.anchor.y) > u.def.sight * TILE * 1.6) {
    const a = u.anchor;
    u.anchor = null;
    u.order = { type: 'move', x: a.x, y: a.y };
    u.phase = 0;
    return;
  }
  u.targetId = t.id;
  if (inAttackRange(u, t)) {
    if (hasPath(u)) stopMoving(u);
    const p = aimPoint(u, t);
    faceTowards(u, p.x, p.y);
    if (u.cooldown <= 0 && u.windupTimer < 0) startAttack(u, t);
    return;
  }
  if (u.windupTimer >= 0) return;
  chase(world, u, t);
}

/** Ponto logo fora do alvo, do lado da unidade (aproximação final em linha reta). */
function approachPoint(u: Unit, t: ResourceNode | Building | Unit): { x: number; y: number } {
  const isRect = t.kind === 'building' || (t.kind === 'resource' && t.def.kind !== 'sheep');
  const p = isRect ? closestPointInRect(u.x, u.y, (t as Building | ResourceNode).rect) : { x: t.x, y: t.y };
  const dx = u.x - p.x;
  const dy = u.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const off = isRect ? u.radius + 6 : Math.max(0, u.radius + t.radius - 6);
  return { x: p.x + (dx / d) * off, y: p.y + (dy / d) * off };
}

function chase(world: World, u: Unit, t: Unit | Building): void {
  const p = approachPoint(u, t);
  if (Math.hypot(p.x - u.x, p.y - u.y) < TILE * 1.6 && steerTo(world, u, p.x, p.y)) return;
  if (u.goalKey === 'direct') u.goalKey = '';
  if (world.time - u.lastPathReq < 0.5 && hasPath(u)) return;
  if (!hasPath(u)) u.goalKey = '';
  if (t.kind === 'building') {
    const rangeTiles = Math.max(1, Math.floor((u.def.range + u.radius) / TILE));
    moveToGoal(world, u, { ...t.goal, range: rangeTiles });
    return;
  }
  const rangeTiles = Math.max(0, Math.floor(u.def.range / TILE));
  moveToGoal(
    world,
    u,
    { rx: Math.floor(t.x / TILE), ry: Math.floor(t.y / TILE), rw: 1, rh: 1, range: rangeTiles },
    rangeTiles === 0 ? { x: t.x, y: t.y } : null,
  );
}

/** Anda até perto do alvo: caminho A* e, no fim, linha reta. Re-planeja no máximo 2x/s. */
function goNear(world: World, u: Unit, t: ResourceNode | Building): void {
  const p = approachPoint(u, t);
  if (Math.hypot(p.x - u.x, p.y - u.y) < TILE * 1.5 && steerTo(world, u, p.x, p.y)) return;
  if (u.goalKey === 'direct') u.goalKey = '';
  if (!hasPath(u)) {
    if (world.time - u.lastPathReq < 0.5) return;
    u.goalKey = '';
  }
  moveToGoal(world, u, t.goal);
}

// ---------------------------------------------------------------- economia

function reachNode(u: Unit, r: ResourceNode): boolean {
  if (r.def.kind === 'sheep') return Math.hypot(r.x - u.x, r.y - u.y) <= u.radius + r.radius + 8;
  return distToRect(u.x, u.y, r.rect) - u.radius <= REACH;
}

function reachBuilding(u: Unit, b: Building): boolean {
  return distToRect(u.x, u.y, b.rect) - u.radius <= REACH;
}

function doGather(world: World, u: Unit, o: Extract<Order, { type: 'gather' }>, dt: number): void {
  if (!u.isWorker) {
    completeOrder(u);
    return;
  }
  let node = world.getResource(o.nodeId);
  if (!node || !node.alive || node.amount <= 0) {
    if (u.phase === 2) {
      doReturnPhase(world, u, o);
      return;
    }
    if (u.hidden && node) {
      node.workers.delete(u.id);
      exitMine(u, node);
    }
    const res = node?.def.res ?? u.carry?.res ?? null;
    const next = res ? nearestNode(world, u.x, u.y, res, 10 * TILE, o.nodeId) : null;
    if (next) {
      o.nodeId = next.id;
      node = next;
      u.phase = 0;
    } else {
      clearWorkAnim(u);
      if (u.carry && u.carry.amount > 0) {
        u.order = { type: 'returnCargo' };
        u.phase = 0;
      } else completeOrder(u);
      return;
    }
  }
  u.lastNodeId = node.id;

  if (u.phase === 0) {
    // indo até o recurso
    clearWorkAnim(u);
    if (u.carry && u.carry.res !== node.def.res) u.carry = null;
    if (u.carry && u.carry.amount >= CARRY_CAPACITY) {
      u.phase = 2;
      return;
    }
    if (!reachNode(u, node)) {
      // recurso cercado (ex.: árvore no meio da floresta): depois de um tempo parado, troca de alvo
      if (!hasPath(u)) {
        u.timer += dt;
        if (u.timer > 2.5) {
          u.timer = 0;
          const other = nearestNode(world, u.x, u.y, node.def.res, 6 * TILE, node.id);
          if (other) o.nodeId = other.id;
        }
      } else u.timer = 0;
      goNear(world, u, node);
      return;
    }
    stopMoving(u);
    if (node.def.maxWorkers) {
      if (node.workers.size >= node.def.maxWorkers) {
        // mina cheia: depois de um tempo tenta outra mina próxima
        u.timer += dt;
        if (u.timer > 2) {
          u.timer = 0;
          const other = nearestNode(world, u.x, u.y, node.def.res, 14 * TILE, node.id);
          if (other && other.workers.size < other.def.maxWorkers) o.nodeId = other.id;
        }
        return;
      }
      node.workers.add(u.id);
      u.hidden = true;
    }
    if (node.def.kind === 'sheep' && !node.isPile) {
      node.isPile = true;
      node.hitSeq++;
    }
    u.phase = 1;
    u.timer = 0;
    if (!u.carry) u.carry = { res: node.def.res, amount: 0 };
    return;
  }

  if (u.phase === 1) {
    // trabalhando
    faceTowards(u, node.x, node.y);
    u.anim = u.hidden ? 'idle' : 'chop';
    u.timer += dt;
    const per = 1 / node.def.rate;
    while (u.timer >= per && u.carry && u.carry.amount < CARRY_CAPACITY && node.amount > 0) {
      u.timer -= per;
      u.carry.amount++;
      node.amount--;
      if (node.def.kind === 'tree' && u.carry.amount % 2 === 0) {
        node.hitSeq++;
        world.events.emit({ type: 'treeHit', id: node.id });
      }
    }
    if (!u.carry || u.carry.amount >= CARRY_CAPACITY || node.amount <= 0) {
      if (u.hidden) {
        node.workers.delete(u.id);
        exitMine(u, node);
      }
      if (node.amount <= 0) depleteNode(world, node);
      u.anim = 'idle';
      u.phase = 2;
    }
    return;
  }

  doReturnPhase(world, u, o);
}

function doReturnPhase(world: World, u: Unit, o: Extract<Order, { type: 'gather' }>): void {
  clearWorkAnim(u);
  if (!u.carry || u.carry.amount <= 0) {
    u.carry = null;
    u.phase = 0;
    return;
  }
  const drop = nearestDropoff(world, u);
  if (!drop) {
    stopMoving(u);
    return;
  }
  if (reachBuilding(u, drop)) {
    stopMoving(u);
    const res = u.carry.res;
    deposit(world, u, drop);
    u.phase = 0;
    const node = world.getResource(o.nodeId);
    if (!node || !node.alive) {
      const next = nearestNode(world, u.x, u.y, res, 14 * TILE);
      if (next) o.nodeId = next.id;
      else completeOrder(u);
    }
    return;
  }
  goNear(world, u, drop);
}

function doReturn(world: World, u: Unit): void {
  clearWorkAnim(u);
  if (!u.carry) {
    completeOrder(u);
    return;
  }
  const drop = nearestDropoff(world, u);
  if (!drop) {
    completeOrder(u);
    return;
  }
  if (reachBuilding(u, drop)) {
    stopMoving(u);
    deposit(world, u, drop);
    const node = world.getResource(u.lastNodeId);
    if (node && node.alive && !u.queue.length) {
      u.order = { type: 'gather', nodeId: node.id };
      u.phase = 0;
    } else completeOrder(u);
    return;
  }
  goNear(world, u, drop);
}

function doBuild(world: World, u: Unit, o: Extract<Order, { type: 'build' }>, dt: number): void {
  const b = world.getBuilding(o.buildingId);
  if (!b || !b.alive || b.team !== u.team || (b.complete && b.hp >= b.maxHp)) {
    clearWorkAnim(u);
    completeOrder(u);
    return;
  }
  if (!reachBuilding(u, b)) {
    clearWorkAnim(u);
    goNear(world, u, b);
    return;
  }
  if (hasPath(u)) stopMoving(u);
  faceTowards(u, b.x, b.y);
  u.anim = 'build';
  if (!b.complete) {
    const t = b.def.buildTime;
    b.progress += dt / t;
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * (1 - BALANCE.constructionStartHp) * dt) / t);
    if (b.progress >= 1) {
      b.progress = 1;
      b.complete = true;
      recomputePop(world);
      world.events.emit({ type: 'buildingCompleted', id: b.id, team: b.team });
    }
  } else {
    // reparo gratuito
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * dt) / (b.def.buildTime * 2));
  }
}
