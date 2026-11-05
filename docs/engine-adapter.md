# EngineAdapter: a camada que isola o Modlock

*Bloco 5 do spike, 01/11/2026. Base: Modlock v0.1.68, fixado.*

## Por quê

Toda a plataforma (app desktop, API, painel do criador) fala com o motor **só** por esta camada. Assim:
- atualizar o Modlock significa mexer num lugar só;
- se um dia precisarmos do fork (plano B), troca-se a implementação e não a plataforma;
- as correções de segurança que não dependem do upstream entram aqui (ver "Mitigações").

## Duas fases de implementação

| Fase | Como | Quando |
|---|---|---|
| **1. Wrapper do CLI** | Chama `modlock.exe` como processo, como os scripts de `scripts/spike/` já fazem, e lê a saída de texto | Spike e protótipo do app. Rápido, mas frágil a mudanças de texto |
| **2. Sidecar Go "engine"** | Um binário nosso que **importa os pacotes públicos do Modlock** e expõe uma API local (JSON-RPC ou starpc) para o app | MVP. Recebe eventos **estruturados** (protobuf), não texto |

Na fase 2 dá para importar sem fork (verificado no código):
- `session`: `StartHost(ctx, HostConfig)` com `Wait`/`Stop`, `DownloadHost`, `FindHost`, `StartInterface`, `ReadContent`, `NewRelay`;
- `session.Control.Run(ctx, func(*control.HostEvent))`: eventos do servidor de jogo;
- `daemon`: `Connect(ctx, dir, version, start)`, `Stop(ctx, dir)`;
- `peernet`: `NewService(origin, keyPath, signIn)`, mais o serviço `PeerNet` (`Host`/`Join` em stream);
- `publish` e `check`: publicação e validação de mods.

O `cmd/modlock` é `package main` e não é importável. A "cola" dos comandos `host`/`join`/`dev` (cerca de 500 linhas) precisa ser reescrita no sidecar. Isso é bom: é exatamente onde entram as nossas validações.

## Operações

| Operação | Fase 1 (CLI) | Fase 2 (pacotes) |
|---|---|---|
| `ensureInstalled()` | `install-modlock.ps1` (SHA-256 fixado) | idem + `session.DownloadHost` com verificação de hash |
| `startDaemon(origin)` / `stopDaemon()` | `comum.ps1` (lock de `daemon.lock`, `daemon stop`) | `daemon.Connect`/`daemon.Stop` com o nosso `start` (sempre com `--origin`) |
| `host(mod, opts)` → código | `modlock play --host` (até a v0.1.68, `modlock host --no-lobby`) | `PeerNet.Host` stream → `HostEvent.join_code` |
| `join(code, opts)` | `modlock join` | `PeerNet.Join` stream → `content*`, `address`, `arrived` |
| `dev(mod)` / `play(mods)` | `modlock dev` | `session.StartHost` + `Control` |
| `build/check/publish(mod)` | `modlock build/publish --origin` | `check` + `publish` |
| `gameStatus()` | lista de processos (`deadlock.exe`) | idem + teste de trava do `gameinfo.gi` |

## Eventos (o que a UI do app recebe)

Mapeados dos protos do Modlock:
- **Sessão hospedada** (`peernet.HostEvent`): `codigo`, `entrou(peer)`, `saiu(peer)`, `lobby(estado)`.
- **Entrando** (`peernet.JoinEvent`): `baixandoConteudo(%)`, `endereco`, `conectado`.
- **Servidor** (`control.HostEvent`): `pronto`, `modIniciado`, `modFalhou(erro)`, `log`, `jogadorEntrou/Saiu`, `chat`, `frameLento`.

Na fase 1 (CLI), o app traduz esses eventos nas quatro etapas que o site e a API usam (baixando o modo, abrindo o jogo, entrando, dentro): `desktop/src-tauri/src/engine/progress.rs`. Quem entra só tem `note` em texto livre na v0.1.68, então ali a regra é por palavras e precisa ser conferida no teste com dois PCs; na fase 2 os eventos `JoinEvent` estruturados substituem isso. O site hospeda pelo slug do modo, e o app resolve a pasta pelo catálogo (`catalog.rs`; hoje todo modo abre o projeto de teste `hello`).

## Erros conhecidos e o que o app faz

| Situação (vista no spike) | Detecção | Ação na UI |
|---|---|---|
| **Jogo já aberto**: `gameinfo.gi` travado, conteúdo não montado (seu teste de 01/11) | `deadlock.exe` rodando, ou erro "being used by another process" | "Feche o Deadlock para carregar o modo" + botão; ou entrar sem conteúdo via `connect` no console |
| Daemon apontando para o hyperline.gg | `daemon status` sem a nossa origem | Parar e subir com a nossa origem, automaticamente |
| Socket travado (daemon encerrado à força) | `modlock.sock` existe e `daemon.lock` está livre | Explicar e pedir reinício; nunca encerrar o daemon à força |
| Antivírus apagou o executável | arquivo sumiu depois de verificado | Tela de recuperação da quarentena (Kaspersky e Defender) com o hash para conferir |
| Lançar processo via WMI aciona o antivírus | — | **Nunca** usar `Win32_Process.Create`; usar `Start-Process`/`exec` normal |
| NAT sem TURN | os dois `signaling connected`, mas o join não fecha | Sugerir outra rede; no MVP, TURN via lobby |

## Mitigações nossas, sem fork (do relatório de segurança)

Na fase 2, como a cola do `join` é nossa:
1. **Validar o conteúdo recebido do host antes de montar**: recusar caminhos com `..`, `\`, `:` ou absolutos (achado #6, escape de caminho no Windows) e rodar `check.Content` (achado #4).
2. **Só montar conteúdo de mods publicados e revisados** (hash conferido com o nosso catálogo) em lobbies públicos.
3. **Limitar o tamanho** do conteúdo baixado.
4. **No servidor hospedado:** só carregar mods revisados, o que mitiga os achados A e #2 (`kick` e `ServerCommand`) até a correção upstream.

## Política de versão

- Uma versão fixa do Modlock por release do app (hoje v0.1.73), com o hash no código.
- Para cada release nova do Modlock: rodar o smoke test (dois daemons + probe + `modlock build` do `hello`). Só sobe a versão fixada se passar.
- Deadlock atualizou e o Modlock quebrou → esperar a release deles. O app mostra "o modo está em manutenção após a atualização do jogo".

## Linguagem

O sidecar é **Go**, porque os pacotes do Modlock são Go. O app desktop e a web falam com ele por uma API local, o que vale tanto para Tauri quanto para Electron, e a stack principal continua em aberto.
