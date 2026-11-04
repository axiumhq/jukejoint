//! Deep links do app. O esquema vem do nome da marca (ver build.rs). Dois formatos:
//!
//! - `<esquema>://join/<id-do-lobby>`: convite para uma sala;
//! - `<esquema>://auth/<código>`: a volta do login no navegador (ver `auth.rs`); o código tem
//!   exatamente 43 caracteres `[A-Za-z0-9_-]` e é mantido como veio (maiúsculas contam).
//!
//! A leitura é estrita: sem consulta, fragmento, porta, usuário ou percent-encoding, e só uma
//! barra final opcional. Esquema e ação não diferenciam maiúsculas. Qualquer coisa fora disso é
//! ignorada.

use crate::{auth::AuthCode, engine::LobbyId};

/// Tamanho máximo aceito para o link inteiro.
const MAX_LEN: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Link {
    Join(LobbyId),
    Auth(AuthCode),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LinkError {
    Format,
    Scheme,
    Action,
    LobbyId,
    /// Link de login com o código fora do formato.
    AuthCode,
}

impl LinkError {
    /// Código estável do motivo, mandado ao site no evento `app://deep-link-invalido`.
    pub fn reason(&self) -> &'static str {
        match self {
            LinkError::Format => "formato",
            LinkError::Scheme => "esquema",
            LinkError::Action => "acao",
            LinkError::LobbyId => "id",
            LinkError::AuthCode => "login",
        }
    }
}

/// Lê `jukejoint://join/l01` ou `jukejoint://auth/<código>` (barra final opcional).
pub fn parse(url: &str, scheme: &str) -> Result<Link, LinkError> {
    if url.len() > MAX_LEN || !url.is_ascii() || url.bytes().any(|b| b.is_ascii_control() || b == b' ') {
        return Err(LinkError::Format);
    }
    let (s, rest) = url.split_once("://").ok_or(LinkError::Format)?;
    if !s.eq_ignore_ascii_case(scheme) {
        return Err(LinkError::Scheme);
    }
    let rest = rest.strip_suffix('/').unwrap_or(rest);
    let (action, value) = rest.split_once('/').ok_or(LinkError::Action)?;
    if action.eq_ignore_ascii_case("join") {
        LobbyId::parse(value).map(Link::Join).ok_or(LinkError::LobbyId)
    } else if action.eq_ignore_ascii_case("auth") {
        AuthCode::parse(value).map(Link::Auth).ok_or(LinkError::AuthCode)
    } else {
        Err(LinkError::Action)
    }
}

/// Só o convite: um link de login aqui conta como ação errada.
pub fn parse_join(url: &str, scheme: &str) -> Result<LobbyId, LinkError> {
    match parse(url, scheme)? {
        Link::Join(id) => Ok(id),
        Link::Auth(_) => Err(LinkError::Action),
    }
}

/// O link como pode ir para o log: tudo depois de `auth` some (o código de login nunca é
/// registrado, nem num link recusado) e o resto é cortado em 80 caracteres.
pub fn for_log(url: &str) -> String {
    if let Some(i) = url.to_ascii_lowercase().find("auth") {
        return format!("{}…", url[..i + 4].chars().take(80).collect::<String>());
    }
    url.chars().take(80).collect()
}

/// Primeiro argumento da linha de comando que é um link do nosso esquema (o Windows abre o app
/// com o link como argumento).
pub fn find_in_args<I, S>(args: I, scheme: &str) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let prefix = format!("{scheme}:");
    args.into_iter()
        .map(|a| a.as_ref().to_string())
        .find(|a| a.len() > prefix.len() && a[..prefix.len()].eq_ignore_ascii_case(&prefix))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_the_one_format() {
        for ok in ["lobby://join/l01", "lobby://join/l01/", "LOBBY://JOIN/l01", "lobby://join/a-b_c9"] {
            let id = parse_join(ok, "lobby").unwrap_or_else(|e| panic!("{ok}: {e:?}"));
            assert!(ok.ends_with(id.as_str()) || ok.ends_with(&format!("{}/", id.as_str())));
        }
    }

    #[test]
    fn rejects_everything_else() {
        let cases: &[(&str, LinkError)] = &[
            ("outro://join/l01", LinkError::Scheme),
            ("lobby:join/l01", LinkError::Format),
            ("lobby://host/l01", LinkError::Action),
            ("lobby://join", LinkError::Action),
            ("lobby://join/", LinkError::Action),
            ("lobby://join//", LinkError::LobbyId),
            ("lobby://join/l01/extra", LinkError::LobbyId),
            ("lobby://join/l01?x=1", LinkError::LobbyId),
            ("lobby://join/l01#frag", LinkError::LobbyId),
            ("lobby://join/%6C01", LinkError::LobbyId),
            ("lobby://join/..", LinkError::LobbyId),
            ("lobby://join/-x", LinkError::LobbyId),
            ("lobby://user@join/l01", LinkError::Action),
            ("lobby://join:80/l01", LinkError::Action),
            ("lobby://join/l 01", LinkError::Format),
            ("lobby://join/l01\n", LinkError::Format),
            ("lobby://join/sála", LinkError::Format),
        ];
        for (url, want) in cases {
            assert_eq!(parse_join(url, "lobby").unwrap_err(), *want, "{url}");
        }
        let long = format!("lobby://join/{}", "a".repeat(300));
        assert_eq!(parse_join(&long, "lobby").unwrap_err(), LinkError::Format);
        let id65 = format!("lobby://join/{}", "a".repeat(65));
        assert_eq!(parse_join(&id65, "lobby").unwrap_err(), LinkError::LobbyId);
    }

    #[test]
    fn invalid_link_reasons_are_stable() {
        let got: Vec<_> = ["lobby:x", "outro://join/l01", "lobby://host/l01", "lobby://join/%zz"]
            .iter()
            .map(|u| parse_join(u, "lobby").unwrap_err().reason())
            .collect();
        assert_eq!(got, ["formato", "esquema", "acao", "id"]);
    }

    #[test]
    fn finds_link_in_argv() {
        let argv = ["C:\\app\\app.exe", "--flag", "lobby://join/l03"];
        assert_eq!(find_in_args(argv, "lobby").as_deref(), Some("lobby://join/l03"));
        assert_eq!(find_in_args(["app.exe", "lobbyx://join/l03"], "lobby"), None);
        assert_eq!(find_in_args(["app.exe"], "lobby"), None);
    }

    /// 43 caracteres base64url, com maiúsculas, `-` e `_` (e começando por `-`, que aqui pode).
    const CODE: &str = "-Ab9_zXy0123456789abcdefghijKLMNOPQRSTUVWXy";

    #[test]
    fn accepts_auth_links_and_keeps_the_code_as_is() {
        assert_eq!(CODE.len(), 43);
        for ok in [format!("lobby://auth/{CODE}"), format!("lobby://auth/{CODE}/"), format!("LOBBY://AUTH/{CODE}")] {
            match parse(&ok, "lobby") {
                Ok(Link::Auth(c)) => assert_eq!(c.as_str(), CODE, "{ok}"),
                other => panic!("{ok}: {other:?}"),
            }
        }
        // O convite continua igual pelo parse geral.
        assert_eq!(parse("lobby://join/l01", "lobby"), Ok(Link::Join(LobbyId::parse("l01").unwrap())));
        // parse_join não aceita link de login.
        assert_eq!(parse_join(&format!("lobby://auth/{CODE}"), "lobby").unwrap_err(), LinkError::Action);
    }

    #[test]
    fn rejects_bad_auth_links() {
        let cases: Vec<(String, LinkError)> = vec![
            (format!("lobby://auth/{}", &CODE[1..]), LinkError::AuthCode),
            (format!("lobby://auth/{CODE}a"), LinkError::AuthCode),
            ("lobby://auth/".to_string(), LinkError::Action),
            ("lobby://auth".to_string(), LinkError::Action),
            (format!("lobby://auth/{}=", &CODE[1..]), LinkError::AuthCode),
            (format!("lobby://auth/{}.", &CODE[1..]), LinkError::AuthCode),
            (format!("lobby://auth/{}%41", &CODE[3..]), LinkError::AuthCode),
            (format!("lobby://auth/{CODE}/extra"), LinkError::AuthCode),
            (format!("lobby://auth/{CODE}//"), LinkError::AuthCode),
            (format!("lobby://auth/{CODE}?x=1"), LinkError::AuthCode),
            (format!("lobby://auth/{CODE}#f"), LinkError::AuthCode),
            (format!("lobby://auth:80/{CODE}"), LinkError::Action),
            (format!("lobby://u@auth/{CODE}"), LinkError::Action),
            (format!("outro://auth/{CODE}"), LinkError::Scheme),
            (format!("lobby://auth/{} ", &CODE[1..]), LinkError::Format),
            (format!("lobby://auth/{}é", &CODE[2..]), LinkError::Format),
        ];
        for (url, want) in &cases {
            assert_eq!(parse(url, "lobby").unwrap_err(), *want, "{url}");
        }
        assert_eq!(LinkError::AuthCode.reason(), "login");
    }

    #[test]
    fn log_never_shows_the_auth_code() {
        let url = format!("lobby://auth/{CODE}?x");
        assert_eq!(for_log(&url), "lobby://auth…");
        assert!(!for_log(&format!("LOBBY://AUTH/{CODE}")).contains(CODE));
        assert_eq!(for_log("lobby://join/l01"), "lobby://join/l01");
        assert_eq!(for_log(&format!("lobby://join/{}", "a".repeat(200))).chars().count(), 80);
    }
}
