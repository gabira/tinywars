import Phaser from 'phaser';
import type { TeamColor } from '../render/palette';
import { BASE_IMAGES, BASE_SHEETS, teamImages, teamSheets, type ImageDef, type SheetDef } from './assetManifest';
import { registerAnimations } from './animations';

interface AssetIndex {
  packs: Record<string, { files: Record<string, [number, number]> }>;
}

function index(scene: Phaser.Scene): AssetIndex | undefined {
  return scene.cache.json.get('assets-index') as AssetIndex | undefined;
}

/**
 * Enfileira no loader da cena as texturas que ainda não foram carregadas.
 * Devolve quantas foram enfileiradas e quais obrigatórias estão faltando no disco.
 */
export function queueAssets(scene: Phaser.Scene, sheets: SheetDef[], images: ImageDef[]): { queued: number; missing: string[] } {
  const idx = index(scene);
  const has = (pack: string, path: string) => !!idx?.packs[pack]?.files[path];
  const url = (pack: string, path: string) => encodeURI(`assets/${pack}/${path}`);
  const missing: string[] = [];
  let queued = 0;
  for (const s of sheets) {
    if (scene.textures.exists(s.key)) continue;
    if (!has(s.pack, s.path)) {
      if (!s.optional) missing.push(s.path);
      continue;
    }
    const [w, h] = idx!.packs[s.pack].files[s.path];
    if (w % s.frameWidth || h % s.frameHeight) console.warn(`[assets] ${s.path}: ${w}x${h} não divide em ${s.frameWidth}x${s.frameHeight}`);
    scene.load.spritesheet(s.key, url(s.pack, s.path), { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    queued++;
  }
  for (const i of images) {
    if (scene.textures.exists(i.key)) continue;
    if (!has(i.pack, i.path)) {
      if (!i.optional) missing.push(i.path);
      continue;
    }
    scene.load.image(i.key, url(i.pack, i.path));
    queued++;
  }
  return { queued, missing };
}

export function queueBaseAssets(scene: Phaser.Scene): { queued: number; missing: string[] } {
  return queueAssets(scene, BASE_SHEETS, BASE_IMAGES);
}

export function queueTeamAssets(scene: Phaser.Scene, colors: readonly TeamColor[]): { queued: number; missing: string[] } {
  const unique = [...new Set(colors)];
  return queueAssets(scene, unique.flatMap(teamSheets), unique.flatMap(teamImages));
}

/** Carrega (se preciso) as texturas das cores e chama `done` quando estiverem prontas. */
export function loadTeamAssets(scene: Phaser.Scene, colors: readonly TeamColor[], done: () => void): void {
  const { queued } = queueTeamAssets(scene, colors);
  if (!queued) {
    done();
    return;
  }
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    registerAnimations(scene);
    done();
  });
  scene.load.start();
}
