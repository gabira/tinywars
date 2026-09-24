import Phaser from 'phaser';
import { COLORS } from '../config';
import { teamColor } from '../render/palette';
import { UNITS } from '../data/units';
import type { AnyEntity, Building, ResourceNode, Unit } from '../entities/Entity';
import type { Session } from '../game/Session';
import { S, fmt } from '../i18n/t';
import { buildingThumb, portrait } from './icons';
import { textStyle } from './widgets';

/** Informações da seleção (centro do painel inferior). */
export class SelectionPanel {
  private root: Phaser.GameObjects.Container;
  private dyn: (() => void)[] = [];
  private sig = '';
  private x = 0;
  private y = 0;
  private w = 0;
  private h = 0;

  constructor(
    private scene: Phaser.Scene,
    private session: Session,
  ) {
    this.root = scene.add.container(0, 0);
  }

  layout(x: number, y: number, w: number, h: number): void {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.sig = '';
  }

  private signature(): string {
    const w = this.session.world;
    return (
      this.session.selection.join(',') +
      '|' +
      this.session.selection
        .map((id) => {
          const e = w.get(id);
          return e && e.kind === 'building' ? `${e.complete}:${e.queue.map((q) => q.unit).join('.')}` : '';
        })
        .join(',')
    );
  }

  update(): void {
    const sig = this.signature();
    if (sig !== this.sig) {
      this.sig = sig;
      this.rebuild();
    }
    for (const f of this.dyn) f();
  }

  private rebuild(): void {
    this.root.removeAll(true);
    this.dyn = [];
    const w = this.session.world;
    const ents = this.session.selection.map((id) => w.get(id)).filter((e): e is AnyEntity => !!e && e.alive);
    if (!ents.length) return;
    if (ents.length === 1) {
      const e = ents[0];
      if (e.kind === 'unit') this.unitInfo(e);
      else if (e.kind === 'building') this.buildingInfo(e);
      else this.resourceInfo(e);
      return;
    }
    this.multi(ents.filter((e): e is Unit => e.kind === 'unit'));
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.root.add(o);
    return o;
  }

  private box(x: number, y: number, size: number): void {
    this.add(this.scene.add.rectangle(x, y, size, size, 0x2b1d12, 0.35).setStrokeStyle(2, 0x6b4a2b));
  }

  private hpBar(x: number, y: number, w: number, get: () => number): void {
    const bg = this.add(this.scene.add.rectangle(x, y, w, 8, 0x1b1b24).setOrigin(0, 0.5));
    const fg = this.add(this.scene.add.rectangle(x + 1, y, w - 2, 6, COLORS.hpGood).setOrigin(0, 0.5));
    void bg;
    this.dyn.push(() => {
      const f = Phaser.Math.Clamp(get(), 0, 1);
      fg.width = (w - 2) * f;
      fg.fillColor = f > 0.6 ? COLORS.hpGood : f > 0.3 ? COLORS.hpMid : COLORS.hpLow;
    });
  }

  private text(x: number, y: number, s: string, size = 16, color: string = COLORS.text): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, s, textStyle(size, color)).setOrigin(0, 0.5));
  }

  private header(name: string, sub: string | null, thumb: (x: number, y: number, s: number) => Phaser.GameObjects.Image | null): number {
    const size = Math.min(84, this.h - 30);
    const cx = this.x + size / 2 + 4;
    const cy = this.y + size / 2 + 6;
    this.box(cx, cy, size);
    const img = thumb(cx, cy, size - 10);
    if (img) this.add(img);
    const tx = this.x + size + 18;
    this.text(tx, this.y + 16, name, 20);
    if (sub) this.text(tx, this.y + 40, sub, 14, '#ffd0c8');
    return tx;
  }

  private unitInfo(u: Unit): void {
    const own = u.team === 0;
    const tx = this.header(S.units[u.def.id].name, own ? null : S.panel.enemy, (x, y, s) =>
      portrait(this.scene, `${u.def.sheet}_${teamColor(u.team)}`, x, y, s),
    );
    const barW = Math.min(200, this.w - (tx - this.x) - 10);
    const hpY = this.y + (own ? 44 : 62);
    this.hpBar(tx, hpY, barW, () => u.hp / u.maxHp);
    const hpText = this.text(tx, hpY + 18, '', 14);
    const stats = this.text(tx, hpY + 40, fmt(S.panel.stats, { dmg: u.def.damage, armor: u.def.armor, range: Math.round(u.def.range / 64) || 1 }), 14);
    void stats;
    const status = this.text(tx, hpY + 62, '', 14, COLORS.gold);
    this.dyn.push(() => {
      hpText.setText(fmt(S.panel.hp, { hp: Math.ceil(u.hp), max: u.maxHp }));
      status.setText(u.carry && u.carry.amount > 0 ? fmt(S.panel.carrying, { amount: u.carry.amount, res: S.res[u.carry.res] }) : '');
    });
  }

  private buildingInfo(b: Building): void {
    const own = b.team === 0;
    const tx = this.header(S.buildings[b.def.id].name, own ? null : S.panel.enemy, (x, y, s) => buildingThumb(this.scene, b.def.id, x, y, s, teamColor(b.team)));
    const barW = Math.min(200, this.w - (tx - this.x) - 10);
    const hpY = this.y + (own ? 44 : 62);
    this.hpBar(tx, hpY, barW, () => b.hp / b.maxHp);
    const hpText = this.text(tx, hpY + 18, '', 14);
    this.dyn.push(() => hpText.setText(fmt(S.panel.hp, { hp: Math.ceil(b.hp), max: b.maxHp })));
    if (!own) return;
    if (!b.complete) {
      const p = this.text(tx, hpY + 42, '', 16, COLORS.gold);
      this.dyn.push(() => p.setText(fmt(S.panel.building, { pct: Math.floor(b.progress * 100) })));
      return;
    }
    if (!b.def.trains.length) return;
    // fila de treino (clique cancela)
    const qy = hpY + 52;
    const slot = 38;
    this.text(tx, qy - 22 + 6, b.queue.length ? S.panel.queue : '', 13, '#e8dcc0');
    b.queue.forEach((item, i) => {
      const x = tx + slot / 2 + i * (slot + 4);
      const y = qy + slot / 2 - 4;
      const bg = this.add(this.scene.add.rectangle(x, y, slot, slot, 0x2b1d12, 0.5).setStrokeStyle(2, 0x6b4a2b).setInteractive({ useHandCursor: true }));
      bg.on('pointerup', () => {
        this.session.world.issue(0, { type: 'cancelTrain', buildingId: b.id, index: i });
      });
      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xff9b8a));
      bg.on('pointerout', () => bg.setStrokeStyle(2, 0x6b4a2b));
      this.add(portrait(this.scene, `${UNITS[item.unit].sheet}_${teamColor(b.team)}`, x, y, slot - 6));
      if (i === 0) {
        const bar = this.add(this.scene.add.rectangle(x - slot / 2, y + slot / 2 + 4, 0, 4, 0xf7d154).setOrigin(0, 0.5));
        this.dyn.push(() => {
          const it = b.queue[0];
          if (it) bar.width = slot * Math.min(1, it.t / UNITS[it.unit].trainTime);
        });
      }
    });
  }

  private resourceInfo(r: ResourceNode): void {
    const key = r.def.kind === 'tree' ? 'resources.tree' : r.def.kind === 'goldMine' ? 'resources.goldMine' : r.isPile ? 'resources.meat' : 'resources.sheep';
    const info = key === 'resources.tree' ? S.resources.tree : key === 'resources.goldMine' ? S.resources.goldMine : r.isPile ? S.resources.meat : S.resources.sheep;
    const thumbKey = r.def.kind === 'tree' ? 'w_idle' : r.def.kind === 'goldMine' ? 'goldmine_inactive' : 'm_idle';
    const tx = this.header(info.name, null, (x, y, s) => {
      const img = this.scene.add.image(x, y, thumbKey);
      img.setScale((s / Math.max(img.width, img.height)) * (thumbKey.endsWith('idle') ? 1.8 : 1.1));
      return img;
    });
    const rem = this.text(tx, this.y + 50, '', 16, COLORS.gold);
    const desc = this.text(tx, this.y + 76, info.desc, 14);
    void desc;
    const wk = this.text(tx, this.y + 100, '', 14);
    this.dyn.push(() => {
      rem.setText(fmt(S.panel.remaining, { amount: r.amount, res: S.res[r.def.res] }));
      if (r.def.maxWorkers) wk.setText(fmt(S.panel.workers, { n: r.workers.size, max: r.def.maxWorkers }));
    });
  }

  private multi(units: Unit[]): void {
    const size = 42;
    const gap = 4;
    const cols = Math.max(1, Math.floor((this.w - 8) / (size + gap)));
    this.text(this.x + 4, this.y + 12, fmt(S.panel.selected, { n: units.length }), 16);
    units.slice(0, cols * 3).forEach((u, i) => {
      const x = this.x + 4 + size / 2 + (i % cols) * (size + gap);
      const y = this.y + 30 + size / 2 + Math.floor(i / cols) * (size + gap + 4);
      const bg = this.add(this.scene.add.rectangle(x, y, size, size, 0x2b1d12, 0.35).setStrokeStyle(2, 0x6b4a2b).setInteractive({ useHandCursor: true }));
      bg.on('pointerup', (p: Phaser.Input.Pointer) => {
        const s = this.session;
        if (p.event.shiftKey) s.setSelection(s.selection.filter((id) => id !== u.id));
        else s.setSelection([u.id]);
      });
      this.add(portrait(this.scene, `${u.def.sheet}_${teamColor(u.team)}`, x, y - 2, size - 8));
      const hb = this.add(this.scene.add.rectangle(x - size / 2 + 3, y + size / 2 - 4, size - 6, 3, COLORS.hpGood).setOrigin(0, 0.5));
      this.dyn.push(() => {
        const f = Math.max(0, u.hp / u.maxHp);
        hb.width = (size - 6) * f;
        hb.fillColor = f > 0.6 ? COLORS.hpGood : f > 0.3 ? COLORS.hpMid : COLORS.hpLow;
      });
    });
  }
}
