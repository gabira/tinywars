import Phaser from 'phaser';
import { FONT } from '../config';
import { S } from '../i18n/t';

/** Mostrada quando `npm run assets` ainda não foi executado. */
export class MissingAssetsScene extends Phaser.Scene {
  constructor() {
    super('MissingAssets');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#2b1d12');
    this.add
      .text(width / 2, height / 2 - 120, S.missing.title, { fontFamily: FONT, fontSize: '36px', color: '#f7d154' })
      .setOrigin(0.5);
    S.missing.lines.forEach((line, i) => {
      const isCmd = line.startsWith('npm');
      this.add
        .text(width / 2, height / 2 - 50 + i * 30, line, {
          fontFamily: isCmd ? 'monospace' : FONT,
          fontSize: isCmd ? '24px' : '20px',
          color: isCmd ? '#7cff7c' : '#fff8e7',
        })
        .setOrigin(0.5);
    });
  }
}
