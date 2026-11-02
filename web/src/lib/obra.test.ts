import { describe, expect, it } from 'vitest';
import type { Lobby } from '../data/lobbies';
import { advanceObra, landedAt, OBRA, planObra } from './obra';
import { buildFloors } from './towerData';

function lobby(p: Partial<Lobby>): Lobby {
  return {
    id: 'x',
    name: 'Sala',
    modeSlug: 'circulo-profano',
    host: 'Anfitriã',
    hostIsFriend: false,
    region: 'BR',
    ping: 20,
    players: 4,
    slots: 8,
    friends: 0,
    status: 'aberto',
    joinInProgress: false,
    locked: false,
    minutesAgo: 5,
    openedAt: 0,
    minPlayers: 4,
    joins: [],
    ...p,
  };
}

const floors = buildFloors(
  [
    lobby({ id: 'a', slots: 12, players: 3, minutesAgo: 2 }),
    lobby({ id: 'b', slots: 10, players: 5, minutesAgo: 40 }),
    lobby({ id: 'c', slots: 8, players: 2, minutesAgo: 12 }),
  ],
  18,
);

describe('planObra', () => {
  it('derruba os andares na ordem de criação dos lobbies, STEP segundos entre eles', () => {
    const plan = planObra(floors);
    // Pilha (de baixo para cima): a (12 vagas), b (10), c (8). Criação: b, c, a.
    expect(floors.map((f) => f.lobby.id)).toEqual(['a', 'b', 'c']);
    expect(plan.rank).toEqual([2, 0, 1]);
    expect(plan.fall[1]).toBeCloseTo(OBRA.FIRST);
    expect(plan.fall[2]! - plan.fall[1]!).toBeCloseTo(OBRA.STEP);
    expect(plan.fall[0]! - plan.fall[2]!).toBeCloseTo(OBRA.STEP);
  });

  it('manda uma brasa por jogador, e nenhuma antes do andar dela pousar', () => {
    const plan = planObra(floors);
    expect(plan.embers).toHaveLength(3 + 5 + 2);
    for (const e of plan.embers) {
      expect(e.launch).toBeGreaterThanOrEqual(landedAt(plan, e.f));
      expect(e.arrive).toBeCloseTo(e.launch + OBRA.FLY);
    }
    // O clímax vem depois da última janela e do farol; a abertura cabe em ~4 s.
    expect(plan.climax).toBeGreaterThan(Math.max(...plan.embers.map((e) => e.arrive)));
    expect(plan.climax).toBeGreaterThan(plan.beacon);
    expect(plan.end).toBeLessThan(4.5);
  });

  it('com 18 andares cheios ainda fecha em cerca de 4 s', () => {
    const many = buildFloors(
      Array.from({ length: 18 }, (_, i) => lobby({ id: `l${i}`, slots: 12, players: 12, minutesAgo: i })),
      18,
    );
    const plan = planObra(many);
    expect(plan.embers).toHaveLength(18 * 12);
    expect(plan.end).toBeLessThan(4.6);
  });
});

describe('advanceObra', () => {
  it('anda em tempo real sem gesto', () => {
    expect(advanceObra(1, 0.016, 4, null)).toBeCloseTo(1.016);
  });

  it('depois de um gesto, o resto cabe em OBRA.SKIP segundos', () => {
    let t = 1;
    let real = 0;
    while (t < 4 && real < 1) {
      t = advanceObra(t, 1 / 60, 4, 1);
      real += 1 / 60;
    }
    expect(t).toBeGreaterThanOrEqual(4);
    expect(real).toBeLessThanOrEqual(OBRA.SKIP + 1 / 60 + 1e-9);
  });
});
