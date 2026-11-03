//! Leitura da saída do `modlock.exe`: versão, `daemon status`, eventos `--json` e o arquivo hosts.
//!
//! Com `--json`, cada linha é um `modlock.cli.Event` em JSON (protobuf). O corpo é um `oneof`:
//! `note`, `building`, `built`, `host` (um `control.HostEvent`), `published`, `sandbox`, `update`
//! ou `hosting` (com o código de entrada). Esquema lido do próprio binário v0.1.68.

use serde::Serialize;
use serde_json::{Map, Value};

/// `modlock version v0.1.68` → `v0.1.68`.
pub fn version(stdout: &str) -> Option<String> {
    stdout
        .split_whitespace()
        .find(|w| w.starts_with('v') && w[1..].starts_with(|c: char| c.is_ascii_digit()))
        .map(str::to_string)
}

/// Um evento da linha de comando, já separado por tipo para a interface.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CliEvent {
    /// Texto livre do Modlock (progresso, avisos).
    Note { text: String },
    /// A sessão hospedada já tem código de entrada.
    #[serde(rename_all = "camelCase")]
    Hosting { join_code: Option<String>, lobby: Option<Value> },
    /// Evento do servidor de jogo: `started`, `log`, `failed`, `joined`, `ready`, `ui`, `left`,
    /// `message`, `chat` ou `calls`.
    Host { event: String, data: Value },
    Building { dir: Option<String> },
    Built { dir: Option<String>, ok: bool },
    Sandbox { reason: Option<String> },
    Update { current: Option<String>, latest: Option<String> },
    Published { data: Value },
    /// JSON que esta versão do app não conhece; vai inteiro para a interface.
    Other { data: Value },
    /// Linha que não é JSON (por exemplo, stderr).
    Text { line: String },
}

/// Lê uma linha da saída. Linha vazia devolve `None`.
pub fn event(line: &str) -> Option<CliEvent> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    let Ok(Value::Object(obj)) = serde_json::from_str::<Value>(line) else {
        return Some(CliEvent::Text { line: line.to_string() });
    };
    // O oneof vem como um único campo; o protojson usa camelCase, mas aceitamos snake_case também.
    let (key, val) = match obj.iter().next() {
        Some((k, v)) if obj.len() == 1 => (k.as_str(), v.clone()),
        _ => return Some(CliEvent::Other { data: Value::Object(obj) }),
    };
    let field = |v: &Value, names: &[&str]| -> Option<Value> { names.iter().find_map(|n| v.get(*n).cloned()) };
    let text = |v: &Value, names: &[&str]| field(v, names).and_then(|x| x.as_str().map(str::to_string));
    Some(match key {
        "note" => CliEvent::Note { text: val.as_str().unwrap_or_default().to_string() },
        "hosting" => CliEvent::Hosting {
            join_code: text(&val, &["joinCode", "join_code"]),
            lobby: lobby_of(&val),
        },
        "host" => match val {
            Value::Object(m) if m.len() == 1 => {
                let (event, data) = m.into_iter().next().unwrap();
                CliEvent::Host { event, data }
            }
            other => CliEvent::Host { event: "unknown".into(), data: other },
        },
        "building" => CliEvent::Building { dir: text(&val, &["dir"]) },
        "built" => CliEvent::Built {
            dir: text(&val, &["dir"]),
            ok: field(&val, &["ok"]).and_then(|v| v.as_bool()).unwrap_or(false),
        },
        "sandbox" => CliEvent::Sandbox { reason: text(&val, &["reason"]) },
        "update" => CliEvent::Update { current: text(&val, &["current"]), latest: text(&val, &["latest"]) },
        "published" => CliEvent::Published { data: val },
        _ => CliEvent::Other { data: Value::Object(obj) },
    })
}

fn lobby_of(v: &Value) -> Option<Value> {
    let m = v.as_object()?;
    let mut out = Map::new();
    for (k, nk) in [("lobbyUrl", "lobbyUrl"), ("lobby_url", "lobbyUrl"), ("reconnecting", "reconnecting"), ("unlisted", "unlisted")] {
        if let Some(x) = m.get(k) {
            out.insert(nk.into(), x.clone());
        }
    }
    (!out.is_empty()).then_some(Value::Object(out))
}

/// Resultado de `modlock --json daemon status`, linhas `{"note":"chave: valor"}`.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonStatus {
    pub pid: Option<u32>,
    pub release: Option<String>,
    pub since: Option<String>,
    pub clients: Option<u32>,
    pub peer: Option<String>,
    /// Linha `signaling` inteira, como o Modlock escreve.
    pub signaling: Option<String>,
    /// A origem citada na linha `signaling`.
    pub origin: Option<String>,
}

pub fn daemon_status(stdout: &str) -> DaemonStatus {
    let mut st = DaemonStatus::default();
    for line in stdout.lines() {
        let note = match event(line) {
            Some(CliEvent::Note { text }) => text,
            Some(CliEvent::Text { line }) => line, // saída sem --json: "pid      72128"
            _ => continue,
        };
        let (k, v) = match note.split_once(':') {
            Some((k, v)) if !k.contains(' ') => (k.trim(), v.trim()),
            _ => match note.trim().split_once(char::is_whitespace) {
                Some((k, v)) => (k, v.trim()),
                None => continue,
            },
        };
        match k {
            "pid" => st.pid = v.parse().ok(),
            "release" => st.release = Some(v.to_string()),
            "since" => st.since = Some(v.to_string()),
            "clients" => st.clients = v.parse().ok(),
            "peer" => st.peer = Some(v.to_string()),
            "signaling" => {
                st.origin = v
                    .split_whitespace()
                    .find(|w| w.starts_with("http://") || w.starts_with("https://"))
                    .map(|w| w.trim_end_matches(['.', ',', ';', ')']).trim_end_matches('/').to_string());
                st.signaling = Some(v.to_string());
            }
            _ => {}
        }
    }
    st
}

/// Linhas do arquivo hosts que mapeiam exatamente um host.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostsMatch {
    /// Alguma linha manda o host para um endereço nulo (0.0.0.0, 127.0.0.1, ::1, ::).
    pub blocked: bool,
    /// As linhas encontradas, sem o comentário.
    pub lines: Vec<String>,
}

pub fn hosts_entries(contents: &str, host: &str) -> HostsMatch {
    let mut m = HostsMatch::default();
    for raw in contents.lines() {
        let line = raw.split('#').next().unwrap_or_default().trim();
        let mut parts = line.split_whitespace();
        let Some(ip) = parts.next() else { continue };
        if parts.any(|h| h.eq_ignore_ascii_case(host)) {
            m.lines.push(line.split_whitespace().collect::<Vec<_>>().join(" "));
            if matches!(ip, "0.0.0.0" | "127.0.0.1" | "::1" | "::") {
                m.blocked = true;
            }
        }
    }
    m
}

#[cfg(test)]
mod tests {
    use super::*;

    const STATUS: &str = include_str!("../../tests/fixtures/daemon-status.jsonl");
    const STATUS_TEXT: &str = include_str!("../../tests/fixtures/daemon-status.txt");
    const HOST: &str = include_str!("../../tests/fixtures/host-session.jsonl");
    const JOIN: &str = include_str!("../../tests/fixtures/join-session.jsonl");
    const HOSTS_BLOCKED: &str = include_str!("../../tests/fixtures/hosts-blocked.txt");
    const HOSTS_CLEAN: &str = include_str!("../../tests/fixtures/hosts-clean.txt");

    #[test]
    fn version_line() {
        assert_eq!(version("modlock version v0.1.68\r\n").as_deref(), Some("v0.1.68"));
        assert_eq!(version("garbage"), None);
        assert_eq!(version("version vX"), None);
    }

    #[test]
    fn daemon_status_json_capture() {
        let st = daemon_status(STATUS);
        assert_eq!(st.pid, Some(72128));
        assert_eq!(st.release.as_deref(), Some("v0.1.68"));
        assert_eq!(st.clients, Some(1));
        assert_eq!(st.peer.as_deref(), Some("12D3KooWJgFBUDpUMHnrLnuYhT3VMBagjQzmKdA7seKk61BfYgrS"));
        assert_eq!(st.origin.as_deref(), Some("http://127.0.0.1:9"));
        assert!(st.signaling.unwrap().starts_with("signed out"));
    }

    #[test]
    fn daemon_status_plain_text_capture() {
        let st = daemon_status(STATUS_TEXT);
        assert_eq!(st.pid, Some(72128));
        assert_eq!(st.release.as_deref(), Some("v0.1.68"));
        assert_eq!(st.origin.as_deref(), Some("http://127.0.0.1:9"));
    }

    #[test]
    fn host_session_events() {
        let evs: Vec<_> = HOST.lines().filter_map(event).collect();
        assert!(matches!(&evs[0], CliEvent::Building { dir: Some(d) } if d.ends_with("hello")));
        assert!(matches!(&evs[1], CliEvent::Built { ok: true, .. }));
        let code = evs.iter().find_map(|e| match e {
            CliEvent::Hosting { join_code, .. } => join_code.clone(),
            _ => None,
        });
        assert_eq!(code.as_deref(), Some("k7Qx29zz"));
        assert!(evs.iter().any(|e| matches!(e, CliEvent::Host { event, .. } if event == "ready")));
        assert!(evs.iter().any(|e| matches!(e, CliEvent::Host { event, data } if event == "joined" && data["name"] == "jogador")));
        assert!(evs.iter().any(|e| matches!(e, CliEvent::Text { line } if line.starts_with("time="))));
    }

    #[test]
    fn join_session_events() {
        let evs: Vec<_> = JOIN.lines().filter_map(event).collect();
        assert!(matches!(&evs[0], CliEvent::Note { text } if text.contains("content")));
        assert!(evs.iter().any(|e| matches!(e, CliEvent::Update { latest: Some(l), .. } if l == "v0.1.70")));
        assert!(matches!(evs.last().unwrap(), CliEvent::Other { .. }));
    }

    #[test]
    fn hosting_accepts_snake_case_and_lobby() {
        let e = event(r#"{"hosting":{"join_code":"ABCD1234","unlisted":"x"}}"#).unwrap();
        match e {
            CliEvent::Hosting { join_code, lobby } => {
                assert_eq!(join_code.as_deref(), Some("ABCD1234"));
                assert_eq!(lobby.unwrap()["unlisted"], "x");
            }
            other => panic!("{other:?}"),
        }
        assert_eq!(event("   "), None);
    }

    #[test]
    fn hosts_detection() {
        let b = hosts_entries(HOSTS_BLOCKED, "hyperline.gg");
        assert!(b.blocked);
        assert_eq!(b.lines, ["0.0.0.0 hyperline.gg"]);
        let c = hosts_entries(HOSTS_CLEAN, "hyperline.gg");
        assert!(!c.blocked);
        assert!(c.lines.is_empty());
        let other = hosts_entries("203.0.113.9 hyperline.gg\n", "hyperline.gg");
        assert!(!other.blocked);
        assert_eq!(other.lines.len(), 1);
        assert!(!hosts_entries("0.0.0.0 www.hyperline.gg\n", "hyperline.gg").blocked);
    }
}
