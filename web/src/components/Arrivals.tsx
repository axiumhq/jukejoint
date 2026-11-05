import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { FRESH_MS } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

/**
 * "Chegando agora": quem acabou de entrar em algum lobby, dos dados da sessão.
 * Atualiza a cada 8 s (não a cada tique do ao vivo) e tem Pausar (WCAG 2.2.2).
 * Lobby só com convite não expõe nomes. Sem aria-live: o anúncio para leitor de tela
 * é o da lista de lobbies, resumido e espaçado.
 */
const SHOW = 4;
const EVERY_MS = 8000;

interface Arrival {
  key: string;
  name: string;
  at: number;
  lobby: Lobby;
  friend: boolean;
}

function latest(lobbies: Lobby[]): Arrival[] {
  return lobbies
    .flatMap((l) =>
      l.locked ? [] : l.joins.filter((j) => !j.you).map((j) => ({ key: `${l.id}-${j.at}-${j.name}`, name: j.name, at: j.at, lobby: l, friend: !!j.friend })),
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, SHOW);
}

export function Arrivals({ now }: { now: number }) {
  const { lobbies, user } = useSession();
  const [paused, setPaused] = useState(false);
  const [items, setItems] = useState(() => latest(lobbies));
  const ref = useRef(lobbies);
  ref.current = lobbies;
  const seen = useRef(new Set(items.map((i) => i.key)));

  useEffect(() => {
    if (paused) return;
    setItems(latest(ref.current));
    const id = window.setInterval(() => {
      if (!document.hidden) setItems(latest(ref.current));
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  // Quem é novo nesta rodada ganha a entrada animada (uma vez só).
  const fresh = new Set(items.filter((i) => !seen.current.has(i.key) && now - i.at < FRESH_MS * 2).map((i) => i.key));
  useEffect(() => {
    for (const i of items) seen.current.add(i.key);
  }, [items]);

  return (
    <section className="sec home-arrivals" aria-labelledby="arrivals-title">
      <div className="sec-h">
        <h2 className="display" id="arrivals-title">
          {t.home.arrivalsTitle.join(' ')}
        </h2>
        <span className="sp" />
        <button type="button" className="btn btn-g" aria-describedby="arrivals-title" aria-pressed={paused} onClick={() => setPaused((v) => !v)}>
          {paused ? t.home.resume : t.home.pause}
        </button>
      </div>
      <ol className="feed">
        {items.length === 0 && <li className="feed-empty">{t.home.arrivalsEmpty}</li>}
        {items.map((a) => (
          <li key={a.key} className={fresh.has(a.key) ? 'fe is-new' : 'fe'}>
            <Avatar name={a.name} size={28} ring={!!user && a.friend} />
            <Icon name="arrow" />
            {/* O lobby em cima (leva para a sala), quem entrou embaixo; o title guarda o nome inteiro. */}
            <div className="fe-t">
              <span className="sr-only">
                {a.name} {t.home.joined}{' '}
              </span>
              <Link to={`/sala/${encodeURIComponent(a.lobby.id)}`} className="fe-l" title={a.lobby.name}>
                {a.lobby.name}
              </Link>
              <span className="fe-n" aria-hidden="true">
                {a.name}
              </span>
            </div>
            <span className="lbl">{t.home.ago(Math.max(0, Math.round((now - a.at) / 1000)))}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
