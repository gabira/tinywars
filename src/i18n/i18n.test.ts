import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../data/buildings';
import { UNITS } from '../data/units';
import { ptBR } from './pt-BR';
import { costText, fmt } from './t';

describe('textos pt-BR', () => {
  it('toda unidade e construção tem nome e descrição', () => {
    for (const id of Object.keys(UNITS) as (keyof typeof UNITS)[]) {
      expect(ptBR.units[id].name.length).toBeGreaterThan(0);
      expect(ptBR.units[id].desc.length).toBeGreaterThan(0);
    }
    for (const id of Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[]) {
      expect(ptBR.buildings[id].name.length).toBeGreaterThan(0);
      expect(ptBR.buildings[id].desc.length).toBeGreaterThan(0);
    }
  });

  it('formata variáveis e custos', () => {
    expect(fmt(ptBR.msg.notEnough, { res: 'Madeira' })).toBe('Madeira insuficiente');
    expect(costText({ meat: 60, gold: 20 })).toBe('20 Ouro, 60 Carne');
  });
});

describe('arquitetura', () => {
  it('a simulação não depende do Phaser (roda sem navegador)', () => {
    const root = path.resolve(__dirname, '..');
    const pure = ['core', 'data', 'entities', 'map', 'systems', 'ai'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) walk(full);
        else if (f.name.endsWith('.ts') && /from ['"]phaser['"]/.test(fs.readFileSync(full, 'utf8'))) offenders.push(full);
      }
    };
    for (const d of pure) walk(path.join(root, d));
    expect(offenders).toEqual([]);
  });
});
