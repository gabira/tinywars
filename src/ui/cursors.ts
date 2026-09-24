import { CURSORS } from '../assets/assetManifest';

export type CursorKind = 'default' | 'pointer' | 'forbidden' | 'attack';

/** Valor CSS do cursor, usando os cursores do Free Pack (com recuo para os do sistema). */
export function cssCursor(kind: CursorKind): string {
  if (kind === 'attack') return 'crosshair';
  const c = CURSORS[kind];
  return `url("${encodeURI(c.path)}") ${c.x} ${c.y}, ${kind === 'pointer' ? 'pointer' : kind === 'forbidden' ? 'not-allowed' : 'default'}`;
}
