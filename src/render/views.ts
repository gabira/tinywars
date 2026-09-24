import Phaser from 'phaser';
import { TILE } from '../config';
import { TEAMS } from '../data/factions';
import type { Building, Projectile, ResourceNode, Unit } from '../entities/Entity';
import { buildingVisual, ORIGIN_Y, UNIT_ORIGIN_Y, type Part } from './visuals';

const lerp = Phaser.Math.Linear;

// ------------------------------------------------------------------ unidades

function dir3(fy: number): string {
  return fy < -0.6 ? 'atkUp' : fy > 0.6 ? 'atkDown' : 'atkRight';
}

function dir5(fy: number): string {
  if (fy < -0.8) return 'shootUp';
  if (fy < -0.3) return 'shootUpRight';
  if (fy < 0.3) return 'shootRight';
  if (fy < 0.8) return 'shootDownRight';
  return 'shootDown';
}

/** Nome da animação da spritesheet para o estado lógico da unidade. */
export function unitAnimName(u: Unit): string {
  const s = u.def.sheet;
  const worker = s === 'pawn';
  switch (u.anim) {
    case 'idle':
      return s === 'barrel' ? 'hidden' : 'idle';
    case 'run':
      return 'run';
    case 'carryIdle':
      return worker ? 'carryIdle' : 'idle';
    case 'carryRun':
      return worker ? 'carryRun' : 'run';
    case 'chop':
      return worker ? 'chop' : 'idle';
    case 'build':
      return worker ? 'build' : 'idle';
    case 'attack':
      switch (s) {
        case 'pawn':
          return 'chop';
        case 'warrior':
          return dir3(u.facingY) + (u.attackSeq % 2 ? '2' : '');
        case 'torch':
          return dir3(u.facingY);
        case 'archer':
          return dir5(u.facingY);
        case 'tnt':
          return 'throw';
        case 'barrel':
          return 'ignite';
      }
  }
  return 'idle';
}

const CARRY_ICON = { gold: 'g_idle', wood: 'w_idle', meat: 'm_idle' } as const;

export class UnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private carryIcon: Phaser.GameObjects.Image | null = null;
  private sheetKey: string;
  private curAnim = '';
  private seq = -1;
  seen = 0;

  constructor(
    private scene: Phaser.Scene,
    u: Unit,
  ) {
    this.sheetKey = `${u.def.sheet}_${TEAMS[u.team].color}`;
    this.sprite = scene.add.sprite(u.x, u.y, this.sheetKey).setOrigin(0.5, UNIT_ORIGIN_Y[u.def.sheet] ?? 0.68);
  }

  sync(u: Unit, alpha: number, visible: boolean): void {
    const x = lerp(u.prevX, u.x, alpha);
    const y = lerp(u.prevY, u.y, alpha);
    const show = visible && !u.hidden;
    this.sprite.setPosition(x, y).setDepth(y).setVisible(show);
    this.sprite.setFlipX(u.facingX < 0);
    const anim = `${this.sheetKey}.${unitAnimName(u)}`;
    if (u.anim === 'attack') {
      if (u.attackSeq !== this.seq) {
        this.seq = u.attackSeq;
        this.curAnim = anim;
        this.sprite.play(anim);
      }
    } else if (anim !== this.curAnim) {
      this.curAnim = anim;
      this.sprite.play({ key: anim, startFrame: 0 });
    }
    const carrying = u.carry && u.carry.amount > 0 && u.def.sheet === 'pawn' && show;
    if (carrying) {
      const key = CARRY_ICON[u.carry!.res];
      if (!this.carryIcon) this.carryIcon = this.scene.add.image(x, y, key).setScale(0.55).setOrigin(0.54, 0.62);
      this.carryIcon.setTexture(key).setPosition(x, y - 54).setDepth(y + 0.5).setVisible(true);
    } else if (this.carryIcon) this.carryIcon.setVisible(false);
  }

  destroy(): void {
    this.sprite.destroy();
    this.carryIcon?.destroy();
  }
}

// ------------------------------------------------------------------ construções

export class BuildingView {
  readonly container: Phaser.GameObjects.Container;
  private state = '';
  private objs: (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite)[] = [];
  private shooters: { sprite: Phaser.GameObjects.Sprite; idle: string; shoot: string }[] = [];
  private fires: Phaser.GameObjects.Sprite[] = [];
  private seq = 0;
  seen = 0;
  ruinUntil = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly b: Building,
    private hasBarracksArt: boolean,
  ) {
    const r = b.rect;
    this.container = scene.add.container(r.x + r.w / 2, r.y + r.h);
    this.seq = b.attackSeq;
  }

  private build(parts: Part[]): void {
    this.container.removeAll(true);
    this.objs = [];
    this.shooters = [];
    this.fires = [];
    for (const p of parts) {
      if (!this.scene.textures.exists(p.key)) continue;
      const o = p.anim ? this.scene.add.sprite(p.dx, p.dy, p.key).play({ key: p.anim, startFrame: Math.floor(Math.random() * (this.scene.anims.get(p.anim)?.frames.length ?? 1)) }) : this.scene.add.image(p.dx, p.dy, p.key, 0);
      o.setOrigin(0.5, ORIGIN_Y[p.key] ?? 1).setFlipX(!!p.flip);
      this.container.add(o);
      this.objs.push(o);
      if (p.shooter && p.anim && o instanceof Phaser.GameObjects.Sprite) this.shooters.push({ sprite: o, idle: p.anim, shoot: p.shooter });
    }
  }

  sync(b: Building, visible: boolean): void {
    const vis = buildingVisual(b.def.id, this.hasBarracksArt);
    const state = b.complete ? 'complete' : 'construction';
    if (state !== this.state) {
      this.state = state;
      if (state === 'complete' || vis.construction === 'crop') this.build(vis.parts);
      else this.build(vis.construction as Part[]);
    }
    if (state === 'construction' && vis.construction === 'crop') {
      const p = 0.15 + 0.85 * b.progress;
      for (const o of this.objs) {
        const h = o.frame.height;
        o.setCrop(0, h * (1 - p) * (ORIGIN_Y[o.texture.key] ?? 1), o.frame.width, h);
        o.setTint(0xc8c0b0);
      }
    } else if (state === 'complete' && this.objs.length && this.objs[0].isCropped) {
      for (const o of this.objs) o.setCrop().clearTint();
    }
    // fogo quando danificada
    const wantFires = b.complete ? (b.hp < b.maxHp * 0.25 ? 2 : b.hp < b.maxHp * 0.5 ? 1 : 0) : 0;
    while (this.fires.length < wantFires) {
      const i = this.fires.length;
      const f = this.scene.add
        .sprite((i ? 1 : -1) * b.def.w * TILE * 0.18, -b.def.h * TILE * 0.75 - i * 16, 'fire')
        .play({ key: 'fire.play', startFrame: i * 3 })
        .setOrigin(0.5, 0.8)
        .setScale(0.8);
      this.container.add(f);
      this.fires.push(f);
    }
    while (this.fires.length > wantFires) this.fires.pop()!.destroy();
    // atirador no topo da torre
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
    const vis = buildingVisual(this.b.def.id, this.hasBarracksArt);
    this.state = 'ruin';
    this.build(vis.destroyed);
    this.ruinUntil = now + 30_000;
    this.container.setDepth(this.b.rect.y + this.b.rect.h - 40);
  }

  destroy(): void {
    this.container.destroy();
  }
}

// ------------------------------------------------------------------ recursos

export class ResourceView {
  readonly obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  private pile: Phaser.GameObjects.Sprite | null = null;
  private hitSeq = 0;
  private workers = -1;
  seen = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly r: ResourceNode,
  ) {
    const k = r.def.kind;
    if (k === 'tree') {
      this.obj = scene.add
        .sprite(r.tx * TILE + TILE / 2, r.ty * TILE + 58, 'tree')
        .setOrigin(0.5, 0.92)
        .play({ key: 'tree.idle', startFrame: (r.id * 7) % 4 });
    } else if (k === 'goldMine') {
      this.obj = scene.add.image(r.x, r.ty * TILE + r.def.h * TILE, 'goldmine_inactive').setOrigin(0.5, ORIGIN_Y.goldmine_inactive);
    } else {
      this.obj = scene.add.sprite(r.x, r.y, 'sheep').setOrigin(0.5, 0.66).play({ key: 'sheep.idle', startFrame: r.id % 8 });
    }
    this.obj.setDepth(this.obj.y);
    this.hitSeq = r.hitSeq;
  }

  sync(r: ResourceNode, alpha: number, visible: boolean): void {
    this.obj.setVisible(visible);
    const k = r.def.kind;
    if (k === 'tree') {
      if (r.hitSeq !== this.hitSeq) {
        this.hitSeq = r.hitSeq;
        const s = this.obj as Phaser.GameObjects.Sprite;
        s.play('tree.hit');
        s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.active && s.play('tree.idle'));
      }
      return;
    }
    if (k === 'goldMine') {
      const n = r.workers.size;
      if ((n > 0) !== this.workers > 0) (this.obj as Phaser.GameObjects.Image).setTexture(n > 0 ? 'goldmine_active' : 'goldmine_inactive');
      this.workers = n;
      return;
    }
    // ovelha
    if (r.isPile) {
      if (!this.pile) {
        this.obj.setVisible(false);
        this.pile = this.scene.add.sprite(r.x, r.y + 10, 'm_spawn').setOrigin(0.5, 0.77).setDepth(r.y);
        this.pile.play('m_spawn.play');
        this.pile.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.pile?.active && this.pile.setTexture('m_idle'));
      }
      this.pile.setVisible(visible);
      return;
    }
    const x = lerp(r.prevX, r.x, alpha);
    const y = lerp(r.prevY, r.y, alpha);
    const s = this.obj as Phaser.GameObjects.Sprite;
    const moving = Math.abs(r.x - r.prevX) + Math.abs(r.y - r.prevY) > 0.05;
    const want = moving ? 'sheep.bounce' : 'sheep.idle';
    if (s.anims.currentAnim?.key !== want) s.play(want);
    if (Math.abs(r.x - r.prevX) > 0.02) s.setFlipX(r.x < r.prevX);
    s.setPosition(x, y).setDepth(y);
  }

  /** Recurso esgotado: árvore vira toco, mina fica destruída, ovelha some. */
  deplete(): boolean {
    const k = this.r.def.kind;
    if (k === 'tree') {
      (this.obj as Phaser.GameObjects.Sprite).play('tree.stump');
      this.obj.setDepth(this.obj.y - 60);
      return true;
    }
    if (k === 'goldMine') {
      (this.obj as Phaser.GameObjects.Image).setTexture('goldmine_destroyed');
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
  readonly obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse | null = null;
  seen = 0;

  constructor(scene: Phaser.Scene, p: Projectile) {
    if (p.type === 'arrow') {
      this.obj = scene.add.image(p.x, p.y, 'arrow', 0).setOrigin(0.5);
    } else {
      this.obj = scene.add.sprite(p.x, p.y, 'dynamite').play('dynamite.spin');
      this.shadow = scene.add.ellipse(p.x, p.y, 16, 6, 0x000000, 0.25);
    }
  }

  sync(p: Projectile, alpha: number, visible: boolean): void {
    const x = lerp(p.prevX, p.x, alpha);
    const y = lerp(p.prevY, p.y, alpha);
    if (p.type === 'arrow') {
      this.obj.setPosition(x, y - 24).setRotation(p.angle);
    } else {
      this.obj.setPosition(x, y - 16 - p.z);
      this.shadow?.setPosition(x, y).setDepth(y - 1).setVisible(visible);
    }
    this.obj.setDepth(y + 60).setVisible(visible);
  }

  destroy(): void {
    this.obj.destroy();
    this.shadow?.destroy();
  }
}
