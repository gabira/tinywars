// Manifesto único de assets (caminhos relativos a public/assets/<pack>/).
// Grades e linhas de animação medidas com `npm run assets:inspect` e conferidas visualmente.

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

const COLORS = { blue: 'Blue', red: 'Red' } as const;
type Color = keyof typeof COLORS;

const once = (row: number, frames: number, fps = 10): AnimDef => ({ row, frames, fps, repeat: 0 });
const loop = (row: number, frames: number, fps = 10): AnimDef => ({ row, frames, fps, repeat: -1 });

function troopSheets(color: Color): SheetDef[] {
  const C = COLORS[color];
  const K = 'Factions/Knights/Troops';
  const G = 'Factions/Goblins/Troops';
  return [
    {
      key: `pawn_${color}`, pack: 'legacy', path: `${K}/Pawn/${C}/Pawn_${C}.png`, frameWidth: 192, frameHeight: 192,
      anims: {
        idle: loop(0, 6), run: loop(1, 6), build: loop(2, 6), chop: loop(3, 6), carryIdle: loop(4, 6), carryRun: loop(5, 6),
      },
    },
    {
      key: `warrior_${color}`, pack: 'legacy', path: `${K}/Warrior/${C}/Warrior_${C}.png`, frameWidth: 192, frameHeight: 192,
      anims: {
        idle: loop(0, 6), run: loop(1, 6),
        atkRight: once(2, 6), atkRight2: once(3, 6), atkDown: once(4, 6), atkDown2: once(5, 6), atkUp: once(6, 6), atkUp2: once(7, 6),
      },
    },
    {
      key: `archer_${color}`, pack: 'legacy', path: `${K}/Archer/${C}/Archer_${C === 'Blue' ? 'Blue' : 'Red'}.png`, frameWidth: 192, frameHeight: 192,
      anims: {
        idle: loop(0, 6), run: loop(1, 6),
        shootUp: once(2, 8, 13), shootUpRight: once(3, 8, 13), shootRight: once(4, 8, 13), shootDownRight: once(5, 8, 13), shootDown: once(6, 8, 13),
      },
    },
    {
      key: `torch_${color}`, pack: 'legacy', path: `${G}/Torch/${C}/Torch_${C}.png`, frameWidth: 192, frameHeight: 192,
      anims: { idle: loop(0, 7), run: loop(1, 6), atkRight: once(2, 6), atkDown: once(3, 6), atkUp: once(4, 6) },
    },
    {
      key: `tnt_${color}`, pack: 'legacy', path: `${G}/TNT/${C}/TNT_${C}.png`, frameWidth: 192, frameHeight: 192,
      anims: { idle: loop(0, 6), run: loop(1, 6), throw: once(2, 7, 12) },
    },
    {
      key: `barrel_${color}`, pack: 'legacy', path: `${G}/Barrel/${C}/Barrel_${C}.png`, frameWidth: 128, frameHeight: 128,
      anims: {
        hidden: loop(0, 1), popOut: once(1, 6), awake: loop(2, 1), hide: once(3, 6), run: loop(4, 3), ignite: once(5, 3, 8),
      },
    },
  ];
}

export const SHEETS: SheetDef[] = [
  ...troopSheets('blue'),
  ...troopSheets('red'),
  { key: 'dynamite', pack: 'legacy', path: 'Factions/Goblins/Troops/TNT/Dynamite/Dynamite.png', frameWidth: 64, frameHeight: 64, anims: { spin: loop(0, 6, 14) } },
  { key: 'arrow', pack: 'legacy', path: 'Factions/Knights/Troops/Archer/Arrow/Arrow.png', frameWidth: 64, frameHeight: 64 },
  { key: 'dead', pack: 'legacy', path: 'Factions/Knights/Troops/Dead/Dead.png', frameWidth: 128, frameHeight: 128, anims: { die: once(0, 7), fade: once(1, 7, 6) } },
  { key: 'tree', pack: 'legacy', path: 'Resources/Trees/Tree.png', frameWidth: 192, frameHeight: 192, anims: { idle: loop(0, 4, 6), hit: once(1, 2, 8), stump: loop(2, 1) } },
  { key: 'sheep', pack: 'legacy', path: 'Resources/Sheep/HappySheep_All.png', frameWidth: 128, frameHeight: 128, anims: { idle: loop(0, 8), bounce: loop(1, 6) } },
  { key: 'explosion', pack: 'legacy', path: 'Effects/Explosion/Explosions.png', frameWidth: 192, frameHeight: 192, anims: { play: once(0, 9, 14) } },
  { key: 'fire', pack: 'legacy', path: 'Effects/Fire/Fire.png', frameWidth: 128, frameHeight: 128, anims: { play: loop(0, 7) } },
  { key: 'foam', pack: 'legacy', path: 'Terrain/Water/Foam/Foam.png', frameWidth: 192, frameHeight: 192, anims: { play: loop(0, 8, 8) } },
  { key: 'wood_tower_red', pack: 'legacy', path: 'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Red.png', frameWidth: 256, frameHeight: 192, anims: { idle: loop(0, 4, 8) } },
  { key: 'wood_tower_blue', pack: 'legacy', path: 'Factions/Goblins/Buildings/Wood_Tower/Wood_Tower_Blue.png', frameWidth: 256, frameHeight: 192, anims: { idle: loop(0, 4, 8) } },
  { key: 'g_spawn', pack: 'legacy', path: 'Resources/Resources/G_Spawn.png', frameWidth: 128, frameHeight: 128, anims: { play: once(0, 7, 14) } },
  { key: 'w_spawn', pack: 'legacy', path: 'Resources/Resources/W_Spawn.png', frameWidth: 128, frameHeight: 128, anims: { play: once(0, 7, 14) } },
  { key: 'm_spawn', pack: 'legacy', path: 'Resources/Resources/M_Spawn.png', frameWidth: 128, frameHeight: 128, anims: { play: once(0, 7, 14) } },
  { key: 'rocks_01', pack: 'legacy', path: 'Terrain/Water/Rocks/Rocks_01.png', frameWidth: 128, frameHeight: 128, anims: { play: loop(0, 8, 6) } },
  { key: 'rocks_02', pack: 'legacy', path: 'Terrain/Water/Rocks/Rocks_02.png', frameWidth: 128, frameHeight: 128, anims: { play: loop(0, 8, 6) } },
  { key: 'rocks_03', pack: 'legacy', path: 'Terrain/Water/Rocks/Rocks_03.png', frameWidth: 128, frameHeight: 128, anims: { play: loop(0, 8, 6) } },
  { key: 'tiles_flat', pack: 'legacy', path: 'Terrain/Ground/Tilemap_Flat.png', frameWidth: 64, frameHeight: 64 },
];

const img = (key: string, path: string, pack: Pack = 'legacy', optional = false): ImageDef => ({ key, pack, path, optional });
const KB = 'Factions/Knights/Buildings';
const GB = 'Factions/Goblins/Buildings';
const FUI = 'UI Elements/UI Elements';

export const IMAGES: ImageDef[] = [
  img('water', 'Terrain/Water/Water.png'),
  img('castle_blue', `${KB}/Castle/Castle_Blue.png`),
  img('castle_red', `${KB}/Castle/Castle_Red.png`),
  img('castle_construction', `${KB}/Castle/Castle_Construction.png`),
  img('castle_destroyed', `${KB}/Castle/Castle_Destroyed.png`),
  img('house_blue', `${KB}/House/House_Blue.png`),
  img('house_construction', `${KB}/House/House_Construction.png`),
  img('house_destroyed', `${KB}/House/House_Destroyed.png`),
  img('tower_blue', `${KB}/Tower/Tower_Blue.png`),
  img('tower_construction', `${KB}/Tower/Tower_Construction.png`),
  img('tower_destroyed', `${KB}/Tower/Tower_Destroyed.png`),
  img('goblin_house', `${GB}/Wood_House/Goblin_House.png`),
  img('goblin_house_destroyed', `${GB}/Wood_House/Goblin_House_Destroyed.png`),
  img('wood_tower_construction', `${GB}/Wood_Tower/Wood_Tower_InConstruction.png`),
  img('wood_tower_destroyed', `${GB}/Wood_Tower/Wood_Tower_Destroyed.png`),
  img('goldmine_active', 'Resources/Gold Mine/GoldMine_Active.png'),
  img('goldmine_inactive', 'Resources/Gold Mine/GoldMine_Inactive.png'),
  img('goldmine_destroyed', 'Resources/Gold Mine/GoldMine_Destroyed.png'),
  img('g_idle', 'Resources/Resources/G_Idle.png'),
  img('w_idle', 'Resources/Resources/W_Idle.png'),
  img('m_idle', 'Resources/Resources/M_Idle.png'),
  ...Array.from({ length: 18 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return img(`deco_${n}`, `Deco/${n}.png`);
  }),
  // UI (versão antiga)
  img('ui_carved9', 'UI/Banners/Carved_9Slides.png'),
  img('ui_carved3', 'UI/Banners/Carved_3Slides.png'),
  img('ui_banner_h', 'UI/Banners/Banner_Horizontal.png'),
  img('ui_banner_v', 'UI/Banners/Banner_Vertical.png'),
  img('ui_btn_blue', 'UI/Buttons/Button_Blue.png'),
  img('ui_btn_blue_pressed', 'UI/Buttons/Button_Blue_Pressed.png'),
  img('ui_btn_hover', 'UI/Buttons/Button_Hover.png'),
  img('ui_btn_disable', 'UI/Buttons/Button_Disable.png'),
  img('ui_btn_red', 'UI/Buttons/Button_Red.png'),
  img('ui_btn_blue3', 'UI/Buttons/Button_Blue_3Slides.png'),
  img('ui_btn_blue3_pressed', 'UI/Buttons/Button_Blue_3Slides_Pressed.png'),
  img('ui_btn_hover3', 'UI/Buttons/Button_Hover_3Slides.png'),
  img('ui_btn_red3', 'UI/Buttons/Button_Red_3Slides.png'),
  img('ui_btn_red3_pressed', 'UI/Buttons/Button_Red_3Slides_Pressed.png'),
  img('ui_btn_disable3', 'UI/Buttons/Button_Disable_3Slides.png'),
  img('ui_ribbon_blue', 'UI/Ribbons/Ribbon_Blue_3Slides.png'),
  img('ui_ribbon_red', 'UI/Ribbons/Ribbon_Red_3Slides.png'),
  img('ui_ribbon_yellow', 'UI/Ribbons/Ribbon_Yellow_3Slides.png'),
  img('ui_icon_x', 'UI/Icons/Regular_01.png'),
  img('ui_icon_gear', 'UI/Icons/Regular_02.png'),
  // Free Pack (opcional): quartel e ícones melhores
  img('barracks_blue', 'Buildings/Blue Buildings/Barracks.png', 'free', true),
  img('icon_hammer', `${FUI}/Icons/Icon_01.png`, 'free', true),
  img('icon_wood', `${FUI}/Icons/Icon_02.png`, 'free', true),
  img('icon_gold', `${FUI}/Icons/Icon_03.png`, 'free', true),
  img('icon_meat', `${FUI}/Icons/Icon_04.png`, 'free', true),
  img('icon_sword', `${FUI}/Icons/Icon_05.png`, 'free', true),
  img('icon_shield', `${FUI}/Icons/Icon_06.png`, 'free', true),
  img('icon_move', `${FUI}/Icons/Icon_07.png`, 'free', true),
  img('icon_back', `${FUI}/Icons/Icon_08.png`, 'free', true),
  img('icon_stop', `${FUI}/Icons/Icon_09.png`, 'free', true),
  img('icon_gear', `${FUI}/Icons/Icon_10.png`, 'free', true),
];

/** Todos os caminhos de assets usados (para validação/testes). */
export function allAssetPaths(): { pack: Pack; path: string; optional: boolean }[] {
  return [
    ...SHEETS.map((s) => ({ pack: s.pack, path: s.path, optional: !!s.optional })),
    ...IMAGES.map((i) => ({ pack: i.pack, path: i.path, optional: !!i.optional })),
  ];
}
