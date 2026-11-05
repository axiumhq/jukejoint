# Jukejoint

Plataforma gratuita de modos da comunidade para Deadlock, feita para o Brasil e a América Latina. Você cria ou acha uma sala, entra pela Steam, e o app abre o jogo já dentro do modo.

A partida é P2P: o jogo roda num servidor no PC de quem cria a sala, e os outros PCs se ligam direto a ele. O nosso servidor só faz login, lista as salas e apresenta os PCs uns aos outros. O motor que monta o modo dentro do Deadlock é o [Modlock](https://github.com/paralin/modlock) (MIT), fixado numa versão conferida por hash.

Projeto independente da comunidade. Não é afiliado à Valve. Deadlock é marca da Valve Corporation.

## Como as peças se ligam

```
  navegador ──────────┐
                      ▼
  app desktop ──▶ API (login Steam, salas, presença) ──── no Raspberry Pi, atrás de um túnel da Cloudflare
     │                │                                     api.jukejoint.app · signal.jukejoint.app
     │                └── sinalização (apresenta os PCs)
     ▼
  modlock.exe ──▶ Deadlock ◀═══ P2P (WebRTC/QUIC) ═══▶ Deadlock dos outros PCs
  (o modo roda no servidor do jogo, no PC de quem criou a sala)
```

1. O **site** (`web/`) e o **app desktop** (`desktop/`) mostram as salas e falam com a **API** (`server/`).
2. Quando a sala começa, o app chama o `modlock.exe` para hospedar ou entrar. O Modlock carrega o modo de `spike/mods/<modo>`, abre o Deadlock e liga os PCs pela **sinalização** (`spike/signal/`).
3. A API e a sinalização rodam em imagens Docker no Raspberry Pi do repositório [`axiumhq/infra-pi`](https://github.com/axiumhq/infra-pi).

## O que tem em cada pasta

| Pasta | O que é |
|---|---|
| `web/` | O site (React, Vite, TypeScript). Funciona com dados simulados ou com a API de verdade. O app desktop carrega este mesmo site. |
| `desktop/` | O app desktop (Tauri v2, Rust e React): a janela do site, a tela Instalação, o login, os links `jukejoint://`, o atualizador assinado e o `EngineAdapter`, que conversa com o `modlock.exe`. |
| `server/` | A API em Go: login pela Steam (OpenID), lista de salas, WebSocket das salas, presença e convites. O estado fica em memória por enquanto. |
| `spike/signal/` | O servidor de sinalização em Go, que os motores dos PCs usam para se achar antes de ligar o P2P. |
| `spike/mods/` | Os modos de jogo, em TypeScript, com a SDK do Modlock (ver [Modos](#modos)). |
| `spike/bridge/` | O teste da ponte entre a interface do Modlock e o site. |
| `scripts/` | `install-modlock.ps1` baixa o Modlock fixado e confere o hash. `publico/` tem o guia e os scripts do teste pela internet, e `spike/` os scripts do primeiro teste entre dois PCs. |
| `bin/modlock.cmd` | Roda o Modlock fixado de `tools/` sem a checagem de atualização. |
| `docs/` | Decisões e pesquisa: a decisão de plataforma, o adaptador do motor, o spike, o design e a análise de segurança do motor. |
| `art/` | Os arquivos do Blender da arte-chave (cidade, torre, herói) e as prévias. |
| `prototipos/` | Protótipos HTML de direções visuais, só de consulta. |
| `.github/workflows/` | CI, release, imagens Docker e a fila de merge (ver [Testes, CI e releases](#testes-ci-e-releases)). |
| `tools/` | **Fora do git.** O Go portátil, o `modlock-v0.1.73/` e os arquivos locais do teste público. |

## Modos

Cada modo é uma pasta em `spike/mods/` com `main.ts`, `mod.json`, um `README.md`, testes em Vitest contra uma SDK falsa (`test/`) e um autoteste (`probe.ts`) que roda no servidor de verdade do jogo, com bots e sem pessoas.

| Modo | Pasta | Situação |
|---|---|---|
| **Duelo à Meia-Noite** | `duelo-meia-noite` | De verdade. 1 contra 1, melhor de cinco, com fila, mesmo herói sorteado para os dois e placar na tela. |
| **Campo de Treino** | `campo-de-treino` | De verdade. Treino de alvos e comandos de treino (`/bot`, `/semRecarga`, `/vida`, `/almas`, `/item`). |
| Rotas | `rotas` | Protótipo, ainda só no [PR #17](https://github.com/axiumhq/jukejoint/pull/17), em rascunho. Rota de caixas com a ordem mais curta, e gravar e correr atalhos de movimento. |
| Medições | `medicoes` | Também no PR #17. Laboratório sem pessoas que mede andar, tirolesa e o tempo da wave. Não é um modo do site. |
| `hello` | `hello` | O modo de teste. Os outros quatro modos do site (Círculo Profano, Último Bonde, Neblina e Cerco ao Cofre) ainda abrem este. |

O catálogo que liga cada modo do site a uma pasta fica em `desktop/src-tauri/src/engine/catalog.rs`. Um modo novo de verdade entra em `MODES` com `test: false` e em `REAL_PROJECTS`; o `build-live.mjs` lê essa lista para empacotar o app.

## Começar

### O que instalar

- **Node** 20.19+ ou 22.12+ para o site (o app desktop usa o Node 24) e npm.
- **Go** 1.27 para a API e a sinalização. O repositório espera um Go portátil em `tools/go/` (`export PATH="$PWD/tools/go/bin:$PATH" GOTOOLCHAIN=local`), mas um Go instalado também serve.
- **Rust** 1.99.1 (fixado em `rust-toolchain.toml`), MSVC Build Tools 2022, Windows SDK e WebView2, para o app desktop.
- **O Modlock fixado**, para rodar modos e o app:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\install-modlock.ps1
  ```
  Ele baixa a versão de `desktop/src-tauri/src/engine/mod.rs` para `tools\modlock-v0.1.73\` e recusa o arquivo se o SHA-256 não bater com o publicado pelo GitHub.
- **Deadlock instalado pela Steam**, para rodar os modos e o autoteste.

### Só o site, com dados simulados

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Sem `VITE_API_URL`, o site usa dados simulados, e dá para navegar por tudo sem servidor.

### O site com a API local

```bash
cd server
DEV_LOGIN=1 go run .                           # http://127.0.0.1:8090, com login de teste

cd web
VITE_API_URL=http://localhost:8090 npm run dev
```

O `DEV_LOGIN=1` libera o botão "Entrar como teste (dev)". Para entrar com a Steam de verdade, a API precisa de uma chave da Steam Web API em `server/.data/steam-api-key`, pasta que fica fora do git. As variáveis estão em [`server/README.md`](server/README.md).

### O app desktop

```powershell
cd web;        npm ci
cd ..\desktop; npm ci
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:MODLOCK_BIN = "$PWD\..\tools\modlock-v0.1.73\modlock.exe"
npx tauri dev
```

Para gerar o app que fala com o servidor público, em `desktop\out\Jukejoint.zip`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publico\gerar-app.ps1
```

O passo a passo de um teste entre duas pessoas pela internet está em [`scripts/publico/LEIA.md`](scripts/publico/LEIA.md). Detalhes do app, das variáveis e do empacotamento estão em [`desktop/README.md`](desktop/README.md).

### Um modo, sem o app

Com o Deadlock fechado, na pasta do modo:

```powershell
cd spike\mods\duelo-meia-noite
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --watch                 # abre o jogo num servidor local com o modo
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --no-game --arg probe   # autoteste com bots, sem abrir o jogo: PASS ou FAIL
```

Os testes das regras, sem o jogo, usam o Vitest do site:

```powershell
node ..\..\..\web\node_modules\vitest\vitest.mjs run --config test\vitest.config.mts
```

O README de cada modo diz o que o autoteste confere e o que ainda só se prova com gente.

## Testes, CI e releases

| Onde | Comando |
|---|---|
| Site | `npm test --prefix web` · `npm run build --prefix web` |
| App (frente) | `npm run typecheck --prefix desktop` |
| App (Rust) | `cargo test --manifest-path desktop/src-tauri/Cargo.toml` |
| API e sinalização | `go vet ./... && go test ./...` em `server/` e em `spike/signal/` |
| Modos | o Vitest e o autoteste de cada pasta (ver acima) |

- **CI** (`ci.yml`): em cada PR, roda só as partes que mudaram: Go da API e da sinalização, o site e a frente do app, e o Rust do app no Windows. O check `CI` junta todos.
- **Fila de merge:** o `main` só muda por PR. Um PR aprovado e com o CI verde entra sozinho na fila de merge (`auto-queue-approved-prs.yml`).
- **Release automática** (`intelligent-release.yml`): cada mudança no `main` vira uma release com versão calculada pelas mudanças.
- **App:** a release gera o instalador do Windows (`Jukejoint-vX.Y.Z-windows-x64-setup.exe`) e o pacote assinado do atualizador (`release-desktop.yml`). O instalador já leva o Modlock fixado e os modos.
- **Servidores:** a release e cada build do `main` publicam as imagens da API e da sinalização no GHCR (`ghcr.io/axiumhq/jukejoint-api` e `-signal`, `images.yml`). Depois, abrem um PR de versões no `infra-pi`. Quando esse PR entra, o Pi atualiza os containers, a API reinicia e as salas abertas fecham. O login sobrevive.

## Contribuir

- **Branch e PR:** trabalhe numa branch e abra um PR para o `main`. Não dá para enviar direto para ele.
- **Idioma:** commits, PRs e textos do produto em português do Brasil.
- **Texto neutro em gênero:** "quem criou", "a pessoa", "contatos", e nunca "o anfitrião" ou "o amigo".
- **Sem material da Valve na marca e no site:** nada de logos, fontes, arte, retratos de heróis ou nomes de lugares do jogo. As cenas e as capas dos modos são arte nossa.
- **Segredos fora do git:** a chave da Steam (`server/.data/`), a chave da sessão, o segredo da sinalização e o token do túnel (`tools/`) nunca entram num commit.
- **O motor:** o Modlock é fixado por versão e hash. Para atualizar, troque a versão e o SHA-256 em `desktop/src-tauri/src/engine/mod.rs`, em `scripts/install-modlock.ps1` e em `bin/modlock.cmd`. Depois, rode o teste com o binário real (`desktop/src-tauri/tests/real_cli.rs`) e os autotestes dos modos.

## Documentos

- [`docs/decisao-plataforma.md`](docs/decisao-plataforma.md): por que o Modlock como motor, os caminhos considerados e os riscos.
- [`docs/engine-adapter.md`](docs/engine-adapter.md): como o app conversa com o motor e as etapas da partida.
- [`docs/spike-fase-0.md`](docs/spike-fase-0.md): o primeiro teste entre dois PCs.
- [`docs/design/`](docs/design/): pesquisa de UX, auditorias e as direções visuais.
- [`server/README.md`](server/README.md), [`spike/signal/README.md`](spike/signal/README.md), [`web/README.md`](web/README.md) e [`desktop/README.md`](desktop/README.md): os detalhes de cada parte.
