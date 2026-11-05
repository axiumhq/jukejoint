//! Teste com o `modlock.exe` de verdade: check, subir o daemon e parar com `modlock daemon stop`.
//! Não abre o jogo nem roda `host`/`join`. Fica fora do `cargo test` normal; para rodar:
//!
//! ```powershell
//! $env:MODLOCK_BIN = '...\tools\modlock-v0.1.73\modlock.exe'
//! $env:ENGINE_ORIGIN = 'http://127.0.0.1:9'          # porta fechada: o daemon só tenta sinalizar
//! $env:ENGINE_STATE_DIR = "$env:USERPROFILE\.mlD"    # pasta curta e separada da padrão
//! cargo test --test real_cli -- --ignored --nocapture
//! ```

use std::sync::Arc;

use app_desktop_lib::engine::{
    args,
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

/// O `modlock.exe` fixado precisa aceitar cada comando que o app chama. A v0.1.73 tirou o
/// `host`, e o app só descobriu na hora de hospedar: este teste pega isso na atualização.
#[test]
#[ignore = "precisa do modlock.exe real (MODLOCK_BIN)"]
fn pinned_cli_accepts_the_commands_the_app_runs() {
    let bin = std::env::var("MODLOCK_BIN").expect("defina MODLOCK_BIN");
    let help = |cmd: &str| {
        let out = std::process::Command::new(&bin)
            .args([cmd, "--help"])
            .env("MODLOCK_NO_UPDATE_CHECK", "1")
            .output()
            .expect("rodar o modlock");
        let text = String::from_utf8_lossy(&out.stdout).to_string() + &String::from_utf8_lossy(&out.stderr);
        // Um comando que não existe responde "No help topic" e sai com erro (a v0.1.73 com `host`).
        assert!(out.status.success() && !text.contains("No help topic"), "o modlock fixado não tem o comando {cmd}:
{text}");
        text
    };
    // Cada chamada do app: o comando (primeiro argumento depois de --json) e as opções que ele passa.
    let code = app_desktop_lib::engine::validate::JoinCode::parse("k7Qx-29_zz").unwrap();
    for call in [args::host(), args::join(&code, "https://sinal.example")] {
        let words: Vec<&str> = call.iter().map(String::as_str).filter(|a| *a != "--json").collect();
        let text = help(words[0]);
        for flag in words.iter().filter(|a| a.starts_with("--")) {
            assert!(text.contains(flag), "`modlock {}` não aceita {flag}", words[0]);
        }
    }
    let daemon = help("daemon");
    for flag in args::daemon_start("https://sinal.example").iter().filter(|a| a.starts_with("--")) {
        assert!(daemon.contains(flag.as_str()), "`modlock daemon` não aceita {flag}");
    }
}
