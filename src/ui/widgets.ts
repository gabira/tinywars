import Phaser from 'phaser';
import { COLORS, FONT } from '../config';
import type { TeamColor } from '../render/palette';
import { SLICE, trimmedSlices, type TrimmedKey } from './nineslices';

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

/**
 * Painel com a textura recortada: a borda visível coincide com o retângulo (x, y, w, h).
 * As bordas e o miolo são repetidos lado a lado, então tábuas e papel não viram listras em
 * painéis grandes (`stretch` estica, melhor para texturas lisas). Escala 0,5 em tudo o que é
 * do HUD, para manter a mesma densidade de pixels.
 */
export function framed(
  scene: Phaser.Scene,
  key: TrimmedKey,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 0.5,
  stretch = false,
): Phaser.GameObjects.Container {
  const [l, r, t, b] = trimmedSlices(key);
  const tex = scene.textures.get(key);
  const src = tex.getSourceImage();
  const mw = src.width - l - r;
  const mh = src.height - t - b;
  const W = Math.max(Math.round(w / scale), l + r + 2);
  const H = Math.max(Math.round(h / scale), t + b + 2);
  const cols = [
    [0, l, 0, l],
    [l, mw, l, W - l - r],
    [l + mw, r, W - r, r],
  ];
  const rows = [
    [0, t, 0, t],
    [t, mh, t, H - t - b],
    [t + mh, b, H - b, b],
  ];
  const c = scene.add.container(x, y).setScale(scale);
  rows.forEach(([sy, sh, dy, dh], j) =>
    cols.forEach(([sx, sw, dx, dw], i) => {
      const frame = `p${i}${j}`;
      if (!tex.has(frame)) tex.add(frame, 0, sx, sy, sw, sh);
      let part: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
      if (i !== 1 && j !== 1) part = scene.add.image(dx, dy, key, frame);
      else if (stretch) part = scene.add.image(dx, dy, key, frame).setDisplaySize(dw, dh);
      else part = scene.add.tileSprite(dx, dy, dw, dh, key, frame);
      c.add(part.setOrigin(0));
    }),
  );
  return c;
}

/** Mesa de madeira com moldura e cantos de metal (barras do HUD). */
export function hudPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  return framed(scene, 'ui_wood_t', x, y, w, h);
}

/** Fenda rebaixada onde ficam minimapa, retratos e botões: madeira escura ou pergaminho. */
export function slot(scene: Phaser.Scene, x: number, y: number, w: number, h: number, kind: 'wood' | 'paper' = 'wood'): Phaser.GameObjects.Container {
  return framed(scene, kind === 'wood' ? 'ui_slot_wood' : 'ui_slot_paper', x, y, w, h);
}

/** Papel escuro com cantos dourados (dicas dos botões). */
export function darkPaper(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  return framed(scene, 'ui_dark_t', x, y, w, h, 0.5, true);
}

/** Barra de vida/progresso com contorno escuro; `set(fração, cor)` atualiza o preenchimento. */
export function meter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): { objects: Phaser.GameObjects.GameObject[]; set(f: number, color: number): void } {
  const outline = scene.add.rectangle(x, y, w, h, 0x2b1d12).setOrigin(0, 0.5);
  const track = scene.add.rectangle(x + 2, y, w - 4, h - 4, 0x5b4636).setOrigin(0, 0.5);
  const fill = scene.add.rectangle(x + 2, y, w - 4, h - 4, COLORS.hpGood).setOrigin(0, 0.5);
  const shine = scene.add.rectangle(x + 2, y - (h - 4) / 2, w - 4, 2, 0xffffff, 0.25).setOrigin(0, 0);
  return {
    objects: [outline, track, fill, shine],
    set(f: number, color: number) {
      const k = Math.min(1, Math.max(0, f));
      fill.width = (w - 4) * k;
      shine.width = (w - 4) * k;
      fill.fillColor = color;
    },
  };
}

/** Cor da barra de vida conforme a fração restante. */
export function hpColor(f: number): number {
  return f > 0.6 ? COLORS.hpGood : f > 0.3 ? COLORS.hpMid : COLORS.hpLow;
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
