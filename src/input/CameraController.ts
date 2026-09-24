import Phaser from 'phaser';
import { HUD_BOTTOM, HUD_TOP, TILE } from '../config';

const ZOOMS = [0.5, 0.625, 0.75, 1, 1.25, 1.5, 2];

/** Câmera RTS: WASD/setas, bordas da tela, arrastar com botão do meio e zoom no cursor. */
export class CameraController {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private dragging = false;
  private dragFrom = { x: 0, y: 0, sx: 0, sy: 0 };
  private zoomIdx = 3;
  edgeScroll = true;
  private focused = true;

  constructor(
    private scene: Phaser.Scene,
    private worldW: number,
    private worldH: number,
  ) {
    this.cam = scene.cameras.main;
    this.updateBounds();
    const kb = scene.input.keyboard!;
    for (const k of ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT']) this.keys[k] = kb.addKey(k, false);
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) {
        this.dragging = true;
        this.dragFrom = { x: p.x, y: p.y, sx: this.cam.scrollX, sy: this.cam.scrollY };
      }
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.middleButtonDown()) this.dragging = false;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.cam.setScroll(this.dragFrom.sx - (p.x - this.dragFrom.x) / this.cam.zoom, this.dragFrom.sy - (p.y - this.dragFrom.y) / this.cam.zoom);
    });
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomAt(p.x, p.y, dy > 0 ? -1 : 1));
    const onBlur = () => (this.focused = false);
    const onFocus = () => (this.focused = true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('mouseleave', onBlur);
    document.addEventListener('mouseenter', onFocus);
    scene.events.once('shutdown', () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('mouseleave', onBlur);
      document.removeEventListener('mouseenter', onFocus);
    });
    scene.scale.on('resize', this.updateBounds, this);
    scene.events.once('shutdown', () => scene.scale.off('resize', this.updateBounds, this));
  }

  /** Limites com folga para o HUD cobrir as bordas do mapa sem escondê-las. */
  updateBounds(): void {
    const z = this.cam.zoom;
    this.cam.setBounds(-TILE, -TILE - HUD_TOP / z, this.worldW + TILE * 2, this.worldH + TILE * 2 + (HUD_TOP + HUD_BOTTOM) / z);
  }

  zoomAt(sx: number, sy: number, dir: number): void {
    const next = Phaser.Math.Clamp(this.zoomIdx + dir, 0, ZOOMS.length - 1);
    if (next === this.zoomIdx) return;
    const before = this.cam.getWorldPoint(sx, sy);
    this.zoomIdx = next;
    this.cam.setZoom(ZOOMS[next]);
    this.updateBounds();
    // Phaser aplica o zoom ao redor do centro: corrige para manter o ponto sob o cursor
    this.cam.preRender();
    const after = this.cam.getWorldPoint(sx, sy);
    this.cam.setScroll(this.cam.scrollX + (before.x - after.x), this.cam.scrollY + (before.y - after.y));
  }

  /** Centraliza o ponto na área visível entre a barra superior e o painel inferior. */
  centerOn(x: number, y: number): void {
    this.cam.centerOn(x, y + (HUD_BOTTOM - HUD_TOP) / 2 / this.cam.zoom);
  }

  update(dtMs: number, pointer: Phaser.Input.Pointer, allowEdge: boolean): void {
    const speed = (900 * dtMs) / 1000 / this.cam.zoom;
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) dx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) dx += 1;
    if (k.W.isDown || k.UP.isDown) dy -= 1;
    if (k.S.isDown || k.DOWN.isDown) dy += 1;
    if (this.edgeScroll && allowEdge && this.focused && !this.dragging) {
      const m = 10;
      const { width, height } = this.scene.scale;
      if (pointer.x <= m) dx -= 1;
      if (pointer.x >= width - m) dx += 1;
      if (pointer.y <= m) dy -= 1;
      if (pointer.y >= height - m) dy += 1;
    }
    if (dx || dy) this.cam.setScroll(this.cam.scrollX + dx * speed, this.cam.scrollY + dy * speed);
  }
}
