//! App desktop: uma janela com o site (`web/`), a tela Instalação (`desktop/src/`), o deep link
//! `<esquema>://join/<id>` com instância única e o `EngineAdapter` sobre o Modlock fixado.

mod commands;
pub mod deeplink;
pub mod engine;
mod notice;

use std::sync::Arc;

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
/// Com `1`, o app registra o esquema do deep link no Windows (HKCU) ao abrir. O instalador
/// (ainda não feito) é quem deve registrar; isto é para testar sem ele.
pub const ENV_REGISTER_SCHEME: &str = "APP_REGISTER_SCHEME";

/// Eventos que o app manda para as janelas.
pub const EV_ENGINE: &str = "engine://event";
pub const EV_CHECK: &str = "engine://check";
pub const EV_DEEP_LINK: &str = "app://deep-link";
/// Um link `<esquema>://join/...` chegou e foi recusado; o payload é o motivo (`formato`,
/// `esquema`, `acao`, `id`). Quem joga já vê um aviso nativo; o evento é para o site, se quiser.
pub const EV_DEEP_LINK_INVALID: &str = "app://deep-link-invalido";
/// Para a tela Instalação dizer por que abriu sozinha (`window.__INSTALL_OPENED_BY__` ou este evento,
/// se a janela já existia).
pub const EV_INSTALL_OPENED_BY: &str = "install://opened-by";
/// A primeira checagem ao abrir o app encontrou algo que impede hospedar ou entrar.
pub const OPENED_BY_CHECK: &str = "checagem";

pub struct AppState {
    pub engine: Arc<ModlockCli>,
}

pub fn run() {
    let app = tauri::Builder::default()
        // Precisa ser o primeiro plugin: uma segunda execução repassa os argumentos (o link) para
        // esta e encerra; com a feature deep-link, o link chega em on_open_url.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let sink: EventSink = Arc::new(move |ev| {
                let _ = handle.emit(EV_ENGINE, ev);
            });
            let engine = Arc::new(ModlockCli::new(EngineConfig::from_env(), sink));
            app.manage(AppState { engine: engine.clone() });

            if tauri::is_dev() {
                allow_install_dev_server(app)?;
            }

            // Link de quando o app foi aberto por ele (partida a frio): a janela já abre na sala.
            // Link inválido: abre na página inicial e avisa por quê.
            let first = deeplink::find_in_args(std::env::args().skip(1), SLUG).map(|u| (deeplink::parse_join(&u, SLUG), u));
            let start = match &first {
                Some((Ok(id), _)) => format!("sala/{}", id.as_str()),
                _ => String::new(),
            };
            create_main_window(app.handle(), &start)?;
            if let Some((Err(e), url)) = &first {
                eprintln!("deep link ignorado ({e:?}): {url:.80}");
                notice::invalid_link(app.handle());
            }

            setup_deep_link(app)?;
            setup_tray(app)?;

            // Primeira checagem em segundo plano; se faltar algo, abre a tela Instalação.
            let h = app.handle().clone();
            std::thread::spawn(move || {
                let report = engine.check();
                if !report.ready {
                    let _ = open_install_window_for(&h, Some(OPENED_BY_CHECK));
                }
                let _ = h.emit(EV_CHECK, &report);
            });
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
        "version": env!("CARGO_PKG_VERSION"),
        "modlockVersion": MODLOCK_VERSION,
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

fn create_main_window(app: &AppHandle, path: &str) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App(path.into()))
        .title(BRAND_NAME)
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

/// Link validado: traz a janela para frente e abre a sala `/sala/<id>` do site. Link inválido:
/// traz a janela e mostra um aviso nativo.
fn handle_link(app: &AppHandle, url: &str) {
    match deeplink::parse_join(url, SLUG) {
        Ok(id) => {
            show_main(app);
            if let Some(w) = app.get_webview_window(MAIN) {
                if let Ok(mut u) = w.url() {
                    u.set_path(&format!("/sala/{}", id.as_str()));
                    u.set_query(None);
                    u.set_fragment(None);
                    let _ = w.navigate(u);
                }
            }
            let _ = app.emit_to(MAIN, EV_DEEP_LINK, id.as_str());
        }
        Err(e) => {
            // Nada de sumir em silêncio: traz a janela, avisa quem joga e conta ao site.
            eprintln!("deep link ignorado ({e:?}): {url:.80}");
            show_main(app);
            let _ = app.emit_to(MAIN, EV_DEEP_LINK_INVALID, e.reason());
            notice::invalid_link(app);
        }
    }
}

fn setup_deep_link(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_deep_link::DeepLinkExt;
    if std::env::var(ENV_REGISTER_SCHEME).as_deref() == Ok("1") {
        app.deep_link().register_all()?;
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
