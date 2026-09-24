import Phaser from 'phaser';
import { TILE } from '../config';
import type { Building, Projectile, ResourceNode, Unit } from '../entities/Entity';
import { teamColor } from './palette';
import { buildingVisual, originY, UNIT_ORIGIN_Y, type Part } from './visuals';

const lerp = Phaser.Math.Linear;

// ------------------------------------------------------------------ unidades

function lancerDir(fy: number): string {
  if (fy < -0.8) return 'up';
  if (fy < -0.3) return 'upright';
  if (fy < 0.3) return 'right';
  if (fy < 0.8) return 'downright';
  return 'down';
}

/** Textura (tira do Free Pack) para o estado atual da unidade. A animação é `${textura}.play`. */
export function unitTexture(u: Unit, color: string): string {
  const s = u.def.sheet;
  const base = `${s}_${color}`;
  const pawn = s === 'pawn';
  switch (u.anim) {
    case 'run':
      return pawn && u.tool ? `${base}_run_${u.tool}` : `${base}_run`;
    case 'carryRun':
      return pawn && u.carry ? `${base}_run_${u.carry.res}` : `${base}_run`;
    case 'carryIdle':
      return pawn && u.carry ? `${base}_idle_${u.carry.res}` : `${base}_idle`;
    case 'work':
      return pawn ? `${base}_work_${u.tool ?? 'hammer'}` : `${base}_idle`;
    case 'guard':
      return s === 'warrior' || s === 'lancer' ? `${base}_guard` : `${base}_idle`;
    case 'attack':
      switch (s) {
        case 'pawn':
          return `${base}_work_knife`;
        case 'warrior':
          return `${base}_attack${u.attackSeq % 2 ? 2 : 1}`;
        case 'lancer':
          return `${base}_attack_${lancerDir(u.facingY)}`;
        case 'archer':
          return `${base}_shoot`;
        case 'monk':
          return `${base}_heal`;
      }
      return `${base}_idle`;
    default:
      return pawn && u.tool ? `${base}_idle_${u.tool}` : `${base}_idle`;
  }
}

export class UnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private color: string;
  private curTex = '';
  private seq = -1;
  seen = 0;

  constructor(scene: Phaser.Scene, u: Unit) {
    this.color = teamColor(u.team);
    const tex = `${u.def.sheet}_${this.color}_idle`;
    this.sprite = scene.add.sprite(u.x, u.y, tex).setOrigin(0.5, UNIT_ORIGIN_Y[u.def.sheet] ?? 0.7);
  }

  sync(u: Unit, alpha: number, visible: boolean): void {
    const x = lerp(u.prevX, u.x, alpha);
    const y = lerp(u.prevY, u.y, alpha);
    this.sprite.setPosition(x, y).setDepth(y).setVisible(visible && !u.hidden);
    this.sprite.setFlipX(u.facingX < 0);
    const tex = unitTexture(u, this.color);
    if (u.anim === 'attack') {
      // cada ataque reinicia a animação (tocada uma vez)
      if (u.attackSeq !== this.seq) {
        this.seq = u.attackSeq;
        this.curTex = tex;
        this.sprite.play(`${tex}.play`);
      }
    } else if (tex !== this.curTex) {
      this.curTex = tex;
      this.sprite.play({ key: `${tex}.play`, startFrame: 0 });
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

// ------------------------------------------------------------------ construções

export class BuildingView {
  readonly container: Phaser.GameObjects.Container;
  private state = '';
  private shooters: { sprite: Phaser.GameObjects.Sprite; idle: string; shoot: string }[] = [];
  private fires: Phaser.GameObjects.Sprite[] = [];
  private seq = 0;
  seen = 0;
  ruinUntil = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly b: Building,
  ) {
    const r = b.rect;
    this.container = scene.add.container(r.x + r.w / 2, r.y + r.h);
    this.seq = b.attackSeq;
  }

  private visual() {
    return buildingVisual(this.b.def.id, teamColor(this.b.team), this.b.id);
  }

  private build(parts: Part[]): void {
    this.container.removeAll(true);
    this.shooters = [];
    this.fires = [];
    for (const p of parts) {
      if (!this.scene.textures.exists(p.key)) continue;
      let o: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
      if (p.anim) {
        const frames = this.scene.anims.get(p.anim)?.frames.length ?? 1;
        o = this.scene.add.sprite(p.dx, p.dy, p.key).play({ key: p.anim, startFrame: Math.floor(Math.random() * frames) });
      } else o = this.scene.add.image(p.dx, p.dy, p.key, 0);
      o.setOrigin(0.5, p.originY ?? originY(p.key) ?? 1).setFlipX(!!p.flip);
      this.container.add(o);
      if (p.shooter && p.anim && o instanceof Phaser.GameObjects.Sprite) this.shooters.push({ sprite: o, idle: p.anim, shoot: p.shooter });
    }
  }

  sync(b: Building, visible: boolean): void {
    const state = b.complete ? 'complete' : 'construction';
    if (state !== this.state) {
      this.state = state;
      const vis = this.visual();
      this.build(state === 'complete' ? vis.parts : vis.construction);
    }
    // fogo quando danificada
    const wantFires = b.complete ? (b.hp < b.maxHp * 0.25 ? 3 : b.hp < b.maxHp * 0.5 ? 2 : b.hp < b.maxHp * 0.75 ? 1 : 0) : 0;
    while (this.fires.length < wantFires) {
      const i = this.fires.length;
      const spread = b.def.w * TILE * 0.28;
      const f = this.scene.add
        .sprite([-1, 1, 0][i] * spread, -b.def.h * TILE * (0.55 + i * 0.15), `fire${(i % 3) + 1}`)
        .play({ key: `fire${(i % 3) + 1}.play`, startFrame: i * 2 })
        .setOrigin(0.5, 1)
        .setScale(1.3);
      this.container.add(f);
      this.fires.push(f);
    }
    while (this.fires.length > wantFires) this.fires.pop()!.destroy();
    // arqueiro no topo da torre
    if (b.attackSeq !== this.seq) {
      this.seq = b.attackSeq;
      for (const s of this.shooters) {
        s.sprite.play(s.shoot);
        s.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.sprite.active && s.sprite.play(s.idle));
      }
    }
    this.container.setDepth(b.rect.y + b.rect.h).setVisible(visible);
  }

  /** Troca para as ruínas e some depois de um tempo. */
  toRuin(now: number): void {
    this.state = 'ruin';
    this.build(this.visual().destroyed);
    this.ruinUntil = now + 30_000;
    this.container.setDepth(this.b.rect.y + this.b.rect.h - 40);
  }

  destroy(): void {
    this.container.destroy();
  }
}

// ------------------------------------------------------------------ recursos

/** Base visível das árvores e tocos (y da base / altura do quadro). */
const TREE_ORIGIN = [240 / 256, 248 / 256, 169 / 192, 167 / 192];
const STUMP_ORIGIN = [239 / 256, 244 / 256, 231 / 256, 227 / 256];

export class ResourceView {
  readonly obj: Phaser.GameObjects.Sprite;
  private pile: Phaser.GameObjects.Image | null = null;
  private hitSeq = 0;
  private variant: number;
  private goldSize = 0;
  private goldShine = false;
  private grazeTimer = 0;
  seen = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly r: ResourceNode,
  ) {
    const k = r.def.kind;
    this.variant = (r.id * 7) % 4;
    if (k === 'tree') {
      const n = this.variant + 1;
      this.obj = scene.add
        .sprite(r.tx * TILE + TILE / 2, r.ty * TILE + 56, `tree${n}`)
        .setOrigin(0.5, TREE_ORIGIN[this.variant])
        .play({ key: `tree${n}.play`, startFrame: r.id % 8 });
    } else if (k === 'goldMine') {
      // jazida: pedra dourada centrada no footprint; encolhe conforme se esgota
      this.obj = scene.add.sprite(r.x, r.y, 'gold_stone6').setOrigin(0.5, 0.5).setScale(1.25);
    } else {
      this.obj = scene.add.sprite(r.x, r.y, 'sheep_idle').setOrigin(0.5, 0.66).play({ key: 'sheep_idle.play', startFrame: r.id % 6 });
    }
    this.obj.setDepth(k === 'goldMine' ? r.rect.y + r.rect.h - 8 : this.obj.y);
    this.hitSeq = r.hitSeq;
  }

  private shake(): void {
    const x = this.obj.x;
    this.scene.tweens.add({ targets: this.obj, x: x + 3, duration: 50, yoyo: true, repeat: 1, onComplete: () => this.obj.setX(x) });
  }

  sync(r: ResourceNode, alpha: number, visible: boolean): void {
    this.obj.setVisible(visible && !this.pile);
    const k = r.def.kind;
    if (k === 'tree') {
      if (r.hitSeq !== this.hitSeq) {
        this.hitSeq = r.hitSeq;
        this.shake();
      }
      return;
    }
    if (k === 'goldMine') {
      // jazidas maiores começam com pedras maiores e encolhem conforme se esgotam
      const start = r.maxAmount >= 3000 ? 6 : r.maxAmount >= 2000 ? 5 : 4;
      const size = Phaser.Math.Clamp(Math.ceil((r.amount / r.maxAmount) * start), 1, start);
      const shine = r.workers.size > 0;
      if (size !== this.goldSize || shine !== this.goldShine) {
        this.goldSize = size;
        this.goldShine = shine;
        if (shine) this.obj.play(`gold_stone${size}_hl.play`);
        else this.obj.stop().setTexture(`gold_stone${size}`);
      }
      if (r.hitSeq !== this.hitSeq) {
        this.hitSeq = r.hitSeq;
        this.shake();
      }
      return;
    }
    // ovelha
    if (r.isPile) {
      if (!this.pile) {
        this.pile = this.scene.add.image(r.x, r.y + 6, 'meat_res').setOrigin(0.5, 0.8).setDepth(r.y);
        this.scene.tweens.add({ targets: this.pile, scale: { from: 0.4, to: 1 }, duration: 250, ease: 'Back.Out' });
      }
      this.pile.setVisible(visible);
      return;
    }
    const x = lerp(r.prevX, r.x, alpha);
    const y = lerp(r.prevY, r.y, alpha);
    const moving = Math.abs(r.x - r.prevX) + Math.abs(r.y - r.prevY) > 0.05;
    let want = this.obj.anims.currentAnim?.key ?? 'sheep_idle.play';
    if (moving) want = 'sheep_move.play';
    else if (want === 'sheep_move.play') want = 'sheep_idle.play';
    else {
      // parada: alterna entre olhar em volta e pastar
      this.grazeTimer -= 1;
      if (this.grazeTimer <= 0) {
        this.grazeTimer = 120 + ((r.id * 37) % 180);
        want = want === 'sheep_grass.play' ? 'sheep_idle.play' : 'sheep_grass.play';
      }
    }
    if (this.obj.anims.currentAnim?.key !== want) this.obj.play(want);
    if (Math.abs(r.x - r.prevX) > 0.02) this.obj.setFlipX(r.x < r.prevX);
    this.obj.setPosition(x, y).setDepth(y);
  }

  /** Recurso esgotado: árvore vira toco (fica no mapa), ouro e carne somem. */
  deplete(): boolean {
    if (this.r.def.kind === 'tree') {
      const n = this.variant + 1;
      this.obj.stop().setTexture(`stump${n}`).setOrigin(0.5, STUMP_ORIGIN[this.variant]).setDepth(this.obj.y - 60);
      return true;
    }
    this.destroy();
    return false;
  }

  destroy(): void {
    this.obj.destroy();
    this.pile?.destroy();
  }
}

// ------------------------------------------------------------------ projéteis

export class ProjectileView {
  readonly obj: Phaser.GameObjects.Image;
  seen = 0;

  constructor(scene: Phaser.Scene, p: Projectile) {
    this.obj = scene.add.image(p.x, p.y, `arrow_${teamColor(p.team)}`).setOrigin(0.5);
  }

  sync(p: Projectile, alpha: number, visible: boolean): void {
    const x = lerp(p.prevX, p.x, alpha);
    const y = lerp(p.prevY, p.y, alpha);
    this.obj.setPosition(x, y - 24).setRotation(p.angle).setDepth(y + 60).setVisible(visible);
  }

  destroy(): void {
    this.obj.destroy();
  }
}
