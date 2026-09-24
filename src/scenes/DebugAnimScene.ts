import Phaser from 'phaser';
import { allSheets } from '../assets/assetManifest';
import { FONT } from '../config';

/** ?debug=anims — mostra todas as animações com o nome, para conferir as linhas das spritesheets. */
export class DebugAnimScene extends Phaser.Scene {
  constructor() {
    super('DebugAnim');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#5a8f4e');
    let x = 80;
    let y = 90;
    const colW = 150;
    const rowH = 150;
    const maxX = Math.max(900, this.scale.width - 80);
    for (const s of allSheets()) {
      if (!s.anims || !this.textures.exists(s.key)) continue;
      for (const name of Object.keys(s.anims)) {
        const key = `${s.key}.${name}`;
        const spr = this.add.sprite(x, y, s.key).setScale(s.frameWidth > 128 ? 0.7 : 1);
        spr.play({ key, repeat: -1, repeatDelay: 300 });
        this.add.text(x, y + 58, key, { fontFamily: FONT, fontSize: '12px', color: '#fff' }).setOrigin(0.5, 0);
        x += colW;
        if (x > maxX) {
          x = 80;
          y += rowH;
        }
      }
    }
    // rolar com a roda do mouse
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.cameras.main.scrollY = Math.max(0, this.cameras.main.scrollY + dy);
    });
  }
}
