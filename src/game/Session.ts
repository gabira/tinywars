import Phaser from 'phaser';
import { RivalAI } from '../ai/RivalAI';
import { DEBUG } from '../config';
import type { DifficultyLevel } from '../data/difficulty';
import type { BuildingId } from '../data/types';
import type { TeamColor } from '../render/palette';
import { World } from '../systems/World';

export type InputMode = 'normal' | 'place' | 'attackMove';

/** Estado compartilhado entre GameScene (mundo) e HudScene (interface). */
export class Session {
  readonly world: World;
  readonly ai: RivalAI;
  readonly ui = new Phaser.Events.EventEmitter();
  selection: number[] = [];
  mode: InputMode = 'normal';
  placing: BuildingId | null = null;
  buildMenu = false;
  paused = false;
  speed = 1;
  groups = new Map<number, number[]>();
  lastAlert: { x: number; y: number } | null = null;

  constructor(
    readonly seed: number,
    readonly difficulty: DifficultyLevel,
    /** Cor do exército do jogador (só visual). */
    readonly color: TeamColor,
  ) {
    this.world = new World({ seed, difficulty, fog: !DEBUG.noFog });
    this.ai = new RivalAI(this.world, 1);
    this.world.controllers.push(this.ai);
    if (DEBUG.fast) this.speed = 4;
  }

  /** Remove da seleção entidades mortas ou que não existem mais. */
  pruneSelection(): boolean {
    const before = this.selection.length;
    this.selection = this.selection.filter((id) => {
      const e = this.world.get(id);
      return !!e && e.alive;
    });
    return before !== this.selection.length;
  }

  setSelection(ids: number[]): void {
    this.selection = ids;
    this.buildMenu = false;
    if (this.mode !== 'normal') this.cancelMode();
    this.ui.emit('selection');
  }

  cancelMode(): void {
    this.mode = 'normal';
    this.placing = null;
    this.ui.emit('mode');
  }

  startPlacing(id: BuildingId): void {
    this.mode = 'place';
    this.placing = id;
    this.ui.emit('mode');
  }

  toast(text: string, color?: string): void {
    this.ui.emit('toast', text, color);
  }
}

let current: Session | null = null;

export function getSession(): Session {
  if (!current) throw new Error('Sessão não iniciada');
  return current;
}

export function newSession(seed: number, difficulty: DifficultyLevel, color: TeamColor): Session {
  current?.ui.removeAllListeners();
  current?.world.events.clear();
  current = new Session(seed, difficulty, color);
  return current;
}
