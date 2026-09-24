// Definição dos pacotes aceitos e regras de segurança.
// O "Enemy Pack" é PAGO: nunca é baixado automaticamente. Ele só é aceito se o
// próprio usuário o comprou e colocou o .zip em assets-manual/.

export const PACKS = {
  legacy: {
    label: 'Tiny Swords (versão antiga, CC0)',
    upload: /^TS_old version_CC0 Licensed$/i,
    root: /^Tiny Swords \(Update 010\)$/i,
    fallbackId: '9428013',
    required: true,
    online: true,
  },
  free: {
    label: 'Tiny Swords (Free Pack)',
    upload: /^Tiny Swords \(Free Pack\)(\.zip)?$/i,
    root: /^Tiny Swords \(Free Pack\)$/i,
    fallbackId: '15971141',
    required: true,
    online: true,
  },
  enemy: {
    label: 'Tiny Swords (Enemy Pack) — comprado pelo usuário',
    upload: null,
    root: /enemy/i,
    required: false,
    online: false,
  },
};

export const PAID_PATTERN = /enemy\s*pack/i;

/** Descobre a qual pacote um zip pertence pela pasta raiz interna. */
export function classifyRoot(rootName) {
  for (const [key, def] of Object.entries(PACKS)) {
    if (def.root.test(rootName)) return key;
  }
  return null;
}
