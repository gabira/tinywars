import { TILE } from '../config';
import { distToRect, closestPointInRect } from '../core/math';
import { BALANCE } from '../data/balance';
import type { Team } from '../data/types';
import { Building, Projectile, Unit, type AnyEntity } from '../entities/Entity';
import { stopMoving } from './movement';
import type { World } from './World';

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

export function canAttack(u: Unit, t: AnyEntity | undefined): t is Unit | Building {
  return !!t && t.alive && t.kind !== 'resource' && t.team !== u.team && !(t.kind === 'unit' && t.hidden);
}

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

/** Chamado quando o "windup" termina: aplica o golpe ou dispara o projétil. */
export function resolveAttack(world: World, u: Unit): void {
  const t = world.get(u.pendingTargetId);
  const def = u.def;
  if (def.attack === 'suicide') {
    explode(world, u.team, u.x, u.y, def.splash ?? 64, def.damage, def.buildingBonus ?? 1, u.id);
    kill(world, u, u.team === 0 ? 1 : 0);
    return;
  }
  if (!canAttack(u, t)) return;
  if (def.attack === 'melee') {
    if (inAttackRange(u, t, 16)) dealDamage(world, u.team, t, def.damage, u.id);
    return;
  }
  const p = aimPoint(u, t);
  if (def.attack === 'arrow') {
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    world.addProjectile(
      new Projectile(world.newId(), 'arrow', u.team, u.x, u.y - 8, p.x, p.y, t.id, def.damage, 0, 1, d / 600, 0, u.id),
    );
  } else if (def.attack === 'dynamite') {
    // mira um pouco à frente de alvos em movimento
    let tx = p.x;
    let ty = p.y;
    if (t.kind === 'unit' && t.moving) {
      tx += (t.x - t.prevX) * 8;
      ty += (t.y - t.prevY) * 8;
    }
    const d = Math.hypot(tx - u.x, ty - u.y);
    world.addProjectile(
      new Projectile(world.newId(), 'dynamite', u.team, u.x, u.y - 8, tx, ty, 0, def.damage, def.splash ?? 48, 1, 0.45 + d / 700, 40 + d * 0.2, u.id),
    );
  }
}

export function dealDamage(world: World, team: Team, t: Unit | Building, amount: number, attackerId: number): void {
  if (!t.alive) return;
  const armor = t.kind === 'unit' ? t.def.armor : t.def.armor;
  const dmg = Math.max(1, Math.round(amount - armor));
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
  if (!victim.order && !victim.isWorker && !victim.queue.length) {
    victim.order = { type: 'attack', targetId: attacker.id, auto: true };
    victim.anchor = { x: victim.x, y: victim.y };
  }
  callForHelp(world, victim.team, victim.x, victim.y, attackerId);
}

function callForHelp(world: World, team: Team, x: number, y: number, attackerId: number): void {
  const attacker = world.get(attackerId);
  if (!attacker || !attacker.alive) return;
  for (const a of world.units) {
    if (a.team !== team || a.isWorker || a.order || a.queue.length || !a.alive) continue;
    if (Math.hypot(a.x - x, a.y - y) > BALANCE.helpRadius) continue;
    a.order = { type: 'attack', targetId: attackerId, auto: true };
    a.anchor = { x: a.x, y: a.y };
  }
}

/** Explosão com dano em área contra inimigos (unidades e construções). */
export function explode(
  world: World,
  team: Team,
  x: number,
  y: number,
  radius: number,
  damage: number,
  buildingBonus: number,
  attackerId: number,
): void {
  world.events.emit({ type: 'explosion', x, y, radius, team });
  for (const u of world.units) {
    if (!u.alive || u.team === team || u.hidden) continue;
    const d = Math.hypot(u.x - x, u.y - y) - u.radius;
    if (d <= radius) dealDamage(world, team, u, damage * (d <= radius * 0.4 ? 1 : 0.6), attackerId);
  }
  for (const b of world.buildings) {
    if (!b.alive || b.team === team) continue;
    if (distToRect(x, y, b.rect) <= radius) dealDamage(world, team, b, damage * buildingBonus, attackerId);
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

/** Torres atiram automaticamente no inimigo mais próximo. */
export function updateTowers(world: World, dt: number): void {
  for (const b of world.buildings) {
    const atk = b.def.attack;
    if (!atk || !b.complete || !b.alive) continue;
    b.cooldown -= dt;
    if (b.cooldown > 0) continue;
    const src = { x: b.x, y: b.y - TILE * 0.8, team: b.team };
    const t = findTarget(world, { x: b.x, y: b.y, team: b.team }, atk.range);
    if (!t) continue;
    b.cooldown = atk.cooldown;
    b.attackSeq++;
    const p = aimPoint(src, t);
    const d = Math.hypot(p.x - src.x, p.y - src.y);
    if (atk.projectile === 'arrow') {
      world.addProjectile(new Projectile(world.newId(), 'arrow', b.team, src.x, src.y, p.x, p.y, t.id, atk.damage, 0, 1, d / 600, 0, b.id));
    } else {
      world.addProjectile(
        new Projectile(world.newId(), 'dynamite', b.team, src.x, src.y, p.x, p.y, 0, atk.damage, atk.splash ?? 40, 1, 0.45 + d / 700, 30 + d * 0.15, b.id),
      );
    }
  }
}

export function updateProjectiles(world: World, dt: number): void {
  for (const p of world.projectiles) {
    if (!p.alive) continue;
    if (p.type === 'arrow') {
      const t = world.get(p.targetId);
      if (t && t.alive && t.kind !== 'resource') {
        const a = aimPoint({ x: p.x, y: p.y }, t);
        p.tx = a.x;
        p.ty = a.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = 600 * dt;
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
    } else {
      p.t += dt / p.duration;
      const t = Math.min(1, p.t);
      p.x = p.sx + (p.tx - p.sx) * t;
      p.y = p.sy + (p.ty - p.sy) * t;
      p.z = 4 * p.arcHeight * t * (1 - t);
      if (p.t >= 1) {
        p.alive = false;
        explode(world, p.team, p.tx, p.ty, p.splash, p.damage, p.buildingBonus, p.attackerId);
      }
    }
  }
}
