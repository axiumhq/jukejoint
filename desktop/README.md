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
    src/engine/         EngineAdapter: args, parse, validate, system, modlock, catalog (modo → pasta),
                        progress (eventos → etapas do handoff)
    src/deeplink.rs     <esquema>://join/<id>
    src/notice.rs       aviso nativo para quem joga (link de convite inválido)
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
`http://localhost:5281`. Fora do app ela mostra dados de exemplo (com um aviso). Os dados de
exemplo ficam em `src/sample.ts` e só entram em dev: no build de produção o módulo não é incluído
e, fora do app, a tela diz que só funciona dentro dele.

Tema: o mesmo do site (chave `lobby.theme` no localStorage, ou `?theme=`), aplicado por um script
inline no `<head>` de `index.html` antes da primeira pintura (o Tauri põe o hash dele na CSP). Se o
tema mudar no site com a tela Instalação aberta, ela troca junto pelo evento `storage` (mesma
origem no app; em dev as portas são outras e a troca só aparece ao reabrir). A cor nativa das
janelas (`WINDOW_BG` em `lib.rs`) é fixa na do Deadlock: o tema salvo mora no localStorage do
WebView, que o Rust não lê antes de criar a janela, e o script inline já pinta o primeiro quadro no
tema certo, então essa cor só aparece por um instante.

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
cargo test                                   # 45 testes, sem o jogo e sem o CLI
```

Cobrem: argumentos de cada comando, validação (código de entrada, id do lobby, origem, pasta do
projeto, deep link), o catálogo de modos (slug estrito, nada de caminho, raiz, projeto ausente,
todos os modos do site na tabela), eventos → etapas do handoff com as fixtures, os erros de fim
de sessão, leitura da saída (versão, `daemon status` real capturado, eventos `--json`,
arquivo hosts), trava do daemon, SHA-256, a regra de nunca executar um binário com hash errado e
o motor que some depois de visto (quarentena do antivírus, `binario_sumiu`).
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
| `ENGINE_PROJECTS_DIR` | app | Pasta com os projetos dos modos (uma subpasta por projeto, com `mod.json`). Sem ela: em build de dev, `spike\mods` do repositório; no app empacotado, `modos\` ao lado do executável. Hoje todo modo abre `hello` (modo de teste). |
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
| `engine_host` | site | `{ mode }`: o **slug** do modo (`[a-z0-9]` e hífens simples, até 64). O app resolve a pasta do projeto no próprio catálogo (abaixo); o site nunca manda caminho. Confere binário, Deadlock fechado e daemon, e roda `modlock --json host --no-lobby --ui-port 0` na pasta. O código chega no evento `hosting`. |
| `engine_join` | site | `{ code }`: só `[A-Za-z0-9][A-Za-z0-9_-]{3,127}`. Roda `modlock --json join --ui-port 0 --origin <ENGINE_ORIGIN> <código>` (opções antes do código). |
| `engine_stop` | site | Fecha a entrada padrão da sessão (com `--json`, o servidor para quando ela fecha), espera até 20 s e só então encerra o processo cliente `host`/`join` se ele não saiu. Depois `modlock daemon stop`. |
| `engine_session` | site, Instalação | A sessão atual: tipo, PID, código de entrada, rodando ou não, e a etapa (`step`). |

Eventos: `engine://event` (cada linha da sessão, já lida: `note`, `hosting`, `host` com
`ready`/`joined`/`failed`…, `building`, `built`, `update`, `text`; e `fim` com o código de saída;
mais `step` quando a linha fez a etapa do handoff avançar e `error`, no formato dos erros dos
comandos, quando o modo falhou no servidor ou a sessão terminou com erro sem o app ter pedido),
`engine://check` (a primeira checagem ao abrir), `app://deep-link` (id do lobby) e
`app://deep-link-invalido` (um link recusado; o payload é o motivo: `formato`, `esquema`, `acao` ou
`id`).

Regras do adaptador: processos só por `std::process::Command` com argumentos em lista, sem shell e
sem WMI; o daemon só para com `modlock daemon stop`; `daemon status` só roda com a trava do daemon
ocupada (sem daemon, ele subiria um apontando para o hyperline.gg).

## Catálogo de modos (`src/engine/catalog.rs`)

O site hospeda pelo slug do lobby (`engine_host { mode }`). O app confere o slug (formato estrito e
presença na tabela `MODES`, os mesmos modos de `web/src/data/modes.ts`; um teste lê esse arquivo e
falha se o site tiver um modo que o app não conhece) e resolve a pasta do projeto dentro de uma
raiz: `ENGINE_PROJECTS_DIR`; sem ela, em build de dev, `spike/mods` do repositório; no app
empacotado, a pasta `modos\` ao lado do executável. A pasta precisa ter `mod.json` e, depois de
seguir links, continuar dentro da raiz. O nome da pasta vem da tabela, nunca de fora.

**Modo de teste:** enquanto não há modos de verdade, **todo slug abre o projeto `hello`**
(`spike/mods/hello`). Em dev isso já funciona; no exe, copie `spike\mods\hello` para
`modos\hello` ao lado do `app-desktop.exe` (ou aponte `ENGINE_PROJECTS_DIR` para `spike\mods`). O
site diz "modo de teste" no diálogo de entrar e na barra da sala. A checagem (`engine_check`)
traz `modes` (raiz, origem, `testMode`, se o `hello` está lá).

## Etapas do handoff (`src/engine/progress.rs`)

Cada evento da sessão pode avançar a etapa (só para frente): 0 baixando o modo, 1 abrindo o
jogo, 2 entrando, 3 dentro. Hospedando: `building` → 0, `built` (ok) e `hosting` → 1,
`host.ready`/`host.started` → 2, `host.joined` (o primeiro a entrar no servidor é o jogo de quem
hospeda) → 3. Entrando, a v0.1.68 só manda `note` em texto livre, então a regra é por palavras
(`download`/`content` → 0, `launching`/`deadlock` → 1, `connecting`/`joining` → 2, `joined`/`arrived`
→ 3), numa tabela só (`JOIN_NOTES`). **Essas palavras não foram conferidas contra o jogo**: ajuste
a tabela depois do teste com dois PCs. O site manda cada etapa ao servidor (`handoff_progress`).

Fim de sessão que o app não pediu vira `error` no evento `fim`: código diferente de 0, ou (entrando)
o processo terminou antes da etapa 3. O `detail` traz as últimas linhas da sessão.

## Deep link e instância única

`lobby://join/<id>` (barra final opcional). O id segue `[A-Za-z0-9][A-Za-z0-9_-]{0,63}`; qualquer
outra coisa (consulta, fragmento, `%`, porta, usuário, caminho extra) é recusada. Com o app já
aberto, o link traz a janela para frente e manda `app://deep-link`; o site navega até
`/sala/<id>` pelo React Router, sem recarregar. A frio, a janela já abre em `/sala/<id>`. Uma
segunda execução (por exemplo, o navegador abrindo o link) repassa o link para a janela que já
está aberta e encerra.

Link recusado não some em silêncio: com o app aberto, o app traz a janela para frente e manda
`app://deep-link-invalido`, e o site mostra o aviso. A frio (o site ainda não carregou), o aviso é
nativo do Windows ("Este link de convite não abriu…", `src/notice.rs`) e a janela abre na inicial.

## Ao abrir e ao fechar

- Abre a janela do site e um ícone na bandeja (Abrir, Instalação, Fechar o app). O ícone é só um
  atalho enquanto a janela do site está aberta (é o caminho para a tela Instalação até o site
  chamar `open_install_window`); ele **não** mantém o app em segundo plano e some quando a janela
  fecha. A dica do ícone diz isso, e a tela Instalação também ("O que o app não faz").
- Faz um `engine_check` em segundo plano; se algo faltar, abre a tela Instalação com
  `window.__INSTALL_OPENED_BY__ = 'checagem'` (ou o evento `install://opened-by`, se a janela já
  existia), e a tela diz no topo por que abriu.
- Fechar a janela do site fecha o app: encerra a sessão e para o daemon **se foi o app que o subiu**.
  Fechar só a tela Instalação não fecha o app.

## Integração com o site (feita em `web/`)

O site usa o app por `web/src/lib/desktop.ts` (detalhes em `web/README.md`, "Dentro do app
desktop"):

1. **Detecta o app** por `window.__DESKTOP_APP__` (`{ name, scheme, version, modlockVersion }`) ou
   `'__TAURI_INTERNALS__' in window`. Dentro do app, `appConnected` vem dele (sem o botão de
   simulação) e o diálogo de entrar mostra o `engine_check` de verdade.
2. **Chama o motor** com o `@tauri-apps/api` 2.12.4 por import dinâmico (o bundle do navegador
   não carrega Tauri). Erros `{ code, message, detail? }`: `message` aparece, `detail` fica em
   "Detalhes técnicos".
3. **Deep link** pelo React Router (o app só manda o evento; ver acima).
4. **Tela Instalação:** `open_install_window` a partir da `/instalar` e do diálogo de entrar.
5. **Lobby → código:** quem hospeda manda o código do `hosting` para a API (`set_join_code`), e
   quem entra recebe o `joinCode` na visão do lobby e chama `engine_join`. As etapas vão para a
   API (`handoff_progress`, protocolo 2 em `server/README.md`).

### Site ao vivo dentro do app

O exe de hoje embute o site **sem** `VITE_API_URL` (dados simulados). Para a partida de verdade no
app falta ligar a API: (a) a CSP do `tauri.conf.json` só libera `connect-src 'self' ipc:`; a
origem da API (`http(s)://…` e `ws(s)://…`) precisa entrar ali (por exemplo, com
`npx tauri build --config` só no build ao vivo); (b) a API só aceita as origens de `WEB_ORIGIN`:
a do app é `http://tauri.localhost` no exe e `http://localhost:5280` no `tauri dev`; (c) o login
pela Steam dentro do app (o cookie `SameSite=Lax` não vai de `tauri.localhost` para outro site;
falta o login do app, estilo PKCE). No `tauri dev` com `VITE_API_URL`, `DEV_LOGIN=1` e
`WEB_ORIGIN=http://localhost:5280` dá para testar num PC só.

## Ainda não feito

- **Instalador** (NSIS/WiX), que também registraria o esquema do link e colocaria o `modlock.exe`
  ao lado do app (`bundle.externalBin`).
- **Assinatura de código** do executável (reduz os alertas do SmartScreen e de antivírus).
- **Atualização automática** do app.
- **`/bridge.html` no nosso domínio** para `--ui-relay`: até lá a UI dentro do jogo fica
  desligada (`--ui-port 0`).
- **`publish`** do `EngineAdapter` e a fase 2 (sidecar Go com eventos protobuf).
- **Modos de verdade no catálogo:** `engine_host` já recebe o modo e o app resolve a pasta, mas
  todo modo abre o projeto de teste `hello`. Falta o conteúdo baixado e conferido (hash) de cada
  modo e o instalador colocar a pasta `modos\` ao lado do app.
- **Teste com dois PCs e o jogo:** as etapas de quem entra saem de palavras em `note`
  (`progress.rs`) e o "dentro" de quem hospeda sai de `host.joined`; nada disso rodou contra o
  Deadlock.
