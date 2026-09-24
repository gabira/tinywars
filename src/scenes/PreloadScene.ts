import Phaser from 'phaser';
import { registerAnimations } from '../assets/animations';
import { queueBaseAssets, queueTeamAssets } from '../assets/loader';
import { DEBUG, FONT } from '../config';
import { loadColor } from '../game/prefs';
import { S } from '../i18n/t';
import { aiColorFor, TEAM_COLORS } from '../render/palette';

/**
 * Carrega o índice gerado por `npm run assets`, as texturas comuns e as das cores
 * escolhidas no menu. As demais cores são carregadas só quando escolhidas.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.load.json('assets-index', 'assets/assets-index.json');
    this.load.once('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === 'assets-index') this.registry.set('missingAssets', true);
    });
  }

  create(): void {
    if (!this.cache.json.get('assets-index') || this.registry.get('missingAssets')) {
      this.scene.start('MissingAssets');
      return;
    }
    const player = loadColor();
    // ?debug=anims mostra todas as cores
    const colors = DEBUG.anims ? TEAM_COLORS : [player, aiColorFor(player)];
    const missing = [...queueBaseAssets(this).missing, ...queueTeamAssets(this, colors).missing];
    if (missing.length) console.warn('[assets] ausentes:', missing);
    if (missing.length > 10) {
      this.scene.start('MissingAssets');
      return;
    }

    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height / 2 - 30, S.game.loading, { fontFamily: FONT, fontSize: '28px', color: '#fff8e7' }).setOrigin(0.5);
    const barBg = this.add.rectangle(width / 2, height / 2 + 10, 320, 16, 0x2b1d12).setOrigin(0.5);
    const bar = this.add.rectangle(width / 2 - 158, height / 2 + 10, 0, 12, 0xf7d154).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => (bar.width = 316 * p));
    this.load.once('complete', () => {
      label.destroy();
      barBg.destroy();
      bar.destroy();
      registerAnimations(this);
      this.scene.start(DEBUG.anims ? 'DebugAnim' : 'Menu');
    });
    this.load.start();
  }
}
