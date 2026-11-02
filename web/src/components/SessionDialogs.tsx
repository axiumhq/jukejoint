import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { modes, type Region } from '../data/modes';
import { t } from '../i18n';
import { REGIONS } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export function JoinDialog() {
  const { joinTarget, closeJoin, confirmJoinWithApp } = useSession();
  const name = joinTarget?.kind === 'lobby' ? joinTarget.lobby.name : t.join.botsTitle;
  return (
    <Dialog open={joinTarget !== null} onClose={closeJoin} title={t.join.title}>
      <p className="dialog-lead">{t.join.body(name)}</p>
      <div className="join-options">
        <section className="join-option">
          <h3>{t.join.haveApp}</h3>
          <button type="button" className="btn btn-primary" onClick={confirmJoinWithApp}>
            {t.join.openApp}
          </button>
        </section>
        <section className="join-option">
          <h3>{t.join.noApp}</h3>
          <Link to="/instalar" className="btn btn-ghost" onClick={closeJoin}>
            <Icon name="download" size={18} />
            {t.join.install}
          </Link>
          <ul className="check-list">
            {t.join.trust.map((item) => (
              <li key={item}>
                <Icon name="check" size={16} />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

export function HostDialog() {
  const { hostDialog, closeHost, createLobby, user, signIn } = useSession();
  const [modeSlug, setModeSlug] = useState(modes[0]!.slug);
  const [name, setName] = useState('');
  const [region, setRegion] = useState<Region>('BR');
  const [slots, setSlots] = useState(12);
  const [locked, setLocked] = useState(false);

  const mode = modes.find((m) => m.slug === modeSlug) ?? modes[0]!;
  const slotOptions = Array.from({ length: mode.maxPlayers - mode.minPlayers + 1 }, (_, i) => mode.minPlayers + i);

  useEffect(() => {
    if (hostDialog.open) {
      const slug = hostDialog.modeSlug ?? modes[0]!.slug;
      const m = modes.find((x) => x.slug === slug) ?? modes[0]!;
      setModeSlug(m.slug);
      setSlots(m.maxPlayers);
      setName('');
      setLocked(false);
    }
  }, [hostDialog.open, hostDialog.modeSlug]);

  const placeholder = t.host.namePlaceholder(user?.name ?? '');

  function submit(e: FormEvent) {
    e.preventDefault();
    createLobby({ name: name.trim() || placeholder, modeSlug, region, slots: Math.min(slots, mode.maxPlayers), locked });
  }

  return (
    <Dialog open={hostDialog.open} onClose={closeHost} title={t.host.title}>
      {!user ? (
        <div className="host-signin">
          <p className="dialog-lead">{t.host.needSignIn}</p>
          <button type="button" className="btn btn-primary" onClick={signIn}>
            <Icon name="user" size={18} />
            {t.account.signIn}
          </button>
          <p className="fine">{t.account.mockNote}</p>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="host-mode">{t.host.mode}</label>
            <select
              id="host-mode"
              value={modeSlug}
              onChange={(e) => {
                const m = modes.find((x) => x.slug === e.target.value);
                setModeSlug(e.target.value);
                if (m) setSlots(m.maxPlayers);
              }}
            >
              {modes.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="host-name">{t.host.name}</label>
            <input id="host-name" type="text" value={name} placeholder={placeholder} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field-row">
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
              <select id="host-slots" value={slots} onChange={(e) => setSlots(Number(e.target.value))}>
                {slotOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
            <span>{t.host.private}</span>
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={closeHost}>
              {t.host.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              <Icon name="plus" size={18} />
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
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
