import { TILE } from '../config';
import { BUILDINGS } from '../data/buildings';
import type { BuildingId, ResType, Team } from '../data/types';
import { UNITS } from '../data/units';
import type { Building, Unit } from '../entities/Entity';
import { nearestNode } from '../systems/economy';
import type { Controller, World } from '../systems/World';
import { chooseTroop, desiredSplit, needsHouse, pickResource, shouldAttack, shouldRetreat, type TroopId } from './decisions';
import { findBuildSpot } from './placement';

type MilState = 'buildUp' | 'attack' | 'defend';

/** IA dos Goblins: age apenas por world.issue (os mesmos comandos do jogador). */
export class GoblinAI implements Controller {
  private timer = 2;
  state: MilState = 'buildUp';
  waveSize: number;
  waves = 0;
  private prevState: MilState = 'buildUp';
  private targetId = 0;

  constructor(
    private world: World,
    readonly team: Team,
  ) {
    this.waveSize = world.difficulty.waveSize;
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.world.difficulty.thinkEvery;
    this.think();
  }

  private get enemy(): Team {
    return this.team === 0 ? 1 : 0;
  }

  think(): void {
    const w = this.world;
    const hall = w.mainBuilding(this.team);
    if (!hall) return;
    const me = w.players[this.team];
    const units = w.units.filter((u) => u.alive && u.team === this.team);
    const workers = units.filter((u) => u.isWorker);
    const army = units.filter((u) => !u.isWorker);
    const mine = w.buildings.filter((b) => b.alive && b.team === this.team);
    const count = (id: BuildingId, complete?: boolean) =>
      mine.filter((b) => b.def.id === id && (complete === undefined || b.complete === complete)).length;
    const d = w.difficulty;

    // 1) construções inacabadas sem construtor
    for (const b of mine) {
      if (b.complete) continue;
      const builders = workers.filter((u) => u.order?.type === 'build' && u.order.buildingId === b.id);
      if (!builders.length) {
        const u = this.closestWorker(workers, b.x, b.y);
        if (u) w.issue(this.team, { type: 'assist', unitIds: [u.id], buildingId: b.id });
      }
    }

    // 2) treinar servos
    const producers = mine.filter((b) => b.complete && b.def.trains.length).length;
    if (workers.length + hall.queue.length < d.workerTarget && hall.queue.length < 2 && me.pop + hall.queue.length < me.popCap) {
      w.issue(this.team, { type: 'train', buildingId: hall.id, unit: 'servant' });
    }

    // 3) casas (população)
    const huts = count('goblinHut', false);
    if (needsHouse(me.pop, me.popCap, huts, producers) && me.res.wood >= BUILDINGS.goblinHut.cost.wood!) {
      this.construct('goblinHut', workers, hall, null);
    }

    // 4) acampamentos e torres
    const enemyHall = w.mainBuilding(this.enemy);
    const toward = enemyHall ? { x: enemyHall.x / TILE, y: enemyHall.y / TILE } : null;
    const camps = count('goblinCamp');
    const campsDone = count('goblinCamp', true);
    // com recursos sobrando, gasta: mais um acampamento e filas maiores
    const rich = me.res.wood > 400 && me.res.gold > 150 && me.res.meat > 300;
    const campTarget = d.camps + (rich && w.time > 240 ? 1 : 0);
    if (camps < campTarget && workers.length >= 5 + camps * 4) {
      this.construct('goblinCamp', workers, hall, toward);
    }
    if (campsDone > 0 && count('woodTower') < d.towers && w.time > 200 + count('woodTower') * 150) {
      this.construct('woodTower', workers, hall, toward);
    }

    // 5) trabalhadores ociosos vão coletar
    this.assignWorkers(workers, hall, campsDone > 0);

    // 6) tropas
    const have: Record<TroopId, number> = { torch: 0, tnt: 0, barrel: 0 };
    for (const u of army) if (u.def.id in have) have[u.def.id as TroopId]++;
    for (const b of mine) {
      if (!b.complete || b.def.id !== 'goblinCamp' || b.queue.length >= (rich ? 3 : 2)) continue;
      if (me.pop + b.queue.length >= me.popCap) break;
      // guarda madeira para a próxima cabana
      const reserveWood = me.popCap - me.pop <= 3 ? BUILDINGS.goblinHut.cost.wood! : 0;
      const troop = chooseTroop(have, d.mix);
      const cost = UNITS[troop].cost;
      if ((cost.wood ?? 0) + reserveWood > me.res.wood) continue;
      if (w.issue(this.team, { type: 'train', buildingId: b.id, unit: troop }).ok) have[troop]++;
    }

    // 7) estado militar
    this.military(army, mine, hall);
  }

  private closestWorker(workers: Unit[], x: number, y: number, preferIdle = true): Unit | null {
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of workers) {
      if (u.order?.type === 'build') continue;
      let dd = Math.hypot(u.x - x, u.y - y);
      if (preferIdle && u.order) dd += 300;
      if (u.carry && u.carry.amount > 5) dd += 150;
      if (dd < bd) {
        bd = dd;
        best = u;
      }
    }
    return best;
  }

  private construct(id: BuildingId, workers: Unit[], hall: Building, toward: { x: number; y: number } | null): void {
    const w = this.world;
    const def = BUILDINGS[id];
    if (!w.players[this.team].canAfford(def.cost)) return;
    const ax = hall.x / TILE;
    const ay = hall.y / TILE;
    let anchor = { x: ax, y: ay };
    let minR = 4;
    if (toward && id !== 'goblinHut') {
      const dx = toward.x - ax;
      const dy = toward.y - ay;
      const len = Math.hypot(dx, dy) || 1;
      const dist = id === 'woodTower' ? 5 : 6;
      anchor = { x: ax + (dx / len) * dist, y: ay + (dy / len) * dist };
      minR = 0;
    }
    const spot = findBuildSpot(w, this.team, def, anchor.x, anchor.y, id === 'goblinHut' ? null : toward, minR, 16);
    if (!spot) return;
    const builder = this.closestWorker(workers, spot.tx * TILE, spot.ty * TILE);
    if (!builder) return;
    w.issue(this.team, { type: 'build', unitIds: [builder.id], building: id, tx: spot.tx, ty: spot.ty });
  }

  private assignWorkers(workers: Unit[], hall: Building, hasCamp: boolean): void {
    const w = this.world;
    const counts: Record<ResType, number> = { gold: 0, wood: 0, meat: 0 };
    for (const u of workers) {
      if (u.order?.type === 'gather') {
        const n = w.getResource(u.order.nodeId);
        if (n) counts[n.def.res]++;
      }
    }
    const idle = workers.filter((u) => !u.order && !u.queue.length);
    for (const u of idle) {
      const available: Record<ResType, boolean> = {
        gold: !!nearestNode(w, hall.x, hall.y, 'gold', 22 * TILE),
        wood: !!nearestNode(w, hall.x, hall.y, 'wood', 30 * TILE),
        meat: !!nearestNode(w, hall.x, hall.y, 'meat', 16 * TILE),
      };
      // no máximo 3 por mina
      const mines = w.resources.filter((r) => r.alive && r.def.kind === 'goldMine' && Math.hypot(r.x - hall.x, r.y - hall.y) < 22 * TILE).length;
      if (counts.gold >= mines * 3) available.gold = false;
      const res = pickResource(counts, desiredSplit(hasCamp), available);
      if (!res) continue;
      const node = nearestNode(w, u.x, u.y, res, 30 * TILE);
      if (!node) continue;
      w.issue(this.team, { type: 'gather', unitIds: [u.id], nodeId: node.id });
      counts[res]++;
    }
  }

  private military(army: Unit[], mine: Building[], hall: Building): void {
    const w = this.world;
    const d = w.difficulty;

    // ameaça perto da base?
    let threat: Unit | null = null;
    for (const e of w.units) {
      if (!e.alive || e.team !== this.enemy) continue;
      for (const b of mine) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 11 * TILE) {
          threat = e;
          break;
        }
      }
      if (threat) break;
    }

    if (threat && army.length) {
      if (this.state !== 'defend') this.prevState = this.state;
      this.state = 'defend';
      const idle = army.filter((u) => !u.order || u.order.type === 'move');
      if (idle.length)
        w.issue(this.team, { type: 'move', unitIds: idle.map((u) => u.id), x: threat.x, y: threat.y, attack: true });
      return;
    }
    if (this.state === 'defend') this.state = this.prevState === 'attack' ? 'attack' : 'buildUp';

    if (this.state === 'buildUp') {
      if (shouldAttack(army.length, this.waveSize, w.time, d.firstAttack)) {
        this.state = 'attack';
        this.waves++;
        this.targetId = 0;
        w.events.emit({ type: 'attackWave', team: this.team });
      } else {
        // agrupa perto do acampamento, voltado para o inimigo
        const camp = mine.find((b) => b.def.id === 'goblinCamp' && b.complete) ?? hall;
        const idle = army.filter((u) => !u.order && Math.hypot(u.x - camp.x, u.y - camp.y) > 5 * TILE);
        if (idle.length) {
          const rally = this.rallyPoint(camp);
          w.issue(this.team, { type: 'move', unitIds: idle.map((u) => u.id), x: rally.x, y: rally.y });
        }
        return;
      }
    }

    if (this.state === 'attack') {
      if (shouldRetreat(army.length, this.waveSize)) {
        this.state = 'buildUp';
        this.waveSize += d.waveGrowth;
        const camp = mine.find((b) => b.def.id === 'goblinCamp') ?? hall;
        const rally = this.rallyPoint(camp);
        w.issue(this.team, { type: 'move', unitIds: army.map((u) => u.id), x: rally.x, y: rally.y });
        return;
      }
      const target = this.pickTarget(army);
      if (!target) return;
      const idle = army.filter((u) => !u.order);
      const barrels = idle.filter((u) => u.def.id === 'barrel');
      const rest = idle.filter((u) => u.def.id !== 'barrel');
      if (barrels.length) w.issue(this.team, { type: 'attack', unitIds: barrels.map((u) => u.id), targetId: target.id });
      if (rest.length) w.issue(this.team, { type: 'move', unitIds: rest.map((u) => u.id), x: target.x, y: target.y + target.def.h * TILE * 0.5 + 20, attack: true });
    }
  }

  private rallyPoint(b: Building): { x: number; y: number } {
    const enemyHall = this.world.mainBuilding(this.enemy);
    if (!enemyHall) return { x: b.x, y: b.y };
    const dx = enemyHall.x - b.x;
    const dy = enemyHall.y - b.y;
    const len = Math.hypot(dx, dy) || 1;
    const p = { x: b.x + (dx / len) * 4 * TILE, y: b.y + (dy / len) * 4 * TILE };
    return this.world.nearestWalkable(p.x, p.y) ?? p;
  }

  /** Construção inimiga mais próxima do exército (termina no castelo). */
  private pickTarget(army: Unit[]): Building | null {
    const w = this.world;
    const cur = this.targetId ? w.getBuilding(this.targetId) : undefined;
    if (cur && cur.alive) return cur;
    const cx = army.reduce((s, u) => s + u.x, 0) / army.length;
    const cy = army.reduce((s, u) => s + u.y, 0) / army.length;
    let best: Building | null = null;
    let bd = Infinity;
    for (const b of w.buildings) {
      if (!b.alive || b.team !== this.enemy) continue;
      const dd = Math.hypot(b.x - cx, b.y - cy);
      if (dd < bd) {
        bd = dd;
        best = b;
      }
    }
    this.targetId = best?.id ?? 0;
    return best;
  }
}
