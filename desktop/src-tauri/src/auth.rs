//! Login do app (estilo OAuth para apps nativos, RFC 8252 + PKCE). O site gera o `verifier` e o
//! `challenge`; o app só abre `<API>/auth/steam/login?app=<challenge>` no navegador padrão e,
//! quando o servidor devolve `<esquema>://auth/<código>`, repassa o código para a janela do site
//! (evento `app://auth-code`, ver `lib.rs`). O site troca o código pelo token com o `verifier`.
//! O app nunca vê o token, e o código nunca vai para o log.

use crate::engine::EngineError;

/// API deste build (`APP_API_URL`, conferida pelo build.rs); vazia quando o build não trouxe.
pub const API_URL: &str = env!("APP_API_URL");

/// Tamanho do challenge e do código: 32 bytes em base64url sem `=`.
pub const TOKEN_LEN: usize = 43;

/// Exatamente 43 caracteres `[A-Za-z0-9_-]` (base64url sem padding). Maiúsculas contam.
pub fn is_token(s: &str) -> bool {
    s.len() == TOKEN_LEN && s.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}

/// A API deste build, se houver.
pub fn api_url() -> Option<&'static str> {
    Some(API_URL).filter(|u| !u.is_empty())
}

/// Código de uso único vindo de `<esquema>://auth/<código>`. Nunca é alterado (nem para
/// minúsculas) nem registrado no log.
#[derive(Clone, PartialEq, Eq)]
pub struct AuthCode(String);

impl AuthCode {
    pub fn parse(raw: &str) -> Option<Self> {
        is_token(raw).then(|| Self(raw.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// O `Debug` não mostra o código (para não ir parar num log por acidente).
impl std::fmt::Debug for AuthCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("AuthCode(…)")
    }
}

/// `<api>/auth/steam/login?app=<challenge>`, com o challenge conferido.
pub fn login_url(api: Option<&str>, challenge: &str) -> Result<String, EngineError> {
    if !is_token(challenge) {
        return Err(EngineError::new(
            "desafio_invalido",
            "O login não começou: o app recebeu um pedido fora do formato. Recarregue a página e tente de novo.",
        )
        .with_detail(format!("challenge precisa ter {TOKEN_LEN} caracteres [A-Za-z0-9_-]")));
    }
    let api = api.ok_or_else(|| {
        EngineError::new(
            "sem_api",
            "Esta cópia do app foi feita sem o endereço do servidor, então não dá para entrar com a Steam por ela. Avise quem te passou o app.",
        )
        .with_detail("build sem APP_API_URL (o exe ao vivo sai de npm run build:live)")
    })?;
    Ok(format!("{api}/auth/steam/login?app={challenge}"))
}

/// Abre a URL no navegador padrão (ShellExecuteW "open"). Só chamar com URL `http(s)` montada
/// por [`login_url`]: a API vem conferida do build e o challenge, do [`is_token`].
#[cfg(windows)]
pub fn open_browser(url: &str) -> Result<(), EngineError> {
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    debug_assert!(url.starts_with("http://") || url.starts_with("https://"));
    let wide = |s: &str| s.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
    let (verb, file) = (wide("open"), wide(url));
    // SAFETY: as duas strings terminam em zero e vivem até a chamada voltar; os demais ponteiros
    // são nulos (sem janela dona, parâmetros ou pasta), como a documentação permite.
    let r = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    } as isize;
    // Acima de 32 é sucesso; até 32 é um código de erro do ShellExecute.
    if r > 32 {
        Ok(())
    } else {
        Err(browser_error().with_detail(format!("ShellExecuteW devolveu {r}")))
    }
}

#[cfg(not(windows))]
pub fn open_browser(_url: &str) -> Result<(), EngineError> {
    Err(browser_error().with_detail("abrir o navegador só está feito no Windows"))
}

fn browser_error() -> EngineError {
    EngineError::new(
        "navegador",
        "O app não conseguiu abrir o navegador para entrar com a Steam. Tente de novo; se continuar, confira se o Windows tem um navegador padrão.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const OK: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123-_Z";

    #[test]
    fn token_is_43_base64url_chars() {
        assert_eq!(OK.len(), 43);
        assert!(is_token(OK));
        assert!(!is_token(&OK[1..]));
        assert!(!is_token(&format!("{OK}a")));
        assert!(!is_token(""));
        for bad in ['=', '+', '/', '.', ' ', '%', '?'] {
            let s = format!("{}{bad}", &OK[1..]);
            assert_eq!(s.len(), 43);
            assert!(!is_token(&s), "deveria recusar {bad:?}");
        }
        // 43 bytes, mas não ASCII.
        assert!(!is_token(&format!("{}é", &OK[2..])));
    }

    #[test]
    fn auth_code_keeps_case_and_hides_itself() {
        let c = AuthCode::parse(OK).unwrap();
        assert_eq!(c.as_str(), OK);
        assert!(!format!("{c:?}").contains("abc"));
        assert!(AuthCode::parse(&OK.to_ascii_lowercase()).is_some_and(|l| l.as_str() != OK));
    }

    #[test]
    fn login_url_is_built_only_from_checked_parts() {
        assert_eq!(
            login_url(Some("http://localhost:8291"), OK).unwrap(),
            format!("http://localhost:8291/auth/steam/login?app={OK}")
        );
        assert_eq!(login_url(None, OK).unwrap_err().code, "sem_api");
        // O challenge é conferido antes da API: pedido torto não vira "sem API".
        assert_eq!(login_url(None, "curto").unwrap_err().code, "desafio_invalido");
        for bad in ["", "curto", &format!("{OK}&x=1"), &format!("{}#", &OK[1..])] {
            assert_eq!(login_url(Some("https://api.exemplo.com"), bad).unwrap_err().code, "desafio_invalido", "{bad:?}");
        }
    }

    #[test]
    fn build_api_url_is_a_bare_origin() {
        // Vazia no build comum; no build ao vivo, o build.rs já conferiu o formato.
        if let Some(api) = api_url() {
            assert!(api.starts_with("http://") || api.starts_with("https://"));
            assert!(!api.ends_with('/'));
        }
    }
}
