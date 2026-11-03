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
    /// Pasta do executável do app (onde o `modlock.exe` deve ficar sem `MODLOCK_BIN`).
    pub exe_dir: Option<PathBuf>,
    /// `%LOCALAPPDATA%\modlock`: downloads do Modlock (servidor do jogo).
    pub download_dir: Option<PathBuf>,
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
        let download_dir = set("LOCALAPPDATA").map(|d| PathBuf::from(d).join("modlock"));
        Self { bin, origin, state_root, state_override, exe_dir: exe_dir.map(Path::to_path_buf), download_dir }
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
    /// O `modlock.exe` já foi visto nesta execução (para saber se ele sumiu depois).
    bin_seen: AtomicBool,
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
            bin_seen: AtomicBool::new(false),
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
            .map_err(|e| blocked_process(format!("modlock {}: {e}", args.join(" "))))?;
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
                        "O motor demorou demais para responder. Tente de novo; se repetir, reinicie o PC.",
                    )
                    .with_detail(format!("modlock {} não respondeu em {} s", args.join(" "), timeout.as_secs())));
                }
            }
        };
        Ok(Captured { ok: status.success(), stdout: out.join().unwrap_or_default(), stderr: err.join().unwrap_or_default() })
    }

    fn binary_check(&self) -> BinaryCheck {
        let mut b = BinaryCheck {
            path: None,
            source: None,
            folder: self.cfg.exe_dir.as_ref().map(|d| d.display().to_string()),
            exists: false,
            vanished: false,
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
        if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
            b.folder = Some(dir.display().to_string());
        }
        b.exists = fs::metadata(path).is_ok_and(|m| m.is_file());
        if !b.exists {
            // Ao lado do app ou na pasta tools, o caminho só é aceito se o arquivo existia ao abrir;
            // com MODLOCK_BIN, só se já foi visto nesta execução.
            b.vanished = *source != ENV_BIN || self.bin_seen.load(Ordering::SeqCst);
            return b;
        }
        self.bin_seen.store(true, Ordering::SeqCst);
        let Ok(meta) = fs::metadata(path) else { return b };
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

    /// O problema do binário, se houver (o mesmo texto na checagem e ao tentar rodar o motor).
    fn binary_problem(&self, b: &BinaryCheck) -> Option<EngineError> {
        if b.vanished {
            let path = b.path.as_deref().unwrap_or("modlock.exe");
            return Some(
                EngineError::new(
                    "binario_sumiu",
                    "O motor do app (modlock.exe) sumiu da pasta; o mais provável é o antivírus ter colocado o arquivo em quarentena. Restaure o arquivo e adicione as exclusões do antivírus.",
                )
                .with_detail(format!("Arquivo verificado antes não existe mais: {path}")),
            );
        }
        if !b.exists {
            let detail = match (&b.path, &b.folder) {
                (Some(p), _) => format!("{ENV_BIN} aponta para um arquivo que não existe: {p}"),
                (None, Some(dir)) => format!(
                    "{ENV_BIN} não definida e sem modlock.exe em {dir}. Defina {ENV_BIN} com o caminho do modlock.exe {MODLOCK_VERSION}."
                ),
                (None, None) => format!("{ENV_BIN} não definida. Defina com o caminho do modlock.exe {MODLOCK_VERSION}."),
            };
            return Some(
                EngineError::new(
                    "binario_ausente",
                    "O motor do app (modlock.exe) não está neste PC. Ainda não há instalador: peça o arquivo a quem te passou o app, coloque na pasta do app e abra o app de novo.",
                )
                .with_detail(detail),
            );
        }
        if !b.hash_ok {
            return Some(
                EngineError::new(
                    "hash_diferente",
                    "O arquivo do motor não é o original, então o app não vai rodar ele. Não use este arquivo: peça o modlock.exe de novo a quem te passou o app.",
                )
                .with_detail(format!(
                    "SHA-256 {} diferente do fixado para {MODLOCK_VERSION} ({MODLOCK_SHA256}). Em desenvolvimento, scripts/install-modlock.ps1 baixa e confere.",
                    b.sha256.as_deref().unwrap_or("ilegível")
                )),
            );
        }
        if !b.version_ok {
            return Some(
                EngineError::new(
                    "versao_errada",
                    "O motor respondeu uma versão diferente da que este app usa. Peça o modlock.exe de novo a quem te passou o app.",
                )
                .with_detail(format!(
                    "modlock --version: {}; esperada {MODLOCK_VERSION}.",
                    b.version.as_deref().unwrap_or("sem resposta")
                )),
            );
        }
        None
    }

    /// Binário presente, com o hash e a versão fixados. Sem isso o app não roda o motor.
    fn verified_bin(&self) -> Result<PathBuf, EngineError> {
        let b = self.binary_check();
        if let Some(e) = self.binary_problem(&b) {
            return Err(e);
        }
        Ok(self.cfg.bin.as_ref().unwrap().0.clone())
    }

    fn origin(&self) -> Result<String, EngineError> {
        match &self.cfg.origin {
            Ok(Some(o)) => Ok(o.clone()),
            Ok(None) => Err(EngineError::new(
                "origem_ausente",
                "Esta cópia do app não sabe qual servidor usar para ligar os PCs. Não é algo que dá para ajustar aqui: avise quem te passou o app.",
            )
            .with_detail(format!(
                "{ENV_ORIGIN} não definida. Defina com a origem do servidor de sinalização, por exemplo http://192.168.0.10:8080."
            ))),
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
        const STOP_MSG: &str = "O serviço do motor não parou. Tente de novo em alguns segundos; não encerre o processo pelo Gerenciador de Tarefas, isso trava o serviço até reiniciar o PC.";
        let c = self.run(&bin, &args::daemon_stop(), Duration::from_secs(30))?;
        if !c.ok {
            let why = c.stderr.trim();
            return Err(EngineError::new("daemon_stop", STOP_MSG)
                .with_detail(format!("modlock daemon stop falhou: {}", if why.is_empty() { "sem saída no stderr" } else { why })));
        }
        if !self.wait_state(|s| s != DaemonState::Rodando, Duration::from_secs(15)) {
            return Err(EngineError::new("daemon_stop", STOP_MSG)
                .with_detail("modlock daemon stop respondeu, mas o daemon.lock continua ocupado depois de 15 s."));
        }
        self.started_daemon.store(false, Ordering::SeqCst);
        Ok(())
    }

    fn spawn_daemon(&self, bin: &Path, origin: &str) -> Result<(), EngineError> {
        let dir = self.cfg.state_dir();
        let no_folder = |what: String| {
            EngineError::new(
                "processo",
                "O app não conseguiu gravar na pasta de dados do motor. Feche e abra o app de novo; se repetir, reinicie o PC.",
            )
            .with_detail(what)
        };
        fs::create_dir_all(&dir).map_err(|e| no_folder(format!("Não deu para criar {}: {e}", dir.display())))?;
        let log_path = dir.join(DAEMON_LOG);
        let log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(|e| no_folder(format!("Não deu para abrir {}: {e}", log_path.display())))?;
        let log_err = log.try_clone().map_err(|e| no_folder(format!("{}: {e}", log_path.display())))?;
        // O daemon fica rodando sozinho; o handle do processo é solto (não encerra nada).
        let mut child = self
            .command(bin, &args::daemon_start(origin))
            .current_dir(&dir)
            .stdin(Stdio::null())
            .stdout(log)
            .stderr(log_err)
            .spawn()
            .map_err(|e| blocked_process(format!("modlock daemon: {e}")))?;
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
        Err(EngineError::new(
            "daemon_nao_subiu",
            "O serviço do motor não ligou. Tente de novo; se repetir, o antivírus pode estar bloqueando o motor.",
        )
        .with_detail(format!("O daemon não ficou pronto em 20 s. Log: {}", log_path.display())))
    }

    fn active_session_guard(&self) -> Result<(), EngineError> {
        let mut s = self.session.lock().unwrap();
        if let Some(sess) = s.as_ref() {
            let info = sess.info();
            if info.running {
                return Err(EngineError::new(
                    "sessao_ativa",
                    "Já há uma partida em andamento. Encerre a atual antes de começar outra.",
                )
                .with_detail(format!("Sessão {:?} rodando, PID {}.", info.kind, info.pid)));
            }
            *s = None;
        }
        Ok(())
    }

    fn stuck_socket(&self) -> EngineError {
        EngineError::new(
            "socket_travado",
            "O serviço do motor foi fechado à força e deixou um arquivo preso que só o Windows libera. Reinicie o PC e abra o app de novo.",
        )
        .with_detail(format!(
            "modlock.sock sobrando em {} com o daemon.lock livre. Sem reiniciar: {ENV_STATE_DIR} com outra pasta curta.",
            self.cfg.state_dir().display()
        ))
    }

    fn long_socket(&self) -> EngineError {
        EngineError::new(
            "socket_caminho_longo",
            "A pasta de dados do motor fica num caminho longo demais para o Windows, e o serviço não consegue ligar. Avise quem te passou o app.",
        )
        .with_detail(format!(
            "{} tem mais de {SOCKET_PATH_MAX} caracteres (limite do socket AF_UNIX). Use {ENV_STATE_DIR} com uma pasta curta, como C:\\Users\\<nome>\\.ml.",
            self.socket_path().display()
        ))
    }

    fn game_check(&self) -> GameCheck {
        let pids = system::process_ids_named(GAME_EXE).unwrap_or_default();
        GameCheck { exe: GAME_EXE, running: !pids.is_empty(), pids }
    }

    fn refuse_if_game_open(&self) -> Result<(), EngineError> {
        let game = self.game_check();
        if game.running {
            return Err(game_open(
                "Feche o Deadlock para carregar o modo: com o jogo aberto, o gameinfo.gi fica travado e o conteúdo não monta.",
                &game,
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
            .map_err(|e| blocked_process(format!("modlock {}: {e}", args.join(" "))))?;
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
        if let Some(e) = self.binary_problem(&binary) {
            problems.push(e);
        }
        if let Err(e) = self.origin() {
            problems.push(e);
        }
        if daemon.state == DaemonState::SocketTravado {
            problems.push(self.stuck_socket());
        }
        if daemon.socket_path_too_long {
            problems.push(self.long_socket());
        }
        if daemon.state == DaemonState::Rodando && daemon.expected_origin.is_some() && !daemon.origin_ok {
            problems.push(
                EngineError::new(
                    "daemon_outra_origem",
                    "O serviço do motor está ligado em outro servidor. Nada a fazer: o app troca para o nosso ao hospedar ou entrar.",
                )
                .with_detail(format!(
                    "daemon status: origem {}; esperada {}.",
                    daemon.status.as_ref().and_then(|s| s.origin.as_deref()).unwrap_or("desconhecida"),
                    daemon.expected_origin.as_deref().unwrap_or("-")
                )),
            );
        }
        if game.running {
            problems.push(game_open(
                "O Deadlock está aberto. Feche o jogo antes de hospedar ou entrar: com ele aberto, o gameinfo.gi fica travado e o modo não carrega.",
                &game,
            ));
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
        let download_dir = self.cfg.download_dir.as_ref().map(|d| d.display().to_string());
        CheckReport { binary, daemon, game, hosts, env, download_dir, ready, problems }
    }

    fn start_daemon(&self) -> Result<DaemonInfo, EngineError> {
        let bin = self.verified_bin()?;
        let origin = self.origin()?;
        if self.socket_path().as_os_str().len() > SOCKET_PATH_MAX {
            return Err(self.long_socket());
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
            DaemonState::SocketTravado => return Err(self.stuck_socket()),
            DaemonState::Parado => {}
        }
        self.spawn_daemon(&bin, &origin)?;
        Ok(self.daemon_info(true))
    }

    fn stop_daemon(&self) -> Result<DaemonInfo, EngineError> {
        if let Some(s) = self.session().filter(|s| s.running) {
            return Err(EngineError::new(
                "sessao_ativa",
                "Há uma partida em andamento. Encerre a partida no site antes de parar o serviço do motor.",
            )
            .with_detail(format!("Sessão {:?} rodando, PID {}.", s.kind, s.pid)));
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

/// O Windows recusou abrir o `modlock.exe` (quase sempre antivírus ou arquivo sumido).
fn blocked_process(detail: String) -> EngineError {
    EngineError::new(
        "processo",
        "O Windows não deixou o app abrir o motor. Se o antivírus bloqueou o modlock.exe, restaure o arquivo e adicione as exclusões do antivírus.",
    )
    .with_detail(detail)
}

fn game_open(message: &str, game: &GameCheck) -> EngineError {
    let pids: Vec<String> = game.pids.iter().map(u32::to_string).collect();
    EngineError::new("jogo_aberto", message).with_detail(format!("{} aberto, PID {}.", game.exe, pids.join(", ")))
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

    #[test]
    fn binary_gone_after_seen_is_quarantine() {
        let d = std::env::temp_dir().join(format!("engine-gone-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        let bin = d.join("modlock.exe");
        fs::write(&bin, "qualquer").unwrap();
        let env = env_of(&[("APPDATA", d.to_str().unwrap()), ("LOCALAPPDATA", r"C:\Users\x\AppData\Local")]);
        // Ao lado do app: o caminho só é aceito se o arquivo existia ao abrir.
        let engine = ModlockCli::new(EngineConfig::resolve(&env, Some(&d), None), Arc::new(|_| {}));
        assert!(engine.check().binary.exists);
        fs::remove_file(&bin).unwrap();
        let r = engine.check();
        assert!(!r.binary.exists && r.binary.vanished);
        assert_eq!(r.binary.folder.as_deref(), Some(d.display().to_string().as_str()));
        assert_eq!(r.download_dir.as_deref(), Some(r"C:\Users\x\AppData\Local\modlock"));
        assert!(r.problems.iter().any(|p| p.code == "binario_sumiu" && p.detail.is_some()));
        assert!(!r.problems.iter().any(|p| p.code == "binario_ausente"));
        assert_eq!(engine.start_daemon().unwrap_err().code, "binario_sumiu");

        // Com MODLOCK_BIN nunca visto, é só "não encontrado".
        let cfg = EngineConfig::resolve(&env_of(&[(ENV_BIN, bin.to_str().unwrap())]), None, None);
        let fresh = ModlockCli::new(cfg, Arc::new(|_| {}));
        let b = fresh.check().binary;
        assert!(!b.vanished);
        fs::remove_dir_all(&d).unwrap();
    }
}
