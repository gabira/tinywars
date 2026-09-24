import { describe, expect, it } from 'vitest';
import { RivalAI } from '../ai/RivalAI';
import { SIM_DT, TILE } from '../config';
import { BALANCE } from '../data/balance';
import { UNITS } from '../data/units';
import { Player } from '../entities/Player';
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
    expect(w.mainBuilding(1)?.def.id).toBe('castle');
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

  it('monge cura sozinho um aliado ferido por perto', () => {
    const w = new World({ seed: 6, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const monk = w.spawnUnit(0, 'monk', castle.x, castle.y - 4 * TILE);
    const hurt = w.spawnUnit(0, 'warrior', castle.x + 2 * TILE, castle.y - 4 * TILE);
    const enemy = w.spawnUnit(1, 'warrior', castle.x + 80, castle.y - 4 * TILE);
    enemy.alive = false; // só para garantir que monge não ataca: não há inimigos vivos
    hurt.hp = 40;
    run(w, 10);
    expect(hurt.hp).toBeGreaterThan(40);
    expect(monk.hp).toBe(monk.maxHp);
  });

  it('monge não ataca inimigos', () => {
    const w = new World({ seed: 8, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const monk = w.spawnUnit(0, 'monk', castle.x, castle.y - 4 * TILE);
    const foe = w.spawnUnit(1, 'pawn', castle.x + 60, castle.y - 4 * TILE);
    w.issue(0, { type: 'attack', unitIds: [monk.id], targetId: foe.id });
    run(w, 5);
    expect(foe.hp).toBe(foe.maxHp);
    expect(monk.order?.type === 'attack').toBe(false);
  });

  it('guerreiro derrota arqueiro inimigo no corpo a corpo', () => {
    const w = new World({ seed: 7, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const x = castle.x;
    const y = castle.y - 5 * TILE;
    const war = w.spawnUnit(0, 'warrior', x, y);
    const archer = w.spawnUnit(1, 'archer', x + 3 * TILE, y);
    w.issue(0, { type: 'attack', unitIds: [war.id], targetId: archer.id });
    run(w, 30);
    expect(archer.alive).toBe(false);
    expect(war.alive).toBe(true);
  });

  it('lanceiro vence guerreiro (mais vida e armadura)', () => {
    const w = new World({ seed: 9, difficulty: 'normal', fog: false });
    const castle = w.mainBuilding(0)!;
    const y = castle.y - 5 * TILE;
    const lancer = w.spawnUnit(0, 'lancer', castle.x, y);
    const war = w.spawnUnit(1, 'warrior', castle.x + 2 * TILE, y);
    w.issue(0, { type: 'attack', unitIds: [lancer.id], targetId: war.id });
    run(w, 40);
    expect(war.alive).toBe(false);
    expect(lancer.alive).toBe(true);
  });
});

describe('IA do reino rival', () => {
  it('desenvolve a economia e ataca em uma partida simulada', () => {
    const w = new World({ seed: 11, difficulty: 'hard', fog: false });
    const ai = new RivalAI(w, 1);
    w.controllers.push(ai);
    let waves = 0;
    w.events.on((e) => {
      if (e.type === 'attackWave') waves++;
    });
    run(w, 420);
    const rivals = w.units.filter((u) => u.team === 1);
    const workers = rivals.filter((u) => u.isWorker).length;
    expect(workers).toBeGreaterThanOrEqual(8);
    expect(w.buildings.some((b) => b.team === 1 && b.def.id === 'barracks' && b.complete)).toBe(true);
    expect(w.buildings.some((b) => b.team === 1 && b.def.id === 'house' && b.complete)).toBe(true);
    expect(rivals.some((u) => u.def.id === 'archer' || u.def.id === 'lancer')).toBe(true);
    expect(waves).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
