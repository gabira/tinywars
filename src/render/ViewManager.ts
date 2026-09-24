import Phaser from 'phaser';
import type { World } from '../systems/World';
import { BuildingView, ProjectileView, ResourceView, UnitView } from './views';

/** Mantém um objeto visual para cada entidade da simulação. */
export class ViewManager {
  readonly units = new Map<number, UnitView>();
  readonly buildings = new Map<number, BuildingView>();
  readonly resources = new Map<number, ResourceView>();
  readonly projectiles = new Map<number, ProjectileView>();
  private ruins: BuildingView[] = [];
  private leftovers: ResourceView[] = [];
  private frame = 0;
  private destroyed = new Set<number>();

  constructor(
    private scene: Phaser.Scene,
    private world: World,
  ) {
    world.events.on((e) => {
      if (e.type === 'buildingDestroyed') this.destroyed.add(e.id);
    });
  }

  sync(alpha: number): void {
    const w = this.world;
    const vision = w.vision;
    const f = ++this.frame;

    for (const u of w.units) {
      let v = this.units.get(u.id);
      if (!v) {
        v = new UnitView(this.scene, u);
        this.units.set(u.id, v);
      }
      v.seen = f;
      const visible = u.team === 0 || vision.pointVisible(u.x, u.y);
      v.sync(u, alpha, visible);
    }
    for (const [id, v] of this.units)
      if (v.seen !== f) {
        v.destroy();
        this.units.delete(id);
      }

    for (const b of w.buildings) {
      let v = this.buildings.get(b.id);
      if (!v) {
        v = new BuildingView(this.scene, b);
        this.buildings.set(b.id, v);
      }
      v.seen = f;
      const visible = b.team === 0 || vision.rectExplored(b.tx, b.ty, b.def.w, b.def.h);
      v.sync(b, visible);
    }
    const now = this.scene.time.now;
    for (const [id, v] of this.buildings)
      if (v.seen !== f) {
        this.buildings.delete(id);
        if (this.destroyed.has(id)) {
          this.destroyed.delete(id);
          v.toRuin(now);
          this.ruins.push(v);
        } else v.destroy();
      }
    if (this.ruins.length) {
      this.ruins = this.ruins.filter((v) => {
        const left = v.ruinUntil - now;
        if (left <= 0) {
          v.destroy();
          return false;
        }
        v.container.setAlpha(Math.min(1, left / 3000));
        return true;
      });
    }

    for (const r of w.resources) {
      let v = this.resources.get(r.id);
      if (!v) {
        v = new ResourceView(this.scene, r);
        this.resources.set(r.id, v);
      }
      v.seen = f;
      const visible = vision.rectExplored(r.tx, r.ty, r.def.w, r.def.h);
      v.sync(r, alpha, visible);
    }
    for (const [id, v] of this.resources)
      if (v.seen !== f) {
        this.resources.delete(id);
        if (v.deplete()) this.leftovers.push(v);
      }

    for (const p of w.projectiles) {
      let v = this.projectiles.get(p.id);
      if (!v) {
        v = new ProjectileView(this.scene, p);
        this.projectiles.set(p.id, v);
      }
      v.seen = f;
      v.sync(p, alpha, p.team === 0 || vision.pointVisible(p.x, p.y));
    }
    for (const [id, v] of this.projectiles)
      if (v.seen !== f) {
        v.destroy();
        this.projectiles.delete(id);
      }
  }

  destroyAll(): void {
    for (const m of [this.units, this.buildings, this.resources, this.projectiles] as Map<number, { destroy(): void }>[]) {
      for (const v of m.values()) v.destroy();
      m.clear();
    }
    for (const v of this.ruins) v.destroy();
    for (const v of this.leftovers) v.destroy();
    this.ruins = [];
    this.leftovers = [];
  }
}
