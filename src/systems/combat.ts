import { TILE } from '../config';
import { distToRect, closestPointInRect } from '../core/math';
import { BALANCE } from '../data/balance';
import type { Team } from '../data/types';
import { Building, Projectile, Unit, type AnyEntity } from '../entities/Entity';
import { stopMoving } from './movement';
import type { World } from './World';

const ARROW_SPEED = 600;

/** Distância da borda de `u` até a borda do alvo. */
export function edgeDistance(u: { x: number; y: number; radius: number }, t: AnyEntity): number {
  if (t.kind === 'building') return distToRect(u.x, u.y, t.rect) - u.radius;
  return Math.hypot(t.x - u.x, t.y - u.y) - u.radius - t.radius;
}

export function inAttackRange(u: Unit, t: AnyEntity, slack = 0): boolean {
  return edgeDistance(u, t) <= u.def.range + slack;
}

/** Ponto do alvo mais próximo de u (para mirar/aproximar). */
export function aimPoint(u: { x: number; y: number }, t: AnyEntity): { x: number; y: number } {
  if (t.kind === 'building') return closestPointInRect(u.x, u.y, t.rect);
  return { x: t.x, y: t.y };
}

export function faceTowards(u: Unit, x: number, y: number): void {
  const dx = x - u.x;
  const dy = y - u.y;
  const d = Math.hypot(dx, dy) || 1;
  if (Math.abs(dx) > 1) u.facingX = Math.sign(dx);
  u.facingY = dy / d;
}

export const isHealer = (u: Unit): boolean => u.def.attack === 'heal';

/** Pode atacar o alvo? (monges não atacam). */
export function canAttack(u: Unit, t: AnyEntity | undefined): t is Unit | Building {
  return !!t && !isHealer(u) && t.alive && t.kind !== 'resource' && t.team !== u.team && !(t.kind === 'unit' && t.hidden);
}

/** O monge pode curar este aliado? */
export function canHeal(u: Unit, t: AnyEntity | undefined): t is Unit {
  return !!t && isHealer(u) && t.kind === 'unit' && t.alive && t.team === u.team && t !== u && !t.hidden && t.hp < t.maxHp;
}

/** Inicia um golpe, disparo ou cura: o efeito acontece depois do `windup`. */
export function startAttack(u: Unit, t: Unit | Building): void {
  const p = aimPoint(u, t);
  faceTowards(u, p.x, p.y);
  stopMoving(u);
  u.windupTimer = u.def.windup;
  u.pendingTargetId = t.id;
  u.cooldown = u.def.cooldown;
  u.attackSeq++;
  u.anim = 'attack';
}

/** Chamado quando o "windup" termina: aplica o golpe, dispara a flecha ou cura. */
export function resolveAttack(world: World, u: Unit): void {
  const t = world.get(u.pendingTargetId);
  const def = u.def;
  if (def.attack === 'heal') {
    if (!canHeal(u, t)) return;
    t.hp = Math.min(t.maxHp, t.hp + def.damage);
    world.events.emit({ type: 'healed', id: t.id, x: t.x, y: t.y, team: t.team });
    return;
  }
  if (!canAttack(u, t)) return;
  if (def.attack === 'melee') {
    if (inAttackRange(u, t, 16)) dealDamage(world, u.team, t, def.damage, u.id);
    return;
  }
  const p = aimPoint(u, t);
  world.addProjectile(new Projectile(world.newId(), u.team, u.x, u.y - 8, p.x, p.y, t.id, def.damage, u.id));
}

export function dealDamage(world: World, team: Team, t: Unit | Building, amount: number, attackerId: number): void {
  if (!t.alive) return;
  const dmg = Math.max(1, Math.round(amount - t.def.armor));
  t.hp -= dmg;
  const victim = world.players[t.team];
  if (world.time - victim.lastAttackAlert > 12) {
    victim.lastAttackAlert = world.time;
    world.events.emit({ type: 'underAttack', team: t.team, x: t.x, y: t.y, building: t.kind === 'building' });
  }
  if (t.kind === 'unit') {
    t.lastHitTime = world.time;
    retaliate(world, t, attackerId);
  } else {
    callForHelp(world, t.team, t.x, t.y, attackerId);
  }
  if (t.hp <= 0) kill(world, t, team);
}

/** Unidade atingida parada revida; aliados ociosos próximos ajudam. */
function retaliate(world: World, victim: Unit, attackerId: number): void {
  const attacker = world.getUnit(attackerId);
  if (!attacker || !attacker.alive) return;
  if (!victim.order && !victim.isWorker && !isHealer(victim) && !victim.queue.length) {
    victim.order = { type: 'attack', targetId: attacker.id, auto: true };
    victim.anchor = { x: victim.x, y: victim.y };
  }
  callForHelp(world, victim.team, victim.x, victim.y, attackerId);
}

function callForHelp(world: World, team: Team, x: number, y: number, attackerId: number): void {
  const attacker = world.get(attackerId);
  if (!attacker || !attacker.alive) return;
  for (const a of world.units) {
    if (a.team !== team || a.isWorker || isHealer(a) || a.order || a.queue.length || !a.alive) continue;
    if (Math.hypot(a.x - x, a.y - y) > BALANCE.helpRadius) continue;
    a.order = { type: 'attack', targetId: attackerId, auto: true };
    a.anchor = { x: a.x, y: a.y };
  }
}

export function kill(world: World, e: Unit | Building, killerTeam: Team | null): void {
  if (!e.alive) return;
  e.alive = false;
  e.hp = 0;
  if (e.kind === 'unit') {
    for (const r of world.resources) r.workers.delete(e.id);
    world.players[e.team].stats.lost++;
    if (killerTeam !== null && killerTeam !== e.team) world.players[killerTeam].stats.killed++;
    world.events.emit({ type: 'unitDied', id: e.id, x: e.x, y: e.y, team: e.team, killerTeam });
  } else {
    world.nav.unblockRect(e.tx, e.ty, e.def.w, e.def.h);
    e.destroyedAt = world.time;
    world.events.emit({ type: 'buildingDestroyed', id: e.id, x: e.x, y: e.y, team: e.team });
  }
}

const scan: Unit[] = [];

/** Procura o melhor alvo inimigo dentro de `radius` (unidades que atacam > unidades > construções). */
export function findTarget(world: World, u: { x: number; y: number; team: Team }, radius: number): Unit | Building | null {
  world.unitHash.query(u.x, u.y, radius + 24, scan);
  let best: Unit | Building | null = null;
  let bestScore = Infinity;
  for (const o of scan) {
    if (!o.alive || o.team === u.team || o.hidden) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y) - o.radius;
    if (d > radius) continue;
    let score = d;
    if (o.isWorker) score += 60;
    if (o.order?.type === 'attack' || o.windupTimer >= 0) score -= 80;
    // monges inimigos são alvos valiosos
    if (isHealer(o)) score -= 30;
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  if (best) return best;
  for (const b of world.buildings) {
    if (!b.alive || b.team === u.team) continue;
    const d = distToRect(u.x, u.y, b.rect);
    if (d > radius) continue;
    const score = d + 200;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

/** Aliado ferido mais necessitado dentro de `radius` (para monges). */
export function findWounded(world: World, u: Unit, radius: number): Unit | null {
  world.unitHash.query(u.x, u.y, radius + 24, scan);
  let best: Unit | null = null;
  let bestScore = Infinity;
  for (const o of scan) {
    if (!canHeal(u, o)) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d > radius) continue;
    const score = (o.hp / o.maxHp) * 300 + d * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

/** Torres atiram flechas automaticamente no inimigo mais próximo. */
export function updateTowers(world: World, dt: number): void {
  for (const b of world.buildings) {
    const atk = b.def.attack;
    if (!atk || !b.complete || !b.alive) continue;
    b.cooldown -= dt;
    if (b.cooldown > 0) continue;
    const t = findTarget(world, { x: b.x, y: b.y, team: b.team }, atk.range);
    if (!t) continue;
    b.cooldown = atk.cooldown;
    b.attackSeq++;
    const src = { x: b.x, y: b.y - TILE * 1.6 };
    const p = aimPoint(src, t);
    world.addProjectile(new Projectile(world.newId(), b.team, src.x, src.y, p.x, p.y, t.id, atk.damage, b.id));
  }
}

export function updateProjectiles(world: World, dt: number): void {
  for (const p of world.projectiles) {
    if (!p.alive) continue;
    const t = world.get(p.targetId);
    if (t && t.alive && t.kind !== 'resource') {
      const a = aimPoint({ x: p.x, y: p.y }, t);
      p.tx = a.x;
      p.ty = a.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = ARROW_SPEED * dt;
    p.angle = Math.atan2(dy, dx);
    if (d <= step + 4) {
      p.x = p.tx;
      p.y = p.ty;
      p.alive = false;
      if (t && t.alive && t.kind !== 'resource' && t.team !== p.team) dealDamage(world, p.team, t, p.damage, p.attackerId);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }
}
