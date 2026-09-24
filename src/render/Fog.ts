import Phaser from 'phaser';
import { TILE } from '../config';
import type { World } from '../systems/World';

/** Névoa de guerra: textura de 1 px por tile, ampliada com filtro linear (bordas suaves). */
export class Fog {
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private image: Phaser.GameObjects.Image | null = null;
  private version = -1;
  private imgData: ImageData | null = null;

  constructor(
    scene: Phaser.Scene,
    private world: World,
  ) {
    if (!world.vision.enabled) return;
    const { w, h } = world.map;
    if (scene.textures.exists('fog')) scene.textures.remove('fog');
    this.tex = scene.textures.createCanvas('fog', w, h);
    if (!this.tex) return;
    this.tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.imgData = this.tex.context.createImageData(w, h);
    // cada pixel vira um tile; com filtro linear o centro do pixel cai no centro do tile
    this.image = scene.add.image(0, 0, 'fog').setOrigin(0).setScale(TILE).setDepth(5e5);
  }

  update(): void {
    if (!this.tex || !this.imgData) return;
    const v = this.world.vision;
    if (v.version === this.version) return;
    this.version = v.version;
    const d = this.imgData.data;
    const n = v.visible.length;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      d[o] = 12;
      d[o + 1] = 14;
      d[o + 2] = 24;
      d[o + 3] = v.visible[i] ? 0 : v.explored[i] ? 120 : 255;
    }
    this.tex.context.putImageData(this.imgData, 0, 0);
    this.tex.refresh();
    // o refresh recria a textura na GPU: reaplica o filtro suave
    this.tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  destroy(): void {
    this.image?.destroy();
  }
}
