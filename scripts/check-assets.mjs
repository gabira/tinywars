// Executado antes de `npm run dev`: apenas avisa (nunca falha) se os assets não foram baixados.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!fs.existsSync(path.join(ROOT, 'public', 'assets', 'assets-index.json'))) {
  console.warn('\n⚠ Assets não encontrados — rode "npm run assets" antes de jogar.\n');
}
