import { TILE } from '../config';

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(bx - ax, by - ay);

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const toTile = (px: number): number => Math.floor(px / TILE);

export const tileCenter = (t: number): number => t * TILE + TILE / 2;

/** Distância de um ponto até um retângulo (0 se estiver dentro). */
export function distToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Ponto do retângulo mais próximo de (px, py). */
export function closestPointInRect(px: number, py: number, r: Rect): Vec {
  return { x: clamp(px, r.x, r.x + r.w), y: clamp(py, r.y, r.y + r.h) };
}
