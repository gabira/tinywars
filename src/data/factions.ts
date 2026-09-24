import type { BuildingId, Team, UnitId } from './types';

export interface TeamSetup {
  main: BuildingId;
  worker: UnitId;
}

/** Os dois reinos começam iguais: castelo e peões. */
export const TEAMS: Record<Team, TeamSetup> = {
  0: { main: 'castle', worker: 'pawn' },
  1: { main: 'castle', worker: 'pawn' },
};
