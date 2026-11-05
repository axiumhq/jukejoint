import { useMemo } from 'react';
import { Link } from 'react-router';
import { Arrivals } from '../components/Arrivals';
import { Icon } from '../components/Icon';
import { LobbyBrowser } from '../components/LobbyBrowser';
import { ModeMedallion } from '../components/ModeCover';
import { MobilePlayBar, RecommendedCard } from '../components/Recommended';
import { modes } from '../data/modes';
import { useDocumentTitle, usePref } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useLobbyFilters } from '../hooks/useFilters';
import { useNow } from '../hooks/useNow';
import { formatNumber, t } from '../i18n';
import { useSession } from '../state/session';

/**
 * Home do redesign (Main, Home-1366 e Celular-390 do Claude Design): aviso dispensável, o destaque
 * com o recomendado, a lista de lobbies ("Jogar agora"), modos ao vivo e chegando agora.
 * Em 1366×768 os lobbies aparecem na primeira tela. No celular o slogan abre a página, os modos
 * viram uma fileira acima dos filtros e o recomendado mora na barra fixa de baixo.
 * A sua lista (o social) mora na barra lateral da casca; abaixo de 960 px, na aba "Sua lista".
 */

function Notice() {
  const [dismissed, setDismissed] = usePref('noticeX', false);
  if (dismissed) return null;
  return (
    <div className="notice" role="note">
      <span>
        {t.notice.title} {t.notice.body}
      </span>
      <Link to="/novidades" className="link">
        {t.notice.link}
      </Link>
      <span className="sp" />
      <button type="button" className="icon-btn" aria-label={t.notice.dismiss} onClick={() => setDismissed(true)}>
        <Icon name="x" />
      </button>
    </div>
  );
}

/** Comprimento do anel de 36 de raio (2πr). */
const RING = 226.2;

/**
 * Modos ao vivo: um cartão por modo com o anel de ocupação (vagas livres no meio) e
 * "N de M jogando". Clicar filtra a lista de lobbies pelo modo (e clicar de novo tira).
 * No celular o mesmo botão vira a fileira de medalhões acima dos filtros.
 */
function ModesLive() {
  const { lobbies } = useSession();
  const { f, update } = useLobbyFilters();
  const byMode = useMemo(() => {
    const m: Record<string, { players: number; cap: number }> = {};
    for (const l of lobbies) {
      const c = (m[l.modeSlug] ??= { players: 0, cap: 0 });
      c.players += l.players;
      c.cap += l.slots;
    }
    return m;
  }, [lobbies]);
  const pick = (slug: string) => {
    const next = f.mode === slug ? '' : slug;
    update({ mode: next });
    if (next)
      document
        .getElementById('lobbies')
        ?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <section className="sec home-modes" aria-labelledby="modes-title">
      <div className="sec-h">
        <h2 className="display" id="modes-title">
          {t.home.modesTitle.join(' ')}
        </h2>
      </div>
      <div className="mv-list">
        {modes.map((m) => {
          const c = byMode[m.slug] ?? { players: 0, cap: 0 };
          const free = Math.max(0, c.cap - c.players);
          const dash = c.cap > 0 ? ((c.players / c.cap) * RING).toFixed(1) : '0';
          return (
            <button
              key={m.slug}
              type="button"
              className="mv"
              aria-pressed={f.mode === m.slug}
              aria-label={`${t.home.modeFilter(m.name)}. ${t.home.modePlaying(c.players, c.cap)}`}
              onClick={() => pick(m.slug)}
            >
              <span className="mv-ring" aria-hidden="true">
                <svg viewBox="0 0 80 80">
                  <circle className="bg" cx="40" cy="40" r="36" />
                  <circle className="fg" cx="40" cy="40" r="36" strokeDasharray={`${dash} ${RING}`} transform="rotate(-90 40 40)" />
                </svg>
                <span className="mv-free">
                  <span className="display">{formatNumber(free)}</span>
                  <span className="lbl">{t.home.modeFree}</span>
                </span>
              </span>
              <span className="mv-tile" aria-hidden="true">
                <ModeMedallion slug={m.slug} />
              </span>
              <span className="mv-t" aria-hidden="true">
                <b>{m.name}</b>
                <span className="mv-d">{t.home.modePlaying(c.players, c.cap)}</span>
                <span className="mv-m">{t.home.modePlayers(c.players)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Home() {
  useDocumentTitle(t.meta.home);
  const { lobbies, openHost } = useSession();
  const now = useNow(5000);
  const featured = useFeaturedLobby(lobbies, undefined, now);

  return (
    <div className="home">
      <Notice />
      <RecommendedCard lobby={featured} now={now} onCreate={() => openHost()} />
      <LobbyBrowser featured={featured} now={now} />
      <ModesLive />
      <Arrivals now={now} />
      <MobilePlayBar lobby={featured} />
    </div>
  );
}
