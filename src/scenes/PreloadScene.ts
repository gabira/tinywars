import Phaser from 'phaser';
import { IMAGES, SHEETS } from '../assets/assetManifest';
import { registerAnimations } from '../assets/animations';
import { DEBUG, FONT } from '../config';
import { S } from '../i18n/t';

interface AssetIndex {
  packs: Record<string, { files: Record<string, [number, number]> }>;
}

/** Carrega o índice gerado por `npm run assets` e depois todas as texturas do manifesto. */
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
    const index = this.cache.json.get('assets-index') as AssetIndex | undefined;
    if (!index || this.registry.get('missingAssets')) {
      this.scene.start('MissingAssets');
      return;
    }
    const has = (pack: string, path: string) => !!index.packs[pack]?.files[path];
    const url = (pack: string, path: string) => encodeURI(`assets/${pack}/${path}`);
    const missing: string[] = [];

    for (const s of SHEETS) {
      if (!has(s.pack, s.path)) {
        if (!s.optional) missing.push(s.path);
        continue;
      }
      const [w, h] = index.packs[s.pack].files[s.path];
      if (w % s.frameWidth || h % s.frameHeight) console.warn(`[assets] ${s.path}: ${w}x${h} não divide em ${s.frameWidth}x${s.frameHeight}`);
      this.load.spritesheet(s.key, url(s.pack, s.path), { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
    for (const i of IMAGES) {
      if (!has(i.pack, i.path)) {
        if (!i.optional) missing.push(i.path);
        continue;
      }
      this.load.image(i.key, url(i.pack, i.path));
    }
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
