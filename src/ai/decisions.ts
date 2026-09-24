import type { ResType } from '../data/types';

export type TroopId = 'torch' | 'tnt' | 'barrel';

/** Escolhe o recurso com maior déficit de trabalhadores em relação à divisão desejada. */
export function pickResource(
  counts: Record<ResType, number>,
  desired: Record<ResType, number>,
  available: Record<ResType, boolean>,
): ResType | null {
  const total = counts.gold + counts.wood + counts.meat + 1;
  let best: ResType | null = null;
  let bestDef = -Infinity;
  for (const r of ['meat', 'wood', 'gold'] as ResType[]) {
    if (!available[r]) continue;
    const deficit = desired[r] * total - counts[r];
    if (deficit > bestDef) {
      bestDef = deficit;
      best = r;
    }
  }
  return best;
}

/** Divisão desejada de trabalhadores conforme a fase do jogo. */
export function desiredSplit(hasCamp: boolean): Record<ResType, number> {
  return hasCamp ? { meat: 0.38, wood: 0.34, gold: 0.28 } : { meat: 0.45, wood: 0.45, gold: 0.1 };
}

/** Escolhe a próxima tropa pelo maior déficit em relação à proporção desejada. */
export function chooseTroop(have: Record<TroopId, number>, mix: Record<TroopId, number>): TroopId {
  const total = have.torch + have.tnt + have.barrel + 1;
  let best: TroopId = 'torch';
  let bestDef = -Infinity;
  for (const t of ['torch', 'tnt', 'barrel'] as TroopId[]) {
    if (mix[t] <= 0) continue;
    const d = mix[t] * total - have[t];
    if (d > bestDef) {
      bestDef = d;
      best = t;
    }
  }
  return best;
}

export function needsHouse(pop: number, popCap: number, housesInProgress: number, producers: number, hardCap = 50): boolean {
  if (popCap >= hardCap || housesInProgress > 0) return false;
  return popCap - pop <= 2 + producers;
}

export function shouldAttack(army: number, waveSize: number, time: number, firstAttack: number): boolean {
  return time >= firstAttack && army >= waveSize;
}

export function shouldRetreat(army: number, waveSize: number): boolean {
  return army < Math.max(2, Math.ceil(waveSize * 0.35));
}
