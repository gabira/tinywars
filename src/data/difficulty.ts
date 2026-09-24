export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface Difficulty {
  thinkEvery: number;
  gatherMult: number;
  workerTarget: number;
  firstAttack: number;
  waveSize: number;
  waveGrowth: number;
  /** Quartéis (e arquearias) que a IA ergue. */
  barracks: number;
  towers: number;
  /** Proporção desejada de tropas do reino rival. */
  mix: { warrior: number; lancer: number; archer: number; monk: number };
  startBonus: number;
}

export const DIFFICULTIES: Record<DifficultyLevel, Difficulty> = {
  easy: {
    thinkEvery: 1.5, gatherMult: 0.8, workerTarget: 10, firstAttack: 420, waveSize: 4, waveGrowth: 1,
    barracks: 1, towers: 0, mix: { warrior: 0.6, lancer: 0.1, archer: 0.3, monk: 0 }, startBonus: 0,
  },
  normal: {
    thinkEvery: 1.0, gatherMult: 1.0, workerTarget: 16, firstAttack: 300, waveSize: 6, waveGrowth: 2,
    barracks: 1, towers: 1, mix: { warrior: 0.4, lancer: 0.2, archer: 0.3, monk: 0.1 }, startBonus: 0,
  },
  hard: {
    thinkEvery: 0.5, gatherMult: 1.2, workerTarget: 22, firstAttack: 210, waveSize: 8, waveGrowth: 3,
    barracks: 2, towers: 2, mix: { warrior: 0.3, lancer: 0.25, archer: 0.3, monk: 0.15 }, startBonus: 100,
  },
};

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['easy', 'normal', 'hard'];
