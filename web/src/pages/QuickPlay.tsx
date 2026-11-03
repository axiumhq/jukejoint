import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AvatarStack } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ModeCover } from '../components/ModeCover';
import { getMode } from '../data/modes';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';
import { isJoinable, pickBestLobby, pickReasons } from '../lib/lobbies';
import { busiestMode, liveStats } from '../lib/stats';
import { useSession } from '../state/session';

/**
 * /jogar: o "Jogar agora" como um cartão de busca. Lê os lobbies, escolhe com `pickBestLobby()`
 * (o mesmo pool da lista, nada de fila paralela) e pede para entrar: com o app aberto vai direto
 * para a sala; sem o app, o diálogo de entrar abre por cima e o cartão fica com o lobby escolhido.
 * Sem candidato, abre o criar lobby no modo mais jogado. `?modo=` restringe a um modo.
 * As duas primeiras etapas são só leitura do que já está na tela; duram pouco de propósito.
 */

const READ_MS = 450;
const PICK_MS = 1100;

export function QuickPlay() {
  useDocumentTitle(t.quickPlay.title);
  const s = useSession();
  const { lobbies, requestJoin, openHost, joiningId } = s;
  const [params] = useSearchParams();
  const modeSlug = params.get('modo') ?? undefined;
  const mode = modeSlug ? getMode(modeSlug) : undefined;
  const [step, setStep] = useState(0);
  /** `undefined` = procurando; `null` = nenhum lobby com vaga. */
  const [pickedId, setPickedId] = useState<string | null | undefined>(undefined);
  const live = useRef(s);
  live.current = s;

  useEffect(() => {
    const a = window.setTimeout(() => setStep(1), READ_MS);
    const b = window.setTimeout(() => {
      const cur = live.current;
      const best = pickBestLobby(cur.lobbies, { mode: modeSlug, ctx: cur.lobbyCtx });
      setStep(2);
      setPickedId(best?.id ?? null);
      if (best) cur.requestJoin({ kind: 'lobby', lobby: best });
      else cur.openHost(modeSlug ?? busiestMode(liveStats(cur.lobbies)).slug);
    }, PICK_MS);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [modeSlug]);

  const picked = pickedId ? lobbies.find((l) => l.id === pickedId) : undefined;
  const pool = useMemo(() => lobbies.filter((l) => (!modeSlug || l.modeSlug === modeSlug) && isJoinable(l)), [lobbies, modeSlug]);
  const cover = picked?.modeSlug ?? modeSlug ?? busiestMode(liveStats(lobbies)).slug;
  const steps = t.quickPlay.steps.slice(0, picked ? 3 : 2);
  const joining = !!picked && joiningId === picked.id;
  const pickedMode = picked ? getMode(picked.modeSlug) : undefined;

  return (
    <div className="qp-page">
      <section className="qp" aria-labelledby="qp-title" aria-busy={pickedId === undefined}>
        <div className="qp-cv" aria-hidden="true">
          <ModeCover slug={cover} wide />
          <div className="qp-shade" />
        </div>
        <div className="qp-body">
          <div className="qp-h">
            <h1 id="qp-title" className="display two">
              {t.quickPlay.words[0]} <em>{t.quickPlay.words[1]}</em>
            </h1>
            <span className="lbl">
              {mode ? t.quickPlay.only(mode.name) : t.quickPlay.anyMode} · <span className="num">{t.quickPlay.open(pool.length)}</span>
            </span>
          </div>

          <ol className="qp-steps">
            {steps.map((label, i) => {
              const st = i < step || (i === 2 && picked) ? 'done' : i === step ? 'on' : 'next';
              return (
                <li key={label} className={`qp-step is-${st}`} aria-current={st === 'on' ? 'step' : undefined}>
                  <span className="n num" aria-hidden="true">
                    {st === 'done' ? <Icon name="check" /> : i + 1}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
          <p className="sr-only" role="status" aria-live="polite">
            {pickedId === undefined ? t.quickPlay.searching : picked ? `${t.quickPlay.found}: ${picked.name}` : t.quickPlay.noneTitle}
          </p>

          {picked && (
            <div className="qp-found">
              <div className="qp-found-t">
                <span className="lbl">{t.quickPlay.found}</span>
                <b>{picked.name}</b>
                <span className="qp-meta">
                  {pickedMode && <span>{pickedMode.name}</span>}
                  <i aria-hidden="true" />
                  <span>
                    <span className="num">
                      {picked.players}/{picked.slots}
                    </span>{' '}
                    {t.room.playersWord}
                  </span>
                  <i aria-hidden="true" />
                  <span>
                    {t.regions[picked.region]} · <span className="num">{t.lobbies.ping(picked.ping)}</span>
                  </span>
                </span>
                <span className="qp-why">
                  <span className="sr-only">{t.quickPlay.why}: </span>
                  {pickReasons(picked)
                    .filter((r) => r !== t.featured.reasons.ping(picked.ping))
                    .map((r) => (
                      <span key={r} className="tag line">
                        {r}
                      </span>
                    ))}
                </span>
              </div>
              <AvatarStack
                names={[picked.host, ...picked.joins.map((j) => j.name)].filter((n, i, a) => a.indexOf(n) === i)}
                total={picked.players}
                size={26}
                max={4}
              />
            </div>
          )}

          {pickedId === null && (
            <div className="qp-none">
              <b>{t.quickPlay.noneTitle}</b>
              <p>{t.quickPlay.noneBody(mode?.name ?? getMode(cover)?.name ?? '')}</p>
            </div>
          )}

          {pickedId !== undefined && (
            <div className="qp-act">
              <Link to="/#lobbies" className="link">
                {t.quickPlay.others}
              </Link>
              {picked ? (
                <button
                  type="button"
                  className="btn btn-p btn-lg"
                  aria-disabled={joining || undefined}
                  onClick={() => !joining && requestJoin({ kind: 'lobby', lobby: picked })}
                >
                  {joining ? t.quickPlay.entering : t.quickPlay.enter}
                  {!joining && <Icon name="arrow" />}
                </button>
              ) : (
                <button type="button" className="btn btn-p btn-lg" onClick={() => openHost(modeSlug ?? cover)}>
                  <Icon name="plus" />
                  {t.quickPlay.create}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
