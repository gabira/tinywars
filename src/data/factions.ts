import type { BuildingId, Faction, Team, UnitId } from './types';

export interface FactionSetup {
  faction: Faction;
  color: 'blue' | 'red';
  main: BuildingId;
  worker: UnitId;
}

export const TEAMS: Record<Team, FactionSetup> = {
  0: { faction: 'knights', color: 'blue', main: 'castle', worker: 'pawn' },
  1: { faction: 'goblins', color: 'red', main: 'goblinHall', worker: 'servant' },
};
