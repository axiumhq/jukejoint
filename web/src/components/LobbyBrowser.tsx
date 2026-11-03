import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Lobby } from '../data/lobbies';
import { getMode, type Region } from '../data/modes';
import { useFavorites, useFriends, useLiveStats, usePref } from '../hooks';
import { useLobbyFilters, type BrowseTab } from '../hooks/useFilters';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { filterLobbies, hasFriends, LOW_PING_MS, nearestAlternatives, REGIONS } from '../lib/lobbies';
import { liveStats } from '../lib/stats';
import { useSession } from '../state/session';
import { Chip, SectionTitle } from './Common';
import { Icon } from './Icon';
import { CreateCard, LobbyCard, orderLobbies } from './LobbyCard';

/**
 * "Lobbies abertos": abas (Todos / Amigos / Favoritos), chips de filtro na URL, cartões ↔ compacto,
 * "Mostrar os outros N", os estados vazios e o anúncio resumido para leitor de tela.
 */

const PAGE = 9;

/** Anúncio resumido para leitor de tela: no máximo um a cada 15 s, nunca por cartão. */
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

/** Faixa de ping por região, para o chip ("BR/SA 12–58 ms"). */
function pingRange(list: Lobby[], r: Region) {
  const ps = list.filter((l) => l.region === r).map((l) => l.ping);
  return ps.length ? t.browse.pingRange(Math.min(...ps), Math.max(...ps)) : null;
}

const TABS: { id: BrowseTab; label: string }[] = [
  { id: 'all', label: t.browse.all },
  { id: 'friends', label: t.browse.friends },
  { id: 'fav', label: t.browse.favorites },
];

export function LobbyBrowser({ featured, now }: { featured: Lobby | undefined; now: number }) {
  const { lobbies, user, signIn, openHost, requestJoin, lobbyCtx, synced } = useSession();
  const friends = useFriends();
  const { f, tab, params, update, setTab, clearAll } = useLobbyFilters();
  const { favs, toggle } = useFavorites();
  const [view, setView] = usePref<'grid' | 'list'>('view', 'grid');
  const [shown, setShown] = useState(PAGE);
  const signedIn = !!user;
  /** ?vazio=1 simula a cidade sem nenhum lobby (para revisar o estado vazio). */
  const pool = params.get('vazio') === '1' ? [] : lobbies;
  const live = useLiveStats();
  const stats = pool === lobbies ? live : liveStats(pool);
  const announcement = useActivityAnnouncer(pool);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filtro novo, página nova.
  const key = params.toString();
  useEffect(() => setShown(PAGE), [key]);

  const filtered = useMemo(() => filterLobbies(pool, f, signedIn, lobbyCtx, now), [pool, f, signedIn, lobbyCtx, now]);
  // Amigos sem login: não há lista para filtrar, então a aba mostra o convite para entrar.
  const results = tab === 'fav' ? filtered.filter((l) => favs.has(l.id)) : tab === 'friends' && !signedIn ? [] : filtered;
  const ordered = orderLobbies(results, lobbyCtx, featured);
  const visible = ordered.slice(0, shown);
  const rest = ordered.length - visible.length;

  const anyChip = !!f.mode || f.regions.length > 0 || f.slotsOnly || f.beginners || f.playing || f.lowPing || f.q !== '';
  const narrowed = anyChip || tab !== 'all';
  const modeName = getMode(f.mode)?.name;
  const counts = {
    all: pool.length,
    friends: signedIn ? pool.filter((l) => hasFriends(l) && !l.locked).length : null,
    fav: pool.filter((l) => favs.has(l.id)).length,
  };
  const env = { ctx: lobbyCtx, signedIn, me: user?.name ?? t.lobbies.you, friends, now };
  const create = () => openHost(f.mode || undefined);
  const toggleRegion = (r: Region) => update({ regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] });

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = (n + TABS.length) % TABS.length;
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  };

  let empty: ReactNode = null;
  if (results.length === 0) {
    if (!synced) {
      // Ao vivo, antes da primeira lista: vazio ainda não quer dizer "0 lobbies".
      empty = (
        <div className="lb-empty lb-loading" aria-busy="true">
          <p>{L.loadingLobbies}</p>
        </div>
      );
    } else if (pool.length === 0) {
      empty = (
        <div className="lb-empty">
          <Icon name="lobbies" />
          <b>{t.lobbies.emptyNoneTitle}</b>
          <p>{t.lobbies.emptyNoneBody}</p>
          <div>
            <button type="button" className="btn btn-p" onClick={() => openHost()}>
              <Icon name="plus" />
              {t.lobbies.create}
            </button>
            <button type="button" className="btn btn-s" onClick={() => requestJoin({ kind: 'bots' })}>
              {t.lobbies.emptyBots}
            </button>
          </div>
        </div>
      );
    } else if (tab === 'friends' && !signedIn) {
      empty = (
        <div className="lb-empty">
          <Icon name="users" />
          <b>{t.browse.friendsOutTitle}</b>
          <p>{t.browse.friendsOutBody}</p>
          <div>
            <button type="button" className="btn btn-p" onClick={signIn}>
              <Icon name="user" />
              {t.account.signIn}
            </button>
          </div>
        </div>
      );
    } else if (tab === 'fav' && counts.fav === 0) {
      empty = (
        <div className="lb-empty">
          <Icon name="star" />
          <b>{t.browse.favEmptyTitle}</b>
          <p>{t.browse.favEmptyBody}</p>
          <div>
            <button type="button" className="btn btn-s" onClick={() => setTab('all')}>
              {t.browse.all}
            </button>
          </div>
        </div>
      );
    } else if (tab === 'friends' && !anyChip) {
      empty = (
        <div className="lb-empty">
          <Icon name="users" />
          <b>{t.browse.friendsEmptyTitle}</b>
          <p>{t.browse.friendsEmptyBody}</p>
          <div>
            <button type="button" className="btn btn-p" onClick={create}>
              <Icon name="plus" />
              {t.lobbies.create}
            </button>
          </div>
        </div>
      );
    } else {
      const suggestions = nearestAlternatives(pool, f, signedIn);
      empty = (
        <div className="lb-empty">
          <Icon name="search" />
          <b>{t.lobbies.emptyFilteredTitle}</b>
          <p>{t.browse.filteredBody}</p>
          <div>
            {suggestions.map((s) => (
              <button key={s.label} type="button" className="btn btn-s" onClick={() => update(s.patch)}>
                {s.label}
              </button>
            ))}
            <button type="button" className="btn btn-s" onClick={clearAll}>
              {t.lobbies.clear}
            </button>
            <button type="button" className="btn btn-p" onClick={create}>
              <Icon name="plus" />
              {t.lobbies.create}
            </button>
          </div>
        </div>
      );
    }
  }

  const activeTab = TABS.findIndex((x) => x.id === tab);

  return (
    <section className="sec" id="lobbies" aria-labelledby="lobbies-title">
      <SectionTitle
        id="lobbies-title"
        words={t.home.lobbiesTitle}
        meta={narrowed ? t.home.lobbiesFiltered(results.length, stats.lobbies, modeName) : t.home.lobbiesMeta(stats.lobbies, stats.withRoom)}
      >
        <button type="button" className="btn btn-s" onClick={create} aria-label={t.lobbies.create}>
          <Icon name="plus" />
          <span className="t">{t.lobbies.create}</span>
        </button>
      </SectionTitle>

      <div className="ctl">
        <div className="lb-tabs" role="tablist" aria-label={t.browse.tabs}>
          {TABS.map((x, i) => (
            <button
              key={x.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`lb-tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls="lobby-grid"
              tabIndex={tab === x.id ? 0 : -1}
              onClick={() => setTab(x.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {x.label}
              {counts[x.id] != null && <span className="c num">{counts[x.id]}</span>}
            </button>
          ))}
        </div>
        <div className="fchips" role="group" aria-label={t.browse.chips}>
          {REGIONS.map((r) => (
            <Chip key={r} pressed={f.regions.includes(r)} onClick={() => toggleRegion(r)} count={pingRange(pool, r)}>
              {t.regions[r]}
            </Chip>
          ))}
          <Chip pressed={f.slotsOnly} onClick={() => update({ slotsOnly: !f.slotsOnly })}>
            {t.browse.slots}
          </Chip>
          <Chip pressed={f.beginners} onClick={() => update({ beginners: !f.beginners })}>
            {t.browse.beginners}
          </Chip>
          <Chip pressed={f.playing} onClick={() => update({ playing: !f.playing })}>
            {t.browse.playing}
          </Chip>
          <Chip pressed={f.lowPing} onClick={() => update({ lowPing: !f.lowPing })}>
            {t.browse.lowPing(LOW_PING_MS)}
          </Chip>
          {modeName && (
            <Chip pressed onClick={() => update({ mode: '' })} label={t.browse.removeMode(modeName)}>
              {modeName}
              <Icon name="x" />
            </Chip>
          )}
        </div>
        <div className="end">
          <div className="vt" role="group" aria-label={t.browse.view}>
            <button type="button" aria-pressed={view === 'grid'} aria-label={t.browse.grid} title={t.browse.grid} onClick={() => setView('grid')}>
              <Icon name="grid" />
            </button>
            <button type="button" aria-pressed={view === 'list'} aria-label={t.browse.list} title={t.browse.list} onClick={() => setView('list')}>
              <Icon name="rows" />
            </button>
          </div>
        </div>
      </div>

      <div id="lobby-grid" className={view === 'list' ? 'lgrid list' : 'lgrid'} role="tabpanel" aria-labelledby={`lb-tab-${TABS[activeTab]!.id}`}>
        {empty ?? visible.map((l) => <LobbyCard key={l.id} lobby={l} env={env} featured={l.id === featured?.id} fav={favs.has(l.id)} onFav={toggle} />)}
        {!empty && rest <= 0 && <CreateCard onCreate={create} />}
      </div>
      {rest > 0 && (
        <div className="more-row">
          <button type="button" className="btn btn-s" onClick={() => setShown(ordered.length)}>
            {t.browse.more(rest)}
            <Icon name="chev" />
          </button>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite" aria-label={t.lobbies.activityRegion}>
        {announcement}
      </p>
    </section>
  );
}
