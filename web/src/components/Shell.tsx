import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { BRAND_NAME } from '../config/brand';
import { useFriends, useLiveStats, useMediaQuery } from '../hooks';
import { formatNumber, t } from '../i18n';
import { live as L } from '../i18n/live';
import { friendsIn } from '../lib/friends';
import { handoffState, roster } from '../lib/room';
import { useSession } from '../state/session';
import { AvatarStack, Presence } from './Avatar';
import { DevSignIn, SignInPending } from './AppLogin';
import { LiveDot } from './Common';
import { SocialRail } from './Friends';
import { BrandMark, Icon } from './Icon';
import { LineArt } from './LineArt';
import { CoverDefs } from './ModeCover';
import { RailProvider, useRail, useSheetFocus } from './Rail';
import { Search } from './Search';
import { HostDialog, JoinDialog, Toasts } from './SessionDialogs';
import { DesktopUpdateNotice } from './DesktopUpdateNotice';
import { ThemeMenu } from './ThemeMenu';
import '../styles/live.css';

/*
 * Casca v8 (estrutura da pele B): barra superior, coluna principal e trilho social fixo.
 * Breakpoints em styles/shell.css: 1240 (trilho 288), 960 (trilho vira folha, navegação vira faixa), 760 (celular).
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
 * Estados: entrando, na sala, abrindo o jogo e em partida, sempre com as vagas. Leva para a sala.
 */
function RoomPill() {
  const { lobbies, hereId, joiningId, joiningStep, handoffStep, user } = useSession();
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
  // "Em partida" só depois que o app terminou de abrir o jogo (o mesmo corte da sala).
  const opening = !joining && hereId === lobby.id && handoffState(handoffStep, steps) === 'opening';
  const state = joining
    ? t.header.roomPill.joining(lobby.name)
    : opening
      ? t.header.roomPill.opening(lobby.name)
      : lobby.status === 'em-partida'
        ? t.header.roomPill.playing(lobby.name)
        : t.header.roomPill.here(lobby.name);
  // Sem contador de etapas aqui: a etapa do app vai no nome acessível; o progresso numerado é só o da sala.
  const meta = `${lobby.players}/${lobby.slots}`;

  return (
    <Link
      to={`/sala/${encodeURIComponent(lobby.id)}`}
      className={joining || opening ? 'room-pill is-joining' : 'room-pill'}
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
  const { user, signIn, signOut, live, authPending } = useSession();
  const friends = useFriends();
  const { signInShown } = useRail();
  const sheet = useMediaQuery('(max-width: 960px)');
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
    // O trilho já mostra o convite de login (desktop): a barra não repete o botão.
    if (signInShown && !sheet) return null;
    if (authPending) return <SignInPending />;
    return (
      <>
        <DevSignIn />
        {/* Secundário e "Login", nunca "Entrar": o acento e o verbo "Entrar" são do lobby. */}
        <button type="button" className="btn btn-s btn-steam" onClick={signIn} aria-label={t.account.signIn}>
          <Icon name="user" />
          <span className="t">{t.account.signIn}</span>
          <span className="t-short" aria-hidden="true">
            {t.account.signInShort}
          </span>
        </button>
      </>
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
          <p>{live ? (user.dev ? L.devNote : L.steamNote) : t.account.mockNote}</p>
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

/** A barra superior: marca, navegação, busca (Ctrl K), ao vivo ou pílula da sala, tema e conta. Mais a faixa de navegação (≤960 px). */
export function TopBar({ inert }: { inert?: boolean }) {
  const { hereId, joiningId } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setSearchOpen(false), [pathname]);
  const inRoom = !!(joiningId ?? hereId);

  return (
    <>
      <header className="tb" inert={inert}>
        <Link to="/" className="brand" aria-label={t.a11y.home}>
          <Wordmark />
        </Link>
        <NavLinks className="nav" />
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
      {/* Abaixo de 960 px a navegação desce para esta faixa fixa sob a barra; só uma das duas aparece. */}
      <NavLinks className="tabs" inert={inert} />
    </>
  );
}

/** Jogar, Modos, Hoje e Instalar: na barra (largo) ou na faixa sob ela (tablet e celular). */
function NavLinks({ className, inert }: { className: string; inert?: boolean }) {
  const { pathname } = useLocation();
  // "Jogar" cobre o caminho todo de jogar: a home, o /jogar e a sala.
  const play = pathname === '/' || pathname.startsWith('/jogar') || pathname.startsWith('/sala/');
  return (
    <nav className={className} aria-label={t.a11y.mainNav} inert={inert}>
      {NAV.map((n) =>
        n.to === '/' ? (
          <Link key={n.to} to={n.to} aria-current={play ? 'page' : undefined}>
            {n.label}
          </Link>
        ) : (
          <NavLink key={n.to} to={n.to} end={n.end}>
            {n.label}
          </NavLink>
        ),
      )}
    </nav>
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

/** Ao vivo: o aviso discreto enquanto o WebSocket conecta ou reconecta. */
function LiveStatus() {
  const { live, connection } = useSession();
  if (!live || connection === 'online') return null;
  const offline = connection === 'offline';
  return (
    <p className={offline ? 'live-status is-offline' : 'live-status'} role="status">
      <i aria-hidden="true" />
      {offline ? L.offline : L.connecting}
    </p>
  );
}

function Frame() {
  const { pathname, hash } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const sheet = useMediaQuery('(max-width: 960px)');
  const { sheetOpen, closeSheet } = useRail();
  const { live } = useSession();
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

  // /instalar tem o aviso de afiliação mais completo; o rodapé usa esse lá, para não repetir.
  const about = pathname.startsWith('/instalar') ? t.install.affiliation : t.footer.about;

  return (
    <>
      <a href="#main" className="skip-link" inert={modal}>
        {t.a11y.skip}
      </a>
      <CoverDefs />
      <TopBar inert={modal} />
      <DesktopUpdateNotice />
      <LiveStatus />
      <div className="app">
        <main id="main" className="main" ref={main} tabIndex={-1} inert={modal}>
          <LineArt />
          <LineArt className="b" />
          <Outlet />
        </main>
        <footer className="foot" inert={modal}>
          <p className="fineprint">
            {about} {live ? null : t.footer.prototype}
          </p>
        </footer>
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
