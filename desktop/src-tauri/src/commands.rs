//! Comandos Tauri. Cada um precisa de `allow-<nome>` na capability da janela
//! (`capabilities/*.json`); o site e a tela Instalação recebem conjuntos diferentes.

use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::{
    auth,
    engine::{
        modlock::ModlockCli, CheckReport, DaemonInfo, EngineAdapter, EngineError, JoinCode, ModeSlug, SessionInfo,
        StopReport, MODLOCK_VERSION,
    },
    AppState, BRAND_NAME, SLUG,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    name: &'static str,
    scheme: &'static str,
    version: &'static str,
    modlock_version: &'static str,
    /// A API deste build (`APP_API_URL`); `None` no build sem API.
    api_url: Option<&'static str>,
    dev: bool,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: BRAND_NAME,
        scheme: SLUG,
        version: env!("APP_VERSION"),
        modlock_version: MODLOCK_VERSION,
        api_url: auth::api_url(),
        dev: tauri::is_dev(),
    }
}

/// Começa o login do app: abre `<APP_API_URL>/auth/steam/login?app=<challenge>` no navegador
/// padrão. Só a janela do site pode chamar. Síncrono de propósito: roda na thread principal, que
/// já tem o COM iniciado (o ShellExecuteW pede isso).
#[tauri::command]
pub fn auth_open_browser(challenge: String) -> Result<(), EngineError> {
    let url = auth::login_url(auth::api_url(), &challenge)?;
    auth::open_browser(&url)
}

#[tauri::command]
pub async fn open_install_window(app: AppHandle) -> Result<(), EngineError> {
    crate::open_install_window(&app).map_err(|e| EngineError::new("janela", e.to_string()))
}

/// Roda a operação fora da thread da interface (hash de 80 MB, processos com espera).
async fn blocking<T: Send + 'static>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&ModlockCli) -> Result<T, EngineError> + Send + 'static,
) -> Result<T, EngineError> {
    let engine: Arc<ModlockCli> = state.engine.clone();
    tauri::async_runtime::spawn_blocking(move || f(&engine))
        .await
        .map_err(|e| EngineError::new("interno", e.to_string()))?
}

#[tauri::command]
pub async fn engine_check(state: State<'_, AppState>) -> Result<CheckReport, EngineError> {
    blocking(&state, |e| Ok(e.check())).await
}

#[tauri::command]
pub async fn engine_daemon_start(state: State<'_, AppState>) -> Result<DaemonInfo, EngineError> {
    blocking(&state, |e| e.start_daemon()).await
}

#[tauri::command]
pub async fn engine_daemon_stop(state: State<'_, AppState>) -> Result<DaemonInfo, EngineError> {
    blocking(&state, |e| e.stop_daemon()).await
}

/// Hospeda o modo `mode` (slug do site). O app resolve a pasta do projeto no próprio catálogo
/// (`engine/catalog.rs`); o site nunca manda caminho.
#[tauri::command]
pub async fn engine_host(state: State<'_, AppState>, mode: String) -> Result<SessionInfo, EngineError> {
    let mode = ModeSlug::parse(&mode)?;
    blocking(&state, move |e| e.host_mode(&mode)).await
}

#[tauri::command]
pub async fn engine_join(state: State<'_, AppState>, code: String) -> Result<SessionInfo, EngineError> {
    let code = JoinCode::parse(&code)?;
    blocking(&state, move |e| e.join(&code)).await
}

#[tauri::command]
pub async fn engine_stop(state: State<'_, AppState>) -> Result<StopReport, EngineError> {
    blocking(&state, |e| e.stop()).await
}

#[tauri::command]
pub async fn engine_session(state: State<'_, AppState>) -> Result<Option<SessionInfo>, EngineError> {
    Ok(state.engine.session())
}
