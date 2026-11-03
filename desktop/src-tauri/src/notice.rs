//! Avisos nativos para quem joga, quando o app não tem como mostrar nada no site (o site é de
//! outro módulo e não pode depender do app para isso). Hoje só um: o link de convite inválido.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager};

/// A frase do aviso. Diz o que houve e o que fazer, sem jargão.
pub const INVALID_LINK: &str = "Este link de convite não abriu: ele não está no formato certo. \
Talvez tenha sido cortado ao copiar.\n\nPeça o link de novo para quem convidou você.";

/// Um aviso por vez: vários links ruins seguidos não empilham caixas.
static SHOWING: AtomicBool = AtomicBool::new(false);

/// Mostra o aviso de link inválido sobre a janela do site, sem travar o app (a caixa roda numa
/// thread própria; a janela do site fica atrás dela até a pessoa clicar em OK).
pub fn invalid_link(app: &AppHandle) {
    if SHOWING.swap(true, Ordering::SeqCst) {
        return;
    }
    let owner = owner_of(app);
    std::thread::spawn(move || {
        message_box(owner, crate::BRAND_NAME, INVALID_LINK);
        SHOWING.store(false, Ordering::SeqCst);
    });
}

#[cfg(windows)]
fn owner_of(app: &AppHandle) -> isize {
    app.get_webview_window(crate::MAIN).and_then(|w| w.hwnd().ok()).map(|h| h.0 as isize).unwrap_or(0)
}

#[cfg(not(windows))]
fn owner_of(_app: &AppHandle) -> isize {
    0
}

#[cfg(windows)]
fn message_box(owner: isize, title: &str, text: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONINFORMATION, MB_OK, MB_SETFOREGROUND};
    let wide = |s: &str| s.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
    let (text, title) = (wide(text), wide(title));
    // SAFETY: as duas strings terminam em zero e vivem até a caixa fechar; `owner` é a janela do
    // site ou 0 (sem dono).
    unsafe {
        MessageBoxW(owner as _, text.as_ptr(), title.as_ptr(), MB_OK | MB_ICONINFORMATION | MB_SETFOREGROUND);
    }
}

#[cfg(not(windows))]
fn message_box(_owner: isize, title: &str, text: &str) {
    eprintln!("{title}: {text}");
}
