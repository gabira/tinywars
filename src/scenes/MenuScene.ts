import Phaser from 'phaser';
import { loadTeamAssets } from '../assets/loader';
import { DEBUG, TILE } from '../config';
import { DIFFICULTY_ORDER, type DifficultyLevel } from '../data/difficulty';
import { loadColor, loadDifficulty, saveColor, saveDifficulty } from '../game/prefs';
import { autotileIndex, GRASS_BASE } from '../map/autotile';
import { S, fmt } from '../i18n/t';
import { aiColorFor, TEAM_COLORS, type TeamColor } from '../render/palette';
import { ribbon, scrollPanel, textButton, textStyle, darkText } from '../ui/widgets';

/** Menu principal com uma pequena ilha animada ao fundo (nas cores escolhidas). */
export class MenuScene extends Phaser.Scene {
  private difficulty: DifficultyLevel = 'normal';
  private color: TeamColor = 'blue';
  private overlay: Phaser.GameObjects.Container | null = null;
  private loadingColor = false;
  /** "Novo Jogo" clicado enquanto as texturas da cor carregavam: começa ao terminar. */
  private startWhenReady = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.difficulty = loadDifficulty();
    this.color = loadColor();
    // garante as texturas das cores salvas (normalmente já vêm do Preload)
    loadTeamAssets(this, [this.color, aiColorFor(this.color)], () => this.build());
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  private rebuild(): void {
    this.children.removeAll(true);
    this.overlay = null;
    this.build();
  }

  private build(): void {
    const { width, height } = this.scale;
    this.add.tileSprite(0, 0, width, height, 'water').setOrigin(0).setDepth(-100);
    this.drawIsland(width / 2, height / 2 + 30, 18, 7);

    const ui = this.add.container(0, 0).setDepth(1000);
    ui.add(ribbon(this, width / 2, height / 2 - 250, 420, S.game.title, 'blue', 40));
    ui.add(this.add.text(width / 2, height / 2 - 200, S.game.subtitle, textStyle(22)).setOrigin(0.5));

    const bx = width / 2;
    const step = 62;
    let by = height / 2 - 110;
    ui.add(textButton(this, bx, by, 320, S.menu.newGame, () => this.startGame()));
    by += step;
    const colorBtn = textButton(this, bx, by, 320, this.colorLabel(), () => this.nextColor(colorBtn));
    ui.add(colorBtn);
    by += step;
    const diffBtn = textButton(this, bx, by, 320, this.diffLabel(), () => {
      const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
      this.difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
      saveDifficulty(this.difficulty);
      diffBtn.setLabel(this.diffLabel());
    });
    ui.add(diffBtn);
    by += step;
    ui.add(textButton(this, bx, by, 320, S.menu.howToPlay, () => this.showPanel(S.menu.howToPlay, S.howTo, 900)));
    by += step;
    ui.add(textButton(this, bx, by, 320, S.menu.credits, () => this.showPanel(S.menu.credits, S.credits, 560)));

    this.input.keyboard?.off('keydown-ENTER');
    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
  }

  private diffLabel(): string {
    return fmt(S.menu.difficulty, { level: S.difficulty[this.difficulty] });
  }

  private colorLabel(): string {
    return fmt(S.menu.color, { color: S.colors[this.color] });
  }

  /** Próxima cor; carrega as texturas dela (se preciso) e redesenha a ilha. */
  private nextColor(btn: { setLabel(s: string): void }): void {
    if (this.loadingColor) return;
    const i = TEAM_COLORS.indexOf(this.color);
    this.color = TEAM_COLORS[(i + 1) % TEAM_COLORS.length];
    saveColor(this.color);
    btn.setLabel(this.colorLabel());
    this.loadingColor = true;
    loadTeamAssets(this, [this.color, aiColorFor(this.color)], () => {
      this.loadingColor = false;
      if (this.startWhenReady) this.startGame();
      else this.rebuild();
    });
  }

  private startGame(): void {
    if (this.loadingColor) {
      this.startWhenReady = true;
      return;
    }
    const seed = DEBUG.seed ?? Math.floor(Math.random() * 1e9);
    this.scene.start('Game', { seed, difficulty: this.difficulty, color: this.color });
  }

  private showPanel(title: string, lines: readonly string[], w: number): void {
    this.overlay?.destroy();
    const { width, height } = this.scale;
    const pw = Math.min(w, width - 32);
    const c = this.add.container(0, 0).setDepth(2000);
    const shade = this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0).setInteractive();
    // mede o texto primeiro e diminui a fonte até caber na tela
    let size = 18;
    let body = this.add.text(0, 0, '', darkText(size));
    for (;;) {
      body.destroy();
      body = this.add
        .text(width / 2, 0, lines.join('\n'), { ...darkText(size), align: 'center', lineSpacing: 5, wordWrap: { width: pw - 110 } })
        .setOrigin(0.5, 0);
      if (body.height + 190 <= height - 24 || size <= 12) break;
      size -= 1;
    }
    const h = Math.min(height - 24, body.height + 190);
    body.setY(height / 2 - h / 2 + 72);
    const panel = scrollPanel(this, width / 2, height / 2, pw, h);
    const t = ribbon(this, width / 2, height / 2 - h / 2 + 8, 360, title, 'yellow', 26);
    const back = textButton(this, width / 2, height / 2 + h / 2 - 56, 200, S.menu.back, () => {
      c.destroy();
      this.overlay = null;
    });
    c.add([shade, panel, t, body, back]);
    this.overlay = c;
  }

  /** Desenha uma ilha retangular com espuma, árvores e algumas unidades animadas. */
  private drawIsland(cx: number, cy: number, tw: number, th: number): void {
    const x0 = Math.round(cx - (tw * TILE) / 2);
    const y0 = Math.round(cy - (th * TILE) / 2);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < tw && y < th;
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const px = x0 + x * TILE + TILE / 2;
        const py = y0 + y * TILE + TILE / 2;
        if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))
          this.add.sprite(px, py, 'foam').play('foam.play').setDepth(-60);
        this.add.image(px, py, 'tiles_flat', autotileIndex(inside, x, y, GRASS_BASE)).setDepth(-50);
      }
    const p = this.color;
    const ai = aiColorFor(p);
    const at = (tx: number, ty: number) => ({ x: x0 + tx * TILE, y: y0 + ty * TILE });
    const put = (key: string, tx: number, ty: number, anim?: string, flip = false, oy = 0.69) => {
      const p = at(tx, ty);
      const s = this.add.sprite(p.x, p.y, key).setOrigin(0.5, oy).setDepth(p.y).setFlipX(flip);
      if (anim) s.play({ key: anim, startFrame: Math.floor(Math.random() * (this.anims.get(anim)?.frames.length ?? 1)) });
      return s;
    };
    put(`castle_${p}`, 2.7, 3.4, undefined, false, 0.95);
    put('goblin_house', 14.4, 2.9, undefined, false, 0.95);
    put(`wood_tower_${ai}`, 16.2, 3.6, `wood_tower_${ai}.idle`, false, 0.95);
    for (const [tx, ty] of [
      [0.7, 1.3],
      [1.5, 0.9],
      [17.3, 6.1],
      [16.4, 6.6],
      [0.8, 6.4],
    ])
      put('tree', tx, ty, 'tree.idle', false, 0.88);
    put(`warrior_${p}`, 4.9, 5.0, `warrior_${p}.idle`);
    put(`archer_${p}`, 3.9, 5.9, `archer_${p}.idle`);
    put(`pawn_${p}`, 1.9, 5.3, `pawn_${p}.idle`);
    put(`torch_${ai}`, 13.4, 5.0, `torch_${ai}.idle`, true);
    put(`tnt_${ai}`, 14.5, 5.9, `tnt_${ai}.idle`, true);
    put(`barrel_${ai}`, 15.9, 5.3, `barrel_${ai}.hidden`, false, 0.77);
    put('sheep', 2.6, 6.5, 'sheep.idle', false, 0.66);
  }
}
