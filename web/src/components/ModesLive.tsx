import { useMemo } from 'react';
import { getModes } from '../data/modes';
import { useLobbyFilters } from '../hooks/useFilters';
import { useServerStatus } from '../hooks/useServerStatus';
import { modosHome as M } from '../i18n/modos-home';
import { pintura } from '../lib/pintura';
import { useSession } from '../state/session';
import { ModeCover, ModeIcon } from './ModeCover';
import '../styles/modes-live.css';

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/**
 * Modos da home. Com lobbies: os "Arcanos", uma carta de tarô art déco por modo (numeral romano, o
 * sigilo do modo no centro, nome, formato e quantos lobbies e quanta gente); clicar filtra a lista
 * de lobbies pelo modo (e clicar de novo tira). Cidade vazia (conexão ok e nenhum lobby): cartões
 * com a cena do modo; clicar abre o "Criar lobby" já com o modo escolhido.
 */
export function ModesLive() {
  const modes = getModes();
  const { lobbies, openHost } = useSession();
  const { status } = useServerStatus();
  const { f, update } = useLobbyFilters();
  const byMode = useMemo(() => {
    const m: Record<string, { lobbies: number; players: number }> = {};
    for (const l of lobbies) {
      const c = (m[l.modeSlug] ??= { lobbies: 0, players: 0 });
      c.lobbies += 1;
      c.players += l.players;
    }
    return m;
  }, [lobbies]);
  const empty = lobbies.length === 0 && status === 'ok';
  const pick = (slug: string) => {
    const next = f.mode === slug ? '' : slug;
    update({ mode: next });
    if (next)
      document
        .getElementById('lobbies')
        ?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <section className="home-modes ml" aria-labelledby="modes-title">
      <h2 className="ml-h" id="modes-title">
        {M.title}
        {!empty && <small>{M.rituals}</small>}
      </h2>
      {empty && <p className="ml-sub">{M.sub}</p>}
      <ul className={empty ? 'ml-list is-cards' : 'ml-list is-arcanos'}>
        {modes.map((m, i) => {
          if (empty) {
            return (
              <li key={m.slug}>
                <button type="button" className="ml-card has-cover" aria-label={M.openLabel(m.name)} onClick={() => openHost(m.slug)}>
                  <span className="ml-art">
                    <ModeCover slug={m.slug} />
                    <b>{m.name}</b>
                  </span>
                  <span className="ml-ln">{m.line}</span>
                  <span className="ml-nums">{M.meta(m.format, m.minPlayers, m.maxPlayers)}</span>
                </button>
              </li>
            );
          }
          const c = byMode[m.slug];
          const art = pintura(`arcano-${m.slug}`);
          const art45 = pintura(`arcano-${m.slug}-45`);
          return (
            <li key={m.slug}>
              <button
                type="button"
                className={['arcano', art && 'has-art', !c && 'is-quiet'].filter(Boolean).join(' ')}
                aria-pressed={f.mode === m.slug}
                onClick={() => pick(m.slug)}
              >
                {art && (
                  <picture className="arc-art" aria-hidden="true">
                    {art45 && <source media="(min-width: 721px) and (max-width: 1240px)" srcSet={art45} />}
                    <img src={art} alt="" loading="lazy" decoding="async" />
                  </picture>
                )}
                <i aria-hidden="true" />
                <i aria-hidden="true" />
                <i aria-hidden="true" />
                <i aria-hidden="true" />
                <span className="arc-num" aria-hidden="true">
                  {ROMANOS[i] ?? i + 1}
                </span>
                <span className="arc-sig" aria-hidden="true">
                  <ModeIcon slug={m.slug} />
                </span>
                <span className="arc-t">
                  <b>{m.name}</b>
                  <span className="arc-fmt">{m.format}</span>
                </span>
                <span className="arc-vivo">
                  {c ? (
                    <>
                      <em>{M.lobbies(c.lobbies)}</em>
                      <span className="arc-play"> · {M.playing(c.players)}</span>
                    </>
                  ) : (
                    M.none
                  )}
                </span>
                <span className="sr-only">
                  {m.line} {M.filterHint}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
