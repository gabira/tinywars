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

/**
 * Versões "recortadas": cada peça vai só até a borda visível, sem a margem transparente das
 * folhas. Assim o retângulo pedido é exatamente o que aparece (o HUD encaixa nas molduras).
 * As bordas têm tamanho par para caírem em pixels inteiros na escala 0,5.
 * As fendas (slots) usam cantos de 20 px e um miolo liso, para caber em tamanhos pequenos.
 */
const TRIMMED = {
  ui_wood_t: { src: 'ui_wood_src', xs: [[44, 84], [192, 64], [320, 84]], ys: [[42, 86], [192, 64], [320, 104]] },
  ui_dark_t: { src: 'ui_paper2_src', xs: [[10, 54], [128, 64], [256, 54]], ys: [[20, 44], [128, 64], [256, 44]] },
  ui_slot_wood: { src: 'ui_wood_slots_src', xs: [[12, 20], [80, 32], [160, 20]], ys: [[11, 20], [80, 32], [161, 20]] },
  ui_slot_paper: { src: 'ui_paper_slots_src', xs: [[5, 20], [80, 32], [170, 20]], ys: [[5, 20], [80, 32], [168, 20]] },
} satisfies Record<string, { src: string; xs: Span[]; ys: Span[] }>;

export type TrimmedKey = keyof typeof TRIMMED;

/** Bordas (esquerda, direita, cima, baixo) de uma textura recortada, para o NineSlice. */
export function trimmedSlices(key: TrimmedKey): [number, number, number, number] {
  const t = TRIMMED[key];
  return [t.xs[0][1], t.xs[2][1], t.ys[0][1], t.ys[2][1]];
}

/** Monta todas as texturas de 9-slice/3-slice da interface (idempotente). */
export function buildUiTextures(scene: Phaser.Scene): void {
  for (const [dest, t] of Object.entries(TRIMMED)) compose(scene, t.src, dest, t.xs, t.ys);
  compose(scene, 'ui_banner_src', 'ui_banner', BIG, BIG);
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
