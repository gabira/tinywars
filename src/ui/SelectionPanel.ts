import Phaser from 'phaser';
import { COLORS } from '../config';
import { teamColor } from '../render/palette';
import { UNITS } from '../data/units';
import type { AnyEntity, Building, ResourceNode, Unit } from '../entities/Entity';
import type { Session } from '../game/Session';
import { S, fmt } from '../i18n/t';
import { buildingThumb, portrait, RES_ICON } from './icons';
import { darkText, hpColor, meter, slot } from './widgets';

const INK_SOFT = '#6b5440';
const INK_BAD = '#a3281c';
const INK_GOOD = '#3f6b2a';

/** Informações da seleção, sobre o pergaminho do centro do HUD (texto escuro). */
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
    Object.assign(this, { x, y, w, h });
    this.sig = '';
  }

  /** Esconde o conteúdo enquanto a dica de um botão ocupa o painel. */
  setVisible(v: boolean): void {
    this.root.setVisible(v);
  }

  private signature(): string {
    const w = this.session.world;
    return (
      `${this.x},${this.y},${this.w}|` +
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
    if (!ents.length) return this.empty();
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

  /** Área clicável invisível (as fendas são containers sem área de clique própria). */
  private hit(x: number, y: number, w: number, h: number): Phaser.GameObjects.Zone {
    return this.add(this.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }));
  }

  private text(x: number, y: number, s: string, size = 16, color: string = COLORS.textDark): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, s, { ...darkText(size), color }).setOrigin(0, 0.5));
  }

  /** Barra com contorno; `get` devolve a fração e a cor. */
  private bar(x: number, y: number, w: number, h: number, get: () => [number, number]): void {
    const m = meter(this.scene, x, y, w, h);
    m.objects.forEach((o) => this.add(o));
    this.dyn.push(() => m.set(...get()));
  }

  /** Retrato numa fenda de madeira à esquerda, nome e subtítulo. Devolve o x da coluna de texto. */
  private header(name: string, sub: string | null, thumb: (x: number, y: number, s: number) => Phaser.GameObjects.Image | null): number {
    const size = Math.min(96, this.h);
    const top = this.y + (this.h - size) / 2;
    this.add(slot(this.scene, this.x, top, size, size));
    const img = thumb(this.x + size / 2, top + size / 2, size - 16);
    if (img) this.add(img);
    const tx = this.x + size + 16;
    const title = this.add(this.scene.add.text(tx, this.y + 14, name, { ...darkText(21), fontStyle: 'bold' }).setOrigin(0, 0.5));
    if (sub) this.text(tx + title.width + 12, this.y + 15, sub, 14, INK_BAD);
    return tx;
  }

  /** Ícone do Free Pack seguido de um valor (ataque, armadura...). Devolve o x seguinte. */
  private stat(x: number, y: number, icon: string, label: string): number {
    this.add(this.scene.add.image(x + 11, y, icon).setDisplaySize(22, 22));
    const t = this.text(x + 26, y, label, 15);
    return x + 26 + t.width + 18;
  }

  private empty(): void {
    const cx = this.x + this.w / 2;
    this.add(this.scene.add.text(cx, this.y + this.h / 2 - 20, S.hud.nothing, { ...darkText(20), color: INK_SOFT }).setOrigin(0.5));
    this.add(
      this.scene.add
        .text(cx, this.y + this.h / 2 + 10, S.hud.nothingHelp, { ...darkText(15), color: INK_SOFT, align: 'center', wordWrap: { width: this.w - 40 } })
        .setOrigin(0.5, 0),
    );
  }

  private unitInfo(u: Unit): void {
    const own = u.team === 0;
    const tx = this.header(S.units[u.def.id].name, own ? null : S.panel.enemy, (x, y, s) => portrait(this.scene, u.def.id, teamColor(u.team), x, y, s));
    const barW = Math.min(240, this.w - (tx - this.x) - 8);
    this.bar(tx, this.y + 44, barW, 14, () => [u.hp / u.maxHp, hpColor(u.hp / u.maxHp)]);
    const hpText = this.text(tx, this.y + 64, '', 15);
    const range = Math.round(u.def.range / 64) || 1;
    let sx = tx;
    if (u.def.attack === 'heal') sx = this.stat(sx, this.y + 90, 'icon_11', `${S.hud.heal} ${u.def.damage}`);
    else {
      sx = this.stat(sx, this.y + 90, 'icon_05', `${S.hud.attack} ${u.def.damage}`);
      sx = this.stat(sx, this.y + 90, 'icon_06', `${S.hud.armor} ${u.def.armor}`);
    }
    this.text(sx, this.y + 90, `${S.hud.range} ${range}`, 15);
    if (!own) {
      this.dyn.push(() => hpText.setText(fmt(S.panel.hp, { hp: Math.ceil(u.hp), max: u.maxHp })));
      return;
    }
    // o que a unidade está fazendo e o que carrega
    const status = this.text(tx, this.y + 116, '', 15, INK_GOOD);
    this.dyn.push(() => {
      hpText.setText(fmt(S.panel.hp, { hp: Math.ceil(u.hp), max: u.maxHp }));
      const parts = [this.orderText(u)];
      if (u.carry && u.carry.amount > 0) parts.push(fmt(S.panel.carrying, { amount: u.carry.amount, res: S.res[u.carry.res] }));
      status.setText(parts.join('  ·  '));
    });
  }

  private orderText(u: Unit): string {
    const st = S.hud.status;
    const o = u.order;
    if (!o) return st.idle;
    if (o.type === 'gather') {
      const node = this.session.world.get(o.nodeId);
      return fmt(st.gather, { res: node && node.kind === 'resource' ? S.res[node.def.res].toLowerCase() : '' }).trim();
    }
    return st[o.type];
  }

  private buildingInfo(b: Building): void {
    const own = b.team === 0;
    const tx = this.header(S.buildings[b.def.id].name, own ? null : S.panel.enemy, (x, y, s) => buildingThumb(this.scene, b.def.id, x, y, s, teamColor(b.team)));
    const barW = Math.min(240, this.w - (tx - this.x) - 8);
    this.bar(tx, this.y + 44, barW, 14, () => [b.hp / b.maxHp, hpColor(b.hp / b.maxHp)]);
    const hpText = this.text(tx, this.y + 64, '', 15);
    this.dyn.push(() => hpText.setText(fmt(S.panel.hp, { hp: Math.ceil(b.hp), max: b.maxHp })));
    if (!own) return;
    if (!b.complete) {
      this.bar(tx, this.y + 94, barW, 12, () => [b.progress, 0xf2c94c]);
      const p = this.text(tx, this.y + 114, '', 15);
      this.dyn.push(() => p.setText(fmt(S.panel.building, { pct: Math.floor(b.progress * 100) })));
      return;
    }
    if (!b.def.trains.length) {
      this.text(tx, this.y + 94, S.buildings[b.def.id].desc, 14, INK_SOFT);
      return;
    }
    // fila de treino (clique cancela)
    const cell = 36;
    const qy = this.y + 110;
    if (b.queue.length) this.text(tx, this.y + 84, S.panel.queue, 14, INK_SOFT);
    else this.text(tx, this.y + 94, S.buildings[b.def.id].desc, 14, INK_SOFT);
    b.queue.forEach((item, i) => {
      const x = tx + i * (cell + 6);
      this.add(slot(this.scene, x, qy - cell / 2, cell, cell));
      const s = this.hit(x, qy - cell / 2, cell, cell);
      const face = this.add(portrait(this.scene, item.unit, teamColor(b.team), x + cell / 2, qy, cell - 8));
      s.on('pointerup', () => this.session.world.issue(0, { type: 'cancelTrain', buildingId: b.id, index: i }));
      s.on('pointerover', () => face.setTint(0xff9b8a));
      s.on('pointerout', () => face.clearTint());
      if (i === 0) {
        const bar = this.add(this.scene.add.rectangle(x + 3, qy + cell / 2 + 4, 0, 4, 0xf2c94c).setOrigin(0, 0.5));
        this.dyn.push(() => {
          const it = b.queue[0];
          if (it) bar.width = (cell - 6) * Math.min(1, it.t / UNITS[it.unit].trainTime);
        });
      }
    });
  }

  private resourceInfo(r: ResourceNode): void {
    const info = r.def.kind === 'tree' ? S.resources.tree : r.def.kind === 'goldMine' ? S.resources.goldMine : r.isPile ? S.resources.meat : S.resources.sheep;
    const thumbKey = r.def.kind === 'tree' ? 'wood_res' : r.def.kind === 'goldMine' ? 'gold_stone6' : 'meat_res';
    const tx = this.header(info.name, null, (x, y, s) => {
      const img = this.scene.add.image(x, y, thumbKey);
      return img.setScale((s / Math.max(img.width, img.height)) * (thumbKey === 'gold_stone6' ? 1.4 : 1));
    });
    const barW = Math.min(240, this.w - (tx - this.x) - 8);
    this.add(this.scene.add.image(tx + 11, this.y + 44, RES_ICON[r.def.res]).setDisplaySize(22, 22));
    this.bar(tx + 28, this.y + 44, barW - 28, 12, () => [r.amount / r.maxAmount, 0xf2c94c]);
    const rem = this.text(tx, this.y + 66, '', 15);
    const wk = this.text(tx, this.y + 90, '', 15);
    this.text(tx, this.y + (r.def.maxWorkers ? 114 : 90), info.desc, 14, INK_SOFT);
    this.dyn.push(() => {
      rem.setText(
        r.def.kind === 'goldMine'
          ? fmt(S.panel.remainingOf, { amount: r.amount, max: r.maxAmount, res: S.res[r.def.res] })
          : fmt(S.panel.remaining, { amount: r.amount, res: S.res[r.def.res] }),
      );
      if (r.def.maxWorkers) wk.setText(fmt(S.panel.workers, { n: r.workers.size, max: r.def.maxWorkers }));
    });
  }

  private multi(units: Unit[]): void {
    const size = 44;
    const gap = 5;
    const top = this.y + 30;
    const cols = Math.max(1, Math.floor((this.w + gap) / (size + gap)));
    const rows = Math.max(1, Math.floor((this.y + this.h - top + gap) / (size + gap)));
    this.add(this.scene.add.text(this.x, this.y + 12, fmt(S.panel.selected, { n: units.length }), { ...darkText(17), fontStyle: 'bold' }).setOrigin(0, 0.5));
    units.slice(0, cols * rows).forEach((u, i) => {
      const x = this.x + (i % cols) * (size + gap);
      const y = top + Math.floor(i / cols) * (size + gap);
      this.add(slot(this.scene, x, y, size, size));
      const s = this.hit(x, y, size, size);
      s.on('pointerup', (p: Phaser.Input.Pointer) => {
        const ss = this.session;
        if (p.event.shiftKey) ss.setSelection(ss.selection.filter((id) => id !== u.id));
        else ss.setSelection([u.id]);
      });
      this.add(portrait(this.scene, u.def.id, teamColor(u.team), x + size / 2, y + size / 2 - 2, size - 8));
      const hb = this.add(this.scene.add.rectangle(x + 4, y + size - 5, size - 8, 3, COLORS.hpGood).setOrigin(0, 0.5));
      this.dyn.push(() => {
        const f = Math.max(0, u.hp / u.maxHp);
        hb.width = (size - 8) * f;
        hb.fillColor = hpColor(f);
      });
    });
  }
}
