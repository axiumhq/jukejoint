//! Validação estrita de tudo que vem de fora (site, deep link, variáveis de ambiente) antes de
//! virar argumento de processo. Nada aqui chama o sistema, só confere texto e caminhos.

use std::path::{Path, PathBuf};

use super::EngineError;

/// Código de entrada de uma sessão (`modlock join <CÓDIGO>`). Só ASCII alfanumérico, `-` e `_`,
/// começando por alfanumérico (nunca por `-`, para não virar opção da linha de comando).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JoinCode(String);

impl JoinCode {
    pub const MIN: usize = 4;
    pub const MAX: usize = 128;

    pub fn parse(raw: &str) -> Result<Self, EngineError> {
        if is_token(raw, Self::MIN, Self::MAX) {
            Ok(Self(raw.to_string()))
        } else {
            Err(EngineError::new(
                "codigo_invalido",
                "Código de entrada inválido: use só letras, números, - e _ (4 a 128 caracteres).",
            ))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Id de lobby vindo do deep link `<esquema>://join/<id>`. Mesmas regras do código, de 1 a 64.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LobbyId(String);

impl LobbyId {
    pub const MAX: usize = 64;

    pub fn parse(raw: &str) -> Option<Self> {
        is_token(raw, 1, Self::MAX).then(|| Self(raw.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// `[A-Za-z0-9][A-Za-z0-9_-]*`, com tamanho entre `min` e `max`.
fn is_token(s: &str, min: usize, max: usize) -> bool {
    let b = s.as_bytes();
    (min..=max).contains(&b.len())
        && b[0].is_ascii_alphanumeric()
        && b.iter().all(|c| c.is_ascii_alphanumeric() || *c == b'-' || *c == b'_')
}

/// Origem do servidor de sinalização (`modlock daemon --origin`). Aceita `http(s)://host[:porta]`,
/// sem usuário, caminho, consulta ou fragmento, e recusa o hyperline.gg: a plataforma nunca deve
/// cair na origem padrão do Modlock.
pub fn origin(raw: &str) -> Result<String, EngineError> {
    let bad = |why: &str| EngineError::new("origem_invalida", format!("ENGINE_ORIGIN inválida ({why}): {raw}"));
    let s = raw.trim().trim_end_matches('/');
    if s.len() > 200 || s.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(bad("tamanho ou espaços"));
    }
    let rest = s
        .strip_prefix("https://")
        .or_else(|| s.strip_prefix("http://"))
        .ok_or_else(|| bad("precisa começar com http:// ou https://"))?;
    if rest.is_empty() || rest.contains(['/', '?', '#', '@', '\\']) {
        return Err(bad("só esquema, host e porta"));
    }
    // Só nome ou IPv4, com porta opcional (IPv6 literal fica de fora de propósito).
    let host = match rest.split_once(':') {
        Some((h, port)) => {
            if port.is_empty() || !port.bytes().all(|c| c.is_ascii_digit()) || port.parse::<u16>().is_err() {
                return Err(bad("porta"));
            }
            h
        }
        None => rest,
    };
    let host_ok = !host.is_empty()
        && !host.starts_with(['-', '.'])
        && host.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-'));
    if !host_ok {
        return Err(bad("host"));
    }
    let lower = host.to_ascii_lowercase();
    if lower == "hyperline.gg" || lower.ends_with(".hyperline.gg") {
        return Err(bad("o app não usa o hyperline.gg"));
    }
    Ok(s.to_string())
}

/// Pasta de um projeto de mod para `modlock host`: absoluta, existente e com `mod.json`.
/// Devolve o caminho canônico.
pub fn project_dir(raw: &Path) -> Result<PathBuf, EngineError> {
    let bad = |why: &str| EngineError::new("projeto_invalido", format!("Projeto inválido ({why}): {}", raw.display()));
    if !raw.is_absolute() {
        return Err(bad("o caminho precisa ser absoluto"));
    }
    let dir = raw.canonicalize().map_err(|_| bad("a pasta não existe"))?;
    if !dir.is_dir() {
        return Err(bad("não é uma pasta"));
    }
    if !dir.join("mod.json").is_file() {
        return Err(bad("falta o mod.json"));
    }
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_code_accepts_plain_tokens() {
        for ok in ["ABCD", "k7Qx-29_zz", "12D3KooWJgFBUDpUMHnrLnuYhT3VMBagjQzmKdA7seKk61BfYgrS"] {
            assert_eq!(JoinCode::parse(ok).unwrap().as_str(), ok);
        }
    }

    #[test]
    fn join_code_rejects_flags_paths_and_shell() {
        for bad in [
            "", "abc", "-abc", "--ui-relay", "_abcd", "abc d", "abcd;calc", "ab&cd", "abcd\"", "a/bcd",
            "..\\abcd", "abcd\n", "códigó", "https://x.y/abcd", &"a".repeat(129),
        ] {
            assert!(JoinCode::parse(bad).is_err(), "deveria recusar {bad:?}");
        }
    }

    #[test]
    fn lobby_id_rules() {
        assert!(LobbyId::parse("l01").is_some());
        assert!(LobbyId::parse("a").is_some());
        assert!(LobbyId::parse(&"a".repeat(64)).is_some());
        for bad in ["", "-l01", "l01/x", "l 01", "l01?x", "%41", &"a".repeat(65)] {
            assert!(LobbyId::parse(bad).is_none(), "deveria recusar {bad:?}");
        }
    }

    #[test]
    fn origin_accepts_lan_and_tunnel() {
        assert_eq!(origin("http://192.168.0.10:8080").unwrap(), "http://192.168.0.10:8080");
        assert_eq!(origin("https://abc-def.trycloudflare.com/").unwrap(), "https://abc-def.trycloudflare.com");
        assert_eq!(origin("http://localhost:8080").unwrap(), "http://localhost:8080");
    }

    #[test]
    fn origin_rejects_hyperline_and_junk() {
        for bad in [
            "https://hyperline.gg",
            "https://HYPERLINE.GG",
            "https://api.hyperline.gg",
            "ftp://x.y",
            "x.y",
            "http://",
            "http://a b",
            "http://user@x.y",
            "http://x.y/path",
            "http://x.y?q",
            "http://x.y:99999",
            "http://x.y:",
            "http://x.y:80a",
        ] {
            assert!(origin(bad).is_err(), "deveria recusar {bad:?}");
        }
    }

    #[test]
    fn project_dir_needs_mod_json() {
        let base = std::env::temp_dir().join(format!("engine-proj-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).unwrap();
        assert_eq!(project_dir(&base).unwrap_err().code, "projeto_invalido");
        std::fs::write(base.join("mod.json"), "{}").unwrap();
        assert!(project_dir(&base).is_ok());
        assert!(project_dir(Path::new("relativo\\mod")).is_err());
        assert!(project_dir(&base.join("nao-existe")).is_err());
        std::fs::remove_dir_all(&base).unwrap();
    }
}
