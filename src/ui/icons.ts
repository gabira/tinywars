import Phaser from 'phaser';
import type { BuildingId } from '../data/types';
import type { IconSpec } from '../game/commandCard';
import { teamColor, type TeamColor } from '../render/palette';
import { teamVisual } from '../render/visuals';

/** Retrato de unidade: recorte do quadro 0 da spritesheet, centralizado em (x, y). */
export function portrait(scene: Phaser.Scene, sheetKey: string, x: number, y: number, size: number): Phaser.GameObjects.Image {
  const small = sheetKey.startsWith('barrel');
  const crop = small ? { x: 34, y: 28, w: 60, h: 72 } : { x: 56, y: 46, w: 80, h: 90 };
  const fw = small ? 128 : 192;
  const s = size / crop.h;
  const img = scene.add.image(0, 0, sheetKey, 0).setScale(s);
  img.setCrop(crop.x, crop.y, crop.w, crop.h);
  const cx = crop.x + crop.w / 2 - fw / 2;
  const cy = crop.y + crop.h / 2 - fw / 2;
  img.setPosition(x - cx * s, y - cy * s);
  return img;
}

/** Miniatura de construção ajustada a um quadrado. */
export function buildingThumb(
  scene: Phaser.Scene,
  id: BuildingId,
  x: number,
  y: number,
  size: number,
  color: TeamColor = teamColor(0),
): Phaser.GameObjects.Image | null {
  const part = teamVisual(scene.textures, id, color).parts.find((p) => scene.textures.exists(p.key) && !p.shooter);
  if (!part) return null;
  const img = scene.add.image(x, y, part.key, 0);
  const s = size / Math.max(img.width, img.height);
  img.setScale(s * 1.15);
  return img;
}

export function iconFor(scene: Phaser.Scene, spec: IconSpec, x: number, y: number, size: number): Phaser.GameObjects.Image | null {
  switch (spec.kind) {
    case 'unit':
      return portrait(scene, spec.sheet, x, y, size);
    case 'building':
      return buildingThumb(scene, spec.id, x, y, size);
    case 'image': {
      const key = scene.textures.exists(spec.key) ? spec.key : spec.fallback;
      const img = scene.add.image(x, y, key);
      img.setScale(size / Math.max(img.width, img.height) * (key.endsWith('_idle') ? 1.5 : 1));
      return img;
    }
  }
}
