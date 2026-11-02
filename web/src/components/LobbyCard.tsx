import { memo, useMemo } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { t } from '../i18n';
import { friendsIn, type FriendPresence } from '../lib/friends';
import { cardTag, isNearFull, lobbyNum } from '../lib/lobbyCard';
import { lobbyState, type LobbyContext } from '../lib/lobbies';
import { roster } from '../lib/room';
import { AvatarStack, Avatar } from './Avatar';
import { Tag } from './Common';
import { Icon } from './Icon';
import { LobbyAction } from './LobbyAction';
import { ModeCover } from './ModeCover';

/**
 * O cartão de lobby do v8 (e a linha compacta, que é o mesmo cartão com outra grade).
 * Capa do modo, etiqueta de estado, anfitrião, pilha de quem está dentro, contagem e UMA ação.
 * O nome leva para a sala (/sala/:id).
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
  const dim = st.kind === 'full' || st.kind === 'playing-closed';
  const cls = ['lc', 'has-cover', isNearFull(l, st) && 'near', dim && 'dim', st.you && 'is-you'].filter(Boolean).join(' ');

  return (
    <article className={cls} aria-labelledby={nameId}>
      <div className="lc-cv">
        <ModeCover slug={l.modeSlug} />
        <span className="lc-id lbl">
          {num ? `${t.home.lobbyNum} ${num} · ` : ''}
          {t.regions[l.region]} · <span className="num">{t.lobbies.ping(l.ping)}</span>
        </span>
        {tag && (
          <span className="lc-st">
            <Tag tone={tag.tone}>{tag.text}</Tag>
          </span>
        )}
      </div>
      <div className="lc-b">
        <div className="lc-t">
          <div className="lc-m">
            <span className="mdot" aria-hidden="true" />
            <span>{mode?.name}</span>
            {onFav && (
              <button type="button" className="fav" aria-pressed={fav} aria-label={t.browse.favorite(l.name)} onClick={() => onFav(l.id)}>
                <Icon name="star" />
              </button>
            )}
          </div>
          <Link to={`/sala/${encodeURIComponent(l.id)}`} className="lc-n" id={nameId} title={l.name}>
            {l.name}
            {l.locked && <Icon name="lock" label={t.lobbies.locked} />}
          </Link>
        </div>
        <div className="lc-h">
          <Avatar name={l.mine ? env.me : l.host} size={20} ring={hostFriend} />
          <span>{t.browse.from}</span>
          <b>{l.mine ? env.me : l.host}</b>
        </div>
        <div className="lc-f">
          <AvatarStack names={inside} size={22} total={l.players} friends={friendNames} />
          <span className="lc-cnt">
            <span className="sr-only">{t.lobbies.slots(l.players, l.slots, friendNames.length)}</span>
            <span aria-hidden="true">
              {l.players}
              <small>/{l.slots}</small>
            </span>
          </span>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (l.players / l.slots) * 100)}%` }} />
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
  return (
    <button type="button" className="lc-create" onClick={onCreate}>
      <span className="pl">
        <Icon name="plus" />
      </span>
      <b>{t.lobbies.create}</b>
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
