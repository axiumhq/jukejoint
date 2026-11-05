import { describe, expect, it } from 'vitest';
import type { Lobby } from '../data/lobbies';
import { modes } from '../data/modes';
import { cardCorner, closedNote, isTeamFormat, lobbyNum, missingText } from './lobbyCard';
import { lobbyState } from './lobbies';

const NOW = 1_800_000_000_000;

function lobby(p: Partial<Lobby> = {}): Lobby {
  return {
    id: 'l04',
    name: 'Sala',
    modeSlug: 'circulo-profano',
    host: 'Anfitriã',
    hostIsFriend: false,
    region: 'BR',
    ping: 20,
    players: 6,
    slots: 12,
    friends: 0,
    status: 'aberto',
    joinInProgress: false,
    locked: false,
    minutesAgo: 5,
    openedAt: NOW - 5 * 60_000,
    minPlayers: 6,
    joins: [],
    ...p,
  };
}

const corner = (l: Lobby, signedIn = true, ctx = {}) => cardCorner(l, lobbyState(l, ctx, NOW), signedIn, NOW);
const note = (l: Lobby, ctx = {}) => closedNote(l, lobbyState(l, ctx, NOW));

describe('cartão ingresso + cartaz', () => {
  it('número carimbado só nos lobbies numerados', () => {
    expect(lobbyNum(lobby({ id: 'l4' }))).toBe('04');
    expect(lobbyNum(lobby({ id: 'a1b2-c3' }))).toBeNull();
  });

  it('vagas: "Última vaga" quando falta 1, "Faltam N" acima disso', () => {
    expect(missingText(1)).toBe('Última vaga');
    expect(missingText(5)).toBe('Faltam 5');
  });

  it('o canto mostra as vagas quando não há etiqueta', () => {
    expect(corner(lobby({ players: 7 }))).toEqual({ text: 'Faltam 5', accent: false, slotsNote: null });
    expect(corner(lobby({ players: 11 }))).toEqual({ text: 'Última vaga', accent: false, slotsNote: null });
  });

  it('com etiqueta de outra coisa, as vagas descem para o canhoto', () => {
    const play = lobby({ status: 'em-partida', joinInProgress: true, players: 8, round: { current: 2, total: 5, startedAt: NOW } });
    expect(corner(play)).toEqual({ text: 'Em partida · rodada 2 de 5', accent: false, slotsNote: 'Faltam 4' });
    expect(corner(lobby({ beginners: true, players: 9 }))).toMatchObject({ text: 'Iniciantes ok', slotsNote: 'Faltam 3' });
  });

  it('lobby com convite não anuncia vaga; você está aqui leva o latão', () => {
    expect(corner(lobby({ locked: true }))).toEqual({ text: 'Só com convite', accent: false, slotsNote: null });
    const here = lobby();
    expect(corner(here, true, { hereId: here.id })).toEqual({ text: 'Você está aqui', accent: true, slotsNote: null });
  });

  it('lotado: "Sem vaga" no canto e "Lotado" no canhoto, no lugar do botão', () => {
    const full = lobby({ players: 12 });
    expect(corner(full)?.text).toBe('Sem vaga');
    expect(note(full)).toBe('Lotado');
  });

  it('em partida sem vaga: a vaga abre no fim da rodada; com entrada no meio, há botão', () => {
    const closed = lobby({ status: 'em-partida', players: 12, round: { current: 3, total: 5, startedAt: NOW } });
    expect(note(closed)).toBe('Vaga abre no fim da rodada');
    expect(corner(closed)?.text).toBe('Em partida · lotado');
    const open = lobby({ status: 'em-partida', joinInProgress: true, players: 10 });
    expect(note(open)).toBeNull();
    // com vaga mas sem entrada no meio, a ação de avisar continua (não é "sem vaga")
    expect(note(lobby({ status: 'em-partida', players: 10 }))).toBeNull();
  });

  it('quem está dentro sempre tem ação, mesmo lotado', () => {
    const mine = lobby({ mine: true, players: 12 });
    expect(note(mine)).toBeNull();
  });

  it('Âmbar × Safira só nos modos "N contra N"', () => {
    expect(isTeamFormat('6 contra 6')).toBe(true);
    expect(isTeamFormat('5v5')).toBe(true);
    expect(isTeamFormat('1 contra 1 com fila')).toBe(false);
    expect(isTeamFormat('Todos contra todos')).toBe(false);
    expect(isTeamFormat(undefined)).toBe(false);
    expect(modes.filter((m) => isTeamFormat(m.format)).map((m) => m.format)).toEqual(['6 contra 6', '5 contra 5']);
  });
});
