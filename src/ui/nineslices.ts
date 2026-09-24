import Phaser from 'phaser';
import { TEAM_COLORS } from '../render/palette';

// As folhas de interface do Free Pack guardam as 9 peças de cada painel separadas por espaços
// vazios (ex.: colunas 0-128, 192-256 e 320-448). O NineSlice do Phaser precisa das peças
// contíguas, então elas são remontadas numa textura nova uma única vez, depois do carregamento.

type Span = [start: number, size: number];

/** Peças de 128 px em folhas de 448 px (Banner, Wood Table, Big Ribbons). */
const BIG: Span[] = [
  [0, 128],
  [192, 64],
  [320, 128],
];
/** Peças de 64 px em folhas de 320 px (Papers, Big Buttons, Bars, Small Ribbons). */
const SMALL: Span[] = [
  [0, 64],
  [128, 64],
  [256, 64],
];

/** Tamanho das bordas de cada textura remontada (para o NineSlice). */
export const SLICE = { big: 128, small: 64 } as const;

function compose(scene: Phaser.Scene, src: string, dest: string, xs: Span[], ys: Span[]): void {
  if (scene.textures.exists(dest) || !scene.textures.exists(src)) return;
  const img = scene.textures.get(src).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const W = xs.reduce((n, [, s]) => n + s, 0);
  const H = ys.reduce((n, [, s]) => n + s, 0);
  const tex = scene.textures.createCanvas(dest, W, H);
  if (!tex) return;
  let dy = 0;
  for (const [sy, sh] of ys) {
    let dx = 0;
    for (const [sx, sw] of xs) {
      tex.context.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh);
      dx += sw;
    }
    dy += sh;
  }
  tex.refresh();
}

/** Monta todas as texturas de 9-slice/3-slice da interface (idempotente). */
export function buildUiTextures(scene: Phaser.Scene): void {
  compose(scene, 'ui_banner_src', 'ui_banner', BIG, BIG);
  compose(scene, 'ui_wood_src', 'ui_wood', BIG, BIG);
  compose(scene, 'ui_paper_src', 'ui_paper', SMALL, SMALL);
  compose(scene, 'ui_paper2_src', 'ui_paper2', SMALL, SMALL);
  compose(scene, 'ui_btn_big_blue_src', 'ui_btn_blue', SMALL, SMALL);
  compose(scene, 'ui_btn_big_blue_p_src', 'ui_btn_blue_p', SMALL, SMALL);
  compose(scene, 'ui_btn_big_red_src', 'ui_btn_red', SMALL, SMALL);
  compose(scene, 'ui_btn_big_red_p_src', 'ui_btn_red_p', SMALL, SMALL);
  compose(scene, 'ui_bar_big_src', 'ui_bar', SMALL, [[0, 64]]);
  // fitas: uma linha por cor, na mesma ordem dos avatares (azul, vermelho, amarelo, roxo, preto)
  TEAM_COLORS.forEach((c, i) => {
    compose(scene, 'ui_ribbons_big_src', `ui_ribbon_${c}`, BIG, [[i * 128, 128]]);
    compose(scene, 'ui_ribbons_small_src', `ui_ribbon_small_${c}`, SMALL, [[i * 128, 64]]);
  });
}
