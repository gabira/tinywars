// Manifesto único de assets (caminhos relativos a public/assets/<pack>/).
// Arte principal: Tiny Swords — Free Pack (Pixel Frog). Da versão antiga (CC0) vêm só as
// peças que o Free Pack não tem: fundações de obra, ruínas e a caveira de morte.
// Quadros e âncoras medidos nas imagens (`npm run assets:inspect`).

import { COLOR_DIR, TEAM_COLORS, type TeamColor } from '../render/palette';

export type Pack = 'legacy' | 'free';

export interface AnimDef {
  row: number;
  frames: number;
  startCol?: number;
  fps?: number;
  /** -1 = loop, 0 = toca uma vez */
  repeat?: number;
}

export interface SheetDef {
  key: string;
  pack: Pack;
  path: string;
  frameWidth: number;
  frameHeight: number;
  anims?: Record<string, AnimDef>;
  optional?: boolean;
}

export interface ImageDef {
  key: string;
  pack: Pack;
  path: string;
  optional?: boolean;
}

/** Tira horizontal com uma única animação (chave da animação: `${key}.play`). */
function strip(key: string, path: string, frames: number, fps = 10, repeat = -1, fw = 192, fh = fw, pack: Pack = 'free'): SheetDef {
  return { key, pack, path, frameWidth: fw, frameHeight: fh, anims: { play: { row: 0, frames, fps, repeat } } };
}

const img = (key: string, path: string, pack: Pack = 'free', optional = false): ImageDef => ({ key, pack, path, optional });

/** Ferramentas e cargas do peão (cada uma tem tiras próprias no pacote). */
export const PAWN_TOOLS = ['axe', 'hammer', 'knife', 'pickaxe'] as const;
export const PAWN_CARGO = ['gold', 'wood', 'meat'] as const;
const CAP: Record<string, string> = { axe: 'Axe', hammer: 'Hammer', knife: 'Knife', pickaxe: 'Pickaxe', gold: 'Gold', wood: 'Wood', meat: 'Meat' };
const WORK_FRAMES: Record<(typeof PAWN_TOOLS)[number], number> = { axe: 6, hammer: 3, knife: 4, pickaxe: 6 };

/** Direções de ataque do lanceiro. */
export const LANCER_DIRS = ['up', 'upright', 'right', 'downright', 'down'] as const;
const DIR_FILE: Record<(typeof LANCER_DIRS)[number], string> = { up: 'Up', upright: 'UpRight', right: 'Right', downright: 'DownRight', down: 'Down' };

/** Spritesheets que dependem da cor do reino. */
export function teamSheets(color: TeamColor): SheetDef[] {
  const U = `Units/${COLOR_DIR[color]} Units`;
  const P = `${U}/Pawn`;
  const out: SheetDef[] = [
    strip(`pawn_${color}_idle`, `${P}/Pawn_Idle.png`, 8),
    strip(`pawn_${color}_run`, `${P}/Pawn_Run.png`, 6),
  ];
  for (const t of [...PAWN_TOOLS, ...PAWN_CARGO]) {
    out.push(strip(`pawn_${color}_idle_${t}`, `${P}/Pawn_Idle ${CAP[t]}.png`, 8));
    out.push(strip(`pawn_${color}_run_${t}`, `${P}/Pawn_Run ${CAP[t]}.png`, 6));
  }
  for (const t of PAWN_TOOLS) out.push(strip(`pawn_${color}_work_${t}`, `${P}/Pawn_Interact ${CAP[t]}.png`, WORK_FRAMES[t], 10));

  const W = `${U}/Warrior`;
  out.push(
    strip(`warrior_${color}_idle`, `${W}/Warrior_Idle.png`, 8),
    strip(`warrior_${color}_run`, `${W}/Warrior_Run.png`, 6),
    strip(`warrior_${color}_attack1`, `${W}/Warrior_Attack1.png`, 4, 10, 0),
    strip(`warrior_${color}_attack2`, `${W}/Warrior_Attack2.png`, 4, 10, 0),
    strip(`warrior_${color}_guard`, `${W}/Warrior_Guard.png`, 6),
  );

  const L = `${U}/Lancer`;
  out.push(strip(`lancer_${color}_idle`, `${L}/Lancer_Idle.png`, 12, 10, -1, 320), strip(`lancer_${color}_run`, `${L}/Lancer_Run.png`, 6, 10, -1, 320));
  for (const d of LANCER_DIRS) out.push(strip(`lancer_${color}_attack_${d}`, `${L}/Lancer_${DIR_FILE[d]}_Attack.png`, 3, 10, 0, 320));
  out.push(strip(`lancer_${color}_guard`, `${L}/Lancer_Right_Defence.png`, 6, 10, -1, 320));

  const A = `${U}/Archer`;
  out.push(
    strip(`archer_${color}_idle`, `${A}/Archer_Idle.png`, 6),
    strip(`archer_${color}_run`, `${A}/Archer_Run.png`, 4),
    strip(`archer_${color}_shoot`, `${A}/Archer_Shoot.png`, 8, 14, 0),
  );

  const M = `${U}/Monk`;
  out.push(
    strip(`monk_${color}_idle`, `${M}/Idle.png`, 6),
    strip(`monk_${color}_run`, `${M}/Run.png`, 4),
    strip(`monk_${color}_heal`, `${M}/Heal.png`, 11, 12, 0),
  );
  return out;
}

/** Ordem das unidades nos avatares (Avatars_01..05 = azul, 06..10 = vermelho...). */
const AVATAR_UNITS = ['warrior', 'lancer', 'archer', 'monk', 'pawn'] as const;

/** Imagens que dependem da cor do reino: construções, flecha e avatares. */
export function teamImages(color: TeamColor): ImageDef[] {
  const B = `Buildings/${COLOR_DIR[color]} Buildings`;
  const ci = TEAM_COLORS.indexOf(color);
  return [
    img(`castle_${color}`, `${B}/Castle.png`),
    img(`house1_${color}`, `${B}/House1.png`),
    img(`house2_${color}`, `${B}/House2.png`),
    img(`house3_${color}`, `${B}/House3.png`),
    img(`barracks_${color}`, `${B}/Barracks.png`),
    img(`archery_${color}`, `${B}/Archery.png`),
    img(`monastery_${color}`, `${B}/Monastery.png`),
    img(`tower_${color}`, `${B}/Tower.png`),
    img(`arrow_${color}`, `Units/${COLOR_DIR[color]} Units/Archer/Arrow.png`),
    ...AVATAR_UNITS.map((u, i) => {
      const n = String(ci * 5 + i + 1).padStart(2, '0');
      return img(`avatar_${color}_${u}`, `UI Elements/UI Elements/Human Avatars/Avatars_${n}.png`);
    }),
  ];
}

const T = 'Terrain';
const R = 'Terrain/Resources';
const D = 'Terrain/Decorations';
const FX = 'Particle FX';
const UI = 'UI Elements/UI Elements';

/** Spritesheets que não dependem de cor. */
export const BASE_SHEETS: SheetDef[] = [
  // terreno (tileset 9x6 de 64 px) e água
  { key: 'tiles_main', pack: 'free', path: `${T}/Tileset/Tilemap_color1.png`, frameWidth: 64, frameHeight: 64 },
  { key: 'tiles_alt', pack: 'free', path: `${T}/Tileset/Tilemap_color3.png`, frameWidth: 64, frameHeight: 64 },
  strip('foam', `${T}/Tileset/Water Foam.png`, 16, 10),
  // recursos
  strip('tree1', `${R}/Wood/Trees/Tree1.png`, 8, 8, -1, 192, 256),
  strip('tree2', `${R}/Wood/Trees/Tree2.png`, 8, 8, -1, 192, 256),
  strip('tree3', `${R}/Wood/Trees/Tree3.png`, 8, 8, -1, 192, 192),
  strip('tree4', `${R}/Wood/Trees/Tree4.png`, 8, 8, -1, 192, 192),
  ...[1, 2, 3, 4, 5, 6].map((n) => strip(`gold_stone${n}_hl`, `${R}/Gold/Gold Stones/Gold Stone ${n}_Highlight.png`, 6, 8, -1, 128)),
  strip('sheep_idle', `${R}/Meat/Sheep/Sheep_Idle.png`, 6, 8, -1, 128),
  strip('sheep_move', `${R}/Meat/Sheep/Sheep_Move.png`, 4, 8, -1, 128),
  strip('sheep_grass', `${R}/Meat/Sheep/Sheep_Grass.png`, 12, 8, -1, 128),
  // decoração
  ...[1, 2, 3, 4].map((n) => strip(`bush${n}`, `${D}/Bushes/Bushe${n}.png`, 8, 8, -1, 128)),
  ...[1, 2, 3, 4].map((n) => strip(`water_rock${n}`, `${D}/Rocks in the Water/Water Rocks_0${n}.png`, 16, 8, -1, 64)),
  strip('duck', `${D}/Rubber Duck/Rubber duck.png`, 3, 4, -1, 32),
  // efeitos
  strip('dust1', `${FX}/Dust_01.png`, 8, 14, 0, 64),
  strip('dust2', `${FX}/Dust_02.png`, 10, 14, 0, 64),
  strip('explosion1', `${FX}/Explosion_01.png`, 8, 14, 0),
  strip('explosion2', `${FX}/Explosion_02.png`, 10, 14, 0),
  strip('fire1', `${FX}/Fire_01.png`, 8, 10, -1, 64),
  strip('fire2', `${FX}/Fire_02.png`, 10, 10, -1, 64),
  strip('fire3', `${FX}/Fire_03.png`, 12, 10, -1, 64),
  strip('heal_fx', 'Units/Blue Units/Monk/Heal_Effect.png', 11, 14, 0),
  // versão antiga (CC0): caveira de morte
  {
    key: 'dead', pack: 'legacy', path: 'Factions/Knights/Troops/Dead/Dead.png', frameWidth: 128, frameHeight: 128,
    anims: { die: { row: 0, frames: 7, fps: 10, repeat: 0 }, fade: { row: 1, frames: 7, fps: 6, repeat: 0 } },
  },
];

/** Imagens que não dependem de cor. */
export const BASE_IMAGES: ImageDef[] = [
  img('water', `${T}/Tileset/Water Background color.png`),
  img('shadow', `${T}/Tileset/Shadow.png`),
  ...[1, 2, 3, 4].map((n) => img(`stump${n}`, `${R}/Wood/Trees/Stump ${n}.png`)),
  ...[1, 2, 3, 4, 5, 6].map((n) => img(`gold_stone${n}`, `${R}/Gold/Gold Stones/Gold Stone ${n}.png`)),
  img('gold_res', `${R}/Gold/Gold Resource/Gold_Resource.png`),
  img('meat_res', `${R}/Meat/Meat Resource/Meat Resource.png`),
  img('wood_res', `${R}/Wood/Wood Resource/Wood Resource.png`),
  ...[1, 2, 3, 4].map((n) => img(`tool${n}`, `${R}/Tools/Tool_0${n}.png`)),
  ...[1, 2, 3, 4].map((n) => img(`rock${n}`, `${D}/Rocks/Rock${n}.png`)),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => img(`cloud${n}`, `${D}/Clouds/Clouds_0${n}.png`)),
  // interface (folhas de 9-slice com peças separadas: remontadas em ui/nineslices.ts)
  img('ui_banner_src', `${UI}/Banners/Banner.png`),
  img('ui_wood_src', `${UI}/Wood Table/WoodTable.png`),
  img('ui_paper_src', `${UI}/Papers/RegularPaper.png`),
  img('ui_paper2_src', `${UI}/Papers/SpecialPaper.png`),
  img('ui_ribbons_big_src', `${UI}/Ribbons/BigRibbons.png`),
  img('ui_ribbons_small_src', `${UI}/Ribbons/SmallRibbons.png`),
  img('ui_bar_big_src', `${UI}/Bars/BigBar_Base.png`),
  img('ui_bar_big_fill', `${UI}/Bars/BigBar_Fill.png`),
  img('ui_btn_big_blue_src', `${UI}/Buttons/BigBlueButton_Regular.png`),
  img('ui_btn_big_blue_p_src', `${UI}/Buttons/BigBlueButton_Pressed.png`),
  img('ui_btn_big_red_src', `${UI}/Buttons/BigRedButton_Regular.png`),
  img('ui_btn_big_red_p_src', `${UI}/Buttons/BigRedButton_Pressed.png`),
  img('ui_btn_sq_blue', `${UI}/Buttons/SmallBlueSquareButton_Regular.png`),
  img('ui_btn_sq_blue_p', `${UI}/Buttons/SmallBlueSquareButton_Pressed.png`),
  img('ui_btn_sq_red', `${UI}/Buttons/SmallRedSquareButton_Regular.png`),
  img('ui_btn_sq_red_p', `${UI}/Buttons/SmallRedSquareButton_Pressed.png`),
  img('ui_btn_round_blue', `${UI}/Buttons/SmallBlueRoundButton_Regular.png`),
  img('ui_btn_round_blue_p', `${UI}/Buttons/SmallBlueRoundButton_Pressed.png`),
  img('ui_btn_tiny_blue', `${UI}/Buttons/TinySquareBlueButton.png`),
  img('ui_btn_tiny_red', `${UI}/Buttons/TinySquareRedButton.png`),
  ...Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return img(`icon_${n}`, `${UI}/Icons/Icon_${n}.png`);
  }),
  // versão antiga (CC0): o Free Pack não tem obras nem ruínas
  img('castle_construction', 'Factions/Knights/Buildings/Castle/Castle_Construction.png', 'legacy'),
  img('house_construction', 'Factions/Knights/Buildings/House/House_Construction.png', 'legacy'),
  img('tower_construction', 'Factions/Knights/Buildings/Tower/Tower_Construction.png', 'legacy'),
  img('castle_destroyed', 'Factions/Knights/Buildings/Castle/Castle_Destroyed.png', 'legacy'),
  img('house_destroyed', 'Factions/Knights/Buildings/House/House_Destroyed.png', 'legacy'),
  img('tower_destroyed', 'Factions/Knights/Buildings/Tower/Tower_Destroyed.png', 'legacy'),
];

/** Cursores do Free Pack (usados como CSS, não como textura). */
export const CURSORS = {
  default: { path: `assets/free/${UI}/Cursors/Cursor_01.png`, x: 22, y: 17 },
  pointer: { path: `assets/free/${UI}/Cursors/Cursor_02.png`, x: 28, y: 18 },
  forbidden: { path: `assets/free/${UI}/Cursors/Cursor_03.png`, x: 32, y: 32 },
};

/** Todas as spritesheets (base + todas as cores). */
export function allSheets(): SheetDef[] {
  return [...BASE_SHEETS, ...TEAM_COLORS.flatMap(teamSheets)];
}

/** Todas as imagens (base + todas as cores). */
export function allImages(): ImageDef[] {
  return [...BASE_IMAGES, ...TEAM_COLORS.flatMap(teamImages)];
}
