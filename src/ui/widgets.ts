import Phaser from 'phaser';
import { COLORS, FONT } from '../config';
import type { TeamColor } from '../render/palette';
import { SLICE } from './nineslices';

export function textStyle(size = 20, color: string = COLORS.text, stroke = true): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    stroke: stroke ? '#2b1d12' : undefined,
    strokeThickness: stroke ? Math.max(2, Math.round(size / 6)) : 0,
    resolution: 2,
  };
}

export function darkText(size = 18): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color: COLORS.textDark, resolution: 2 };
}

/** Painel 9-slice. `scale` reduz as bordas grossas das folhas do Free Pack. */
function nine(
  scene: Phaser.Scene,
  key: string,
  slice: number,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
): Phaser.GameObjects.NineSlice {
  const minSide = (slice * 2 + 1) * scale;
  const p = scene.add.nineslice(x, y, key, undefined, Math.max(w, minSide) / scale, Math.max(h, minSide) / scale, slice, slice, slice, slice);
  return p.setScale(scale);
}

/** Mesa de madeira com cantos de metal (painéis do HUD). */
export function woodPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, scale = 0.5): Phaser.GameObjects.NineSlice {
  return nine(scene, 'ui_wood', SLICE.big, x, y, w, h, scale).setOrigin(0, 0);
}

/** Papel (dicas e barra superior). */
export function paperPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, scale = 0.5): Phaser.GameObjects.NineSlice {
  return nine(scene, 'ui_paper', SLICE.small, x, y, w, h, scale).setOrigin(0, 0);
}

/** Pergaminho enrolado (janelas de menu), centralizado em (x, y). */
export function scrollPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, scale = 0.6): Phaser.GameObjects.NineSlice {
  return nine(scene, 'ui_banner', SLICE.big, x, y, w, h, scale).setOrigin(0.5);
}

/** Fita com título, na cor do reino. */
export function ribbon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  label: string,
  color: TeamColor = 'blue',
  size = 28,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const scale = 0.62;
  const r = scene.add
    .nineslice(0, 0, `ui_ribbon_${color}`, undefined, w / scale, 128, SLICE.big, SLICE.big, 0, 0)
    .setOrigin(0.5)
    .setScale(scale);
  const t = scene.add.text(0, -6, label, textStyle(size)).setOrigin(0.5);
  c.add([r, t]);
  return c;
}

export interface TextButton extends Phaser.GameObjects.Container {
  setEnabled(v: boolean): void;
  setLabel(s: string): void;
}

/** Botão grande (9-slice azul ou vermelho) com estados normal/hover/pressionado. */
export function textButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  label: string,
  onClick: () => void,
  variant: 'blue' | 'red' = 'blue',
  size = 22,
): TextButton {
  const c = scene.add.container(x, y) as TextButton;
  const normal = `ui_btn_${variant}`;
  const pressed = `ui_btn_${variant}_p`;
  const scale = 0.42;
  const h = 58;
  const bg = scene.add
    .nineslice(0, 0, normal, undefined, w / scale, h / scale, SLICE.small, SLICE.small, SLICE.small, SLICE.small)
    .setOrigin(0.5)
    .setScale(scale);
  const t = scene.add.text(0, -3, label, textStyle(size)).setOrigin(0.5);
  c.add([bg, t]);
  c.setSize(w, h - 6);
  let enabled = true;
  c.setInteractive({ useHandCursor: true })
    .on('pointerover', () => enabled && c.setScale(1.03))
    .on('pointerout', () => {
      c.setScale(1);
      bg.setTexture(normal);
      t.setY(-3);
    })
    .on('pointerdown', () => {
      if (!enabled) return;
      bg.setTexture(pressed);
      t.setY(1);
    })
    .on('pointerup', () => {
      if (!enabled) return;
      bg.setTexture(normal);
      t.setY(-3);
      onClick();
    });
  c.setEnabled = (v: boolean) => {
    enabled = v;
    c.setAlpha(v ? 1 : 0.55);
  };
  c.setLabel = (s: string) => t.setText(s);
  return c;
}
