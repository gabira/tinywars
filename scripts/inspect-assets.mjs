// Inspeciona as spritesheets extraídas: dimensões, grade provável e quadros não vazios por linha.
//   npm run assets:inspect                 → todos os PNGs
//   npm run assets:inspect -- "Blue Units"  → filtra por trecho do caminho
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { listPngs } from './lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets');
const filter = process.argv[2];

function frameStats(png, fw, fh) {
  const cols = png.width / fw;
  const rows = png.height / fh;
  const perRow = [];
  for (let r = 0; r < rows; r++) {
    let n = 0;
    for (let c = 0; c < cols; c++) {
      let filled = false;
      for (let y = r * fh; y < (r + 1) * fh && !filled; y += 2) {
        for (let x = c * fw; x < (c + 1) * fw; x += 2) {
          if (png.data[(y * png.width + x) * 4 + 3] > 10) {
            filled = true;
            break;
          }
        }
      }
      if (filled) n = c + 1;
    }
    perRow.push(n);
  }
  return { cols, rows, perRow };
}

function bbox(png, fw, fh) {
  let minX = fw, minY = fh, maxX = -1, maxY = -1;
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++)
      if (png.data[(y * png.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
  return maxX < 0 ? 'vazio' : `x${minX}-${maxX} y${minY}-${maxY}`;
}

for (const pack of fs.readdirSync(OUT)) {
  const dir = path.join(OUT, pack);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const rel of listPngs(dir.replace(/\\/g, '/'))) {
    if (filter && !rel.toLowerCase().includes(filter.toLowerCase())) continue;
    const png = PNG.sync.read(fs.readFileSync(path.join(dir, rel)));
    const guesses = [];
    for (const f of [64, 128, 192, 256, 320]) {
      if (png.width % f === 0 && png.height % f === 0 && (png.width > f || png.height > f)) {
        const s = frameStats(png, f, f);
        guesses.push(`${f}px ${s.cols}x${s.rows} [${s.perRow.join(',')}] bbox0 ${bbox(png, f, f)}`);
      }
    }
    console.log(`${pack}/${rel}  ${png.width}x${png.height}`);
    for (const g of guesses) console.log(`    ${g}`);
  }
}
