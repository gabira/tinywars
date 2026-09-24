import type { Team } from '../data/types';

/** Cores de exército disponíveis no pacote CC0 (todas as unidades e construções). */
export type TeamColor = 'blue' | 'red' | 'purple' | 'yellow';
export const TEAM_COLORS: readonly TeamColor[] = ['blue', 'red', 'purple', 'yellow'];

/** Cor da IA: vermelho, a menos que o jogador tenha escolhido vermelho. */
export function aiColorFor(player: TeamColor): TeamColor {
  return player === 'red' ? 'blue' : 'red';
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
  red: { building: '#e04848', unit: '#ff8080' },
  purple: { building: '#9b59d0', unit: '#d8b4fe' },
  yellow: { building: '#c9a227', unit: '#ffe066' },
};
