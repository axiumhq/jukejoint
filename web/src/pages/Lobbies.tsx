import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { LiveStrip } from '../components/Common';
import { LobbyRow } from '../components/LobbyRow';
import { modes, type Region } from '../data/modes';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';
import { filterLobbies, REGIONS, SORT_KEYS, type LobbyFilters, type SortKey } from '../lib/lobbies';
import { useSession } from '../state/session';

function readFilters(p: URLSearchParams): LobbyFilters {
  const sort = p.get('ordem') as SortKey | null;
  const regions = (p.get('regiao') ?? '')
    .split(',')
    .filter((r): r is Region => (REGIONS as string[]).includes(r));
  return {
    q: p.get('q') ?? '',
    mode: p.get('modo') ?? '',
    regions,
    slotsOnly: p.get('vagas') === '1',
    friendsOnly: p.get('amigos') === '1',
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'recomendados',
  };
}

function writeFilters(f: LobbyFilters, keep: URLSearchParams) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.mode) p.set('modo', f.mode);
  if (f.regions.length) p.set('regiao', f.regions.join(','));
  if (f.slotsOnly) p.set('vagas', '1');
  if (f.friendsOnly) p.set('amigos', '1');
  if (f.sort !== 'recomendados') p.set('ordem', f.sort);
  const empty = keep.get('vazio');
  if (empty) p.set('vazio', empty);
  return p;
}

export function Lobbies() {
  useDocumentTitle(t.meta.lobbies);
  const { lobbies, user, signIn, openHost, requestJoin, notify, toggleNotify } = useSession();
  const [params, setParams] = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);
  const f = readFilters(params);
  /** ?vazio=1 simula a cidade sem nenhum lobby (para revisar o estado vazio). */
  const simulateEmpty = params.get('vazio') === '1';

  const update = (patch: Partial<LobbyFilters>) => setParams(writeFilters({ ...f, ...patch }, params), { replace: true });

  const results = useMemo(
    () => (simulateEmpty ? [] : filterLobbies(lobbies, f, !!user)),
    [lobbies, params, user, simulateEmpty],
  );

  const activeCount = (f.mode ? 1 : 0) + (f.regions.length ? 1 : 0) + (f.slotsOnly ? 1 : 0) + (f.friendsOnly ? 1 : 0);
  const anyFilter = activeCount > 0 || f.q !== '';
  const notifyKey = `vazio:${f.mode}:${f.regions.join(',')}`;
  const notifyOn = notify.has(notifyKey);

  const toggleRegion = (r: Region) =>
    update({ regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] });

  return (
    <div className="container page">
      <header className="page-head page-head-split">
        <div>
          <h1>{t.lobbies.title}</h1>
          <p className="page-lead">{t.lobbies.lead}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openHost(f.mode || undefined)}>
          <Icon name="plus" size={18} />
          {t.lobbies.create}
        </button>
      </header>

      <LiveStrip />

      <div className="toolbar">
        <div className="search">
          <label htmlFor="lobby-search" className="sr-only">
            {t.lobbies.search}
          </label>
          <Icon name="search" size={18} />
          <input
            id="lobby-search"
            type="search"
            placeholder={t.lobbies.searchPlaceholder}
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
          />
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
          <select id="lobby-sort" value={f.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {t.lobbies.sortOptions[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="lobbies-layout">
        <aside id="lobby-filters" className={`filters${panelOpen ? ' is-open' : ''}`} aria-label={t.lobbies.filters}>
          <div className="field">
            <label htmlFor="filter-mode">{t.lobbies.mode}</label>
            <select id="filter-mode" value={f.mode} onChange={(e) => update({ mode: e.target.value })}>
              <option value="">{t.lobbies.allModes}</option>
              {modes.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="field">
            <legend>{t.lobbies.region}</legend>
            <div className="segmented">
              {REGIONS.map((r) => (
                <button key={r} type="button" className="seg-btn" aria-pressed={f.regions.includes(r)} onClick={() => toggleRegion(r)}>
                  {t.regions[r]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="check">
            <input type="checkbox" checked={f.slotsOnly} onChange={(e) => update({ slotsOnly: e.target.checked })} />
            <span>{t.lobbies.slotsOnly}</span>
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
              <span>{t.lobbies.friendsOnly}</span>
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
            <button type="button" className="link-btn" onClick={() => setParams(writeFilters({ ...f, q: '', mode: '', regions: [], slotsOnly: false, friendsOnly: false }, params), { replace: true })}>
              {t.lobbies.clear}
            </button>
          )}
        </aside>

        <section className="results" aria-labelledby="results-count">
          <p id="results-count" className="results-count" aria-live="polite">
            {t.lobbies.results(results.length)}
          </p>
          {results.length > 0 ? (
            <ul className="lobby-list is-table">
              {results.map((l) => (
                <LobbyRow key={l.id} lobby={l} />
              ))}
            </ul>
          ) : (
            <div className="empty">
              <svg className="empty-art" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
                <path d="M4 64V30h14V18h10v12h8V8h20v56M60 64V24h18v-8h12v8h10v40M104 64V40h12v24" />
                <rect x="44" y="20" width="4" height="6" className="lit" />
              </svg>
              <h2>{anyFilter && !simulateEmpty ? t.lobbies.emptyFilteredTitle : t.lobbies.emptyNoneTitle}</h2>
              <p>{t.lobbies.emptyBody}</p>
              <div className="empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => openHost(f.mode || undefined)}>
                  <Icon name="plus" size={18} />
                  {t.lobbies.emptyCreate}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => requestJoin({ kind: 'bots' })}>
                  <Icon name="bot" size={18} />
                  {t.lobbies.emptyBots}
                </button>
                <button type="button" className="btn btn-ghost" aria-pressed={notifyOn} onClick={() => toggleNotify(notifyKey, t.lobbies.emptyNotifyToast)}>
                  <Icon name={notifyOn ? 'check' : 'bell'} size={18} />
                  {notifyOn ? t.lobbies.emptyNotifyOn : t.lobbies.emptyNotify}
                </button>
              </div>
              {anyFilter && !simulateEmpty && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setParams(writeFilters({ q: '', mode: '', regions: [], slotsOnly: false, friendsOnly: false, sort: f.sort }, params), { replace: true })}
                >
                  {t.lobbies.clear}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
