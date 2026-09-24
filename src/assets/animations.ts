import Phaser from 'phaser';
import { allSheets } from './assetManifest';

/** Cria as animações de todas as spritesheets carregadas: chave `${sheet}.${anim}`. */
export function registerAnimations(scene: Phaser.Scene): void {
  for (const s of allSheets()) {
    if (!s.anims || !scene.textures.exists(s.key)) continue;
    const tex = scene.textures.get(s.key);
    const cols = Math.floor(tex.getSourceImage().width / s.frameWidth);
    for (const [name, a] of Object.entries(s.anims)) {
      const key = `${s.key}.${name}`;
      if (scene.anims.exists(key)) continue;
      const start = a.row * cols + (a.startCol ?? 0);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(s.key, { start, end: start + a.frames - 1 }),
        frameRate: a.fps ?? 10,
        repeat: a.repeat ?? -1,
      });
    }
  }
}

/** Ícone preferido (Free Pack) com alternativa da versão antiga. */
export function iconKey(scene: Phaser.Scene, preferred: string, fallback: string): string {
  return scene.textures.exists(preferred) ? preferred : fallback;
}
