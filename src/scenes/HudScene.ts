import Phaser from 'phaser';
import { COLORS, HUD_BOTTOM, HUD_TOP } from '../config';
import type { Team } from '../data/types';
import { getSession, type Session } from '../game/Session';
import { teamColor } from '../render/palette';
import { S, clockText, fmt } from '../i18n/t';
import { CARD_W, CommandCardView } from '../ui/CommandCardView';
import { Minimap } from '../ui/Minimap';
import { SelectionPanel } from '../ui/SelectionPanel';
import { Toasts } from '../ui/Toasts';
import { ribbon, scrollPanel, textButton, textStyle, woodPanel, darkText } from '../ui/widgets';
import type { GameScene } from './GameScene';

/** Interface por cima do mundo: recursos, minimapa, seleção, comandos, avisos e menus. */
export class HudScene extends Phaser.Scene {
  private s!: Session;
  private gameScene!: GameScene;
  private staticLayer!: Phaser.GameObjects.Container;
  private resTexts: Record<string, Phaser.GameObjects.Text> = {};
  private clock!: Phaser.GameObjects.Text;
  private minimap!: Minimap;
  private panel!: SelectionPanel;
  private card!: CommandCardView;
  private toasts!: Toasts;
  private modal: Phaser.GameObjects.Container | null = null;
  private modeHint!: Phaser.GameObjects.Text;

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
    this.card = new CommandCardView(this, this.s);
    this.toasts = new Toasts(this);
    this.modeHint = this.add.text(0, 0, '', textStyle(16, '#c8e6ff')).setOrigin(0.5, 1);
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
    this.staticLayer.removeAll(true);

    // barra superior
    const top = this.add.nineslice(0, 0, 'ui_carved3', undefined, W / 0.625, 64, 64, 64, 0, 0).setOrigin(0).setScale(0.625);
    this.staticLayer.add(top);
    const resIcons: [string, string, string][] = [
      ['gold', 'icon_gold', 'g_idle'],
      ['wood', 'icon_wood', 'w_idle'],
      ['meat', 'icon_meat', 'm_idle'],
    ];
    let x = 16;
    for (const [res, pref, fb] of resIcons) {
      const key = this.textures.exists(pref) ? pref : fb;
      const icon = this.add.image(x + 12, HUD_TOP / 2 - 2, key);
      icon.setScale((key === pref ? 30 : 46) / icon.width);
      const t = this.add.text(x + 30, HUD_TOP / 2 - 2, '', textStyle(18)).setOrigin(0, 0.5);
      this.staticLayer.add([icon, t]);
      this.resTexts[res] = t;
      x += 150;
    }
    const popIcon = this.add.image(x + 12, HUD_TOP / 2 - 2, `house_${teamColor(0)}`).setScale(0.2);
    const pop = this.add.text(x + 30, HUD_TOP / 2 - 2, '', textStyle(18)).setOrigin(0, 0.5);
    this.staticLayer.add([popIcon, pop]);
    this.resTexts.pop = pop;

    this.clock = this.add.text(W / 2, HUD_TOP / 2 - 2, '', textStyle(18)).setOrigin(0.5);
    this.staticLayer.add(this.clock);
    const menuBtn = this.add
      .image(W - 26, HUD_TOP / 2 - 1, 'ui_btn_blue')
      .setDisplaySize(34, 34)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.s.paused = true;
        this.togglePause(true);
      });
    const gear = this.add.image(W - 26, HUD_TOP / 2 - 3, this.textures.exists('icon_gear') ? 'icon_gear' : 'ui_icon_gear').setDisplaySize(24, 24);
    const menuLabel = this.add.text(W - 48, HUD_TOP / 2 - 2, S.menu.menu, textStyle(16)).setOrigin(1, 0.5);
    this.staticLayer.add([menuBtn, gear, menuLabel]);

    // painel inferior
    const py = H - HUD_BOTTOM;
    const bottom = woodPanel(this, 0, py, W, HUD_BOTTOM + 8, 0.5);
    this.staticLayer.add(bottom);
    this.staticLayer.sendToBack(bottom);
    this.minimap.setPosition(18, py + (HUD_BOTTOM - this.minimap.height) / 2);
    const cardX = W - CARD_W - 20;
    this.card.layout(cardX, py + (HUD_BOTTOM - CARD_W) / 2);
    const panelX = 18 + this.minimap.width + 24;
    this.panel.layout(panelX, py + 14, cardX - panelX - 20, HUD_BOTTOM - 24);
    this.modeHint.setPosition(W / 2, py - 8);
    this.toasts.relayout();
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
    this.resTexts.pop.setText(`${p.pop}/${p.popCap}`).setColor(p.pop >= p.popCap ? COLORS.bad : COLORS.text);
    this.clock.setText(clockText(w.time));
    this.minimap.update(time);
    this.panel.update();
    this.card.update();
    this.toasts.update(time);
    const s = this.s;
    const hint = s.mode === 'place' && s.placing ? S.buildings[s.placing].name : s.mode === 'attackMove' ? S.cmd.attackMove : '';
    this.modeHint.setText(hint ? `${hint} — ${S.cmd.cancel}: Esc / botão direito` : '');
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
    const title = ribbon(this, W / 2, H / 2 - 214, 340, won ? S.end.victory : S.end.defeat, won ? 'blue' : 'red', 34);
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
