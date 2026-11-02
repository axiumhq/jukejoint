import { useEffect, useRef, useState } from 'react';
import { modes } from '../data/modes';
import { useNow } from '../hooks/useNow';
import { useReducedMotion } from '../hooks';
import { t } from '../i18n';
import { lobbyState, pickBestLobby, pickReasons, quorumText } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Setback } from './Deco';
import { Icon } from './Icon';
import { LobbyAction } from './LobbyAction';
import { ActivityLine, PingBars } from './LobbyBits';
import { lobbyView } from './LobbyRow';
import { ModeArt } from './ModeArt';
import { ModeSeal, modeHue } from './ModeSeal';
import { RitualCircle } from './RitualCircle';

interface FeaturedLobbyProps {
  /** Restringe a um modo (página do modo). */
  mode?: string;
  headingLevel?: 2 | 3;
  /** Simula a cidade vazia (`?vazio=1`). */
  empty?: boolean;
  className?: string;
}

/**
 * "Em cartaz agora": um lobby em destaque, o pico visual da tela.
 * É exatamente o lobby que `pickBestLobby()` escolhe (o mesmo do "Jogar agora"), com o porquê
 * em texto. Fica no mesmo lobby enquanto der para entrar; quando lota, troca e avisa "Lotou. Próximo:".
 * Se você entrou nele, vira "Você está aqui". Sem candidato, convida a abrir o primeiro do modo mais jogado.
 */
export function FeaturedLobby({ mode: modeFilter, headingLevel = 2, empty = false, className }: FeaturedLobbyProps) {
  const { lobbies, lobbyCtx, openHost } = useSession();
  const now = useNow(5000);
  const reduced = useReducedMotion();
  const [heldId, setHeldId] = useState<string | null>(null);
  const [swapNote, setSwapNote] = useState(false);
  const swapTimer = useRef<number | undefined>(undefined);

  const pool = empty ? [] : lobbies;
  const held = heldId ? pool.find((l) => l.id === heldId) : undefined;
  const heldSt = held ? lobbyState(held, lobbyCtx, now) : null;
  const keep = !!held && !!heldSt && (heldSt.canJoin || heldSt.you || heldSt.kind === 'joining');
  const lobby = keep ? held : pickBestLobby(pool, { mode: modeFilter, ctx: lobbyCtx, now });

  useEffect(() => {
    const nextId = lobby?.id ?? null;
    if (nextId === heldId) return;
    // O destacado deixou de aceitar gente (lotou ou começou): troca e explica.
    if (held && !keep) {
      setSwapNote(true);
      window.clearTimeout(swapTimer.current);
      swapTimer.current = window.setTimeout(() => setSwapNote(false), 5000);
    }
    setHeldId(nextId);
  }, [lobby?.id, heldId, held, keep]);

  useEffect(() => () => window.clearTimeout(swapTimer.current), []);

  const H = headingLevel === 3 ? 'h3' : 'h2';
  const titleId = `featured-title${modeFilter ? `-${modeFilter}` : ''}`;

  if (!lobby) {
    const top = [...modes].filter((m) => !modeFilter || m.slug === modeFilter).sort((a, b) => b.playersNow - a.playersNow)[0] ?? modes[0]!;
    return (
      <section className={`featured is-none has-mode${className ? ` ${className}` : ''}`} style={modeHue(top)} aria-labelledby={titleId}>
        <div className="featured-art">
          <Setback className="frame-crown" />
          <ModeArt mode={top} />
        </div>
        <div className="featured-copy">
          <H id={titleId} className="featured-kicker">
            {t.featured.title}
          </H>
          <p className="featured-name">{t.featured.noneTitle(top.name)}</p>
          <p className="featured-why">{t.featured.noneBody}</p>
        </div>
        <div className="featured-act">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => openHost(top.slug)}>
            <Icon name="plus" size={18} />
            {t.featured.noneCta}
          </button>
        </div>
      </section>
    );
  }

  const v = lobbyView(lobby, lobbyCtx, now);
  const reasons = pickReasons(lobby, now);
  const quorum = quorumText(lobby);
  const nameId = `featured-lobby-${lobby.id}`;

  return (
    <section
      className={`featured has-mode${v.state.you ? ' is-you' : ''}${className ? ` ${className}` : ''}`}
      style={modeHue(v.mode)}
      aria-labelledby={titleId}
      data-kind={v.state.kind}
    >
      <div className="featured-art">
        <Setback className="frame-crown" />
        {v.mode && <ModeArt mode={v.mode} playing={!reduced} />}
      </div>
      <div className="featured-copy">
        <H id={titleId} className="featured-kicker">
          {swapNote ? (
            <>
              <span className="featured-swap">{t.featured.filledNext}</span> {t.featured.title}
            </>
          ) : (
            t.featured.title
          )}
        </H>
        <p className="featured-mode">
          <ModeSeal mode={lobby.modeSlug} size="sm" state={v.seal} link />
          <span>{v.mode?.name}</span>
        </p>
        <p className="featured-name" id={nameId} key={lobby.id}>
          {lobby.name}
        </p>
        <p className="featured-meta">
          {t.featured.host(lobby.host)}
          <PingBars lobby={lobby} />
        </p>
        {v.state.you ? (
          <p className="featured-why">{t.featured.youHere}</p>
        ) : (
          <p className="featured-why">
            <span className="sr-only">{t.featured.criterion} </span>
            {reasons.join(', ')}
          </p>
        )}
        <ActivityLine activity={v.activity} className="featured-activity" />
      </div>
      <div className="featured-act">
        <RitualCircle
          total={lobby.slots}
          taken={lobby.players}
          friends={lobby.friends}
          youLast={v.state.you}
          mode={v.mode}
          quorum={lobby.minPlayers}
          className="featured-ritual"
        />
        {quorum && <p className="featured-quorum">{quorum}</p>}
        <LobbyAction lobby={lobby} state={v.state} describedBy={nameId} className="btn-primary btn-lg" />
        <p className="featured-criterion" aria-hidden="true">
          {t.featured.criterion}
        </p>
      </div>
    </section>
  );
}
