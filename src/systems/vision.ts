import { TILE } from '../config';
import { HIGH_GROUND } from './combat';
import type { World } from './World';

/** Névoa de guerra do jogador (time 0). A IA não usa névoa. */
export class Vision {
  readonly visible: Uint8Array;
  readonly explored: Uint8Array;
  private stamps = new Map<number, [number, number][]>();
  version = 0;

  constructor(
    private world: World,
    readonly enabled: boolean,
  ) {
    const n = world.map.w * world.map.h;
    this.visible = new Uint8Array(n);
    this.explored = new Uint8Array(n);
    if (!enabled) {
      this.visible.fill(1);
      this.explored.fill(1);
    }
  }

  private stamp(r: number): [number, number][] {
    let s = this.stamps.get(r);
    if (!s) {
      s = [];
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) s.push([x, y]);
      this.stamps.set(r, s);
    }
    return s;
  }

  /**
   * Revela os tiles em volta de (px, py). Quem está no chão não enxerga o topo dos planaltos,
   * só a beirada (1 tile); quem está no alto ou na rampa vê tudo dentro do raio.
   */
  private reveal(px: number, py: number, r: number): void {
    const { w, h } = this.world.map;
    const nav = this.world.nav;
    const cx = Math.floor(px / TILE);
    const cy = Math.floor(py / TILE);
    const low = nav.level(cx, cy) === 0 && !nav.isRamp(cx, cy);
    for (const [dx, dy] of this.stamp(r)) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (low && nav.elev[i] === 1 && Math.max(Math.abs(dx), Math.abs(dy)) > 1) continue;
      this.visible[i] = 1;
      this.explored[i] = 1;
    }
  }

  /** Visão extra no alto do planalto: arqueiros e torres enxergam mais. */
  private highBonus(px: number, py: number, archerLike: boolean): number {
    if (this.world.nav.levelAt(px, py) !== 1) return 0;
    return archerLike ? HIGH_GROUND.sightArcher : HIGH_GROUND.sightOther;
  }

  update(): void {
    if (!this.enabled) return;
    this.visible.fill(0);
    for (const u of this.world.units)
      if (u.alive && u.team === 0) this.reveal(u.x, u.y, u.def.sight + this.highBonus(u.x, u.y, u.def.attack === 'arrow'));
    for (const b of this.world.buildings)
      if (b.alive && b.team === 0) {
        const sight = b.complete ? b.def.sight + this.highBonus(b.x, b.y, !!b.def.attack) : 3;
        this.reveal(b.x, b.y, sight);
      }
    this.version++;
  }

  isVisible(tx: number, ty: number): boolean {
    const { w, h } = this.world.map;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
    return this.visible[ty * w + tx] === 1;
  }

  isExplored(tx: number, ty: number): boolean {
    const { w, h } = this.world.map;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
    return this.explored[ty * w + tx] === 1;
  }

  pointVisible(x: number, y: number): boolean {
    return this.isVisible(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  rectExplored(tx: number, ty: number, w: number, h: number): boolean {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (this.isExplored(x, y)) return true;
    return false;
  }

  rectVisible(tx: number, ty: number, w: number, h: number): boolean {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (this.isVisible(x, y)) return true;
    return false;
  }
}
