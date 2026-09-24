import { TILE } from '../config';
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/rng';
import { SpatialHash } from '../core/SpatialHash';
import { BALANCE } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { DIFFICULTIES, type DifficultyLevel, type Difficulty } from '../data/difficulty';
import { TEAMS } from '../data/factions';
import { RESOURCES } from '../data/resources';
import type { BuildingId, Team, UnitId } from '../data/types';
import { UNITS } from '../data/units';
import { AnyEntity, Building, Projectile, ResourceNode, Unit } from '../entities/Entity';
import { Player } from '../entities/Player';
import { generateMap, reliefBlocked, type GameMap } from '../map/MapGenerator';
import { NavGrid } from '../map/NavGrid';
import { AStar } from './pathfinding/AStar';
import { PathService } from './pathfinding/PathService';
import { updateBehaviors } from './behaviors';
import { updateProjectiles, updateTowers } from './combat';
import { updateProduction, updateSheep, recomputePop } from './economy';
import { updateMovement, updateSeparation } from './movement';
import { Vision } from './vision';
import { issueCommand, type Command, type CommandResult } from './commands';

export interface WorldOptions {
  seed: number;
  difficulty: DifficultyLevel;
  fog?: boolean;
}

/** Algo que pensa a cada passo (IA). */
export interface Controller {
  update(dt: number): void;
}

export class World {
  readonly map: GameMap;
  readonly nav: NavGrid;
  readonly astar: AStar;
  readonly paths: PathService;
  readonly events = new EventBus();
  readonly rng: Rng;
  readonly difficulty: Difficulty;
  readonly difficultyLevel: DifficultyLevel;
  readonly vision: Vision;
  readonly players: [Player, Player];
  readonly controllers: Controller[] = [];

  tick = 0;
  time = 0;
  winner: Team | null = null;
  /** Ovelhas que vão renascer (tile de origem e instante). */
  respawns: { tx: number; ty: number; at: number }[] = [];
  private nextId = 1;

  readonly entities = new Map<number, AnyEntity>();
  units: Unit[] = [];
  buildings: Building[] = [];
  resources: ResourceNode[] = [];
  projectiles: Projectile[] = [];
  readonly unitHash = new SpatialHash<Unit>(128);

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed ^ 0x9e3779b9);
    this.difficultyLevel = opts.difficulty;
    this.difficulty = DIFFICULTIES[opts.difficulty];
    this.map = generateMap(opts.seed);
    this.nav = new NavGrid(this.map.w, this.map.h, this.map.land);
    // planaltos e penhascos são intransponíveis
    for (let y = 0; y < this.map.h; y++)
      for (let x = 0; x < this.map.w; x++) if (reliefBlocked(this.map, x, y)) this.nav.blockRect(x, y, 1, 1);
    this.astar = new AStar(this.nav);
    this.paths = new PathService(this);
    this.vision = new Vision(this, opts.fog ?? true);

    const start = BALANCE.startResources;
    const bonus = this.difficulty.startBonus;
    this.players = [
      new Player(0, { ...start }),
      new Player(1, { gold: start.gold + bonus, wood: start.wood + bonus, meat: start.meat + bonus }),
    ];
    this.players[1].gatherMult = this.difficulty.gatherMult;
    this.setup();
  }

  newId(): number {
    return this.nextId++;
  }

  private setup(): void {
    for (const r of this.map.resources) this.addResource(r.kind, r.tx, r.ty);
    for (const team of [0, 1] as Team[]) {
      const s = this.map.starts[team];
      const main = this.addBuilding(team, TEAMS[team].main, s.tx, s.ty, true);
      const def = UNITS[TEAMS[team].worker];
      for (let i = 0; i < BALANCE.startWorkers; i++) {
        // os trabalhadores começam do lado da base voltado para o centro do mapa
        const dir = team === 0 ? -1 : 1;
        const x = main.x + (i - 1.5) * 40;
        const y = main.y + dir * (main.def.h * TILE * 0.5 + 40);
        this.spawnUnit(team, def.id, x, y);
      }
    }
    recomputePop(this);
    this.vision.update();
  }

  get(id: number): AnyEntity | undefined {
    return this.entities.get(id);
  }

  getUnit(id: number): Unit | undefined {
    const e = this.entities.get(id);
    return e && e.kind === 'unit' ? e : undefined;
  }

  getBuilding(id: number): Building | undefined {
    const e = this.entities.get(id);
    return e && e.kind === 'building' ? e : undefined;
  }

  getResource(id: number): ResourceNode | undefined {
    const e = this.entities.get(id);
    return e && e.kind === 'resource' ? e : undefined;
  }

  addResource(kind: keyof typeof RESOURCES, tx: number, ty: number): ResourceNode {
    const def = RESOURCES[kind];
    const r = new ResourceNode(this.newId(), tx, ty, def);
    this.entities.set(r.id, r);
    this.resources.push(r);
    if (def.blocking) this.nav.blockRect(tx, ty, def.w, def.h);
    return r;
  }

  addBuilding(team: Team, id: BuildingId, tx: number, ty: number, complete: boolean): Building {
    const def = BUILDINGS[id];
    const b = new Building(this.newId(), team, tx, ty, def);
    if (complete) {
      b.complete = true;
      b.progress = 1;
    } else {
      b.hp = Math.max(1, Math.round(def.hp * BALANCE.constructionStartHp));
    }
    this.entities.set(b.id, b);
    this.buildings.push(b);
    this.nav.blockRect(tx, ty, def.w, def.h);
    this.evictUnits(tx, ty, def.w, def.h);
    return b;
  }

  spawnUnit(team: Team, id: UnitId, x: number, y: number): Unit {
    const u = new Unit(this.newId(), team, x, y, UNITS[id]);
    this.entities.set(u.id, u);
    this.units.push(u);
    this.unitHash.insert(u);
    return u;
  }

  /** Empurra unidades que estejam dentro de um retângulo recém-bloqueado. */
  evictUnits(tx: number, ty: number, w: number, h: number): void {
    for (const u of this.units) {
      if (!u.alive || u.hidden) continue;
      const ux = Math.floor(u.x / TILE);
      const uy = Math.floor(u.y / TILE);
      if (ux >= tx && ux < tx + w && uy >= ty && uy < ty + h) {
        const spot = this.nearestWalkable(u.x, u.y);
        if (spot) {
          u.x = spot.x;
          u.y = spot.y;
          u.prevX = u.x;
          u.prevY = u.y;
        }
        if (u.path.length) this.paths.request(u);
      }
    }
  }

  /** Centro do tile caminhável mais próximo (busca em anéis). */
  nearestWalkable(x: number, y: number, maxR = 12): { x: number; y: number } | null {
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (this.nav.walkable(cx, cy)) return { x, y };
    for (let r = 1; r <= maxR; r++) {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.nav.walkable(cx + dx, cy + dy)) continue;
          const px = (cx + dx) * TILE + TILE / 2;
          const py = (cy + dy) * TILE + TILE / 2;
          const d = Math.hypot(px - x, py - y);
          if (d < bestD) {
            bestD = d;
            best = { x: px, y: py };
          }
        }
      if (best) return best;
    }
    return null;
  }

  addProjectile(p: Projectile): void {
    this.projectiles.push(p);
    this.events.emit({ type: 'projectileFired', id: p.id });
  }

  issue(team: Team, cmd: Command): CommandResult {
    return issueCommand(this, team, cmd);
  }

  isEnemy(a: Team | -1, b: Team | -1): boolean {
    return a !== -1 && b !== -1 && a !== b;
  }

  mainBuilding(team: Team): Building | undefined {
    return this.buildings.find((b) => b.alive && b.team === team && b.def.main);
  }

  step(dt: number): void {
    if (this.winner !== null) return;
    this.tick++;
    this.time += dt;

    for (const u of this.units) {
      u.prevX = u.x;
      u.prevY = u.y;
    }
    for (const r of this.resources) {
      r.prevX = r.x;
      r.prevY = r.y;
    }
    for (const p of this.projectiles) {
      p.prevX = p.x;
      p.prevY = p.y;
    }

    this.unitHash.clear();
    for (const u of this.units) if (u.alive && !u.hidden) this.unitHash.insert(u);

    for (const c of this.controllers) c.update(dt);
    updateProduction(this, dt);
    updateBehaviors(this, dt);
    this.paths.process();
    updateMovement(this, dt);
    updateSeparation(this, dt);
    updateTowers(this, dt);
    updateProjectiles(this, dt);
    updateSheep(this, dt);
    this.cleanup();
    if (this.tick % 5 === 0) this.vision.update();
    if (this.tick % 10 === 0) this.checkVictory();
  }

  private cleanup(): void {
    let changed = false;
    if (this.units.some((u) => !u.alive)) {
      for (const u of this.units) if (!u.alive) this.entities.delete(u.id);
      this.units = this.units.filter((u) => u.alive);
      changed = true;
    }
    if (this.buildings.some((b) => !b.alive)) {
      for (const b of this.buildings) if (!b.alive) this.entities.delete(b.id);
      this.buildings = this.buildings.filter((b) => b.alive);
      changed = true;
    }
    if (this.resources.some((r) => !r.alive)) {
      for (const r of this.resources) if (!r.alive) this.entities.delete(r.id);
      this.resources = this.resources.filter((r) => r.alive);
    }
    if (this.projectiles.some((p) => !p.alive)) this.projectiles = this.projectiles.filter((p) => p.alive);
    if (changed) recomputePop(this);
  }

  private checkVictory(): void {
    for (const team of [0, 1] as Team[]) {
      if (!this.mainBuilding(team)) {
        this.winner = team === 0 ? 1 : 0;
        this.events.emit({ type: 'gameOver', winner: this.winner });
        return;
      }
    }
  }
}
