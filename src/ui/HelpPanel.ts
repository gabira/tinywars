import Phaser from 'phaser';
import { COLORS } from '../config';
import { BUILDINGS } from '../data/buildings';
import { RES_TYPES, type Cost } from '../data/types';
import type { CardButton, IconSpec } from '../game/commandCard';
import type { Session } from '../game/Session';
import { S, fmt } from '../i18n/t';
import { iconFor, RES_ICON } from './icons';
import { darkPaper, slot, textStyle } from './widgets';

interface Help {
  icon: IconSpec;
  title: string;
  hotkey?: string;
  desc: string;
  cost?: Cost;
  time?: number;
  pop?: number;
  /** Instrução do modo atual (posicionar construção, atacar e mover). */
  hint?: string;
}

/**
 * Dica do botão sob o mouse ou do modo atual, desenhada por cima do painel de seleção,
 * dentro do HUD (papel escuro com cantos dourados).
 */
export class HelpPanel {
  private root: Phaser.GameObjects.Container;
  private sig = '';
  private x = 0;
  private y = 0;
  private w = 0;
  private h = 0;

  constructor(
    private scene: Phaser.Scene,
    private session: Session,
  ) {
    this.root = scene.add.container(0, 0).setVisible(false);
  }

  layout(x: number, y: number, w: number, h: number): void {
    Object.assign(this, { x, y, w, h });
    this.sig = '';
  }

  /** Atualiza a dica; devolve true se ela está cobrindo o painel de seleção. */
  update(hovered: CardButton | null): boolean {
    const help = this.current(hovered);
    const res = this.session.world.players[0].res;
    const sig = help
      ? `${this.x},${this.y},${this.w}|${help.title}|${help.desc}|${help.hint ?? ''}|` +
        RES_TYPES.map((r) => (res[r] >= (help.cost?.[r] ?? 0) ? 1 : 0)).join('')
      : '';
    if (sig !== this.sig) {
      this.sig = sig;
      this.rebuild(help);
    }
    return !!help;
  }

  private current(b: CardButton | null): Help | null {
    if (b) return { icon: b.icon, title: b.name, hotkey: b.hotkey === 'ESC' ? 'Esc' : b.hotkey, desc: b.desc, cost: b.cost, time: b.time, pop: b.pop };
    const s = this.session;
    if (s.mode === 'place' && s.placing) {
      const id = s.placing;
      return { icon: { kind: 'building', id }, title: fmt(S.hud.placing, { name: S.buildings[id].name }), desc: S.buildings[id].desc, cost: BUILDINGS[id].cost, hint: S.hud.placeHelp };
    }
    if (s.mode === 'attackMove') return { icon: { kind: 'image', key: 'icon_05' }, title: S.cmd.attackMove, desc: S.cmdDesc.attackMove, hint: S.hud.attackMoveHelp };
    return null;
  }

  private rebuild(help: Help | null): void {
    this.root.removeAll(true);
    this.root.setVisible(!!help);
    if (!help) return;
    const { scene, x, y, w, h } = this;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.root.add(o);
      return o;
    };
    add(darkPaper(scene, x, y, w, h));
    const pad = 14;
    const size = Math.min(76, h - pad * 2);
    add(slot(scene, x + pad, y + (h - size) / 2, size, size));
    const icon = iconFor(scene, help.icon, x + pad + size / 2, y + h / 2 - 1, size - 14);
    if (icon) add(icon);

    const tx = x + pad + size + 14;
    const tw = x + w - pad - tx;
    let ty = y + pad - 2;
    const title = add(scene.add.text(tx, ty, help.title, textStyle(19, COLORS.gold)));
    if (help.hotkey) {
      add(scene.add.text(x + w - pad, ty + 2, fmt(S.tooltip.hotkey, { key: help.hotkey }), textStyle(14, '#c8e6ff')).setOrigin(1, 0));
    }
    ty += title.height + 2;
    if (help.desc) {
      const desc = add(scene.add.text(tx, ty, help.desc, { ...textStyle(15), wordWrap: { width: tw } }));
      ty += desc.height + 6;
    }

    // custo com os ícones de recurso (vermelho quando falta), tempo e população
    const res = this.session.world.players[0].res;
    let cx = tx;
    const rowY = ty + 12;
    let row = false;
    for (const r of RES_TYPES) {
      const v = help.cost?.[r];
      if (!v) continue;
      add(scene.add.image(cx + 11, rowY, RES_ICON[r]).setDisplaySize(24, 24));
      const t = add(scene.add.text(cx + 26, rowY, `${v}`, textStyle(16, res[r] >= v ? COLORS.text : COLORS.bad)).setOrigin(0, 0.5));
      cx += 26 + t.width + 14;
      row = true;
    }
    const extra = [help.time ? fmt(S.tooltip.time, { s: help.time }) : '', help.pop ? fmt(S.tooltip.pop, { n: help.pop }) : ''].filter(Boolean).join('   ');
    if (extra) {
      add(scene.add.text(cx + (row ? 4 : 0), rowY, extra, textStyle(14, '#e8dcc0')).setOrigin(0, 0.5));
      row = true;
    }
    if (row) ty = rowY + 16;
    if (help.hint) add(scene.add.text(tx, Math.max(ty + 2, y + h - pad - 18), help.hint, { ...textStyle(14, '#c8e6ff'), wordWrap: { width: tw } }));
  }
}
