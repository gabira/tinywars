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
  /** Unidade decorativa no topo da torre: anima quando a torre atira. */
  shooter?: string;
  /** Origem vertical própria (para sprites de unidade). */
  originY?: number;
}

export interface BuildingVisual {
  parts: Part[];
  /** Fundação mostrada enquanto a obra não termina (versão antiga, CC0). */
  construction: Part[];
  /** Ruínas depois de destruída (versão antiga, CC0). */
  destroyed: Part[];
  /** Altura aproximada acima do footprint (para barra de vida e cliques). */
  height: number;
}

/** Origem Y (base visível / altura) por textura; texturas com cor usam o nome sem a cor. */
const ORIGIN_Y: Record<string, number> = {
  castle: 248 / 256,
  house1: 172 / 192,
  house2: 177 / 192,
  house3: 171 / 192,
  barracks: 244 / 256,
  archery: 239 / 256,
  monastery: 309 / 320,
  tower: 229 / 256,
  castle_construction: 246 / 256,
  castle_destroyed: 253 / 256,
  house_construction: 183 / 192,
  house_destroyed: 165 / 192,
  tower_construction: 231 / 256,
  tower_destroyed: 229 / 256,
  rock1: 50 / 64,
  rock2: 52 / 64,
  rock3: 51 / 64,
  rock4: 55 / 64,
  bush1: 78 / 128,
  bush2: 78 / 128,
  bush3: 78 / 128,
  bush4: 78 / 128,
};

/** Origem Y de uma textura (ou undefined se não houver medida). */
export function originY(key: string): number | undefined {
  return ORIGIN_Y[key] ?? ORIGIN_Y[key.replace(/_(blue|red|yellow|purple|black)$/, '')];
}

/** Origem Y dos sprites de unidade (pés na base; o lanceiro usa quadros de 320 px). */
export const UNIT_ORIGIN_Y: Record<string, number> = {
  pawn: 135 / 192,
  warrior: 136 / 192,
  lancer: 197 / 320,
  archer: 135 / 192,
  monk: 133 / 192,
};

const one = (key: string, extra: Partial<Part> = {}): Part[] => [{ key, dx: 0, dy: 0, ...extra }];

/** Duas fundações de casa lado a lado: obra das construções largas (3 tiles). */
const twoFoundations = (dx: number): Part[] => [
  { key: 'house_construction', dx: -dx, dy: -4 },
  { key: 'house_construction', dx, dy: 0, flip: true },
];

const twoRuins = (dx: number): Part[] => [
  { key: 'house_destroyed', dx: -dx, dy: 0 },
  { key: 'house_destroyed', dx, dy: -4, flip: true },
];

/** Visual de cada construção na cor do reino. `variant` escolhe entre as 3 casas. */
export function buildingVisual(id: BuildingId, color: TeamColor, variant = 0): BuildingVisual {
  switch (id) {
    case 'castle':
      return { parts: one(`castle_${color}`), construction: one('castle_construction'), destroyed: one('castle_destroyed'), height: 15 };
    case 'house':
      return {
        parts: one(`house${(variant % 3) + 1}_${color}`),
        construction: one('house_construction'),
        destroyed: one('house_destroyed'),
        height: 26,
      };
    case 'barracks':
      return { parts: one(`barracks_${color}`), construction: twoFoundations(48), destroyed: twoRuins(44), height: 58 };
    case 'archery':
      return { parts: one(`archery_${color}`), construction: twoFoundations(48), destroyed: twoRuins(44), height: 50 };
    case 'monastery':
      return { parts: one(`monastery_${color}`), construction: twoFoundations(48), destroyed: twoRuins(44), height: 136 };
    case 'tower':
      return {
        parts: [
          { key: `tower_${color}`, dx: 0, dy: 0 },
          {
            key: `archer_${color}_idle`, dx: 0, dy: -118, anim: `archer_${color}_idle.play`,
            shooter: `archer_${color}_shoot.play`, originY: UNIT_ORIGIN_Y.archer,
          },
        ],
        construction: one('tower_construction'),
        destroyed: one('tower_destroyed'),
        height: 110,
      };
  }
}
