import { TILE } from '../config';
import type { AnyEntity, Unit } from '../entities/Entity';
import { buildingVisual } from '../render/visuals';
import type { World } from '../systems/World';

/** Entidade sob o ponto do mundo (unidades na frente, depois construções, depois recursos). */
export function pickAt(world: World, wx: number, wy: number): AnyEntity | null {
  const v = world.vision;
  let best: Unit | null = null;
  for (const u of world.units) {
    if (!u.alive || u.hidden) continue;
    if (u.team !== 0 && !v.pointVisible(u.x, u.y)) continue;
    const top = u.def.sheet === 'barrel' ? 40 : 58;
    if (wx >= u.x - 20 && wx <= u.x + 20 && wy >= u.y - top && wy <= u.y + 10) {
      if (!best || u.y > best.y) best = u;
    }
  }
  if (best) return best;
  for (const b of world.buildings) {
    if (!b.alive) continue;
    if (b.team !== 0 && !v.rectExplored(b.tx, b.ty, b.def.w, b.def.h)) continue;
    const r = b.rect;
    const extra = buildingVisual(b.def.id, true).height;
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y - extra && wy <= r.y + r.h) return b;
  }
  for (const r of world.resources) {
    if (!r.alive || !v.rectExplored(r.tx, r.ty, r.def.w, r.def.h)) continue;
    if (r.def.kind === 'tree') {
      const cx = r.tx * TILE + TILE / 2;
      if (wx >= cx - 30 && wx <= cx + 30 && wy >= r.ty * TILE - 60 && wy <= r.ty * TILE + TILE) return r;
    } else if (r.def.kind === 'goldMine') {
      const rr = r.rect;
      if (wx >= rr.x && wx <= rr.x + rr.w && wy >= rr.y - 10 && wy <= rr.y + rr.h) return r;
    } else if (Math.hypot(wx - r.x, wy - (r.y - 10)) < 28) return r;
  }
  return null;
}

/** Unidades do jogador dentro de um retângulo do mundo. */
export function unitsInBox(world: World, x0: number, y0: number, x1: number, y1: number): Unit[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  return world.units.filter((u) => {
    if (!u.alive || u.team !== 0 || u.hidden) return false;
    const cy = u.y - 24;
    return u.x + 14 >= minX && u.x - 14 <= maxX && cy + 20 >= minY && cy - 20 <= maxY;
  });
}
