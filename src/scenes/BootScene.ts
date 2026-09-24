import Phaser from 'phaser';

/** Garante que a fonte pixel esteja carregada antes de desenhar textos. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const fonts = document.fonts;
    const ready = Promise.all([fonts.load('20px "Pixelify Sans"'), fonts.load('600 20px "Pixelify Sans"')]).catch(() => undefined);
    const timeout = new Promise((r) => setTimeout(r, 1500));
    Promise.race([ready, timeout]).then(() => this.scene.start('Preload'));
  }
}
