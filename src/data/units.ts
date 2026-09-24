import type { UnitDef, UnitId } from './types';

// Valores iniciais de balanceamento — ajuste à vontade.
export const UNITS: Record<UnitId, UnitDef> = {
  pawn: {
    id: 'pawn', faction: 'knights', hp: 40, damage: 3, armor: 0, range: 12, cooldown: 1.0, windup: 0.3,
    speed: 95, sight: 5, cost: { meat: 50 }, trainTime: 12, pop: 1, attack: 'melee', worker: true,
    radius: 14, sheet: 'pawn', hotkey: 'P',
  },
  warrior: {
    id: 'warrior', faction: 'knights', hp: 130, damage: 12, armor: 2, range: 14, cooldown: 1.0, windup: 0.3,
    speed: 80, sight: 6, cost: { meat: 60, gold: 20 }, trainTime: 16, pop: 1, attack: 'melee',
    radius: 16, sheet: 'warrior', hotkey: 'G',
  },
  archer: {
    id: 'archer', faction: 'knights', hp: 70, damage: 9, armor: 0, range: 300, cooldown: 1.5, windup: 0.5,
    speed: 85, sight: 7, cost: { wood: 40, gold: 30 }, trainTime: 16, pop: 1, attack: 'arrow',
    radius: 14, sheet: 'archer', hotkey: 'R',
  },
  servant: {
    id: 'servant', faction: 'goblins', hp: 40, damage: 3, armor: 0, range: 12, cooldown: 1.0, windup: 0.3,
    speed: 95, sight: 5, cost: { meat: 50 }, trainTime: 12, pop: 1, attack: 'melee', worker: true,
    radius: 14, sheet: 'pawn', hotkey: 'P',
  },
  torch: {
    id: 'torch', faction: 'goblins', hp: 100, damage: 10, armor: 1, range: 14, cooldown: 0.8, windup: 0.3,
    speed: 95, sight: 6, cost: { meat: 50, gold: 15 }, trainTime: 13, pop: 1, attack: 'melee',
    radius: 16, sheet: 'torch', hotkey: 'T',
  },
  tnt: {
    id: 'tnt', faction: 'goblins', hp: 60, damage: 14, armor: 0, range: 256, cooldown: 2.2, windup: 0.4,
    speed: 85, sight: 7, cost: { wood: 40, gold: 40 }, trainTime: 17, pop: 1, attack: 'dynamite', splash: 56,
    radius: 16, sheet: 'tnt', hotkey: 'D',
  },
  barrel: {
    id: 'barrel', faction: 'goblins', hp: 60, damage: 70, armor: 0, range: 10, cooldown: 1, windup: 0.3,
    speed: 75, sight: 5, cost: { wood: 60, gold: 30 }, trainTime: 18, pop: 1, attack: 'suicide', splash: 96,
    buildingBonus: 2, radius: 14, sheet: 'barrel', hotkey: 'B',
  },
};
