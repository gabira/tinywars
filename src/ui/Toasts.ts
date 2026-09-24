import Phaser from 'phaser';
import { textStyle } from './widgets';

const LIFE = 4500;
const FADE = 700;
const MAX = 2;

/**
 * Avisos curtos dentro da barra superior do HUD. Mostra no máximo dois (o mais novo embaixo);
 * uma mensagem repetida não empilha, ganha um contador (×2, ×3...).
 */
export class Toasts {
  private items: { text: Phaser.GameObjects.Text; born: number; msg: string; count: number }[] = [];
  private area = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private scene: Phaser.Scene) {}

  /** Faixa da barra superior reservada para os avisos. */
  setArea(x: number, y: number, w: number, h: number): void {
    this.area = { x, y, w, h };
    this.layout();
  }

  show(msg: string, color = '#fff8e7'): void {
    const now = this.scene.time.now;
    const dup = this.items.find((i) => i.msg === msg);
    if (dup) {
      dup.born = now;
      dup.count++;
      dup.text.setText(`${msg} ×${dup.count}`).setAlpha(1);
      this.items = [...this.items.filter((i) => i !== dup), dup];
    } else {
      const text = this.scene.add.text(0, 0, msg, textStyle(17, color)).setOrigin(0.5).setDepth(900);
      this.items.push({ text, born: now, msg, count: 1 });
      if (this.items.length > MAX) this.items.shift()!.text.destroy();
      this.scene.tweens.add({ targets: text, alpha: { from: 0, to: 1 }, duration: 160 });
    }
    this.layout();
  }

  private layout(): void {
    const { x, y, w, h } = this.area;
    const n = this.items.length;
    this.items.forEach((it, i) => {
      // duas linhas: fonte menor para caber na faixa de tábuas
      it.text.setFontSize(n > 1 ? 15 : 17).setScale(1);
      if (it.text.width > w) it.text.setScale(w / it.text.width);
      it.text.setPosition(x + w / 2, n > 1 ? y + (h / 4) * (1 + 2 * i) : y + h / 2);
    });
  }

  update(now: number): void {
    let changed = false;
    this.items = this.items.filter((it) => {
      const age = now - it.born;
      if (age > LIFE) {
        it.text.destroy();
        changed = true;
        return false;
      }
      if (age > LIFE - FADE) it.text.setAlpha((LIFE - age) / FADE);
      return true;
    });
    if (changed) this.layout();
  }
}
