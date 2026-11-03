import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BRAND_NAME } from '@web/config/brand';
import { api, errorOf, inApp, on, type AppInfo, type CheckReport, type DaemonState, type EngineError, type SessionInfo } from './api';

/**
 * Tela Instalação do app: mostra, sem esconder nada, o que o app toca neste PC. O binário do
 * motor (caminho e SHA-256), o daemon, o arquivo hosts, as variáveis de ambiente, o jogo e o
 * que fazer quando o antivírus coloca o motor em quarentena. Só lê, exceto ligar/parar o daemon.
 */

const SECTIONS = [
  ['motor', 'Motor'],
  ['daemon', 'Daemon'],
  ['hosts', 'Arquivo hosts'],
  ['ambiente', 'Variáveis'],
  ['jogo', 'Jogo'],
  ['antivirus', 'Antivírus'],
  ['nao-faz', 'O que não faz'],
] as const;

const BLOCK_LINE = '0.0.0.0 hyperline.gg';

const DAEMON_LABEL: Record<DaemonState, string> = {
  rodando: 'Rodando',
  parado: 'Parado',
  socketTravado: 'Socket travado',
};

function formatMb(bytes: number | null) {
  if (bytes == null) return '—';
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

function hashCommand(path: string | null) {
  return `Get-FileHash -LiteralPath "${path ?? 'modlock.exe'}" -Algorithm SHA256`;
}

export function Install() {
  const [app, setApp] = useState<AppInfo | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<null | 'check' | 'start' | 'stop'>('check');
  const [error, setError] = useState<EngineError | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);

  const refresh = useCallback(async () => {
    setBusy('check');
    try {
      const [r, s] = await Promise.all([api.check(), api.session()]);
      setReport(r);
      setSession(s);
      setCheckedAt(new Date());
    } catch (e) {
      setError(errorOf(e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    api.appInfo().then(setApp, () => {});
    void refresh();
    // A sessão muda por eventos (host/join abertos pelo site): reler o estado no fim de cada uma.
    const un = on<{ stream: string }>('engine://event', (ev) => {
      if (ev.stream === 'fim') void refresh();
    });
    return () => {
      void un.then((f) => f());
    };
  }, [refresh]);

  async function daemon(action: 'start' | 'stop') {
    setBusy(action);
    setError(null);
    try {
      await (action === 'start' ? api.daemonStart() : api.daemonStop());
    } catch (e) {
      setError(errorOf(e));
    }
    setBusy(null);
    await refresh();
  }

  const r = report;
  return (
    <div className="ins">
      <header className="ins-head">
        <div className="ins-brand">
          <span className="ins-mark" aria-hidden="true" />
          <span className="display ins-word">{BRAND_NAME}</span>
          <span className="lbl">app desktop {app?.version ?? ''}</span>
        </div>
        <div className="ins-act">
          {checkedAt && (
            <span className="fine" aria-live="polite">
              Verificado às <span className="num">{checkedAt.toLocaleTimeString('pt-BR')}</span>
            </span>
          )}
          <button type="button" className="btn btn-s btn-sm" onClick={() => void refresh()} disabled={busy !== null}>
            {busy === 'check' ? 'Verificando…' : 'Verificar de novo'}
          </button>
        </div>
      </header>

      <main className="ins-main">
        <h1 className="display two ins-title">
          O que o app <em>toca</em>
        </h1>
        <p className="ins-lead">
          Tudo o que este app usa no seu PC, com caminho e hash para você conferir. A tela só lê o estado; a única ação
          aqui é ligar ou parar o daemon do motor.
        </p>
        {!inApp && <p className="ins-note">Prévia fora do app: os dados abaixo são de exemplo.</p>}

        <nav className="ins-toc" aria-label="Seções">
          {SECTIONS.map(([id, name]) => (
            <a key={id} href={`#${id}`} className="lbl">
              {name}
            </a>
          ))}
        </nav>

        <Summary report={r} error={error} />

        {r && (
          <>
            <Section id="motor" title={['O', 'motor']} meta={`Modlock ${r.binary.expectedVersion}, versão fixada`}>
              <dl className="rows">
                <Row k="Executável">
                  {r.binary.path ? <Code copy>{r.binary.path}</Code> : <span className="bad">não encontrado</span>}
                  {r.binary.source && <span className="fine">encontrado por: {r.binary.source}</span>}
                </Row>
                <Row k="Tamanho">
                  <span className="num">{formatMb(r.binary.sizeBytes)}</span>
                </Row>
                <Row k="SHA-256 do arquivo">
                  {r.binary.sha256 ? <Code copy>{r.binary.sha256}</Code> : <span className="fine">—</span>}
                  {r.binary.exists && <Mark ok={r.binary.hashOk} yes="igual ao fixado" no="diferente do fixado: o app não roda este arquivo" />}
                </Row>
                <Row k="SHA-256 fixado">
                  <Code>{r.binary.expectedSha256}</Code>
                </Row>
                <Row k="Versão">
                  <span className="num">{r.binary.version ?? '—'}</span>
                  {r.binary.hashOk && <Mark ok={r.binary.versionOk} yes={`esperada ${r.binary.expectedVersion}`} no={`esperada ${r.binary.expectedVersion}`} />}
                </Row>
                <Row k="Conferir você mesmo">
                  <Code copy>{hashCommand(r.binary.path)}</Code>
                  <span className="fine">No PowerShell. O resultado precisa ser igual ao SHA-256 fixado.</span>
                </Row>
              </dl>
            </Section>

            <Section
              id="daemon"
              title={['O', 'daemon']}
              meta="processo de fundo do motor"
              badge={<StateChip state={r.daemon.state} />}
              actions={
                inApp && r.daemon.state === 'rodando' ? (
                  <button type="button" className="btn btn-s btn-sm" disabled={busy !== null || !!session?.running} onClick={() => void daemon('stop')}>
                    {busy === 'stop' ? 'Parando…' : 'Parar daemon'}
                  </button>
                ) : inApp && r.daemon.state === 'parado' ? (
                  <button type="button" className="btn btn-p btn-sm" disabled={busy !== null || !r.ready} onClick={() => void daemon('start')}>
                    {busy === 'start' ? 'Ligando…' : 'Ligar com a nossa origem'}
                  </button>
                ) : null
              }
            >
              <dl className="rows">
                <Row k="Origem em uso">
                  {r.daemon.status?.origin ? <Code>{r.daemon.status.origin}</Code> : <span className="fine">—</span>}
                  {r.daemon.status && r.daemon.expectedOrigin && (
                    <Mark ok={r.daemon.originOk} yes="a nossa" no="outra origem: o app troca ao hospedar ou entrar" />
                  )}
                </Row>
                <Row k="Origem esperada">
                  {r.daemon.expectedOrigin ? <Code>{r.daemon.expectedOrigin}</Code> : <span className="bad">ENGINE_ORIGIN não definida</span>}
                </Row>
                {r.daemon.status && (
                  <Row k="Processo">
                    <span className="num">PID {r.daemon.status.pid ?? '—'}</span>
                    <span className="fine">
                      desde <span className="num">{r.daemon.status.since ?? '—'}</span> · {r.daemon.status.clients ?? 0} cliente(s) ·{' '}
                      {r.daemon.startedByApp ? 'iniciado por este app' : 'iniciado fora deste app'}
                    </span>
                  </Row>
                )}
                <Row k="Pasta de estado">
                  <Code copy>{r.daemon.stateDir}</Code>
                </Row>
                <Row k="Socket">
                  <Code>{r.daemon.socketPath}</Code>
                  {r.daemon.socketPathTooLong && <span className="bad">caminho longo demais para um socket no Windows</span>}
                </Row>
                <Row k="Log">
                  <Code copy>{r.daemon.logPath}</Code>
                </Row>
              </dl>
              {r.daemon.state === 'socketTravado' && (
                <p className="callout">
                  Há um <code>modlock.sock</code> sobrando de um daemon encerrado à força. O Windows só libera esse arquivo
                  depois de reiniciar o PC. Reinicie, ou aponte <code>ENGINE_STATE_DIR</code> para outra pasta curta.
                </p>
              )}
              <p className="fine">
                O app só para o daemon com <code>modlock daemon stop</code>. Encerrar o processo pelo Gerenciador de
                Tarefas deixa um socket travado até reiniciar o PC.
              </p>
            </Section>

            <Section id="hosts" title={['Arquivo', 'hosts']} meta="opcional">
              <dl className="rows">
                <Row k="Caminho">
                  <Code>{r.hosts.path}</Code>
                  {!r.hosts.readable && <span className="bad">não foi possível ler</span>}
                </Row>
                <Row k={`Bloqueio do ${r.hosts.host}`}>
                  {r.hosts.lines.length > 0 ? r.hosts.lines.map((l) => <Code key={l}>{l}</Code>) : <span className="fine">nenhuma linha</span>}
                  <Mark ok={r.hosts.blocked} yes="ativo" no="não está bloqueado" soft />
                </Row>
                <Row k="Linha para adicionar">
                  <Code copy>{BLOCK_LINE}</Code>
                </Row>
              </dl>
              <p className="fine">
                Serve para provar que nada passa pelo {r.hosts.host}. O app só lê este arquivo: editar exige
                administrador, então é você quem adiciona a linha, se quiser.
              </p>
            </Section>

            <Section id="ambiente" title={['Variáveis de', 'ambiente']} meta="lidas e definidas pelo app">
              <table className="envt">
                <thead>
                  <tr>
                    <th className="lbl">Nome</th>
                    <th className="lbl">Valor</th>
                    <th className="lbl">Para quê</th>
                  </tr>
                </thead>
                <tbody>
                  {r.env.map((e) => (
                    <tr key={e.name}>
                      <td>
                        <code className="mono">{e.name}</code>
                        <span className="fine">{e.scope === 'app' ? 'lida pelo app' : 'definida pelo app no motor'}</span>
                      </td>
                      <td>{e.value ? <code className="mono">{e.value}</code> : <span className="fine">não definida</span>}</td>
                      <td className="fine">{e.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section id="jogo" title={['O', 'jogo']} meta={r.game.exe}>
              <dl className="rows">
                <Row k="Deadlock">
                  {r.game.running ? (
                    <span className="bad">
                      aberto (PID <span className="num">{r.game.pids.join(', ')}</span>)
                    </span>
                  ) : (
                    <span>fechado</span>
                  )}
                </Row>
              </dl>
              <p className="fine">
                Para carregar um modo, o Deadlock precisa estar fechado: com o jogo aberto, o <code>gameinfo.gi</code> fica
                travado e o conteúdo não monta. O app confere isso antes de hospedar ou entrar.
              </p>
            </Section>

            <Section id="antivirus" title={['Se o antivírus', 'apagou o motor']} meta="falso positivo">
              <ol className="steps">
                <li>
                  Abra a quarentena. No Windows: <b>Segurança do Windows</b>, <b>Proteção contra vírus e ameaças</b>,{' '}
                  <b>Histórico de proteção</b>. No Kaspersky: <b>Segurança</b>, <b>Quarentena</b>.
                </li>
                <li>
                  Restaure o <code>modlock.exe</code> e confira o SHA-256 com o comando da seção Motor. Se não for igual
                  ao fixado, não use: baixe de novo.
                </li>
                <li>
                  Adicione exclusões para a pasta do executável e para <code>%LOCALAPPDATA%\modlock</code>.
                </li>
                <li>Volte aqui e clique em Verificar de novo.</li>
              </ol>
              <p className="fine">
                Por que acontece: o motor carrega bibliotecas do próprio jogo e abre conexões diretas entre PCs, o que
                algumas heurísticas acham suspeito. O app inicia processos do jeito comum do Windows, nunca por WMI,
                para não somar mais um alerta.
              </p>
            </Section>

            <Section id="nao-faz" title={['O que o app', 'não faz']}>
              <ul className="nots">
                <li>Não roda o <code>modlock.exe</code> se o hash não for o fixado.</li>
                <li>Não encerra o daemon à força; só pede para ele parar.</li>
                <li>Não usa o hyperline.gg: o daemon sobe sempre com a nossa origem.</li>
                <li>Não edita o arquivo hosts nem arquivos do jogo.</li>
                <li>
                  Não registra o link <code>{app?.scheme ?? 'lobby'}://</code> no Windows sozinho: até existir o instalador,
                  isso só acontece com <code>APP_REGISTER_SCHEME=1</code>.
                </li>
                <li>Não fica aberto em segundo plano: fechar a janela do site fecha o app e para o que ele ligou.</li>
              </ul>
            </Section>

            {session && (
              <p className="fine ins-session">
                Sessão {session.kind === 'host' ? 'hospedada' : 'de entrada'} {session.running ? 'rodando' : 'encerrada'} · PID{' '}
                <span className="num">{session.pid}</span>
                {session.joinCode && (
                  <>
                    {' '}
                    · código <span className="num">{session.joinCode}</span>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Summary({ report, error }: { report: CheckReport | null; error: EngineError | null }) {
  if (!report && !error) return <p className="sum">Verificando…</p>;
  const problems = [...(error ? [error] : []), ...(report?.problems ?? [])];
  const ok = !!report?.ready && problems.length === 0;
  return (
    <section className={ok ? 'sum is-ok' : 'sum'} aria-live="polite">
      <span className="sum-sig" aria-hidden="true" />
      <div>
        <p className="sum-t">
          {ok
            ? 'Tudo certo para hospedar e entrar.'
            : report?.ready
              ? 'Pronto, com avisos.'
              : problems.length === 1
                ? '1 ponto para resolver.'
                : `${problems.length} pontos para resolver.`}
        </p>
        {problems.length > 0 && (
          <ul className="sum-l">
            {problems.map((p) => (
              <li key={p.code + p.message}>{p.message}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Section({
  id,
  title,
  meta,
  badge,
  actions,
  children,
}: {
  id: string;
  title: readonly [string, string];
  meta?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="isec" id={id} aria-labelledby={`${id}-t`}>
      <div className="isec-h">
        <h2 className="display two" id={`${id}-t`}>
          {title[0]} <em>{title[1]}</em>
        </h2>
        {badge}
        {meta && <span className="lbl">{meta}</span>}
        <span className="sp" />
        {actions}
      </div>
      {children}
    </section>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="row">
      <dt className="lbl">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Code({ children, copy = false }: { children: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* sem permissão: o texto continua selecionável */
    }
  }
  return (
    <span className="code">
      <code className="mono">{children}</code>
      {copy && (
        <button type="button" className="btn btn-g btn-sm code-cp" onClick={() => void doCopy()}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
    </span>
  );
}

function Mark({ ok, yes, no, soft = false }: { ok: boolean; yes: string; no: string; soft?: boolean }) {
  return <span className={ok ? 'mark is-ok' : soft ? 'mark is-soft' : 'mark is-bad'}>{ok ? yes : no}</span>;
}

function StateChip({ state }: { state: DaemonState }) {
  return <span className={`state state-${state}`}>{DAEMON_LABEL[state]}</span>;
}
