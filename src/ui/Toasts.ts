import Phaser from 'phaser';
import { HUD_TOP } from '../config';
import { textStyle } from './widgets';

/** Mensagens curtas no topo da tela. */
export class Toasts {
  private items: { text: Phaser.GameObjects.Text; born: number; msg: string }[] = [];

  constructor(private scene: Phaser.Scene) {}

  show(msg: string, color = '#fff8e7'): void {
    const now = this.scene.time.now;
    // evita repetir a mesma mensagem em sequência
    const dup = this.items.find((i) => i.msg === msg);
    if (dup) {
      dup.born = now;
      dup.text.setAlpha(1);
      return;
    }
    const t = this.scene.add.text(this.scene.scale.width / 2, 0, msg, textStyle(18, color)).setOrigin(0.5, 0).setDepth(900);
    this.items.push({ text: t, born: now, msg });
    if (this.items.length > 4) this.items.shift()!.text.destroy();
    this.layout();
  }

  private layout(): void {
    this.items.forEach((it, i) => it.text.setPosition(this.scene.scale.width / 2, HUD_TOP + 10 + i * 26));
  }

  update(now: number): void {
    let changed = false;
    this.items = this.items.filter((it) => {
      const age = now - it.born;
      if (age > 3500) {
        it.text.destroy();
        changed = true;
        return false;
      }
      if (age > 2800) it.text.setAlpha(1 - (age - 2800) / 700);
      return true;
    });
    if (changed) this.layout();
  }

  relayout(): void {
    this.layout();
  }
}
