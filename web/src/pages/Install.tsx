import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { CopyField, SectionTitle } from '../components/Common';
import { Icon } from '../components/Icon';
import { Rail } from '../components/Rail';
import { APP_RELEASE } from '../config/brand';
import { appDoes, appDoesnt, avGuides, hashCommand, installedItems } from '../data/install';
import { PLATFORM_SCOPE, releases } from '../data/patches';
import { useDocumentTitle } from '../hooks';
import { RELEASES_URL, SOURCE_URL, useLatestRelease } from '../lib/release';
import { formatDate, formatShortDate, t } from '../i18n';
import { desktop as D } from '../i18n/desktop';
import { useSession } from '../state/session';
import '../styles/info.css';

/**
 * /instalar no v8: página de confiança, precisa e calma. Ordem: o instalador (versão, tamanho,
 * data, SHA-256, código-fonte e o status do app), os três passos, o aviso do Windows, o antivírus
 * (#antivirus, link da sala), o que é instalado, o que faz e não faz, anti-cheat (só com texto real,
 * decisão do usuário), desinstalar e perguntas. O trilho traz o índice da página e as notas do app.
 */

/** Depois de um tempo esperando, o texto passa a ajudar em vez de só esperar. */
const STATUS_TIMEOUT_MS = 20000;

/** Anti-cheat só aparece (seção e índice) quando `t.install.riskBody` tiver texto de verdade. */
const HAS_RISK_TEXT = t.install.riskBody.trim().length > 0;

const TOC = (['baixar', 'passos', 'windows', 'antivirus', 'arquivos', 'faz', 'anticheat', 'desinstalar', 'perguntas'] as const).filter(
  (id) => id !== 'anticheat' || HAS_RISK_TEXT,
);

/** Dentro do app: o status vem dele, e o botão abre a tela Instalação (motor, serviço, antivírus). */
function AppStatusInApp() {
  const { desktopVersion, openInstallWindow } = useSession();
  return (
    <div className="ast is-on">
      <span className="ast-sig" aria-hidden="true" />
      <div className="ast-t">
        <p className="ast-title" role="status">
          {D.statusInApp(desktopVersion ?? '')}
        </p>
        <p className="ast-help">{D.statusInAppHelp}</p>
      </div>
      <div className="ast-act">
        <button type="button" className="btn btn-p btn-sm" onClick={openInstallWindow}>
          <Icon name="gear" />
          {D.openInstall}
        </button>
        <Link to="/#lobbies" className="btn btn-s btn-sm">
          {t.install.goLobbies}
        </Link>
      </div>
    </div>
  );
}

function AppStatus({ version }: { version: string | null }) {
  const { appConnected, setAppConnected, live } = useSession();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (appConnected) return;
    setTimedOut(false);
    const id = window.setTimeout(() => setTimedOut(true), STATUS_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [appConnected]);
  return (
    <div className={appConnected ? 'ast is-on' : 'ast'}>
      <span className="ast-sig" aria-hidden="true" />
      <div className="ast-t">
        <p className="ast-title" role="status" aria-live="polite">
          {appConnected ? t.install.statusConnected(version ?? APP_RELEASE.version) : t.install.statusWaiting}
        </p>
        <p className="ast-help">{appConnected ? t.install.statusConnectedHelp : timedOut ? t.install.statusTimeout : t.install.statusWaitingHelp}</p>
      </div>
      <div className="ast-act">
        {appConnected && (
          <Link to="/#lobbies" className="btn btn-s btn-sm">
            {t.install.goLobbies}
          </Link>
        )}
        {/* Só no modo de demonstração (sem API): no site de verdade não há o que simular. */}
        {!live && (
          <button type="button" className="link" onClick={() => setAppConnected(!appConnected)}>
            {appConnected ? t.install.simulateOff : t.install.simulate} ({t.common.prototype})
          </button>
        )}
      </div>
    </div>
  );
}

function DownloadCard() {
  const { desktop } = useSession();
  const rel = useLatestRelease();
  const r = rel.status === 'ready' ? rel.release : null;
  return (
    <>
      <section className="ih is-plain" id="baixar" aria-labelledby="dl-title">
        <div className="ih-top">
          <h1 className="ih-title display" id="dl-title">
            {t.install.titleWords[0]} {t.install.titleWords[1]}
          </h1>
          <span className="ih-sub">{t.install.platformMeta}</span>
        </div>
        <div className="ih-band">
          <div className="ih-file" aria-busy={rel.status === 'loading'}>
            {r ? (
              <>
                <p className="ih-name">{r.fileName}</p>
                <p className="ih-meta">
                  {t.install.version} <span className="num">{r.version}</span> · <span className="num">{r.sizeMb.toLocaleString('pt-BR')}</span>&nbsp;MB ·{' '}
                  <time dateTime={r.releasedAt}>{formatDate(r.releasedAt)}</time>
                </p>
              </>
            ) : rel.status === 'loading' ? (
              <p className="ih-meta">{t.install.releaseLoading}</p>
            ) : (
              <p className="ih-meta">{t.install.releaseUnavailable}</p>
            )}
          </div>
          <a className="btn btn-p btn-lg ih-btn" href={r ? r.downloadUrl : RELEASES_URL} rel="noopener">
            <Icon name="download" />
            <span>{r ? t.install.downloadShort : t.install.openReleases}</span>
          </a>
        </div>
      </section>

      <div className="ih-hash" id="hash">
        <h2 className="ih-k">{t.install.hashTitle}</h2>
        {r?.sha256 ? (
          <CopyField value={r.sha256} label={t.install.hashTitle} copyLabel={t.install.copyHash} />
        ) : (
          <p className="ih-help">{rel.status === 'loading' ? t.install.releaseLoading : t.install.hashOnReleases}</p>
        )}
        <p className="ih-src">
          <a className="link" href={r ? r.pageUrl : SOURCE_URL} rel="noopener">
            {r ? t.install.releaseNotes : t.install.source}
          </a>{' '}
          ·{' '}
          <a className="link" href={SOURCE_URL} rel="noopener">
            {t.install.sourceCode}
          </a>
        </p>
        <p className="ih-help">{t.install.hashHelp}</p>
      </div>

      <div className="ih-status">{desktop ? <AppStatusInApp /> : <AppStatus version={r?.version ?? null} />}</div>
      <p className="ih-req">
        {t.install.requirements} {t.install.mobileNote}
      </p>
    </>
  );
}

function Steps() {
  const { appConnected } = useSession();
  return (
    <section className="sec" id="passos" aria-labelledby="steps-title">
      <SectionTitle id="steps-title" words={t.install.stepsWords} />
      <ol className="isteps">
        {t.install.steps.map((s, i) => (
          <li key={s.title} className={appConnected ? 'istep is-done' : 'istep'}>
            <span className="istep-n num" aria-hidden="true">
              {appConnected ? <Icon name="check" /> : i + 1}
            </span>
            <h3>
              {s.title}
              {appConnected && <span className="sr-only">, {t.install.stepDone}</span>}
            </h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** As duas telas do SmartScreen, desenhadas (sem captura nem marca da Microsoft), com os cliques marcados. */
function SmartScreenFigure() {
  const m = t.install.smartMock;
  return (
    <figure className="ss">
      <div className="ss-panes" aria-hidden="true">
        <div className="ss-pane">
          <span className="ss-k lbl">{m.before}</span>
          <div className="ss-win">
            <b>{m.title}</b>
            <i className="ss-ln" />
            <i className="ss-ln s" />
            <span className="ss-more">
              {m.more}
              <span className="ss-mark num">1</span>
            </span>
          </div>
        </div>
        <div className="ss-pane">
          <span className="ss-k lbl">{m.after}</span>
          <div className="ss-win">
            <b>{m.title}</b>
            <i className="ss-ln" />
            <span className="ss-app">
              {m.app} <span className="num">{APP_RELEASE.fileName}</span>
              <span className="ss-mark num">2</span>
            </span>
            <span className="ss-btns">
              <span className="ss-run">
                {m.run}
                <span className="ss-mark num">3</span>
              </span>
              <span className="ss-no">{m.dont}</span>
            </span>
          </div>
        </div>
      </div>
      <figcaption>{t.install.smartFigure}</figcaption>
    </figure>
  );
}

function AvTabs() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent) {
    const n = avGuides.length;
    let next = active;
    if (e.key === 'ArrowRight') next = (active + 1) % n;
    else if (e.key === 'ArrowLeft') next = (active - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }
  return (
    <div className="av-tabs">
      <div role="tablist" aria-label={t.install.avTabs} className="lb-tabs" onKeyDown={onKey}>
        {avGuides.map((g, i) => (
          <button
            key={g.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${g.id}`}
            aria-selected={active === i}
            aria-controls={`panel-${g.id}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
          >
            {g.name}
          </button>
        ))}
      </div>
      {avGuides.map((g, i) => (
        <div key={g.id} role="tabpanel" id={`panel-${g.id}`} aria-labelledby={`tab-${g.id}`} hidden={active !== i} className="av-panel" tabIndex={0}>
          <ol className="nlist">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function InstallRail() {
  const appChanges = releases
    .flatMap((r) => r.changes.filter((c) => c.scope === PLATFORM_SCOPE).map((c) => ({ ...c, version: r.version, date: r.date })))
    .slice(0, 4);
  return (
    <>
      <nav className="rail-sec" aria-labelledby="ir-toc">
        <div className="rail-h">
          <h2 className="cap" id="ir-toc">
            {t.install.toc}
          </h2>
        </div>
        <ol className="toc">
          {TOC.map((id) => (
            <li key={id}>
              <a href={`#${id}`}>{t.install.tocItems[id]}</a>
            </li>
          ))}
        </ol>
      </nav>
      <section className="rail-sec" aria-labelledby="ir-changes">
        <div className="rail-h">
          <h2 className="cap" id="ir-changes">
            {t.install.railChanges}
          </h2>
        </div>
        <ul className="mr-changes">
          {appChanges.map((c) => (
            <li key={c.text}>
              <span className="lbl">
                {t.categories[c.category]} · <span className="num">{c.version}</span> ·{' '}
                <time dateTime={c.date} className="num">
                  {formatShortDate(c.date)}
                </time>
              </span>
              <p>{c.text}</p>
            </li>
          ))}
        </ul>
        <Link to={`/novidades?modo=${PLATFORM_SCOPE}`} className="link mr-more">
          {t.install.railChangesLink}
          <Icon name="arrow" />
        </Link>
      </section>
    </>
  );
}

export function Install() {
  useDocumentTitle(t.meta.install);

  return (
    <>
      <DownloadCard />
      <Steps />

      <div className="ins">
        <section className="sec" id="windows" aria-labelledby="ss-title">
          <SectionTitle id="ss-title" words={t.install.smartWords} />
          <div className="ss-wrap">
            <div className="ins-text">
              <p>{t.install.smartWhy}</p>
              <ol className="nlist">
                {t.install.smartSteps(APP_RELEASE.fileName).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <SmartScreenFigure />
          </div>
        </section>

        <section className="sec" id="antivirus" aria-labelledby="av-title">
          <SectionTitle id="av-title" words={t.install.avWords} />
          <div className="ins-text">
            <p>{t.install.avWhy}</p>
            <AvTabs />
            <h3 className="ins-h">{t.install.avVerify}</h3>
            <CopyField value={hashCommand} label={t.install.avVerify} copyLabel={t.install.copyCommand} />
          </div>
        </section>

        <section className="sec" id="arquivos" aria-labelledby="what-title">
          <SectionTitle id="what-title" words={t.install.whatWords} />
          <div className="ins-table">
            <table className="files">
              <thead>
                <tr>
                  <th scope="col">{t.install.whatCols.item}</th>
                  <th scope="col">{t.install.whatCols.path}</th>
                  <th scope="col">{t.install.whatCols.size}</th>
                </tr>
              </thead>
              <tbody>
                {installedItems.map((it) => (
                  <tr key={it.item}>
                    <th scope="row">{it.item}</th>
                    <td>
                      <code className="path">{it.path}</code>
                    </td>
                    <td className="files-sz">{it.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="reqs" aria-label={t.install.reqTitle}>
            {t.install.reqs.map((r) => (
              <div key={r.k}>
                <dt className="lbl">{r.k}</dt>
                <dd>{r.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="sec" id="faz" aria-labelledby="does-title">
          <SectionTitle id="does-title" words={t.install.doesWords} />
          <div className="does">
            <div>
              <h3 className="ins-h">{t.install.doesTitle}</h3>
              <ul className="ticks-list">
                {appDoes.map((x) => (
                  <li key={x}>
                    <Icon name="check" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="ins-h">{t.install.doesntTitle}</h3>
              <ul className="ticks-list is-no">
                {appDoesnt.map((x) => (
                  <li key={x}>
                    <Icon name="x" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {HAS_RISK_TEXT && (
          <section className="sec risk" id="anticheat" aria-labelledby="risk-title">
            <div className="sec-h">
              <h2 className="display" id="risk-title">
                {t.install.riskTitle}
              </h2>
            </div>
            <p className="risk-box">{t.install.riskBody}</p>
          </section>
        )}

        <section className="sec" id="desinstalar" aria-labelledby="un-title">
          <div className="sec-h">
            <h2 className="display" id="un-title">
              {t.install.uninstallTitle}
            </h2>
          </div>
          <p className="ins-p">{t.install.uninstallBody}</p>
        </section>

        <section className="sec" id="perguntas" aria-labelledby="faq-title">
          <SectionTitle id="faq-title" words={t.install.faqWords} />
          <dl className="faq">
            {t.install.faq.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <Rail title={t.install.sheet}>
        <InstallRail />
      </Rail>
    </>
  );
}
