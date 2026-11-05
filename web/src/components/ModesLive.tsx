import { useMemo } from 'react';
import { getModes } from '../data/modes';
import { useLobbyFilters } from '../hooks/useFilters';
import { formatNumber, t } from '../i18n';
import { useSession } from '../state/session';
import { ModeMedallion } from './ModeCover';

/** Comprimento do anel de 36 de raio (2πr). */
const RING = 226.2;

/**
 * Modos ao vivo: um cartão por modo com o anel de ocupação (vagas livres no meio) e
 * "N de M jogando". Clicar filtra a lista de lobbies pelo modo (e clicar de novo tira).
 * No celular o mesmo botão vira a fileira de medalhões acima dos filtros.
 */
export function ModesLive() {
  const modes = getModes();
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

