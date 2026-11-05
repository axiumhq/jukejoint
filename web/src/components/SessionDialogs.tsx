import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode, getModes, type Region } from '../data/modes';
import { useCannotRunApp } from '../hooks';
import { t } from '../i18n';
import { desktop as D } from '../i18n/desktop';
import { live as L } from '../i18n/live';
import type { EngineError } from '../lib/desktop';
import { belowQuorum, REGIONS, roundText } from '../lib/lobbies';
import { TOAST_MS, toastLeft } from '../lib/toast';
import { useSession } from '../state/session';
import { DevSignIn, SignInPending } from './AppLogin';
import { LiveDot, Tag } from './Common';
import { Dialog } from './Dialog';
import { Icon, type IconName } from './Icon';
import { ModeCover } from './ModeCover';

/** Cabeçalho comum dos diálogos de lobby: capa do modo, nome e a contagem ao vivo. */
function LobbySummary({ lobby }: { lobby: Lobby }) {
  const mode = getMode(lobby.modeSlug);
  return (
    <div className="dlg-lobby">
      <span className="dlg-cv" aria-hidden="true">
        <ModeCover slug={lobby.modeSlug} />
      </span>
      <div className="dlg-lt">
        <span className="lbl">{mode?.name}</span>
        <b>{lobby.name}</b>
        <span className="dlg-lm">
          <span className="num">{t.lobbies.inRoom(lobby.players, lobby.slots)}</span>
          <i aria-hidden="true" />
          <span>
            {t.regions[lobby.region]} · <span className="num">{t.lobbies.ping(lobby.ping)}</span>
          </span>
        </span>
      </div>
      {lobby.locked ? (
        <Tag tone="lock" className="dlg-tag">
          {t.lobbies.locked}
        </Tag>
      ) : (
        <span className="dlg-live">
          <LiveDot small />
          {t.join.live}
        </span>
      )}
    </div>
  );
}

/** Aviso curto dentro do diálogo (partida em andamento, quórum, troca de lobby). */
function Note({ icon = 'info', tone, children }: { icon?: IconName; tone?: 'warn'; children: ReactNode }) {
  return (
    <p className={tone ? `dlg-note is-${tone}` : 'dlg-note'} role={tone ? 'note' : undefined}>
      <Icon name={icon} />
      <span>{children}</span>
    </p>
  );
}

function SignInBlock({ body }: { body: string }) {
  const { signIn, live, authPending } = useSession();
  return (
    <div className="dlg-signin">
      <p>{body}</p>
      {authPending ? (
        <SignInPending />
      ) : (
        <>
          <button type="button" className="btn btn-p btn-lg" onClick={signIn}>
            <Icon name="user" />
            {t.account.signIn}
          </button>
          <DevSignIn />
        </>
      )}
      <small>{live ? L.steamNote : t.account.mockNote}</small>
    </div>
  );
}

/**
 * Celular ou tablet: o app não roda aqui. Mostra o link (da sala ou do site) para abrir no PC,
 * com o botão de copiar; se a área de transferência recusar, o link fica selecionado.
 */
function OpenOnPc({ lobby, onClose }: { lobby: Lobby | null; onClose: () => void }) {
  const { pathname } = useLocation();
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');
  const code = useRef<HTMLElement>(null);
  const path = lobby ? `/sala/${encodeURIComponent(lobby.id)}` : '/';
  const url = `${window.location.origin}${path}`;
  const onRoom = pathname === path;

  useEffect(() => {
    if (copy !== 'done') return;
    const id = window.setTimeout(() => setCopy('idle'), 2500);
    return () => window.clearTimeout(id);
  }, [copy]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy('done');
    } catch {
      if (code.current) window.getSelection()?.selectAllChildren(code.current);
      setCopy('failed');
    }
  }

  return (
    <>
      <section className="dlg-opt is-main dlg-pc" aria-labelledby="join-pc">
        <h3 className="cap" id="join-pc">
          {lobby ? t.join.phoneRoomLink : t.join.phoneSiteLink}
        </h3>
        <code ref={code} className={copy === 'failed' ? 'dlg-link num is-fail' : 'dlg-link num'}>
          {url.replace(/^https?:\/\//, '')}
        </code>
        <button type="button" className="btn btn-p btn-lg" onClick={copyLink}>
          <Icon name={copy === 'done' ? 'check' : 'copy'} />
          {copy === 'done' ? t.join.linkCopied : lobby ? t.join.copyRoomLink : t.join.copySiteLink}
        </button>
        <p className={copy === 'failed' ? 'dlg-hint is-fail' : 'dlg-hint'} role="status">
          {copy === 'failed' ? t.join.copyFailed : t.install.platformMeta}
        </p>
      </section>
      {lobby && !onRoom && (
        <div className="dlg-act">
          <Link to={path} className="btn btn-s btn-lg" onClick={onClose}>
            {t.join.viewRoom}
          </Link>
        </div>
      )}
    </>
  );
}

/** Um problema do motor em duas camadas: a frase para quem joga e, recolhido, o detalhe técnico. */
export function EngineProblem({ error }: { error: EngineError }) {
  return (
    <div className="dlg-prob">
      <p>{error.message}</p>
      {error.detail && (
        <details className="dlg-tech">
          <summary>{D.details}</summary>
          <code>{error.detail}</code>
        </details>
      )}
    </div>
  );
}

/**
 * Dentro do app: o que a checagem do motor (`engine_check`) diz. Pronto, ou a lista do que falta,
 * com o botão para a tela Instalação. Entrar na sala continua possível: o motor só é usado quando a
 * partida começa.
 */
function AppCheckBlock() {
  const { appCheck, recheckApp, openInstallWindow } = useSession();
  if (!appCheck) return null;
  const test = appCheck.modes?.testMode ? D.testMode(appCheck.modes.testProject) : null;
  if (appCheck.status === 'checking' && appCheck.problems.length === 0) {
    return (
      <p className="dlg-note" role="status">
        <span className="rb-spin" aria-hidden="true" />
        <span>{D.checking}</span>
      </p>
    );
  }
  if (appCheck.status === 'ready') {
    return (
      <div className="dlg-stack">
        <Note icon="check">{D.ready}</Note>
        {test && <Note icon="info">{test}</Note>}
      </div>
    );
  }
  return (
    <section className="dlg-opt dlg-probs" aria-labelledby="join-probs" aria-busy={appCheck.status === 'checking'}>
      <h3 className="cap" id="join-probs">
        {D.problemsTitle(appCheck.problems.length)}
      </h3>
      <ul>
        {appCheck.problems.map((p) => (
          <li key={p.code + p.message}>
            <Icon name="info" />
            <EngineProblem error={p} />
          </li>
        ))}
      </ul>
      <p className="dlg-hint">{D.problemsHint}</p>
      <div className="dlg-act is-start">
        <button type="button" className="btn btn-p btn-sm" onClick={openInstallWindow}>
          <Icon name="gear" />
          {D.openInstall}
        </button>
        <button type="button" className="btn btn-g btn-sm" onClick={recheckApp} disabled={appCheck.status === 'checking'}>
          {appCheck.status === 'checking' ? D.checking : D.recheck}
        </button>
      </div>
    </section>
  );
}

/**
 * Entrar: mostra o lobby (ao vivo), avisa se a partida já começou ou se ainda falta gente para o quórum,
 * pede o app se ele não estiver aberto, e confirma a troca se você já está noutro lobby.
 * No celular (lib/device.ts), diz que o app roda no PC e oferece o link para abrir lá.
 * O lobby com convite nunca chega aqui (vai para "Bater na porta").
 */
export function JoinDialog() {
  const { joinTarget, closeJoin, confirmJoin, lobbies, appConnected, hereId, desktop, appCheck } = useSession();
  // Dentro do app desktop nunca é "celular": quem está aqui está no PC.
  const phone = useCannotRunApp() && !desktop;
  const appProblems = desktop && appCheck?.status === 'problems';
  // O lobby continua ao vivo enquanto o diálogo está aberto.
  const live = joinTarget?.kind === 'lobby' ? (lobbies.find((l) => l.id === joinTarget.lobby.id) ?? joinTarget.lobby) : null;
  const here = !phone && hereId && live && hereId !== live.id ? lobbies.find((l) => l.id === hereId) : undefined;
  const title = phone ? t.join.phoneTitle : here ? t.join.switchTitle : appConnected ? t.join.titleConnected : t.join.title;
  const lead = phone ? (live ? t.join.phoneBody(live.name) : t.join.phoneBotsBody) : live ? t.join.body(live.name) : t.join.botsBody;
  const round = live?.status === 'em-partida' ? roundText(live) : null;

  return (
    <>
      <Dialog open={joinTarget !== null} onClose={closeJoin} title={title} lead={here ? undefined : lead} className="dlg-join">
        {live && (
          <div className="dlg-stack">
            <LobbySummary lobby={live} />
            {round && <Note icon="enterMid">{t.join.midMatch(round)}</Note>}
            {belowQuorum(live) && <Note icon="users">{t.join.quorum(live.minPlayers, live.minPlayers - live.players)}</Note>}
            {here && (
              <Note icon="exit" tone="warn">
                {here.mine ? t.join.switchHostBody(here.name, live.name) : t.join.switchBody(here.name, live.name)}
              </Note>
            )}
          </div>
        )}
        {phone ? (
          <OpenOnPc lobby={live} onClose={closeJoin} />
        ) : appConnected ? (
          <>
            {desktop && <AppCheckBlock />}
            <div className="dlg-act">
              <button type="button" className="btn btn-g btn-lg" onClick={closeJoin}>
                {t.join.switchCancel}
              </button>
              <button
                type="button"
                className={appProblems && !here ? 'btn btn-g btn-lg' : 'btn btn-p btn-lg'}
                onClick={confirmJoin}
                data-autofocus={appProblems && !here ? undefined : ''}
              >
                {here ? t.join.switchConfirm : appProblems ? D.enterAnyway : t.lobbyState.join}
                <Icon name="arrow" />
              </button>
            </div>
          </>
        ) : (
          <div className="dlg-opts">
            <section className="dlg-opt" aria-labelledby="join-have">
              <h3 className="cap" id="join-have">
                {t.join.haveApp}
              </h3>
              <button type="button" className="btn btn-s btn-lg" onClick={confirmJoin}>
                {t.join.openApp}
                <Icon name="arrow" />
              </button>
            </section>
            <section className="dlg-opt is-main" aria-labelledby="join-none">
              <h3 className="cap" id="join-none">
                {t.join.noApp}
              </h3>
              <Link to="/instalar" className="btn btn-p btn-lg" onClick={closeJoin} data-autofocus="">
                <Icon name="download" />
                {t.join.install}
              </Link>
              <ul className="dlg-trust">
                {t.join.trust.map((item) => (
                  <li key={item}>
                    <Icon name="check" />
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
 * Bater na porta: o pedido de entrada num lobby com convite. Quem abriu vê seu nome e decide.
 * Privado mostra só a contagem (sem nomes de quem está dentro).
 */
export function KnockDialog() {
  const { knockTarget, closeKnock, sendKnock, lobbies, user } = useSession();
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
    <Dialog open={live !== null} onClose={closeKnock} className="dlg-join" title={t.knock.title} lead={live ? t.knock.body(live.host) : undefined}>
      {live && (
        <div className="dlg-stack">
          <LobbySummary lobby={live} />
          <Note icon="lock">{t.knock.privacy}</Note>
        </div>
      )}
      {!user ? (
        <>
          <SignInBlock body={t.knock.signIn} />
          <div className="dlg-act">
            <button type="button" className="btn btn-g btn-lg" onClick={closeKnock}>
              {t.knock.cancel}
            </button>
          </div>
        </>
      ) : (
        <form className="dlg-form" onSubmit={submit}>
          <div className="dlg-field">
            <label className="cap" htmlFor="knock-msg">
              {t.knock.message}
            </label>
            <input
              id="knock-msg"
              name="knock-message"
              className="dlg-input"
              type="text"
              autoComplete="off"
              maxLength={80}
              value={message}
              placeholder={t.knock.messagePlaceholder}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="dlg-act">
            <button type="button" className="btn btn-s btn-lg" onClick={closeKnock}>
              {t.knock.cancel}
            </button>
            <button type="submit" className="btn btn-p btn-lg">
              <Icon name="knock" />
              {t.knock.send}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** Interruptor de opção do lobby (role switch, 44 px de altura). */
function Switch({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={on ? 'dlg-sw is-on' : 'dlg-sw'} onClick={() => onChange(!on)}>
      <i aria-hidden="true" />
      {children}
    </button>
  );
}

/** Contador de − / + (vagas, mínimo para começar): botões de 44 px, valor ao vivo. */
function Stepper({
  value,
  min,
  max,
  less,
  more,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  less: string;
  more: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="dlg-step">
      <button type="button" aria-label={less} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output className="num" aria-live="polite">
        {value}
      </output>
      <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export function HostDialog() {
  const modes = getModes();
  const { hostDialog, closeHost, createLobby, user } = useSession();
  const [modeSlug, setModeSlug] = useState(modes[0]!.slug);
  const [name, setName] = useState('');
  const [region, setRegion] = useState<Region>('BR');
  const [slots, setSlots] = useState(12);
  const [quorum, setQuorum] = useState(6);
  const [locked, setLocked] = useState(false);
  const [beginners, setBeginners] = useState(false);
  const [midMatch, setMidMatch] = useState(true);

  const mode = modes.find((m) => m.slug === modeSlug) ?? modes[0]!;
  const total = Math.min(slots, mode.maxPlayers);
  const minNeeded = Math.min(quorum, total);

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
      setBeginners(false);
      setMidMatch(true);
    }
  }, [hostDialog.open, hostDialog.modeSlug]);

  const placeholder = t.host.namePlaceholder(user?.name ?? '');
  const finalName = name.trim() || placeholder;

  function submit(e: FormEvent) {
    e.preventDefault();
    createLobby({ name: finalName, modeSlug, region, slots: total, minPlayers: minNeeded, locked, beginners, joinInProgress: midMatch });
  }

  return (
    <Dialog open={hostDialog.open} onClose={closeHost} title={t.host.title} size="wide" className="dlg-host">
      {!user ? (
        <SignInBlock body={t.host.needSignIn} />
      ) : (
        <form className="dlg-form" onSubmit={submit}>
          <fieldset className="dlg-field">
            <legend className="cap">{t.host.mode}</legend>
            <div className="dlg-picks is-modes">
              {modes.map((m) => (
                <label key={m.slug} className="dlg-pick">
                  <input
                    type="radio"
                    name="host-mode"
                    value={m.slug}
                    checked={modeSlug === m.slug}
                    aria-label={t.host.modeLabel(m.name, m.minPlayers, m.maxPlayers)}
                    onChange={() => pickMode(m.slug)}
                  />
                  <span className="dlg-pick-cv" aria-hidden="true">
                    <ModeCover slug={m.slug} />
                  </span>
                  <span className="dlg-pick-t" aria-hidden="true">
                    <b>{m.name}</b>
                    <small className="num">{t.host.modePlayers(m.minPlayers, m.maxPlayers)}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="dlg-field">
            <div className="dlg-lbl">
              <label className="cap" htmlFor="host-name">
                {t.host.name}
              </label>
              <span className="dlg-count num" aria-hidden="true">
                {name.length} / 40
              </span>
            </div>
            <input
              id="host-name"
              name="lobby-name"
              className="dlg-input"
              type="text"
              autoComplete="off"
              value={name}
              placeholder={placeholder}
              maxLength={40}
              aria-describedby="host-name-hint"
              onChange={(e) => setName(e.target.value)}
            />
            <p id="host-name-hint" className="dlg-hint">
              {t.host.nameHint}
            </p>
          </div>

          <div className="dlg-row">
            <fieldset className="dlg-field">
              <legend className="cap">{t.host.region}</legend>
              <div className="dlg-seg">
                {REGIONS.map((r) => (
                  <label key={r}>
                    <input type="radio" name="host-region" value={r} checked={region === r} onChange={() => setRegion(r)} />
                    <span>{t.regions[r]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="dlg-field" role="group" aria-labelledby="host-slots-l">
              <span className="cap" id="host-slots-l">
                {t.host.slots}
              </span>
              <Stepper
                value={total}
                min={mode.minPlayers}
                max={mode.maxPlayers}
                less="Menos vagas"
                more="Mais vagas"
                onChange={(n) => {
                  setSlots(n);
                  if (quorum > n) setQuorum(n);
                }}
              />
            </div>
            <div className="dlg-field" role="group" aria-labelledby="host-quorum-l" aria-describedby="host-quorum-hint">
              <span className="cap" id="host-quorum-l">
                {t.host.quorum}
              </span>
              <Stepper value={minNeeded} min={mode.minPlayers} max={total} less="Menos confirmados" more="Mais confirmados" onChange={setQuorum} />
            </div>
          </div>
          <p id="host-quorum-hint" className="dlg-hint">
            {t.host.quorumHint}
          </p>

          <fieldset className="dlg-field">
            <legend className="cap">{t.host.access}</legend>
            <div className="dlg-picks">
              <label className="dlg-pick is-row">
                <input type="radio" name="host-access" checked={!locked} onChange={() => setLocked(false)} />
                <span className="dlg-pick-ico" aria-hidden="true">
                  <Icon name="users" />
                </span>
                <span className="dlg-pick-t">
                  <b>{t.host.accessOpen}</b>
                  <small>{t.host.accessOpenHint}</small>
                </span>
              </label>
              <label className="dlg-pick is-row">
                <input type="radio" name="host-access" checked={locked} onChange={() => setLocked(true)} />
                <span className="dlg-pick-ico" aria-hidden="true">
                  <Icon name="lock" />
                </span>
                <span className="dlg-pick-t">
                  <b>{t.host.accessInvite}</b>
                  <small>{t.host.accessInviteHint}</small>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="dlg-sws">
            <Switch on={beginners} onChange={setBeginners}>
              {t.host.beginners}
            </Switch>
            <Switch on={midMatch} onChange={setMidMatch}>
              {t.host.joinInProgress}
            </Switch>
          </div>

          <div className="dlg-act">
            <button type="button" className="btn btn-s btn-lg" onClick={closeHost}>
              {t.host.cancel}
            </button>
            <button type="submit" className="btn btn-p btn-lg">
              {t.host.submit}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/**
 * Um aviso: some em 5,2 s, mas o relógio para enquanto o mouse está em cima ou o foco está dentro
 * (WCAG 2.2.1) e retoma com o que sobrava (e pelo menos 1,5 s).
 */
function ToastItem({ id, message, onDismiss }: { id: number; message: string; onDismiss: (id: number) => void }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const left = useRef(TOAST_MS);
  const paused = hover || focus;
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const timer = window.setTimeout(() => onDismiss(id), left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = toastLeft(left.current, Date.now() - start);
    };
  }, [paused, id, onDismiss]);
  return (
    <div
      className="toast"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
    >
      <span>{message}</span>
      <button type="button" className="btn-icon" onClick={() => onDismiss(id)} aria-label={t.common.close}>
        <Icon name="x" />
      </button>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useSession();
  return (
    <div className="toasts" role="status" aria-live="polite" aria-label={t.a11y.notifications}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
