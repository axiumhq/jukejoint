//! Lê o nome da marca de `web/src/config/brand.ts` (a única fonte), passa para o código
//! como `APP_BRAND_NAME`/`APP_SLUG` e confere que o `tauri.conf.json` repete os mesmos valores
//! (nome do produto e esquema do deep link). Se alguém trocar o nome num lugar só, o build para
//! com uma mensagem dizendo o que ajustar.
//!
//! Também lê, em tempo de build, `APP_API_URL` (a API que o site e o login do app usam) e
//! `APP_ENGINE_ORIGIN` (o padrão de `ENGINE_ORIGIN`). As duas são opcionais; definidas, precisam
//! ser só `http(s)://host[:porta]`. Viram `APP_API_URL`/`APP_ENGINE_ORIGIN` no código (vazias
//! quando não definidas).

use std::{fs, path::Path};

/// Comandos do app expostos ao front. Cada um vira as permissões `allow-<nome>`/`deny-<nome>`;
/// as janelas só recebem as que estão em `capabilities/*.json`.
const COMMANDS: &[&str] = &[
    "app_info",
    "auth_open_browser",
    "open_install_window",
    "engine_check",
    "engine_daemon_start",
    "engine_daemon_stop",
    "engine_host",
    "engine_join",
    "engine_stop",
    "engine_session",
];

fn main() {
    let brand_path = Path::new("../../web/src/config/brand.ts");
    println!("cargo:rerun-if-changed={}", brand_path.display());
    println!("cargo:rerun-if-changed=tauri.conf.json");

    let brand = fs::read_to_string(brand_path)
        .unwrap_or_else(|e| panic!("não consegui ler {}: {e}", brand_path.display()));
    let name = brand_name(&brand).expect("BRAND_NAME = '...' não encontrado em web/src/config/brand.ts");
    let slug = slug(&name);
    assert!(
        slug.len() >= 2 && slug.as_bytes()[0].is_ascii_lowercase(),
        "BRAND_NAME '{name}' não gera um esquema de URL válido (precisa começar com letra)"
    );

    let conf: serde_json::Value =
        serde_json::from_str(&fs::read_to_string("tauri.conf.json").expect("tauri.conf.json"))
            .expect("tauri.conf.json inválido");
    let product = conf["productName"].as_str().unwrap_or_default();
    assert_eq!(
        product, name,
        "tauri.conf.json: productName é '{product}', mas BRAND_NAME é '{name}'. Ajuste o productName."
    );
    let schemes: Vec<&str> = conf["plugins"]["deep-link"]["desktop"]["schemes"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
        .unwrap_or_default();
    assert_eq!(
        schemes,
        vec![slug.as_str()],
        "tauri.conf.json: plugins.deep-link.desktop.schemes deve ser [\"{slug}\"] (vem de BRAND_NAME)"
    );

    println!("cargo:rustc-env=APP_BRAND_NAME={name}");
    println!("cargo:rustc-env=APP_SLUG={slug}");

    println!("cargo:rerun-if-env-changed=APP_VERSION");
    let app_version = std::env::var("APP_VERSION").unwrap_or_else(|_| {
        std::env::var("CARGO_PKG_VERSION").expect("Cargo define CARGO_PKG_VERSION")
    });
    assert!(
        semver::Version::parse(&app_version).is_ok(),
        "APP_VERSION precisa ser uma versão SemVer válida: {app_version:?}"
    );
    println!("cargo:rustc-env=APP_VERSION={app_version}");

    for var in ["APP_API_URL", "APP_ENGINE_ORIGIN"] {
        println!("cargo:rerun-if-env-changed={var}");
        let raw = std::env::var(var).unwrap_or_default();
        let value = if raw.trim().is_empty() {
            String::new()
        } else {
            origin(&raw).unwrap_or_else(|why| {
                panic!(
                    "{var} inválida ({why}): {raw:?}. Use só esquema, host e porta, como http://localhost:8291 ou https://api.exemplo.com (sem caminho, consulta, fragmento ou usuário)."
                )
            })
        };
        println!("cargo:rustc-env={var}={value}");
    }

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("tauri-build falhou");
}

/// Extrai o valor de `export const BRAND_NAME = '...'` (aspas simples ou duplas).
fn brand_name(src: &str) -> Option<String> {
    let line = src.lines().find(|l| l.contains("const BRAND_NAME"))?;
    let rest = &line[line.find('=')? + 1..];
    let quote = rest.trim_start().chars().next().filter(|c| *c == '\'' || *c == '"')?;
    let start = rest.find(quote)? + 1;
    let len = rest[start..].find(quote)?;
    Some(rest[start..start + len].to_string())
}

/// Nome da marca em minúsculas só com [a-z0-9]: "Jukejoint" vira "jukejoint".
fn slug(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// `http(s)://host[:porta]`, com uma barra final opcional (tirada). Mesmas regras de
/// `validate::origin` no app e de `scripts/build-live.mjs`: só nome ou IPv4, nada de caminho,
/// consulta, fragmento ou usuário, e nunca o hyperline.gg.
fn origin(raw: &str) -> Result<String, &'static str> {
    let s = raw.trim();
    let s = s.strip_suffix('/').unwrap_or(s);
    if s.len() > 200 || !s.is_ascii() || s.bytes().any(|c| c.is_ascii_whitespace() || c.is_ascii_control()) {
        return Err("tamanho, espaços ou caracteres fora do ASCII");
    }
    let rest = s
        .strip_prefix("https://")
        .or_else(|| s.strip_prefix("http://"))
        .ok_or("precisa começar com http:// ou https://")?;
    if rest.is_empty() || rest.contains(['/', '?', '#', '@', '\\', '%']) {
        return Err("só esquema, host e porta");
    }
    let host = match rest.split_once(':') {
        Some((h, port)) => {
            if port.is_empty() || !port.bytes().all(|c| c.is_ascii_digit()) || !matches!(port.parse::<u16>(), Ok(1..)) {
                return Err("porta");
            }
            h
        }
        None => rest,
    };
    let host_ok = !host.is_empty()
        && !host.starts_with(['-', '.'])
        && !host.ends_with(['-', '.'])
        && host.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-'));
    if !host_ok {
        return Err("host");
    }
    let lower = host.to_ascii_lowercase();
    if lower == "hyperline.gg" || lower.ends_with(".hyperline.gg") {
        return Err("a plataforma não usa o hyperline.gg");
    }
    Ok(s.to_string())
}
