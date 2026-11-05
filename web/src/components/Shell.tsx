import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useFriends, useLiveStats, useMediaQuery } from '../hooks';
import { formatNumber, t } from '../i18n';
import { live as L } from '../i18n/live';
import { IN_DESKTOP } from '../lib/desktop';
import { friendsIn } from '../lib/friends';
import { handoffState, roster } from '../lib/room';
import { useSession } from '../state/session';
import { Avatar, AvatarStack, Presence } from './Avatar';
import { DevSignIn, SignInPending } from './AppLogin';
import { BrandSymbol, Wordmark } from './Brand';
import { LiveDot } from './Common';
import { SocialRail } from './Friends';
import { Icon, type IconName } from './Icon';
import { CoverDefs } from './ModeCover';
import { RailProvider, useRail, useSheetFocus } from './Rail';
import { Search } from './Search';
import { HostDialog, JoinDialog, Toasts } from './SessionDialogs';
import { ThemeMenu, ThemeSwatches } from './ThemeMenu';
import { TitleBar } from './TitleBar';
import '../styles/live.css';

/*
 * Casca do redesign ("Fiel ao kit"): barra lateral à esquerda (JJ, navegação com ícones, a sua
 * lista e o tema), coluna principal com a barra de topo (wordmark, busca, ao vivo ou pílula da
 * sala, conta) e, quando a tela traz `<Rail>`, o painel dela à direita.
 * A barra lateral é a mesma em toda tela (navegação com rótulo, a sua lista e o tema): a sala não
 * muda a moldura. Entre 961 e 1240 px quem cede espaço é o painel da direita (mais estreito).
 * Abaixo de 960 px: sem barra lateral, barra de abas embaixo e o painel (ou a sua lista) como folha.
 * Pontos de quebra em styles/shell.css e tokens.css.
 */

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Só no site: dentro do app desktop o item some (o app já está instalado). */
  webOnly?: boolean;
}

const navItems = (): NavItem[] => [
  { to: '/', label: t.header.nav.play, icon: 'navPlay' },
  { to: '/modos', label: t.header.nav.modes, icon: 'navModes' },
  { to: '/novidades', label: t.header.nav.today, icon: 'navToday' },
  { to: '/instalar', label: t.header.nav.install, icon: 'navInstall', webOnly: true },
];

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
  // "N de M": o mesmo jeito de escrever vagas do resto do produto (nunca "N/M").
  const meta = t.lobbies.ofCount(lobby.players, lobby.slots);

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
    // A barra lateral já mostra o convite de login (desktop): a barra de topo não repete o botão.
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
        <Avatar name={user.name} size={30} src={user.avatar} />
        <span className="acct-name">{user.name}</span>
      </button>
      {open && (
        <div className="pop acct-menu">
          <div className="acct-who">
            <Presence name={user.name} size={36} status="menu" src={user.avatar} />
            <div>
              <b>{user.name}</b>
              <p>{t.account.friendsOnline(friends.length)}</p>
            </div>
          </div>
          <p>{live ? (user.dev ? L.devNote : L.steamNote) : t.account.mockNote}</p>
          <button
            type="button"
            className="btn btn-o btn-sm"
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

/** A barra de topo: wordmark, busca (Ctrl K), ao vivo ou pílula da sala, tema (quando a lateral não mostra) e conta. */
export function TopBar({ inert }: { inert?: boolean }) {
  const { hereId, joiningId } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setSearchOpen(false), [pathname]);
  const inRoom = !!(joiningId ?? hereId);

  return (
    <header className="tb" inert={inert}>
      <Link to="/" className="brand" aria-label={t.a11y.home}>
        <Wordmark alt="" height={24} />
      </Link>
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
        <Icon name="search" size={20} />
      </button>
      <span className="tb-theme">
        <ThemeMenu />
      </span>
      <Account />
    </header>
  );
}

/** "Jogar" cobre o caminho todo de jogar: a home, o /jogar e a sala. */
function usePlayActive() {
  const { pathname } = useLocation();
  return pathname === '/' || pathname.startsWith('/jogar') || pathname.startsWith('/sala/');
}

/** Os links de Jogar, Modos, Hoje e Instalar (só no site), sempre com ícone e rótulo. */
function NavItems({ items = IN_DESKTOP ? navItems().filter((n) => !n.webOnly) : navItems() }: { items?: NavItem[] }) {
  const play = usePlayActive();
  return (
    <>
      {items.map((n) => {
        const body = (
          <>
            <Icon name={n.icon} />
            <span className="nav-t">{n.label}</span>
          </>
        );
        return n.to === '/' ? (
          <Link key={n.to} to={n.to} aria-current={play ? 'page' : undefined}>
            {body}
          </Link>
        ) : (
          <NavLink key={n.to} to={n.to}>
            {body}
          </NavLink>
        );
      })}
    </>
  );
}

/** A barra lateral: o JJ, a navegação, a sua lista e o tema. Igual em toda tela, sala incluída. */
function Side({ inert }: { inert?: boolean }) {
  return (
    <aside className="side" aria-label={t.a11y.sidebar} inert={inert}>
      <Link to="/" className="side-brand" aria-label={t.a11y.home}>
        <BrandSymbol height={44} />
      </Link>
      <nav className="side-nav" aria-label={t.a11y.mainNav}>
        <NavItems />
      </nav>
      <div className="side-social">
        <SocialRail />
      </div>
      <ThemeSwatches />
    </aside>
  );
}

/** Abaixo de 960 px: Jogar, Modos, Hoje e a sua lista (abre a folha). O Instalar vai para o rodapé. */
function BottomNav({ inert }: { inert?: boolean }) {
  const { openSheet, sheetOpen, sheetKind } = useRail();
  return (
    <nav className="bn" aria-label={t.a11y.mainNav} inert={inert}>
      <NavItems items={navItems().filter((n) => !n.webOnly)} />
      <button
        type="button"
        className="bn-list"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen && sheetKind === 'social'}
        onClick={(e) => openSheet(e.currentTarget, 'social')}
      >
        <Icon name="navList" />
        <span className="nav-t">{t.header.nav.list}</span>
      </button>
    </nav>
  );
}

/** O painel da tela (via `<Rail>`), à direita. Folha de baixo abaixo de 960 px, com o painel ou a sua lista. */
function RailAside({ sheet }: { sheet: boolean }) {
  const { setTarget, slots, title, sheetOpen, sheetKind, closeSheet } = useRail();
  const closeBtn = useRef<HTMLButtonElement>(null);
  useSheetFocus(closeBtn);
  const open = sheet && sheetOpen;
  // Na folha, a sua lista aparece quando a tela não tem painel ou quando foi ela que se pediu.
  const social = sheet && (slots === 0 || (open && sheetKind === 'social'));
  const titleId = 'rail-sheet-title';
  const ref = useCallback((el: HTMLDivElement | null) => setTarget(el), [setTarget]);

  return (
    <>
      <aside
        className={open ? 'rail is-open' : 'rail'}
        aria-label={sheet ? undefined : (title ?? t.social.label)}
        aria-labelledby={sheet ? titleId : undefined}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        inert={sheet && !open}
      >
        <div className="sheet-h">
          <i className="sheet-grip" aria-hidden="true" />
          <b id={titleId} className="display">
            {social ? t.social.sheet : (title ?? t.social.sheet)}
          </b>
          <button ref={closeBtn} type="button" className="icon-btn" aria-label={t.social.close} onClick={closeSheet}>
            <Icon name="x" />
          </button>
        </div>
        <div ref={ref} className="rail-in" hidden={social && slots > 0} />
        {social && <SocialRail sheet />}
      </aside>
      <div className={open ? 'scrim is-on' : 'scrim'} onClick={closeSheet} aria-hidden="true" />
    </>
  );
}

/** Ao vivo: a faixa de conexão enquanto o WebSocket conecta ou reconecta. */
function LiveStatus() {
  const { live, connection } = useSession();
  if (!live || connection === 'online') return null;
  const offline = connection === 'offline';
  return (
    <p className={offline ? 'live-status is-offline' : 'live-status'} role={offline ? 'alert' : 'status'}>
      <i aria-hidden="true" />
      {offline ? L.offline : L.connecting}
    </p>
  );
}

function Frame() {
  const { pathname, hash } = useLocation();
  const main = useRef<HTMLElement>(null);
  // A rota anterior: o foco só vai para o <main> quando a rota MUDA (não na primeira carga, nem
  // na segunda execução do efeito que o StrictMode faz em dev, que antes pulava a lateral e o topo).
  const prevPath = useRef(pathname);
  const sheet = useMediaQuery('(max-width: 960px)');
  const { sheetOpen, closeSheet, slots } = useRail();
  const { live } = useSession();
  const modal = sheet && sheetOpen;
  const pageRail = slots > 0;

  useEffect(() => closeSheet(), [pathname, closeSheet]);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    if (hash) return;
    // No app a página rola dentro da moldura, abaixo da faixa de título (html.is-desktop).
    (IN_DESKTOP ? document.querySelector('.frame') : null)?.scrollTo(0, 0) ?? window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname, hash]);

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start' });
  }, [pathname, hash]);

  // /instalar tem o aviso de afiliação mais completo; o rodapé usa esse lá, para não repetir.
  const about = pathname.startsWith('/instalar') ? t.install.affiliation : t.footer.about;
  const cls = pageRail ? 'frame has-rail' : 'frame';

  return (
    <>
      <a href="#main" className="skip-link" inert={modal}>
        {t.a11y.skip}
      </a>
      <CoverDefs />
      {IN_DESKTOP && <TitleBar />}
      <div className={cls}>
        {!sheet && <Side inert={modal} />}
        {/* A barra do topo é uma linha da moldura: atravessa a coluna e o painel da direita, então a
            busca e a conta ficam no mesmo lugar em toda tela, com ou sem painel. */}
        <TopBar inert={modal} />
        <div className="col">
          <LiveStatus />
          <main id="main" className="main" ref={main} tabIndex={-1} inert={modal}>
            <Outlet />
          </main>
          <footer className="foot" inert={modal}>
            {sheet && !IN_DESKTOP && (
              <Link to="/instalar" className="link">
                <Icon name="navInstall" />
                {t.header.installLink}
              </Link>
            )}
            <p className="fineprint">
              {about} {live ? null : t.footer.prototype}
            </p>
          </footer>
        </div>
        <RailAside sheet={sheet} />
      </div>
      {sheet && <BottomNav inert={modal} />}
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
