//! Teste com o `modlock.exe` de verdade: check, subir o daemon e parar com `modlock daemon stop`.
//! Não abre o jogo nem roda `host`/`join`. Fica fora do `cargo test` normal; para rodar:
//!
//! ```powershell
//! $env:MODLOCK_BIN = '...\tools\modlock-v0.1.68\modlock.exe'
//! $env:ENGINE_ORIGIN = 'http://127.0.0.1:9'          # porta fechada: o daemon só tenta sinalizar
//! $env:ENGINE_STATE_DIR = "$env:USERPROFILE\.mlD"    # pasta curta e separada da padrão
//! cargo test --test real_cli -- --ignored --nocapture
//! ```

use std::sync::Arc;

use app_desktop_lib::engine::{
    modlock::{EngineConfig, ModlockCli},
    DaemonState, EngineAdapter,
};

#[test]
#[ignore = "precisa do modlock.exe real (MODLOCK_BIN, ENGINE_ORIGIN, ENGINE_STATE_DIR)"]
fn check_start_and_stop_daemon() {
    let cfg = EngineConfig::from_env();
    assert!(cfg.state_override.is_some(), "defina ENGINE_STATE_DIR para não tocar na pasta de estado padrão");
    let engine = ModlockCli::new(cfg, Arc::new(|_| {}));

    let before = engine.check();
    println!("check antes:\n{}", serde_json::to_string_pretty(&before).unwrap());
    assert!(before.binary.hash_ok, "SHA-256 diferente do fixado");
    assert!(before.binary.version_ok, "versão diferente da fixada");
    assert!(before.ready, "{:?}", before.problems);
    assert_ne!(before.daemon.state, DaemonState::SocketTravado);

    let up = engine.start_daemon().expect("start_daemon");
    println!("daemon de pé: {}", serde_json::to_string_pretty(&up).unwrap());
    assert_eq!(up.state, DaemonState::Rodando);
    assert!(up.origin_ok, "o daemon deveria usar ENGINE_ORIGIN");
    assert!(up.started_by_app);

    // Idempotente: com o daemon já na nossa origem, não sobe outro.
    let again = engine.start_daemon().expect("start_daemon de novo");
    assert_eq!(again.status.as_ref().and_then(|s| s.pid), up.status.as_ref().and_then(|s| s.pid));

    let report = engine.stop().expect("stop");
    println!("stop: {}", serde_json::to_string_pretty(&report).unwrap());
    assert!(report.daemon_was_running);
    assert_eq!(report.daemon.state, DaemonState::Parado, "o socket deveria sumir com daemon stop");
    assert!(!std::path::Path::new(&report.daemon.socket_path).exists());
}
