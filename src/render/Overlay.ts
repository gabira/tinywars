import Phaser from 'phaser';
import { COLORS, TILE } from '../config';
import { UNITS } from '../data/units';
import type { AnyEntity } from '../entities/Entity';
import type { Session } from '../game/Session';
import { teamColor } from './palette';
import { buildingVisual } from './visuals';

interface Marker {
  x: number;
  y: number;
  color: number;
  start: number;
}

/** Elipses de seleção, barras de vida, marcadores de ordem, caixa de seleção e ponto de encontro. */
export class Overlay {
  private under: Phaser.GameObjects.Graphics;
  private over: Phaser.GameObjects.Graphics;
  private markers: Marker[] = [];

  constructor(
    private scene: Phaser.Scene,
    private session: Session,
  ) {
    this.under = scene.add.graphics().setDepth(-1400);
    this.over = scene.add.graphics().setDepth(6e5);
  }

  marker(x: number, y: number, color: number): void {
    this.markers.push({ x, y, color, start: this.scene.time.now });
  }

  private hpBar(x: number, y: number, w: number, frac: number, h = 5): void {
    const g = this.over;
    g.fillStyle(0x1b1b24, 0.85).fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    const c = frac > 0.6 ? COLORS.hpGood : frac > 0.3 ? COLORS.hpMid : COLORS.hpLow;
    g.fillStyle(c, 1).fillRect(x - w / 2, y, Math.max(0, w * frac), h);
  }

  private visible(e: AnyEntity): boolean {
    const v = this.session.world.vision;
    if (e.kind === 'unit') return !e.hidden && (e.team === 0 || v.pointVisible(e.x, e.y));
    if (e.kind === 'building') return e.team === 0 || v.rectExplored(e.tx, e.ty, e.def.w, e.def.h);
    return v.rectExplored(e.tx, e.ty, e.def.w, e.def.h);
  }

  private ring(e: AnyEntity, color: number, alpha = 1): void {
    const g = this.under;
    g.lineStyle(2, color, alpha);
    if (e.kind === 'unit') {
      g.strokeEllipse(e.x, e.y - 2, e.radius * 2.4, e.radius * 1.1);
    } else if (e.kind === 'building') {
      const r = e.rect;
      g.strokeEllipse(r.x + r.w / 2, r.y + r.h - 12, r.w * 1.05, Math.min(r.h, 90));
    } else if (e.def.kind === 'sheep') {
      g.strokeEllipse(e.x, e.y, 44, 20);
    } else {
      const r = e.rect;
      g.strokeEllipse(r.x + r.w / 2, r.y + r.h - 8, r.w + 8, Math.min(r.h, 64));
    }
  }

  private bars(e: AnyEntity): void {
    if (e.kind === 'unit') {
      this.hpBar(e.x, e.y - (e.def.sheet === 'barrel' ? 44 : 64), 34, e.hp / e.maxHp, 4);
    } else if (e.kind === 'building') {
      const r = e.rect;
      // em construção só há a fundação (baixa): a barra fica logo acima do footprint
      const top = r.y - (e.complete ? buildingVisual(e.def.id, teamColor(e.team)).height : 0) - 14;
      const w = Math.min(r.w * 0.7, 130);
      this.hpBar(r.x + r.w / 2, top, w, e.hp / e.maxHp, 6);
      if (!e.complete) {
        const g = this.over;
        g.fillStyle(0x1b1b24, 0.85).fillRect(r.x + r.w / 2 - w / 2 - 1, top + 8, w + 2, 6);
        g.fillStyle(0x5aa9e6, 1).fillRect(r.x + r.w / 2 - w / 2, top + 9, w * e.progress, 4);
      } else if (e.queue.length && e.team === 0) {
        const item = e.queue[0];
        const t = item.t / UNITS[item.unit].trainTime;
        const g = this.over;
        g.fillStyle(0x1b1b24, 0.85).fillRect(r.x + r.w / 2 - w / 2 - 1, top + 8, w + 2, 6);
        g.fillStyle(COLORS.hpMid, 1).fillRect(r.x + r.w / 2 - w / 2, top + 9, w * Math.min(1, t), 4);
      }
    }
  }

  draw(opts: {
    dragBox: { x0: number; y0: number; x1: number; y1: number } | null;
    hoverId: number;
    ghost: { tx: number; ty: number; w: number; h: number; ok: boolean } | null;
  }): void {
    const s = this.session;
    const w = s.world;
    this.under.clear();
    this.over.clear();

    // unidades danificadas visíveis
    for (const u of w.units) if (u.alive && u.hp < u.maxHp && this.visible(u)) this.bars(u);
    for (const b of w.buildings) if (b.alive && (b.hp < b.maxHp || !b.complete) && this.visible(b)) this.bars(b);

    for (const id of s.selection) {
      const e = w.get(id);
      if (!e || !e.alive || !this.visible(e)) continue;
      const color = e.kind === 'resource' ? 0xf7d154 : e.team === 0 ? COLORS.select : COLORS.selectEnemy;
      this.ring(e, color);
      if (e.kind !== 'resource') this.bars(e);
      if (e.kind === 'building' && e.team === 0 && e.rally) {
        const g = this.over;
        const r = e.rect;
        g.lineStyle(2, 0xffffff, 0.5).lineBetween(r.x + r.w / 2, r.y + r.h, e.rally.x, e.rally.y);
        g.fillStyle(0x3b82f6, 1).fillTriangle(e.rally.x, e.rally.y - 26, e.rally.x + 16, e.rally.y - 20, e.rally.x, e.rally.y - 14);
        g.lineStyle(3, 0x6b4a2b, 1).lineBetween(e.rally.x, e.rally.y, e.rally.x, e.rally.y - 28);
      }
    }
    if (opts.hoverId && !s.selection.includes(opts.hoverId)) {
      const e = w.get(opts.hoverId);
      if (e && e.alive && this.visible(e)) {
        const color = e.kind === 'resource' ? 0xf7d154 : e.team === 0 ? COLORS.select : COLORS.selectEnemy;
        this.ring(e, color, 0.5);
      }
    }

    if (opts.dragBox) {
      const { x0, y0, x1, y1 } = opts.dragBox;
      this.over.lineStyle(1.5, COLORS.select, 1).strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      this.over.fillStyle(COLORS.select, 0.08).fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }

    if (opts.ghost) {
      const { tx, ty, w: gw, h: gh, ok } = opts.ghost;
      const c = ok ? 0x7cff7c : 0xff5a5a;
      for (let y = ty; y < ty + gh; y++)
        for (let x = tx; x < tx + gw; x++) {
          const free = w.nav.walkable(x, y);
          this.under.fillStyle(free ? c : 0xff5a5a, 0.28).fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        }
    }

    const now = this.scene.time.now;
    this.markers = this.markers.filter((m) => now - m.start < 500);
    for (const m of this.markers) {
      const t = (now - m.start) / 500;
      this.under.lineStyle(2, m.color, 1 - t).strokeEllipse(m.x, m.y, 36 * (1 - t) + 8, 16 * (1 - t) + 4);
    }
  }

  destroy(): void {
    this.under.destroy();
    this.over.destroy();
  }
}
