import { TILE } from '../config';
import { closestPointInRect, distToRect } from '../core/math';
import { BALANCE } from '../data/balance';
import { CARRY_CAPACITY } from '../data/resources';
import type { ResType, UnitId } from '../data/types';
import type { Building, ResourceNode, Tool, Unit } from '../entities/Entity';
import type { Order } from '../entities/orders';
import {
  aimPoint,
  canAttack,
  canHeal,
  faceTowards,
  findTarget,
  findWounded,
  inAttackRange,
  isHealer,
  levelOf,
  resolveAttack,
  startAttack,
} from './combat';
import { deposit, depleteNode, nearestDropoff, nearestNode, recomputePop } from './economy';
import { hasPath, moveToGoal, moveToPoint, steerTo, stopMoving } from './movement';
import type { World } from './World';

/** Distância (borda a borda) para considerar que o trabalhador alcançou o alvo. */
const REACH = 14;

/** Duração da animação de ataque/cura de cada unidade (s): o estado 'attack' dura isso. */
const ATTACK_ANIM: Record<UnitId, number> = { pawn: 0.4, warrior: 0.4, lancer: 0.3, archer: 0.57, monk: 0.92 };

/** Ferramenta usada para coletar cada recurso. */
const TOOL_FOR: Record<ResType, Tool> = { wood: 'axe', gold: 'pickaxe', meat: 'knife' };

/** Dá uma ordem à unidade (ou enfileira com Shift). */
export function setOrder(world: World, u: Unit, order: Order | null, queue = false): void {
  if (queue && (u.order || u.queue.length)) {
    if (order) u.queue.push(order);
    return;
  }
  releaseSlot(world, u);
  u.order = order;
  u.queue = [];
  u.phase = 0;
  u.timer = 0;
  u.anchor = null;
  u.targetId = 0;
  u.tool = null;
  clearWorkAnim(u);
}

function completeOrder(u: Unit): void {
  u.order = u.queue.shift() ?? null;
  u.phase = 0;
  u.timer = 0;
  u.targetId = 0;
  u.tool = null;
  if (!u.order) stopMoving(u);
}

/** Libera a vaga do peão na jazida de ouro (se estiver minerando). */
function releaseSlot(world: World, u: Unit): void {
  for (const r of world.resources) if (r.def.maxWorkers) r.workers.delete(u.id);
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
        case 'heal':
          doHeal(world, u, o);
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
  if (u.windupTimer >= 0 || (u.anim === 'attack' && u.cooldown > u.def.cooldown - ATTACK_ANIM[u.def.id])) {
    u.anim = 'attack';
    return;
  }
  if (u.anim === 'work') return; // mantido pelo comportamento de trabalho
  const walking = u.moving || hasPath(u);
  const carrying = !!u.carry && u.carry.amount > 0;
  if (walking) u.anim = carrying ? 'carryRun' : 'run';
  else if (carrying) u.anim = 'carryIdle';
  else u.anim = u.order?.type === 'hold' ? 'guard' : 'idle';
}

function clearWorkAnim(u: Unit): void {
  if (u.anim === 'work') u.anim = 'idle';
}

function scanReady(u: Unit, dt: number): boolean {
  u.scanTimer -= dt;
  if (u.scanTimer > 0) return false;
  u.scanTimer = BALANCE.aggroScanInterval;
  return true;
}

function idle(world: World, u: Unit, dt: number): void {
  clearWorkAnim(u);
  u.tool = null;
  if (u.isWorker || hasPath(u)) return;
  if (!scanReady(u, dt)) return;
  if (isHealer(u)) {
    const w = findWounded(world, u, u.def.sight * TILE);
    if (w) {
      u.order = { type: 'heal', targetId: w.id, auto: true };
      u.anchor = { x: u.x, y: u.y };
    }
    return;
  }
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
    // monges curam no caminho; os demais param para lutar e depois continuam a marcha
    const t = isHealer(u) ? findWounded(world, u, u.def.sight * TILE) : findTarget(world, u, u.def.sight * TILE);
    if (t) {
      u.queue.unshift({ type: 'attackMove', x: o.x, y: o.y });
      u.order = isHealer(u) ? { type: 'heal', targetId: t.id, auto: true } : { type: 'attack', targetId: t.id, auto: true };
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
  if (isHealer(u)) {
    // monge parado cura quem estiver ao alcance
    let t = u.targetId ? world.get(u.targetId) : undefined;
    if (!canHeal(u, t) || !inAttackRange(world, u, t)) {
      t = undefined;
      u.targetId = 0;
      if (scanReady(u, dt)) {
        const c = findWounded(world, u, u.def.range + 24);
        if (c && inAttackRange(world, u, c)) {
          u.targetId = c.id;
          t = c;
        }
      }
    }
    if (canHeal(u, t) && u.cooldown <= 0 && u.windupTimer < 0) startAttack(u, t);
    return;
  }
  let t = u.targetId ? world.get(u.targetId) : undefined;
  if (!canAttack(u, t) || !inAttackRange(world, u, t)) {
    t = undefined;
    u.targetId = 0;
    if (scanReady(u, dt)) {
      const c = findTarget(world, u, u.def.range + 48);
      if (c && inAttackRange(world, u, c)) {
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
    if (!u.order && o.auto && anchor && !isHealer(u)) {
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
  if (inAttackRange(world, u, t)) {
    if (hasPath(u)) stopMoving(u);
    const p = aimPoint(u, t);
    faceTowards(u, p.x, p.y);
    if (u.cooldown <= 0 && u.windupTimer < 0) startAttack(u, t);
    return;
  }
  if (u.windupTimer >= 0) return;
  chase(world, u, t);
}

/** Monge: vai até o aliado ferido e cura enquanto ele não estiver com a vida cheia. */
function doHeal(world: World, u: Unit, o: Extract<Order, { type: 'heal' }>): void {
  clearWorkAnim(u);
  const t = world.get(o.targetId);
  if (!canHeal(u, t)) {
    const anchor = u.anchor;
    completeOrder(u);
    if (!u.order && o.auto && anchor) {
      const next = findWounded(world, u, u.def.sight * TILE);
      if (next) {
        u.order = { type: 'heal', targetId: next.id, auto: true };
        u.anchor = anchor;
      } else if (Math.hypot(anchor.x - u.x, anchor.y - u.y) > TILE * 2) {
        u.order = { type: 'move', x: anchor.x, y: anchor.y };
      }
    }
    return;
  }
  u.targetId = t.id;
  if (inAttackRange(world, u, t)) {
    if (hasPath(u)) stopMoving(u);
    faceTowards(u, t.x, t.y);
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
  const level = u.def.attack === 'melee' ? levelOf(world, t) : undefined;
  if (t.kind === 'building') {
    const rangeTiles = Math.max(1, Math.floor((u.def.range + u.radius) / TILE));
    moveToGoal(world, u, { ...t.goal, range: rangeTiles, level });
    return;
  }
  const rangeTiles = Math.max(0, Math.floor(u.def.range / TILE));
  moveToGoal(
    world,
    u,
    { rx: Math.floor(t.x / TILE), ry: Math.floor(t.y / TILE), rw: 1, rh: 1, range: rangeTiles, level },
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
  // o peão precisa chegar pelo mesmo nível do alvo (sobe pela rampa se preciso)
  moveToGoal(world, u, { ...t.goal, level: levelOf(world, t) });
}

// ---------------------------------------------------------------- economia

function reachNode(world: World, u: Unit, r: ResourceNode): boolean {
  if (levelOf(world, u) !== levelOf(world, r)) return false;
  if (r.def.kind === 'sheep') return Math.hypot(r.x - u.x, r.y - u.y) <= u.radius + r.radius + 8;
  return distToRect(u.x, u.y, r.rect) - u.radius <= REACH;
}

function reachBuilding(world: World, u: Unit, b: Building): boolean {
  return levelOf(world, u) === levelOf(world, b) && distToRect(u.x, u.y, b.rect) - u.radius <= REACH;
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
    node?.workers.delete(u.id);
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
    // indo até o recurso, já com a ferramenta na mão
    clearWorkAnim(u);
    if (u.carry && u.carry.res !== node.def.res) u.carry = null;
    if (u.carry && u.carry.amount >= CARRY_CAPACITY) {
      u.phase = 2;
      return;
    }
    u.tool = TOOL_FOR[node.def.res];
    if (!reachNode(world, u, node)) {
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
    if (node.def.maxWorkers && !node.workers.has(u.id)) {
      if (node.workers.size >= node.def.maxWorkers) {
        // jazida cheia: depois de um tempo tenta outra próxima
        u.timer += dt;
        if (u.timer > 2) {
          u.timer = 0;
          const other = nearestNode(world, u.x, u.y, node.def.res, 14 * TILE, node.id);
          if (other && other.workers.size < other.def.maxWorkers) o.nodeId = other.id;
        }
        return;
      }
      node.workers.add(u.id);
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
    u.tool = TOOL_FOR[node.def.res];
    u.anim = 'work';
    u.timer += dt;
    const per = 1 / node.def.rate;
    while (u.timer >= per && u.carry && u.carry.amount < CARRY_CAPACITY && node.amount > 0) {
      u.timer -= per;
      u.carry.amount++;
      node.amount--;
      if (node.def.kind !== 'sheep' && u.carry.amount % 2 === 0) {
        node.hitSeq++;
        if (node.def.kind === 'tree') world.events.emit({ type: 'treeHit', id: node.id });
      }
    }
    if (!u.carry || u.carry.amount >= CARRY_CAPACITY || node.amount <= 0) {
      node.workers.delete(u.id);
      if (node.amount <= 0) depleteNode(world, node);
      u.anim = 'idle';
      u.tool = null;
      u.phase = 2;
    }
    return;
  }

  doReturnPhase(world, u, o);
}

function doReturnPhase(world: World, u: Unit, o: Extract<Order, { type: 'gather' }>): void {
  clearWorkAnim(u);
  u.tool = null;
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
  if (reachBuilding(world, u, drop)) {
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
  u.tool = null;
  if (!u.carry) {
    completeOrder(u);
    return;
  }
  const drop = nearestDropoff(world, u);
  if (!drop) {
    completeOrder(u);
    return;
  }
  if (reachBuilding(world, u, drop)) {
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
  u.tool = 'hammer';
  if (!reachBuilding(world, u, b)) {
    clearWorkAnim(u);
    goNear(world, u, b);
    return;
  }
  if (hasPath(u)) stopMoving(u);
  faceTowards(u, b.x, b.y);
  u.anim = 'work';
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
