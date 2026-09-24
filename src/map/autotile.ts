// Autotile de 4 vizinhos para o tileset do Tiny Swords Free Pack (9 colunas x 6 linhas de 64 px).
// Chão (coluna base 0) e topo de planalto (coluna base 5) têm a mesma estrutura:
//   bloco 3x3 nas colunas base+0..2 / linhas 0..2 (cantos, bordas e centro)
//   faixa vertical na coluna base+3 / linhas 0..2
//   faixa horizontal na linha 3 / colunas base+0..2
//   tile isolado na linha 3 / coluna base+3
// A face do penhasco fica na linha 4, colunas 5..8 (esquerda, meio, direita, isolada).

export const TILESET_COLS = 9;
export const GRASS_BASE = 0;
export const PLATEAU_BASE = 5;
const CLIFF_ROW = 4;

export function autotileIndex(get: (x: number, y: number) => boolean, x: number, y: number, base: number): number {
  const n = get(x, y - 1);
  const s = get(x, y + 1);
  const w = get(x - 1, y);
  const e = get(x + 1, y);
  const col = w && e ? 1 : e ? 0 : w ? 2 : 3;
  const row = n && s ? 1 : s ? 0 : n ? 2 : 3;
  if (col === 3 && row === 3) return 3 * TILESET_COLS + base + 3;
  if (col === 3) return row * TILESET_COLS + base + 3;
  if (row === 3) return 3 * TILESET_COLS + base + col;
  return row * TILESET_COLS + base + col;
}

/** Tile da face do penhasco, conforme haja penhasco à esquerda/direita. */
export function cliffIndex(isCliff: (x: number, y: number) => boolean, x: number, y: number): number {
  const w = isCliff(x - 1, y);
  const e = isCliff(x + 1, y);
  const col = w && e ? 1 : e ? 0 : w ? 2 : 3;
  return CLIFF_ROW * TILESET_COLS + PLATEAU_BASE + col;
}
