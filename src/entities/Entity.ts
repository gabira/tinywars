import { TILE } from '../config';
import type { Rect, Vec } from '../core/math';
import type { BuildingDef, ResType, Team, UnitDef, UnitId } from '../data/types';
import type { ResourceDef } from '../data/resources';
import type { PathGoal } from '../systems/pathfinding/AStar';
import type { Order } from './orders';

export type EntityKind = 'unit' | 'building' | 'resource';

export abstract class Entity {
  abstract readonly kind: EntityKind;
  alive = true;
  hp: number;
  prevX: number;
  prevY: number;

  constructor(
    readonly id: number,
    public team: Team | -1,
    public x: number,
    public y: number,
    public maxHp: number,
    public radius: number,
  ) {
    this.hp = maxHp;
    this.prevX = x;
    this.prevY = y;
  }
}

/** Estado visual da unidade (a view escolhe a tira certa para cada tipo de unidade). */
export type UnitAnim = 'idle' | 'run' | 'attack' | 'work' | 'carryIdle' | 'carryRun' | 'guard';

/** Ferramenta que o peão leva na mão (define as tiras "Run Axe", "Interact Pickaxe"...). */
export type Tool = 'axe' | 'hammer' | 'knife' | 'pickaxe';

export class Unit extends Entity {
  readonly kind = 'unit' as const;
  declare team: Team;
  order: Order | null = null;
  queue: Order[] = [];
  /** Sub-estado da ordem atual. */
  phase = 0;
  timer = 0;

  // movimento
  path: Vec[] = [];
  pathIdx = 0;
  pathPending = false;
  goal: PathGoal | null = null;
  goalKey = '';
  finalPoint: Vec | null = null;
  pathVersion = 0;
  lastPathReq = -99;
  stuckTimer = 0;
  stuckCount = 0;
  lastProgress: Vec;
  moving = false;

  // combate
  cooldown = 0;
  windupTimer = -1;
  pendingTargetId = 0;
  targetId = 0;
  attackSeq = 0;
  scanTimer: number;
  anchor: Vec | null = null;
  lastHitTime = -99;

  // economia
  carry: { res: ResType; amount: number } | null = null;
  lastNodeId = 0;
  hidden = false;

  // visual
  facingX = 1;
  facingY = 0;
  anim: UnitAnim = 'idle';
  tool: Tool | null = null;

  constructor(
    id: number,
    team: Team,
    x: number,
    y: number,
    readonly def: UnitDef,
  ) {
    super(id, team, x, y, def.hp, def.radius);
    this.lastProgress = { x, y };
    this.scanTimer = (id % 8) * 0.05;
  }

  get isWorker(): boolean {
    return !!this.def.worker;
  }
}

export interface TrainItem {
  unit: UnitId;
  t: number;
}

export class Building extends Entity {
  readonly kind = 'building' as const;
  declare team: Team;
  progress = 0;
  complete = false;
  queue: TrainItem[] = [];
  rally: { x: number; y: number; targetId: number } | null = null;
  cooldown = 0;
  attackSeq = 0;
  destroyedAt = -1;

  constructor(
    id: number,
    team: Team,
    readonly tx: number,
    readonly ty: number,
    readonly def: BuildingDef,
  ) {
    super(id, team, (tx + def.w / 2) * TILE, (ty + def.h / 2) * TILE, def.hp, (Math.max(def.w, def.h) * TILE) / 2);
  }

  get rect(): Rect {
    return { x: this.tx * TILE, y: this.ty * TILE, w: this.def.w * TILE, h: this.def.h * TILE };
  }

  get goal(): PathGoal {
    return { rx: this.tx, ry: this.ty, rw: this.def.w, rh: this.def.h, range: 1 };
  }
}

export class ResourceNode extends Entity {
  readonly kind = 'resource' as const;
  amount: number;
  workers = new Set<number>();
  hitSeq = 0;
  // ovelha
  homeX: number;
  homeY: number;
  wanderTimer = 0;
  targetX: number;
  targetY: number;
  isPile = false;

  constructor(
    id: number,
    readonly tx: number,
    readonly ty: number,
    readonly def: ResourceDef,
  ) {
    super(id, -1, (tx + def.w / 2) * TILE, (ty + def.h / 2) * TILE, 1, def.kind === 'sheep' ? 18 : (Math.max(def.w, def.h) * TILE) / 2);
    this.amount = def.amount;
    this.homeX = this.x;
    this.homeY = this.y;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  get rect(): Rect {
    if (this.def.kind === 'sheep') return { x: this.x - 16, y: this.y - 16, w: 32, h: 32 };
    return { x: this.tx * TILE, y: this.ty * TILE, w: this.def.w * TILE, h: this.def.h * TILE };
  }

  get goal(): PathGoal {
    if (this.def.kind === 'sheep') {
      return { rx: Math.floor(this.x / TILE), ry: Math.floor(this.y / TILE), rw: 1, rh: 1, range: 1 };
    }
    return { rx: this.tx, ry: this.ty, rw: this.def.w, rh: this.def.h, range: 1 };
  }
}

export class Projectile {
  alive = true;
  angle = 0;
  prevX: number;
  prevY: number;
  x: number;
  y: number;

  /** Flecha teleguiada até o alvo (arqueiros e torres). */
  constructor(
    readonly id: number,
    readonly team: Team,
    readonly sx: number,
    readonly sy: number,
    public tx: number,
    public ty: number,
    readonly targetId: number,
    readonly damage: number,
    readonly attackerId: number,
  ) {
    this.x = sx;
    this.y = sy;
    this.prevX = sx;
    this.prevY = sy;
  }
}

export type AnyEntity = Unit | Building | ResourceNode;
