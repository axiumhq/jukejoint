import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { useFriends, useIncomingInvite } from '../hooks';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { OFFLINE_FRIENDS, type FriendPresence } from '../lib/friends';
import { lobbyState } from '../lib/lobbies';
import { useSession } from '../state/session';
import { useTheme } from '../state/theme';
import { DevSignIn, SignInPending } from './AppLogin';
import { Presence } from './Avatar';
import { Icon } from './Icon';
import { useRail, useRailSignIn } from './Rail';
import '../styles/social.css';

/**
 * O trilho social da home (e o padrão de qualquer tela que não traga o seu):
 * seu grupo, o convite recebido, amigos online com o próximo passo e os offline, recolhidos.
 * Sem login: um convite compacto para entrar com a Steam. As contagens saem de `friendsOnline()`.
 */

function where(f: FriendPresence, lobby: Lobby | undefined, hereId: string | null) {
  if (!lobby) return t.friends.idle;
  if (lobby.id === hereId) return t.friends.withYou;
  const to = `/sala/${encodeURIComponent(lobby.id)}`;
  return (
    <>
      {f.host ? t.social.verbHost : t.social.verbIn} <Link to={to}>{lobby.name}</Link>
    </>
  );
}

/** O próximo passo com um amigo: entrar onde ele está (estado real do lobby) ou chamar. */
export function FriendStep({ friend, called, onCall }: { friend: FriendPresence; called: boolean; onCall: () => void }) {
  const { lobbies, lobbyCtx, requestJoin, openKnock } = useSession();
  const lobby = friend.lobbyId ? lobbies.find((l) => l.id === friend.lobbyId) : undefined;
  if (!lobby) {
    return (
      <button type="button" className={called ? 'btn btn-g btn-sm feito' : 'btn btn-g btn-sm'} disabled={called} aria-label={called ? undefined : `${t.social.call} ${friend.name}`} onClick={onCall}>
        {called ? t.social.called : t.social.call}
      </button>
    );
  }
  const st = lobbyState(lobby, lobbyCtx);
  if (st.you) return null;
  if (st.action === 'join') {
    return (
      <button
        type="button"
        className="btn btn-s btn-sm"
        aria-label={t.friends.joinLabel(friend.name, lobby.name)}
        onClick={() => requestJoin({ kind: 'lobby', lobby })}
      >
        {st.kind === 'playing-open' ? t.lobbyState.joinMid : t.friends.join}
      </button>
    );
  }
  if (st.action === 'joining') return <span className="fr-state">{t.lobbyState.joining}</span>;
  if (st.action === 'knock') {
    return (
      <button type="button" className="btn btn-g btn-sm" aria-label={t.lobbies.knockLabel(lobby.name)} onClick={() => openKnock(lobby)}>
        {t.friends.knock}
      </button>
    );
  }
  return st.label ? <span className="fr-state">{st.label}</span> : null;
}

export function FriendRow({ friend, children }: { friend: FriendPresence; children?: ReactNode }) {
  const { lobbies, hereId } = useSession();
  const lobby = friend.lobbyId ? lobbies.find((l) => l.id === friend.lobbyId) : undefined;
  return (
    <li className="fr">
      <Presence name={friend.name} size={32} status={lobby ? 'lobby' : 'menu'} />
      <div className="fr-t">
        <b>{friend.name}</b>
        <small>{where(friend, lobby, hereId)}</small>
      </div>
      {children}
    </li>
  );
}

/** O convite de login do trilho. Enquanto ele aparece, a barra superior não repete o botão (Shell `Account`). */
function SignInPrompt() {
  const { signIn, live, authPending } = useSession();
  useRailSignIn();
  return (
    <div className="card rail-signin">
      <b>{t.social.signInTitle}</b>
      <p>{t.social.signInBody}</p>
      {/* secundário: o acento cheio fica para o "Jogar agora" */}
      {authPending ? (
        <SignInPending />
      ) : (
        <>
          <button type="button" className="btn btn-s" onClick={signIn}>
            <Icon name="user" />
            {t.account.signIn}
          </button>
          <DevSignIn />
        </>
      )}
      <small>{live ? L.steamNote : t.social.signInNote}</small>
    </div>
  );
}

function Party() {
  const { user, lobbies, hereId, pushToast } = useSession();
  const { closeSheet } = useRail();
  const { openMenu } = useTheme();
  const here = hereId ? lobbies.find((l) => l.id === hereId) : undefined;
  const hint = () => pushToast(t.social.partyHint);
  return (
    <section className="rail-sec rail-party" aria-labelledby="rail-party">
      <div className="rail-h">
        <h2 className="cap" id="rail-party">
          {t.social.party} · <b>1 de 5</b>
        </h2>
        <button
          type="button"
          className="link"
          onClick={() => {
            closeSheet();
            openMenu();
          }}
        >
          {t.social.settings}
        </button>
      </div>
      <div className="card party">
        <Presence name={user!.name} size={40} status={here ? 'lobby' : 'menu'} />
        <div>
          <b>{user!.name}</b>
          <small>{here ? t.social.inRoom(here.name) : t.social.alone}</small>
        </div>
      </div>
      <div className="party-slots">
        {[0, 1, 2, 3].map((i) => (
          <button key={i} type="button" className="slot-e" aria-label={t.social.callToParty} onClick={hint}>
            <Icon name="plus" />
          </button>
        ))}
        <button type="button" className="btn btn-g btn-sm" onClick={hint}>
          {t.social.call}
        </button>
      </div>
    </section>
  );
}

function Invite({ announce = true }: { announce?: boolean }) {
  const { requestJoin, declineInvite, pushToast } = useSession();
  const invite = useIncomingInvite();
  if (!invite) return null;
  const { from, lobby } = invite;
  return (
    <section className="rail-sec rail-invite" aria-label={t.social.invite}>
      <div className="card invite" role={announce ? 'status' : undefined} aria-live={announce ? 'polite' : undefined}>
        <div className="invite-top">
          <div>
            <b>
              {from} {t.social.invitedYou}
            </b>
            <small>
              {lobby.name} · {t.lobbies.inRoom(lobby.players, lobby.slots)}
            </small>
          </div>
        </div>
        <div className="invite-act">
          <button
            type="button"
            className="btn btn-p btn-sm"
            aria-label={`${t.social.accept}: ${lobby.name}`}
            onClick={() => requestJoin({ kind: 'lobby', lobby })}
          >
            {t.social.accept}
          </button>
          <button
            type="button"
            className="btn btn-g btn-sm"
            onClick={() => {
              declineInvite(lobby.id);
              pushToast(t.social.declinedToast(from));
            }}
          >
            {t.social.decline}
          </button>
        </div>
      </div>
    </section>
  );
}

/** "Ver toda a lista": o painel de 380 px do desktop (no celular a lista já abre na folha de baixo). */
function ListPanel({ onClose, called, onCall }: { onClose: () => void; called: ReadonlySet<string>; onCall: (f: FriendPresence) => void }) {
  const friends = useFriends();
  const { lobbies, hereId, live } = useSession();
  const hasInvite = !!useIncomingInvite();
  const inLobbies = friends.filter((f) => f.lobbyId).length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <aside className="list-panel" aria-label={t.friends.title}>
      <div className="list-panel-in">
        <h2 className="list-panel-h">{t.friends.title}</h2>
        {hasInvite && <Invite announce={false} />}
        {friends.length === 0 ? (
          <p className="list-panel-empty">{t.friends.none}</p>
        ) : (
          <>
            <div className="list-panel-lh">
              <h3>{t.friends.online(friends.length)}</h3>
              <span>{t.social.inLobbies(inLobbies)}</span>
            </div>
            <ul aria-label={t.friends.peopleOnline} className="list-panel-ul">
              {friends.map((f) => {
                const lobby = f.lobbyId ? lobbies.find((l) => l.id === f.lobbyId) : undefined;
                return (
                  <li key={f.name} className="fr">
                    <Presence name={f.name} size={36} status={lobby ? 'lobby' : 'menu'} />
                    <div className="fr-t">
                      <b>{f.name}</b>
                      <small>{where(f, lobby, hereId)}</small>
                    </div>
                    <FriendStep friend={f} called={called.has(f.name)} onCall={() => onCall(f)} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="list-panel-note">{live ? L.friendsNote : t.friends.panelNote}</p>
      </div>
    </aside>,
    document.body,
  );
}

function Online() {
  const friends = useFriends();
  const { live, callFriend } = useSession();
  const [called, setCalled] = useState<ReadonlySet<string>>(() => new Set());
  const [showOff, setShowOff] = useState(false);
  const [panel, setPanel] = useState(false);
  const offId = useId();
  const inLobbies = friends.filter((f) => f.lobbyId).length;
  const onCall = (f: FriendPresence) => {
    // Ao vivo o convite vai pelo servidor; simulado, só o aviso.
    void callFriend(f).then((ok) => ok && setCalled((s) => new Set(s).add(f.name)));
  };
  return (
    <section className="rail-sec" aria-labelledby="rail-online">
      <div className="rail-h">
        <h2 className="cap" id="rail-online">
          {t.social.online} · <b>{friends.length}</b>
        </h2>
        <span className="lbl">{t.social.inLobbies(inLobbies)}</span>
      </div>
      {friends.length === 0 ? (
        <p className="rail-empty">{t.friends.none}</p>
      ) : (
        <ul>
          {friends.map((f) => (
            <FriendRow key={f.name} friend={f}>
              <FriendStep
                friend={f}
                called={called.has(f.name)}
                onCall={() => onCall(f)}
              />
            </FriendRow>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-g btn-sm list-open" aria-expanded={panel} onClick={() => setPanel((v) => !v)}>
        {panel ? t.friends.closeList : t.friends.viewAll}
      </button>
      {panel && <ListPanel onClose={() => setPanel(false)} called={called} onCall={onCall} />}
      {live ? (
        <p className="rail-empty">{L.friendsNote}</p>
      ) : (
        <>
          <button type="button" className="offline" aria-expanded={showOff} aria-controls={offId} onClick={() => setShowOff((v) => !v)}>
            <span>
              {t.social.offline} · <span className="num">{OFFLINE_FRIENDS.length}</span>
            </span>
            <Icon name="chev" />
          </button>
          <ul id={offId} className="offline-list" hidden={!showOff}>
            {OFFLINE_FRIENDS.map((n) => (
              <li key={n} className="fr is-off">
                <Presence name={n} size={28} status="offline" />
                <div className="fr-t">
                  <b>{n}</b>
                  <small>{t.social.offlineState}</small>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function SocialRail() {
  const { user } = useSession();
  const { closeSheet } = useRail();
  const { openMenu } = useTheme();
  if (!user) {
    return (
      <section className="rail-sec" aria-labelledby="rail-friends-out">
        <div className="rail-h">
          <h2 className="cap" id="rail-friends-out">
            {t.friends.title}
          </h2>
          <button
            type="button"
            className="link"
            onClick={() => {
              closeSheet();
              openMenu();
            }}
          >
            {t.social.settings}
          </button>
        </div>
        <SignInPrompt />
      </section>
    );
  }
  return (
    <>
      <Party />
      <Invite />
      <Online />
    </>
  );
}
