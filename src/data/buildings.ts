import type { BuildingDef, BuildingId } from './types';

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  castle: {
    id: 'castle', faction: 'knights', w: 5, h: 3, hp: 2000, armor: 3, cost: {}, buildTime: 60, pop: 10,
    dropoff: true, trains: ['pawn'], sight: 8, hotkey: '', main: true,
  },
  house: {
    id: 'house', faction: 'knights', w: 2, h: 2, hp: 450, armor: 1, cost: { wood: 60 }, buildTime: 20, pop: 5,
    dropoff: true, trains: [], sight: 4, hotkey: 'C',
  },
  barracks: {
    id: 'barracks', faction: 'knights', w: 3, h: 2, hp: 1000, armor: 2, cost: { wood: 150, gold: 50 },
    buildTime: 35, pop: 0, dropoff: false, trains: ['warrior', 'archer'], sight: 5, hotkey: 'Q',
  },
  tower: {
    id: 'tower', faction: 'knights', w: 2, h: 2, hp: 700, armor: 2, cost: { wood: 100, gold: 80 }, buildTime: 30,
    pop: 0, dropoff: false, trains: [], sight: 8, hotkey: 'T', requires: 'barracks',
    attack: { damage: 10, range: 384, cooldown: 1.5, projectile: 'arrow' },
  },
  goblinHall: {
    id: 'goblinHall', faction: 'goblins', w: 5, h: 3, hp: 2000, armor: 3, cost: {}, buildTime: 60, pop: 10,
    dropoff: true, trains: ['servant'], sight: 8, hotkey: '', main: true,
  },
  goblinHut: {
    id: 'goblinHut', faction: 'goblins', w: 2, h: 2, hp: 400, armor: 1, cost: { wood: 55 }, buildTime: 18, pop: 5,
    dropoff: true, trains: [], sight: 4, hotkey: 'C',
  },
  goblinCamp: {
    id: 'goblinCamp', faction: 'goblins', w: 4, h: 2, hp: 950, armor: 2, cost: { wood: 150, gold: 50 },
    buildTime: 35, pop: 0, dropoff: false, trains: ['torch', 'tnt', 'barrel'], sight: 5, hotkey: 'Q',
  },
  woodTower: {
    id: 'woodTower', faction: 'goblins', w: 2, h: 2, hp: 600, armor: 1, cost: { wood: 110, gold: 60 },
    buildTime: 30, pop: 0, dropoff: false, trains: [], sight: 8, hotkey: 'T', requires: 'goblinCamp',
    attack: { damage: 12, range: 352, cooldown: 2.0, projectile: 'dynamite', splash: 40 },
  },
};

/** Construções que um trabalhador de cada facção pode erguer (ordem do menu). */
export const BUILD_MENU: Record<'knights' | 'goblins', BuildingId[]> = {
  knights: ['house', 'barracks', 'tower'],
  goblins: ['goblinHut', 'goblinCamp', 'woodTower'],
};
