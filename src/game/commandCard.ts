import { BUILDINGS, BUILD_MENU } from '../data/buildings';
import type { BuildingId, Cost, UnitId } from '../data/types';
import { UNITS } from '../data/units';
import type { Building, Unit } from '../entities/Entity';
import { teamColor, type TeamColor } from '../render/palette';
import { S, fmt, resName } from '../i18n/t';
import type { CommandResult } from '../systems/commands';
import type { Session } from './Session';

export type IconSpec =
  | { kind: 'image'; key: string; zoom?: number }
  | { kind: 'unit'; unit: UnitId; color: TeamColor }
  | { kind: 'building'; id: BuildingId };

export interface CardButton {
  slot: number;
  hotkey: string;
  name: string;
  desc: string;
  cost?: Cost;
  time?: number;
  pop?: number;
  icon: IconSpec;
  enabled: boolean;
  active?: boolean;
  action: () => void;
}

/** Texto de erro amigável para um comando recusado. */
export function failText(r: CommandResult): string | null {
  if (r.ok) return null;
  switch (r.reason) {
    case 'notEnough':
      return fmt(S.msg.notEnough, { res: resName(r.res!) });
    case 'popCap':
      return S.msg.popCap;
    case 'invalidPlacement':
      return S.msg.invalidPlacement;
    case 'queueFull':
      return S.msg.queueFull;
    case 'noWorkers':
      return S.msg.noWorkers;
    case 'notReady':
      return S.msg.notReady;
    case 'requires':
      return fmt(S.msg.requires, { name: S.buildings[r.requires!].name });
    default:
      return null;
  }
}

export function report(session: Session, r: CommandResult): boolean {
  const msg = failText(r);
  if (msg) session.toast(msg, '#ff9b8a');
  return r.ok;
}

export function selectedOwnUnits(session: Session): Unit[] {
  const out: Unit[] = [];
  for (const id of session.selection) {
    const u = session.world.getUnit(id);
    if (u && u.alive && u.team === 0) out.push(u);
  }
  return out;
}

export function selectedOwnBuilding(session: Session): Building | null {
  if (session.selection.length !== 1) return null;
  const b = session.world.getBuilding(session.selection[0]);
  return b && b.alive && b.team === 0 ? b : null;
}

/** Monta os botões do cartão de comandos para a seleção atual. */
export function commandCard(session: Session): CardButton[] {
  const w = session.world;
  const player = w.players[0];
  const units = selectedOwnUnits(session);
  const buttons: CardButton[] = [];
  const ids = () => units.map((u) => u.id);

  if (units.length) {
    const workers = units.filter((u) => u.isWorker);
    if (session.buildMenu && workers.length) {
      BUILD_MENU.forEach((bid, i) => {
        const def = BUILDINGS[bid];
        const reqOk = !def.requires || w.buildings.some((b) => b.alive && b.team === 0 && b.complete && b.def.id === def.requires);
        buttons.push({
          slot: i,
          hotkey: def.hotkey,
          name: S.buildings[bid].name,
          desc: S.buildings[bid].desc + (reqOk ? '' : `\n${fmt(S.msg.requires, { name: S.buildings[def.requires!].name })}`),
          cost: def.cost,
          time: def.buildTime,
          pop: def.pop || undefined,
          icon: { kind: 'building', id: bid },
          enabled: reqOk && player.canAfford(def.cost),
          active: session.placing === bid,
          action: () => {
            if (!reqOk) return session.toast(fmt(S.msg.requires, { name: S.buildings[def.requires!].name }), '#ff9b8a');
            const miss = player.missing(def.cost);
            if (miss) return session.toast(fmt(S.msg.notEnough, { res: resName(miss) }), '#ff9b8a');
            session.startPlacing(bid);
          },
        });
      });
      buttons.push({
        slot: 8,
        hotkey: 'ESC',
        name: S.cmd.back,
        desc: '',
        icon: { kind: 'image', key: 'icon_08' },
        enabled: true,
        action: () => {
          session.buildMenu = false;
          session.cancelMode();
          session.ui.emit('selection');
        },
      });
      return buttons;
    }
    buttons.push({
      slot: 0,
      hotkey: 'F',
      name: S.cmd.attackMove,
      desc: S.cmdDesc.attackMove,
      icon: { kind: 'image', key: 'icon_05' },
      enabled: true,
      active: session.mode === 'attackMove',
      action: () => {
        session.mode = 'attackMove';
        session.ui.emit('mode');
      },
    });
    buttons.push({
      slot: 1,
      hotkey: 'X',
      name: S.cmd.stop,
      desc: S.cmdDesc.stop,
      icon: { kind: 'image', key: 'icon_09' },
      enabled: true,
      action: () => w.issue(0, { type: 'stop', unitIds: ids() }),
    });
    buttons.push({
      slot: 2,
      hotkey: 'H',
      name: S.cmd.hold,
      desc: S.cmdDesc.hold,
      icon: { kind: 'image', key: 'icon_06' },
      enabled: true,
      action: () => w.issue(0, { type: 'hold', unitIds: ids() }),
    });
    if (workers.length) {
      buttons.push({
        slot: 3,
        hotkey: 'B',
        name: S.cmd.build,
        desc: S.cmdDesc.build,
        icon: { kind: 'image', key: 'icon_01' },
        enabled: true,
        action: () => {
          session.buildMenu = true;
          session.ui.emit('selection');
        },
      });
      if (workers.some((u) => u.carry && u.carry.amount > 0)) {
        buttons.push({
          slot: 4,
          hotkey: 'E',
          name: S.cmd.returnCargo,
          desc: S.cmdDesc.returnCargo,
          icon: { kind: 'image', key: 'gold_res', zoom: 2.4 },
          enabled: true,
          action: () => w.issue(0, { type: 'returnCargo', unitIds: workers.map((u) => u.id) }),
        });
      }
    }
    return buttons;
  }

  const b = selectedOwnBuilding(session);
  if (b) {
    if (!b.complete) {
      buttons.push({
        slot: 8,
        hotkey: 'ESC',
        name: S.cmd.cancel,
        desc: S.cmdDesc.cancel,
        icon: { kind: 'image', key: 'icon_09' },
        enabled: true,
        action: () => {
          w.issue(0, { type: 'cancelBuild', buildingId: b.id });
          session.setSelection([]);
        },
      });
      return buttons;
    }
    b.def.trains.forEach((uid: UnitId, i) => {
      const def = UNITS[uid];
      buttons.push({
        slot: i,
        hotkey: def.hotkey,
        name: S.units[uid].name,
        desc: S.units[uid].desc,
        cost: def.cost,
        time: def.trainTime,
        icon: { kind: 'unit', unit: uid, color: teamColor(0) },
        enabled: player.canAfford(def.cost),
        action: () => report(session, w.issue(0, { type: 'train', buildingId: b.id, unit: uid })),
      });
    });
  }
  return buttons;
}

/**
 * Assinatura do cartão: quando muda, o HUD recria os botões. As ações dos botões guardam as
 * entidades selecionadas, então a seleção faz parte da assinatura — senão dois quartéis
 * (com botões idênticos) compartilhariam os botões do primeiro.
 */
export function cardSignature(session: Session, buttons: CardButton[]): string {
  return `${session.selection.join(',')}|` + buttons.map((b) => `${b.slot}${b.name}${b.enabled ? 1 : 0}${b.active ? 1 : 0}`).join(';');
}
