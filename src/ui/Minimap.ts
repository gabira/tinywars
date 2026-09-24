import Phaser from 'phaser';
import { TILE } from '../config';
import type { Session } from '../game/Session';
import type { CameraController } from '../input/CameraController';
import { smartCommand } from '../systems/commands';
import { selectedOwnUnits } from '../game/commandCard';
import { MINIMAP_COLORS, teamColor } from '../render/palette';

/** Tamanho máximo do minimapa no painel inferior (px). */
const MAX_W = 192;
const MAX_H = 144;

/** Minimapa com terreno, recursos, construções, unidades, névoa e a área da câmera. */
export class Minimap {
  readonly width: number;
  readonly height: number;
  private tex: Phaser.Textures.CanvasTexture;
  private base: HTMLCanvasElement;
  private image: Phaser.GameObjects.Image;
  private frame: Phaser.GameObjects.Rectangle;
  private last = 0;
  private pings: { x: number; y: number; t: number }[] = [];
  private dragging = false;
  /** Pixels por tile (depende do tamanho do mapa). */
  private px: number;

  constructor(
    scene: Phaser.Scene,
    private session: Session,
    private getCam: () => { cam: Phaser.Cameras.Scene2D.Camera; ctl: CameraController } | null,
  ) {
    const m = session.world.map;
    this.px = Math.max(1, Math.floor(Math.min(MAX_W / m.w, MAX_H / m.h)));
    const PX = this.px;
    this.width = m.w * PX;
    this.height = m.h * PX;
    if (scene.textures.exists('minimap')) scene.textures.remove('minimap');
    this.tex = scene.textures.createCanvas('minimap', this.width, this.height)!;
    this.base = document.createElement('canvas');
    this.base.width = this.width;
    this.base.height = this.height;
    const ctx = this.base.getContext('2d')!;
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        ctx.fillStyle = !m.land[i] ? '#3f8f95' : m.plateau[i] ? '#a9c46a' : m.cliff[i] ? '#4f6f73' : m.ramp[i] ? '#c8b27a' : m.patch[i] ? '#5c9f4a' : '#8fb04a';
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    this.frame = scene.add.rectangle(0, 0, this.width + 6, this.height + 6, 0x2b1d12).setOrigin(0);
    this.image = scene.add.image(0, 0, 'minimap').setOrigin(0).setInteractive();
    this.image.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        const w = this.toWorld(p);
        const units = selectedOwnUnits(this.session);
        if (units.length) smartCommand(this.session.world, 0, units.map((u) => u.id), w.x, w.y, 0, p.event.shiftKey);
        return;
      }
      this.dragging = true;
      this.jump(p);
    });
    this.image.on('pointermove', (p: Phaser.Input.Pointer) => this.dragging && p.leftButtonDown() && this.jump(p));
    scene.input.on('pointerup', () => (this.dragging = false));
    session.ui.on('alert', (x: number, y: number) => this.pings.push({ x, y, t: scene.time.now }));
  }

  private toWorld(p: Phaser.Input.Pointer): { x: number; y: number } {
    const PX = this.px;
    return { x: ((p.x - this.image.x) / PX) * TILE, y: ((p.y - this.image.y) / PX) * TILE };
  }

  private jump(p: Phaser.Input.Pointer): void {
    const c = this.getCam();
    if (!c) return;
    const w = this.toWorld(p);
    c.ctl.centerOn(w.x, w.y);
  }

  setPosition(x: number, y: number): void {
    this.frame.setPosition(x - 3, y - 3);
    this.image.setPosition(x, y);
  }

  update(now: number): void {
    if (now - this.last < 200) return;
    const PX = this.px;
    this.last = now;
    const w = this.session.world;
    const v = w.vision;
    const m = w.map;
    const ctx = this.tex.context;
    ctx.drawImage(this.base, 0, 0);

    for (const r of w.resources) {
      if (!r.alive || !v.isExplored(r.tx, r.ty)) continue;
      if (r.def.kind === 'tree') {
        ctx.fillStyle = '#2f5d34';
        ctx.fillRect(r.tx * PX, r.ty * PX, PX, PX);
      } else if (r.def.kind === 'goldMine') {
        ctx.fillStyle = '#fff4c2';
        ctx.fillRect(r.tx * PX, r.ty * PX, r.def.w * PX, r.def.h * PX);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((r.x / TILE) * PX - 1, (r.y / TILE) * PX - 1, 2, 2);
      }
    }
    for (const b of w.buildings) {
      if (!b.alive || (b.team !== 0 && !v.rectExplored(b.tx, b.ty, b.def.w, b.def.h))) continue;
      ctx.fillStyle = MINIMAP_COLORS[teamColor(b.team)].building;
      ctx.fillRect(b.tx * PX, b.ty * PX, b.def.w * PX, b.def.h * PX);
    }
    for (const u of w.units) {
      if (!u.alive || u.hidden || (u.team !== 0 && !v.pointVisible(u.x, u.y))) continue;
      ctx.fillStyle = MINIMAP_COLORS[teamColor(u.team)].unit;
      ctx.fillRect((u.x / TILE) * PX - 1, (u.y / TILE) * PX - 1, 3, 3);
    }
    if (v.enabled) {
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const i = y * m.w + x;
          if (v.visible[i]) continue;
          ctx.fillStyle = v.explored[i] ? 'rgba(10,12,20,0.45)' : '#0c0e18';
          ctx.fillRect(x * PX, y * PX, PX, PX);
        }
    }
    this.pings = this.pings.filter((p) => now - p.t < 3000);
    for (const p of this.pings) {
      const k = ((now - p.t) % 1000) / 1000;
      ctx.strokeStyle = `rgba(255,80,80,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((p.x / TILE) * PX, (p.y / TILE) * PX, 4 + k * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    const c = this.getCam();
    if (c) {
      const view = c.cam.worldView;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect((view.x / TILE) * PX + 0.5, (view.y / TILE) * PX + 0.5, (view.width / TILE) * PX, (view.height / TILE) * PX);
    }
    this.tex.refresh();
  }
}
