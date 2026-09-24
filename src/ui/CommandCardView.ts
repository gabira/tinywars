import Phaser from 'phaser';
import { COLORS } from '../config';
import { RES_TYPES } from '../data/types';
import { cardSignature, commandCard, type CardButton } from '../game/commandCard';
import type { Session } from '../game/Session';
import { S, fmt } from '../i18n/t';
import { iconFor } from './icons';
import { textStyle, woodPanel } from './widgets';

const SIZE = 50;
const GAP = 5;
export const CARD_W = SIZE * 3 + GAP * 2;

/** Grade 3x3 de botões de comando + tooltip. */
export class CommandCardView {
  private root: Phaser.GameObjects.Container;
  private tip: Phaser.GameObjects.Container;
  private sig = '';
  private x = 0;
  private y = 0;

  constructor(
    private scene: Phaser.Scene,
    private session: Session,
  ) {
    this.root = scene.add.container(0, 0);
    this.tip = scene.add.container(0, 0).setDepth(1000).setVisible(false);
  }

  layout(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.sig = '';
  }

  update(): void {
    const buttons = commandCard(this.session);
    const sig = `${this.x},${this.y}|${cardSignature(this.session, buttons)}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.root.removeAll(true);
    this.tip.setVisible(false);
    for (const b of buttons) this.button(b);
  }

  private button(b: CardButton): void {
    const col = b.slot % 3;
    const row = Math.floor(b.slot / 3);
    const cx = this.x + col * (SIZE + GAP) + SIZE / 2;
    const cy = this.y + row * (SIZE + GAP) + SIZE / 2;
    // botão quadrado do Free Pack (área útil de 90 px no quadro de 128)
    const scale = (SIZE + 4) / 90;
    const bg = this.scene.add.image(cx, cy, 'ui_btn_sq_blue').setScale(scale).setInteractive({ useHandCursor: true });
    const tint = () => (b.active ? bg.setTint(0xfff0a0) : b.enabled ? bg.clearTint() : bg.setTint(0x9a9a9a));
    tint();
    this.root.add(bg);
    const icon = iconFor(this.scene, b.icon, cx, cy - 2, SIZE - 16);
    if (icon) {
      if (!b.enabled) icon.setAlpha(0.55);
      this.root.add(icon);
    }
    if (b.hotkey && b.hotkey !== 'ESC') {
      this.root.add(this.scene.add.text(cx + SIZE / 2 - 5, cy + SIZE / 2 - 7, b.hotkey, textStyle(12)).setOrigin(1, 1));
    }
    bg.on('pointerover', () => {
      bg.setScale(scale * 1.06);
      this.showTip(b, cx, cy);
    });
    bg.on('pointerout', () => {
      bg.setScale(scale).setTexture('ui_btn_sq_blue');
      tint();
      this.tip.setVisible(false);
    });
    bg.on('pointerdown', () => bg.setTexture('ui_btn_sq_blue_p'));
    bg.on('pointerup', () => {
      bg.setTexture('ui_btn_sq_blue');
      b.action();
      this.session.ui.emit('selection');
    });
  }

  private showTip(b: CardButton, bx: number, by: number): void {
    this.tip.removeAll(true);
    const lines: { text: string; color?: string; size?: number }[] = [{ text: b.name, size: 18, color: COLORS.gold }];
    if (b.desc) lines.push({ text: b.desc });
    const player = this.session.world.players[0];
    if (b.cost) {
      const parts = RES_TYPES.filter((r) => b.cost![r]).map((r) => ({ r, v: b.cost![r]! }));
      if (parts.length) {
        const ok = parts.every((p) => player.res[p.r] >= p.v);
        lines.push({
          text: fmt(S.tooltip.cost, { cost: parts.map((p) => `${p.v} ${S.res[p.r]}`).join(', ') }),
          color: ok ? '#fff8e7' : COLORS.bad,
        });
      }
    }
    if (b.time) lines.push({ text: fmt(S.tooltip.time, { s: b.time }) });
    if (b.pop) lines.push({ text: fmt(S.tooltip.pop, { n: b.pop }) });
    if (b.hotkey && b.hotkey !== 'ESC') lines.push({ text: fmt(S.tooltip.hotkey, { key: b.hotkey }), color: '#c8e6ff' });

    const texts = lines.map((l, i) =>
      this.scene.add.text(12, 10 + i * 22, l.text, { ...textStyle(l.size ?? 15, l.color), wordWrap: { width: 280 } }),
    );
    // reposiciona considerando quebras de linha
    let yy = 10;
    for (const t of texts) {
      t.setY(yy);
      yy += t.height + 2;
    }
    const w = Math.max(...texts.map((t) => t.width)) + 24;
    const h = yy + 8;
    const panel = woodPanel(this.scene, -6, -6, w + 12, h + 12, 0.35);
    this.tip.add([panel, ...texts]);
    const { width } = this.scene.scale;
    const tx = Math.min(width - w - 8, bx - w / 2);
    const ty = by - SIZE / 2 - h - 10 - (by - this.y);
    this.tip.setPosition(Math.max(8, tx), ty).setVisible(true);
  }
}
