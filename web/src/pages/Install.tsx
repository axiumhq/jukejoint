import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { CopyField } from '../components/Common';
import { Icon } from '../components/Icon';
import { APP_RELEASE } from '../config/brand';
import { appDoes, appDoesnt, avGuides, hashCommand, installedItems } from '../data/install';
import { useDocumentTitle } from '../hooks';
import { formatDate, t } from '../i18n';
import { useSession } from '../state/session';

/** Depois de um tempo esperando, o texto passa a ajudar em vez de só esperar. */
const STATUS_TIMEOUT_MS = 20000;

function AppStatus() {
  const { appConnected, setAppConnected } = useSession();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (appConnected) return;
    setTimedOut(false);
    const id = window.setTimeout(() => setTimedOut(true), STATUS_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [appConnected]);
  return (
    <div className={`app-status${appConnected ? ' is-connected' : ''}`}>
      <div className="app-status-row" role="status" aria-live="polite">
        <span className="app-status-signal" aria-hidden="true" />
        <p className="app-status-title">{appConnected ? t.install.statusConnected(APP_RELEASE.version) : t.install.statusWaiting}</p>
      </div>
      <p className="app-status-help">
        {appConnected ? t.install.statusConnectedHelp : timedOut ? t.install.statusTimeout : t.install.statusWaitingHelp}
      </p>
      <div className="app-status-actions">
        {appConnected && (
          <Link to="/#lobbies" className="btn btn-line btn-sm">
            {t.install.goLobbies}
          </Link>
        )}
        <button type="button" className="link-quiet" onClick={() => setAppConnected(!appConnected)}>
          {appConnected ? t.install.simulateOff : t.install.simulate} ({t.common.prototype})
        </button>
      </div>
    </div>
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
    <div className="tabs">
      <div role="tablist" aria-label={t.install.avTabs} className="tablist" onKeyDown={onKey}>
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
            className="tab"
            onClick={() => setActive(i)}
          >
            {g.name}
          </button>
        ))}
      </div>
      {avGuides.map((g, i) => (
        <div key={g.id} role="tabpanel" id={`panel-${g.id}`} aria-labelledby={`tab-${g.id}`} hidden={active !== i} className="tabpanel" tabIndex={0}>
          <ol className="av-steps">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function Install() {
  useDocumentTitle(t.meta.install);
  const { pushToast } = useSession();

  return (
    <div className="page install-page">
      <div className="wrap">
      <header className="page-head">
        <div>
          <h1>{t.install.title}</h1>
          <p className="lead">{t.install.lead}</p>
        </div>
      </header>

      <div className="install-layout">
        <aside className="install-side" aria-label={t.install.title}>
          <div className="download-panel">
            <dl className="download-meta">
              <div>
                <dt>{t.install.version}</dt>
                <dd className="num">{APP_RELEASE.version}</dd>
              </div>
              <div>
                <dt>{t.install.size}</dt>
                <dd>
                  <span className="num">{APP_RELEASE.sizeMb.toLocaleString('pt-BR')}</span> MB
                </dd>
              </div>
              <div>
                <dt>{t.install.date}</dt>
                <dd>
                  <time dateTime={APP_RELEASE.releasedAt}>{formatDate(APP_RELEASE.releasedAt)}</time>
                </dd>
              </div>
            </dl>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => pushToast(t.install.downloadToast)}>
              <span className="btn-file">{t.install.download(APP_RELEASE.fileName)}</span>
            </button>
            <p className="fine">{t.install.requirements}</p>
            <p className="fine mobile-note">{t.install.mobileNote}</p>

            <div className="hash" id="hash">
              <h2 className="h-side">{t.install.hashTitle}</h2>
              <CopyField value={APP_RELEASE.sha256} label={t.install.hashTitle} copyLabel={t.install.copyHash} />
              <p className="fine">{t.install.hashHelp}</p>
            </div>

            <p className="source-link">
              {t.install.source} <span className="fine">({t.install.sourceNote})</span>
            </p>
          </div>
          <AppStatus />
        </aside>

        <div className="install-main">
          <section id="antivirus" className="install-section av" aria-labelledby="av-title">
            <h2 id="av-title">{t.install.avTitle}</h2>
            <p>{t.install.avWhy}</p>
            <AvTabs />
            <h3 className="h-side">{t.install.avVerify}</h3>
            <CopyField value={hashCommand} label={t.install.avVerify} copyLabel={t.install.copyCommand} />
          </section>

          <section className="install-section" aria-labelledby="what-title">
            <h2 id="what-title">{t.install.whatTitle}</h2>
            <div className="table-wrap">
              <table className="table">
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
                        <code className="path num">{it.path}</code>
                      </td>
                      <td className="nowrap">{it.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="install-section does" aria-label={`${t.install.doesTitle} / ${t.install.doesntTitle}`}>
            <div>
              <h2>{t.install.doesTitle}</h2>
              <ul className="check-list">
                {appDoes.map((x) => (
                  <li key={x}>
                    <Icon name="check" size={14} />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>{t.install.doesntTitle}</h2>
              <ul className="check-list is-negative">
                {appDoesnt.map((x) => (
                  <li key={x}>
                    <Icon name="close" size={14} />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="install-section risk-pending" aria-labelledby="risk-title">
            <h2 id="risk-title">
              {t.install.riskTitle} <span className="pending-tag">{t.install.riskPending}</span>
            </h2>
            <p>{t.install.riskPlaceholder}</p>
          </section>

          <section className="install-section" aria-labelledby="un-title">
            <h2 id="un-title">{t.install.uninstallTitle}</h2>
            <p>{t.install.uninstallBody}</p>
          </section>

          <p className="install-affiliation">{t.install.affiliation}</p>
        </div>
      </div>
      </div>
    </div>
  );
}
