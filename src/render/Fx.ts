import Phaser from 'phaser';
import { FONT, TILE } from '../config';
import type { GameEvent } from '../core/EventBus';
import { S } from '../i18n/t';
import type { World } from '../systems/World';

/** Efeitos visuais disparados por eventos da simulação (partículas do Free Pack). */
export class Fx {
  private off: () => void;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
  ) {
    this.off = world.events.on((e) => this.onEvent(e));
  }

  private visible(x: number, y: number): boolean {
    return this.world.vision.pointVisible(x, y);
  }

  /** Toca uma animação única e remove o sprite no fim. */
  private burst(key: string, x: number, y: number, depth: number, scale = 1): Phaser.GameObjects.Sprite {
    const s = this.scene.add.sprite(x, y, key).setDepth(depth).setScale(scale);
    s.play(`${key}.play`).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    return s;
  }

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'healed': {
        if (!this.visible(e.x, e.y)) return;
        this.burst('heal_fx', e.x, e.y - 30, e.y + 2);
        break;
      }
      case 'unitTrained': {
        const u = this.world.getUnit(e.id);
        if (u && (e.team === 0 || this.visible(u.x, u.y))) this.burst('dust1', u.x, u.y - 10, u.y + 1, 1.3);
        break;
      }
      case 'buildingCompleted': {
        const b = this.world.getBuilding(e.id);
        if (!b || (e.team !== 0 && !this.visible(b.x, b.y))) return;
        const r = b.rect;
        for (let i = 0; i < b.def.w; i++) this.burst('dust2', r.x + i * TILE + TILE / 2, r.y + r.h - 10, r.y + r.h + 1, 1.2);
        break;
      }
      case 'unitDied': {
        if (e.team !== 0 && !this.visible(e.x, e.y)) return;
        this.burst('dust1', e.x, e.y - 12, e.y);
        const s = this.scene.add.sprite(e.x, e.y, 'dead').setOrigin(0.5, 0.66).setDepth(e.y - 1);
        s.play('dead.die');
        s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          this.scene.time.delayedCall(1500, () => {
            if (!s.active) return;
            s.play('dead.fade').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
          });
        });
        break;
      }
      case 'buildingDestroyed': {
        if (e.team !== 0 && !this.visible(e.x, e.y)) return;
        for (let i = 0; i < 3; i++) {
          this.scene.time.delayedCall(i * 150, () => {
            this.burst('explosion2', e.x + Phaser.Math.Between(-50, 50), e.y + Phaser.Math.Between(-30, 30), e.y + 200, 1.2);
          });
        }
        this.burst('dust2', e.x, e.y + 20, e.y + 201, 2);
        this.scene.cameras.main.shake(200, 0.005);
        break;
      }
      case 'deposit': {
        if (e.team !== 0) return;
        const color = e.res === 'gold' ? '#f7d154' : e.res === 'wood' ? '#e3b27a' : '#ff9b8a';
        const t = this.scene.add
          .text(e.x + Phaser.Math.Between(-20, 20), e.y, `+${e.amount} ${S.res[e.res]}`, {
            fontFamily: FONT,
            fontSize: '16px',
            color,
            stroke: '#2b1d12',
            strokeThickness: 3,
            resolution: 2,
          })
          .setOrigin(0.5)
          .setDepth(1e6);
        this.scene.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
        break;
      }
    }
  }

  destroy(): void {
    this.off();
  }
}
