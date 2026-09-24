export type Team = 0 | 1;
export const PLAYER: Team = 0;
export const AI: Team = 1;

export type ResType = 'gold' | 'wood' | 'meat';
export const RES_TYPES: readonly ResType[] = ['gold', 'wood', 'meat'];
export type Cost = Partial<Record<ResType, number>>;

// Os dois reinos têm as mesmas unidades e construções (só a cor muda).
export type UnitId = 'pawn' | 'warrior' | 'lancer' | 'archer' | 'monk';
export type BuildingId = 'castle' | 'house' | 'barracks' | 'archery' | 'monastery' | 'tower';

/** melee: golpe corpo a corpo · arrow: projétil · heal: cura aliados (monge). */
export type AttackKind = 'melee' | 'arrow' | 'heal';

export interface UnitDef {
  id: UnitId;
  hp: number;
  damage: number;
  armor: number;
  /** Alcance em pixels (da borda do alvo). */
  range: number;
  /** Intervalo entre ataques (s). */
  cooldown: number;
  /** Tempo entre o início da animação e o golpe/disparo (s). */
  windup: number;
  speed: number;
  /** Visão em tiles. */
  sight: number;
  cost: Cost;
  trainTime: number;
  pop: number;
  attack: AttackKind;
  worker?: boolean;
  radius: number;
  /** Chave-base da spritesheet (sem a cor). */
  sheet: string;
  hotkey: string;
}

export interface TowerAttack {
  damage: number;
  range: number;
  cooldown: number;
}

export interface BuildingDef {
  id: BuildingId;
  /** Tamanho do footprint em tiles. */
  w: number;
  h: number;
  hp: number;
  armor: number;
  cost: Cost;
  buildTime: number;
  /** População fornecida. */
  pop: number;
  dropoff: boolean;
  trains: UnitId[];
  requires?: BuildingId;
  attack?: TowerAttack;
  sight: number;
  hotkey: string;
  /** Construção principal: se for destruída, o time perde. */
  main?: boolean;
}

export type ResourceKind = 'goldMine' | 'tree' | 'sheep';
