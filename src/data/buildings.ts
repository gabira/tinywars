import type { BuildingDef, BuildingId } from './types';

// As mesmas construções para os dois reinos (só a cor muda).
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  castle: {
    id: 'castle', w: 5, h: 3, hp: 2000, armor: 3, cost: {}, buildTime: 60, pop: 10,
    dropoff: true, trains: ['pawn'], sight: 8, hotkey: '', main: true,
  },
  house: {
    id: 'house', w: 2, h: 2, hp: 450, armor: 1, cost: { wood: 60 }, buildTime: 20, pop: 5,
    dropoff: true, trains: [], sight: 4, hotkey: 'C',
  },
  barracks: {
    id: 'barracks', w: 3, h: 2, hp: 1000, armor: 2, cost: { wood: 150, gold: 50 },
    buildTime: 35, pop: 0, dropoff: false, trains: ['warrior', 'lancer'], sight: 5, hotkey: 'Q',
  },
  archery: {
    id: 'archery', w: 3, h: 2, hp: 900, armor: 2, cost: { wood: 160, gold: 40 },
    buildTime: 35, pop: 0, dropoff: false, trains: ['archer'], sight: 6, hotkey: 'R',
  },
  monastery: {
    id: 'monastery', w: 3, h: 2, hp: 900, armor: 2, cost: { wood: 120, gold: 120 },
    buildTime: 40, pop: 0, dropoff: false, trains: ['monk'], sight: 6, hotkey: 'M', requires: 'barracks',
  },
  tower: {
    id: 'tower', w: 2, h: 2, hp: 700, armor: 2, cost: { wood: 100, gold: 80 }, buildTime: 30,
    pop: 0, dropoff: false, trains: [], sight: 8, hotkey: 'T', requires: 'barracks',
    attack: { damage: 10, range: 384, cooldown: 1.5 },
  },
};

/** Construções que um peão pode erguer (ordem do menu). */
export const BUILD_MENU: BuildingId[] = ['house', 'barracks', 'archery', 'monastery', 'tower'];
