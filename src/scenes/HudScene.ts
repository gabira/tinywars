import Phaser from 'phaser';
import { COLORS, HUD_BOTTOM, HUD_TOP } from '../config';
import type { Team } from '../data/types';
import { getSession, type Session } from '../game/Session';
import { teamColor } from '../render/palette';
import { S, clockText, fmt } from '../i18n/t';
import { CARD_H, CARD_W, CommandCardView } from '../ui/CommandCardView';
import { HelpPanel } from '../ui/HelpPanel';
import { Minimap } from '../ui/Minimap';
import { SelectionPanel } from '../ui/SelectionPanel';
import { Toasts } from '../ui/Toasts';
import { portrait, RES_ICON } from '../ui/icons';
import { darkText, hudPanel, ribbon, scrollPanel, slot, textButton } from '../ui/widgets';
import type { GameScene } from './GameScene';

/** Espessura visível das molduras da mesa de madeira (escala 0,5). */
const FRAME = { side: 14, top: 13, bottom: 19 };
/** Parte da barra superior escondida acima da tela (a moldura de cima fica de fora). */
const TOP_BLEED = 100 - HUD_TOP;

/**
 * Interface por cima do mundo, em duas mesas de madeira do Free Pack:
 * - barra superior: fichas de recursos, avisos no meio, relógio e menu;
 * - console inferior: minimapa, pergaminho com a seleção (ou a dica do botão/modo) e comandos.
 * Tudo fica dentro das molduras: nada flutua por cima do mapa.
 */
export class HudScene extends Phaser.Scene {
  private s!: Session;
  private gameScene!: GameScene;
  private staticLayer!: Phaser.GameObjects.Container;
  private resTexts: Record<string, Phaser.GameObjects.Text> = {};
  private clock!: Phaser.GameObjects.Text;
  private minimap!: Minimap;
  private panel!: SelectionPanel;
  private help!: HelpPanel;
  private card!: CommandCardView;
  private toasts!: Toasts;
  private modal: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.s = getSession();
    this.gameScene = this.scene.get('Game') as GameScene;
    this.staticLayer = this.add.container(0, 0);
    this.minimap = new Minimap(this, this.s, () =>
      this.gameScene.camCtl ? { cam: this.gameScene.cameras.main, ctl: this.gameScene.camCtl } : null,
    );
    this.panel = new SelectionPanel(this, this.s);
    this.help = new HelpPanel(this, this.s);
    this.card = new CommandCardView(this, this.s);
    this.toasts = new Toasts(this);
    this.layout();

    const ui = this.s.ui;
    ui.on('toast', (msg: string, color?: string) => this.toasts.show(msg, color));
    ui.on('pause', () => this.togglePause());
    ui.on('gameOver', (winner: Team) => this.showEnd(winner));
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      ui.removeAllListeners('toast');
      ui.removeAllListeners('pause');
      ui.removeAllListeners('gameOver');
      ui.removeAllListeners('alert');
    });
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    const layer = this.staticLayer;
    layer.removeAll(true);

    // ---- barra superior: só a moldura de baixo (com os cantos de metal) aparece
    layer.add(hudPanel(this, 0, -TOP_BLEED, W, TOP_BLEED + HUD_TOP));
    const beam = HUD_TOP - FRAME.bottom; // altura das tábuas visíveis
    const cy = Math.round(beam / 2);
    const chipH = beam - 6;
    let x = FRAME.side;
    const chip = (w: number): number => {
      layer.add(slot(this, x, cy - chipH / 2, w, chipH, 'paper'));
      const at = x;
      x += w + 8;
      return at;
    };
    for (const res of ['gold', 'wood', 'meat'] as const) {
      const at = chip(104);
      const t = this.add.text(at + 38, cy, '', darkText(19)).setOrigin(0, 0.5);
      layer.add([this.add.image(at + 18, cy, RES_ICON[res]).setDisplaySize(28, 28), t]);
      this.resTexts[res] = t;
    }
    const popAt = chip(104);
    const pop = this.add.text(popAt + 38, cy, '', darkText(19)).setOrigin(0, 0.5);
    layer.add([portrait(this, 'pawn', teamColor(0), popAt + 18, cy, 30), pop]);
    this.resTexts.pop = pop;
    const chipsEnd = x;

    // menu (botão redondo com engrenagem) e relógio à direita
    const menuX = W - FRAME.side - chipH / 2 - 2;
    const menuBtn = this.add
      .image(menuX, cy, 'ui_btn_tiny_round_blue')
      .setDisplaySize(chipH + 4, chipH + 4)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => menuBtn.setTint(0xd8f0ff))
      .on('pointerout', () => menuBtn.clearTint())
      .on('pointerup', () => {
        this.s.paused = true;
        this.togglePause(true);
      });
    const gear = this.add.image(menuX, cy - 1, 'icon_10').setDisplaySize(chipH - 8, chipH - 8);
    const clockW = 84;
    const clockX = menuX - chipH / 2 - 10 - clockW;
    layer.add(slot(this, clockX, cy - chipH / 2, clockW, chipH, 'paper'));
    this.clock = this.add.text(clockX + clockW / 2, cy, '', darkText(19)).setOrigin(0.5);
    layer.add([menuBtn, gear, this.clock]);

    // avisos no meio da barra
    this.toasts.setArea(chipsEnd + 8, 0, clockX - chipsEnd - 16, beam);

    // ---- console inferior: a moldura de baixo fica fora da tela
    const py = H - HUD_BOTTOM;
    layer.add(hudPanel(this, 0, py, W, HUD_BOTTOM + FRAME.bottom));
    // área útil: da moldura de cima até uma margem igual à das laterais
    const inTop = py + FRAME.top;
    const inH = H - FRAME.side + 1 - inTop;
    // minimapa numa fenda de madeira
    const mmW = this.minimap.width + 8;
    const mmH = this.minimap.height + 8;
    const mmX = FRAME.side;
    const mmY = inTop + Math.round((inH - mmH) / 2);
    layer.add(slot(this, mmX, mmY, mmW, mmH));
    this.minimap.setPosition(mmX + 4, mmY + 4);
    // comandos à direita
    const cardX = W - FRAME.side - CARD_W - 1;
    this.card.layout(cardX, inTop + Math.round((inH - CARD_H) / 2));
    // pergaminho no meio: seleção, ou a dica do botão / do modo atual (centralizado em telas largas)
    const room = cardX - 13 - (mmX + mmW + 12);
    const pw = Math.min(room, 780);
    const px = mmX + mmW + 12 + Math.round((room - pw) / 2);
    layer.add(slot(this, px, mmY, pw, mmH, 'paper'));
    this.panel.layout(px + 12, mmY + 10, pw - 24, mmH - 20);
    this.help.layout(px, mmY, pw, mmH);

    if (this.modal) {
      const winner = this.s.world.winner;
      this.modal.destroy();
      this.modal = null;
      if (winner !== null) this.showEnd(winner);
      else if (this.s.paused) this.togglePause(true);
    }
  }

  update(time: number): void {
    const w = this.s.world;
    const p = w.players[0];
    this.resTexts.gold.setText(`${p.res.gold}`);
    this.resTexts.wood.setText(`${p.res.wood}`);
    this.resTexts.meat.setText(`${p.res.meat}`);
    this.resTexts.pop.setText(`${p.pop}/${p.popCap}`).setColor(p.pop >= p.popCap ? '#b3261e' : COLORS.textDark);
    this.clock.setText(clockText(w.time));
    this.minimap.update(time);
    this.card.update();
    this.panel.setVisible(!this.help.update(this.card.hovered));
    this.panel.update();
    this.toasts.update(time);
  }

  // ---------------------------------------------------------------- menus

  private togglePause(force?: boolean): void {
    const show = force ?? this.s.paused;
    this.modal?.destroy();
    this.modal = null;
    if (!show || this.s.world.winner !== null) return;
    const { width: W, height: H } = this.scale;
    const c = this.add.container(0, 0).setDepth(2000);
    const shade = this.add.rectangle(0, 0, W, H, 0x000000, 0.5).setOrigin(0).setInteractive();
    const panel = scrollPanel(this, W / 2, H / 2, 420, 380);
    const title = ribbon(this, W / 2, H / 2 - 170, 300, S.menu.paused, 'yellow', 26);
    const diff = this.add
      .text(W / 2, H / 2 - 110, fmt(S.menu.difficulty, { level: S.difficulty[this.s.difficulty] }), darkText(18))
      .setOrigin(0.5);
    const b1 = textButton(this, W / 2, H / 2 - 50, 260, S.menu.resume, () => {
      this.s.paused = false;
      this.togglePause(false);
    });
    const b2 = textButton(this, W / 2, H / 2 + 20, 260, S.menu.restart, () => this.gameScene.restart());
    const b3 = textButton(this, W / 2, H / 2 + 90, 260, S.menu.quitToMenu, () => this.gameScene.quitToMenu(), 'red');
    c.add([shade, panel, title, diff, b1, b2, b3]);
    this.modal = c;
  }

  private showEnd(winner: Team): void {
    this.modal?.destroy();
    const { width: W, height: H } = this.scale;
    const w = this.s.world;
    const p = w.players[0];
    const won = winner === 0;
    const c = this.add.container(0, 0).setDepth(2000);
    const shade = this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive();
    const panel = scrollPanel(this, W / 2, H / 2, 460, 470);
    const title = ribbon(this, W / 2, H / 2 - 214, 340, won ? S.end.victory : S.end.defeat, teamColor(won ? 0 : 1), 34);
    const lines = [
      won ? S.end.victoryText : S.end.defeatText,
      '',
      fmt(S.end.time, { time: clockText(w.time) }),
      fmt(S.end.trained, { n: p.stats.trained }),
      fmt(S.end.lost, { n: p.stats.lost }),
      fmt(S.end.killed, { n: p.stats.killed }),
      fmt(S.end.gathered, { n: p.stats.gathered }),
    ];
    const body = this.add.text(W / 2, H / 2 - 150, lines.join('\n'), { ...darkText(18), align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0);
    const b1 = textButton(this, W / 2, H / 2 + 96, 280, S.menu.playAgain, () => this.gameScene.restart());
    const b2 = textButton(this, W / 2, H / 2 + 162, 280, S.menu.mainMenu, () => this.gameScene.quitToMenu(), 'red');
    c.add([shade, panel, title, body, b1, b2]);
    this.modal = c;
  }
}
