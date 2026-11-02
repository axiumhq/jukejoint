import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Region } from '../data/modes';
import { EMPTY_FILTERS, isSortKey, LOW_PING_MS, REGIONS, type LobbyFilters } from '../lib/lobbies';

/**
 * Os filtros da lista moram na URL (dá para mandar o link): modo, região, chips, aba e busca.
 * `modo` é o mesmo parâmetro de antes; as capas de "Modos ao vivo" escrevem nele.
 * Aba: `amigos=1` (Amigos) ou `favoritos=1` (Favoritos, salvos neste navegador).
 */
export type BrowseTab = 'all' | 'friends' | 'fav';

export function readFilters(p: URLSearchParams): LobbyFilters {
  const sort = p.get('ordem');
  const regions = (p.get('regiao') ?? '').split(',').filter((r): r is Region => (REGIONS as string[]).includes(r));
  return {
    q: p.get('q') ?? '',
    mode: p.get('modo') ?? '',
    regions,
    slotsOnly: p.get('vagas') === '1',
    friendsOnly: p.get('amigos') === '1',
    beginners: p.get('iniciantes') === '1',
    playing: p.get('partida') === '1',
    lowPing: p.get('ping') === String(LOW_PING_MS),
    sort: isSortKey(sort) ? sort : 'ativos',
  };
}

/** Parâmetros que não são filtro e passam adiante (`vazio`, `theme`). */
const KEEP = ['vazio', 'theme'];

export function writeFilters(f: LobbyFilters, keep: URLSearchParams, favorites = false) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.mode) p.set('modo', f.mode);
  if (f.regions.length) p.set('regiao', f.regions.join(','));
  if (f.slotsOnly) p.set('vagas', '1');
  if (f.friendsOnly) p.set('amigos', '1');
  if (favorites) p.set('favoritos', '1');
  if (f.beginners) p.set('iniciantes', '1');
  if (f.playing) p.set('partida', '1');
  if (f.lowPing) p.set('ping', String(LOW_PING_MS));
  if (f.sort !== 'ativos') p.set('ordem', f.sort);
  for (const k of KEEP) {
    const v = keep.get(k);
    if (v) p.set(k, v);
  }
  return p;
}

export function useLobbyFilters() {
  const [params, setParams] = useSearchParams();
  const f = useMemo(() => readFilters(params), [params]);
  const tab: BrowseTab = params.get('favoritos') === '1' ? 'fav' : f.friendsOnly ? 'friends' : 'all';

  const write = useCallback(
    (next: LobbyFilters, fav: boolean) => setParams(writeFilters(next, params, fav), { replace: true, preventScrollReset: true }),
    [params, setParams],
  );
  const update = useCallback((patch: Partial<LobbyFilters>) => write({ ...f, ...patch }, tab === 'fav'), [f, tab, write]);
  const setTab = useCallback((next: BrowseTab) => write({ ...f, friendsOnly: next === 'friends' }, next === 'fav'), [f, write]);
  const clearAll = useCallback(() => write({ ...EMPTY_FILTERS, sort: f.sort }, false), [f.sort, write]);

  return { f, tab, params, update, setTab, clearAll };
}
