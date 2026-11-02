import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { BRAND_NAME } from '../config/brand';
import { useTheme } from '../hooks';
import { t } from '../i18n';
import { useSession } from '../state/session';
import { Icon, type IconName } from './Icon';
import { HostDialog, JoinDialog, Toasts } from './SessionDialogs';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: t.nav.home, icon: 'home', end: true },
  { to: '/lobbies', label: t.nav.lobbies, icon: 'door' },
  { to: '/modos', label: t.nav.modes, icon: 'sigil' },
  { to: '/novidades', label: t.nav.news, icon: 'scroll' },
  { to: '/instalar', label: t.nav.install, icon: 'download' },
];

export function Wordmark() {
  return (
    <span className="wordmark">
      <svg className="wordmark-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M16 3 L22 9 L22 13 L26 17 L26 29 L6 29 L6 17 L10 13 L10 9 Z" />
        <rect x="14" y="17" width="4" height="8" rx="1" className="wordmark-door" />
      </svg>
      <span className="wordmark-text">{BRAND_NAME}</span>
    </span>
  );
}

function AccountArea() {
  const { user, signIn, signOut } = useSession();
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
      <button type="button" className="btn btn-steam" onClick={signIn}>
        <Icon name="user" size={18} />
        <span className="hide-sm">{t.account.signIn}</span>
        <span className="show-sm">{t.account.signInShort}</span>
      </button>
    );
  }

  return (
    <div className="account" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="account-btn"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t.account.menu(user.name)}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar avatar-lg" aria-hidden="true">
          {user.name.slice(0, 1)}
        </span>
        <span className="account-name hide-sm">{user.name}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      <div id="account-menu" className="account-menu" hidden={!open}>
        <p className="account-menu-name">{user.name}</p>
        <p className="account-menu-meta">
          <span className="live-dot" aria-hidden="true" />
          {t.account.friendsOnline(user.friendsOnline)}
        </p>
        <p className="fine">{t.account.mockNote}</p>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            setOpen(false);
            signOut();
          }}
        >
          {t.account.signOut}
        </button>
      </div>
    </div>
  );
}

function Header() {
  const { appConnected } = useSession();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand-link" aria-label={t.a11y.home}>
          <Wordmark />
        </Link>
        <nav className="main-nav" aria-label={t.a11y.mainNav}>
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="nav-link">
                  {item.label}
                  {item.to === '/instalar' && appConnected && <span className="nav-dot" aria-hidden="true" />}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <AccountArea />
      </div>
    </header>
  );
}

function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label={t.a11y.mobileNav}>
      <ul>
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className="mobile-link">
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer() {
  const [theme, setTheme] = useTheme();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Wordmark />
          <p>{t.footer.about}</p>
          <p className="footer-disclaimer">{t.footer.disclaimer}</p>
        </div>
        <nav className="footer-col" aria-label={t.footer.product}>
          <h2>{t.footer.product}</h2>
          <ul>
            {NAV.slice(1).map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="footer-col" aria-label={t.footer.trust}>
          <h2>{t.footer.trust}</h2>
          <ul>
            <li>
              <Link to="/instalar#hash">{t.footer.hash}</Link>
            </li>
            <li>
              <Link to="/instalar#antivirus">{t.footer.antivirus}</Link>
            </li>
            <li>
              <a href="#codigo-aberto" aria-disabled="true" onClick={(e) => e.preventDefault()}>
                {t.footer.source} <span className="fine">({t.install.sourceNote})</span>
              </a>
            </li>
          </ul>
        </nav>
        <div className="footer-col">
          <h2 id="footer-lang">{t.footer.language}</h2>
          <ul aria-labelledby="footer-lang">
            <li aria-current="true">{t.footer.languageCurrent}</li>
            <li className="muted">{t.footer.languageSoon}</li>
          </ul>
          <h2 id="footer-theme">{t.footer.theme}</h2>
          <div className="segmented segmented-sm" role="group" aria-labelledby="footer-theme">
            <button type="button" className="seg-btn" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              <Icon name="moon" size={16} />
              {t.footer.themeDark}
            </button>
            <button type="button" className="seg-btn" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              <Icon name="sun" size={16} />
              {t.footer.themeLight}
            </button>
          </div>
        </div>
      </div>
      <div className="container footer-base">
        <p>{t.footer.prototype}</p>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname, hash } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

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
      <Header />
      <main id="main" ref={main} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <JoinDialog />
      <HostDialog />
      <Toasts />
    </>
  );
}
