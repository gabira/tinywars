import Phaser from 'phaser';
import type { BuildingId, UnitId } from '../data/types';
import type { IconSpec } from '../game/commandCard';
import { teamColor, type TeamColor } from '../render/palette';
import { buildingVisual } from '../render/visuals';

/** Área útil dos avatares do Free Pack (256 px com margem transparente). */
const AVATAR_CONTENT = 196;

/** Retrato da unidade: avatar do Free Pack na cor do reino, centralizado em (x, y). */
export function portrait(
  scene: Phaser.Scene,
  unit: UnitId,
  color: TeamColor,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y + size * 0.03, `avatar_${color}_${unit}`).setScale(size / AVATAR_CONTENT);
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
  const part = buildingVisual(id, color).parts.find((p) => scene.textures.exists(p.key) && !p.shooter);
  if (!part) return null;
  const img = scene.add.image(x, y, part.key, 0);
  img.setScale((size / Math.max(img.width, img.height)) * 1.15);
  return img;
}

export function iconFor(scene: Phaser.Scene, spec: IconSpec, x: number, y: number, size: number): Phaser.GameObjects.Image | null {
  switch (spec.kind) {
    case 'unit':
      return portrait(scene, spec.unit, spec.color, x, y, size);
    case 'building':
      return buildingThumb(scene, spec.id, x, y, size);
    case 'image': {
      if (!scene.textures.exists(spec.key)) return null;
      const img = scene.add.image(x, y, spec.key);
      img.setScale((size / Math.max(img.width, img.height)) * (spec.zoom ?? 1));
      return img;
    }
  }
}
