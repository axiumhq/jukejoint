//! O que o adaptador lê do sistema: processos rodando, a trava do daemon, o hash do binário e
//! o arquivo hosts. Nada aqui escreve no sistema nem usa WMI.

use std::{
    fs::{File, OpenOptions, TryLockError},
    io::{self, Read},
    path::{Path, PathBuf},
};

use serde::Serialize;
use sha2::{Digest, Sha256};

/// Estado do daemon de uma pasta de estado (`<APPDATA>\modlock\state`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DaemonState {
    /// Um daemon segura `daemon.lock` durante toda a vida.
    Rodando,
    Parado,
    /// `modlock.sock` existe mas ninguém segura a trava: o daemon foi encerrado à força e o
    /// Windows não libera o socket até reiniciar.
    SocketTravado,
}

/// Lê o estado sem tocar no daemon. Mesma lógica de `Test-DaemonRunning` em `scripts/spike/comum.ps1`.
pub fn daemon_state(state_dir: &Path) -> DaemonState {
    let lock = state_dir.join("daemon.lock");
    let sock = state_dir.join("modlock.sock");
    let held = match OpenOptions::new().read(true).write(true).open(&lock) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => false,
        // Aberto sem compartilhamento por outro processo: o daemon está de pé.
        Err(_) => true,
        Ok(f) => match f.try_lock() {
            Ok(()) => {
                let _ = f.unlock();
                false
            }
            Err(TryLockError::WouldBlock) => true,
            Err(TryLockError::Error(_)) => true,
        },
    };
    if held {
        DaemonState::Rodando
    } else if sock.exists() {
        DaemonState::SocketTravado
    } else {
        DaemonState::Parado
    }
}

/// SHA-256 em hexadecimal minúsculo, lendo o arquivo em blocos.
pub fn sha256_file(path: &Path) -> io::Result<String> {
    let mut f = File::open(path)?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(hex(&h.finalize()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// `%SystemRoot%\System32\drivers\etc\hosts`.
pub fn hosts_path() -> PathBuf {
    let root = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
    PathBuf::from(root).join("System32").join("drivers").join("etc").join("hosts")
}

/// Compara o nome do executável sem diferenciar maiúsculas.
pub fn exe_matches(exe: &str, name: &str) -> bool {
    exe.eq_ignore_ascii_case(name)
}

/// PIDs dos processos com este nome de executável, pelo snapshot do Toolhelp (sem WMI).
#[cfg(windows)]
pub fn process_ids_named(name: &str) -> io::Result<Vec<u32>> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    // SAFETY: chamadas Win32 documentadas; o handle é fechado no fim e a estrutura tem dwSize certo.
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut out = Vec::new();
        let mut ok = Process32FirstW(snap, &mut entry);
        while ok != 0 {
            let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
            if exe_matches(&String::from_utf16_lossy(&entry.szExeFile[..len]), name) {
                out.push(entry.th32ProcessID);
            }
            ok = Process32NextW(snap, &mut entry);
        }
        CloseHandle(snap);
        Ok(out)
    }
}

#[cfg(not(windows))]
pub fn process_ids_named(_name: &str) -> io::Result<Vec<u32>> {
    Ok(Vec::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("engine-sys-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn daemon_state_from_files() {
        let d = temp("state");
        assert_eq!(daemon_state(&d), DaemonState::Parado);
        std::fs::write(d.join("daemon.lock"), "").unwrap();
        assert_eq!(daemon_state(&d), DaemonState::Parado);
        let held = File::options().read(true).write(true).open(d.join("daemon.lock")).unwrap();
        held.lock().unwrap();
        assert_eq!(daemon_state(&d), DaemonState::Rodando);
        drop(held);
        std::fs::write(d.join("modlock.sock"), "").unwrap();
        assert_eq!(daemon_state(&d), DaemonState::SocketTravado);
        std::fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn sha256_known_value() {
        let d = temp("hash");
        let f = d.join("abc.txt");
        std::fs::write(&f, "abc").unwrap();
        assert_eq!(sha256_file(&f).unwrap(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        std::fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn exe_name_match() {
        assert!(exe_matches("Deadlock.EXE", "deadlock.exe"));
        assert!(!exe_matches("deadlock.exe.bak", "deadlock.exe"));
    }

    #[test]
    fn process_list_finds_this_test() {
        let me = std::env::current_exe().unwrap();
        let name = me.file_name().unwrap().to_string_lossy().to_string();
        let pids = process_ids_named(&name).unwrap();
        if cfg!(windows) {
            assert!(pids.contains(&std::process::id()));
        }
    }
}
