import { describe, expect, it } from 'vitest';
import { GoblinAI } from '../ai/GoblinAI';
import { SIM_DT, TILE } from '../config';
import { BALANCE } from '../data/balance';
import { UNITS } from '../data/units';
import { Player } from '../entities/Player';
import { explode } from './combat';
import { World } from './World';

const run = (w: World, seconds: number) => {
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps && w.winner === null; i++) w.step(SIM_DT);
};

describe('Player (economia)', () => {
  it('paga, reembolsa e detecta falta de recurso', () => {
    const p = new Player(0, { gold: 50, wood: 100, meat: 0 });
    expect(p.canAfford({ wood: 60 })).toBe(true);
    expect(p.missing({ wood: 60, meat: 10 })).toBe('meat');
    expect(p.spend({ wood: 60 })).toBe(true);
    expect(p.res.wood).toBe(40);
    p.refund({ wood: 60 }, 0.75);
    expect(p.res.wood).toBe(85);
  });
});

describe('World', () => {
  it('começa com bases, trabalhadores e recursos', () => {
    const w = new World({ seed: 1, difficulty: 'normal', fog: false });
    expect(w.mainBuilding(0)?.def.id).toBe('castle');
    expect(w.mainBuilding(1)?.def.id).toBe('goblinHall');
    expect(w.units.filter((u) => u.team === 0).length).toBe(BALANCE.startWorkers);
    expect(w.resources.some((r) => r.def.kind === 'goldMine')).toBe(true);
    expect(w.players[0].popCap).toBe(10);
  });

  it('peão coleta madeira e entrega no castelo', () => {
    const w = new World({ seed: 2, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const pawn = w.units.find((u) => u.team === 0)!;
    const tree = [...w.resources]
      .filter((r) => r.def.kind === 'tree')
      .sort((a, b) => Math.hypot(a.x - castle.x, a.y - castle.y) - Math.hypot(b.x - castle.x, b.y - castle.y))[0];
    const before = w.players[0].res.wood;
    expect(w.issue(0, { type: 'gather', unitIds: [pawn.id], nodeId: tree.id }).ok).toBe(true);
    run(w, 60);
    expect(w.players[0].res.wood).toBeGreaterThan(before);
  });

  it('peão minera ouro (entra e sai da mina)', () => {
    const w = new World({ seed: 3, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const pawn = w.units.find((u) => u.team === 0)!;
    const mine = [...w.resources]
      .filter((r) => r.def.kind === 'goldMine')
      .sort((a, b) => Math.hypot(a.x - castle.x, a.y - castle.y) - Math.hypot(b.x - castle.x, b.y - castle.y))[0];
    const before = w.players[0].res.gold;
    w.issue(0, { type: 'gather', unitIds: [pawn.id], nodeId: mine.id });
    run(w, 60);
    expect(w.players[0].res.gold).toBeGreaterThan(before);
  });

  it('treina unidade e respeita o custo', () => {
    const w = new World({ seed: 4, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const n = w.units.filter((u) => u.team === 0).length;
    const meat = w.players[0].res.meat;
    expect(w.issue(0, { type: 'train', buildingId: castle.id, unit: 'pawn' }).ok).toBe(true);
    expect(w.players[0].res.meat).toBe(meat - UNITS.pawn.cost.meat!);
    run(w, UNITS.pawn.trainTime + 1);
    expect(w.units.filter((u) => u.team === 0).length).toBe(n + 1);
  });

  it('constrói uma casa e aumenta a população máxima', () => {
    const w = new World({ seed: 5, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const pawns = w.units.filter((u) => u.team === 0).slice(0, 2);
    let placed = false;
    for (let dy = -6; dy <= 6 && !placed; dy++)
      for (let dx = -8; dx <= 8 && !placed; dx++) {
        const r = w.issue(0, {
          type: 'build',
          unitIds: pawns.map((p) => p.id),
          building: 'house',
          tx: castle.tx + 6 + dx,
          ty: castle.ty + dy,
        });
        placed = r.ok;
      }
    expect(placed).toBe(true);
    run(w, 40);
    expect(w.players[0].popCap).toBe(15);
  });

  it('dano de explosão atinge só inimigos no raio', () => {
    const w = new World({ seed: 6, difficulty: 'normal', fog: false });
    const a = w.units.find((u) => u.team === 0)!;
    const friend = w.spawnUnit(1, 'torch', a.x + 10, a.y);
    const far = w.spawnUnit(0, 'warrior', a.x + 400, a.y);
    const hpA = a.hp;
    explode(w, 1, a.x, a.y, 60, 20, 1, 0);
    expect(a.hp).toBeLessThan(hpA);
    expect(friend.hp).toBe(friend.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('guerreiro derrota goblin da tocha isolado', () => {
    const w = new World({ seed: 7, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const x = castle.x;
    const y = castle.y - 5 * TILE;
    const war = w.spawnUnit(0, 'warrior', x, y);
    const torch = w.spawnUnit(1, 'torch', x + 3 * TILE, y);
    w.issue(0, { type: 'attack', unitIds: [war.id], targetId: torch.id });
    run(w, 30);
    expect(torch.alive).toBe(false);
    expect(war.alive).toBe(true);
  });
});

describe('IA Goblin', () => {
  it('desenvolve a economia e ataca em uma partida simulada', () => {
    const w = new World({ seed: 11, difficulty: 'hard', fog: false });
    const ai = new GoblinAI(w, 1);
    w.controllers.push(ai);
    let waves = 0;
    w.events.on((e) => {
      if (e.type === 'attackWave') waves++;
    });
    run(w, 420);
    const goblins = w.units.filter((u) => u.team === 1);
    const workers = goblins.filter((u) => u.isWorker).length;
    expect(workers).toBeGreaterThanOrEqual(8);
    expect(w.buildings.some((b) => b.team === 1 && b.def.id === 'goblinCamp' && b.complete)).toBe(true);
    expect(w.buildings.some((b) => b.team === 1 && b.def.id === 'goblinHut' && b.complete)).toBe(true);
    expect(waves).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
