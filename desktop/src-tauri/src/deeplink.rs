//! Deep link `<esquema>://join/<id-do-lobby>`. O esquema vem do nome da marca (ver build.rs).
//! A leitura é estrita: um formato só, sem consulta, fragmento, porta, usuário ou
//! percent-encoding. Qualquer coisa fora disso é ignorada.

use crate::engine::LobbyId;

/// Tamanho máximo aceito para o link inteiro.
const MAX_LEN: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LinkError {
    Format,
    Scheme,
    Action,
    LobbyId,
}

impl LinkError {
    /// Código estável do motivo, mandado ao site no evento `app://deep-link-invalido`.
    pub fn reason(&self) -> &'static str {
        match self {
            LinkError::Format => "formato",
            LinkError::Scheme => "esquema",
            LinkError::Action => "acao",
            LinkError::LobbyId => "id",
        }
    }
}

/// Lê `jukejoint://join/l01` (barra final opcional) e devolve o id validado.
pub fn parse_join(url: &str, scheme: &str) -> Result<LobbyId, LinkError> {
    if url.len() > MAX_LEN || !url.is_ascii() || url.bytes().any(|b| b.is_ascii_control() || b == b' ') {
        return Err(LinkError::Format);
    }
    let (s, rest) = url.split_once("://").ok_or(LinkError::Format)?;
    if !s.eq_ignore_ascii_case(scheme) {
        return Err(LinkError::Scheme);
    }
    let rest = rest.strip_suffix('/').unwrap_or(rest);
    let (action, id) = rest.split_once('/').ok_or(LinkError::Action)?;
    if !action.eq_ignore_ascii_case("join") {
        return Err(LinkError::Action);
    }
    LobbyId::parse(id).ok_or(LinkError::LobbyId)
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
}
