import Phaser from 'phaser';
import { TILE } from '../config';
import type { GameMap } from '../map/MapGenerator';
import { autotileIndex, cliffIndex, GRASS_BASE, PLATEAU_BASE } from '../map/autotile';
import { originY } from './visuals';

export interface TerrainHandle {
  /** Anima as nuvens (dt em segundos). */
  update(dt: number): void;
}

/** Desenha água, espuma, chão, manchas de grama, planaltos, decoração e nuvens. */
export function drawTerrain(scene: Phaser.Scene, map: GameMap): TerrainHandle {
  const { w, h } = map;
  const pad = 1024;
  scene.add
    .tileSprite(-pad, -pad, w * TILE + pad * 2, h * TILE + pad * 2, 'water')
    .setOrigin(0)
    .setDepth(-3000);

  const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const land = (x: number, y: number) => inB(x, y) && map.land[y * w + x] === 1;
  const patch = (x: number, y: number) => inB(x, y) && map.patch[y * w + x] === 1;
  const plateau = (x: number, y: number) => inB(x, y) && map.plateau[y * w + x] === 1;
  const cliff = (x: number, y: number) => inB(x, y) && map.cliff[y * w + x] === 1;

  // espuma animada sob os tiles de terra da costa
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!land(x, y)) continue;
      let coast = false;
      for (let dy = -1; dy <= 1 && !coast; dy++) for (let dx = -1; dx <= 1; dx++) if (!land(x + dx, y + dy)) coast = true;
      if (!coast) continue;
      scene.add
        .sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, 'foam')
        .play({ key: 'foam.play', startFrame: (x * 3 + y * 5) % 16 })
        .setDepth(-2500);
    }

  const tm = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: w, height: h });
  const main = tm.addTilesetImage('tiles_main', 'tiles_main', TILE, TILE, 0, 0);
  const alt = tm.addTilesetImage('tiles_alt', 'tiles_alt', TILE, TILE, 0, 0);
  const ground = main && tm.createBlankLayer('ground', main);
  const patches = alt && tm.createBlankLayer('patches', alt);
  const relief = main && tm.createBlankLayer('relief', main);
  if (ground && patches && relief) {
    ground.setDepth(-2000);
    patches.setDepth(-1995);
    relief.setDepth(-1985);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (land(x, y)) ground.putTileAt(autotileIndex(land, x, y, GRASS_BASE), x, y);
        if (patch(x, y) && !plateau(x, y) && !cliff(x, y)) patches.putTileAt(autotileIndex(patch, x, y, GRASS_BASE), x, y);
        if (plateau(x, y)) relief.putTileAt(autotileIndex(plateau, x, y, PLATEAU_BASE), x, y);
        else if (cliff(x, y)) relief.putTileAt(cliffIndex(cliff, x, y), x, y);
      }
  }
  // sombra suave dos planaltos projetada para baixo
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (cliff(x, y)) scene.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2 + 20, 'shadow').setAlpha(0.35).setDepth(-1990);

  for (const d of map.decor) {
    if (!scene.textures.exists(d.key)) continue;
    const px = d.tx * TILE + TILE / 2 + d.ox;
    const py = d.ty * TILE + TILE / 2 + d.oy;
    const animKey = `${d.key}.play`;
    if (scene.anims.exists(animKey)) {
      const frames = scene.anims.get(animKey).frames.length;
      const s = scene.add.sprite(px, py, d.key).play({ key: animKey, startFrame: (d.tx * 7 + d.ty) % frames });
      if (d.key === 'duck') {
        // patinho de borracha boiando
        s.setDepth(-2400).setScale(1.5);
        scene.tweens.add({ targets: s, y: py + 4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        scene.tweens.add({ targets: s, x: px + 40, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.InOut', onYoyo: () => s.toggleFlipX(), onRepeat: () => s.toggleFlipX() });
      } else if (d.key.startsWith('water_rock')) {
        s.setDepth(-2400);
      } else {
        s.setOrigin(0.5, originY(d.key) ?? 0.66).setDepth(py);
      }
    } else {
      // pedras: pequenas, ficam no chão
      scene.add.image(px, py, d.key).setOrigin(0.5, originY(d.key) ?? 0.8).setDepth(plateau(d.tx, d.ty) ? -1980 : py);
    }
  }

  // nuvens atravessando o mapa devagar
  const clouds: { img: Phaser.GameObjects.Image; speed: number }[] = [];
  const count = Math.max(4, Math.round((w * h) / 700));
  for (let i = 0; i < count; i++) {
    const img = scene.add
      .image(((i * 997) % w) * TILE, (((i * 613) % h) + 0.5) * TILE, `cloud${(i % 8) + 1}`)
      .setAlpha(0.32)
      .setDepth(4e5);
    clouds.push({ img, speed: 8 + (i % 5) * 3 });
  }
  const maxX = w * TILE + 400;
  return {
    update(dt: number) {
      for (const c of clouds) {
        c.img.x += c.speed * dt;
        if (c.img.x > maxX) c.img.x = -400;
      }
    },
  };
}
