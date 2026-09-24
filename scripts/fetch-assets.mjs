#!/usr/bin/env node
// Baixa e extrai os assets gratuitos do Tiny Swords (Pixel Frog) para public/assets/.
//
//   npm run assets                → baixa o pacote CC0 (obrigatório) e o Free Pack (opcional)
//   npm run assets -- --force     → baixa e extrai de novo
//   npm run assets -- --only=legacy
//   npm run assets -- --from=C:/caminho/arquivo.zip
//
// Zips colocados manualmente em assets-manual/ têm prioridade sobre o download.
// O Enemy Pack (pago) NUNCA é baixado; só é importado se você o comprou e colocou em assets-manual/.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AdmZip from 'adm-zip';
import { ItchSession, ItchBlockedError } from './lib/itch.mjs';
import { PACKS, PAID_PATTERN, classifyRoot } from './lib/packs.mjs';
import { pngSize, listPngs } from './lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'assets');
const MANUAL_DIR = path.join(ROOT, 'assets-manual');
const OUT_DIR = path.join(ROOT, 'public', 'assets');
const MAX_BYTES = 50 * 1024 * 1024;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.find((a) => a.startsWith('--only='))?.split('=')[1] ?? null;
const FROM = args.find((a) => a.startsWith('--from='))?.slice('--from='.length) ?? null;

const log = (...m) => console.log(...m);
const warn = (...m) => console.warn('⚠', ...m);

const MANUAL_HELP = `
Não foi possível baixar automaticamente. Faça assim:
  1) Abra https://pixelfrog-assets.itch.io/tiny-swords
  2) Clique em "Download Now" → "No thanks, just take me to the downloads"
  3) Baixe "TS_old version_CC0 Licensed" (e, se quiser, "Tiny Swords (Free Pack).zip")
     NÃO é preciso comprar nada. O "Enemy Pack" é pago e não é usado automaticamente.
  4) Coloque os arquivos .zip na pasta assets-manual/ deste projeto
  5) Rode "npm run assets" de novo
`;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isZip(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(4);
  fs.readSync(fd, b, 0, 4, 0);
  fs.closeSync(fd);
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/** Nome da pasta raiz de um zip (ignorando __MACOSX). */
function zipRoot(zip) {
  const roots = new Set();
  for (const e of zip.getEntries()) {
    const name = e.entryName.replace(/\\/g, '/');
    if (name.startsWith('__MACOSX/')) continue;
    const first = name.split('/')[0];
    if (first) roots.add(first);
  }
  return roots.size === 1 ? [...roots][0] : null;
}

function wanted(key) {
  return !ONLY || ONLY === key;
}

/** Procura zips manuais (assets-manual/ e --from) e os classifica pela pasta raiz. */
function findManualZips() {
  const found = {};
  const candidates = [];
  if (fs.existsSync(MANUAL_DIR)) {
    for (const f of fs.readdirSync(MANUAL_DIR)) if (/\.zip$/i.test(f)) candidates.push(path.join(MANUAL_DIR, f));
  }
  if (FROM) candidates.push(path.resolve(FROM));
  for (const file of candidates) {
    if (!fs.existsSync(file) || !isZip(file)) {
      warn(`Ignorando ${file}: não é um .zip válido.`);
      continue;
    }
    const root = zipRoot(new AdmZip(file));
    const key = root ? classifyRoot(root) : null;
    if (!key) {
      warn(`Ignorando ${path.basename(file)}: pasta raiz "${root}" não reconhecida.`);
      continue;
    }
    if (key === 'enemy') log(`✓ Enemy Pack encontrado em assets-manual/ (fornecido por você) — será importado localmente.`);
    found[key] = file;
  }
  return found;
}

async function downloadTo(session, id, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = await session.fileUrl(id); // URL nova a cada tentativa (expira em 60 s)
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ao baixar do CDN`);
      const len = Number(res.headers.get('content-length') || 0);
      if (len > MAX_BYTES) throw new Error(`Arquivo grande demais (${len} bytes).`);
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part));
      if (fs.statSync(part).size > MAX_BYTES) throw new Error('Arquivo grande demais.');
      if (!isZip(part)) throw new Error('O arquivo baixado não é um .zip.');
      fs.renameSync(part, dest);
      return;
    } catch (err) {
      lastErr = err;
      if (err instanceof ItchBlockedError) throw err;
      warn(`Tentativa ${attempt}/3 falhou: ${err.message}`);
    }
  }
  throw lastErr;
}

async function downloadOnline(keys) {
  const result = {};
  const session = new ItchSession(log);
  await session.open();
  let uploads = [];
  try {
    uploads = await session.listUploads();
  } catch (err) {
    if (err instanceof ItchBlockedError) throw err;
    warn(`Não consegui listar os arquivos (${err.message}); usando IDs conhecidos.`);
  }
  for (const u of uploads) {
    if (PAID_PATTERN.test(u.name)) log(`✗ Ignorando pacote pago: "${u.name}"`);
  }
  for (const key of keys) {
    const def = PACKS[key];
    const up = uploads.find((u) => def.upload.test(u.name) && !PAID_PATTERN.test(u.name));
    const id = up?.id ?? def.fallbackId;
    const dest = path.join(CACHE_DIR, `${key}.zip`);
    log(`→ Baixando ${def.label} (upload ${id})…`);
    try {
      await downloadTo(session, id, dest);
      log(`✓ ${def.label}: ${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB`);
      result[key] = dest;
    } catch (err) {
      if (err instanceof ItchBlockedError) throw err;
      (def.required ? warn : log)(`${def.label}: falhou (${err.message}).`);
    }
  }
  return result;
}

function extract(key, zipFile) {
  const outDir = path.join(OUT_DIR, key);
  const stampFile = path.join(outDir, '.stamp.json');
  const hash = sha256(zipFile);
  if (!FORCE && fs.existsSync(stampFile)) {
    try {
      if (JSON.parse(fs.readFileSync(stampFile, 'utf8')).sha256 === hash) {
        log(`✓ ${PACKS[key].label}: já extraído.`);
        return hash;
      }
    } catch {
      /* stamp corrompido: extrai de novo */
    }
  }
  if (!outDir.startsWith(OUT_DIR + path.sep)) throw new Error('Caminho de saída inválido.');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const zip = new AdmZip(zipFile);
  const root = zipRoot(zip);
  let count = 0;
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    const name = e.entryName.replace(/\\/g, '/');
    if (name.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(name)) continue;
    if (/\.(aseprite|ase|zip)$/i.test(name)) continue;
    const rel = root && name.startsWith(root + '/') ? name.slice(root.length + 1) : name;
    if (key !== 'enemy' && /enemy/i.test(rel)) continue;
    const dest = path.resolve(outDir, rel);
    if (!dest.startsWith(outDir + path.sep)) {
      warn(`Entrada suspeita ignorada: ${name}`);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, e.getData());
    count++;
  }
  fs.writeFileSync(stampFile, JSON.stringify({ sha256: hash, extractedAt: new Date().toISOString() }, null, 2));
  log(`✓ ${PACKS[key].label}: ${count} arquivos extraídos em public/assets/${key}/`);
  return hash;
}

function writeIndex(hashes) {
  const packs = {};
  for (const key of Object.keys(PACKS)) {
    const dir = path.join(OUT_DIR, key);
    if (!fs.existsSync(dir)) continue;
    const files = {};
    for (const rel of listPngs(dir.replace(/\\/g, '/')).sort()) files[rel] = pngSize(path.join(dir, rel));
    let sha = hashes[key];
    if (!sha) {
      try {
        sha = JSON.parse(fs.readFileSync(path.join(dir, '.stamp.json'), 'utf8')).sha256;
      } catch {
        sha = null;
      }
    }
    packs[key] = { sha256: sha, files };
  }
  const index = { version: 1, generatedAt: new Date().toISOString(), packs };
  fs.writeFileSync(path.join(OUT_DIR, 'assets-index.json'), JSON.stringify(index, null, 1));
  return index;
}

async function main() {
  log('TinyWars — preparando assets do Tiny Swords (Pixel Frog)\n');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const zips = findManualZips();
  const onlineKeys = Object.keys(PACKS).filter((k) => PACKS[k].online && wanted(k) && !zips[k]);
  const missing = onlineKeys.filter((k) => FORCE || !fs.existsSync(path.join(CACHE_DIR, `${k}.zip`)));
  for (const k of onlineKeys) {
    const cached = path.join(CACHE_DIR, `${k}.zip`);
    if (!missing.includes(k) && isZip(cached)) zips[k] = cached;
  }

  if (missing.length) {
    try {
      Object.assign(zips, await downloadOnline(missing));
    } catch (err) {
      warn(err.message);
    }
  }

  const hashes = {};
  for (const [key, file] of Object.entries(zips)) {
    if (!wanted(key) && key !== 'enemy') continue;
    try {
      hashes[key] = extract(key, file);
    } catch (err) {
      warn(`Falha ao extrair ${path.basename(file)}: ${err.message}`);
    }
  }

  const index = writeIndex(hashes);
  const legacy = index.packs.legacy;
  const ok =
    legacy &&
    ['Factions/Knights/', 'Factions/Goblins/', 'Terrain/', 'Resources/'].every((p) =>
      Object.keys(legacy.files).some((f) => f.startsWith(p)),
    );

  if (!ok) {
    console.error(MANUAL_HELP);
    process.exitCode = 1;
    return;
  }
  const summary = Object.entries(index.packs)
    .map(([k, p]) => `${k}: ${Object.keys(p.files).length} PNGs`)
    .join(' · ');
  log(`\nPronto! ${summary}\nAgora rode: npm run dev`);
}

main().catch((err) => {
  console.error(err);
  console.error(MANUAL_HELP);
  process.exitCode = 1;
});
