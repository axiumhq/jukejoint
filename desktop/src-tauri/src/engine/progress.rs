//! Eventos da sessão → etapas do handoff que o site mostra e manda ao servidor
//! (`handoff_progress`): 0 baixando o modo, 1 abrindo o jogo, 2 entrando, 3 dentro.
//!
//! Hospedar segue eventos estruturados (`building`, `built`, `hosting`, `host.ready`,
//! `host.joined`). Entrar só tem `note` em texto livre no `--json` da v0.1.68, então as regras são
//! palavras-chave: **não foram conferidas contra o jogo** e ficam numa tabela só para ajustar
//! depois do teste com dois PCs. A etapa nunca volta (o servidor também recusa).

use super::{CliEvent, SessionKind};

pub const STEP_MODE: u8 = 0;
pub const STEP_GAME: u8 = 1;
pub const STEP_ENTER: u8 = 2;
pub const STEP_INSIDE: u8 = 3;

/// Palavras de um `note` de `join`, da etapa mais adiantada para a primeira: vale a primeira que
/// aparecer no texto (em minúsculas).
const JOIN_NOTES: &[(u8, &[&str])] = &[
    (STEP_INSIDE, &["joined", "arrived", "in game", "in the game"]),
    (STEP_ENTER, &["connecting", "connected", "joining", "address"]),
    (STEP_GAME, &["launching", "starting deadlock", "opening deadlock", "deadlock"]),
    (STEP_MODE, &["download", "content", "mount"]),
];

/// A etapa que um evento indica, se indicar alguma.
pub fn step_of(kind: SessionKind, ev: &CliEvent) -> Option<u8> {
    match (kind, ev) {
        (_, CliEvent::Building { .. }) => Some(STEP_MODE),
        (_, CliEvent::Built { ok: true, .. }) => Some(STEP_GAME),
        (SessionKind::Host, CliEvent::Hosting { .. }) => Some(STEP_GAME),
        (_, CliEvent::Host { event, .. }) => match event.as_str() {
            "ready" | "started" => Some(STEP_ENTER),
            // Hospedando, o primeiro a entrar no servidor é o próprio jogo de quem hospeda.
            "joined" => Some(STEP_INSIDE),
            _ => None,
        },
        (SessionKind::Join, CliEvent::Note { text }) => {
            let t = text.to_lowercase();
            JOIN_NOTES.iter().find(|(_, words)| words.iter().any(|w| t.contains(w))).map(|(s, _)| *s)
        }
        _ => None,
    }
}

/// O progresso de uma sessão: só anda para frente.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct Progress {
    step: Option<u8>,
}

impl Progress {
    pub fn step(&self) -> Option<u8> {
        self.step
    }

    /// Aplica o evento; devolve a etapa nova só quando ela avançou.
    pub fn advance(&mut self, kind: SessionKind, ev: &CliEvent) -> Option<u8> {
        let s = step_of(kind, ev)?;
        if self.step.is_some_and(|cur| s <= cur) {
            return None;
        }
        self.step = Some(s);
        Some(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::parse;

    const HOST: &str = include_str!("../../tests/fixtures/host-session.jsonl");
    const JOIN: &str = include_str!("../../tests/fixtures/join-session.jsonl");

    fn steps(kind: SessionKind, src: &str) -> Vec<u8> {
        let mut p = Progress::default();
        src.lines().filter_map(parse::event).filter_map(|e| p.advance(kind, &e)).collect()
    }

    #[test]
    fn host_fixture_reaches_inside_in_order() {
        // building → built → hosting (já na 1, não repete) → ready → started (já na 2) → joined.
        assert_eq!(steps(SessionKind::Host, HOST), [STEP_MODE, STEP_GAME, STEP_ENTER, STEP_INSIDE]);
    }

    #[test]
    fn join_fixture_downloads_then_opens_the_game() {
        // "downloading the host's content" → 0; update e o JSON desconhecido não contam;
        // "launching Deadlock" → 1.
        assert_eq!(steps(SessionKind::Join, JOIN), [STEP_MODE, STEP_GAME]);
    }

    #[test]
    fn steps_never_go_back() {
        let mut p = Progress::default();
        let note = |t: &str| CliEvent::Note { text: t.into() };
        assert_eq!(p.advance(SessionKind::Join, &note("connecting to the host")), Some(STEP_ENTER));
        assert_eq!(p.advance(SessionKind::Join, &note("downloading the host's content")), None);
        assert_eq!(p.advance(SessionKind::Join, &note("launching Deadlock")), None);
        assert_eq!(p.step(), Some(STEP_ENTER));
        assert_eq!(p.advance(SessionKind::Join, &note("Joined the session")), Some(STEP_INSIDE));
        assert_eq!(p.advance(SessionKind::Join, &note("joined again")), None);
    }

    #[test]
    fn what_does_not_count() {
        let host = |e: &str| CliEvent::Host { event: e.into(), data: serde_json::json!({}) };
        for (kind, ev) in [
            (SessionKind::Host, CliEvent::Note { text: "launching Deadlock".into() }), // notas só contam no join
            (SessionKind::Join, CliEvent::Hosting { join_code: Some("x".into()), lobby: None }),
            (SessionKind::Host, CliEvent::Built { dir: None, ok: false }),
            (SessionKind::Host, host("log")),
            (SessionKind::Host, host("left")),
            (SessionKind::Host, host("failed")),
            (SessionKind::Join, CliEvent::Text { line: "time=... joined".into() }),
            (SessionKind::Join, CliEvent::Update { current: None, latest: None }),
            (SessionKind::Join, CliEvent::Note { text: "nothing to see".into() }),
        ] {
            assert_eq!(step_of(kind, &ev), None, "{kind:?} {ev:?}");
        }
        assert_eq!(step_of(SessionKind::Join, &host("joined")), Some(STEP_INSIDE));
    }
}
