import Phaser from 'phaser';
import { DEBUG, SIM_DT, TILE } from '../config';
import type { DifficultyLevel } from '../data/difficulty';
import { newSession, type Session } from '../game/Session';
import { S, fmt } from '../i18n/t';
import { CameraController } from '../input/CameraController';
import { WorldInput } from '../input/WorldInput';
import { Fog } from '../render/Fog';
import { Fx } from '../render/Fx';
import { Overlay } from '../render/Overlay';
import { drawTerrain } from '../render/Terrain';
import { ViewManager } from '../render/ViewManager';

/** Cena do mundo: roda a simulação em passo fixo e desenha tudo interpolado. */
export class GameScene extends Phaser.Scene {
  session!: Session;
  camCtl!: CameraController;
  private views!: ViewManager;
  private fx!: Fx;
  private fog!: Fog;
  private overlay!: Overlay;
  private worldInput!: WorldInput;
  private acc = 0;
  private perfText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Game');
  }

  init(data: { seed: number; difficulty: DifficultyLevel }): void {
    this.session = newSession(data.seed ?? Date.now(), data.difficulty ?? 'normal');
    this.acc = 0;
  }

  create(): void {
    const s = this.session;
    const w = s.world;
    drawTerrain(this, w.map);
    this.views = new ViewManager(this, w);
    this.fx = new Fx(this, w);
    this.fog = new Fog(this, w);
    this.overlay = new Overlay(this, s);
    this.camCtl = new CameraController(this, w.map.w * TILE, w.map.h * TILE);
    this.worldInput = new WorldInput(this, s, this.camCtl, this.overlay);

    const castle = w.mainBuilding(0);
    if (castle) this.camCtl.centerOn(castle.x, castle.y - TILE);

    // eventos da simulação que viram avisos para o jogador
    w.events.on((e) => {
      switch (e.type) {
        case 'underAttack':
          if (e.team === 0) {
            s.lastAlert = { x: e.x, y: e.y };
            s.toast(e.building ? S.msg.underAttack : S.msg.unitsUnderAttack, '#ff9b8a');
            s.ui.emit('alert', e.x, e.y);
          }
          break;
        case 'popCapped':
          if (e.team === 0) s.toast(S.msg.popCap, '#f7d154');
          break;
        case 'buildingCompleted':
          if (e.team === 0) {
            const b = w.getBuilding(e.id);
            if (b) s.toast(fmt(S.msg.buildingDone, { name: S.buildings[b.def.id].name }));
          }
          break;
        case 'attackWave':
          s.toast(S.msg.goblinsAttack, '#ff9b8a');
          break;
        case 'gameOver':
          s.ui.emit('gameOver', e.winner);
          this.game.canvas.style.cursor = 'default';
          break;
      }
    });

    this.scene.launch('Hud');
    this.scene.bringToTop('Hud');

    const onUnload = (ev: BeforeUnloadEvent) => {
      if (this.session.world.winner === null) {
        ev.preventDefault();
        ev.returnValue = S.menu.confirmLeave;
      }
    };
    window.addEventListener('beforeunload', onUnload);

    if (DEBUG.perf) this.perfText = this.add.text(8, 48, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff' }).setScrollFactor(0).setDepth(1e7);

    this.events.once('shutdown', () => {
      window.removeEventListener('beforeunload', onUnload);
      this.worldInput.destroy();
      this.fx.destroy();
      this.views.destroyAll();
      this.fog.destroy();
      this.overlay.destroy();
      this.game.canvas.style.cursor = 'default';
    });
  }

  update(_time: number, delta: number): void {
    const s = this.session;
    const w = s.world;
    const p = this.input.activePointer;
    this.camCtl.update(delta, p, !s.paused && w.winner === null);

    if (!s.paused && w.winner === null) {
      this.acc += (Math.min(delta, 250) / 1000) * s.speed;
      let steps = 0;
      while (this.acc >= SIM_DT && steps < 12) {
        w.step(SIM_DT);
        this.acc -= SIM_DT;
        steps++;
      }
      if (steps === 12) this.acc = 0;
    }
    const alpha = Phaser.Math.Clamp(this.acc / SIM_DT, 0, 1);
    this.views.sync(alpha);
    this.fog.update();
    this.worldInput.update();
    this.overlay.draw({ dragBox: this.worldInput.dragBox, hoverId: this.worldInput.hoverId, ghost: this.worldInput.ghost });
    if (s.pruneSelection()) s.ui.emit('selection');

    if (this.perfText) {
      this.perfText.setText(
        `FPS ${this.game.loop.actualFps.toFixed(0)} · unidades ${w.units.length} · caminhos pendentes ${w.paths.pending} · objetos ${this.children.length}`,
      );
    }
  }

  /** Reinicia com um novo mapa e a mesma dificuldade. */
  restart(): void {
    const diff = this.session.difficulty;
    this.scene.stop('Hud');
    this.scene.restart({ seed: Math.floor(Math.random() * 1e9), difficulty: diff });
  }

  quitToMenu(): void {
    this.scene.stop('Hud');
    this.scene.start('Menu');
  }
}
