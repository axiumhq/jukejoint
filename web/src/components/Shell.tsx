import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { BRAND_NAME } from '../config/brand';
import { useFriends, useLiveStats, useMediaQuery } from '../hooks';
import { formatNumber, t } from '../i18n';
import { friendsIn } from '../lib/friends';
import { roster } from '../lib/room';
import { useSession } from '../state/session';
import { AvatarStack, Presence } from './Avatar';
import { LiveDot } from './Common';
import { SocialRail } from './Friends';
import { BrandMark, Icon } from './Icon';
import { LineArt } from './LineArt';
import { CoverDefs } from './ModeCover';
import { RailProvider, useRail, useSheetFocus } from './Rail';
import { Search } from './Search';
import { HostDialog, JoinDialog, Toasts } from './SessionDialogs';
import { ThemeMenu } from './ThemeMenu';

/*
 * Casca v8 (estrutura da pele B): barra superior, coluna principal e trilho social fixo.
 * Breakpoints em styles/shell.css: 1240 (trilho 288), 960 (trilho vira folha), 760 (celular).
 */

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: t.header.nav.play, end: true },
  { to: '/modos', label: t.header.nav.modes },
  { to: '/novidades', label: t.header.nav.today },
  { to: '/instalar', label: t.header.nav.install },
];

/** A marca provisória: anel aberto + o nome (BRAND_NAME, ainda não decidido). */
export function Wordmark() {
  return (
    <>
      <BrandMark />
      <b>{BRAND_NAME}</b>
    </>
  );
}

/**
 * A pílula "Na sala": substitui a contagem ao vivo quando você está numa sala.
 * Estados do antigo PlayDock: entrando (etapa i/n), na sala (vagas) e em partida. Leva para a sala.
 */
function RoomPill() {
  const { lobbies, hereId, joiningId, joiningStep, user } = useSession();
  const friends = useFriends();
  const id = joiningId ?? hereId;
  const lobby = id ? lobbies.find((l) => l.id === id) : undefined;
  const faces = useMemo(() => {
    if (!lobby) return [];
    const me = user?.name ?? t.lobbies.you;
    return roster(lobby, { you: me, youHere: hereId === lobby.id, youReady: false, signedIn: !!user, now: 0, friends: friendsIn(friends, lobby.id) })
      .filter((s) => s.name && !s.you)
      .slice(0, 3)
      .map((s) => s.name!);
  }, [lobby, hereId, user, friends]);
  if (!lobby) return null;

  const joining = joiningId === lobby.id;
  const steps = t.lobbies.joinSteps.length;
  const state = joining
    ? t.header.roomPill.joining(lobby.name)
    : lobby.status === 'em-partida'
      ? t.header.roomPill.playing(lobby.name)
      : t.header.roomPill.here(lobby.name);
  const meta = joining ? t.dock.step(joiningStep + 1, steps) : `${lobby.players}/${lobby.slots}`;

  return (
    <Link
      to={`/sala/${encodeURIComponent(lobby.id)}`}
      className={joining ? 'room-pill is-joining' : 'room-pill'}
      aria-label={joining ? `${state}, ${t.lobbies.joinSteps[joiningStep] ?? ''}` : t.header.roomPill.label(state, lobby.players, lobby.slots)}
    >
      <AvatarStack names={faces} size={22} max={3} />
      <span className="rp-name" aria-hidden="true">
        {state}
      </span>
      <span className="num" aria-hidden="true">
        {meta}
      </span>
    </Link>
  );
}

function LiveCount() {
  const { players } = useLiveStats();
  const n = formatNumber(players);
  return (
    <Link to="/#lobbies" className="live-count" aria-label={t.header.liveLabel(n)}>
      <LiveDot />
      <b className="num">{n}</b>
      <span className="w">{t.header.live}</span>
    </Link>
  );
}

function Account() {
  const { user, signIn, signOut } = useSession();
  const friends = useFriends();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button type="button" className="btn btn-p btn-steam" onClick={signIn} aria-label={t.account.signIn}>
        <Icon name="user" />
        <span className="t">{t.account.signIn}</span>
        <span className="t-short" aria-hidden="true">
          {t.friends.join}
        </span>
      </button>
    );
  }

  return (
    <div className="acct-wrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="acct"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t.account.menu(user.name)}
        onClick={() => setOpen((v) => !v)}
      >
        <Presence name={user.name} size={30} status="menu" />
        <span className="acct-name">{user.name}</span>
        <Icon name="chev" />
      </button>
      {open && (
        <div className="pop acct-menu">
          <div>
            <b>{user.name}</b>
            <p>{t.account.friendsOnline(friends.length)}</p>
          </div>
          <p>{t.account.mockNote}</p>
          <button
            type="button"
            className="btn btn-s btn-sm"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            <Icon name="exit" />
            {t.account.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

/** A barra superior: marca, navegação, busca (Ctrl K), ao vivo ou pílula da sala, tema e conta. */
export function TopBar({ inert }: { inert?: boolean }) {
  const { hereId, joiningId } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setSearchOpen(false), [pathname]);
  const inRoom = !!(joiningId ?? hereId);

  return (
    <header className="tb" inert={inert}>
      <Link to="/" className="brand" aria-label={t.a11y.home}>
        <Wordmark />
      </Link>
      <nav className="nav" aria-label={t.a11y.mainNav}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <span className="tb-sp" />
      <Search open={searchOpen} onOpenChange={setSearchOpen} />
      {inRoom ? <RoomPill /> : <LiveCount />}
      <button
        type="button"
        className="icon-btn only-phone"
        data-search-toggle
        aria-label={t.search.open}
        aria-expanded={searchOpen}
        onClick={() => setSearchOpen((v) => !v)}
      >
        <Icon name="search" />
      </button>
      <ThemeMenu />
      <Account />
    </header>
  );
}

/** O trilho fixo: conteúdo da tela (via `<Rail>`) ou o social padrão. Folha de baixo abaixo de 960 px. */
function RailAside({ sheet }: { sheet: boolean }) {
  const { setTarget, slots, title, sheetOpen, closeSheet } = useRail();
  const closeBtn = useRef<HTMLButtonElement>(null);
  useSheetFocus(closeBtn);
  const open = sheet && sheetOpen;
  const titleId = 'rail-sheet-title';
  const ref = useCallback((el: HTMLDivElement | null) => setTarget(el), [setTarget]);

  return (
    <>
      <aside
        className={open ? 'rail is-open' : 'rail'}
        aria-label={sheet ? undefined : t.social.label}
        aria-labelledby={sheet ? titleId : undefined}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        inert={sheet && !open}
      >
        <div className="sheet-h">
          <b id={titleId}>{title ?? t.social.sheet}</b>
          <button ref={closeBtn} type="button" className="icon-btn" aria-label={t.social.close} onClick={closeSheet}>
            <Icon name="x" />
          </button>
        </div>
        <div ref={ref} className="rail-in" />
        {slots === 0 && <SocialRail />}
      </aside>
      <div className={open ? 'scrim is-on' : 'scrim'} onClick={closeSheet} aria-hidden="true" />
    </>
  );
}

function Frame() {
  const { pathname, hash } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const sheet = useMediaQuery('(max-width: 960px)');
  const { sheetOpen, closeSheet } = useRail();
  const modal = sheet && sheetOpen;

  useEffect(() => closeSheet(), [pathname, closeSheet]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (hash) return;
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname, hash]);

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start' });
  }, [pathname, hash]);

  return (
    <>
      <a href="#main" className="skip-link">
        {t.a11y.skip}
      </a>
      <CoverDefs />
      <TopBar inert={modal} />
      <div className="app">
        <main id="main" className="main" ref={main} tabIndex={-1} inert={modal}>
          <LineArt />
          <LineArt className="b" />
          <Outlet />
          <p className="fineprint">
            {t.footer.about} {t.footer.prototype}
          </p>
        </main>
        <RailAside sheet={sheet} />
      </div>
      <JoinDialog />
      <HostDialog />
      <Toasts />
    </>
  );
}

export function Layout() {
  return (
    <RailProvider>
      <Frame />
    </RailProvider>
  );
}
