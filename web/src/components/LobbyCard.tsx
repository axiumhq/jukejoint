import { memo, useMemo } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { useCreateBlocked } from '../hooks/useServerStatus';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { friendsIn, type FriendPresence } from '../lib/friends';
import { cardTag, isNearFull, lobbyNum } from '../lib/lobbyCard';
import { lobbyState, type LobbyContext } from '../lib/lobbies';
import { roster } from '../lib/room';
import { AvatarStack } from './Avatar';
import { CreateReason, SlotMeter, Tag } from './Common';
import { Icon } from './Icon';
import { LobbyAction } from './LobbyAction';
import { ModeMedallion, ModeStrip } from './ModeCover';

/**
 * O cartão de lobby do redesign (Design-System, `.lc`): à esquerda a faixa de céu com a silhueta
 * do modo e o medalhão; à direita "LOBBY 04 · BR/SA · 14 MS" com a etiqueta de estado, o nome
 * (leva para a sala), "Modo, de quem abriu", as lâmpadas de vaga com quem está dentro, e embaixo
 * "N de M na sala" com UMA ação. A linha compacta é o mesmo cartão com outra grade (lobbies.css).
 */

export interface CardEnv {
  ctx: LobbyContext;
  signedIn: boolean;
  me: string;
  friends: FriendPresence[];
  now: number;
}

interface LobbyCardProps {
  lobby: Lobby;
  env: CardEnv;
  featured?: boolean;
  /** Favorito (só aparece o botão quando `onFav` existe). */
  fav?: boolean;
  onFav?: (id: string) => void;
}

export const LobbyCard = memo(function LobbyCard({ lobby: l, env, featured = false, fav = false, onFav }: LobbyCardProps) {
  const st = lobbyState(l, env.ctx, env.now);
  const mode = getMode(l.modeSlug);
  const tag = cardTag(l, st, env.signedIn, env.now);
  const num = lobbyNum(l);
  const nameId = `lc-${l.id}`;
  const friendNames = useMemo(() => (env.signedIn && !l.locked ? friendsIn(env.friends, l.id) : []), [env.signedIn, env.friends, l.id, l.locked]);
  // Quem está dentro: os mesmos nomes da sala. Lobby com convite não mostra rostos, só a contagem.
  const inside = useMemo(
    () =>
      l.locked
        ? []
        : roster(l, { you: env.me, youHere: env.ctx.hereId === l.id, youReady: false, signedIn: env.signedIn, now: env.now, friends: friendNames })
            .filter((s) => s.name)
            .map((s) => s.name!),
    // `now` muda a cada 5 s, mas o roster só depende dele para o "pronto", que o cartão não mostra.
    [l, env.me, env.ctx.hereId, env.signedIn, friendNames],
  );
  const hostFriend = env.signedIn && l.hostIsFriend;
  const near = isNearFull(l, st);
  const dim = st.kind === 'full' || st.kind === 'playing-closed' || st.kind === 'private' || st.kind === 'knocking';
  const cls = ['lc', near && 'near', dim && 'dim', st.you && 'is-you'].filter(Boolean).join(' ');
  // O acento é só de "Você está aqui" e "Entrando…"; o "Falta N" fica em destaque sem acento.
  const tone = tag && tag.tone === 'acc' && !st.you && st.kind !== 'joining' ? 'strong' : tag?.tone;
  const host = l.mine ? env.me : l.host;

  return (
    <article className={cls} aria-labelledby={nameId}>
      <span className="lc-art" aria-hidden="true">
        <ModeStrip slug={l.modeSlug} />
        <ModeMedallion slug={l.modeSlug} />
      </span>
      <div className="lc-b">
        <div className="lc-meta">
          <span className="lc-id lbl">
            {num ? `${t.home.lobbyNum} ${num} · ` : ''}
            {t.regions[l.region]} · <span className="num">{t.lobbies.ping(l.ping)}</span>
          </span>
          {tag && <Tag tone={tone}>{tag.text}</Tag>}
        </div>
        <div className="lc-t">
          <Link to={`/sala/${encodeURIComponent(l.id)}`} className="lc-n" id={nameId} title={l.name}>
            {l.locked && <Icon name="lock" label={t.lobbies.locked} />}
            {l.name}
          </Link>
          {onFav && (
            <button type="button" className="fav" aria-pressed={fav} aria-label={t.browse.favorite(l.name)} onClick={() => onFav(l.id)}>
              <Icon name="star" />
            </button>
          )}
        </div>
        <span className="lc-m">
          <span className="lc-mode">{mode?.name}</span>, {t.browse.from} <b className={hostFriend ? 'is-friend' : undefined}>{host}</b>
        </span>
        <div className="lc-row">
          <SlotMeter taken={l.players} total={l.slots} pulse={near} />
          <AvatarStack names={inside} size={24} total={l.players} friends={friendNames} />
        </div>
        <div className="lc-f">
          <span className="lc-cnt">
            <span className="sr-only">{t.lobbies.slots(l.players, l.slots, friendNames.length)}</span>
            <span aria-hidden="true">{t.lobbies.inRoom(l.players, l.slots)}</span>
          </span>
          <span className="lc-act">
            <LobbyAction lobby={l} state={st} describedBy={nameId} primary={featured && st.canJoin && !st.you} compact />
          </span>
        </div>
      </div>
    </article>
  );
});

export function CreateCard({ onCreate }: { onCreate: () => void }) {
  const createBlocked = useCreateBlocked();
  return (
    <button
      type="button"
      className="lc-create"
      aria-disabled={createBlocked || undefined}
      title={createBlocked ? L.createBlocked : undefined}
      onClick={() => !createBlocked && onCreate()}
    >
      <span className="pl">
        <Icon name="plus" />
      </span>
      <b>
        {t.lobbies.create}
        <CreateReason blocked={createBlocked} />
      </b>
      <small>{t.browse.createHint}</small>
    </button>
  );
}

/** Ordem da lista: você (entrando, dentro ou seu) primeiro, depois o recomendado, depois o resto. */
export function orderLobbies(list: Lobby[], ctx: LobbyContext, featured?: Lobby) {
  const isHere = (l: Lobby) => !!l.mine || l.id === ctx.hereId || l.id === ctx.joiningId;
  const pick = featured && list.some((l) => l.id === featured.id) && !isHere(featured) ? featured : undefined;
  return [...list.filter(isHere), ...(pick ? [pick] : []), ...list.filter((l) => !isHere(l) && l.id !== pick?.id)];
}
