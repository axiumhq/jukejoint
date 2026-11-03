//! Implementação do `EngineAdapter` sobre o `modlock.exe` (fase 1 do docs/engine-adapter.md).
//!
//! Regras que valem para todo o arquivo:
//! - processos sempre por `std::process::Command`, argumentos em lista (ver `args.rs`), sem shell
//!   e sem WMI (o antivírus trata `Win32_Process.Create` como suspeito);
//! - o daemon só para com `modlock daemon stop`; nunca se encerra o processo dele;
//! - `daemon status` só roda com um daemon de pé (sem daemon, ele sobe um no hyperline.gg);
//! - antes de qualquer coisa que rode o motor, o binário precisa ter a versão e o hash fixados.

use std::{
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use super::{
    args, parse, system, BinaryCheck, CheckReport, CliEvent, DaemonInfo, DaemonState, EngineAdapter, EngineError,
    EnvEntry, EventSink, GameCheck, HostsCheck, JoinCode, SessionEvent, SessionInfo, SessionKind, StopReport,
    BLOCKED_HOST, GAME_EXE, MODLOCK_SHA256, MODLOCK_VERSION,
};

/// Variáveis de ambiente que o app lê.
pub const ENV_BIN: &str = "MODLOCK_BIN";
pub const ENV_ORIGIN: &str = "ENGINE_ORIGIN";
pub const ENV_STATE_DIR: &str = "ENGINE_STATE_DIR";

/// Nomes aceitos ao lado do executável do app: o comum e o de sidecar do Tauri.
const BESIDE_APP: &[&str] = &["modlock.exe", "modlock-x86_64-pc-windows-msvc.exe"];
/// Nome do log do daemon que o app sobe (o daemon subido à mão escreve no stderr, não no daemon.log).
const DAEMON_LOG: &str = "daemon-app.log";
/// Limite prático do caminho de um socket AF_UNIX no Windows.
const SOCKET_PATH_MAX: usize = 100;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Configuração lida do ambiente uma vez, na abertura do app.
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// Caminho do `modlock.exe` e de onde ele veio.
    pub bin: Option<(PathBuf, &'static str)>,
    /// `None` quando `ENGINE_ORIGIN` não foi definida.
    pub origin: Result<Option<String>, EngineError>,
    /// O que o Modlock vê como `%APPDATA%`.
    pub state_root: PathBuf,
    /// Definida quando `ENGINE_STATE_DIR` troca o `APPDATA` dos processos do Modlock.
    pub state_override: Option<PathBuf>,
}

impl EngineConfig {
    pub fn from_env() -> Self {
        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf));
        // Só em build de desenvolvimento: a pasta tools/ do repositório (fora do git).
        let dev_tools = cfg!(debug_assertions).then(|| {
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
                .join("tools")
                .join(format!("modlock-{MODLOCK_VERSION}"))
                .join("modlock.exe")
        });
        Self::resolve(&|k| std::env::var(k).ok(), exe_dir.as_deref(), dev_tools)
    }

    /// Mesma coisa que `from_env`, com o ambiente injetado (para testes).
    pub fn resolve(env: &dyn Fn(&str) -> Option<String>, exe_dir: Option<&Path>, dev_tools: Option<PathBuf>) -> Self {
        let set = |k: &str| env(k).map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let bin = if let Some(p) = set(ENV_BIN) {
            Some((PathBuf::from(p), ENV_BIN))
        } else if let Some(p) = exe_dir.and_then(|d| BESIDE_APP.iter().map(|n| d.join(n)).find(|p| p.is_file())) {
            Some((p, "ao lado do app"))
        } else {
            dev_tools.filter(|p| p.is_file()).map(|p| (p, "pasta tools do repositório (dev)"))
        };
        let origin = match set(ENV_ORIGIN) {
            Some(o) => super::validate::origin(&o).map(Some),
            None => Ok(None),
        };
        let state_override = set(ENV_STATE_DIR).map(PathBuf::from);
        let state_root = state_override
            .clone()
            .or_else(|| set("APPDATA").map(PathBuf::from))
            .unwrap_or_else(std::env::temp_dir);
        Self { bin, origin, state_root, state_override }
    }

    /// `<APPDATA>\modlock\state`, onde ficam `daemon.lock` e `modlock.sock`.
    pub fn state_dir(&self) -> PathBuf {
        self.state_root.join("modlock").join("state")
    }
}

struct Session {
    id: u64,
    kind: SessionKind,
    target: String,
    started_at: u64,
    pid: u32,
    child: Arc<Mutex<Child>>,
    stdin: Option<ChildStdin>,
    shared: Arc<Mutex<Shared>>,
}

#[derive(Default)]
struct Shared {
    join_code: Option<String>,
    exit_code: Option<i32>,
    ended: bool,
}

impl Session {
    fn info(&self) -> SessionInfo {
        let sh = self.shared.lock().unwrap();
        SessionInfo {
            id: self.id,
            kind: self.kind,
            pid: self.pid,
            started_at: self.started_at,
            target: self.target.clone(),
            join_code: sh.join_code.clone(),
            running: !sh.ended,
            exit_code: sh.exit_code,
        }
    }
}

struct HashCache {
    path: PathBuf,
    len: u64,
    modified: Option<SystemTime>,
    sha256: String,
}

pub struct ModlockCli {
    cfg: EngineConfig,
    sink: EventSink,
    session: Mutex<Option<Session>>,
    next_id: AtomicU64,
    hash_cache: Mutex<Option<HashCache>>,
    started_daemon: AtomicBool,
}

struct Captured {
    ok: bool,
    stdout: String,
    stderr: String,
}

impl ModlockCli {
    pub fn new(cfg: EngineConfig, sink: EventSink) -> Self {
        Self {
            cfg,
            sink,
            session: Mutex::new(None),
            next_id: AtomicU64::new(1),
            hash_cache: Mutex::new(None),
            started_daemon: AtomicBool::new(false),
        }
    }

    pub fn config(&self) -> &EngineConfig {
        &self.cfg
    }

    /// Ao fechar o app: encerra a sessão e para o daemon se foi este app que o subiu.
    pub fn shutdown(&self) {
        let _ = self.end_session();
        if self.started_daemon.load(Ordering::SeqCst) && self.daemon_state() == DaemonState::Rodando {
            let _ = self.daemon_stop_inner();
        }
    }

    fn command(&self, bin: &Path, args: &[String]) -> Command {
        let mut c = Command::new(bin);
        c.args(args).envs(args::child_env(self.cfg.state_override.as_deref()));
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            c.creation_flags(CREATE_NO_WINDOW);
        }
        c
    }

    /// Roda um comando curto do Modlock (cliente, nunca o daemon) e devolve a saída.
    /// Passou do tempo, o cliente é encerrado; o daemon não é afetado.
    fn run(&self, bin: &Path, args: &[String], timeout: Duration) -> Result<Captured, EngineError> {
        let mut child = self
            .command(bin, args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| EngineError::new("processo", format!("Não consegui rodar o modlock: {e}")))?;
        let out = read_all(child.stdout.take());
        let err = read_all(child.stderr.take());
        let start = Instant::now();
        let status = loop {
            match child.try_wait() {
                Ok(Some(s)) => break s,
                Ok(None) if start.elapsed() < timeout => thread::sleep(Duration::from_millis(40)),
                _ => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(EngineError::new(
                        "tempo_esgotado",
                        format!("modlock {} não respondeu em {}s", args.join(" "), timeout.as_secs()),
                    ));
                }
            }
        };
        Ok(Captured { ok: status.success(), stdout: out.join().unwrap_or_default(), stderr: err.join().unwrap_or_default() })
    }

    fn binary_check(&self) -> BinaryCheck {
        let mut b = BinaryCheck {
            path: None,
            source: None,
            exists: false,
            size_bytes: None,
            sha256: None,
            expected_sha256: MODLOCK_SHA256,
            hash_ok: false,
            version: None,
            expected_version: MODLOCK_VERSION,
            version_ok: false,
        };
        let Some((path, source)) = &self.cfg.bin else { return b };
        b.path = Some(path.display().to_string());
        b.source = Some(source.to_string());
        let Ok(meta) = fs::metadata(path) else { return b };
        b.exists = meta.is_file();
        if !b.exists {
            return b;
        }
        b.size_bytes = Some(meta.len());
        b.sha256 = self.cached_hash(path, meta.len(), meta.modified().ok());
        b.hash_ok = b.sha256.as_deref() == Some(MODLOCK_SHA256);
        // Só roda o binário para ler a versão se o hash confere: nada de executar um arquivo trocado.
        if b.hash_ok {
            if let Ok(c) = self.run(path, &args::version(), Duration::from_secs(15)) {
                b.version = parse::version(&c.stdout);
            }
        }
        b.version_ok = b.version.as_deref() == Some(MODLOCK_VERSION);
        b
    }

    fn cached_hash(&self, path: &Path, len: u64, modified: Option<SystemTime>) -> Option<String> {
        let mut cache = self.hash_cache.lock().unwrap();
        if let Some(c) = cache.as_ref() {
            if c.path == path && c.len == len && c.modified == modified {
                return Some(c.sha256.clone());
            }
        }
        let sha256 = system::sha256_file(path).ok()?;
        *cache = Some(HashCache { path: path.to_path_buf(), len, modified, sha256: sha256.clone() });
        Some(sha256)
    }

    /// Binário presente, com o hash e a versão fixados. Sem isso o app não roda o motor.
    fn verified_bin(&self) -> Result<PathBuf, EngineError> {
        let b = self.binary_check();
        if !b.exists {
            return Err(EngineError::new(
                "binario_ausente",
                format!("modlock.exe não encontrado. Defina {ENV_BIN} com o caminho do binário {MODLOCK_VERSION}."),
            ));
        }
        if !b.hash_ok {
            return Err(EngineError::new(
                "hash_diferente",
                "O SHA-256 do modlock.exe não é o da versão fixada. Baixe de novo com scripts/install-modlock.ps1.",
            ));
        }
        if !b.version_ok {
            return Err(EngineError::new("versao_errada", format!("O modlock.exe não respondeu {MODLOCK_VERSION}.")));
        }
        Ok(self.cfg.bin.as_ref().unwrap().0.clone())
    }

    fn origin(&self) -> Result<String, EngineError> {
        match &self.cfg.origin {
            Ok(Some(o)) => Ok(o.clone()),
            Ok(None) => Err(EngineError::new(
                "origem_ausente",
                format!("Defina {ENV_ORIGIN} com o endereço do nosso servidor de sinalização (por exemplo http://192.168.0.10:8080)."),
            )),
            Err(e) => Err(e.clone()),
        }
    }

    fn daemon_state(&self) -> DaemonState {
        system::daemon_state(&self.cfg.state_dir())
    }

    fn socket_path(&self) -> PathBuf {
        self.cfg.state_dir().join("modlock.sock")
    }

    fn daemon_info(&self, query_status: bool) -> DaemonInfo {
        let state = self.daemon_state();
        let status = if query_status && state == DaemonState::Rodando {
            self.cfg.bin.as_ref().and_then(|(bin, _)| {
                // Confere de novo logo antes: `status` sem daemon sobe um no hyperline.gg.
                (self.daemon_state() == DaemonState::Rodando)
                    .then(|| self.run(bin, &args::daemon_status(), Duration::from_secs(15)).ok())
                    .flatten()
                    .map(|c| parse::daemon_status(&c.stdout))
            })
        } else {
            None
        };
        let expected_origin = self.cfg.origin.clone().ok().flatten();
        let origin_ok = matches!((&status, &expected_origin), (Some(s), Some(e)) if s.origin.as_deref() == Some(e.as_str()));
        let sock = self.socket_path();
        DaemonInfo {
            state,
            state_dir: self.cfg.state_dir().display().to_string(),
            socket_path_too_long: sock.as_os_str().len() > SOCKET_PATH_MAX,
            socket_path: sock.display().to_string(),
            status,
            expected_origin,
            origin_ok,
            started_by_app: self.started_daemon.load(Ordering::SeqCst) && state == DaemonState::Rodando,
            log_path: self.cfg.state_dir().join(DAEMON_LOG).display().to_string(),
        }
    }

    fn wait_state(&self, want: impl Fn(DaemonState) -> bool, timeout: Duration) -> bool {
        let start = Instant::now();
        loop {
            if want(self.daemon_state()) {
                return true;
            }
            if start.elapsed() >= timeout {
                return false;
            }
            thread::sleep(Duration::from_millis(150));
        }
    }

    fn daemon_stop_inner(&self) -> Result<(), EngineError> {
        let bin = self.verified_bin()?;
        if self.daemon_state() != DaemonState::Rodando {
            return Ok(());
        }
        let c = self.run(&bin, &args::daemon_stop(), Duration::from_secs(30))?;
        if !c.ok {
            return Err(EngineError::new("daemon_stop", format!("modlock daemon stop falhou: {}", c.stderr.trim())));
        }
        if !self.wait_state(|s| s != DaemonState::Rodando, Duration::from_secs(15)) {
            return Err(EngineError::new("daemon_stop", "O daemon recebeu o pedido de parar mas continua de pé."));
        }
        self.started_daemon.store(false, Ordering::SeqCst);
        Ok(())
    }

    fn spawn_daemon(&self, bin: &Path, origin: &str) -> Result<(), EngineError> {
        let dir = self.cfg.state_dir();
        fs::create_dir_all(&dir).map_err(|e| EngineError::new("processo", format!("Não consegui criar {}: {e}", dir.display())))?;
        let log_path = dir.join(DAEMON_LOG);
        let log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(|e| EngineError::new("processo", format!("Não consegui abrir {}: {e}", log_path.display())))?;
        let log_err = log.try_clone().map_err(|e| EngineError::new("processo", e.to_string()))?;
        // O daemon fica rodando sozinho; o handle do processo é solto (não encerra nada).
        let mut child = self
            .command(bin, &args::daemon_start(origin))
            .current_dir(&dir)
            .stdin(Stdio::null())
            .stdout(log)
            .stderr(log_err)
            .spawn()
            .map_err(|e| EngineError::new("processo", format!("Não consegui subir o daemon: {e}")))?;
        self.started_daemon.store(true, Ordering::SeqCst);
        let sock = self.socket_path();
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(20) {
            if self.daemon_state() == DaemonState::Rodando && sock.exists() {
                return Ok(());
            }
            if let Ok(Some(_)) = child.try_wait() {
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }
        self.started_daemon.store(false, Ordering::SeqCst);
        Err(EngineError::new("daemon_nao_subiu", format!("O daemon não ficou pronto. Veja o log em {}.", log_path.display())))
    }

    fn active_session_guard(&self) -> Result<(), EngineError> {
        let mut s = self.session.lock().unwrap();
        if let Some(sess) = s.as_ref() {
            if sess.info().running {
                return Err(EngineError::new("sessao_ativa", "Já há uma sessão rodando. Pare a atual antes."));
            }
            *s = None;
        }
        Ok(())
    }

    fn game_check(&self) -> GameCheck {
        let pids = system::process_ids_named(GAME_EXE).unwrap_or_default();
        GameCheck { exe: GAME_EXE, running: !pids.is_empty(), pids }
    }

    fn refuse_if_game_open(&self) -> Result<(), EngineError> {
        if self.game_check().running {
            return Err(EngineError::new(
                "jogo_aberto",
                "Feche o Deadlock para carregar o modo: com o jogo aberto o gameinfo.gi fica travado e o conteúdo não monta.",
            ));
        }
        Ok(())
    }

    fn spawn_session(&self, kind: SessionKind, args: Vec<String>, cwd: &Path, target: String) -> Result<SessionInfo, EngineError> {
        let bin = self.verified_bin()?;
        let mut child = self
            .command(&bin, &args)
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| EngineError::new("processo", format!("Não consegui iniciar o modlock: {e}")))?;
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let pid = child.id();
        let stdin = child.stdin.take();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let child = Arc::new(Mutex::new(child));
        let shared = Arc::new(Mutex::new(Shared::default()));

        if let Some(err) = stderr {
            let sink = self.sink.clone();
            thread::spawn(move || {
                for_each_line(err, |line| {
                    if let Some(ev) = parse::event(&line) {
                        sink(SessionEvent { session: id, kind, stream: "stderr", event: Some(ev), exit_code: None });
                    }
                })
            });
        }
        {
            let sink = self.sink.clone();
            let shared = shared.clone();
            let child = child.clone();
            thread::spawn(move || {
                if let Some(out) = stdout {
                    for_each_line(out, |line| {
                        let Some(ev) = parse::event(&line) else { return };
                        if let CliEvent::Hosting { join_code: Some(code), .. } = &ev {
                            shared.lock().unwrap().join_code = Some(code.clone());
                        }
                        sink(SessionEvent { session: id, kind, stream: "stdout", event: Some(ev), exit_code: None });
                    });
                }
                // Saída fechada: espera o processo terminar para registrar o código.
                let code = wait_exit(&child, Duration::from_secs(30));
                {
                    let mut sh = shared.lock().unwrap();
                    sh.ended = true;
                    sh.exit_code = code;
                }
                sink(SessionEvent { session: id, kind, stream: "fim", event: None, exit_code: code });
            });
        }

        let sess = Session { id, kind, target, started_at: now_secs(), pid, child, stdin, shared };
        let info = sess.info();
        *self.session.lock().unwrap() = Some(sess);
        Ok(info)
    }

    /// Fecha a entrada padrão (com `--json`, o servidor para quando ela fecha) e espera.
    /// Se o cliente não sair, ele é encerrado: é o processo `modlock host/join`, não o daemon.
    fn end_session(&self) -> (Option<SessionInfo>, bool) {
        let Some(mut s) = self.session.lock().unwrap().take() else { return (None, false) };
        drop(s.stdin.take());
        let mut forced = false;
        if wait_exit(&s.child, Duration::from_secs(20)).is_none() && !s.shared.lock().unwrap().ended {
            let mut c = s.child.lock().unwrap();
            if let Ok(None) = c.try_wait() {
                let _ = c.kill();
                let _ = c.wait();
                forced = true;
            }
        }
        let mut info = s.info();
        if forced {
            info.running = false;
        }
        (Some(info), forced)
    }
}

impl EngineAdapter for ModlockCli {
    fn check(&self) -> CheckReport {
        let binary = self.binary_check();
        let daemon = self.daemon_info(binary.hash_ok);
        let game = self.game_check();
        let hosts_path = system::hosts_path();
        let (readable, entries) = match fs::read_to_string(&hosts_path) {
            Ok(s) => (true, parse::hosts_entries(&s, BLOCKED_HOST)),
            Err(_) => (false, Default::default()),
        };
        let hosts = HostsCheck { path: hosts_path.display().to_string(), host: BLOCKED_HOST, readable, entries };

        let mut problems = Vec::new();
        if !binary.exists {
            problems.push(EngineError::new("binario_ausente", format!("modlock.exe não encontrado. Defina {ENV_BIN}.")));
        } else if !binary.hash_ok {
            problems.push(EngineError::new("hash_diferente", "O SHA-256 do modlock.exe não é o da versão fixada."));
        } else if !binary.version_ok {
            problems.push(EngineError::new("versao_errada", format!("O modlock.exe não respondeu {MODLOCK_VERSION}.")));
        }
        if let Err(e) = self.origin() {
            problems.push(e);
        }
        if daemon.state == DaemonState::SocketTravado {
            problems.push(EngineError::new(
                "socket_travado",
                "Há um modlock.sock travado (daemon encerrado à força). Reinicie o PC ou use outra pasta em ENGINE_STATE_DIR.",
            ));
        }
        if daemon.socket_path_too_long {
            problems.push(EngineError::new(
                "socket_caminho_longo",
                "O caminho do socket do daemon passa do limite do Windows. Use uma pasta mais curta em ENGINE_STATE_DIR.",
            ));
        }
        if daemon.state == DaemonState::Rodando && daemon.expected_origin.is_some() && !daemon.origin_ok {
            problems.push(EngineError::new(
                "daemon_outra_origem",
                "O daemon de pé usa outra origem. O app para e sobe de novo com a nossa ao hospedar ou entrar.",
            ));
        }
        if game.running {
            problems.push(EngineError::new("jogo_aberto", "O Deadlock está aberto. Feche antes de hospedar ou entrar."));
        }
        let ready = binary.hash_ok
            && binary.version_ok
            && matches!(self.cfg.origin, Ok(Some(_)))
            && daemon.state != DaemonState::SocketTravado
            && !daemon.socket_path_too_long;

        let env = vec![
            EnvEntry {
                name: ENV_BIN,
                value: std::env::var(ENV_BIN).ok(),
                scope: "app",
                purpose: "Caminho do modlock.exe fixado. Sem ela, o app procura ao lado do próprio executável.",
            },
            EnvEntry {
                name: ENV_ORIGIN,
                value: self.cfg.origin.clone().ok().flatten(),
                scope: "app",
                purpose: "Servidor de sinalização passado ao daemon em --origin. O hyperline.gg é recusado.",
            },
            EnvEntry {
                name: ENV_STATE_DIR,
                value: self.cfg.state_override.as_ref().map(|p| p.display().to_string()),
                scope: "app",
                purpose: "Outra pasta de estado do Modlock (troca o APPDATA só dos processos do Modlock).",
            },
            EnvEntry {
                name: "MODLOCK_NO_UPDATE_CHECK",
                value: Some("1".into()),
                scope: "modlock",
                purpose: "Definida pelo app em todo processo do Modlock: a versão é fixada, sem checagem de update.",
            },
        ];
        CheckReport { binary, daemon, game, hosts, env, ready, problems }
    }

    fn start_daemon(&self) -> Result<DaemonInfo, EngineError> {
        let bin = self.verified_bin()?;
        let origin = self.origin()?;
        if self.socket_path().as_os_str().len() > SOCKET_PATH_MAX {
            return Err(EngineError::new("socket_caminho_longo", "Caminho do socket longo demais. Use uma pasta mais curta em ENGINE_STATE_DIR."));
        }
        match self.daemon_state() {
            DaemonState::Rodando => {
                let info = self.daemon_info(true);
                if info.origin_ok {
                    return Ok(info);
                }
                // Daemon em outra origem (o que sobe sozinho vai para o hyperline.gg): parar e subir o nosso.
                self.daemon_stop_inner()?;
            }
            DaemonState::SocketTravado => {
                return Err(EngineError::new(
                    "socket_travado",
                    format!(
                        "Há um modlock.sock travado em {} (daemon encerrado à força). Reinicie o PC ou use outra pasta em {ENV_STATE_DIR}.",
                        self.cfg.state_dir().display()
                    ),
                ))
            }
            DaemonState::Parado => {}
        }
        self.spawn_daemon(&bin, &origin)?;
        Ok(self.daemon_info(true))
    }

    fn stop_daemon(&self) -> Result<DaemonInfo, EngineError> {
        if self.session().is_some_and(|s| s.running) {
            return Err(EngineError::new("sessao_ativa", "Pare a sessão antes de parar o daemon."));
        }
        self.daemon_stop_inner()?;
        Ok(self.daemon_info(false))
    }

    fn host(&self, project: &Path) -> Result<SessionInfo, EngineError> {
        self.active_session_guard()?;
        let dir = super::validate::project_dir(project)?;
        self.verified_bin()?;
        self.refuse_if_game_open()?;
        self.start_daemon()?;
        let target = dir.display().to_string();
        self.spawn_session(SessionKind::Host, args::host(), &dir, target)
    }

    fn join(&self, code: &JoinCode) -> Result<SessionInfo, EngineError> {
        self.active_session_guard()?;
        let origin = self.origin()?;
        self.verified_bin()?;
        self.refuse_if_game_open()?;
        self.start_daemon()?;
        let cwd = self.cfg.state_dir();
        self.spawn_session(SessionKind::Join, args::join(code, &origin), &cwd, code.as_str().to_string())
    }

    fn stop(&self) -> Result<StopReport, EngineError> {
        let (session, session_forced) = self.end_session();
        let daemon_was_running = self.daemon_state() == DaemonState::Rodando;
        if daemon_was_running {
            self.daemon_stop_inner()?;
        }
        Ok(StopReport { session, session_forced, daemon_was_running, daemon: self.daemon_info(false) })
    }

    fn session(&self) -> Option<SessionInfo> {
        self.session.lock().unwrap().as_ref().map(Session::info)
    }
}

fn read_all<R: Read + Send + 'static>(r: Option<R>) -> thread::JoinHandle<String> {
    thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut r) = r {
            let _ = r.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).into_owned()
    })
}

/// Lê linha a linha, aceitando bytes que não são UTF-8.
fn for_each_line<R: Read>(r: R, mut f: impl FnMut(String)) {
    let mut reader = BufReader::new(r);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf) {
            Ok(0) | Err(_) => break,
            Ok(_) => f(String::from_utf8_lossy(&buf).trim_end_matches(['\r', '\n']).to_string()),
        }
    }
}

fn wait_exit(child: &Mutex<Child>, timeout: Duration) -> Option<i32> {
    let start = Instant::now();
    loop {
        if let Ok(Some(s)) = child.lock().unwrap().try_wait() {
            return Some(s.code().unwrap_or(-1));
        }
        if start.elapsed() >= timeout {
            return None;
        }
        thread::sleep(Duration::from_millis(100));
    }
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn env_of(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let m: HashMap<String, String> = pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        move |k| m.get(k).cloned()
    }

    #[test]
    fn bin_from_env_wins() {
        let cfg = EngineConfig::resolve(&env_of(&[(ENV_BIN, r"D:\x\modlock.exe")]), None, None);
        assert_eq!(cfg.bin.unwrap(), (PathBuf::from(r"D:\x\modlock.exe"), ENV_BIN));
    }

    #[test]
    fn bin_beside_app_then_dev_tools() {
        let d = std::env::temp_dir().join(format!("engine-bin-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        let none = EngineConfig::resolve(&env_of(&[]), Some(&d), Some(d.join("nao-existe.exe")));
        assert!(none.bin.is_none());
        let dev = d.join("dev-modlock.exe");
        fs::write(&dev, "").unwrap();
        let from_dev = EngineConfig::resolve(&env_of(&[]), Some(&d), Some(dev.clone()));
        assert_eq!(from_dev.bin.unwrap().0, dev);
        fs::write(d.join("modlock.exe"), "").unwrap();
        let beside = EngineConfig::resolve(&env_of(&[]), Some(&d), Some(dev));
        assert_eq!(beside.bin.unwrap(), (d.join("modlock.exe"), "ao lado do app"));
        fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn origin_and_state_dir_from_env() {
        let cfg = EngineConfig::resolve(
            &env_of(&[(ENV_ORIGIN, " http://10.0.0.2:8080/ "), (ENV_STATE_DIR, r"C:\s"), ("APPDATA", r"C:\Users\x\AppData\Roaming")]),
            None,
            None,
        );
        assert_eq!(cfg.origin.clone().unwrap().as_deref(), Some("http://10.0.0.2:8080"));
        assert_eq!(cfg.state_dir(), PathBuf::from(r"C:\s\modlock\state"));
        assert_eq!(cfg.state_override, Some(PathBuf::from(r"C:\s")));

        let def = EngineConfig::resolve(&env_of(&[("APPDATA", r"C:\Users\x\AppData\Roaming")]), None, None);
        assert_eq!(def.origin.clone().unwrap(), None);
        assert_eq!(def.state_dir(), PathBuf::from(r"C:\Users\x\AppData\Roaming\modlock\state"));
        assert!(def.state_override.is_none());

        let bad = EngineConfig::resolve(&env_of(&[(ENV_ORIGIN, "https://hyperline.gg")]), None, None);
        assert_eq!(bad.origin.unwrap_err().code, "origem_invalida");
    }

    #[test]
    fn missing_binary_blocks_everything() {
        let cfg = EngineConfig::resolve(&env_of(&[(ENV_BIN, r"Z:\nao\existe\modlock.exe"), ("APPDATA", r"Z:\a")]), None, None);
        let engine = ModlockCli::new(cfg, Arc::new(|_| {}));
        let report = engine.check();
        assert!(!report.ready);
        assert!(!report.binary.exists);
        assert!(report.problems.iter().any(|p| p.code == "binario_ausente"));
        assert!(report.problems.iter().any(|p| p.code == "origem_ausente"));
        assert_eq!(engine.join(&JoinCode::parse("ABCD").unwrap()).unwrap_err().code, "origem_ausente");
        assert_eq!(engine.start_daemon().unwrap_err().code, "binario_ausente");
        assert!(engine.session().is_none());
    }

    #[test]
    fn wrong_hash_is_never_executed() {
        let d = std::env::temp_dir().join(format!("engine-hash-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        let fake = d.join("modlock.exe");
        fs::write(&fake, "não é o modlock").unwrap();
        let cfg = EngineConfig::resolve(&env_of(&[(ENV_BIN, fake.to_str().unwrap()), ("APPDATA", d.to_str().unwrap())]), None, None);
        let engine = ModlockCli::new(cfg, Arc::new(|_| {}));
        let b = engine.check().binary;
        assert!(b.exists && !b.hash_ok);
        assert_eq!(b.version, None, "a versão só é lida de um binário com hash certo");
        assert_eq!(engine.start_daemon().unwrap_err().code, "hash_diferente");
        fs::remove_dir_all(&d).unwrap();
    }
}
