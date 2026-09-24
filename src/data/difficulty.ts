export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface Difficulty {
  thinkEvery: number;
  gatherMult: number;
  workerTarget: number;
  firstAttack: number;
  waveSize: number;
  waveGrowth: number;
  camps: number;
  towers: number;
  /** Proporção desejada de tropas: tocha, dinamite, barril. */
  mix: { torch: number; tnt: number; barrel: number };
  startBonus: number;
}

export const DIFFICULTIES: Record<DifficultyLevel, Difficulty> = {
  easy: {
    thinkEvery: 1.5, gatherMult: 0.8, workerTarget: 10, firstAttack: 420, waveSize: 4, waveGrowth: 1,
    camps: 1, towers: 0, mix: { torch: 0.8, tnt: 0.2, barrel: 0 }, startBonus: 0,
  },
  normal: {
    thinkEvery: 1.0, gatherMult: 1.0, workerTarget: 16, firstAttack: 300, waveSize: 6, waveGrowth: 2,
    camps: 1, towers: 1, mix: { torch: 0.6, tnt: 0.3, barrel: 0.1 }, startBonus: 0,
  },
  hard: {
    thinkEvery: 0.5, gatherMult: 1.2, workerTarget: 22, firstAttack: 210, waveSize: 8, waveGrowth: 3,
    camps: 2, towers: 2, mix: { torch: 0.5, tnt: 0.3, barrel: 0.2 }, startBonus: 100,
  },
};

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['easy', 'normal', 'hard'];
