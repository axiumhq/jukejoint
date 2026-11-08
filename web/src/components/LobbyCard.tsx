import { memo, useMemo } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { useCreateBlocked } from '../hooks/useServerStatus';
import { t } from '../i18n';
import { cartao as K } from '../i18n/cartao';
import { live as L } from '../i18n/live';
import { friendsIn, type FriendPresence } from '../lib/friends';
import { cardCorner, closedNote, isTeamFormat, lobbyNum } from '../lib/lobbyCard';
import { lobbyState, type LobbyContext } from '../lib/lobbies';
import { roster } from '../lib/room';
import { AvatarStack } from './Avatar';
import { CreateReason } from './Common';
import { Icon } from './Icon';
import { LobbyAction } from './LobbyAction';
import { ModeCover, ModeIcon } from './ModeCover';

/**
 * O cartão de lobby da Home v4, "ingresso + cartaz" (prototipos/home-curada, v4):
 * - a arte é a capa do modo com o véu escurecendo para baixo; no alto, "Lobby Nº 04" carimbado e
 *   a etiqueta de estado (ou as vagas); embaixo, o placar: o rótulo do formato (Âmbar × Safira nos
 *   modos de time), "10/12" grande e os rostos de quem está dentro (amigos primeiro, com anel).
 *   Os rostos não se dividem entre os lados: a API não sabe o lado de ninguém;
 * - o corpo: o nome (o único link, esticado por cima do cartão) com a estrela, e "Modo · aberto por X";
 * - o canhoto, depois do picote: região e ping, e UMA ação (LobbyAction). Sem vaga e sem entrada
 *   no meio, um aviso no lugar do botão.
 * A linha compacta é o mesmo cartão com outra grade (lobbies.css). No lobby em que você está,
 * a ação é "Abrir a sala", com "Sair" (ou o X de fechar, no seu) ao lado.
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
  /** Na página do próprio modo: sem o nome do modo na linha e sem a capa (o herói da página já a mostra). */
  inMode?: boolean;
}

/** Até seis rostos no placar; o resto vira "+N". */
const FACES = 6;

export const LobbyCard = memo(function LobbyCard({ lobby: l, env, featured = false, fav = false, onFav, inMode = false }: LobbyCardProps) {
  const st = lobbyState(l, env.ctx, env.now);
  const mode = getMode(l.modeSlug);
  const corner = cardCorner(l, st, env.signedIn, env.now);
  const note = closedNote(l, st);
  const num = lobbyNum(l);
  const nameId = `lc-${l.id}`;
  const friendNames = useMemo(() => (env.signedIn && !l.locked ? friendsIn(env.friends, l.id) : []), [env.signedIn, env.friends, l.id, l.locked]);
  // Quem está dentro: os mesmos nomes da sala, amigos primeiro. Lobby com convite não mostra rostos, só a contagem.
  const people = useMemo(() => {
    if (l.locked) return { names: [] as string[], friends: [] as string[], avatars: {} as Record<string, string> };
    const seats = roster(l, { you: env.me, youHere: env.ctx.hereId === l.id, youReady: false, signedIn: env.signedIn, now: env.now, friends: friendNames }).filter(
      (s) => s.name && !s.hidden,
    );
    const friends = new Set(friendNames);
    for (const s of seats) if (s.friend && env.signedIn) friends.add(s.name!);
    const names = seats.map((s) => s.name!);
    const ordered = [...names.filter((n) => friends.has(n)), ...names.filter((n) => !friends.has(n))];
    const avatars: Record<string, string> = {};
    for (const s of seats) if (s.avatar) avatars[s.name!] = s.avatar;
    return { names: ordered, friends: [...friends], avatars };
    // `now` muda a cada 5 s, mas o roster só depende dele para o "pronto", que o cartão não mostra.
  }, [l, env.me, env.ctx.hereId, env.signedIn, friendNames]);
  const hostFriend = env.signedIn && l.hostIsFriend;
  const dim = st.kind === 'full' || st.kind === 'playing-closed' || st.kind === 'private' || st.kind === 'knocking';
  const cls = ['lc', dim && 'dim', st.you && 'is-you', inMode && 'in-mode'].filter(Boolean).join(' ');
  const host = l.mine ? env.me : l.host;
  const teams = isTeamFormat(mode?.format);

  return (
    <article className={cls} aria-labelledby={nameId}>
      <div className="lc-art">{inMode ? <ModeIcon slug={l.modeSlug} kind="detalhe" className="lc-sig" /> : <ModeCover slug={l.modeSlug} />}</div>
      <div className="lc-top">
        {num && <span className="lc-no">{K.num(num)}</span>}
        {corner && <span className={corner.accent ? 'lc-st is-acc' : 'lc-st'}>{corner.text}</span>}
      </div>
      <div className="lc-score" aria-hidden="true">
        <span className="lc-fmt">
          {teams ? (
            <>
              <span className="amb">{K.amber}</span>
              <span className="x">×</span>
              <span className="saf">{K.sapphire}</span>
            </>
          ) : (
            mode?.format
          )}
        </span>
        <span className="lc-big">
          {l.players}
          <small>/{l.slots}</small>
        </span>
        {people.names.length > 0 && (
          <AvatarStack names={people.names} size={24} max={FACES} total={l.players} friends={people.friends} avatars={people.avatars} />
        )}
      </div>
      <div className="lc-b">
        <div className="lc-head">
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
            {!inMode && <>{mode?.name} · </>}
            {K.openedBy} <b className={hostFriend ? 'is-friend' : undefined}>{host}</b>
          </span>
        </div>
        <span className="sr-only">{t.lobbies.slots(l.players, l.slots, people.friends.length)}</span>
        <div className="lc-f">
          <span className="lc-where">
            <b>{t.regions[l.region]}</b> · {t.lobbies.ping(l.ping)}
            {corner?.slotsNote && <span className="lc-slots"> · {corner.slotsNote}</span>}
          </span>
          {note ? (
            <span className="lc-note">{note}</span>
          ) : (
            <span className="lc-act">
              <LobbyAction lobby={l} state={st} describedBy={nameId} primary={featured && st.canJoin && !st.you} compact />
            </span>
          )}
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
