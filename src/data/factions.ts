import type { BuildingId, Faction, Team, UnitId } from './types';

export interface FactionSetup {
  faction: Faction;
  main: BuildingId;
  worker: UnitId;
}

export const TEAMS: Record<Team, FactionSetup> = {
  0: { faction: 'knights', main: 'castle', worker: 'pawn' },
  1: { faction: 'goblins', main: 'goblinHall', worker: 'servant' },
};
