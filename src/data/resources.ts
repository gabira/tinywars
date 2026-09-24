import type { ResType, ResourceKind } from './types';

export interface ResourceDef {
  kind: ResourceKind;
  res: ResType;
  amount: number;
  w: number;
  h: number;
  blocking: boolean;
  /** Unidades por segundo de trabalho. */
  rate: number;
  /** Máximo de trabalhadores simultâneos (0 = ilimitado). */
  maxWorkers: number;
}

export const RESOURCES: Record<ResourceKind, ResourceDef> = {
  // jazida de ouro (pedras douradas): os peões mineram em volta, com picareta
  goldMine: { kind: 'goldMine', res: 'gold', amount: 1500, w: 2, h: 2, blocking: true, rate: 2, maxWorkers: 4 },
  tree: { kind: 'tree', res: 'wood', amount: 100, w: 1, h: 1, blocking: true, rate: 2, maxWorkers: 0 },
  sheep: { kind: 'sheep', res: 'meat', amount: 150, w: 1, h: 1, blocking: false, rate: 2.5, maxWorkers: 0 },
};

export const CARRY_CAPACITY = 10;

/** Segundos até uma ovelha nova aparecer no lugar de uma consumida. */
export const SHEEP_RESPAWN = 45;
