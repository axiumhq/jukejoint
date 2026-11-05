//! App desktop: uma janela com o site (`web/`), a tela Instalação (`desktop/src/`), o deep link
//! `<esquema>://join/<id>` e `<esquema>://auth/<código>` (login no navegador) com instância única
//! e o `EngineAdapter` sobre o Modlock fixado.

pub mod auth;
mod commands;
pub mod deeplink;
pub mod engine;
mod notice;

use std::sync::{Arc, Mutex};

use deeplink::{Link, LinkError};
use engine::{
    modlock::{EngineConfig, ModlockCli},
    EngineAdapter, EventSink, MODLOCK_VERSION,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// Nome da marca, lido de `web/src/config/brand.ts` pelo build.rs.
pub const BRAND_NAME: &str = env!("APP_BRAND_NAME");
/// Nome curto da marca; também é o esquema do deep link.
pub const SLUG: &str = env!("APP_SLUG");

pub const MAIN: &str = "main";
pub const INSTALL: &str = "instalacao";
/// Em dev, a tela Instalação vem do Vite do `desktop/` (o site vem do Vite do `web/`, no devUrl).
const INSTALL_DEV_URL: &str = "http://localhost:5281/";
/// Registro do esquema do deep link no Windows (HKCU, sem administrador), apontando para este
/// exe. O exe de release registra a cada abertura (enquanto não há instalador, é o que faz o login
/// pela Steam e os convites voltarem para o app, onde quer que a pasta esteja); `0` desliga. O
/// build de dev só registra com `1`, para não tomar o link do exe de verdade.
pub const ENV_REGISTER_SCHEME: &str = "APP_REGISTER_SCHEME";

/// Eventos que o app manda para as janelas.
pub const EV_ENGINE: &str = "engine://event";
pub const EV_CHECK: &str = "engine://check";
pub const EV_DEEP_LINK: &str = "app://deep-link";
/// Um link `<esquema>://join/...` chegou e foi recusado; o payload é o motivo (`formato`,
/// `esquema`, `acao`, `id`). Quem joga já vê um aviso nativo; o evento é para o site, se quiser.
pub const EV_DEEP_LINK_INVALID: &str = "app://deep-link-invalido";
/// Um link `<esquema>://auth/<código>` válido chegou com o app aberto: o payload é o código
/// (string de 43 caracteres), mandado só para a janela do site, que o troca pelo token.
pub const EV_AUTH_CODE: &str = "app://auth-code";
/// Para a tela Instalação dizer por que abriu sozinha (`window.__INSTALL_OPENED_BY__` ou este evento,
/// se a janela já existia).
pub const EV_INSTALL_OPENED_BY: &str = "install://opened-by";
/// A primeira checagem ao abrir o app encontrou algo que impede hospedar ou entrar.
pub const OPENED_BY_CHECK: &str = "checagem";

pub struct AppState {
    pub engine: Arc<ModlockCli>,
}

#[derive(Default)]
struct PendingLinks(Mutex<Vec<String>>);

pub fn run() {
    let app = tauri::Builder::default()
        // Precisa ser o primeiro plugin: uma segunda execução repassa os argumentos (o link) para
        // esta e encerra; com a feature deep-link, o link chega em on_open_url.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let sink: EventSink = Arc::new(move |ev| {
                let _ = handle.emit(EV_ENGINE, ev);
            });
            let resource_dir = app.path().resource_dir()?;
            let engine = Arc::new(ModlockCli::new(EngineConfig::from_env_with_resources(Some(&resource_dir)), sink));
            app.manage(AppState { engine: engine.clone() });
            app.manage(PendingLinks::default());

            if tauri::is_dev() {
                allow_install_dev_server(app)?;
            }

            // Link de quando o app foi aberto por ele (partida a frio): a janela já abre na sala.
            // Convite inválido: abre na página inicial e avisa por quê. Link de login (válido ou
            // não): abre na inicial sem aviso; o login começou noutra execução do app, que guardava
            // o verifier, então não há como terminar. Basta clicar em Entrar de novo.
            let first = deeplink::find_in_args(std::env::args().skip(1), SLUG).map(|u| (deeplink::parse(&u, SLUG), u));
            let start = match &first {
                Some((Ok(Link::Join(id)), _)) => format!("sala/{}", id.as_str()),
                _ => String::new(),
            };
            if cfg!(windows) && !tauri::is_dev() {
                create_startup_window(app.handle())?;
                let h = app.handle().clone();
                let startup_engine = engine.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = check_startup_update(&h).await {
                        eprintln!("não foi possível atualizar ao iniciar: {e}");
                    }
                    if let Err(e) = create_main_window(&h, &start) {
                        eprintln!("não foi possível abrir o app: {e}");
                        h.exit(1);
                        return;
                    }
                    let pending = std::mem::take(&mut *h.state::<PendingLinks>().0.lock().unwrap());
                    for url in pending {
                        handle_link(&h, &url);
                    }
                    if let Some(window) = h.get_webview_window("startup") {
                        let _ = window.close();
                    }
                    check_engine_on_start(h, startup_engine);
                });
            } else {
                create_main_window(app.handle(), &start)?;
                check_engine_on_start(app.handle().clone(), engine.clone());
            }
            match &first {
                Some((Ok(Link::Auth(_)), _)) => eprintln!("auth link received at cold start: ignored (no verifier)"),
                Some((Err(LinkError::AuthCode), url)) => eprintln!("deep link ignorado (AuthCode): {}", deeplink::for_log(url)),
                Some((Err(e), url)) => {
                    eprintln!("deep link ignorado ({e:?}): {}", deeplink::for_log(url));
                    notice::invalid_link(app.handle());
                }
                _ => {}
            }

            setup_deep_link(app)?;
            setup_tray(app)?;

            // Primeira checagem em segundo plano; se faltar algo, abre a tela Instalação.
            Ok(())
        })
        .on_window_event(|window, event| {
            // Fechar a janela do site fecha o app (nada fica em segundo plano; o ícone na bandeja
            // é só um atalho enquanto ela está aberta e some junto).
            if window.label() == MAIN {
                if let WindowEvent::CloseRequested { .. } = event {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::auth_open_browser,
            commands::open_install_window,
            commands::engine_check,
            commands::engine_daemon_start,
            commands::engine_daemon_stop,
            commands::engine_host,
            commands::engine_join,
            commands::engine_stop,
            commands::engine_session,
        ])
        .build(tauri::generate_context!())
        .expect("falha ao iniciar o app");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            // Encerra a sessão e o daemon que este app subiu, sempre com `daemon stop`.
            handle.state::<AppState>().engine.shutdown();
        }
    });
}

/// Objeto que o site e a tela Instalação podem ler para saber que estão dentro do app.
fn init_script() -> String {
    let info = serde_json::json!({
        "name": BRAND_NAME,
        "scheme": SLUG,
        "version": env!("APP_VERSION"),
        "dev": tauri::is_dev(),
        "modlockVersion": MODLOCK_VERSION,
        "apiUrl": auth::api_url(),
    });
    format!(
        "Object.defineProperty(window,'__DESKTOP_APP__',{{value:Object.freeze({info}),writable:false,configurable:false}});"
    )
}

/// Cor da janela antes da primeira pintura: a do tema Deadlock (`--bg`, hsl(170 16% 7%)). O tema
/// salvo fica no localStorage do WebView, que o Rust não lê antes de a janela existir; o script
/// inline do `<head>` (site e tela Instalação) já pinta o primeiro quadro no tema certo, então esta
/// cor só aparece num instante antes disso.
const WINDOW_BG: tauri::window::Color = tauri::window::Color(10, 15, 14, 255);

fn create_startup_window(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "startup", WebviewUrl::App("startup.html".into()))
        .title(BRAND_NAME)
        .inner_size(420.0, 180.0)
        .center()
        .resizable(false)
        .closable(false)
        .background_color(WINDOW_BG)
        .build()?;
    Ok(())
}

async fn check_startup_update(app: &AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater_builder().timeout(std::time::Duration::from_secs(15)).build()?;
    if let Some(update) = updater.check().await? {
        update.download_and_install(|_, _| {}, || {}).await?;
    }
    Ok(())
}

fn check_engine_on_start(app: AppHandle, engine: Arc<ModlockCli>) {
    std::thread::spawn(move || {
        let report = engine.check();
        if !report.ready {
            let _ = open_install_window_for(&app, Some(OPENED_BY_CHECK));
        }
        let _ = app.emit(EV_CHECK, &report);
    });
}

fn create_main_window(app: &AppHandle, path: &str) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App(path.into()))
        .title(BRAND_NAME)
        .decorations(false)
        .inner_size(1360.0, 860.0)
        .min_inner_size(960.0, 640.0)
        .background_color(WINDOW_BG)
        .initialization_script(init_script())
        .build()?;
    Ok(())
}

pub fn open_install_window(app: &AppHandle) -> tauri::Result<()> {
    open_install_window_for(app, None)
}

/// Abre a tela Instalação; com `reason`, a tela diz no topo por que abriu sem ninguém pedir.
pub fn open_install_window_for(app: &AppHandle, reason: Option<&'static str>) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(INSTALL) {
        if let Some(r) = reason {
            let _ = app.emit_to(INSTALL, EV_INSTALL_OPENED_BY, r);
        }
        let _ = w.unminimize();
        w.show()?;
        return w.set_focus();
    }
    let url = if tauri::is_dev() {
        WebviewUrl::External(INSTALL_DEV_URL.parse().expect("url de dev"))
    } else {
        WebviewUrl::App("_app/index.html".into())
    };
    let mut b = WebviewWindowBuilder::new(app, INSTALL, url)
        .title(format!("Instalação · {BRAND_NAME}"))
        .inner_size(1080.0, 800.0)
        .min_inner_size(720.0, 560.0)
        .background_color(WINDOW_BG)
        .initialization_script(init_script());
    if let Some(r) = reason {
        let v = serde_json::Value::from(r);
        b = b.initialization_script(format!(
            "Object.defineProperty(window,'__INSTALL_OPENED_BY__',{{value:{v},writable:false,configurable:false}});"
        ));
    }
    b.build()?;
    Ok(())
}

/// Em dev a tela Instalação roda em outra porta, que o Tauri trata como remota: libera para ela
/// as mesmas permissões da capability `instalacao` (e só em dev).
fn allow_install_dev_server(app: &tauri::App) -> tauri::Result<()> {
    let cap = tauri::ipc::CapabilityBuilder::new("instalacao-dev")
        .remote(format!("{INSTALL_DEV_URL}*"))
        .window(INSTALL)
        .permission("core:event:allow-listen")
        .permission("core:event:allow-unlisten")
        .permission("allow-app-info")
        .permission("allow-engine-check")
        .permission("allow-engine-daemon-start")
        .permission("allow-engine-daemon-stop")
        .permission("allow-engine-session");
    app.add_capability(cap)
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Link com o app já aberto: traz a janela para frente e conta ao site, que navega pelo React
/// Router até `/sala/<id>` (sem recarregar a página), troca o código de login pelo token ou mostra
/// o aviso do link inválido. O aviso nativo fica só para a partida a frio, quando o site ainda não
/// carregou (ver `run`). O código de login nunca vai para o log.
fn handle_link(app: &AppHandle, url: &str) {
    {
        let pending = app.state::<PendingLinks>();
        let mut links = pending.0.lock().unwrap();
        if app.get_webview_window(MAIN).is_none() {
            links.push(url.to_owned());
            return;
        }
    }
    show_main(app);
    match deeplink::parse(url, SLUG) {
        Ok(Link::Join(id)) => {
            let _ = app.emit_to(MAIN, EV_DEEP_LINK, id.as_str());
        }
        Ok(Link::Auth(code)) => {
            eprintln!("auth link received");
            let _ = app.emit_to(MAIN, EV_AUTH_CODE, code.as_str());
        }
        Err(e) => {
            eprintln!("deep link ignorado ({e:?}): {}", deeplink::for_log(url));
            let _ = app.emit_to(MAIN, EV_DEEP_LINK_INVALID, e.reason());
        }
    }
}

fn setup_deep_link(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_deep_link::DeepLinkExt;
    let flag = std::env::var(ENV_REGISTER_SCHEME).ok();
    if should_register(tauri::is_dev(), flag.as_deref()) {
        // Falhar aqui não impede o app de abrir: só o link vindo do navegador deixa de chegar.
        if let Err(e) = app.deep_link().register_all() {
            eprintln!("não deu para registrar o esquema {SLUG}://: {e}");
        }
    }
    let h = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            handle_link(&h, url.as_str());
        }
    });
    Ok(())
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "abrir", format!("Abrir {BRAND_NAME}"), true, None::<&str>)?;
    let install = MenuItem::with_id(app, "instalacao", "Instalação", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "sair", "Fechar o app", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &install, &quit])?;
    let mut tray = TrayIconBuilder::with_id("principal")
        // O ícone não quer dizer que o app fica em segundo plano: ele some quando a janela fecha.
        .tooltip(format!("{BRAND_NAME}: fechar a janela fecha o app"))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "abrir" => show_main(app),
            "instalacao" => {
                let _ = open_install_window(app);
            }
            "sair" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Release registra o esquema, a menos que `APP_REGISTER_SCHEME=0`; dev, só com `1`.
fn should_register(dev: bool, flag: Option<&str>) -> bool {
    match flag.map(str::trim) {
        Some("1") => true,
        Some("0") => false,
        _ => !dev,
    }
}

#[cfg(test)]
mod tests {
    use super::should_register;

    #[test]
    fn release_registers_by_default_dev_only_on_request() {
        assert!(should_register(false, None));
        assert!(should_register(false, Some("")));
        assert!(!should_register(false, Some("0")));
        assert!(!should_register(true, None));
        assert!(should_register(true, Some("1")));
    }
}
