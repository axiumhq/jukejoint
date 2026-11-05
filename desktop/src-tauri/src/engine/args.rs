//! Argumentos de cada chamada ao `modlock.exe`, como lista (nunca uma string montada para shell).
//! Base: o que `scripts/spike/` usa, com duas diferenças de propósito:
//! - `--json` (opção global) para ler eventos estruturados em vez de texto;
//! - em `join`, as opções vêm antes do código: o parser de linha de comando do Modlock pode parar
//!   de ler opções no primeiro argumento posicional.

use std::path::Path;

use super::validate::JoinCode;

/// Quanto tempo o daemon fica de pé sem clientes antes de encerrar sozinho.
pub const DAEMON_IDLE: &str = "60m";

pub fn version() -> Vec<String> {
    owned(&["--version"])
}

/// `modlock daemon --origin <origem> --idle 60m` (fica rodando; o app não espera).
pub fn daemon_start(origin: &str) -> Vec<String> {
    owned(&["daemon", "--origin", origin, "--idle", DAEMON_IDLE])
}

/// Só pode rodar com um daemon de pé: sem daemon, `status` sobe um apontando para o hyperline.gg.
pub fn daemon_status() -> Vec<String> {
    owned(&["--json", "daemon", "status"])
}

/// A única forma de parar o daemon. Encerrar o processo deixa um `modlock.sock` que o Windows
/// não libera até reiniciar.
pub fn daemon_stop() -> Vec<String> {
    owned(&["--json", "daemon", "stop"])
}

/// `modlock play --host`: hospeda só por código de convite (sem lobby no hyperline.gg) e sem a UI
/// dentro do jogo, que hoje carregaria a página-ponte do hyperline.gg. Roda com o diretório atual
/// no projeto. Até a v0.1.68 isso era `modlock host --no-lobby`; a v0.1.73 tirou o comando `host`
/// e o `play --host` manda o mesmo evento `hosting` com o código.
pub fn host() -> Vec<String> {
    owned(&["--json", "play", "--host", "--ui-port", "0"])
}

/// `modlock join` pelo código, com a nossa origem para links e sem a UI dentro do jogo.
pub fn join(code: &JoinCode, origin: &str) -> Vec<String> {
    let mut a = owned(&["--json", "join", "--ui-port", "0", "--origin", origin]);
    a.push(code.as_str().to_string());
    a
}

/// Variáveis que o app define para todo processo do Modlock: sem checagem de update (a versão é
/// fixada) e, opcionalmente, outra pasta de estado (o Modlock guarda o estado em `%APPDATA%`).
pub fn child_env(state_override: Option<&Path>) -> Vec<(String, String)> {
    let mut env = vec![("MODLOCK_NO_UPDATE_CHECK".to_string(), "1".to_string())];
    if let Some(dir) = state_override {
        env.push(("APPDATA".to_string(), dir.display().to_string()));
    }
    env
}

fn owned(a: &[&str]) -> Vec<String> {
    a.iter().map(|s| s.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn daemon_args() {
        assert_eq!(daemon_start("http://10.0.0.2:8080"), ["daemon", "--origin", "http://10.0.0.2:8080", "--idle", "60m"]);
        assert_eq!(daemon_status(), ["--json", "daemon", "status"]);
        assert_eq!(daemon_stop(), ["--json", "daemon", "stop"]);
        assert_eq!(version(), ["--version"]);
    }

    #[test]
    fn host_is_play_by_join_code() {
        // A v0.1.73 não tem mais `host`: chamar `modlock host` falha antes de hospedar.
        assert_eq!(host(), ["--json", "play", "--host", "--ui-port", "0"]);
        assert!(!host().iter().any(|a| a == "host" || a == "--no-lobby"));
    }

    #[test]
    fn join_puts_code_last_and_keeps_it_one_argument() {
        let code = JoinCode::parse("k7Qx-29_zz").unwrap();
        let a = join(&code, "https://sinal.example");
        assert_eq!(a, ["--json", "join", "--ui-port", "0", "--origin", "https://sinal.example", "k7Qx-29_zz"]);
        assert_eq!(a.last().unwrap(), "k7Qx-29_zz");
    }

    #[test]
    fn env_always_disables_update_check() {
        assert_eq!(child_env(None), [("MODLOCK_NO_UPDATE_CHECK".to_string(), "1".to_string())]);
        let e = child_env(Some(Path::new(r"C:\Users\x\.mlA")));
        assert_eq!(e[1], ("APPDATA".to_string(), r"C:\Users\x\.mlA".to_string()));
    }
}
