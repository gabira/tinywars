import { DIFFICULTY_ORDER, type DifficultyLevel } from '../data/difficulty';
import { TEAM_COLORS, type TeamColor } from '../render/palette';

// Preferências do menu salvas no navegador (falha silenciosamente sem armazenamento).

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

export function loadDifficulty(): DifficultyLevel {
  const v = read('tinywars.difficulty') as DifficultyLevel | null;
  return v && DIFFICULTY_ORDER.includes(v) ? v : 'normal';
}

export function saveDifficulty(v: DifficultyLevel): void {
  write('tinywars.difficulty', v);
}

export function loadColor(): TeamColor {
  const v = read('tinywars.color') as TeamColor | null;
  return v && TEAM_COLORS.includes(v) ? v : 'blue';
}

export function saveColor(v: TeamColor): void {
  write('tinywars.color', v);
}
