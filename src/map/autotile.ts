// Autotile de 4 vizinhos para o Tilemap_Flat do Tiny Swords (10 colunas x 4 linhas de 64 px).
// Para cada material (grama na coluna 0, areia na coluna 5):
//   bloco 3x3 nas colunas base+0..2 / linhas 0..2 (cantos, bordas e centro)
//   faixa vertical na coluna base+3 / linhas 0..2
//   faixa horizontal na linha 3 / colunas base+0..2
//   tile isolado na linha 3 / coluna base+3

export const TILESET_COLS = 10;
export const GRASS_BASE = 0;
export const SAND_BASE = 5;

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
