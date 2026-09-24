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
    ui.add(ribbon(this, width / 2, height / 2 - 250, 420, S.game.title, this.color, 40));
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
  /** Desenha uma ilha com espuma, árvores e os dois reinos (nas cores escolhidas). */
  private drawIsland(cx: number, cy: number, tw: number, th: number): void {
    const x0 = Math.round(cx - (tw * TILE) / 2);
    const y0 = Math.round(cy - (th * TILE) / 2);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < tw && y < th;
    for (let y = 0; y < th; y++)
      for (let x = 0; x < tw; x++) {
        const px = x0 + x * TILE + TILE / 2;
        const py = y0 + y * TILE + TILE / 2;
        if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))
          this.add.sprite(px, py, 'foam').play({ key: 'foam.play', startFrame: (x * 3 + y * 5) % 16 }).setDepth(-60);
        this.add.image(px, py, 'tiles_main', autotileIndex(inside, x, y, GRASS_BASE)).setDepth(-50);
      }
    const p = this.color;
    const ai = aiColorFor(p);
    const at = (tx: number, ty: number) => ({ x: x0 + tx * TILE, y: y0 + ty * TILE });
    const put = (key: string, tx: number, ty: number, flip = false, oy = 0.7) => {
      const pos = at(tx, ty);
      const anim = `${key}.play`;
      const s = this.add.sprite(pos.x, pos.y, key).setOrigin(0.5, oy).setDepth(pos.y).setFlipX(flip);
      if (this.anims.exists(anim)) s.play({ key: anim, startFrame: Math.floor(Math.random() * this.anims.get(anim).frames.length) });
      return s;
    };
    // reino do jogador (à esquerda) e reino rival (à direita)
    put(`castle_${p}`, 2.7, 3.4, false, 248 / 256);
    put(`house1_${p}`, 5.2, 1.9, false, 172 / 192);
    put(`archery_${ai}`, 15.2, 3.0, false, 239 / 256);
    put(`tower_${ai}`, 17.1, 3.9, false, 229 / 256);
    for (const [n, tx, ty] of [
      [1, 0.7, 1.4],
      [2, 1.5, 1.0],
      [3, 17.3, 6.3],
      [4, 16.3, 6.7],
      [3, 0.8, 6.5],
    ] as const)
      put(`tree${n}`, tx, ty, false, n <= 2 ? 0.94 : 0.88);
    put(`warrior_${p}_idle`, 4.9, 5.0);
    put(`lancer_${p}_idle`, 3.7, 6.1, false, 197 / 320);
    put(`pawn_${p}_idle_axe`, 1.9, 5.3);
    put(`monk_${p}_idle`, 5.6, 6.3);
    put(`warrior_${ai}_idle`, 13.3, 5.1, true);
    put(`archer_${ai}_idle`, 14.5, 6.1, true);
    put(`lancer_${ai}_idle`, 15.7, 5.4, true, 197 / 320);
    put('sheep_grass', 2.6, 6.8, false, 0.66);
    put('gold_stone4', 7.2, 6.3, false, 0.7);
    put('bush1', 6.8, 1.3, false, 0.61);
    put('bush2', 12.4, 6.9, false, 0.61);
  }
}
