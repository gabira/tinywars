import Phaser from 'phaser';
import { HUD_BOTTOM, HUD_TOP, TILE } from '../config';
import { BUILDINGS } from '../data/buildings';
import type { AnyEntity } from '../entities/Entity';
import { commandCard, report, selectedOwnBuilding, selectedOwnUnits } from '../game/commandCard';
import { pickAt, unitsInBox } from '../game/picking';
import type { Session } from '../game/Session';
import { S } from '../i18n/t';
import type { Overlay } from '../render/Overlay';
import { teamColor } from '../render/palette';
import { buildingVisual, originY } from '../render/visuals';
import { canPlace } from '../systems/economy';
import { cssCursor, type CursorKind } from '../ui/cursors';
import { smartCommand } from '../systems/commands';
import type { CameraController } from './CameraController';

const MARK = { move: 0x7cff7c, attack: 0xff5a5a, gather: 0xf7d154, build: 0x5aa9e6, heal: 0xb6f36b, none: 0xffffff };

export class WorldInput {
  private drag: { sx: number; sy: number; wx: number; wy: number } | null = null;
  dragBox: { x0: number; y0: number; x1: number; y1: number } | null = null;
  hoverId = 0;
  ghost: { tx: number; ty: number; w: number; h: number; ok: boolean } | null = null;
  private ghostObj: Phaser.GameObjects.Container | null = null;
  private ghostKey = '';
  private lastClick = { time: 0, id: 0 };
  private lastGroupKey = { time: 0, n: 0 };
  private idleCursor = 0;
  /** O Phaser reprocessa a fila de teclas do quadro a cada evento novo: guarda os já tratados. */
  private handledKeys = new WeakSet<KeyboardEvent>();
  private cursorKind: CursorKind | '' = '';

  constructor(
    private scene: Phaser.Scene,
    private session: Session,
    private cam: CameraController,
    private overlay: Overlay,
  ) {
    const input = scene.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointermove', this.onMove, this);
    input.keyboard!.on('keydown', this.onKey, this);
  }

  get world() {
    return this.session.world;
  }

  overHud(p: Phaser.Input.Pointer): boolean {
    const s = this.session;
    return p.y < HUD_TOP || p.y > this.scene.scale.height - HUD_BOTTOM || s.paused || s.world.winner !== null;
  }

  private worldPoint(p: Phaser.Input.Pointer): { x: number; y: number } {
    const wp = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: wp.x, y: wp.y };
  }

  // ---------------------------------------------------------------- mouse

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.overHud(p)) return;
    const s = this.session;
    const { x, y } = this.worldPoint(p);
    const shift = p.event.shiftKey;
    if (p.rightButtonDown()) {
      if (s.mode !== 'normal') {
        s.cancelMode();
        return;
      }
      this.rightClick(x, y, shift);
      return;
    }
    if (!p.leftButtonDown()) return;
    if (s.mode === 'place') {
      this.place(shift);
      return;
    }
    if (s.mode === 'attackMove') {
      const units = selectedOwnUnits(s);
      const t = pickAt(this.world, x, y);
      if (t && t.kind !== 'resource' && t.team !== 0) {
        this.world.issue(0, { type: 'attack', unitIds: units.map((u) => u.id), targetId: t.id, queue: shift });
      } else {
        this.world.issue(0, { type: 'move', unitIds: units.map((u) => u.id), x, y, attack: true, queue: shift });
      }
      this.overlay.marker(x, y, MARK.attack);
      if (!shift) s.cancelMode();
      return;
    }
    this.drag = { sx: p.x, sy: p.y, wx: x, wy: y };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const { x, y } = this.worldPoint(p);
    if (this.drag && p.leftButtonDown()) {
      if (Math.hypot(p.x - this.drag.sx, p.y - this.drag.sy) > 6) this.dragBox = { x0: this.drag.wx, y0: this.drag.wy, x1: x, y1: y };
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.drag || p.leftButtonDown()) return;
    const s = this.session;
    const shift = p.event.shiftKey;
    const ctrl = p.event.ctrlKey;
    const { x, y } = this.worldPoint(p);
    if (this.dragBox) {
      const units = unitsInBox(this.world, this.dragBox.x0, this.dragBox.y0, x, y);
      if (units.length) {
        const ids = units.map((u) => u.id);
        s.setSelection(shift ? [...new Set([...s.selection.filter((id) => this.world.getUnit(id)?.team === 0), ...ids])] : ids);
      } else if (!shift) s.setSelection([]);
    } else {
      const t = pickAt(this.world, x, y);
      const now = this.scene.time.now;
      if (t && t.kind === 'unit' && t.team === 0) {
        const dbl = now - this.lastClick.time < 350 && this.lastClick.id === t.id;
        if (dbl || ctrl) this.selectSameType(t);
        else if (shift) {
          const cur = s.selection.filter((id) => this.world.getUnit(id)?.team === 0);
          s.setSelection(cur.includes(t.id) ? cur.filter((id) => id !== t.id) : [...cur, t.id]);
        } else s.setSelection([t.id]);
        this.lastClick = { time: now, id: t.id };
      } else if (t) {
        if (!shift) s.setSelection([t.id]);
        this.lastClick = { time: now, id: t.id };
      } else if (!shift) s.setSelection([]);
    }
    this.drag = null;
    this.dragBox = null;
  }

  private selectSameType(t: AnyEntity): void {
    if (t.kind !== 'unit') return;
    const view = this.scene.cameras.main.worldView;
    const ids = this.world.units
      .filter((u) => u.alive && u.team === 0 && u.def.id === t.def.id && !u.hidden && view.contains(u.x, u.y))
      .map((u) => u.id);
    this.session.setSelection(ids);
  }

  private rightClick(x: number, y: number, shift: boolean): void {
    const s = this.session;
    const t = pickAt(this.world, x, y);
    const units = selectedOwnUnits(s);
    if (units.length) {
      const kind = smartCommand(this.world, 0, units.map((u) => u.id), x, y, t?.id ?? 0, shift);
      this.overlay.marker(t && kind !== 'move' ? t.x : x, t && kind !== 'move' ? t.y : y, MARK[kind]);
      return;
    }
    const b = selectedOwnBuilding(s);
    if (b && b.def.trains.length) {
      this.world.issue(0, { type: 'rally', buildingId: b.id, x, y, targetId: t && t.kind === 'resource' ? t.id : 0 });
      this.overlay.marker(x, y, MARK.move);
    }
  }

  // ---------------------------------------------------------------- construção

  private place(shift: boolean): void {
    const s = this.session;
    if (!s.placing || !this.ghost) return;
    const workers = selectedOwnUnits(s).filter((u) => u.isWorker);
    const r = this.world.issue(0, {
      type: 'build',
      unitIds: workers.map((u) => u.id),
      building: s.placing,
      tx: this.ghost.tx,
      ty: this.ghost.ty,
      queue: shift,
    });
    if (report(s, r)) {
      this.overlay.marker((this.ghost.tx + this.ghost.w / 2) * TILE, (this.ghost.ty + this.ghost.h) * TILE, MARK.build);
      if (!shift || !this.world.players[0].canAfford(BUILDINGS[s.placing].cost)) {
        s.buildMenu = false;
        s.cancelMode();
        s.ui.emit('selection');
      }
    }
  }

  private updateGhost(): void {
    const s = this.session;
    if (s.mode !== 'place' || !s.placing) {
      this.ghost = null;
      if (this.ghostObj) {
        this.ghostObj.destroy();
        this.ghostObj = null;
        this.ghostKey = '';
      }
      return;
    }
    const def = BUILDINGS[s.placing];
    const p = this.scene.input.activePointer;
    const { x, y } = this.worldPoint(p);
    const tx = Math.floor(x / TILE - def.w / 2 + 0.5);
    const ty = Math.floor(y / TILE - def.h / 2 + 0.5);
    const ok = canPlace(this.world, 0, def, tx, ty);
    this.ghost = { tx, ty, w: def.w, h: def.h, ok };
    if (this.ghostKey !== def.id) {
      this.ghostObj?.destroy();
      this.ghostObj = this.scene.add.container(0, 0).setDepth(5.5e5);
      for (const part of buildingVisual(def.id, teamColor(0)).parts) {
        if (!this.scene.textures.exists(part.key)) continue;
        const img = this.scene.add.image(part.dx, part.dy, part.key, 0).setOrigin(0.5, originY(part.key) ?? 1).setFlipX(!!part.flip);
        this.ghostObj.add(img);
      }
      this.ghostKey = def.id;
    }
    this.ghostObj!.setPosition((tx + def.w / 2) * TILE, (ty + def.h) * TILE).setAlpha(0.65);
    for (const o of this.ghostObj!.list as Phaser.GameObjects.Image[]) o.setTint(ok ? 0xb0ffb0 : 0xff8080);
  }

  // ---------------------------------------------------------------- teclado

  private onKey(e: KeyboardEvent): void {
    if (this.handledKeys.has(e)) return;
    this.handledKeys.add(e);
    const s = this.session;
    if (s.world.winner !== null) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

    if (key === 'Escape') {
      if (s.mode !== 'normal') s.cancelMode();
      else if (s.buildMenu) {
        s.buildMenu = false;
        s.ui.emit('selection');
      } else {
        s.paused = !s.paused;
        s.ui.emit('pause');
      }
      return;
    }
    if (s.paused) return;

    // grupos de controle
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      const n = Number(digit[1]);
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
        const ids = selectedOwnUnits(s).map((u) => u.id);
        if (ids.length) {
          s.groups.set(n, ids);
          s.toast(`Grupo ${n}: ${ids.length}`);
        }
        return;
      }
      const g = (s.groups.get(n) ?? []).filter((id) => this.world.getUnit(id)?.alive);
      if (!g.length) return;
      s.setSelection(g);
      const now = this.scene.time.now;
      if (this.lastGroupKey.n === n && now - this.lastGroupKey.time < 400) {
        const u = this.world.getUnit(g[0]);
        if (u) this.cam.centerOn(u.x, u.y);
      }
      this.lastGroupKey = { time: now, n };
      return;
    }

    if (key === 'Home') {
      const m = this.world.mainBuilding(0);
      if (m) this.cam.centerOn(m.x, m.y);
      return;
    }
    if (key === ' ') {
      if (s.lastAlert) this.cam.centerOn(s.lastAlert.x, s.lastAlert.y);
      return;
    }
    if (key === '.' || key === ',') {
      const idle = this.world.units.filter((u) => u.alive && u.team === 0 && u.isWorker && !u.order && !u.queue.length);
      if (!idle.length) {
        s.toast(S.msg.noIdle);
        return;
      }
      const u = idle[this.idleCursor++ % idle.length];
      s.setSelection([u.id]);
      this.cam.centerOn(u.x, u.y);
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // camera usa WASD: não disparam comandos
    if (['W', 'A', 'S', 'D'].includes(key)) return;
    for (const b of commandCard(s)) {
      if (b.hotkey === key && b.hotkey !== 'ESC') {
        b.action();
        s.ui.emit('selection');
        return;
      }
    }
  }

  update(): void {
    this.updateGhost();
    const p = this.scene.input.activePointer;
    if (this.overHud(p)) {
      this.hoverId = 0;
      return;
    }
    const { x, y } = this.worldPoint(p);
    const t = pickAt(this.world, x, y);
    this.hoverId = t?.id ?? 0;
    const canvas = this.scene.game.canvas;
    const s = this.session;
    let kind: CursorKind = 'default';
    if (s.mode === 'attackMove') kind = 'attack';
    else if (s.mode === 'place') kind = this.ghost && !this.ghost.ok ? 'forbidden' : 'default';
    else if (t && t.kind !== 'resource' && t.team !== 0 && selectedOwnUnits(s).length) kind = 'attack';
    else if (t) kind = 'pointer';
    if (kind !== this.cursorKind) {
      this.cursorKind = kind;
      canvas.style.cursor = cssCursor(kind);
    }
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onDown, this);
    input.off('pointerup', this.onUp, this);
    input.off('pointermove', this.onMove, this);
    input.keyboard?.off('keydown', this.onKey, this);
    this.ghostObj?.destroy();
  }
}
