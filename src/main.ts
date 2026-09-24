import Phaser from 'phaser';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import { COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MissingAssetsScene } from './scenes/MissingAssetsScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { DebugAnimScene } from './scenes/DebugAnimScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.water,
  pixelArt: true,
  roundPixels: true,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: { mouse: { preventDefaultWheel: true } },
  scene: [BootScene, PreloadScene, MissingAssetsScene, MenuScene, GameScene, HudScene, DebugAnimScene],
});

// facilita depuração no console do navegador
(window as unknown as { game: Phaser.Game }).game = game;
