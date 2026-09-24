import type { UnitDef, UnitId } from './types';

// Valores iniciais de balanceamento — ajuste à vontade. Os dois reinos usam as mesmas unidades.
// Monge: `damage` é a quantidade de vida curada por vez, e `range` o alcance da cura.
export const UNITS: Record<UnitId, UnitDef> = {
  pawn: {
    id: 'pawn', hp: 40, damage: 3, armor: 0, range: 12, cooldown: 1.0, windup: 0.3,
    speed: 95, sight: 5, cost: { meat: 50 }, trainTime: 12, pop: 1, attack: 'melee', worker: true,
    radius: 14, sheet: 'pawn', hotkey: 'P',
  },
  warrior: {
    id: 'warrior', hp: 130, damage: 12, armor: 2, range: 14, cooldown: 1.0, windup: 0.25,
    speed: 82, sight: 6, cost: { meat: 60, gold: 20 }, trainTime: 16, pop: 1, attack: 'melee',
    radius: 16, sheet: 'warrior', hotkey: 'G',
  },
  lancer: {
    id: 'lancer', hp: 160, damage: 15, armor: 3, range: 30, cooldown: 1.3, windup: 0.2,
    speed: 70, sight: 6, cost: { meat: 50, wood: 20, gold: 35 }, trainTime: 20, pop: 1, attack: 'melee',
    radius: 17, sheet: 'lancer', hotkey: 'L',
  },
  archer: {
    id: 'archer', hp: 70, damage: 9, armor: 0, range: 300, cooldown: 1.5, windup: 0.45,
    speed: 85, sight: 7, cost: { wood: 40, gold: 30 }, trainTime: 16, pop: 1, attack: 'arrow',
    radius: 14, sheet: 'archer', hotkey: 'R',
  },
  monk: {
    id: 'monk', hp: 60, damage: 14, armor: 0, range: 170, cooldown: 2.2, windup: 0.5,
    speed: 75, sight: 7, cost: { meat: 40, gold: 60 }, trainTime: 20, pop: 1, attack: 'heal',
    radius: 14, sheet: 'monk', hotkey: 'M',
  },
};
