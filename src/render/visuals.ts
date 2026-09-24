import type { BuildingId } from '../data/types';
import type { TeamColor } from './palette';

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
  /** Fundação/andaime mostrado enquanto a construção não termina. */
  construction: Part[];
  destroyed: Part[];
  /** Altura aproximada acima do footprint (para barra de vida e cliques). */
  height: number;
}

/** Origem Y (base visível / altura) por textura; texturas com cor usam o nome sem a cor. */
const ORIGIN_Y: Record<string, number> = {
  castle: 249 / 256,
  castle_construction: 246 / 256,
  castle_destroyed: 253 / 256,
  house: 171 / 192,
  house_construction: 183 / 192,
  house_destroyed: 165 / 192,
  tower: 234 / 256,
  tower_construction: 231 / 256,
  tower_destroyed: 229 / 256,
  goblin_house: 170 / 192,
  goblin_house_destroyed: 173 / 192,
  wood_tower: 170 / 192,
  wood_tower_construction: 178 / 192,
  wood_tower_destroyed: 173 / 192,
  barracks: 244 / 256,
  goldmine_active: 125 / 128,
  goldmine_inactive: 125 / 128,
  goldmine_destroyed: 125 / 128,
  archer: 0.68,
  tnt: 0.68,
  barrel: 0.77,
  deco_16: 104 / 128,
  deco_17: 104 / 128,
  deco_18: 168 / 192,
};

/** Origem Y de uma textura (ou undefined se não houver medida). */
export function originY(key: string): number | undefined {
  return ORIGIN_Y[key] ?? ORIGIN_Y[key.replace(/_(blue|red|purple|yellow)$/, '')];
}

export const UNIT_ORIGIN_Y: Record<string, number> = {
  pawn: 0.66,
  warrior: 0.69,
  archer: 0.69,
  torch: 0.69,
  tnt: 0.69,
  barrel: 0.77,
};

const one = (key: string, extra: Partial<Part> = {}): Part[] => [{ key, dx: 0, dy: 0, ...extra }];

/** Duas fundações de casa lado a lado: andaime das construções largas sem arte própria. */
const twoFoundations = (dx: number): Part[] => [
  { key: 'house_construction', dx: -dx, dy: -4 },
  { key: 'house_construction', dx, dy: 0, flip: true },
];

/**
 * Visual de cada construção na cor do time.
 * `hasBarracksArt`: se o Free Pack tem o quartel nessa cor (senão, usa duas casas).
 */
export function buildingVisual(id: BuildingId, color: TeamColor, hasBarracksArt: boolean): BuildingVisual {
  switch (id) {
    case 'castle':
      return { parts: one(`castle_${color}`), construction: one('castle_construction'), destroyed: one('castle_destroyed'), height: 12 };
    case 'house':
      return { parts: one(`house_${color}`), construction: one('house_construction'), destroyed: one('house_destroyed'), height: 30 };
    case 'tower':
      return {
        parts: [
          { key: `tower_${color}`, dx: 0, dy: 0 },
          { key: `archer_${color}`, dx: 0, dy: -118, anim: `archer_${color}.idle`, shooter: `archer_${color}.shootDown` },
        ],
        construction: one('tower_construction'),
        destroyed: one('tower_destroyed'),
        height: 110,
      };
    case 'barracks':
      return {
        parts: hasBarracksArt
          ? one(`barracks_${color}`)
          : [
              { key: `house_${color}`, dx: -46, dy: -6 },
              { key: `house_${color}`, dx: 46, dy: 0, flip: true },
            ],
        construction: twoFoundations(48),
        destroyed: [
          { key: 'house_destroyed', dx: -44, dy: 0 },
          { key: 'house_destroyed', dx: 44, dy: -4, flip: true },
        ],
        height: hasBarracksArt ? 60 : 40,
      };
    case 'goblinHall':
      return {
        parts: [
          { key: 'goblin_house', dx: -104, dy: -14 },
          { key: 'goblin_house', dx: 104, dy: -14, flip: true },
          { key: `wood_tower_${color}`, dx: 0, dy: 0, anim: `wood_tower_${color}.idle` },
          { key: 'deco_16', dx: -140, dy: 8 },
        ],
        construction: one('castle_construction'),
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
          { key: `barrel_${color}`, dx: 0, dy: 10 },
        ],
        construction: twoFoundations(62),
        destroyed: [
          { key: 'goblin_house_destroyed', dx: -62, dy: -4 },
          { key: 'goblin_house_destroyed', dx: 62, dy: 0, flip: true },
        ],
        height: 30,
      };
    case 'woodTower':
      return {
        parts: [
          { key: `wood_tower_${color}`, dx: 0, dy: 0, anim: `wood_tower_${color}.idle` },
          { key: `tnt_${color}`, dx: 0, dy: -96, anim: `tnt_${color}.idle`, shooter: `tnt_${color}.throw` },
        ],
        construction: one('wood_tower_construction'),
        destroyed: one('wood_tower_destroyed'),
        height: 60,
      };
  }
}

/** Visual na cor do time, usando a arte do quartel só se a textura dessa cor existir. */
export function teamVisual(textures: { exists(key: string): boolean }, id: BuildingId, color: TeamColor): BuildingVisual {
  return buildingVisual(id, color, textures.exists(`barracks_${color}`));
}
