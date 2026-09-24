#!/usr/bin/env node
// Um único comando para jogar: instala dependências, baixa os assets (se preciso)
// e abre o jogo no navegador.
//
//   npm run play
//
// Não precisa rodar `npm install` nem `npm run assets` antes — este script faz
// isso sozinho na primeira vez. Nas próximas vezes só inicia o servidor.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (...m) => console.log(...m);

function run(command) {
  const res = spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    log(`\n✗ Falhou: ${command}`);
    process.exit(res.status ?? 1);
  }
}

/** Como run(), mas não interrompe o script se falhar (usado para os assets). */
function runSoft(command) {
  const res = spawnSync(command, { cwd: ROOT, stdio: 'inherit', shell: true });
  return res.status === 0;
}

const hasNodeModules = fs.existsSync(path.join(ROOT, 'node_modules', '.bin'));
const hasAssets = fs.existsSync(path.join(ROOT, 'public', 'assets', 'assets-index.json'));

log('TinyWars — preparando tudo para jogar\n');

if (!hasNodeModules) {
  log('📦 Instalando dependências (só na primeira vez, pode levar um minuto)…\n');
  run('npm install');
}

if (!hasAssets) {
  log('\n🖼  Baixando a arte gratuita do Tiny Swords (Pixel Frog)…\n');
  const ok = runSoft('npm run assets');
  if (!ok) {
    log('\n⚠ Não deu para baixar a arte automaticamente. O jogo vai abrir mesmo');
    log('  assim e mostrar na tela como baixar manualmente (veja também acima).\n');
  }
}

log('\n▶ Iniciando o TinyWars… o navegador deve abrir sozinho.');
log('  Para parar, feche esta janela ou pressione Ctrl+C.\n');
run('npm run dev');
