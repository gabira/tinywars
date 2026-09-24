import { ptBR } from './pt-BR';
import type { Cost, ResType } from '../data/types';

export const S = ptBR;

/** Substitui {chaves} no texto. */
export function fmt(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function resName(r: ResType): string {
  return S.res[r];
}

export function costText(cost: Cost): string {
  const parts: string[] = [];
  for (const r of ['gold', 'wood', 'meat'] as const) {
    const v = cost[r];
    if (v) parts.push(`${v} ${S.res[r]}`);
  }
  return parts.join(', ') || '—';
}

export function clockText(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
