import fs from 'node:fs';

/** Lê largura/altura do cabeçalho IHDR de um PNG sem decodificar a imagem. */
export function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    if (buf.readUInt32BE(0) !== 0x89504e47) return null;
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  } finally {
    fs.closeSync(fd);
  }
}

/** Lista recursivamente arquivos .png dentro de `dir`, com caminhos relativos usando '/'. */
export function listPngs(dir, base = dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${ent.name}`;
    if (ent.isDirectory()) listPngs(full, base, out);
    else if (/\.png$/i.test(ent.name)) out.push(full.slice(base.length + 1));
  }
  return out;
}
