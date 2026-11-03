import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { BRAND_NAME } from '@web/config/brand';
import {
  api,
  errorOf,
  inApp,
  on,
  openedBy as openedByAtLoad,
  type AppInfo,
  type CheckReport,
  type DaemonState,
  type EngineError,
  type SessionInfo,
} from './api';
import { followThemeChanges } from './theme-sync';

/**
 * Tela Instalação do app: mostra, sem esconder nada, o que o app toca neste PC. O binário do
 * motor (caminho e SHA-256), o serviço do motor (o daemon do Modlock), o arquivo hosts, as
 * variáveis de ambiente, o jogo e o que fazer quando o antivírus coloca o motor em quarentena.
 * Só lê, exceto ligar/parar o serviço.
 *
 * Cada seção tem um chip de estado. As que têm problema sobem para o topo com tudo aberto; nas que
 * estão em ordem, o técnico (pastas, log, variáveis, hosts) fica atrás de "Ver detalhes". Os hashes
 * ficam sempre à vista: são eles que dão para conferir o motor.
 *
 * Problemas aparecem em duas camadas: a frase para quem joga (`message`) e, num "Detalhes
 * técnicos" fechado, o código estável e o `detail` (variável, caminho, saída do Modlock).
 */

const BLOCK_LINE = '0.0.0.0 hyperline.gg';

/** Códigos que impedem hospedar e entrar (o resto é aviso). Iguais ao `ready` do Rust. */
const BLOCKING = new Set([
  'binario_ausente',
  'binario_sumiu',
  'hash_diferente',
  'versao_errada',
  'origem_ausente',
  'origem_invalida',
  'socket_travado',
  'socket_caminho_longo',
]);

/** Onde, nesta tela, fica o passo a passo de cada problema. */
const PROBLEM_LINK: Record<string, { href: string; label: string }> = {
  binario_sumiu: { href: '#antivirus', label: 'Ver como restaurar da quarentena' },
  binario_ausente: { href: '#antivirus', label: 'Se o antivírus apagou o arquivo' },
  hash_diferente: { href: '#motor', label: 'Ver o hash do arquivo' },
  processo: { href: '#antivirus', label: 'Ver os passos do antivírus' },
  daemon_nao_subiu: { href: '#antivirus', label: 'Ver os passos do antivírus' },
};

const DAEMON_LABEL: Record<DaemonState, string> = {
  rodando: 'Ligado',
  parado: 'Desligado',
  socketTravado: 'Travado',
};

const ACTION_LABEL = { start: 'ligar', stop: 'parar' } as const;

type Action = keyof typeof ACTION_LABEL;
type Say = (msg: string) => void;

/** Uma região `role="status"` só, para a tela toda (checagem, serviço, "Copiado"). */
const Announce = createContext<Say>(() => {});

function formatMb(bytes: number | null) {
  if (bytes == null) return '—';
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

function hashCommand(path: string | null) {
  return `Get-FileHash -LiteralPath "${path ?? 'modlock.exe'}" -Algorithm SHA256`;
}

function joinPath(dir: string | null, file: string) {
  return dir ? `${dir.replace(/[\\/]+$/, '')}\\${file}` : file;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/** Frase curta do resultado da checagem, para o título do resumo e para o anúncio. */
function headline(report: CheckReport | null, checkError: EngineError | null, actionFailed: boolean) {
  if (checkError) return 'Não deu para verificar a instalação.';
  if (!report) return 'Verificando…';
  const blocking = report.problems.filter((p) => BLOCKING.has(p.code)).length;
  const warnings = report.problems.length - blocking;
  if (!report.ready) {
    return blocking > 0 ? `${plural(blocking, 'ponto impede', 'pontos impedem')} hospedar e entrar.` : 'Ainda não dá para hospedar nem entrar.';
  }
  if (warnings > 0) return `Pronto para hospedar e entrar, com ${plural(warnings, 'aviso', 'avisos')}.`;
  return actionFailed ? 'A instalação está certa, mas a última ação falhou.' : 'Tudo certo para hospedar e entrar.';
}

type Tone = 'ok' | 'warn' | 'idle';

/** Uma seção da tela: com problema, sobe para o topo e abre os detalhes. */
interface Block {
  id: string;
  /** Nome curto para a navegação. */
  name: string;
  problem: boolean;
  /** Entre as seções com problema, vem primeiro (a recuperação do antivírus com o motor fora do disco). */
  lead?: boolean;
  node: ReactNode;
}

const AV_CODES = new Set(['binario_sumiu', 'binario_ausente', 'processo', 'daemon_nao_subiu']);
const ENV_CODES = new Set(['origem_ausente', 'origem_invalida', 'socket_caminho_longo']);

export function Install() {
  const [app, setApp] = useState<AppInfo | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<null | 'check' | Action>('check');
  /** A checagem em si falhou (não confundir com os problemas que ela encontrou). */
  const [checkError, setCheckError] = useState<EngineError | null>(null);
  /** Ligar/parar o serviço falhou. Fica até a próxima ação, um "Verificar de novo" ou um sucesso. */
  const [actionError, setActionError] = useState<{ action: Action; error: EngineError } | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [openedBy, setOpenedBy] = useState<string | null>(openedByAtLoad);
  const [status, setStatus] = useState<{ n: number; msg: string }>({ n: 0, msg: '' });

  const say = useCallback<Say>((msg) => setStatus((s) => ({ n: s.n + 1, msg })), []);

  useEffect(() => followThemeChanges(), []);

  const refresh = useCallback(async (): Promise<{ report: CheckReport | null; error: EngineError | null }> => {
    setBusy('check');
    setCheckError(null);
    try {
      const [r, s] = await Promise.all([api.check(), api.session()]);
      setReport(r);
      setSession(s);
      setCheckedAt(new Date());
      return { report: r, error: null };
    } catch (e) {
      const err = errorOf(e);
      setCheckError(err);
      return { report: null, error: err };
    } finally {
      setBusy(null);
    }
  }, []);

  const check = useCallback(async () => {
    setActionError(null);
    const res = await refresh();
    say(res.error ? `Não deu para verificar a instalação. ${res.error.message}` : `Verificação concluída. ${headline(res.report, null, false)}`);
  }, [refresh, say]);

  useEffect(() => {
    api.appInfo().then(setApp, () => {});
    void check();
    // A sessão muda por eventos (host/join abertos pelo site): reler o estado no fim de cada uma.
    const un = on<{ stream: string }>('engine://event', (ev) => {
      if (ev.stream === 'fim') void refresh();
    });
    const unOpened = on<string>('install://opened-by', (reason) => {
      setOpenedBy(reason);
      void check();
    });
    return () => {
      void un.then((f) => f());
      void unOpened.then((f) => f());
    };
  }, [check, refresh]);

  async function daemon(action: Action) {
    if (busy !== null || !inApp) return;
    setBusy(action);
    setActionError(null);
    let failed: EngineError | null = null;
    try {
      await (action === 'start' ? api.daemonStart() : api.daemonStop());
    } catch (e) {
      failed = errorOf(e);
      setActionError({ action, error: failed });
    }
    const res = await refresh();
    if (failed) {
      say(`Não deu para ${ACTION_LABEL[action]} o serviço do motor. ${failed.message}`);
    } else if (res.report) {
      say(`Serviço do motor ${DAEMON_LABEL[res.report.daemon.state].toLowerCase()}.`);
    }
  }

  const r = report;
  const blocks: Block[] = r ? buildBlocks({ r, session, busy, actionError, onAct: (a) => void daemon(a), onCheck: () => busy === null && void check() }) : [];
  // Problemas primeiro (a recuperação do antivírus na frente, se o motor sumiu), depois o resto na
  // ordem de sempre. "O que o app não faz" fica sempre por último.
  const rank = (s: Block) => (s.problem ? (s.lead ? 0 : 1) : 2);
  const ordered = blocks.map((s, i) => ({ s, i })).sort((a, z) => rank(a.s) - rank(z.s) || a.i - z.i).map((x) => x.s);

  return (
    <Announce.Provider value={say}>
      <div className="ins">
        <header className="ins-head">
          <div className="ins-brand">
            <span className="ins-mark" aria-hidden="true" />
            <span className="display ins-word">{BRAND_NAME}</span>
            <span className="lbl">app desktop {app?.version ?? ''}</span>
          </div>
          <div className="ins-act">
            {checkedAt && (
              <span className="fine">
                Verificado às <span className="num">{checkedAt.toLocaleTimeString('pt-BR')}</span>
              </span>
            )}
            <button type="button" className="btn btn-s btn-sm" onClick={() => busy === null && void check()} aria-disabled={busy !== null}>
              {busy === 'check' ? 'Verificando…' : 'Verificar de novo'}
            </button>
          </div>
        </header>

        <p role="status" className="sr-only">
          <span key={status.n}>{status.msg}</span>
        </p>

        <main className="ins-main">
          {openedBy === 'checagem' && (
            <p className="ins-why">
              {r && r.ready
                ? 'Abrimos esta tela porque a checagem feita ao abrir o app encontrou um problema. Agora está tudo certo para hospedar e entrar.'
                : 'Abrimos esta tela porque a checagem feita ao abrir o app encontrou algo que impede hospedar ou entrar. O resumo abaixo diz o quê e como resolver.'}
            </p>
          )}
          <h1 className="display two ins-title">
            O que o app <em>toca</em>
          </h1>
          <p className="ins-lead">
            Tudo o que este app usa no seu PC, com caminho e hash para você conferir. A tela só lê o estado; a única ação aqui é ligar ou parar o serviço do
            motor.
          </p>
          {!inApp && <p className="ins-note">Prévia fora do app: os dados abaixo são de exemplo.</p>}

          <Summary report={r} checkError={checkError} actionError={actionError} />

          {ordered.length > 0 && (
            <nav className="ins-toc" aria-label="Seções">
              {ordered.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={s.problem ? 'is-pb' : undefined}>
                  {s.name}
                  {s.problem && <span className="sr-only"> (precisa de atenção)</span>}
                </a>
              ))}
              <a href="#nao-faz">O que não faz</a>
            </nav>
          )}

          {ordered.map((s) => (
            <Fragment key={s.id}>{s.node}</Fragment>
          ))}

          {r && (
            <Section id="nao-faz" title={<>O que o app <em>não faz</em></>}>
              <ul className="nots">
                <li>
                  Não roda o <code>modlock.exe</code> se o hash não for o fixado.
                </li>
                <li>Não encerra o serviço do motor à força; só pede para ele parar.</li>
                <li>Não usa o hyperline.gg: o serviço do motor sobe sempre com o nosso servidor.</li>
                <li>Não edita o arquivo hosts nem arquivos do jogo.</li>
                <li>
                  Não registra o link <code>{app?.scheme ?? 'lobby'}://</code> no Windows sozinho: até existir o instalador, isso só acontece com{' '}
                  <code>APP_REGISTER_SCHEME=1</code>.
                </li>
                <li>
                  Não fica aberto em segundo plano: o ícone na bandeja é só um atalho enquanto a janela do site está aberta. Fechar essa janela fecha o app e para
                  o que ele ligou.
                </li>
              </ul>
            </Section>
          )}

          {session && (
            <p className="fine ins-session">
              Partida {session.kind === 'host' ? 'hospedada' : 'de entrada'} {session.running ? 'em andamento' : 'encerrada'}
              {session.joinCode && (
                <>
                  {' '}
                  · código <span className="num">{session.joinCode}</span>
                </>
              )}{' '}
              · PID <span className="num">{session.pid}</span>
            </p>
          )}
        </main>
      </div>
    </Announce.Provider>
  );
}

/** Monta as seções com o estado de cada uma (chip, problema e o que fica atrás de "Ver detalhes"). */
function buildBlocks({
  r,
  session,
  busy,
  actionError,
  onAct,
  onCheck,
}: {
  r: CheckReport;
  session: SessionInfo | null;
  busy: null | 'check' | Action;
  actionError: { action: Action; error: EngineError } | null;
  onAct: (a: Action) => void;
  onCheck: () => void;
}): Block[] {
  const b = r.binary;
  const codes = new Set(r.problems.map((p) => p.code));
  if (actionError) codes.add(actionError.error.code);
  /** O motor não está no disco: a recuperação (antivírus) sobe para o topo. */
  const motorMissing = !b.exists;

  const motorProblem = !b.exists || !b.hashOk || !b.versionOk;
  const motorChip: [Tone, string] = !b.exists
    ? ['warn', 'Não encontrado']
    : !b.hashOk
      ? ['warn', 'Hash diferente']
      : !b.versionOk
        ? ['warn', 'Versão errada']
        : ['ok', 'Conferido'];

  const d = r.daemon;
  const svcProblem = d.state === 'socketTravado' || d.socketPathTooLong || !!actionError;

  const hostsChip: [Tone, string] = !r.hosts.readable ? ['warn', 'Não deu para ler'] : r.hosts.blocked ? ['ok', 'Bloqueado'] : ['idle', 'Sem bloqueio'];

  const envProblem = [...ENV_CODES].some((c) => codes.has(c));
  const avProblem = [...AV_CODES].some((c) => codes.has(c));

  return [
    {
      id: 'motor',
      name: 'Motor',
      problem: motorProblem,
      node: (
        <Section id="motor" title="O motor" chip={<Chip tone={motorChip[0]}>{motorChip[1]}</Chip>} meta={`Modlock ${b.expectedVersion}, versão fixada`}>
          <dl className="rows">
            <Row k="Executável">
              {b.path ? (
                <Code copy label="caminho do executável">
                  {b.path}
                </Code>
              ) : (
                b.folder && (
                  <Code copy label="pasta do app">
                    {b.folder}
                  </Code>
                )
              )}
              {b.exists ? (
                b.source && <span className="fine">encontrado por: {b.source}</span>
              ) : b.vanished ? (
                <span className="bad">
                  não encontrado: o arquivo estava aqui e sumiu, provavelmente em quarentena no antivírus. <a href="#antivirus">Como restaurar</a>
                </span>
              ) : b.path ? (
                <span className="bad">não encontrado neste caminho</span>
              ) : (
                <span className="bad">não encontrado{b.folder ? ' na pasta do app' : ''}</span>
              )}
            </Row>
            <Row k="Tamanho">
              <span className="num">{formatMb(b.sizeBytes)}</span>
            </Row>
            <Row k="SHA-256 do arquivo">
              {b.sha256 ? (
                <Code copy hash label="SHA-256 do arquivo">
                  {b.sha256}
                </Code>
              ) : (
                <span className="fine">—</span>
              )}
              {b.exists && <Mark ok={b.hashOk} yes="igual ao fixado" no="diferente do fixado: o app não roda este arquivo" />}
            </Row>
            <Row k="SHA-256 fixado">
              <Code copy hash label="SHA-256 fixado">
                {b.expectedSha256}
              </Code>
            </Row>
            <Row k="Versão">
              <span className="num">{b.version ?? '—'}</span>
              {b.hashOk && <Mark ok={b.versionOk} yes={`esperada ${b.expectedVersion}`} no={`esperada ${b.expectedVersion}`} />}
            </Row>
            <Row k="Conferir por conta própria">
              <Code copy label="comando Get-FileHash">
                {hashCommand(b.path ?? (b.folder ? joinPath(b.folder, 'modlock.exe') : null))}
              </Code>
              <span className="fine">No PowerShell. O resultado precisa ser igual ao SHA-256 fixado.</span>
            </Row>
          </dl>
        </Section>
      ),
    },
    {
      id: 'servico',
      name: 'Serviço do motor',
      problem: svcProblem,
      node: (
        <Section
          id="servico"
          title="O serviço do motor"
          chip={<StateChip state={d.state} />}
          meta="modlock daemon, roda em segundo plano"
          actions={<DaemonButton report={r} session={session} busy={busy} onAct={onAct} />}
        >
          {actionError && (
            <div className="act-err" id="servico-err">
              <p className="act-err-t">{actionError.action === 'start' ? 'Não deu para ligar o serviço do motor.' : 'Não deu para parar o serviço do motor.'}</p>
              <Problem p={actionError.error} />
            </div>
          )}
          {d.state === 'socketTravado' && (
            <div className="callout">
              <p>
                O serviço anterior foi fechado à força e deixou o arquivo de conexão (<code>modlock.sock</code>) preso. O Windows só libera esse arquivo ao
                reiniciar: reinicie o PC e abra o app de novo.
              </p>
              <Tech code="socket_travado">
                Sem reiniciar: aponte <code>ENGINE_STATE_DIR</code> para outra pasta curta (por exemplo <code>C:\Users\&lt;nome&gt;\.ml</code>).
              </Tech>
            </div>
          )}
          <dl className="rows">
            <Row k="Servidor em uso">
              {d.status?.origin ? <Code>{d.status.origin}</Code> : <span className="fine">{d.state === 'rodando' ? '—' : 'nenhum: o serviço está desligado'}</span>}
              {d.status && d.expectedOrigin && <Mark ok={d.originOk} yes="o nosso" no="outro servidor: o app troca ao hospedar ou entrar" />}
            </Row>
            <Row k="Servidor esperado">
              {d.expectedOrigin ? (
                <Code>{d.expectedOrigin}</Code>
              ) : (
                <>
                  <span className="bad">não configurado nesta cópia do app</span>
                  <span className="fine">
                    <code>ENGINE_ORIGIN</code> não definida
                  </span>
                </>
              )}
            </Row>
            {d.status && (
              <Row k="Processo">
                <span className="num">PID {d.status.pid ?? '—'}</span>
                <span className="fine">
                  desde <span className="num">{d.status.since ?? '—'}</span> · {d.status.clients ?? 0} cliente(s) ·{' '}
                  {d.startedByApp ? 'iniciado por este app' : 'iniciado fora deste app'}
                </span>
              </Row>
            )}
          </dl>
          <More section="servico" open={d.state === 'socketTravado' || d.socketPathTooLong} label="Ver pastas e log">
            <dl className="rows">
              <Row k="Pasta de dados">
                <Code copy label="pasta de dados do serviço">
                  {d.stateDir}
                </Code>
                <span className="fine">trava, arquivo de conexão e log do serviço</span>
              </Row>
              <Row k="Arquivo de conexão">
                <Code>{d.socketPath}</Code>
                {d.socketPathTooLong && <span className="bad">caminho longo demais para o Windows: o serviço não liga</span>}
              </Row>
              <Row k="Log">
                <Code copy label="caminho do log">
                  {d.logPath}
                </Code>
              </Row>
            </dl>
            <p className="fine">
              O app só para o serviço com <code>modlock daemon stop</code>. Encerrar o processo pelo Gerenciador de Tarefas deixa o arquivo de conexão preso até
              reiniciar o PC.
            </p>
          </More>
        </Section>
      ),
    },
    {
      id: 'hosts',
      name: 'Arquivo hosts',
      problem: !r.hosts.readable,
      node: (
        <Section id="hosts" title="Arquivo hosts" chip={<Chip tone={hostsChip[0]}>{hostsChip[1]}</Chip>} meta="opcional">
          <p className="isec-say">
            {r.hosts.blocked
              ? `O ${r.hosts.host} está bloqueado neste PC: dá para provar que nada passa por ele.`
              : `Opcional: bloquear o ${r.hosts.host} no arquivo hosts prova que nada passa por ele.`}
          </p>
          <More section="hosts" open={!r.hosts.readable}>
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
                <Code copy label="linha do arquivo hosts">
                  {BLOCK_LINE}
                </Code>
              </Row>
            </dl>
            <p className="fine">O app só lê este arquivo: editar exige administrador, então é você quem adiciona a linha, se quiser.</p>
          </More>
        </Section>
      ),
    },
    {
      id: 'ambiente',
      name: 'Variáveis',
      problem: envProblem,
      node: (
        <Section
          id="ambiente"
          title="Variáveis de ambiente"
          chip={<Chip tone={envProblem ? 'warn' : 'ok'}>{envProblem ? 'Revisar' : 'Em ordem'}</Chip>}
          meta="lidas e definidas pelo app"
        >
          <More section="ambiente" open={envProblem} label={`Ver as ${r.env.length} variáveis`}>
            <table className="envt">
              <thead>
                <tr>
                  <th scope="col" className="lbl">
                    Nome
                  </th>
                  <th scope="col" className="lbl">
                    Valor
                  </th>
                  <th scope="col" className="lbl">
                    Para quê
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.env.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <code className="mono">{breakable(e.name)}</code>
                      <span className="fine">{e.scope === 'app' ? 'lida pelo app' : 'definida pelo app no motor'}</span>
                    </td>
                    <td>{e.value ? <code className="mono">{breakable(e.value)}</code> : <span className="fine">não definida</span>}</td>
                    <td className="fine">{e.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </More>
        </Section>
      ),
    },
    {
      id: 'jogo',
      name: 'Jogo',
      problem: r.game.running,
      node: (
        <Section id="jogo" title="O jogo" chip={<Chip tone={r.game.running ? 'warn' : 'ok'}>{r.game.running ? 'Aberto' : 'Fechado'}</Chip>} meta={r.game.exe}>
          {r.game.running && (
            <dl className="rows">
              <Row k="Deadlock">
                <span className="bad">
                  aberto (PID <span className="num">{r.game.pids.join(', ')}</span>): feche o jogo antes de hospedar ou entrar
                </span>
              </Row>
            </dl>
          )}
          <p className="fine">
            Para carregar um modo, o Deadlock precisa estar fechado: com o jogo aberto, o <code>gameinfo.gi</code> fica travado e o conteúdo não monta. O app
            confere isso antes de hospedar ou entrar.
          </p>
        </Section>
      ),
    },
    {
      id: 'antivirus',
      name: 'Antivírus',
      problem: avProblem,
      lead: motorMissing,
      node: <Antivirus report={r} first={motorMissing} open={avProblem} onCheck={onCheck} busy={busy !== null} />,
    },
  ];
}

/**
 * Um botão só, no mesmo lugar, para ligar e parar: ao trocar de Parar para Ligar (e durante a
 * espera) ele continua sendo o mesmo elemento, sem `disabled`, então o foco do teclado fica nele.
 * O motivo de não dar para usar aparece ao lado, visível, e entra no nome acessível.
 */
function DaemonButton({
  report,
  session,
  busy,
  onAct,
}: {
  report: CheckReport;
  session: SessionInfo | null;
  busy: null | 'check' | Action;
  onAct: (a: Action) => void;
}) {
  const state = report.daemon.state;
  const running = state === 'rodando';
  const action: Action = running ? 'stop' : 'start';
  const why = !inApp
    ? 'Na prévia, ligar e parar só funcionam dentro do app.'
    : busy !== null
      ? null
      : running
        ? session?.running
          ? 'Encerre a partida no site antes de parar o serviço.'
          : null
        : state === 'socketTravado'
          ? 'Reinicie o PC antes de ligar: o serviço anterior deixou um arquivo preso.'
          : !report.ready
            ? 'Resolva os pontos do resumo antes de ligar.'
            : null;
  const blocked = busy !== null || why !== null;
  const label = busy === 'start' ? 'Ligando…' : busy === 'stop' ? 'Parando…' : running ? 'Parar o serviço' : 'Ligar o serviço';
  return (
    <div className="svc-act">
      {why && (
        <span className="fine svc-why" id="servico-why">
          {why}
        </span>
      )}
      <button
        type="button"
        className={running ? 'btn btn-s btn-sm' : 'btn btn-p btn-sm'}
        aria-disabled={blocked}
        aria-describedby={why ? 'servico-why' : undefined}
        onClick={() => !blocked && onAct(action)}
      >
        {label}
      </button>
    </div>
  );
}

function Summary({
  report,
  checkError,
  actionError,
}: {
  report: CheckReport | null;
  checkError: EngineError | null;
  actionError: { action: Action; error: EngineError } | null;
}) {
  if (!report && !checkError) {
    return (
      <section className="sum" aria-busy="true">
        <span className="sum-sig is-wait" aria-hidden="true" />
        <p className="sum-t">Verificando…</p>
      </section>
    );
  }
  const problems = report?.problems ?? [];
  const blocking = problems.filter((p) => BLOCKING.has(p.code));
  const warnings = problems.filter((p) => !BLOCKING.has(p.code));
  const ok = !!report?.ready && problems.length === 0 && !checkError && !actionError;
  return (
    <section className={ok ? 'sum is-ok' : 'sum'} aria-labelledby="sum-t">
      <span className="sum-sig" aria-hidden="true" />
      <div className="sum-b">
        <p className="sum-t" id="sum-t">
          {headline(report, checkError, !!actionError)}
        </p>
        {checkError && <Problem p={checkError} />}
        {actionError && (
          <div className="sum-act">
            <p className="sum-kind">
              Ação que falhou: {actionError.action === 'start' ? 'ligar o serviço do motor' : 'parar o serviço do motor'}.{' '}
              <a href="#servico">Ver no serviço do motor</a>
            </p>
          </div>
        )}
        {blocking.length > 0 && (
          <ul className="sum-l">
            {blocking.map((p) => (
              <li key={p.code + p.message}>
                <Problem p={p} />
              </li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="sum-l is-warn" aria-label="Avisos, que não impedem hospedar e entrar">
            {warnings.map((p) => (
              <li key={p.code + p.message}>
                <Problem p={p} tag="aviso" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** A frase para quem joga, o link para o passo a passo nesta tela e o técnico à parte. */
function Problem({ p, tag }: { p: EngineError; tag?: string }) {
  const link = PROBLEM_LINK[p.code];
  return (
    <div className="pb">
      <p className="pb-m">
        {tag && <span className="pb-tag">{tag}</span>}
        {p.message}
        {link && (
          <>
            {' '}
            <a href={link.href}>{link.label}</a>
          </>
        )}
      </p>
      <Tech code={p.code}>{p.detail}</Tech>
    </div>
  );
}

function Tech({ code, children }: { code: string; children?: ReactNode }) {
  return (
    <details className="tech">
      <summary>Detalhes técnicos</summary>
      <p>
        <code className="tech-code">{code}</code>
        {children && <> {children}</>}
      </p>
    </details>
  );
}

function Antivirus({
  report,
  first,
  open,
  onCheck,
  busy,
}: {
  report: CheckReport;
  first: boolean;
  open: boolean;
  onCheck: () => void;
  busy: boolean;
}) {
  const b = report.binary;
  const exe = b.path ?? joinPath(b.folder, 'modlock.exe');
  const downloads = report.downloadDir;
  const steps = (
    <>
      <ol className="steps">
        <li>
          Abra a quarentena. No Windows: <b>Segurança do Windows</b>, <b>Proteção contra vírus e ameaças</b>, <b>Histórico de proteção</b>. No Kaspersky:{' '}
          <b>Segurança</b>, <b>Quarentena</b>.
        </li>
        <li>
          <p>
            Restaure o <code>modlock.exe</code>. Ele precisa voltar para este caminho:
          </p>
          <div>
            <Code copy label="caminho para restaurar o modlock.exe">
              {exe}
            </Code>
          </div>
          <p>
            Depois confira o SHA-256 com o comando da seção <a href="#motor">Motor</a>. Se não for igual ao fixado, não use o arquivo.
          </p>
        </li>
        <li>
          <p>Adicione exclusões no antivírus para estas duas pastas:</p>
          <dl className="av-paths">
            <div>
              <dt>pasta do motor</dt>
              <dd>
                {b.folder ? (
                  <Code copy label="pasta do motor">
                    {b.folder}
                  </Code>
                ) : (
                  <span className="fine">a pasta onde fica o modlock.exe</span>
                )}
              </dd>
            </div>
            <div>
              <dt>downloads do Modlock (servidor do jogo)</dt>
              <dd>
                <Code copy label="pasta de downloads do Modlock">
                  {downloads ?? '%LOCALAPPDATA%\\modlock'}
                </Code>
              </dd>
            </div>
          </dl>
        </li>
        <li>
          <p>Volte aqui e verifique de novo.</p>
          {open && (
            <div>
              <button type="button" className="btn btn-s btn-sm" aria-disabled={busy} onClick={onCheck}>
                {busy ? 'Verificando…' : 'Verificar de novo'}
              </button>
            </div>
          )}
        </li>
      </ol>
      <p className="fine">
        Por que acontece: o motor carrega bibliotecas do próprio jogo e abre conexões diretas entre PCs, o que algumas heurísticas acham suspeito. O app inicia
        processos do jeito comum do Windows, nunca por WMI, para não somar mais um alerta. A pasta de dados do serviço (<code>{report.daemon.stateDir}</code>)
        guarda só a trava, o arquivo de conexão e o log.
      </p>
    </>
  );
  return (
    <Section
      id="antivirus"
      title="Se o antivírus apagou o motor"
      chip={<Chip tone={open ? 'warn' : 'idle'}>{open ? 'Ação necessária' : 'Só se precisar'}</Chip>}
      meta={first ? (b.vanished ? 'o modlock.exe sumiu desta pasta' : 'o modlock.exe não está neste PC') : 'falso positivo'}
      className={open ? 'is-first' : undefined}
    >
      {open ? (
        steps
      ) : (
        <>
          <p className="isec-say">Alguns antivírus colocam o modlock.exe em quarentena por engano. Se acontecer, os passos para restaurar estão aqui.</p>
          <More section="antivirus" open={false} label="Ver os passos">
            {steps}
          </More>
        </>
      )}
    </Section>
  );
}

function Section({
  id,
  title,
  meta,
  chip,
  actions,
  className,
  children,
}: {
  id: string;
  title: ReactNode;
  meta?: string;
  chip?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `isec ${className}` : 'isec'} id={id} aria-labelledby={`${id}-t`}>
      <div className="isec-h">
        <h2 className="display two" id={`${id}-t`}>
          {title}
        </h2>
        {chip}
        {meta && <span className="lbl">{meta}</span>}
        <span className="sp" />
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * "Ver detalhes" de uma seção (o `<details>` nativo: teclado e leitor de tela de graça). Abre
 * sozinho quando a seção passa a ter problema e quando um link da tela aponta para a seção.
 */
function More({ section, open: wantOpen, label = 'Ver detalhes', children }: { section: string; open: boolean; label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(wantOpen);
  useEffect(() => {
    if (wantOpen) setOpen(true);
  }, [wantOpen]);
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === `#${section}`) setOpen(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [section]);
  return (
    <details className="more" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{open ? 'Ocultar detalhes' : label}</summary>
      <div className="more-b">{children}</div>
    </details>
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

/**
 * Caminhos e comandos quebram nos espaços e depois das barras (e do `_` dos nomes de variável),
 * nunca no meio de uma palavra como "SHA256" ou depois do hífen de "-Algorithm": uma parte sem
 * barra fica inteira na linha. O `<wbr>` não entra no texto copiado.
 */
function breakable(text: string): ReactNode[] {
  return text.split(/( +)/).map((tok, t) => {
    if (!/[\\/_]/.test(tok)) {
      return /\S/.test(tok) ? (
        <span key={t} className="nb">
          {tok}
        </span>
      ) : (
        tok
      );
    }
    return <Fragment key={t}>{tok.split(/(?<=[\\/_])/).flatMap((part, i) => (i === 0 ? [part] : [<wbr key={i} />, part]))}</Fragment>;
  });
}

/** `hash`: um hash não tem onde quebrar, então quebra em qualquer caractere. */
function Code({ children, copy = false, hash = false, label }: { children: string; copy?: boolean; hash?: boolean; label?: string }) {
  const say = useContext(Announce);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      say(`Copiado: ${label ?? 'texto'}.`);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      say('Não deu para copiar. O texto continua selecionável.');
    }
  }
  return (
    <span className="code">
      <code className={hash ? 'mono is-hash' : 'mono'}>{hash ? children : breakable(children)}</code>
      {copy && (
        <button type="button" className="btn btn-g btn-sm code-cp" aria-label={`Copiar ${label ?? 'texto'}`} onClick={() => void doCopy()}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
    </span>
  );
}

function Mark({ ok, yes, no, soft = false }: { ok: boolean; yes: string; no: string; soft?: boolean }) {
  return <span className={ok ? 'mark is-ok' : soft ? 'mark is-soft' : 'mark is-bad'}>{ok ? yes : no}</span>;
}

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`state is-${tone}`}>{children}</span>;
}

const DAEMON_TONE: Record<DaemonState, Tone> = { rodando: 'ok', parado: 'idle', socketTravado: 'warn' };

function StateChip({ state }: { state: DaemonState }) {
  return <Chip tone={DAEMON_TONE[state]}>{DAEMON_LABEL[state]}</Chip>;
}
