import type { BuildingId } from '../data/types';

/**
 * Parte visual de uma construção. (dx, dy) é relativo ao centro da borda inferior do footprint.
 * A origem vertical de cada textura fica na base visível (medida com a caixa opaca).
 */
export interface Part {
  key: string;
  dx: number;
  dy: number;
  flip?: boolean;
  anim?: string;
  /** Unidade decorativa no topo de torres: anima quando a torre ataca. */
  shooter?: string;
}

export interface BuildingVisual {
  parts: Part[];
  /** Andaime durante a construção; 'crop' = revela a construção de baixo para cima. */
  construction: Part[] | 'crop';
  destroyed: Part[];
  /** Altura aproximada acima do footprint (para barra de vida e cliques). */
  height: number;
}

/** Origem Y (base visível / altura) por textura. */
export const ORIGIN_Y: Record<string, number> = {
  castle_blue: 249 / 256,
  castle_red: 249 / 256,
  castle_construction: 246 / 256,
  castle_destroyed: 253 / 256,
  house_blue: 171 / 192,
  house_construction: 183 / 192,
  house_destroyed: 165 / 192,
  tower_blue: 234 / 256,
  tower_construction: 231 / 256,
  tower_destroyed: 229 / 256,
  goblin_house: 170 / 192,
  goblin_house_destroyed: 173 / 192,
  wood_tower_red: 170 / 192,
  wood_tower_blue: 170 / 192,
  wood_tower_construction: 178 / 192,
  wood_tower_destroyed: 173 / 192,
  barracks_blue: 244 / 256,
  goldmine_active: 125 / 128,
  goldmine_inactive: 125 / 128,
  goldmine_destroyed: 125 / 128,
  archer_blue: 0.68,
  tnt_red: 0.68,
  barrel_red: 0.77,
  deco_16: 104 / 128,
  deco_17: 104 / 128,
  deco_18: 168 / 192,
};

export const UNIT_ORIGIN_Y: Record<string, number> = {
  pawn: 0.66,
  warrior: 0.69,
  archer: 0.69,
  torch: 0.69,
  tnt: 0.69,
  barrel: 0.77,
};

const one = (key: string, extra: Partial<Part> = {}): Part[] => [{ key, dx: 0, dy: 0, ...extra }];

export function buildingVisual(id: BuildingId, hasBarracksArt: boolean): BuildingVisual {
  switch (id) {
    case 'castle':
      return { parts: one('castle_blue'), construction: one('castle_construction'), destroyed: one('castle_destroyed'), height: 12 };
    case 'house':
      return { parts: one('house_blue'), construction: one('house_construction'), destroyed: one('house_destroyed'), height: 30 };
    case 'tower':
      return {
        parts: [{ key: 'tower_blue', dx: 0, dy: 0 }, { key: 'archer_blue', dx: 0, dy: -118, anim: 'archer_blue.idle', shooter: 'archer_blue.shootDown' }],
        construction: one('tower_construction'),
        destroyed: one('tower_destroyed'),
        height: 110,
      };
    case 'barracks':
      return hasBarracksArt
        ? { parts: one('barracks_blue'), construction: 'crop', destroyed: [{ key: 'house_destroyed', dx: -44, dy: 0 }, { key: 'house_destroyed', dx: 44, dy: -4, flip: true }], height: 60 }
        : {
            parts: [{ key: 'house_blue', dx: -46, dy: -6 }, { key: 'house_blue', dx: 46, dy: 0, flip: true }],
            construction: 'crop',
            destroyed: [{ key: 'house_destroyed', dx: -44, dy: 0 }, { key: 'house_destroyed', dx: 44, dy: -4, flip: true }],
            height: 40,
          };
    case 'goblinHall':
      return {
        parts: [
          { key: 'goblin_house', dx: -104, dy: -14 },
          { key: 'goblin_house', dx: 104, dy: -14, flip: true },
          { key: 'wood_tower_red', dx: 0, dy: 0, anim: 'wood_tower_red.idle' },
          { key: 'deco_16', dx: -140, dy: 8 },
        ],
        construction: 'crop',
        destroyed: [
          { key: 'goblin_house_destroyed', dx: -104, dy: -14 },
          { key: 'goblin_house_destroyed', dx: 104, dy: -14, flip: true },
          { key: 'wood_tower_destroyed', dx: 0, dy: 0 },
        ],
        height: 20,
      };
    case 'goblinHut':
      return { parts: one('goblin_house'), construction: one('house_construction'), destroyed: one('goblin_house_destroyed'), height: 30 };
    case 'goblinCamp':
      return {
        parts: [
          { key: 'goblin_house', dx: -62, dy: -4 },
          { key: 'goblin_house', dx: 62, dy: 0, flip: true },
          { key: 'barrel_red', dx: 0, dy: 10 },
        ],
        construction: 'crop',
        destroyed: [{ key: 'goblin_house_destroyed', dx: -62, dy: -4 }, { key: 'goblin_house_destroyed', dx: 62, dy: 0, flip: true }],
        height: 30,
      };
    case 'woodTower':
      return {
        parts: [{ key: 'wood_tower_red', dx: 0, dy: 0, anim: 'wood_tower_red.idle' }, { key: 'tnt_red', dx: 0, dy: -96, anim: 'tnt_red.idle', shooter: 'tnt_red.throw' }],
        construction: one('wood_tower_construction'),
        destroyed: one('wood_tower_destroyed'),
        height: 60,
      };
  }
}
