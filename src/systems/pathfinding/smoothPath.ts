import { TILE } from '../../config';
import type { Vec } from '../../core/math';
import type { NavGrid } from '../../map/NavGrid';

/**
 * Verifica se um corpo de raio `r` pode andar em linha reta de a até b: todos os tiles
 * tocados são caminháveis e a linha só troca de nível passando pela rampa.
 */
export function lineClear(grid: NavGrid, ax: number, ay: number, bx: number, by: number, r = 12): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / 8));
  let px = Math.floor(ax / TILE);
  let py = Math.floor(ay / TILE);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    if (cx !== px || cy !== py) {
      // passo diagonal: vale se algum dos caminhos ortogonais for permitido
      const ok =
        cx !== px && cy !== py
          ? (grid.canStep(px, py, cx, py) && grid.canStep(cx, py, cx, cy)) || (grid.canStep(px, py, px, cy) && grid.canStep(px, cy, cx, cy))
          : grid.canStep(px, py, cx, cy);
      if (!ok) return false;
      px = cx;
      py = cy;
    }
    const lv = grid.level(cx, cy);
    const onRamp = grid.isRamp(cx, cy);
    for (const [ox, oy] of [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
    ]) {
      const tx = Math.floor((x + ox) / TILE);
      const ty = Math.floor((y + oy) / TILE);
      if (!grid.walkable(tx, ty)) return false;
      if (grid.level(tx, ty) !== lv && !onRamp && !grid.isRamp(tx, ty)) return false;
    }
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
