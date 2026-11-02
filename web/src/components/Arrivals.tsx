import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { FRESH_MS } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Avatar } from './Avatar';
import { LiveDot, SectionTitle } from './Common';
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
    <section className="sec" aria-labelledby="arrivals-title">
      <SectionTitle
        id="arrivals-title"
        words={t.home.arrivalsTitle}
        badge={
          <span className="chip live">
            <LiveDot small />
            {t.home.live}
          </span>
        }
      >
        <button type="button" className="link" aria-describedby="arrivals-title" onClick={() => setPaused((v) => !v)}>
          <Icon name={paused ? 'play' : 'pause'} />
          {paused ? t.home.resume : t.home.pause}
        </button>
      </SectionTitle>
      <ol className="feed">
        {items.length === 0 && <li className="feed-empty">{t.home.arrivalsEmpty}</li>}
        {items.map((a) => (
          <li key={a.key} className={fresh.has(a.key) ? 'fe is-new' : 'fe'}>
            <Avatar name={a.name} size={32} ring={!!user && a.friend} />
            <div className="fe-t">
              <div className="fe-n">{a.name}</div>
              <div className="fe-l">
                {t.home.joined} <Link to={`/sala/${encodeURIComponent(a.lobby.id)}`}>{a.lobby.name}</Link>
              </div>
            </div>
            <span className="num">{t.home.ago(Math.max(0, Math.round((now - a.at) / 1000)))}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
