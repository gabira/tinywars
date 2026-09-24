import { describe, expect, it } from 'vitest';
import { World } from '../systems/World';
import { cardSignature, commandCard } from './commandCard';
import type { Session } from './Session';

/** Sessão mínima para testar o cartão de comandos sem o Phaser. */
function fakeSession(world: World): Session {
  return {
    world,
    selection: [] as number[],
    buildMenu: false,
    placing: null,
    mode: 'normal',
    toast: () => undefined,
    ui: { emit: () => undefined },
    startPlacing: () => undefined,
    cancelMode: () => undefined,
  } as unknown as Session;
}

describe('cartão de comandos com dois quartéis', () => {
  const world = new World({ seed: 3, difficulty: 'normal', fog: false });
  Object.assign(world.players[0].res, { gold: 999, wood: 999, meat: 999 });
  const c = world.mainBuilding(0)!;
  const b1 = world.addBuilding(0, 'barracks', c.tx + 6, c.ty - 6, true);
  const b2 = world.addBuilding(0, 'barracks', c.tx + 6, c.ty - 3, true);
  const s = fakeSession(world);

  it('trocar de quartel muda a assinatura (o HUD recria os botões)', () => {
    s.selection = [b1.id];
    const sig1 = cardSignature(s, commandCard(s));
    s.selection = [b2.id];
    const sig2 = cardSignature(s, commandCard(s));
    expect(sig1).not.toBe(sig2);
  });

  it('o botão de treinar usa o quartel selecionado', () => {
    s.selection = [b2.id];
    commandCard(s).find((b) => b.hotkey === 'G')!.action();
    expect(b2.queue.length).toBe(1);
    expect(b1.queue.length).toBe(0);
  });
});
