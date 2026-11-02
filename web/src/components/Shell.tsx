import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { BRAND_NAME } from '../config/brand';
import { t } from '../i18n';
import { useSession } from '../state/session';
import { Icon } from './Icon';
import { HostDialog, JoinDialog, Toasts } from './SessionDialogs';

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: t.nav.home, end: true },
  { to: '/lobbies', label: t.nav.lobbies },
  { to: '/modos', label: t.nav.modes },
  { to: '/novidades', label: t.nav.news },
  { to: '/instalar', label: t.nav.install },
];

/** A marca provisória: uma janela acesa e o nome (BRAND_NAME, ainda não decidido). */
export function Wordmark() {
  return (
    <span className="mark">
      <i aria-hidden="true" />
      {BRAND_NAME}
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
      <button type="button" className="steam" onClick={signIn}>
        {t.account.signIn}
      </button>
    );
  }

  return (
    <div className="account" ref={wrap}>
      <button ref={btn} type="button" className="steam" aria-expanded={open} aria-label={t.account.menu(user.name)} onClick={() => setOpen((v) => !v)}>
        {user.name}
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="account-menu">
          <p className="account-name">{user.name}</p>
          <p className="account-meta">{t.account.friendsOnline(user.friendsOnline)}</p>
          <p className="fine">{t.account.mockNote}</p>
          <button
            type="button"
            className="btn btn-line btn-sm"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            {t.account.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * O único cabeçalho do site. Na home ele mora dentro da faixa de cinema de cima
 * (variante `overlay`, transparente); nas outras páginas é a mesma barra com fundo e um fio embaixo.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`site-header${overlay ? ' is-overlay' : ''}${open ? ' is-open' : ''}`}>
      <div className="wrap site-header-in">
        <Link to="/" className="mark-link" aria-label={t.a11y.home}>
          <Wordmark />
        </Link>
        <nav id="site-nav" className="site-nav" aria-label={t.a11y.mainNav}>
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="nav-link">
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="site-nav-account">
            <AccountArea />
          </div>
        </nav>
        <div className="site-account">
          <AccountArea />
        </div>
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((v) => !v)}>
          {t.a11y.menu}
          <i aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

/** O único rodapé do site. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer-in">
        <div className="site-footer-brand">
          <Wordmark />
          <p>{t.footer.about}</p>
        </div>
        <nav aria-label={t.a11y.footerNav}>
          <ul>
            {NAV.slice(1).map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/instalar#hash">{t.footer.hash}</Link>
            </li>
          </ul>
        </nav>
        <p className="fine">{t.footer.prototype}</p>
      </div>
    </footer>
  );
}

export function Layout() {
  const { pathname, hash } = useLocation();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  const isHome = pathname === '/';

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
      <SiteHeader overlay={isHome} />
      <main id="main" ref={main} tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
      <JoinDialog />
      <HostDialog />
      <Toasts />
    </>
  );
}
