import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Lobby } from '../data/lobbies';
import { getMode, type Region } from '../data/modes';
import { useFavorites, useFriends, usePref } from '../hooks';
import { useLobbyFilters, type BrowseTab } from '../hooks/useFilters';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { filterLobbies, hasFriends, LOW_PING_MS, nearestAlternatives, REGIONS } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Chip, EmptyState, Skeleton } from './Common';
import { Icon } from './Icon';
import { CreateCard, LobbyCard, orderLobbies } from './LobbyCard';

/**
 * A lista da home ("Jogar agora", ou o nome do modo filtrado): abas Todos / Sua lista / Favoritos
 * com a região ao lado, chips de filtro na URL, cartões ↔ compacto, o cartão "Criar lobby",
 * "Mostrar os outros N lobbies", o esqueleto, os estados vazios e o anúncio resumido para leitor de tela.
 * No celular as abas e a região viram chips na mesma fileira dos filtros.
 */

/** Oito cartões e o "Criar lobby": três fileiras cheias na grade de três. */
const PAGE = 8;
const SKELETONS = 6;

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

/** Faixa de ping por região, para a região ("BR/SA 12–58 ms"). */
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
  const announcement = useActivityAnnouncer(pool);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filtro novo, página nova.
  const key = params.toString();
  useEffect(() => setShown(PAGE), [key]);

  const filtered = useMemo(() => filterLobbies(pool, f, signedIn, lobbyCtx, now), [pool, f, signedIn, lobbyCtx, now]);
  // Sua lista sem login: não há lista para filtrar, então a aba mostra o convite para o login.
  const results = tab === 'fav' ? filtered.filter((l) => favs.has(l.id)) : tab === 'friends' && !signedIn ? [] : filtered;
  const anyChip = !!f.mode || f.regions.length > 0 || f.slotsOnly || f.beginners || f.playing || f.lowPing || f.q !== '';
  const narrowed = anyChip || tab !== 'all';
  // O recomendado já está no topo da home: sem filtro, a lista não o repete como primeiro cartão.
  // Com filtro ou aba, ele volta para o lugar dele (sem destaque: o acento é do "Jogar agora" lá em cima).
  const ordered = narrowed ? orderLobbies(results, lobbyCtx) : orderLobbies(results, lobbyCtx).filter((l) => l.id !== featured?.id);
  const visible = ordered.slice(0, shown);
  const rest = ordered.length - visible.length;
  const modeName = getMode(f.mode)?.name;
  const counts = {
    all: pool.length,
    friends: signedIn ? pool.filter((l) => hasFriends(l) && !l.locked).length : null,
    fav: pool.filter((l) => favs.has(l.id)).length,
  };
  const env = { ctx: lobbyCtx, signedIn, me: user?.name ?? t.lobbies.you, friends, now };
  const create = () => openHost(f.mode || undefined);
  const toggleRegion = (r: Region) => update({ regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] });
  // A faixa de ping aparece na região marcada; sem marca, na mais perto (menor ping).
  const nearest = pool.length ? pool.reduce((a, b) => (b.ping < a.ping ? b : a)).region : null;
  const toggleTab = (id: BrowseTab) => setTab(tab === id ? 'all' : id);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = (n + TABS.length) % TABS.length;
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  };

  const loading = results.length === 0 && !synced;
  let empty: ReactNode = null;
  if (results.length === 0 && synced) {
    if (pool.length === 0) {
      empty = (
        <EmptyState
          className="lb-empty"
          title={t.lobbies.emptyNoneTitle}
          action={
            <div>
              <button type="button" className="btn btn-p" onClick={() => openHost()}>
                {t.lobbies.create}
              </button>
              <button type="button" className="btn btn-g" onClick={() => requestJoin({ kind: 'bots' })}>
                {t.lobbies.emptyBots}
              </button>
            </div>
          }
        >
          {t.lobbies.emptyNoneBody}
        </EmptyState>
      );
    } else if (tab === 'friends' && !signedIn) {
      empty = (
        <EmptyState
          className="lb-empty"
          title={t.browse.friendsOutTitle}
          action={
            <button type="button" className="btn btn-p" onClick={signIn}>
              {t.account.signIn}
            </button>
          }
        >
          {t.browse.friendsOutBody}
        </EmptyState>
      );
    } else if (tab === 'fav' && counts.fav === 0) {
      empty = (
        <EmptyState
          className="lb-empty"
          title={t.browse.favEmptyTitle}
          action={
            <button type="button" className="btn btn-p" onClick={() => setTab('all')}>
              {t.browse.all}
            </button>
          }
        >
          {t.browse.favEmptyBody}
        </EmptyState>
      );
    } else if (tab === 'friends' && !anyChip) {
      empty = (
        <EmptyState
          className="lb-empty"
          title={t.browse.friendsEmptyTitle}
          action={
            <button type="button" className="btn btn-p" onClick={create}>
              {t.lobbies.create}
            </button>
          }
        >
          {t.browse.friendsEmptyBody}
        </EmptyState>
      );
    } else {
      // Uma ação (Limpar filtros); o vizinho mais próximo vira o atalho da linha de texto.
      const suggestions = nearestAlternatives(pool, f, signedIn);
      empty = (
        <EmptyState
          className="lb-empty"
          title={t.lobbies.emptyFilteredTitle}
          action={
            <div>
              <button type="button" className="btn btn-p" onClick={clearAll}>
                {t.lobbies.clear}
              </button>
              <button type="button" className="btn btn-g" onClick={create}>
                {t.lobbies.create}
              </button>
            </div>
          }
        >
          {suggestions.length > 0 ? (
            <span className="lb-sug">
              {suggestions.map((s) => (
                <button key={s.label} type="button" className="link" onClick={() => update(s.patch)}>
                  {s.label}.
                </button>
              ))}
            </span>
          ) : (
            t.browse.filteredBody
          )}
        </EmptyState>
      );
    }
  }

  const activeTab = TABS.findIndex((x) => x.id === tab);

  return (
    <section className="sec lb" id="lobbies" aria-labelledby="lobbies-title">
      <div className="sec-h lb-h">
        <h2 className="display" id="lobbies-title">
          {modeName ?? t.home.play}
        </h2>
        <span className="sp" />
        <button type="button" className="btn btn-s" onClick={create}>
          <Icon name="plus" />
          {t.lobbies.create}
        </button>
      </div>

      <div className="lb-bar">
        <div className="utabs lb-tabs" role="tablist" aria-label={t.browse.tabs}>
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
              {counts[x.id] != null && <span className="c">{counts[x.id]}</span>}
            </button>
          ))}
        </div>
        <div className="seg lb-reg" role="group" aria-label={t.lobbies.region}>
          {REGIONS.map((r) => {
            const range = pingRange(pool, r);
            return (
              <button key={r} type="button" aria-pressed={f.regions.includes(r)} onClick={() => toggleRegion(r)}>
                {t.regions[r]}
                {range && (f.regions.length ? f.regions.includes(r) : r === nearest) && <span className="c">{range}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lb-row">
        <div className="fchips" role="group" aria-label={t.browse.chips}>
          {/* celular: a região e as abas entram na fileira de chips */}
          {REGIONS.map((r) => (
            <Chip key={r} className="only-m" pressed={f.regions.includes(r)} onClick={() => toggleRegion(r)}>
              {t.regions[r]}
            </Chip>
          ))}
          <Chip className="only-m" pressed={tab === 'friends'} onClick={() => toggleTab('friends')} count={counts.friends}>
            {t.browse.friends}
          </Chip>
          {(counts.fav > 0 || tab === 'fav') && (
            <Chip className="only-m" pressed={tab === 'fav'} onClick={() => toggleTab('fav')} count={counts.fav}>
              {t.browse.favorites}
            </Chip>
          )}
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
        <div className="seg lb-view" role="group" aria-label={t.browse.view}>
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
            {t.browse.grid}
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            {t.browse.list}
          </button>
        </div>
      </div>

      <div
        id="lobby-grid"
        className={view === 'list' ? 'lgrid list' : 'lgrid'}
        role="tabpanel"
        aria-labelledby={`lb-tab-${TABS[activeTab]!.id}`}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <>
            {Array.from({ length: SKELETONS }, (_, i) => (
              <Skeleton key={i} className="lc-sk" />
            ))}
            <p className="sr-only" role="status">
              {L.loadingLobbies}
            </p>
          </>
        ) : (
          (empty ?? (
            <>
              {visible.map((l) => (
                <LobbyCard key={l.id} lobby={l} env={env} fav={favs.has(l.id)} onFav={toggle} />
              ))}
              <CreateCard onCreate={create} />
            </>
          ))
        )}
      </div>
      {rest > 0 && !empty && (
        <div className="more-row">
          <button type="button" className="btn btn-g" onClick={() => setShown(ordered.length)}>
            {t.browse.more(rest)}
          </button>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite" aria-label={t.lobbies.activityRegion}>
        {announcement}
      </p>
    </section>
  );
}
