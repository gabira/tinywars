import type { ResType, Team } from '../data/types';

/** Eventos pontuais emitidos pela simulação (efeitos visuais, avisos, estatísticas). */
export type GameEvent =
  | { type: 'projectileFired'; id: number }
  | { type: 'explosion'; x: number; y: number; radius: number; team: Team }
  | { type: 'unitDied'; id: number; x: number; y: number; team: Team; killerTeam: Team | null }
  | { type: 'buildingDestroyed'; id: number; x: number; y: number; team: Team }
  | { type: 'buildingCompleted'; id: number; team: Team }
  | { type: 'unitTrained'; id: number; team: Team }
  | { type: 'underAttack'; team: Team; x: number; y: number; building: boolean }
  | { type: 'deposit'; team: Team; res: ResType; amount: number; x: number; y: number }
  | { type: 'popCapped'; team: Team }
  | { type: 'resourceDepleted'; id: number }
  | { type: 'treeHit'; id: number }
  | { type: 'attackWave'; team: Team }
  | { type: 'gameOver'; winner: Team };

type Handler = (e: GameEvent) => void;

export class EventBus {
  private handlers = new Set<Handler>();

  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  emit(e: GameEvent): void {
    for (const h of this.handlers) h(e);
  }

  clear(): void {
    this.handlers.clear();
  }
}
