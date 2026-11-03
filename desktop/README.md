# App desktop

Tauri v2 + React. Uma janela carrega o site (`web/`), outra mostra a tela **Instalação**
(`desktop/src/`), e o Rust fala com o motor pelo `EngineAdapter` (fase 1 de
`docs/engine-adapter.md`: chama o `modlock.exe` fixado e lê a saída `--json`).

```
desktop/
  src/                  tela Instalação (React; importa tokens, base, marca e tema de web/src)
  scripts/dev.mjs       sobe o Vite do site (5280) e o da tela Instalação (5281)
  scripts/build-front.mjs  monta dist/: site na raiz, tela Instalação em dist/_app/
  src-tauri/
    build.rs            lê BRAND_NAME de web/src/config/brand.ts e confere o tauri.conf.json
    capabilities/       o que cada janela pode chamar
    src/engine/         EngineAdapter: args, parse, validate, system, modlock
    src/deeplink.rs     <esquema>://join/<id>
    tests/              fixtures e o teste com o CLI real (ignorado por padrão)
```

## Requisitos

- Rust estável (testado com 1.99.1), MSVC Build Tools 2022, Windows SDK, WebView2.
- Node 24 e npm.
- O `modlock.exe` **v0.1.68** (`scripts/install-modlock.ps1` baixa e confere o SHA-256).

Uma vez:

```powershell
cd web;     npm ci
cd ..\desktop; npm ci
```

## Rodar em dev

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:MODLOCK_BIN = 'C:\caminho\para\tools\modlock-v0.1.68\modlock.exe'
$env:ENGINE_ORIGIN = 'http://192.168.0.10:8080'   # o nosso servidor de sinalização
cd desktop
npx tauri dev
```

O `tauri dev` roda `npm run dev:front`, que sobe o site em `http://localhost:5280` (o `devUrl`) e
a tela Instalação em `http://localhost:5281`. Como essa segunda porta é "remota" para o Tauri, em
dev o app libera para ela, e só para ela, as mesmas permissões da capability `instalacao`.

Para mexer só no visual da tela Instalação: `npx vite` em `desktop/` e abrir
`http://localhost:5281`. Fora do app ela mostra dados de exemplo (com um aviso).

## Build

```powershell
cd desktop
npx tauri build --no-bundle
```

Sai `src-tauri\target\release\app-desktop.exe`, com o site e a tela Instalação embutidos (o
`beforeBuildCommand` roda `npm run build:front`, que faz o build de `web/` e de `desktop/`). Sem
instalador: `--no-bundle` e `bundle.active: false`.

## Testes

```powershell
cd desktop\src-tauri
cargo test                                   # 29 testes, sem o jogo e sem o CLI
```

Cobrem: argumentos de cada comando, validação (código de entrada, id do lobby, origem, pasta do
projeto, deep link), leitura da saída (versão, `daemon status` real capturado, eventos `--json`,
arquivo hosts), trava do daemon, SHA-256 e a regra de nunca executar um binário com hash errado.
As fixtures de `host`/`join` seguem o esquema `modlock.cli.Event` embutido no binário v0.1.68
(`host`/`join` não foram rodados contra o jogo); a de `daemon status` é uma captura real.

Com o CLI real (sobe o daemon numa pasta separada e para com `modlock daemon stop`):

```powershell
$env:MODLOCK_BIN = '...\tools\modlock-v0.1.68\modlock.exe'
$env:ENGINE_ORIGIN = 'http://127.0.0.1:9'
$env:ENGINE_STATE_DIR = "$env:USERPROFILE\.mlD"
cargo test --test real_cli -- --ignored --nocapture
```

## Configuração

O nome do app e o esquema do link vêm de **um lugar só**: `BRAND_NAME` em
`web/src/config/brand.ts` (hoje `'Lobby'`, nome provisório). O `build.rs` deriva o esquema
(`lobby`) e para o build se o `tauri.conf.json` não repetir os mesmos valores em `productName` e
`plugins.deep-link.desktop.schemes`. Trocou o nome: ajuste esses dois campos e pronto.

| Variável | Quem lê | Para quê |
|---|---|---|
| `MODLOCK_BIN` | app | Caminho do `modlock.exe`. Sem ela, o app procura `modlock.exe` (ou `modlock-x86_64-pc-windows-msvc.exe`) ao lado do próprio executável; em build de dev, também `tools\modlock-v0.1.68\` do repositório. |
| `ENGINE_ORIGIN` | app | Origem do servidor de sinalização, passada em `daemon --origin` e `join --origin`. Só `http(s)://host[:porta]`; o hyperline.gg é recusado. Sem ela, `host`/`join` não rodam. |
| `ENGINE_STATE_DIR` | app | Troca o `APPDATA` só dos processos do Modlock (mesmo efeito do `-StateDir` dos scripts do spike). Útil com um socket travado na pasta padrão. Precisa ser curta: o socket AF_UNIX tem limite de ~108 caracteres. |
| `APP_REGISTER_SCHEME` | app | Com `1`, registra o esquema do link no Windows (HKCU) ao abrir. Enquanto não há instalador, é o jeito de testar o link vindo do navegador. |
| `MODLOCK_NO_UPDATE_CHECK=1` | Modlock | Definida pelo app em todo processo do Modlock (versão fixada). |

A versão (`v0.1.68`) e o SHA-256 fixados ficam em `src-tauri/src/engine/mod.rs`, iguais aos de
`scripts/install-modlock.ps1`. O app não executa o binário (nem para ler a versão) se o hash não
bater.

## Comandos (Tauri)

| Comando | Janela | O que faz |
|---|---|---|
| `app_info` | site, Instalação | Nome, esquema, versão do app e do Modlock. |
| `open_install_window` | site | Abre (ou traz para frente) a tela Instalação. |
| `engine_check` | site, Instalação | Lê tudo sem mudar nada: binário (caminho, tamanho, SHA-256, versão), daemon (trava, socket, `daemon status` com a origem em uso), Deadlock aberto, bloqueio do hyperline.gg no hosts, variáveis. Devolve `ready` e a lista de problemas em PT-BR. |
| `engine_daemon_start` | Instalação | Garante o daemon com a nossa origem: se houver um em outra origem, para com `daemon stop` e sobe `modlock daemon --origin <ENGINE_ORIGIN> --idle 60m` (log em `<estado>\daemon-app.log`). Recusa com socket travado. |
| `engine_daemon_stop` | Instalação | `modlock daemon stop` e espera a trava soltar. Recusa com sessão rodando. |
| `engine_host` | site | `{ project }`: pasta absoluta com `mod.json`. Confere binário, Deadlock fechado e daemon, e roda `modlock --json host --no-lobby --ui-port 0` na pasta. O código chega no evento `hosting`. |
| `engine_join` | site | `{ code }`: só `[A-Za-z0-9][A-Za-z0-9_-]{3,127}`. Roda `modlock --json join --ui-port 0 --origin <ENGINE_ORIGIN> <código>` (opções antes do código). |
| `engine_stop` | site | Fecha a entrada padrão da sessão (com `--json`, o servidor para quando ela fecha), espera até 20 s e só então encerra o processo cliente `host`/`join` se ele não saiu. Depois `modlock daemon stop`. |
| `engine_session` | site, Instalação | A sessão atual: tipo, PID, código de entrada, rodando ou não. |

Eventos: `engine://event` (cada linha da sessão, já lida: `note`, `hosting`, `host` com
`ready`/`joined`/`failed`…, `building`, `built`, `update`, `text`; e `fim` com o código de saída),
`engine://check` (a primeira checagem ao abrir) e `app://deep-link` (id do lobby).

Regras do adaptador: processos só por `std::process::Command` com argumentos em lista, sem shell e
sem WMI; o daemon só para com `modlock daemon stop`; `daemon status` só roda com a trava do daemon
ocupada (sem daemon, ele subiria um apontando para o hyperline.gg).

## Deep link e instância única

`lobby://join/<id>` (barra final opcional). O id segue `[A-Za-z0-9][A-Za-z0-9_-]{0,63}`; qualquer
outra coisa (consulta, fragmento, `%`, porta, usuário, caminho extra) é ignorada. Com o link, o
app traz a janela para frente e abre `/sala/<id>` no site. Uma segunda execução (por exemplo, o
navegador abrindo o link) repassa o link para a janela que já está aberta e encerra.

## Ao abrir e ao fechar

- Abre a janela do site e um ícone na bandeja (Abrir, Instalação, Sair).
- Faz um `engine_check` em segundo plano; se algo faltar, abre a tela Instalação.
- Fechar a janela do site fecha o app: encerra a sessão e para o daemon **se foi o app que o subiu**.

## Integração com o site (a fazer em `web/`)

O app não muda nada em `web/`. Para o site usar o app:

1. **Detectar o app:** `window.__DESKTOP_APP__` (`{ name, scheme, version, modlockVersion }`),
   injetado antes do site carregar; ou `'__TAURI_INTERNALS__' in window`. Com ele, ligar o
   `appConnected` de `state/session.tsx` em vez do botão de simulação da `/instalar`.
2. **Chamar o motor:** adicionar `@tauri-apps/api` (2.12.4) ao `web/` e usar
   `invoke('engine_check')`, `invoke('engine_join', { code })`, `invoke('engine_stop')`,
   `listen('engine://event', …)`. Erros chegam como `{ code, message }`
   (`jogo_aberto`, `origem_ausente`, `socket_travado`, `hash_diferente`…).
3. **Deep link sem recarregar:** hoje o app navega a janela para `/sala/<id>` (recarrega a
   página). Se o site ouvir `app://deep-link` e navegar pelo React Router, dá para trocar por só o
   evento.
4. **Link para a tela Instalação:** `invoke('open_install_window')` a partir da `/instalar`.
5. **Mapear lobby para código de entrada:** o deep link traz o id do lobby; o código do Modlock
   (para `engine_join`) precisa vir da nossa API.

## Ainda não feito

- **Instalador** (NSIS/WiX), que também registraria o esquema do link e colocaria o `modlock.exe`
  ao lado do app (`bundle.externalBin`).
- **Assinatura de código** do executável (reduz os alertas do SmartScreen e de antivírus).
- **Atualização automática** do app.
- **`/bridge.html` no nosso domínio** para `--ui-relay`: até lá a UI dentro do jogo fica
  desligada (`--ui-port 0`).
- **`publish`** do `EngineAdapter` e a fase 2 (sidecar Go com eventos protobuf).
- **Pasta do projeto vinda do catálogo:** `engine_host` hoje recebe um caminho; no MVP o site
  manda o modo e o app resolve a pasta do conteúdo baixado e conferido.
