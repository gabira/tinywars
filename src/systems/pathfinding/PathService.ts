import { TILE } from '../../config';
import type { Unit } from '../../entities/Entity';
import type { World } from '../World';
import { lineClear, smoothPath } from './smoothPath';

/** Fila de pedidos de caminho com orçamento de tempo por tick. */
export class PathService {
  private queue: Unit[] = [];
  computed = 0;

  constructor(private world: World) {}

  get pending(): number {
    return this.queue.length;
  }

  request(u: Unit): void {
    if (!u.goal) return;
    u.lastPathReq = this.world.time;
    if (!u.pathPending) {
      u.pathPending = true;
      this.queue.push(u);
    }
  }

  process(budgetMs = 4, minCount = 6): void {
    const t0 = performance.now();
    let n = 0;
    while (this.queue.length && (n < minCount || performance.now() - t0 < budgetMs)) {
      const u = this.queue.shift()!;
      n++;
      if (!u.alive || !u.pathPending || !u.goal) {
        u.pathPending = false;
        continue;
      }
      this.compute(u);
    }
  }

  compute(u: Unit): void {
    const { nav, astar } = this.world;
    const goal = u.goal!;
    const sx = Math.floor(u.x / TILE);
    const sy = Math.floor(u.y / TILE);
    const tiles = astar.find(sx, sy, goal);
    let pts = smoothPath(nav, u.x, u.y, tiles);
    const f = u.finalPoint;
    if (f) {
      const ftx = Math.floor(f.x / TILE);
      const fty = Math.floor(f.y / TILE);
      const lastIdx = tiles.length ? tiles[tiles.length - 1] : sy * nav.w + sx;
      if (lastIdx === fty * nav.w + ftx && nav.walkable(ftx, fty)) {
        const from = pts.length > 1 ? pts[pts.length - 2] : { x: u.x, y: u.y };
        if (lineClear(nav, from.x, from.y, f.x, f.y, 8)) {
          if (pts.length) pts[pts.length - 1] = { x: f.x, y: f.y };
          else pts = [{ x: f.x, y: f.y }];
        }
      }
    }
    u.path = pts;
    u.pathIdx = 0;
    u.pathPending = false;
    u.pathVersion = nav.version;
    u.stuckTimer = 0;
    u.lastProgress = { x: u.x, y: u.y };
    this.computed++;
  }
}
