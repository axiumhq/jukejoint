//! Lê o nome da marca de `web/src/config/brand.ts` (a única fonte), passa para o código
//! como `APP_BRAND_NAME`/`APP_SLUG` e confere que o `tauri.conf.json` repete os mesmos valores
//! (nome do produto e esquema do deep link). Se alguém trocar o nome num lugar só, o build para
//! com uma mensagem dizendo o que ajustar.

use std::{fs, path::Path};

/// Comandos do app expostos ao front. Cada um vira as permissões `allow-<nome>`/`deny-<nome>`;
/// as janelas só recebem as que estão em `capabilities/*.json`.
const COMMANDS: &[&str] = &[
    "app_info",
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

/// Nome da marca em minúsculas só com [a-z0-9]: "Lobby" vira "lobby".
fn slug(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}
