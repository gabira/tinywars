import { TILE } from '../../config';
import type { Vec } from '../../core/math';
import type { NavGrid } from '../../map/NavGrid';

/** Verifica se um corpo de raio `r` pode andar em linha reta de a até b. */
export function lineClear(grid: NavGrid, ax: number, ay: number, bx: number, by: number, r = 12): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (
      !grid.walkable(Math.floor((x - r) / TILE), Math.floor((y - r) / TILE)) ||
      !grid.walkable(Math.floor((x + r) / TILE), Math.floor((y - r) / TILE)) ||
      !grid.walkable(Math.floor((x - r) / TILE), Math.floor((y + r) / TILE)) ||
      !grid.walkable(Math.floor((x + r) / TILE), Math.floor((y + r) / TILE))
    )
      return false;
  }
  return true;
}

/** Converte tiles em pontos do mundo e remove pontos intermediários com linha de visão livre. */
export function smoothPath(grid: NavGrid, sx: number, sy: number, tiles: number[]): Vec[] {
  const pts: Vec[] = tiles.map((i) => {
    const tx = i % grid.w;
    const ty = (i - tx) / grid.w;
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  });
  if (pts.length <= 1) return pts;
  const out: Vec[] = [];
  let from: Vec = { x: sx, y: sy };
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(grid, from.x, from.y, pts[j].x, pts[j].y)) j--;
    out.push(pts[j]);
    from = pts[j];
    i = j + 1;
  }
  return out;
}
