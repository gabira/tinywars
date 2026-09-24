import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGES, SHEETS } from './assetManifest';

const indexPath = path.resolve(__dirname, '../../public/assets/assets-index.json');
const hasIndex = fs.existsSync(indexPath);

describe.skipIf(!hasIndex)('assetManifest × arquivos baixados', () => {
  const index = hasIndex ? (JSON.parse(fs.readFileSync(indexPath, 'utf8')) as { packs: Record<string, { files: Record<string, [number, number]> }> }) : null;

  it('todas as spritesheets obrigatórias existem e a grade bate com as animações', () => {
    for (const s of SHEETS) {
      const dims = index!.packs[s.pack]?.files[s.path];
      if (!dims) {
        expect(s.optional, `faltando: ${s.path}`).toBe(true);
        continue;
      }
      const [w, h] = dims;
      expect(w % s.frameWidth, `${s.path} largura`).toBe(0);
      expect(h % s.frameHeight, `${s.path} altura`).toBe(0);
      const cols = w / s.frameWidth;
      const rows = h / s.frameHeight;
      for (const [name, a] of Object.entries(s.anims ?? {})) {
        expect(a.row, `${s.key}.${name} linha`).toBeLessThan(rows);
        expect((a.startCol ?? 0) + a.frames, `${s.key}.${name} quadros`).toBeLessThanOrEqual(cols);
      }
    }
  });

  it('todas as imagens obrigatórias existem', () => {
    for (const i of IMAGES) {
      if (i.optional) continue;
      expect(index!.packs[i.pack]?.files[i.path], `faltando: ${i.path}`).toBeTruthy();
    }
  });

  it('nenhum arquivo do Enemy Pack pago foi baixado automaticamente', () => {
    for (const [pack, p] of Object.entries(index!.packs)) {
      if (pack === 'enemy') continue;
      for (const f of Object.keys(p.files)) expect(/enemy/i.test(f), f).toBe(false);
    }
  });
});
