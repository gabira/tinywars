import type { Cost } from './types';

export const BALANCE = {
  startResources: { gold: 100, wood: 200, meat: 200 } as Required<Cost>,
  startWorkers: 4,
  popHardCap: 50,
  maxQueue: 5,
  constructionStartHp: 0.1,
  cancelRefund: 0.75,
  aggroScanInterval: 0.4,
  helpRadius: 6 * 64,
};
