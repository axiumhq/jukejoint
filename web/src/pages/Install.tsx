import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { romano } from '../components/Arcano';
import { BrandSymbol } from '../components/Brand';
import { CopyField, SectionTitle } from '../components/Common';
import { Icon } from '../components/Icon';
import { Rail, useRail } from '../components/Rail';
import { PLATFORM_SCOPE, releases } from '../data/patches';
import { useCannotRunApp, useDocumentTitle } from '../hooks';
import { RELEASES_URL, SOURCE_URL, useLatestRelease, type Release, type ReleaseState } from '../lib/release';
import { formatDate, formatNumber, formatShortDate, t } from '../i18n';
import { desktop as D } from '../i18n/desktop';
import { installTexts as I, type AvGuide } from '../i18n/install';
import { instalarPagina as P } from '../i18n/instalar-pagina';
import { useSession } from '../state/session';
import '../styles/info.css';

/**
 * /instalar: página de confiança, precisa e calma. Ordem: o instalador (versão, tamanho, data,
 * SHA-256, código-fonte e o status do app), os três passos, o aviso do Windows, o antivírus
 * (#antivirus, link da sala) com a conferência do hash (#conferir), o que é instalado, o que faz e
 * não faz, anti-cheat (só com texto real, decisão do usuário), desinstalar e perguntas. O trilho
 * traz o índice da página (com a seção atual) e as notas do app.
 *
 * Tudo que cita o arquivo vem da release do GitHub. Sem ela (rede fora, ainda lendo), a página usa
 * o padrão do nome (`Jukejoint-v…-windows-x64-setup.exe`), nunca um nome inventado: o passo do
 * SmartScreen manda não executar se o nome não bater.
 */

/** Depois do download, quanto esperar o app abrir antes de o texto passar a ajudar. */
const STATUS_TIMEOUT_MS = 60000;

/** Anti-cheat só aparece (seção e índice) quando `t.install.riskBody` tiver texto de verdade. */
const HAS_RISK_TEXT = t.install.riskBody.trim().length > 0;

const TOC = (['baixar', 'passos', 'windows', 'antivirus', 'arquivos', 'faz', 'anticheat', 'desinstalar', 'perguntas'] as const).filter(
  (id) => id !== 'anticheat' || HAS_RISK_TEXT,
);

/** Clicou em Baixar nesta aba: o status e os passos mudam (sobrevive a recarregar, não a fechar a aba). */
const DL_KEY = 'jj.install.downloaded';

function useDownloaded(): [boolean, () => void] {
  const [downloaded, setDownloaded] = useState(() => {
    try {
      return sessionStorage.getItem(DL_KEY) === '1';
    } catch {
      return false;
    }
  });
  const mark = useCallback(() => {
    setDownloaded(true);
    try {
      sessionStorage.setItem(DL_KEY, '1');
    } catch {
      /* sem armazenamento: vale só até recarregar */
    }
  }, []);
  return [downloaded, mark];
}

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

/**
 * No site: antes de baixar, um estado neutro (sem "aguardando"); depois do clique em Baixar,
 * "Download iniciado" com a luz pulsando, e só então a espera conta para o texto de ajuda.
 */
function AppStatus({ version, downloaded }: { version: string | null; downloaded: boolean }) {
  const { appConnected, setAppConnected, live } = useSession();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (appConnected || !downloaded) return;
    setTimedOut(false);
    const id = window.setTimeout(() => setTimedOut(true), STATUS_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [appConnected, downloaded]);
  const cls = appConnected ? 'ast is-on' : downloaded ? 'ast is-wait' : 'ast';
  const title = appConnected ? t.install.statusConnected(version ?? '') : downloaded ? P.dlTitle : P.idleTitle;
  const help = appConnected ? t.install.statusConnectedHelp : !downloaded ? P.idleHelp : timedOut ? t.install.statusTimeout : P.dlHelp;
  return (
    <div className={cls}>
      <span className="ast-sig" aria-hidden="true" />
      <div className="ast-t">
        <p className="ast-title" role="status" aria-live="polite">
          {title}
        </p>
        <p className="ast-help">{help}</p>
      </div>
      <div className="ast-act">
        {appConnected && (
          <Link to="/#lobbies" className="btn btn-p btn-sm">
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

/** No celular o app não roda: em vez de baixar um .exe no telefone, manda o link para o PC. */
function SendLink() {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';
  async function send() {
    const url = `${window.location.origin}/instalar`;
    if (canShare) {
      try {
        await navigator.share({ title: t.meta.install, url });
      } catch {
        /* a pessoa fechou a folha de compartilhar */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* sem permissão: o endereço continua na barra */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }
  return (
    <>
      <button type="button" className="btn btn-p btn-lg ih-btn" onClick={send}>
        <Icon name={copied ? 'check' : canShare ? 'arrow' : 'copy'} />
        <span>{copied ? P.linkCopied : canShare ? P.sendLink : P.copyLink}</span>
      </button>
      <span className="sr-only" role="status">
        {copied ? P.linkCopied : ''}
      </span>
    </>
  );
}

function DownloadCard({ rel, phone, downloaded, onDownload }: { rel: ReleaseState; phone: boolean; downloaded: boolean; onDownload: () => void }) {
  const { desktop, appConnected } = useSession();
  const r = rel.status === 'ready' ? rel.release : null;
  // Com o app já conectado, baixar de novo vira ação secundária: o próximo passo é escolher um lobby.
  const btn = appConnected ? 'btn btn-s btn-lg ih-btn' : 'btn btn-p btn-lg ih-btn';
  return (
    <>
      <section className="ih is-plain" id="baixar" aria-labelledby="dl-title">
        <BrandSymbol height={168} className="ih-sig" />
        <div className="ih-top">
          {r && (
            <span className="ih-no">
              {t.install.version} <span className="num">{r.version}</span>
            </span>
          )}
          <h1 className="ih-title display" id="dl-title">
            {t.install.titleWords[0]} {t.install.titleWords[1]}
          </h1>
          <span className="ih-sub">{t.install.platformMeta}</span>
        </div>
        {phone && (
          <p className="ih-phone">
            <b>{P.phoneTitle}.</b> {P.phoneHelp}
          </p>
        )}
        <div className="ih-band">
          <div className="ih-file" aria-busy={rel.status === 'loading'}>
            {r ? (
              <>
                <p className="ih-name">{r.fileName}</p>
                <p className="ih-meta">
                  <span className="num">{formatNumber(r.sizeMb)}</span>&nbsp;MB · <time dateTime={r.releasedAt}>{formatDate(r.releasedAt)}</time>
                </p>
              </>
            ) : rel.status === 'loading' ? (
              <p className="ih-meta">{t.install.releaseLoading}</p>
            ) : (
              <p className="ih-meta">{t.install.releaseUnavailable}</p>
            )}
          </div>
          {phone ? (
            <SendLink />
          ) : (
            <a className={btn} href={r ? r.downloadUrl : RELEASES_URL} rel="noopener" onClick={r ? onDownload : undefined}>
              <Icon name="download" />
              <span>{r ? t.install.downloadShort : t.install.openReleases}</span>
            </a>
          )}
        </div>
      </section>

      <div className="ih-hash" id="hash">
        <h2 className="ih-k">{t.install.hashTitle}</h2>
        {r?.sha256 ? (
          <CopyField value={r.sha256} label={t.install.hashTitle} copyLabel={t.install.copyHash} group={8} />
        ) : (
          <p className="ih-help">{rel.status === 'loading' ? t.install.releaseLoading : t.install.hashOnReleases}</p>
        )}
        <p className="ih-src">
          <a className="link" href={r ? r.pageUrl : SOURCE_URL} rel="noopener">
            {r ? t.install.releaseNotes : t.install.source}
          </a>
          {/* espaços duros: no celular a linha vira flex e os espaços comuns somem */}
          <span aria-hidden="true">&nbsp;·&nbsp;</span>
          <a className="link" href={SOURCE_URL} rel="noopener">
            {t.install.sourceCode}
          </a>
        </p>
        {!phone && (
          <p className="ih-help">
            {t.install.hashHelp}{' '}
            <a className="link" href="#conferir">
              {P.howToCheck}
            </a>
          </p>
        )}
      </div>

      {!phone && <div className="ih-status">{desktop ? <AppStatusInApp /> : <AppStatus version={r?.version ?? null} downloaded={downloaded} />}</div>}
      <SheetCard />
    </>
  );
}

/** Abaixo de 960 px o trilho vira folha: este cartão abre o índice e as notas (como na página do modo). */
function SheetCard() {
  const { openSheet } = useRail();
  return (
    <button type="button" className="in-sheet" aria-haspopup="dialog" onClick={(e) => openSheet(e.currentTarget)}>
      <Icon name="rows" />
      <span className="t">
        <b>{P.sheetOpen}</b>
        <span>{P.sheetOpenSub}</span>
      </span>
      <Icon name="chev" />
    </button>
  );
}

function Steps({ downloaded }: { downloaded: boolean }) {
  const { appConnected } = useSession();
  return (
    <section className="sec" id="passos" aria-labelledby="steps-title">
      <SectionTitle id="steps-title" words={t.install.stepsWords} />
      <ol className="isteps">
        {t.install.steps.map((s, i) => {
          const done = appConnected || (downloaded && i === 0);
          const now = !appConnected && downloaded && i === 1;
          return (
            <li key={s.title} className={done ? 'istep is-done' : now ? 'istep is-now' : 'istep'} aria-current={now ? 'step' : undefined}>
              <span className="istep-n" aria-hidden="true">
                {done ? <Icon name="check" /> : romano(i + 1)}
              </span>
              <h3>
                {s.title}
                {done && <span className="sr-only">, {t.install.stepDone}</span>}
                {now && <span className="istep-now">{P.stepNow}</span>}
              </h3>
              <p>{s.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** As duas telas do SmartScreen, desenhadas (sem captura nem marca da Microsoft), com os cliques marcados. */
function SmartScreenFigure({ fileLabel }: { fileLabel: string }) {
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
              {m.app}
              <span className="ss-file">
                <span className="num">{fileLabel}</span>
                <span className="ss-mark num">2</span>
              </span>
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

function AvTabs({ guides }: { guides: AvGuide[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent) {
    const n = guides.length;
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
        {guides.map((g, i) => (
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
      {guides.map((g, i) => (
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

/**
 * Conferir o hash sem comparar 64 caracteres no olho: cola a saída do PowerShell (a linha inteira
 * serve, a página acha o hash nela) e a página diz se bate com o publicado.
 */
function HashCheck({ expected }: { expected: string }) {
  const [value, setValue] = useState('');
  const found = value.match(/[0-9a-f]{64}/i)?.[0].toLowerCase();
  const state = !value.trim() ? 'idle' : !found ? 'invalid' : found === expected ? 'ok' : 'bad';
  const msg = { idle: P.checkHint, invalid: P.checkInvalid, ok: P.checkOk, bad: P.checkBad }[state];
  return (
    <div className={`hck is-${state}`}>
      <label htmlFor="hck-in" className="ins-h">
        {P.checkLabel}
      </label>
      <input
        id="hck-in"
        className="hck-in num"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-describedby="hck-msg"
        aria-invalid={state === 'bad' || state === 'invalid' || undefined}
      />
      <p id="hck-msg" className="hck-msg" role="status">
        {state === 'ok' && <Icon name="check" />}
        {state === 'bad' && <Icon name="x" />}
        {msg}
      </p>
    </div>
  );
}

/** A seção que está no alto da tela, para marcar no índice (a última quando a página chega ao fim). */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? '');
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: string = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) current = id;
      }
      setActive(atEnd ? (ids[ids.length - 1] ?? current) : current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

function InstallRail({ release }: { release: Release | null }) {
  const active = useActiveSection(TOC);
  const appChanges = releases.flatMap((r) =>
    r.changes.filter((c) => c.scope === PLATFORM_SCOPE).map((c) => ({ ...c, version: r.version, date: r.date })),
  );
  // Com a release do GitHub, só notas daquela versão: notas de outra versão ao lado do instalador
  // parecem um instalador trocado. Sem nenhuma, a versão publicada com o link das notas no GitHub.
  const shown = (release ? appChanges.filter((c) => c.version === release.version) : appChanges).slice(0, 4);
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
              <a href={`#${id}`} aria-current={active === id ? 'location' : undefined}>
                {t.install.tocItems[id]}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <section className="rail-sec" aria-labelledby="ir-changes">
        <div className="rail-h">
          <h2 className="cap" id="ir-changes">
            {release ? P.thisVersion : t.install.railChanges}
          </h2>
        </div>
        {shown.length > 0 ? (
          <ul className="mr-changes">
            {shown.map((c) => (
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
        ) : (
          release && (
            <ul className="mr-changes">
              <li>
                <span className="lbl">
                  {t.install.version} <span className="num">{release.version}</span> ·{' '}
                  <time dateTime={release.releasedAt} className="num">
                    {formatShortDate(release.releasedAt)}
                  </time>
                </span>
                <p>{P.thisVersionNotes}</p>
              </li>
            </ul>
          )
        )}
        {release && shown.length === 0 ? (
          <a href={release.pageUrl} className="link mr-more" rel="noopener">
            {P.readNotes}
            <Icon name="arrow" />
          </a>
        ) : (
          <Link to={`/novidades?modo=${PLATFORM_SCOPE}`} className="link mr-more">
            {t.install.railChangesLink}
            <Icon name="arrow" />
          </Link>
        )}
      </section>
    </>
  );
}

export function Install() {
  useDocumentTitle(t.meta.install);
  const { desktop } = useSession();
  // Uma release só para a página toda; sem ela, o padrão do nome no lugar do arquivo.
  const rel = useLatestRelease();
  const r = rel.status === 'ready' ? rel.release : null;
  const fileLabel = r?.fileName ?? P.anyFile;
  const appSize = r ? `${formatNumber(r.sizeMb)} MB` : P.sizeOnRelease;
  const phone = useCannotRunApp() && !desktop;
  const [downloaded, markDownloaded] = useDownloaded();

  return (
    <>
      <DownloadCard rel={rel} phone={phone} downloaded={downloaded} onDownload={markDownloaded} />
      <Steps downloaded={downloaded} />

      <div className="ins">
        <section className="sec" id="windows" aria-labelledby="ss-title">
          <SectionTitle id="ss-title" words={t.install.smartWords} />
          <div className="ss-wrap">
            <div className="ins-text">
              <p>{t.install.smartWhy}</p>
              <ol className="nlist">
                {t.install.smartSteps(r?.fileName ?? null).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <SmartScreenFigure fileLabel={fileLabel} />
          </div>
        </section>

        <section className="sec" id="antivirus" aria-labelledby="av-title">
          <SectionTitle id="av-title" words={t.install.avWords} />
          <div className="ins-text is-wide">
            <p>{t.install.avWhy}</p>
            <AvTabs guides={I.avGuides(fileLabel)} />
            <div className="hck-wrap" id="conferir">
              <h3 className="ins-h">{t.install.avVerify}</h3>
              <CopyField value={I.hashCommand(r?.fileName ?? null)} label={t.install.avVerify} copyLabel={t.install.copyCommand} className="is-cmd" />
              <p className="ins-note">{P.checkPath}</p>
              {r?.sha256 && <HashCheck expected={r.sha256} />}
            </div>
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
                {I.installedItems(appSize).map((it) => (
                  <tr key={it.item}>
                    <th scope="row">{it.item}</th>
                    {/* só caminho de pasta vai no chip de código; "Menu Iniciar" é um lugar, não um caminho */}
                    <td>{it.path.includes('\\') ? <code className="path">{it.path}</code> : <span className="files-place">{it.path}</span>}</td>
                    <td className="files-sz">{it.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="reqs" aria-label={t.install.reqTitle}>
            {t.install.reqs.map((q) => (
              <div key={q.k}>
                <dt className="lbl">{q.k}</dt>
                <dd>{q.v}</dd>
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
                {I.appDoes.map((x) => (
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
                {I.appDoesnt.map((x) => (
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
                <dd>
                  {f.a}
                  {f.link && (
                    <>
                      {' '}
                      <a className="link" href={f.link.href}>
                        {f.link.text}
                      </a>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <Rail title={t.install.sheet}>
        <InstallRail release={r} />
      </Rail>
    </>
  );
}
