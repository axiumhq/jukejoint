//! Catálogo de modos: o site manda só o slug do modo (`engine_host { mode }`) e o app resolve a
//! pasta do projeto dentro de uma raiz configurável. O site nunca manda caminho.
//!
//! **Modo de teste:** enquanto não há modos de verdade, todo slug conhecido aponta para o projeto
//! `hello` (o do spike, `spike/mods/hello`). Quando um modo real existir, a linha dele em [`MODES`]
//! passa a apontar para a pasta própria e `test` vira `false`.

use std::path::{Path, PathBuf};

use serde::Serialize;

use super::{validate, EngineError};

/// Raiz das pastas de projeto. Sem ela: em build de dev, `spike/mods` do repositório; no app
/// empacotado, a pasta `modos` ao lado do executável.
pub const ENV_PROJECTS_DIR: &str = "ENGINE_PROJECTS_DIR";
/// Nome da pasta ao lado do executável, sem `ENGINE_PROJECTS_DIR`.
pub const BESIDE_APP_DIR: &str = "modos";
/// O projeto de teste (o `hello` do spike).
pub const TEST_PROJECT: &str = "hello";

/// Um modo que o app sabe hospedar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ModeEntry {
    pub slug: &'static str,
    /// Nome da pasta do projeto dentro da raiz (só um nome, nunca caminho).
    pub project: &'static str,
    /// O modo ainda abre o projeto de teste no lugar do conteúdo de verdade.
    pub test: bool,
}

/// Os modos do site (`web/src/data/modes.ts`, os mesmos de `server/internal/lobby/lobby.go`).
/// Todos abrem o projeto de teste por enquanto.
pub const MODES: &[ModeEntry] = &[
    ModeEntry { slug: "circulo-profano", project: TEST_PROJECT, test: true },
    ModeEntry { slug: "ultimo-bonde", project: TEST_PROJECT, test: true },
    ModeEntry { slug: "neblina", project: TEST_PROJECT, test: true },
    ModeEntry { slug: "duelo-meia-noite", project: TEST_PROJECT, test: true },
    ModeEntry { slug: "cerco-ao-cofre", project: TEST_PROJECT, test: true },
    ModeEntry { slug: "campo-de-treino", project: TEST_PROJECT, test: true },
];

/// Slug de modo como o site manda: `[a-z0-9]` e hífens simples, de 1 a 64, começando e
/// terminando com letra ou número. Nada de ponto, barra, dois-pontos, maiúscula ou espaço.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModeSlug(String);

impl ModeSlug {
    pub const MAX: usize = 64;

    pub fn parse(raw: &str) -> Result<Self, EngineError> {
        let b = raw.as_bytes();
        let ok = (1..=Self::MAX).contains(&b.len())
            && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-')
            && b[0] != b'-'
            && b[b.len() - 1] != b'-'
            && !raw.contains("--");
        if ok {
            Ok(Self(raw.to_string()))
        } else {
            Err(EngineError::new("modo_invalido", "Esse modo não abre por este app. Atualize a página e tente de novo.")
                .with_detail(format!("Slug de modo recusado: {:?}", truncate(raw, 80))))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

fn truncate(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

/// Onde ficam os projetos e quais modos o app conhece.
#[derive(Debug, Clone)]
pub struct Catalog {
    /// A raiz e de onde ela veio (`ENGINE_PROJECTS_DIR`, a pasta do repositório em dev ou a
    /// pasta ao lado do app). `None`: nenhuma das três existe.
    pub root: Option<(PathBuf, &'static str)>,
    pub modes: &'static [ModeEntry],
}

/// Um modo resolvido para a pasta do projeto, já conferida.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolved {
    pub slug: String,
    pub dir: PathBuf,
    pub test: bool,
}

/// O que a checagem mostra sobre o catálogo.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModesCheck {
    pub root: Option<String>,
    pub source: Option<String>,
    /// Todos os modos abrem o projeto de teste (`hello`).
    pub test_mode: bool,
    pub test_project: &'static str,
    /// A pasta do projeto de teste existe e tem `mod.json`.
    pub test_project_ok: bool,
}

impl Catalog {
    /// Raiz pela variável, senão a do repositório (só em build de dev), senão a do lado do app.
    pub fn resolve_root(env: &dyn Fn(&str) -> Option<String>, exe_dir: Option<&Path>, dev_dir: Option<PathBuf>) -> Option<(PathBuf, &'static str)> {
        if let Some(p) = env(ENV_PROJECTS_DIR).map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) {
            return Some((PathBuf::from(p), ENV_PROJECTS_DIR));
        }
        if let Some(d) = dev_dir.filter(|d| d.is_dir()) {
            return Some((d, "spike/mods do repositório (dev)"));
        }
        exe_dir.map(|d| (d.join(BESIDE_APP_DIR), "ao lado do app"))
    }

    pub fn new(root: Option<(PathBuf, &'static str)>) -> Self {
        Self { root, modes: MODES }
    }

    fn entry(&self, slug: &ModeSlug) -> Option<&'static ModeEntry> {
        self.modes.iter().find(|m| m.slug == slug.as_str())
    }

    /// Slug → pasta do projeto. Recusa slug desconhecido, raiz ausente, pasta sem `mod.json` e
    /// qualquer pasta que, depois de seguir links, saia da raiz.
    pub fn resolve(&self, slug: &ModeSlug) -> Result<Resolved, EngineError> {
        let entry = self.entry(slug).ok_or_else(|| {
            EngineError::new("modo_desconhecido", "Esta versão do app ainda não conhece esse modo. Atualize o app para hospedar.")
                .with_detail(format!("Modo {} fora do catálogo do app.", slug.as_str()))
        })?;
        let missing = |detail: String| {
            EngineError::new(
                "modo_ausente",
                "Os arquivos do modo não estão nesta cópia do app. Avise quem te passou o app.",
            )
            .with_detail(detail)
        };
        let Some((root, source)) = &self.root else {
            return Err(missing(format!("Sem pasta de projetos: defina {ENV_PROJECTS_DIR}.")));
        };
        // O nome vem da tabela fixa, mas a regra vale igual: um nome, nunca um caminho.
        if !is_plain_name(entry.project) {
            return Err(missing(format!("Projeto com nome inválido na tabela: {}", entry.project)));
        }
        let root_c = root
            .canonicalize()
            .map_err(|_| missing(format!("A pasta de projetos não existe: {} ({source}).", root.display())))?;
        let dir = validate::project_dir(&root_c.join(entry.project))
            .map_err(|e| missing(format!("{} Raiz: {} ({source}).", e.message, root_c.display())))?;
        if !dir.starts_with(&root_c) {
            return Err(missing(format!("{} sai da pasta de projetos {}.", dir.display(), root_c.display())));
        }
        Ok(Resolved { slug: entry.slug.to_string(), dir, test: entry.test })
    }

    pub fn check(&self) -> ModesCheck {
        let test_project_ok = self
            .root
            .as_ref()
            .and_then(|(r, _)| r.canonicalize().ok())
            .map(|r| validate::project_dir(&r.join(TEST_PROJECT)).is_ok())
            .unwrap_or(false);
        ModesCheck {
            root: self.root.as_ref().map(|(r, _)| r.display().to_string()),
            source: self.root.as_ref().map(|(_, s)| s.to_string()),
            test_mode: self.modes.iter().all(|m| m.test),
            test_project: TEST_PROJECT,
            test_project_ok,
        }
    }
}

/// Um nome de pasta simples: sem separador, sem `..`, sem dois-pontos (drive ou fluxo NTFS).
fn is_plain_name(s: &str) -> bool {
    !s.is_empty() && s != "." && s != ".." && !s.contains(['/', '\\', ':']) && Path::new(s).components().count() == 1
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_root(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("engine-modes-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join(TEST_PROJECT)).unwrap();
        std::fs::write(d.join(TEST_PROJECT).join("mod.json"), r#"{"slug":"hello"}"#).unwrap();
        d
    }

    #[test]
    fn slug_accepts_the_site_modes() {
        for m in MODES {
            assert_eq!(ModeSlug::parse(m.slug).unwrap().as_str(), m.slug);
        }
        assert!(ModeSlug::parse("a").is_ok());
        assert!(ModeSlug::parse(&"a".repeat(64)).is_ok());
    }

    #[test]
    fn slug_rejects_paths_and_junk() {
        for bad in [
            "", "-neblina", "neblina-", "neb--lina", "Neblina", "neblina ", " neblina", "..", ".", "../hello", "..\\hello",
            "hello/..", "C:\\mods\\hello", "C:", "/etc", "neblina.json", "neblina:stream", "neblina\0", "néblina", "neblina%2f",
            "neblina\n", &"a".repeat(65),
        ] {
            let e = ModeSlug::parse(bad).unwrap_err();
            assert_eq!(e.code, "modo_invalido", "deveria recusar {bad:?}");
        }
    }

    #[test]
    fn every_site_mode_is_in_the_catalog() {
        // Os slugs de web/src/data/modes.ts (`slug: '...'`): o site não pode oferecer um modo que
        // o app não sabe hospedar.
        let src = include_str!("../../../../web/src/data/modes.ts");
        let slugs: Vec<&str> = src
            .split("slug: '")
            .skip(1)
            .filter_map(|rest| rest.split('\'').next())
            .collect();
        assert!(slugs.len() >= 6, "leu {slugs:?}");
        for s in slugs {
            assert!(MODES.iter().any(|m| m.slug == s), "modo {s} do site fora do catálogo do app");
        }
    }

    #[test]
    fn every_mode_resolves_to_the_test_project() {
        let root = tmp_root("ok");
        let cat = Catalog::new(Some((root.clone(), ENV_PROJECTS_DIR)));
        for m in MODES {
            let r = cat.resolve(&ModeSlug::parse(m.slug).unwrap()).unwrap();
            assert!(r.test);
            assert!(r.dir.ends_with(TEST_PROJECT));
            assert!(r.dir.starts_with(root.canonicalize().unwrap()));
        }
        let c = cat.check();
        assert!(c.test_mode && c.test_project_ok);
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn unknown_mode_and_missing_folders() {
        let root = tmp_root("miss");
        let cat = Catalog::new(Some((root.clone(), ENV_PROJECTS_DIR)));
        assert_eq!(cat.resolve(&ModeSlug::parse("nao-existe").unwrap()).unwrap_err().code, "modo_desconhecido");
        std::fs::remove_file(root.join(TEST_PROJECT).join("mod.json")).unwrap();
        let e = cat.resolve(&ModeSlug::parse("neblina").unwrap()).unwrap_err();
        assert_eq!(e.code, "modo_ausente");
        assert!(e.detail.unwrap().contains("mod.json"));
        assert!(!cat.check().test_project_ok);
        let none = Catalog::new(None);
        assert_eq!(none.resolve(&ModeSlug::parse("neblina").unwrap()).unwrap_err().code, "modo_ausente");
        let gone = Catalog::new(Some((root.join("nao-existe"), ENV_PROJECTS_DIR)));
        assert_eq!(gone.resolve(&ModeSlug::parse("neblina").unwrap()).unwrap_err().code, "modo_ausente");
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn table_names_cannot_escape_the_root() {
        // Mesmo uma linha errada na tabela não sai da raiz.
        static BAD: &[ModeEntry] = &[
            ModeEntry { slug: "sobe", project: "..", test: true },
            ModeEntry { slug: "barra", project: "a/../../x", test: true },
            ModeEntry { slug: "drive", project: "C:\\Windows", test: true },
        ];
        let root = tmp_root("esc");
        let cat = Catalog { root: Some((root.join(TEST_PROJECT), ENV_PROJECTS_DIR)), modes: BAD };
        for slug in ["sobe", "barra", "drive"] {
            assert_eq!(cat.resolve(&ModeSlug::parse(slug).unwrap()).unwrap_err().code, "modo_ausente", "{slug}");
        }
        assert!(!is_plain_name("..") && !is_plain_name("a\\b") && !is_plain_name("") && is_plain_name("hello"));
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn root_from_env_then_dev_then_beside_app() {
        let env = |k: &str| (k == ENV_PROJECTS_DIR).then(|| r"D:\modos".to_string());
        assert_eq!(Catalog::resolve_root(&env, None, None).unwrap(), (PathBuf::from(r"D:\modos"), ENV_PROJECTS_DIR));
        let blank = |k: &str| (k == ENV_PROJECTS_DIR).then(|| "  ".to_string());
        let d = std::env::temp_dir();
        assert_eq!(Catalog::resolve_root(&blank, None, Some(d.clone())).unwrap().0, d);
        let exe = Path::new(r"C:\App");
        let r = Catalog::resolve_root(&|_| None, Some(exe), Some(d.join("nao-existe-xyz"))).unwrap();
        assert_eq!(r, (exe.join(BESIDE_APP_DIR), "ao lado do app"));
        assert!(Catalog::resolve_root(&|_| None, None, None).is_none());
    }
}
