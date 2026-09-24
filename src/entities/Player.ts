import type { Cost, ResType, Team } from '../data/types';
import { RES_TYPES } from '../data/types';

export class Player {
  res: Record<ResType, number>;
  pop = 0;
  popCap = 0;
  gatherMult = 1;
  stats = { trained: 0, lost: 0, killed: 0, gathered: 0 };
  lastAttackAlert = -99;
  lastPopAlert = -99;

  constructor(
    readonly team: Team,
    start: Record<ResType, number>,
  ) {
    this.res = { ...start };
  }

  canAfford(cost: Cost): boolean {
    return RES_TYPES.every((r) => (cost[r] ?? 0) <= this.res[r]);
  }

  /** Primeiro recurso que falta para pagar o custo (ou null). */
  missing(cost: Cost): ResType | null {
    return RES_TYPES.find((r) => (cost[r] ?? 0) > this.res[r]) ?? null;
  }

  spend(cost: Cost): boolean {
    if (!this.canAfford(cost)) return false;
    for (const r of RES_TYPES) this.res[r] -= cost[r] ?? 0;
    return true;
  }

  refund(cost: Cost, fraction = 1): void {
    for (const r of RES_TYPES) this.res[r] += Math.floor((cost[r] ?? 0) * fraction);
  }
}
