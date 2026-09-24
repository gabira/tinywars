import type { NavGrid } from '../../map/NavGrid';

/** Objetivo: qualquer tile caminhável a até `range` tiles (Chebyshev) do retângulo. */
export interface PathGoal {
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  range: number;
  /** Se definido, o tile final precisa estar neste nível (0 chão, 1 planalto). */
  level?: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/** Heap binário mínimo de índices ordenados por f. */
class MinHeap {
  items: number[] = [];
  constructor(private f: Float32Array) {}
  get size() {
    return this.items.length;
  }
  clear() {
    this.items.length = 0;
  }
  push(i: number) {
    const a = this.items;
    a.push(i);
    let c = a.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.f[a[p]] <= this.f[a[c]]) break;
      [a[p], a[c]] = [a[c], a[p]];
      c = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < a.length && this.f[a[l]] < this.f[a[m]]) m = l;
        if (r < a.length && this.f[a[r]] < this.f[a[m]]) m = r;
        if (m === p) break;
        [a[p], a[m]] = [a[m], a[p]];
        p = m;
      }
    }
    return top;
  }
}

/** Distância de Chebyshev de um tile até o retângulo do objetivo. */
export function goalDistance(x: number, y: number, g: PathGoal): number {
  const dx = Math.max(g.rx - x, 0, x - (g.rx + g.rw - 1));
  const dy = Math.max(g.ry - y, 0, y - (g.ry + g.rh - 1));
  return Math.max(dx, dy);
}

export class AStar {
  private g: Float32Array;
  private f: Float32Array;
  private from: Int32Array;
  private gen: Uint32Array;
  private closed: Uint32Array;
  private curGen = 0;
  private heap: MinHeap;
  maxExpansions: number;

  constructor(private grid: NavGrid) {
    const n = grid.w * grid.h;
    this.maxExpansions = n;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.from = new Int32Array(n);
    this.gen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.heap = new MinHeap(this.f);
  }

  private heuristic(x: number, y: number, goal: PathGoal): number {
    const dx = Math.max(goal.rx - x, 0, x - (goal.rx + goal.rw - 1));
    const dy = Math.max(goal.ry - y, 0, y - (goal.ry + goal.rh - 1));
    const ex = Math.max(0, dx - goal.range);
    const ey = Math.max(0, dy - goal.range);
    return Math.max(ex, ey) + (SQRT2 - 1) * Math.min(ex, ey);
  }

  /**
   * Caminho em tiles (índices), do primeiro passo até o destino (sem o tile inicial).
   * Se o objetivo for inalcançável, devolve o caminho até o tile alcançável mais próximo.
   */
  find(sx: number, sy: number, goal: PathGoal): number[] {
    const grid = this.grid;
    const w = grid.w;
    const start = sy * w + sx;
    const isGoal = (x: number, y: number) =>
      goalDistance(x, y, goal) <= goal.range && (goal.level === undefined || grid.level(x, y) === goal.level);
    if (isGoal(sx, sy) && grid.walkable(sx, sy)) return [];

    this.curGen++;
    if (this.curGen === 0xffffffff) {
      this.gen.fill(0);
      this.closed.fill(0);
      this.curGen = 1;
    }
    const G = this.curGen;
    const heap = this.heap;
    heap.clear();
    this.gen[start] = G;
    this.g[start] = 0;
    this.f[start] = this.heuristic(sx, sy, goal);
    this.from[start] = -1;
    heap.push(start);

    let best = start;
    let bestH = this.f[start];
    let found = -1;
    let expansions = 0;

    while (heap.size) {
      const cur = heap.pop();
      if (this.closed[cur] === G) continue;
      this.closed[cur] = G;
      const cx = cur % w;
      const cy = (cur - cx) / w;
      if (cur !== start && isGoal(cx, cy)) {
        found = cur;
        break;
      }
      const h = this.f[cur] - this.g[cur];
      if (h < bestH) {
        bestH = h;
        best = cur;
      }
      if (++expansions > this.maxExpansions) break;

      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        // mesmo nível, ou subindo/descendo pela rampa; diagonais não cortam cantos
        if (!grid.canStep(cx, cy, nx, ny)) continue;
        const ni = ny * w + nx;
        if (this.closed[ni] === G) continue;
        const ng = this.g[cur] + cost;
        if (this.gen[ni] !== G || ng < this.g[ni]) {
          this.gen[ni] = G;
          this.g[ni] = ng;
          this.f[ni] = ng + this.heuristic(nx, ny, goal);
          this.from[ni] = cur;
          heap.push(ni);
        }
      }
    }

    const end = found >= 0 ? found : best;
    const path: number[] = [];
    for (let c = end; c !== start && c >= 0; c = this.from[c]) path.push(c);
    path.reverse();
    return path;
  }
}
