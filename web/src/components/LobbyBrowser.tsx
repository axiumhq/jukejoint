import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { modes, type Region } from '../data/modes';
import { useLiveStats } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useNow } from '../hooks/useNow';
import { formatNumber, t } from '../i18n';
import { EMPTY_FILTERS, filterCounts, filterLobbies, isSortKey, nearestAlternatives, REGIONS, type LobbyFilters } from '../lib/lobbies';
import { liveStats, type LiveStats } from '../lib/stats';
import { useSession } from '../state/session';
import { Credits } from './Common';
import { FriendsBlock } from './Friends';
import { Icon } from './Icon';
import { LobbyTable } from './LobbyTable';

function readFilters(p: URLSearchParams): LobbyFilters {
  const sort = p.get('ordem');
  const regions = (p.get('regiao') ?? '').split(',').filter((r): r is Region => (REGIONS as string[]).includes(r));
  return {
    q: p.get('q') ?? '',
    mode: p.get('modo') ?? '',
    regions,
    slotsOnly: p.get('vagas') === '1',
    friendsOnly: p.get('amigos') === '1',
    sort: isSortKey(sort) ? sort : 'ativos',
  };
}

function writeFilters(f: LobbyFilters, keep: URLSearchParams) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.mode) p.set('modo', f.mode);
  if (f.regions.length) p.set('regiao', f.regions.join(','));
  if (f.slotsOnly) p.set('vagas', '1');
  if (f.friendsOnly) p.set('amigos', '1');
  if (f.sort !== 'ativos') p.set('ordem', f.sort);
  const empty = keep.get('vazio');
  if (empty) p.set('vazio', empty);
  return p;
}

/** Anúncio resumido para leitor de tela: no máximo um a cada 15 s, nunca por linha. */
function useActivityAnnouncer(lobbies: Lobby[]) {
  const [message, setMessage] = useState('');
  const last = useRef({ at: Date.now(), said: 0 });
  useEffect(() => {
    let newest: { name: string; lobby: string; at: number } | null = null;
    for (const l of lobbies) {
      if (l.locked) continue;
      const j = l.joins.at(-1);
      if (j && !j.you && (!newest || j.at > newest.at)) newest = { name: j.name, lobby: l.name, at: j.at };
    }
    if (!newest || newest.at <= last.current.at) return;
    if (Date.now() - last.current.said < 15_000) return;
    last.current = { at: newest.at, said: Date.now() };
    setMessage(t.lobbies.activityAnnounce(newest.name, newest.lobby));
  }, [lobbies]);
  return message;
}

/** Coluna lateral, 1: os modos como filtro, com quantos jogam em cada um agora. */
function RailModes({ current, stats, onPick }: { current: string; stats: LiveStats; onPick: (slug: string) => void }) {
  return (
    <section className="rail-block rail-block--modes" aria-labelledby="rail-modes">
      <header className="rail-head">
        <h3 id="rail-modes">{t.rail.modes}</h3>
        <span>{t.rail.playing}</span>
      </header>
      <ul className="rail-modes">
        <li>
          <button type="button" aria-pressed={current === ''} onClick={() => onPick('')}>
            <span>{t.lobbies.allModes}</span>
            <span className="num">{formatNumber(stats.players)}</span>
          </button>
        </li>
        {modes.map((m) => (
          <li key={m.slug}>
            <button type="button" aria-pressed={current === m.slug} onClick={() => onPick(current === m.slug ? '' : m.slug)}>
              <span>{m.name}</span>
              <span className="num">{formatNumber(stats.byMode[m.slug]?.players ?? 0)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ARRIVALS = 5;

/** Coluna lateral, 2: quem acabou de entrar em algum lobby (o sinal de que a cidade está viva). */
function Arrivals({ lobbies, now, signedIn }: { lobbies: Lobby[]; now: number; signedIn: boolean }) {
  const items = useMemo(
    () =>
      lobbies
        .flatMap((l) =>
          l.locked
            ? []
            : l.joins
                .filter((j) => !j.you)
                .map((j) => ({
                  ...j,
                  lobby: l.name,
                  key: `${l.id}-${j.at}-${j.name}`,
                })),
        )
        .sort((a, b) => b.at - a.at)
        .slice(0, ARRIVALS),
    [lobbies],
  );

  return (
    <section className="rail-block" aria-labelledby="rail-arrivals">
      <header className="rail-head">
        <h3 id="rail-arrivals">
          <i className="live-dot" aria-hidden="true" />
          {t.rail.arrivals}
        </h3>
      </header>
      {items.length > 0 ? (
        <ol className="arrivals">
          {items.map((j) => (
            <li key={j.key}>
              <span className={`ar-who${signedIn && j.friend ? ' is-friend' : ''}`}>{j.name}</span>
              <span className="ar-when num">{t.rail.ago(Math.max(0, Math.round((now - j.at) / 1000)))}</span>
              <span className="ar-what">
                {t.rail.joined} <span>{j.lobby}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rail-empty">{t.rail.arrivalsEmpty}</p>
      )}
    </section>
  );
}

/**
 * O navegador de lobbies: o coração do site (é a home). Filtros na URL, a tabela única,
 * os estados vazios e, ao lado, os modos como filtro e quem está chegando.
 */
export function LobbyBrowser() {
  const { lobbies, user, signIn, openHost, requestJoin, lobbyCtx } = useSession();
  const [params, setParams] = useSearchParams();
  const now = useNow(5000);
  const f = readFilters(params);
  /** ?vazio=1 simula a cidade sem nenhum lobby (para revisar o estado vazio). */
  const simulateEmpty = params.get('vazio') === '1';
  const pool = simulateEmpty ? [] : lobbies;
  const live = useLiveStats();
  const stats = simulateEmpty ? liveStats([]) : live;
  const announcement = useActivityAnnouncer(pool);

  const update = (patch: Partial<LobbyFilters>) =>
    setParams(writeFilters({ ...f, ...patch }, params), {
      replace: true,
      preventScrollReset: true,
    });
  const results = useMemo(() => filterLobbies(pool, f, !!user, lobbyCtx, now), [pool, params, user, lobbyCtx, now]);
  const counts = useMemo(() => filterCounts(pool, f, !!user), [pool, params, user]);
  const featured = useFeaturedLobby(pool, f.mode || undefined, now);

  const anyFilter = !!f.mode || f.regions.length > 0 || f.slotsOnly || f.friendsOnly || f.q !== '';
  const suggestions = results.length === 0 && anyFilter ? nearestAlternatives(pool, f, !!user) : [];
  const clearAll = () =>
    setParams(writeFilters({ ...EMPTY_FILTERS, sort: f.sort }, params), {
      replace: true,
      preventScrollReset: true,
    });
  const toggleRegion = (r: Region) =>
    update({
      regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r],
    });

  return (
    <section id="lobbies" className="browser" aria-labelledby="lobbies-title">
      <div className="wrap browser-in">
        <header className="lb-head">
          <div className="lb-title">
            <h2 id="lobbies-title">{t.lobbies.title}</h2>
            <Credits counts={stats} className="credits--inline" />
          </div>
          <button type="button" className="btn btn-line" onClick={() => openHost(f.mode || undefined)}>
            <Icon name="plus" size={14} />
            {t.lobbies.create}
          </button>
        </header>

        <div className="browser-main">

          <div className="filters" role="group" aria-label={t.lobbies.filtersLabel}>
            {/* Em tela larga o filtro de modo é a coluna lateral; aqui fica para telas estreitas. */}
            <label className="f-select f-mode">
              <span className="sr-only">{t.lobbies.mode}</span>
              <select value={f.mode} onChange={(e) => update({ mode: e.target.value })}>
                <option value="">{t.lobbies.modeOption(t.lobbies.allModes, counts.all)}</option>
                {modes.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {t.lobbies.modeOption(m.name, counts.modes[m.slug] ?? 0)}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={14} />
            </label>
            <div className="f-seg" role="group" aria-label={t.lobbies.region}>
              {REGIONS.map((r) => (
                <button key={r} type="button" aria-pressed={f.regions.includes(r)} onClick={() => toggleRegion(r)}>
                  {t.regions[r]}
                </button>
              ))}
            </div>
            <label className="f-check">
              <input type="checkbox" checked={f.slotsOnly} onChange={(e) => update({ slotsOnly: e.target.checked })} />
              <span>{t.lobbies.slotsOnly}</span>
            </label>
            <span className="f-check-wrap">
              <label className="f-check">
                <input type="checkbox" checked={f.friendsOnly && !!user} disabled={!user} onChange={(e) => update({ friendsOnly: e.target.checked })} />
                <span>{t.lobbies.friendsOnly}</span>
              </label>
              {!user && (
                <button type="button" className="link-quiet" onClick={signIn}>
                  ({t.lobbies.friendsSignIn})
                </button>
              )}
            </span>
            <p className="f-count" aria-live="polite">
              <span>
                <span className="num">{results.length}</span> {t.lobbies.resultsUnit(results.length)}
              </span>
              {anyFilter && (
                <button type="button" className="link-quiet" onClick={clearAll}>
                  {t.lobbies.clear}
                </button>
              )}
            </p>
          </div>

          {results.length > 0 ? (
            <LobbyTable lobbies={results} featured={featured} now={now} />
          ) : anyFilter ? (
            <div className="empty">
              <h3>{t.lobbies.emptyFilteredTitle}</h3>
              <p>{t.lobbies.emptyFilteredBody}</p>
              <div className="empty-actions">
                {suggestions.map((s) => (
                  <button key={s.label} type="button" className="btn btn-line" onClick={() => update(s.patch)}>
                    {s.label}
                  </button>
                ))}
                <button type="button" className="btn btn-quiet" onClick={clearAll}>
                  {t.lobbies.clear}
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => openHost(f.mode || undefined)}>
                  {t.lobbies.emptyCreate}
                </button>
              </div>
            </div>
          ) : (
            <div className="empty">
              <h3>{t.lobbies.emptyNoneTitle}</h3>
              <p>{t.lobbies.emptyNoneBody}</p>
              <div className="empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => openHost()}>
                  {t.lobbies.create}
                </button>
                <button type="button" className="btn btn-line" onClick={() => requestJoin({ kind: 'bots' })}>
                  {t.lobbies.emptyBots}
                </button>
              </div>
            </div>
          )}

          <p className="sr-only" role="status" aria-live="polite" aria-label={t.lobbies.activityRegion}>
            {announcement}
          </p>
        </div>

        <aside className="rail" aria-label={t.rail.label}>
          <FriendsBlock />
          <RailModes current={f.mode} stats={stats} onPick={(slug) => update({ mode: slug })} />
          <Arrivals lobbies={pool} now={now} signedIn={!!user} />
        </aside>
      </div>
    </section>
  );
}
