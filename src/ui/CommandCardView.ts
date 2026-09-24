import Phaser from 'phaser';
import { cardSignature, commandCard, type CardButton } from '../game/commandCard';
import type { Session } from '../game/Session';
import { iconFor } from './icons';
import { slot, textStyle } from './widgets';

const SIZE = 48;
const GAP = 6;
export const CARD_W = SIZE * 3 + GAP * 2;
export const CARD_H = CARD_W;

/** Área útil dos botões quadrados do Free Pack (90 px no quadro de 128). */
const BTN_CONTENT = 90;

/**
 * Grade 3x3 de botões de comando. Cada casa é uma fenda de madeira (as vazias continuam
 * visíveis); a dica do botão sob o mouse aparece dentro do HUD, no painel central.
 */
export class CommandCardView {
  private cells: Phaser.GameObjects.Container;
  private root: Phaser.GameObjects.Container;
  private sig = '';
  private x = 0;
  private y = 0;
  /** Botão sob o mouse (para o painel de ajuda). */
  hovered: CardButton | null = null;

  constructor(
    private scene: Phaser.Scene,
    private session: Session,
  ) {
    this.cells = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0);
  }

  layout(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.sig = '';
    this.cells.removeAll(true);
    for (let i = 0; i < 9; i++) {
      const cx = x + (i % 3) * (SIZE + GAP);
      const cy = y + Math.floor(i / 3) * (SIZE + GAP);
      this.cells.add(slot(this.scene, cx - 1, cy - 1, SIZE + 2, SIZE + 2).setAlpha(0.9));
    }
  }

  update(): void {
    const buttons = commandCard(this.session);
    const sig = `${this.x},${this.y}|${cardSignature(this.session, buttons)}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.root.removeAll(true);
    // mantém a dica se o mesmo botão continua no lugar (ex.: custo ficou acessível)
    const h = this.hovered;
    this.hovered = h ? (buttons.find((b) => b.slot === h.slot && b.name === h.name) ?? null) : null;
    for (const b of buttons) this.button(b);
  }

  private button(b: CardButton): void {
    const cx = this.x + (b.slot % 3) * (SIZE + GAP) + SIZE / 2;
    const cy = this.y + Math.floor(b.slot / 3) * (SIZE + GAP) + SIZE / 2;
    const tex = b.danger ? 'ui_btn_sq_red' : 'ui_btn_sq_blue';
    const scale = SIZE / BTN_CONTENT;
    const bg = this.scene.add.image(cx, cy, tex).setScale(scale).setInteractive({ useHandCursor: true });
    const tint = () => (b.active ? bg.setTint(0xfff0a0) : b.enabled ? bg.clearTint() : bg.setTint(0x8c8c8c));
    tint();
    this.root.add(bg);
    const icon = iconFor(this.scene, b.icon, cx, cy - 2, SIZE - 14);
    if (icon) {
      if (!b.enabled) icon.setAlpha(0.5);
      this.root.add(icon);
    }
    if (b.hotkey && b.hotkey !== 'ESC') {
      const badge = this.scene.add.rectangle(cx + SIZE / 2 - 3, cy + SIZE / 2 - 3, 15, 15, 0x2b1d12, 0.85).setOrigin(1, 1);
      const key = this.scene.add.text(cx + SIZE / 2 - 10.5, cy + SIZE / 2 - 10.5, b.hotkey, textStyle(11, '#fff8e7', false)).setOrigin(0.5);
      this.root.add([badge, key]);
    }
    bg.on('pointerover', () => {
      bg.setScale(scale * 1.05);
      this.hovered = b;
    });
    bg.on('pointerout', () => {
      bg.setScale(scale).setTexture(tex);
      if (icon) icon.y = cy - 2;
      tint();
      if (this.hovered === b) this.hovered = null;
    });
    bg.on('pointerdown', () => {
      bg.setTexture(`${tex}_p`);
      if (icon) icon.y = cy + 2;
    });
    bg.on('pointerup', () => {
      bg.setTexture(tex);
      if (icon) icon.y = cy - 2;
      b.action();
      this.session.ui.emit('selection');
    });
  }
}
