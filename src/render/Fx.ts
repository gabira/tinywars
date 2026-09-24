import Phaser from 'phaser';
import { FONT } from '../config';
import type { GameEvent } from '../core/EventBus';
import { S } from '../i18n/t';
import type { World } from '../systems/World';

/** Efeitos visuais disparados por eventos da simulação. */
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

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'explosion': {
        if (!this.visible(e.x, e.y)) return;
        const s = this.scene.add.sprite(e.x, e.y - 20, 'explosion').setDepth(e.y + 80).setScale(Math.max(0.8, e.radius / 60));
        s.play('explosion.play').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
        this.scene.cameras.main.shake(90, e.radius > 80 ? 0.004 : 0.0015);
        break;
      }
      case 'unitDied': {
        if (e.team !== 0 && !this.visible(e.x, e.y)) return;
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
          this.scene.time.delayedCall(i * 140, () => {
            const s = this.scene.add
              .sprite(e.x + Phaser.Math.Between(-50, 50), e.y + Phaser.Math.Between(-30, 30), 'explosion')
              .setDepth(e.y + 200)
              .setScale(1.3);
            s.play('explosion.play').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
          });
        }
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
