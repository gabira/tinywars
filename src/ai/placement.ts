import type { BuildingDef, Team } from '../data/types';
import { canPlace } from '../systems/economy';
import type { World } from '../systems/World';

/**
 * Procura um local para construir perto de (ax, ay) em tiles, com margem livre ao redor
 * (para não fechar caminhos). `toward` puxa a escolha para uma direção.
 */
export function findBuildSpot(
  world: World,
  team: Team,
  def: BuildingDef,
  ax: number,
  ay: number,
  toward: { x: number; y: number } | null = null,
  minR = 2,
  maxR = 14,
): { tx: number; ty: number } | null {
  const nav = world.nav;
  let best: { tx: number; ty: number } | null = null;
  let bestScore = Infinity;
  let found = 0;
  for (let r = minR; r <= maxR && found < 12; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(ax + dx - def.w / 2);
        const ty = Math.round(ay + dy - def.h / 2);
        if (!canPlace(world, team, def, tx, ty)) continue;
        // margem de 1 tile livre ao redor
        let ok = true;
        for (let y = ty - 1; y <= ty + def.h && ok; y++)
          for (let x = tx - 1; x <= tx + def.w; x++) {
            if (!nav.walkable(x, y)) {
              ok = false;
              break;
            }
          }
        if (!ok) continue;
        found++;
        const cx = tx + def.w / 2;
        const cy = ty + def.h / 2;
        let score = Math.hypot(cx - ax, cy - ay);
        if (toward) score += Math.hypot(cx - toward.x, cy - toward.y) * 0.5;
        if (score < bestScore) {
          bestScore = score;
          best = { tx, ty };
        }
      }
  }
  return best;
}
