import type { Team } from '../data/types';

/** Cores de reino disponíveis no Free Pack (unidades, construções e avatares). */
export type TeamColor = 'blue' | 'red' | 'yellow' | 'purple' | 'black';
export const TEAM_COLORS: readonly TeamColor[] = ['blue', 'red', 'yellow', 'purple', 'black'];

/** Nome da pasta de cada cor no pacote ("Blue Units", "Red Buildings"...). */
export const COLOR_DIR: Record<TeamColor, string> = {
  blue: 'Blue',
  red: 'Red',
  yellow: 'Yellow',
  purple: 'Purple',
  black: 'Black',
};

/** Cor do reino rival: vermelho, a menos que o jogador tenha escolhido vermelho. */
export function aiColorFor(player: TeamColor): TeamColor {
  return player === 'red' ? 'black' : 'red';
}

let colors: [TeamColor, TeamColor] = ['blue', 'red'];

/** Define as cores da partida (só visual: a simulação não conhece cores). */
export function setTeamColors(player: TeamColor): [TeamColor, TeamColor] {
  colors = [player, aiColorFor(player)];
  return colors;
}

export function teamColor(team: Team | -1): TeamColor {
  return team === 1 ? colors[1] : colors[0];
}

/** Cores do minimapa: construções e unidades (mais claras). */
export const MINIMAP_COLORS: Record<TeamColor, { building: string; unit: string }> = {
  blue: { building: '#3b82f6', unit: '#9cc9ff' },
  red: { building: '#e04848', unit: '#ff8a8a' },
  yellow: { building: '#c9a227', unit: '#ffe066' },
  purple: { building: '#9b59d0', unit: '#d8b4fe' },
  black: { building: '#2a2d3a', unit: '#9aa0b5' },
};

/** Cor hexadecimal para detalhes de interface (faixas, destaques). */
export const UI_TINT: Record<TeamColor, number> = {
  blue: 0x3b82f6,
  red: 0xe04848,
  yellow: 0xe0b42a,
  purple: 0x9b59d0,
  black: 0x3a3d4a,
};
