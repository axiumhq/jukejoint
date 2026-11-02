import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { t } from '../i18n';
import { activity, lobbyState, pickReasons, quorumText, type LobbyContext, type LobbyState } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Icon } from './Icon';
import { LobbyAction } from './LobbyAction';

type Tone = 'plain' | 'friend' | 'state';
interface Note {
  text: string;
  tone: Tone;
  /** Nome a pintar de verdete (amigo que acabou de entrar). */
  friendName?: string;
}

/**
 * A linha de baixo do nome: uma coisa só, a mais útil. Estado curto quando há exceção
 * ("Você está aqui", "Com convite", "Lotado", "Em partida"), senão amigos, quórum ou atividade.
 */
function rowNote(l: Lobby, st: LobbyState, featured: boolean, signedIn: boolean, now: number): Note {
  if (featured && !st.you) {
    // O ping já está na coluna Servidor: não repete na mesma linha.
    // Amigos só existem para quem entrou com a Steam.
    const friendReasons = [t.featured.reasons.friends(l.friends), t.featured.reasons.hostFriend];
    const why = pickReasons(l, now).filter((r) => r !== t.featured.reasons.ping(l.ping) && (signedIn || !friendReasons.includes(r)));
    return { text: why.length ? t.lobbies.featuredWhy(why.join(', ')) : t.lobbies.featured, tone: 'state' };
  }
  if (st.kind === 'mine' || st.kind === 'joined') return { text: st.label ?? t.lobbyState.here, tone: 'state' };
  if (st.label) return { text: st.label, tone: 'state' };
  if (signedIn && l.friends > 0 && !l.locked) return { text: t.lobbies.friendsIn(l.friends), tone: 'friend' };
  const q = quorumText(l);
  if (q) return { text: q, tone: 'plain' };
  const a = activity(l, st, now);
  return { text: a.text, tone: 'plain', friendName: a.friend ? a.name : undefined };
}

/** Vagas como janelinhas: acesa (sódio) = jogador, verdete = amigo, contorno = vaga livre. */
function Windows({ lobby, friends }: { lobby: Lobby; friends: number }) {
  return (
    <span className="win" aria-hidden="true">
      {Array.from({ length: lobby.slots }, (_, i) => (
        <i key={i} className={i < friends ? 'is-friend' : i < lobby.players ? 'is-on' : undefined} />
      ))}
    </span>
  );
}

interface RowProps {
  lobby: Lobby;
  ctx: LobbyContext;
  featured: boolean;
  signedIn: boolean;
  now: number;
}

function Row({ lobby, ctx, featured, signedIn, now }: RowProps) {
  const st = lobbyState(lobby, ctx, now);
  const mode = getMode(lobby.modeSlug);
  const note = rowNote(lobby, st, featured, signedIn, now);
  const friends = signedIn && !lobby.locked ? lobby.friends : 0;
  const nameId = `lobby-${lobby.id}`;
  const dim = st.kind === 'full' || st.kind === 'playing-closed';
  const cls = ['lt-row', featured && !st.you && 'is-featured', st.you && 'is-you', dim && 'is-dim'].filter(Boolean).join(' ');
  const noteText =
    note.friendName && note.text.startsWith(note.friendName) ? (
      <>
        <span className="is-friend">{note.friendName}</span>
        {note.text.slice(note.friendName.length)}
      </>
    ) : (
      note.text
    );

  return (
    <tr className={cls} role="row" data-kind={st.kind}>
      <th scope="row" className="lt-lobby" role="rowheader">
        <span className="lt-name" id={nameId}>
          {lobby.name}
          {lobby.locked && <Icon name="lock" size={13} className="lt-lock" label={t.lobbies.locked} />}
        </span>
        <span className={`lt-note${note.tone === 'friend' ? ' is-friend' : note.tone === 'state' ? ' is-state' : ''}`}>{noteText}</span>
      </th>
      <td className="lt-mode" role="cell">
        {mode?.name}
      </td>
      <td className="lt-server" role="cell">
        <span className="sr-only">{t.lobbies.pingLabel(t.regions[lobby.region], lobby.ping)}</span>
        <span aria-hidden="true">
          {t.regions[lobby.region]} <span className="num">{t.lobbies.ping(lobby.ping)}</span>
        </span>
      </td>
      <td className="lt-slots" role="cell">
        <span className="sr-only">{t.lobbies.slots(lobby.players, lobby.slots, friends)}</span>
        <Windows lobby={lobby} friends={friends} />
        <span className="num" aria-hidden="true">
          {lobby.players}/{lobby.slots}
        </span>
      </td>
      <td className="lt-act" role="cell">
        <LobbyAction lobby={lobby} state={st} describedBy={nameId} primary={featured && !st.you} />
      </td>
    </tr>
  );
}

interface LobbyTableProps {
  /** Já filtrados e ordenados (lib/lobbies.ts `filterLobbies`). */
  lobbies: Lobby[];
  /** O recomendado (`useFeaturedLobby`): sobe para a primeira linha, depois das suas. Nunca aparece duas vezes. */
  featured?: Lobby;
  now: number;
  /** Quadro de partidas da home: linhas um pouco mais altas, nome maior. */
  variant?: 'table' | 'board';
  label?: string;
  limit?: number;
}

/**
 * A tabela de lobbies, a mesma em /lobbies, na página do modo e na home.
 * Colunas: lobby, modo, servidor e ping, vagas, ação. Um botão por linha; só o recomendado é cheio.
 */
export function LobbyTable({ lobbies, featured, now, variant = 'table', label = t.lobbies.tableLabel, limit }: LobbyTableProps) {
  const { lobbyCtx, user } = useSession();
  const isHere = (l: Lobby) => !!l.mine || l.id === lobbyCtx.hereId || l.id === lobbyCtx.joiningId;
  const pick = featured && lobbies.some((l) => l.id === featured.id) ? featured : undefined;
  const here = lobbies.filter(isHere);
  const rest = lobbies.filter((l) => !isHere(l) && l.id !== pick?.id);
  const ordered = [...here, ...(pick && !isHere(pick) ? [pick] : []), ...rest].slice(0, limit);

  return (
    <table className={`lt${variant === 'board' ? ' lt--board' : ''}`} role="table" aria-label={label}>
      <colgroup>
        <col className="c-lobby" />
        <col className="c-mode" />
        <col className="c-server" />
        <col className="c-slots" />
        <col className="c-act" />
      </colgroup>
      <thead>
        <tr role="row">
          <th scope="col" role="columnheader">
            {t.lobbies.cols.lobby}
          </th>
          <th scope="col" role="columnheader">
            {t.lobbies.cols.mode}
          </th>
          <th scope="col" role="columnheader">
            {t.lobbies.cols.server}
          </th>
          <th scope="col" role="columnheader">
            {t.lobbies.cols.slots}
          </th>
          <th scope="col" role="columnheader">
            <span className="sr-only">{t.lobbies.cols.action}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((l) => (
          <Row key={l.id} lobby={l} ctx={lobbyCtx} featured={l.id === pick?.id} signedIn={!!user} now={now} />
        ))}
      </tbody>
    </table>
  );
}
