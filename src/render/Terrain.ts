import Phaser from 'phaser';
import { TILE } from '../config';
import type { GameMap } from '../map/MapGenerator';
import { autotileIndex, GRASS_BASE, SAND_BASE } from '../map/autotile';
import { originY } from './visuals';

/** Desenha água, espuma, grama/areia (tilemap) e decoração. */
export function drawTerrain(scene: Phaser.Scene, map: GameMap): void {
  const { w, h } = map;
  const pad = 1024;
  scene.add
    .tileSprite(-pad, -pad, w * TILE + pad * 2, h * TILE + pad * 2, 'water')
    .setOrigin(0)
    .setDepth(-3000);

  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && map.land[y * w + x] === 1;
  const sand = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && map.sand[y * w + x] === 1;

  // espuma sob os tiles de terra da costa
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!land(x, y)) continue;
      let coast = false;
      for (let dy = -1; dy <= 1 && !coast; dy++) for (let dx = -1; dx <= 1; dx++) if (!land(x + dx, y + dy)) coast = true;
      if (!coast) continue;
      scene.add
        .sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, 'foam')
        .play({ key: 'foam.play', startFrame: (x * 3 + y * 5) % 8 })
        .setDepth(-2500);
    }

  // pedras na água perto da costa
  let rocks = 0;
  for (let i = 0; i < 400 && rocks < 14; i++) {
    const x = (i * 7919 + map.seed) % w;
    const y = (i * 104729 + map.seed * 3) % h;
    if (land(x, y)) continue;
    let near = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (land(x + dx, y + dy)) near++;
    if (near === 0 || near > 6) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (land(x + dx, y + dy)) near = -99;
    if (near < 0) continue;
    const key = `rocks_0${(i % 3) + 1}`;
    scene.add
      .sprite(x * TILE + TILE / 2, y * TILE + TILE / 2, key)
      .play({ key: `${key}.play`, startFrame: i % 8 })
      .setDepth(-2400);
    rocks++;
  }

  const tm = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: w, height: h });
  const tileset = tm.addTilesetImage('tiles_flat', 'tiles_flat', TILE, TILE, 0, 0);
  if (!tileset) return;
  const grass = tm.createBlankLayer('grass', tileset);
  const sandL = tm.createBlankLayer('sand', tileset);
  if (!grass || !sandL) return;
  grass.setDepth(-2000);
  sandL.setDepth(-1990);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (land(x, y)) grass.putTileAt(autotileIndex(land, x, y, GRASS_BASE), x, y);
      if (sand(x, y)) sandL.putTileAt(autotileIndex(sand, x, y, SAND_BASE), x, y);
    }

  for (const d of map.decor) {
    if (!scene.textures.exists(d.key)) continue;
    const img = scene.add.image(d.tx * TILE + TILE / 2 + d.ox, d.ty * TILE + TILE / 2 + d.oy, d.key);
    img.setOrigin(0.5, originY(d.key) ?? 0.66);
    // decoração pequena fica no chão; placas e espantalho ordenam com as unidades
    img.setDepth(originY(d.key) ? img.y : -1500);
  }
}
