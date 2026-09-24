export type Team = 0 | 1;
export const PLAYER: Team = 0;
export const AI: Team = 1;

export type Faction = 'knights' | 'goblins';
export type ResType = 'gold' | 'wood' | 'meat';
export const RES_TYPES: readonly ResType[] = ['gold', 'wood', 'meat'];
export type Cost = Partial<Record<ResType, number>>;

export type UnitId = 'pawn' | 'warrior' | 'archer' | 'servant' | 'torch' | 'tnt' | 'barrel';
export type BuildingId =
  | 'castle'
  | 'house'
  | 'barracks'
  | 'tower'
  | 'goblinHall'
  | 'goblinHut'
  | 'goblinCamp'
  | 'woodTower';

export type AttackKind = 'melee' | 'arrow' | 'dynamite' | 'suicide';

export interface UnitDef {
  id: UnitId;
  faction: Faction;
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
  /** Raio de dano em área (px). */
  splash?: number;
  /** Multiplicador de dano contra construções. */
  buildingBonus?: number;
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
  projectile: 'arrow' | 'dynamite';
  splash?: number;
}

export interface BuildingDef {
  id: BuildingId;
  faction: Faction;
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
