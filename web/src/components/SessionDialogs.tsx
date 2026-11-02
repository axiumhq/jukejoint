import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode, modes, type Region } from '../data/modes';
import { t } from '../i18n';
import { belowQuorum, REGIONS, roundText } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

/** Cabeçalho comum dos diálogos de lobby: modo, nome e a contagem ao vivo. */
function LobbySummary({ lobby, children }: { lobby: Lobby; children?: ReactNode }) {
  const mode = getMode(lobby.modeSlug);
  return (
    <div className="dlg-lobby">
      <p className="dlg-mode">{mode?.name}</p>
      <p className="dlg-name">{lobby.name}</p>
      <p className="dlg-meta">
        <span>
          <span className="num">
            {lobby.players}/{lobby.slots}
          </span>{' '}
          {t.join.seatsUnit}
        </span>
        <span>
          {t.regions[lobby.region]} <span className="num">{t.lobbies.ping(lobby.ping)}</span>
        </span>
      </p>
      {children}
    </div>
  );
}

/**
 * Entrar: mostra o lobby (ao vivo, o círculo acende quem chega), avisa se a partida já começou
 * ou se ainda falta gente para o quórum, pede o app se ele não estiver aberto, e confirma a troca
 * se você já está noutro lobby. O lobby com convite nunca chega aqui (vai para "Bater na porta").
 */
export function JoinDialog() {
  const { joinTarget, closeJoin, confirmJoin, lobbies, appConnected, hereId } = useSession();
  // O lobby continua ao vivo enquanto o diálogo está aberto.
  const live = joinTarget?.kind === 'lobby' ? (lobbies.find((l) => l.id === joinTarget.lobby.id) ?? joinTarget.lobby) : null;
  const here = hereId && live && hereId !== live.id ? lobbies.find((l) => l.id === hereId) : undefined;
  const title = here ? t.join.switchTitle : appConnected ? t.join.titleConnected : t.join.title;
  const round = live?.status === 'em-partida' ? roundText(live) : null;

  return (
    <>
      <Dialog open={joinTarget !== null} onClose={closeJoin} title={title}>
        {live ? (
          <LobbySummary lobby={live}>
            <p className="dialog-lead">{t.join.body(live.name)}</p>
            {round && <p className="join-note">{t.join.midMatch(round)}</p>}
            {belowQuorum(live) && <p className="join-note">{t.join.quorum(live.minPlayers, live.minPlayers - live.players)}</p>}
          </LobbySummary>
        ) : (
          <p className="dialog-lead">{t.join.botsBody}</p>
        )}
        {here && (
          <p className="join-switch" role="note">
            {here.mine ? t.join.switchHostBody(here.name, live?.name ?? '') : t.join.switchBody(here.name, live?.name ?? '')}
          </p>
        )}
        {appConnected ? (
          <div className="dialog-actions">
            <button type="button" className="btn btn-line" onClick={closeJoin}>
              {t.join.switchCancel}
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmJoin}>
              {t.join.switchConfirm}
            </button>
          </div>
        ) : (
          <div className="join-options">
            <section className="join-option">
              <h3>{t.join.haveApp}</h3>
              <button type="button" className="btn btn-primary" onClick={confirmJoin}>
                {t.join.openApp}
              </button>
            </section>
            <section className="join-option">
              <h3>{t.join.noApp}</h3>
              <Link to="/instalar" className="btn btn-line" onClick={closeJoin}>
                {t.join.install}
              </Link>
              <ul className="check-list">
                {t.join.trust.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={14} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </Dialog>
      <KnockDialog />
    </>
  );
}

/**
 * Bater na porta: o pedido de entrada num lobby com convite. O anfitrião vê seu nome e decide.
 * Privado mostra só a contagem (sem nomes de quem está dentro).
 */
export function KnockDialog() {
  const { knockTarget, closeKnock, sendKnock, lobbies, user, signIn } = useSession();
  const [message, setMessage] = useState('');
  const live = knockTarget ? (lobbies.find((l) => l.id === knockTarget.id) ?? knockTarget) : null;

  useEffect(() => {
    if (knockTarget) setMessage('');
  }, [knockTarget]);

  function submit(e: FormEvent) {
    e.preventDefault();
    sendKnock(message.trim());
  }

  return (
    <Dialog open={live !== null} onClose={closeKnock} title={t.knock.title}>
      {live && (
        <LobbySummary lobby={live}>
          <p className="dialog-lead">{t.knock.body(live.host)}</p>
          <p className="join-note">{t.knock.privacy}</p>
        </LobbySummary>
      )}
      {!user ? (
        <div className="host-signin">
          <p className="dialog-lead">{t.knock.signIn}</p>
          <button type="button" className="btn btn-primary" onClick={signIn}>
            {t.account.signIn}
          </button>
          <p className="fine">{t.account.mockNote}</p>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="knock-msg">{t.knock.message}</label>
            <input id="knock-msg" type="text" maxLength={80} value={message} placeholder={t.knock.messagePlaceholder} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-line" onClick={closeKnock}>
              {t.knock.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {t.knock.send}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function HostDialog() {
  const { hostDialog, closeHost, createLobby, user, signIn } = useSession();
  const [modeSlug, setModeSlug] = useState(modes[0]!.slug);
  const [name, setName] = useState('');
  const [region, setRegion] = useState<Region>('BR');
  const [slots, setSlots] = useState(12);
  const [quorum, setQuorum] = useState(6);
  const [locked, setLocked] = useState(false);

  const mode = modes.find((m) => m.slug === modeSlug) ?? modes[0]!;
  const slotOptions = Array.from({ length: mode.maxPlayers - mode.minPlayers + 1 }, (_, i) => mode.minPlayers + i);
  const total = Math.min(slots, mode.maxPlayers);
  const minNeeded = Math.min(quorum, total);
  const quorumOptions = Array.from({ length: total - mode.minPlayers + 1 }, (_, i) => mode.minPlayers + i);

  const pickMode = (slug: string) => {
    const m = modes.find((x) => x.slug === slug);
    if (!m) return;
    setModeSlug(slug);
    setSlots(m.maxPlayers);
    setQuorum(m.minPlayers);
  };

  useEffect(() => {
    if (hostDialog.open) {
      const m = modes.find((x) => x.slug === hostDialog.modeSlug) ?? modes[0]!;
      setModeSlug(m.slug);
      setSlots(m.maxPlayers);
      setQuorum(m.minPlayers);
      setName('');
      setLocked(false);
    }
  }, [hostDialog.open, hostDialog.modeSlug]);

  const placeholder = t.host.namePlaceholder(user?.name ?? '');
  const finalName = name.trim() || placeholder;

  function submit(e: FormEvent) {
    e.preventDefault();
    createLobby({ name: finalName, modeSlug, region, slots: total, minPlayers: minNeeded, locked });
  }

  return (
    <Dialog open={hostDialog.open} onClose={closeHost} title={t.host.title} className="is-wide">
      {!user ? (
        <div className="host-signin">
          <p className="dialog-lead">{t.host.needSignIn}</p>
          <button type="button" className="btn btn-primary" onClick={signIn}>
            {t.account.signIn}
          </button>
          <p className="fine">{t.account.mockNote}</p>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <fieldset className="field">
            <legend>{t.host.mode}</legend>
            <div className="mode-picks">
              {modes.map((m) => (
                <label key={m.slug} className="mode-pick">
                  <input type="radio" name="host-mode" value={m.slug} checked={modeSlug === m.slug} onChange={() => pickMode(m.slug)} />
                  <span className="mode-pick-name">{m.name}</span>
                  <span className="mode-pick-meta">{t.host.modePlayers(m.minPlayers, m.maxPlayers)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="host-name">{t.host.name}</label>
            <input
              id="host-name"
              type="text"
              value={name}
              placeholder={placeholder}
              maxLength={40}
              aria-describedby="host-name-hint"
              onChange={(e) => setName(e.target.value)}
            />
            <p id="host-name-hint" className="hint">
              {t.host.nameHint}
            </p>
          </div>
          <div className="host-row">
            <fieldset className="field">
              <legend>{t.host.region}</legend>
              <div className="segmented">
                {REGIONS.map((r) => (
                  <label key={r} className="seg">
                    <input type="radio" name="host-region" value={r} checked={region === r} onChange={() => setRegion(r)} />
                    <span>{t.regions[r]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="host-slots">{t.host.slots}</label>
              <select
                id="host-slots"
                value={total}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSlots(n);
                  if (quorum > n) setQuorum(n);
                }}
              >
                {slotOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="host-quorum">{t.host.quorum}</label>
              <select id="host-quorum" value={minNeeded} aria-describedby="host-quorum-hint" onChange={(e) => setQuorum(Number(e.target.value))}>
                {quorumOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p id="host-quorum-hint" className="hint host-quorum-hint">
            {t.host.quorumHint}
          </p>
          <fieldset className="field">
            <legend>{t.host.access}</legend>
            <div className="access-picks">
              <label className="access-pick">
                <input type="radio" name="host-access" checked={!locked} onChange={() => setLocked(false)} />
                <span className="access-name">{t.host.accessOpen}</span>
                <span className="access-hint">{t.host.accessOpenHint}</span>
              </label>
              <label className="access-pick">
                <input type="radio" name="host-access" checked={locked} onChange={() => setLocked(true)} />
                <span className="access-name">
                  <Icon name="lock" size={13} />
                  {t.host.accessInvite}
                </span>
                <span className="access-hint">{t.host.accessInviteHint}</span>
              </label>
            </div>
          </fieldset>
          <div className="dialog-actions">
            <button type="button" className="btn btn-line" onClick={closeHost}>
              {t.host.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {t.host.submit}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useSession();
  return (
    <div className="toasts" role="status" aria-live="polite" aria-label={t.a11y.notifications}>
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span>{toast.message}</span>
          <button type="button" className="btn-icon" onClick={() => dismissToast(toast.id)} aria-label={t.common.close}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
