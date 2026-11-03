//! `EngineAdapter`: a única camada que fala com o motor (docs/engine-adapter.md).
//!
//! Fase 1: [`modlock::ModlockCli`] chama o `modlock.exe` fixado como processo e lê a saída `--json`.
//! Na fase 2 a mesma interface passa a falar com um sidecar Go, sem mexer no app nem no site.

pub mod args;
pub mod catalog;
pub mod modlock;
pub mod parse;
pub mod progress;
pub mod system;
pub mod validate;

use std::path::Path;

use serde::Serialize;

pub use catalog::{ModeSlug, ModesCheck};
pub use parse::{CliEvent, DaemonStatus, HostsMatch};
pub use system::DaemonState;
pub use validate::{JoinCode, LobbyId};

/// Versão do Modlock fixada nesta release do app.
pub const MODLOCK_VERSION: &str = "v0.1.68";
/// SHA-256 publicado pelo GitHub para `modlock-windows-amd64.exe` v0.1.68 (igual a
/// `scripts/install-modlock.ps1`).
pub const MODLOCK_SHA256: &str = "4148c2fb2a5e5ac39fef61d7766e7854c3ad6e3c5985bc89433c5914742e3381";
/// Host que o arquivo hosts deve bloquear para provar que nada passa pelo hyperline.gg.
pub const BLOCKED_HOST: &str = "hyperline.gg";
/// Executável do jogo. Com ele aberto, o `gameinfo.gi` fica travado e o conteúdo não monta.
pub const GAME_EXE: &str = "deadlock.exe";

pub trait EngineAdapter: Send + Sync {
    /// Estado de tudo que o app toca, sem mudar nada.
    fn check(&self) -> CheckReport;
    /// Garante o daemon de pé com a nossa origem.
    fn start_daemon(&self) -> Result<DaemonInfo, EngineError>;
    /// Para o daemon com `modlock daemon stop` (nunca encerrando o processo).
    fn stop_daemon(&self) -> Result<DaemonInfo, EngineError>;
    /// Hospeda o projeto de mod nesta pasta; o código de entrada chega como evento `hosting`.
    /// Só para uso interno: o site hospeda por [`EngineAdapter::host_mode`].
    fn host(&self, project: &Path) -> Result<SessionInfo, EngineError>;
    /// Hospeda um modo do catálogo (`catalog.rs`): o slug vira a pasta do projeto aqui dentro.
    fn host_mode(&self, mode: &ModeSlug) -> Result<SessionInfo, EngineError>;
    /// Entra na sessão de outro PC pelo código.
    fn join(&self, code: &JoinCode) -> Result<SessionInfo, EngineError>;
    /// Encerra a sessão (fechando a entrada padrão, como o `--json` pede) e depois o daemon.
    fn stop(&self) -> Result<StopReport, EngineError>;
    /// Sessão atual, se houver.
    fn session(&self) -> Option<SessionInfo>;
}

/// Erro com código estável (para o site decidir o que mostrar) e duas camadas de texto em PT-BR:
/// `message` é para quem joga (o que houve e o que dá para fazer, sem jargão) e `detail` é o
/// técnico (variável, caminho, comando, saída do Modlock), mostrado à parte e mais discreto.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EngineError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl EngineError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), detail: None }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)?;
        if let Some(d) = &self.detail {
            write!(f, " ({d})")?;
        }
        Ok(())
    }
}

impl std::error::Error for EngineError {}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckReport {
    pub binary: BinaryCheck,
    pub daemon: DaemonInfo,
    pub game: GameCheck,
    pub hosts: HostsCheck,
    pub env: Vec<EnvEntry>,
    /// `%LOCALAPPDATA%\modlock`, onde o Modlock baixa o servidor do jogo (o `ENGINE_STATE_DIR`
    /// só troca o `APPDATA`, então esta pasta não muda). Entra nas exclusões do antivírus.
    pub download_dir: Option<String>,
    /// O catálogo de modos (pasta dos projetos; hoje todo modo abre o projeto de teste).
    pub modes: ModesCheck,
    /// Pronto para hospedar ou entrar (binário certo, origem definida, sem socket travado).
    pub ready: bool,
    pub problems: Vec<EngineError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryCheck {
    pub path: Option<String>,
    /// De onde veio o caminho: `MODLOCK_BIN`, ao lado do app ou a pasta `tools` (só em dev).
    pub source: Option<String>,
    /// Pasta onde o `modlock.exe` está (ou deveria estar): a do caminho achado ou, sem caminho,
    /// a do executável do app. Entra nas exclusões do antivírus.
    pub folder: Option<String>,
    pub exists: bool,
    /// O arquivo existia (achado ao abrir o app ou já verificado nesta execução) e não existe mais.
    /// Quase sempre é o antivírus colocando o motor em quarentena.
    pub vanished: bool,
    pub size_bytes: Option<u64>,
    pub sha256: Option<String>,
    pub expected_sha256: &'static str,
    pub hash_ok: bool,
    pub version: Option<String>,
    pub expected_version: &'static str,
    pub version_ok: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonInfo {
    pub state: DaemonState,
    /// `<APPDATA>\modlock\state` dos processos do Modlock.
    pub state_dir: String,
    pub socket_path: String,
    /// O Windows limita caminhos de socket AF_UNIX a ~108 caracteres; acima disso o daemon não sobe.
    pub socket_path_too_long: bool,
    pub status: Option<DaemonStatus>,
    pub expected_origin: Option<String>,
    pub origin_ok: bool,
    /// O daemon atual foi iniciado por este app (e então é parado quando o app fecha).
    pub started_by_app: bool,
    pub log_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameCheck {
    pub exe: &'static str,
    pub running: bool,
    pub pids: Vec<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostsCheck {
    pub path: String,
    pub host: &'static str,
    pub readable: bool,
    #[serde(flatten)]
    pub entries: HostsMatch,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvEntry {
    pub name: &'static str,
    pub value: Option<String>,
    /// `app` (lida pelo app) ou `modlock` (definida pelo app nos processos do Modlock).
    pub scope: &'static str,
    pub purpose: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionKind {
    Host,
    Join,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: u64,
    pub kind: SessionKind,
    pub pid: u32,
    pub started_at: u64,
    /// Pasta do projeto (host) ou código usado (join).
    pub target: String,
    pub join_code: Option<String>,
    pub running: bool,
    pub exit_code: Option<i32>,
    /// Etapa do handoff a que a sessão chegou (`progress.rs`): 0 baixando o modo, 1 abrindo o
    /// jogo, 2 entrando, 3 dentro. `None` antes do primeiro evento que conta.
    pub step: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopReport {
    pub session: Option<SessionInfo>,
    /// A sessão não terminou depois de fechar a entrada e o processo cliente foi encerrado.
    pub session_forced: bool,
    pub daemon_was_running: bool,
    pub daemon: DaemonInfo,
}

/// O que vai para a interface a cada linha da sessão.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
    pub session: u64,
    pub kind: SessionKind,
    /// `stdout`, `stderr` ou `fim`.
    pub stream: &'static str,
    pub event: Option<CliEvent>,
    pub exit_code: Option<i32>,
    /// A etapa do handoff, só quando este evento a fez avançar.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step: Option<u8>,
    /// Algo deu errado: o modo falhou no servidor (`host.failed`) ou a sessão terminou com erro
    /// (`fim` com código diferente de 0, sem ter sido o app que encerrou). Mesmo formato dos erros
    /// dos comandos; `detail` traz as últimas linhas da sessão.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<EngineError>,
}

pub type EventSink = std::sync::Arc<dyn Fn(SessionEvent) + Send + Sync>;
