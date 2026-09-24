import Phaser from 'phaser';
import { COLORS, FONT } from '../config';

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

/** Painel de madeira (9-slice). A escala reduz as bordas grossas de 64 px. */
export function woodPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, scale = 0.5): Phaser.GameObjects.NineSlice {
  const p = scene.add.nineslice(x, y, 'ui_carved9', undefined, w / scale, h / scale, 64, 64, 64, 64);
  p.setOrigin(0, 0).setScale(scale);
  return p;
}

/** Pergaminho (Banner_Horizontal em 9-slice). */
export function scrollPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, scale = 0.75): Phaser.GameObjects.NineSlice {
  const p = scene.add.nineslice(x, y, 'ui_banner_h', undefined, w / scale, h / scale, 64, 64, 64, 64);
  p.setOrigin(0.5).setScale(scale);
  return p;
}

/** Faixa com título (Ribbon 3-slice). */
export function ribbon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  label: string,
  color: 'blue' | 'red' | 'yellow' = 'blue',
  size = 28,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const r = scene.add.nineslice(0, 0, `ui_ribbon_${color}`, undefined, w, 64, 64, 64, 0, 0).setOrigin(0.5);
  const t = scene.add.text(0, -6, label, textStyle(size)).setOrigin(0.5);
  c.add([r, t]);
  return c;
}

export interface TextButton extends Phaser.GameObjects.Container {
  setEnabled(v: boolean): void;
  setLabel(s: string): void;
}

/** Botão largo (3-slice) com estados normal/hover/pressionado. */
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
  const normal = variant === 'blue' ? 'ui_btn_blue3' : 'ui_btn_red3';
  const pressed = variant === 'blue' ? 'ui_btn_blue3_pressed' : 'ui_btn_red3_pressed';
  const bg = scene.add.nineslice(0, 0, normal, undefined, w, 64, 64, 64, 0, 0).setOrigin(0.5);
  const t = scene.add.text(0, -5, label, textStyle(size)).setOrigin(0.5);
  c.add([bg, t]);
  c.setSize(w, 56);
  let enabled = true;
  c.setInteractive({ useHandCursor: true })
    .on('pointerover', () => enabled && bg.setTexture('ui_btn_hover3'))
    .on('pointerout', () => {
      bg.setTexture(enabled ? normal : 'ui_btn_disable3');
      t.setY(-5);
    })
    .on('pointerdown', () => {
      if (!enabled) return;
      bg.setTexture(pressed);
      t.setY(-1);
    })
    .on('pointerup', () => {
      if (!enabled) return;
      bg.setTexture('ui_btn_hover3');
      t.setY(-5);
      onClick();
    });
  c.setEnabled = (v: boolean) => {
    enabled = v;
    bg.setTexture(v ? normal : 'ui_btn_disable3');
    t.setAlpha(v ? 1 : 0.6);
  };
  c.setLabel = (s: string) => t.setText(s);
  return c;
}
