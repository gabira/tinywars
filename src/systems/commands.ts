import { TILE } from '../config';
import { BALANCE } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import type { BuildingId, ResType, Team, UnitId } from '../data/types';
import { UNITS } from '../data/units';
import type { Unit } from '../entities/Entity';
import { setOrder } from './behaviors';
import { isHealer } from './combat';
import { canPlace } from './economy';
import { moveToPoint, stopMoving } from './movement';
import type { World } from './World';

export type Command =
  | { type: 'move'; unitIds: number[]; x: number; y: number; queue?: boolean; attack?: boolean }
  | { type: 'attack'; unitIds: number[]; targetId: number; queue?: boolean }
  | { type: 'heal'; unitIds: number[]; targetId: number; queue?: boolean }
  | { type: 'gather'; unitIds: number[]; nodeId: number; queue?: boolean }
  | { type: 'returnCargo'; unitIds: number[]; queue?: boolean }
  | { type: 'build'; unitIds: number[]; building: BuildingId; tx: number; ty: number; queue?: boolean }
  | { type: 'assist'; unitIds: number[]; buildingId: number; queue?: boolean }
  | { type: 'stop'; unitIds: number[] }
  | { type: 'hold'; unitIds: number[] }
  | { type: 'train'; buildingId: number; unit: UnitId }
  | { type: 'cancelTrain'; buildingId: number; index: number }
  | { type: 'rally'; buildingId: number; x: number; y: number; targetId?: number }
  | { type: 'cancelBuild'; buildingId: number };

export type FailReason =
  | 'notEnough'
  | 'popCap'
  | 'invalidPlacement'
  | 'queueFull'
  | 'noWorkers'
  | 'notReady'
  | 'requires'
  | 'invalid';

export type CommandResult =
  | { ok: true; id?: number }
  | { ok: false; reason: FailReason; res?: ResType; requires?: BuildingId };

const OK: CommandResult = { ok: true };
const fail = (reason: FailReason, extra: Partial<Extract<CommandResult, { ok: false }>> = {}): CommandResult => ({
  ok: false,
  reason,
  ...extra,
});

function ownUnits(world: World, team: Team, ids: number[]): Unit[] {
  const out: Unit[] = [];
  for (const id of ids) {
    const u = world.getUnit(id);
    if (u && u.alive && u.team === team) out.push(u);
  }
  return out;
}

/** Posições de formação ao redor de um ponto (tiles caminháveis, mais perto primeiro). */
export function formationSlots(world: World, x: number, y: number, count: number): { x: number; y: number }[] {
  if (count <= 1) return [{ x, y }];
  const spacing = 34;
  const slots: { x: number; y: number; d: number }[] = [];
  const rings = Math.ceil(Math.sqrt(count)) + 2;
  for (let gy = -rings; gy <= rings; gy++)
    for (let gx = -rings; gx <= rings; gx++) {
      const px = x + gx * spacing;
      const py = y + gy * spacing;
      if (!world.nav.walkable(Math.floor(px / TILE), Math.floor(py / TILE))) continue;
      slots.push({ x: px, y: py, d: Math.hypot(gx, gy * 1.1) });
    }
  slots.sort((a, b) => a.d - b.d);
  const out = slots.slice(0, count).map((s) => ({ x: s.x, y: s.y }));
  while (out.length < count) out.push({ x, y });
  return out;
}

function groupMove(world: World, units: Unit[], x: number, y: number, attack: boolean, queue: boolean): void {
  const slots = formationSlots(world, x, y, units.length);
  const free = [...units];
  for (const s of slots) {
    if (!free.length) break;
    let bi = 0;
    let bd = Infinity;
    free.forEach((u, i) => {
      const d = Math.hypot(u.x - s.x, u.y - s.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const u = free.splice(bi, 1)[0];
    const order = attack ? ({ type: 'attackMove', x: s.x, y: s.y } as const) : ({ type: 'move', x: s.x, y: s.y } as const);
    const wasIdle = !u.order && !u.queue.length;
    setOrder(world, u, order, queue);
    if (!queue || wasIdle) {
      u.phase = 1;
      moveToPoint(world, u, s.x, s.y);
    }
  }
}

export function issueCommand(world: World, team: Team, cmd: Command): CommandResult {
  if (world.winner !== null) return fail('invalid');
  const player = world.players[team];
  switch (cmd.type) {
    case 'move': {
      const units = ownUnits(world, team, cmd.unitIds);
      if (!units.length) return fail('invalid');
      groupMove(world, units, cmd.x, cmd.y, !!cmd.attack, !!cmd.queue);
      return OK;
    }
    case 'attack': {
      const units = ownUnits(world, team, cmd.unitIds);
      const t = world.get(cmd.targetId);
      if (!units.length || !t || !t.alive || t.kind === 'resource' || t.team === team) return fail('invalid');
      // monges não atacam: acompanham o grupo até o alvo
      const healers = units.filter(isHealer);
      for (const u of units) if (!isHealer(u)) setOrder(world, u, { type: 'attack', targetId: t.id }, cmd.queue);
      if (healers.length) groupMove(world, healers, t.x, t.y, true, !!cmd.queue);
      return OK;
    }
    case 'heal': {
      const healers = ownUnits(world, team, cmd.unitIds).filter(isHealer);
      const t = world.getUnit(cmd.targetId);
      if (!healers.length || !t || !t.alive || t.team !== team) return fail('invalid');
      for (const u of healers) setOrder(world, u, { type: 'heal', targetId: t.id }, cmd.queue);
      return OK;
    }
    case 'gather': {
      const units = ownUnits(world, team, cmd.unitIds).filter((u) => u.isWorker);
      const node = world.getResource(cmd.nodeId);
      if (!units.length || !node || !node.alive) return fail('invalid');
      for (const u of units) setOrder(world, u, { type: 'gather', nodeId: node.id }, cmd.queue);
      return OK;
    }
    case 'returnCargo': {
      const units = ownUnits(world, team, cmd.unitIds).filter((u) => u.carry);
      for (const u of units) setOrder(world, u, { type: 'returnCargo' }, cmd.queue);
      return units.length ? OK : fail('invalid');
    }
    case 'build': {
      const def = BUILDINGS[cmd.building];
      const workers = ownUnits(world, team, cmd.unitIds).filter((u) => u.isWorker);
      if (!workers.length) return fail('noWorkers');
      if (def.main) return fail('invalid');
      if (def.requires && !world.buildings.some((b) => b.alive && b.team === team && b.complete && b.def.id === def.requires))
        return fail('requires', { requires: def.requires });
      if (!canPlace(world, team, def, cmd.tx, cmd.ty)) return fail('invalidPlacement');
      const miss = player.missing(def.cost);
      if (miss) return fail('notEnough', { res: miss });
      player.spend(def.cost);
      const b = world.addBuilding(team, def.id, cmd.tx, cmd.ty, false);
      for (const u of workers) setOrder(world, u, { type: 'build', buildingId: b.id }, cmd.queue);
      return { ok: true, id: b.id };
    }
    case 'assist': {
      const workers = ownUnits(world, team, cmd.unitIds).filter((u) => u.isWorker);
      const b = world.getBuilding(cmd.buildingId);
      if (!workers.length || !b || !b.alive || b.team !== team) return fail('invalid');
      for (const u of workers) setOrder(world, u, { type: 'build', buildingId: b.id }, cmd.queue);
      return OK;
    }
    case 'stop': {
      for (const u of ownUnits(world, team, cmd.unitIds)) {
        setOrder(world, u, null);
        stopMoving(u);
      }
      return OK;
    }
    case 'hold': {
      for (const u of ownUnits(world, team, cmd.unitIds)) {
        setOrder(world, u, { type: 'hold' });
        stopMoving(u);
      }
      return OK;
    }
    case 'train': {
      const b = world.getBuilding(cmd.buildingId);
      if (!b || !b.alive || b.team !== team) return fail('invalid');
      if (!b.complete) return fail('notReady');
      if (!b.def.trains.includes(cmd.unit)) return fail('invalid');
      if (b.queue.length >= BALANCE.maxQueue) return fail('queueFull');
      const def = UNITS[cmd.unit];
      const miss = player.missing(def.cost);
      if (miss) return fail('notEnough', { res: miss });
      player.spend(def.cost);
      b.queue.push({ unit: cmd.unit, t: 0 });
      return OK;
    }
    case 'cancelTrain': {
      const b = world.getBuilding(cmd.buildingId);
      if (!b || b.team !== team || !b.queue[cmd.index]) return fail('invalid');
      const [item] = b.queue.splice(cmd.index, 1);
      player.refund(UNITS[item.unit].cost);
      return OK;
    }
    case 'rally': {
      const b = world.getBuilding(cmd.buildingId);
      if (!b || b.team !== team) return fail('invalid');
      b.rally = { x: cmd.x, y: cmd.y, targetId: cmd.targetId ?? 0 };
      return OK;
    }
    case 'cancelBuild': {
      const b = world.getBuilding(cmd.buildingId);
      if (!b || !b.alive || b.team !== team || b.complete) return fail('invalid');
      player.refund(b.def.cost, BALANCE.cancelRefund);
      b.alive = false;
      world.nav.unblockRect(b.tx, b.ty, b.def.w, b.def.h);
      return OK;
    }
  }
}

export type SmartKind = 'move' | 'attack' | 'gather' | 'build' | 'heal' | 'none';

/** Clique direito contextual: decide o que cada unidade selecionada deve fazer. */
export function smartCommand(
  world: World,
  team: Team,
  unitIds: number[],
  x: number,
  y: number,
  targetId: number,
  queue = false,
): SmartKind {
  const units = ownUnits(world, team, unitIds);
  if (!units.length) return 'none';
  const t = targetId ? world.get(targetId) : undefined;
  const ids = (list: Unit[]) => list.map((u) => u.id);
  const workers = units.filter((u) => u.isWorker);
  const others = units.filter((u) => !u.isWorker);

  if (t && t.alive && t.kind !== 'resource' && t.team !== team) {
    issueCommand(world, team, { type: 'attack', unitIds: ids(units), targetId: t.id, queue });
    return 'attack';
  }
  // monges: clique direito num aliado ferido = curar
  const healers = units.filter(isHealer);
  if (t && t.alive && t.kind === 'unit' && t.team === team && t.hp < t.maxHp && healers.length) {
    issueCommand(world, team, { type: 'heal', unitIds: ids(healers), targetId: t.id, queue });
    const rest = units.filter((u) => !isHealer(u));
    if (rest.length) issueCommand(world, team, { type: 'move', unitIds: ids(rest), x, y, queue });
    return 'heal';
  }
  if (t && t.alive && t.kind === 'resource' && workers.length) {
    issueCommand(world, team, { type: 'gather', unitIds: ids(workers), nodeId: t.id, queue });
    if (others.length) issueCommand(world, team, { type: 'move', unitIds: ids(others), x, y, queue });
    return 'gather';
  }
  if (t && t.alive && t.kind === 'building' && t.team === team && workers.length) {
    if (!t.complete || t.hp < t.maxHp) {
      issueCommand(world, team, { type: 'assist', unitIds: ids(workers), buildingId: t.id, queue });
      if (others.length) issueCommand(world, team, { type: 'move', unitIds: ids(others), x, y, queue });
      return 'build';
    }
    const carriers = workers.filter((u) => u.carry && u.carry.amount > 0);
    if (t.def.dropoff && carriers.length) {
      issueCommand(world, team, { type: 'returnCargo', unitIds: ids(carriers), queue });
      const rest = units.filter((u) => !carriers.includes(u));
      if (rest.length) issueCommand(world, team, { type: 'move', unitIds: ids(rest), x, y, queue });
      return 'gather';
    }
  }
  issueCommand(world, team, { type: 'move', unitIds: ids(units), x, y, queue });
  return 'move';
}
