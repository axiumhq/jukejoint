import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DaySessions, QuorumAsk } from '../components/DaySessions';
import { QuietSkyline } from '../components/Deco';
import { FeaturedLobby } from '../components/FeaturedLobby';
import { Icon } from '../components/Icon';
import { LobbyRow } from '../components/LobbyRow';
import { LobbyTicket } from '../components/LobbyTicket';
import { ModeSeal } from '../components/ModeSeal';
import { modes, type Region } from '../data/modes';
import { liveBase } from '../data/stats';
import { useDocumentTitle, useLiveNumber } from '../hooks';
import { useNow } from '../hooks/useNow';
import { formatNumber, t } from '../i18n';
import {
  EMPTY_FILTERS,
  filterCounts,
  filterLobbies,
  hasRoom,
  isSortKey,
  nearestAlternatives,
  REGIONS,
  SORT_KEYS,
  type LobbyFilters,
  type SortKey,
} from '../lib/lobbies';
import { useSession } from '../state/session';

export type LobbyView = 'compacta' | 'ingresso';
const VIEW_KEY = 'projeto-lobby-vista';

function readFilters(p: URLSearchParams): LobbyFilters {
  const sort = p.get('ordem');
  const regions = (p.get('regiao') ?? '')
    .split(',')
    .filter((r): r is Region => (REGIONS as string[]).includes(r));
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
  for (const k of ['vista', 'vazio']) {
    const v = keep.get(k);
    if (v) p.set(k, v);
  }
  return p;
}

/** Vista: URL manda; senão a última escolha; senão compacta no celular e ingresso no desktop. */
function initialView(p: URLSearchParams): LobbyView {
  const v = p.get('vista');
  if (v === 'compacta' || v === 'ingresso') return v;
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'compacta' || saved === 'ingresso') return saved;
  } catch {
    /* armazenamento indisponível */
  }
  return window.matchMedia('(min-width: 48em)').matches ? 'ingresso' : 'compacta';
}

/** Anúncio resumido para leitor de tela: no máximo um a cada 15 s, nunca por linha. */
function useActivityAnnouncer(lobbies: ReturnType<typeof useSession>['lobbies']) {
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

export function Lobbies() {
  useDocumentTitle(t.meta.lobbies);
  const { lobbies, user, signIn, openHost, requestJoin, notify, toggleNotify, lobbyCtx } = useSession();
  const [params, setParams] = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState<LobbyView>(() => initialView(params));
  const now = useNow(5000);
  const playersLive = useLiveNumber(liveBase.playersOnline, liveBase.playersJitter, liveBase.intervalMs);
  const f = readFilters(params);
  /** ?vazio=1 simula a cidade sem nenhum lobby (para revisar o estado vazio). */
  const simulateEmpty = params.get('vazio') === '1';
  const pool = simulateEmpty ? [] : lobbies;
  const announcement = useActivityAnnouncer(pool);

  const update = (patch: Partial<LobbyFilters>) => setParams(writeFilters({ ...f, ...patch }, params), { replace: true });

  const urlView = params.get('vista');
  useEffect(() => {
    if (urlView === 'compacta' || urlView === 'ingresso') setView(urlView);
  }, [urlView]);

  const chooseView = (v: LobbyView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignora */
    }
    const p = new URLSearchParams(params);
    p.set('vista', v);
    setParams(p, { replace: true });
  };

  const results = useMemo(() => filterLobbies(pool, f, !!user, lobbyCtx, now), [pool, params, user, lobbyCtx, now]);
  const counts = useMemo(() => filterCounts(pool, f, !!user), [pool, params, user]);

  const activeCount = (f.mode ? 1 : 0) + (f.regions.length ? 1 : 0) + (f.slotsOnly ? 1 : 0) + (f.friendsOnly ? 1 : 0);
  const anyFilter = activeCount > 0 || f.q !== '';
  const filteredEmpty = anyFilter && !simulateEmpty;
  const suggestions = results.length === 0 && filteredEmpty ? nearestAlternatives(pool, f, !!user) : [];
  const notifyKey = `vazio:${f.mode}:${f.regions.join(',')}`;
  const notifyOn = notify.has(notifyKey);
  const topMode = [...modes].sort((a, b) => b.playersNow - a.playersNow)[0]!;

  const clearAll = () => setParams(writeFilters({ ...EMPTY_FILTERS, sort: f.sort }, params), { replace: true });
  const toggleRegion = (r: Region) => update({ regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] });

  const listedLobbies = pool.filter((l) => l.status !== 'cheio').length;
  const withRoom = pool.filter(hasRoom).length;

  return (
    <div className="container page lobbies-page">
      <header className="page-head page-head-split lb-head">
        <div>
          <h1>{t.lobbies.title}</h1>
          <p className="page-lead">{t.lobbies.lead}</p>
          <p className="tech-line">
            <span>
              <span className="live-dot" aria-hidden="true" />
              <b className="num">{formatNumber(simulateEmpty ? 0 : playersLive)}</b> {t.lobbies.techPlayers}
            </span>
            <span>
              <b className="num">{listedLobbies}</b> {t.lobbies.techLobbies(listedLobbies)}
            </span>
            <span>
              <b className="num">{withRoom}</b> {t.lobbies.techOpen}
            </span>
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => openHost(f.mode || undefined)}>
          <Icon name="plus" size={18} />
          {t.lobbies.create}
        </button>
      </header>

      <FeaturedLobby empty={simulateEmpty} />

      <div className="toolbar lb-toolbar">
        <div className="search">
          <label htmlFor="lobby-search" className="sr-only">
            {t.lobbies.search}
          </label>
          <Icon name="search" size={18} />
          <input id="lobby-search" type="search" placeholder={t.lobbies.searchPlaceholder} value={f.q} onChange={(e) => update({ q: e.target.value })} />
        </div>
        <button
          type="button"
          className="btn btn-ghost filters-toggle"
          aria-expanded={panelOpen}
          aria-controls="lobby-filters"
          onClick={() => setPanelOpen((v) => !v)}
        >
          <Icon name="sliders" size={18} />
          {t.lobbies.filtersActive(activeCount)}
        </button>
        <div className="sort">
          <label htmlFor="lobby-sort">{t.lobbies.sort}</label>
          <select id="lobby-sort" value={f.sort} aria-describedby="sort-hint" onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {(SORT_KEYS.includes(f.sort) ? SORT_KEYS : [f.sort, ...SORT_KEYS]).map((k) => (
              <option key={k} value={k}>
                {t.lobbies.sortOptions[k]}
              </option>
            ))}
          </select>
          <span id="sort-hint" className="sr-only">
            {t.lobbies.sortHint}
          </span>
        </div>
        <div className="view-toggle" role="group" aria-label={t.lobbies.view}>
          <button type="button" className="seg-btn" aria-pressed={view === 'compacta'} onClick={() => chooseView('compacta')}>
            {t.lobbies.viewCompact}
          </button>
          <button type="button" className="seg-btn" aria-pressed={view === 'ingresso'} onClick={() => chooseView('ingresso')}>
            {t.lobbies.viewTicket}
          </button>
        </div>
      </div>

      <div className="lobbies-layout">
        <aside id="lobby-filters" className={`filters lb-filters${panelOpen ? ' is-open' : ''}`} aria-label={t.lobbies.filters}>
          <fieldset className="field">
            <legend>{t.lobbies.mode}</legend>
            <ul className="mode-filter">
              <li>
                <button type="button" className="mode-opt" aria-pressed={!f.mode} onClick={() => update({ mode: '' })}>
                  <span className="mode-opt-all" aria-hidden="true" />
                  <span className="mode-opt-name">{t.lobbies.allModes}</span>
                  <span className="mode-opt-count num">{counts.all}</span>
                </button>
              </li>
              {modes.map((m) => (
                <li key={m.slug}>
                  <button type="button" className="mode-opt" aria-pressed={f.mode === m.slug} onClick={() => update({ mode: f.mode === m.slug ? '' : m.slug })}>
                    <ModeSeal mode={m} size="sm" />
                    <span className="mode-opt-name">{m.name}</span>
                    <span className="mode-opt-count num">{counts.modes[m.slug] ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="field">
            <legend>{t.lobbies.region}</legend>
            <div className="segmented lb-regions">
              {REGIONS.map((r) => (
                <button key={r} type="button" className="seg-btn" aria-pressed={f.regions.includes(r)} onClick={() => toggleRegion(r)}>
                  {t.regions[r]}
                  <span className="seg-count num">{counts.regions[r]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="check">
            <input type="checkbox" checked={f.slotsOnly} onChange={(e) => update({ slotsOnly: e.target.checked })} />
            <span>
              {t.lobbies.slotsOnly} <span className="check-count num">{counts.slotsOnly}</span>
            </span>
          </label>

          <div>
            <label className="check">
              <input
                type="checkbox"
                checked={f.friendsOnly && !!user}
                disabled={!user}
                aria-describedby={!user ? 'friends-hint' : undefined}
                onChange={(e) => update({ friendsOnly: e.target.checked })}
              />
              <span>
                {t.lobbies.friendsOnly} {user && <span className="check-count num">{counts.friendsOnly}</span>}
              </span>
            </label>
            {!user && (
              <p id="friends-hint" className="hint">
                {t.lobbies.friendsNeedSignIn}{' '}
                <button type="button" className="link-btn" onClick={signIn}>
                  {t.account.signIn}
                </button>
              </p>
            )}
          </div>

          {anyFilter && (
            <button type="button" className="link-btn" onClick={clearAll}>
              {t.lobbies.clear}
            </button>
          )}
        </aside>

        <section className="results" aria-labelledby="results-count">
          <h2 id="results-count" className="results-count" aria-live="polite">
            {t.lobbies.results(results.length)}
          </h2>
          {results.length > 0 ? (
            view === 'compacta' ? (
              <ul className="lb-list is-compact">
                {results.map((l) => (
                  <LobbyRow key={l.id} lobby={l} now={now} />
                ))}
              </ul>
            ) : (
              <ul className="lb-list is-tickets">
                {results.map((l) => (
                  <LobbyTicket key={l.id} lobby={l} now={now} />
                ))}
              </ul>
            )
          ) : filteredEmpty ? (
            <div className="empty lb-empty">
              <QuietSkyline className="empty-art" lit={false} />
              <h3>{t.lobbies.emptyFilteredTitle}</h3>
              <p>{t.lobbies.emptyFilteredBody}</p>
              {suggestions.length > 0 && (
                <ul className="suggestions">
                  {suggestions.map((s) => (
                    <li key={s.label}>
                      <button type="button" className="btn btn-outline" onClick={() => update(s.patch)}>
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="empty-actions">
                <button type="button" className="btn btn-ghost" onClick={clearAll}>
                  {t.lobbies.emptyFilteredClear}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => openHost(f.mode || undefined)}>
                  <Icon name="plus" size={18} />
                  {t.lobbies.emptyCreate}
                </button>
                <button type="button" className="btn btn-ghost" aria-pressed={notifyOn} onClick={() => toggleNotify(notifyKey, t.lobbies.emptyNotifyToast)}>
                  <Icon name={notifyOn ? 'check' : 'bell'} size={18} />
                  {notifyOn ? t.lobbies.emptyNotifyOn : t.lobbies.emptyNotify}
                </button>
              </div>
            </div>
          ) : (
            <div className="empty lb-empty">
              <QuietSkyline className="empty-art" />
              <h3>{t.lobbies.emptyNoneTitle}</h3>
              <p>{t.lobbies.emptyNoneBody}</p>
              <div className="empty-seals" role="group" aria-label={t.lobbies.emptyNoneSeals}>
                {modes.map((m) => (
                  <button key={m.slug} type="button" className="seal-shortcut" onClick={() => openHost(m.slug)}>
                    <ModeSeal mode={m} size="lg" />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
              <div className="empty-actions">
                <QuorumAsk mode={f.mode || topMode.slug} />
                <button type="button" className="btn btn-ghost" onClick={() => requestJoin({ kind: 'bots' })}>
                  <Icon name="bot" size={18} />
                  {t.lobbies.emptyBots}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <DaySessions />

      <p className="sr-only" role="status" aria-live="polite" aria-label={t.lobbies.activityRegion}>
        {announcement}
      </p>
    </div>
  );
}
