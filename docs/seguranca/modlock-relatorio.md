# Modlock: relatório de segurança (interno)

- **Alvo:** Modlock (MIT, github.com/paralin/modlock, autor "paralin"), commit `5da2253`, release `v0.1.68`
- **Data da revisão:** 2026-11-01
- **Método:** só leitura estática do código (clone raso, somente leitura). Nada foi compilado nem executado, e não há PoC. Cada achado foi conferido no código com arquivo:linha. Onde a conclusão depende de comportamento do motor do jogo que não testamos, isso está escrito.
- **Uso:** documento interno. A versão para o autor está em `modlock-disclosure-en.md` (rascunho, NÃO ENVIADO).

## Resumo

| # | Achado | Status | Severidade | Bloqueia nosso lançamento? |
|---|---|---|---|---|
| 6 | Escape de caminho no Windows: o host grava `.vpk` em qualquer pasta do convidado (`writePackage`) | CONFIRMADO | **Alta** | **Sim**: qualquer recurso de entrar na sessão de outra pessoa |
| A (novo) | Injeção de comando no console do servidor pelo nome de bot (`kick "<nome>"`), que contorna a denylist | CONFIRMADO (código); o parsing do motor não foi testado | **Alta** (com mods não confiáveis) | **Sim**: rodar mods da comunidade nos nossos servidores |
| 4 | O convidado monta o conteúdo do host (inclusive Panorama JS) sem passar pelo pacote `check` | CONFIRMADO | **Média** (talvez Alta, depende da API Panorama do Deadlock) | **Sim**: lobbies públicos e hosts desconhecidos |
| 2 | `ServerCommand` usa denylist e tira as flags cheat/dev de todo nome de comando da linha | CONFIRMADO | **Média** | **Sim**: mods não confiáveis em servidores hospedados |
| 1 | `Watch` usa o `SteamId` que o convidado informa, então qualquer convidado vê a UI de outro jogador | CONFIRMADO | **Média** | **Sim**: modos com informação oculta, ranqueado ou competitivo |
| 3 | Edição do `gameinfo.gi` como ler-modificar-gravar sem atomicidade e sem lock; uma sessão desmonta o bloco da outra | CONFIRMADO | Baixa | Não (contornável) |
| 5 | Qualquer jogador pode usar `/restartmod` enquanto o reinício está oferecido | CONFIRMADO (parece intencional) | Baixa | Não (para ranqueado, sim, como griefing) |
| 7 | `ReadBuild` (C++) junta `path / manifest.entry()` sem normalizar | PARCIAL | Baixa | Não |

Nenhum dos 7 candidatos foi refutado. O nº 7 só se confirma em parte: o `check` em Go já barra `..` e caminhos absolutos no `entry` para mods que passam por ele.

---

## Achado 6: escape de caminho no Windows ao gravar o pacote do convidado (ALTA, CONFIRMADO)

**Caminho no código**

1. Os nomes vêm direto do host. `peernet/host.go:351-366` (`Content`) envia `ContentPart{Path, Data}`. No convidado, `peernet/host.go:454-472` (`fetchContent`) junta as partes sem validar nada, e `peernet/host.go:416-421` as repassa.
2. A CLI do convidado põe o caminho cru como chave do mapa: `cmd/modlock/host.go:335-341` (`content[body.Content.GetPath()]`) e depois `mountGuest` em `cmd/modlock/host.go:343-345` e `412-427`.
3. `session/renderer.go:113-119` separa os "arquivos de mapa" com `isMapArchive` (`session/renderer.go:214-217`), que confere `path.Dir(name) == "maps" && path.Ext(name) == ".vpk"`. Essa checagem só divide por `/`.
4. `session/renderer.go:142-146` chama `writePackage(dir, archives)`, e `session/renderer.go:198-212` faz `filepath.Join(dir, filepath.FromSlash(name))` e `os.WriteFile`.

**Por que escapa:** um nome como `maps/..\..\..\..\<qualquer>\x.vpk` passa no `isMapArchive`, porque `path.Dir` não reconhece `\` como separador e devolve `maps`. No Windows, `filepath.Join` trata `\` como separador e limpa os `..`, então o destino sai de `game/citadel/modlock_dev/<key>/`. Nada antes disso rejeita `..`, `\` ou `:`. Em Linux/Proton o `\` é um caractere comum e não há escape, e `../` com barra normal é barrado pelo próprio `path.Dir`.

**Atacante e pré-condições:** quem hospeda a sessão, com o daemon modificado (é código aberto, então as checagens do lado do host não protegem o convidado). A vítima entra com o código de entrada ou com o link do lobby em hyperline.gg, num Windows com Steam/Deadlock detectado. Não há confirmação do usuário: a montagem acontece sozinha quando chega o `JoinEvent_Address`.

**Impacto:** o atacante grava bytes que escolhe em qualquer caminho gravável pelo usuário, com nome terminando em `.vpk`. Isso permite, por exemplo, sobrescrever VPKs do próprio jogo ou de outros addons. A adulteração da instalação do Deadlock persiste fora da sessão, inclusive no jogo online normal, até alguém verificar os arquivos pela Steam. Também dá para corromper o jogo (DoS) ou encher o disco. Não encontramos caminho direto para execução de código nativo, porque o motor não carrega binários de dentro de um VPK, mas Panorama JS persistente no cliente é plausível.

**Reprodução (conceitual):** um host modificado inclui no stream de `Content` um arquivo cujo `Path` começa com `maps/`, sobe pastas com `..\` e termina em `.vpk`. Um convidado Windows faz `modlock join` e o arquivo aparece fora de `modlock_dev`.

**Correção mínima:**
- No convidado, recusar qualquer `Path` que não passe em `fs.ValidPath`, que contenha `\`, `:` ou NUL, ou que não fique dentro dos diretórios de addon (`check.AddonDirs()`) ou não seja exatamente `maps/<nome-simples>.vpk`.
- Em `writePackage`, exigir `filepath.IsLocal(filepath.FromSlash(name))` e, de preferência, gravar via `os.OpenRoot(dir)` (Go 1.24+), que não deixa sair da raiz.

**Bloqueia o lançamento:** sim, para qualquer fluxo de "entrar na partida de outro jogador". Antes do upstream corrigir, dá para mitigar no nosso fork fixado, validando os caminhos no `join`.

---

## Achado A (novo): injeção no console pelo nome de bot (ALTA quando os mods não são confiáveis, CONFIRMADO no código)

Encontrado ao rastrear o nº 2.

**Caminho no código**
- `src/wasm/game_entities.cc:270-293` (`Game::AddBot`) guarda `request.name()`, o nome escolhido pelo mod, em `bots_` na linha 291. `src/gameinterop/bot_creation.cc:25` só confere se o nome não está vazio.
- `src/wasm/game_entities.cc:297-315` (`RemoveBot`) executa `ServerCommand("kick \"" + nome + "\"\n")` na linha 309.
- `src/wasm/game.cc:266-272` (`RemoveWorld`) faz o mesmo na linha 268 para cada bot, quando o mundo é limpo.
- Nenhum desses caminhos passa por `RefuseConsoleLine` (`src/wasm/console_lines.cc:203-216`). Ela só roda em `GameServices::ServerCommand` (`src/wasm/game_services.cc:52`).

**Impacto:** um mod que cria um bot com um nome que contém `"` e `;` consegue terminar o argumento do `kick` e encadear comandos arbitrários no console do servidor quando o bot é removido. Isso inclui os que a denylist barra de propósito (`exec`, `rcon*`, `connect*`, `con_log*`, `host_writeconfig`…). Fica anulada toda a fronteira de "o mod não mexe em arquivos, rede e processo do motor".

**Ressalva:** supomos que o tokenizador do console do Source 2 trata `;` fora de aspas como separador. É o comportamento padrão do Source, mas não testamos. Também não verificamos se a fábrica nativa de bots recusa nomes com aspas. Mesmo que ela altere o nome que guarda, o `kick` usa a string original do mod.

**Atacante:** autor de um mod publicado ou comprometido que roda num servidor hospedado (o nosso caso, com mods da comunidade). `AddBot` está em `kServerWide` (`src/wasm/player_scope.cc:18-21`): mods "limitados" só o usam enquanto seguram o mundo, e mods completos podem sempre.

**Correção mínima:** em `AddBot`, recusar nomes com `"`, `;`, `\r`, `\n` ou caracteres de controle e limitar o tamanho. Melhor ainda: remover o bot pelo slot/userid (`kick #<userid>` ou uma API nativa) em vez do nome, e centralizar a montagem de comandos internos numa função que escape os argumentos.

**Bloqueia o lançamento:** sim, se formos rodar mods de terceiros nos nossos servidores.

---

## Achado 4: convidados montam o conteúdo do host sem o `check` (MÉDIA, possivelmente ALTA, CONFIRMADO)

**Caminho no código**
- No convidado, `cmd/modlock/host.go:334-346` acumula `JoinEvent_Content` e chama `mountGuest`. Em `cmd/modlock/host.go:412-427`, `session.StartInterface` recebe o conteúdo cru.
- `session/renderer.go:97-108`: `maps.Copy(files, content)` acontece depois dos arquivos do renderer. Assim, o conteúdo do host pode substituir `panorama/layout/latest_news.xml`, `panorama/scripts/modlock/boot.js`, `ui.js` e afins, além de qualquer arquivo de stock do jogo. Segundo o comentário em `renderer.go:88-91`, o pacote "outranks every other mounted package".
- `check.Content` (`check/content.go:91-121`), que obriga cada arquivo a ficar sob o nome do próprio addon, e `check.Scripted` (`check/content.go:128-158`) não são chamados nesse caminho. O único chamador de `check.Mod` é `cmd/modlock/publish.go:39`.
- Não há limite de tamanho: `peernet/host.go:454-472` e `cmd/modlock/host.go:341` acumulam tudo em memória por até 2 minutos (`contentWait`).

**Impacto:** o host executa Panorama JS no cliente do convidado sem nenhum aviso. Pode trocar a UI de stock do jogo (inclusive menus fora da partida, já que o `latest_news.xml` fica carregado o processo todo), forjar diálogos (phishing dentro do jogo) e usar o que a API Panorama do Deadlock expuser (não verificamos se ela tem comando de console ou abertura de URL). Se o convidado fechar de forma anormal, o bloco fica no `gameinfo.gi` até a próxima sessão ou até um `ClearStale`, e o conteúdo do host continua valendo no jogo normal. Ainda dá para esgotar a memória do convidado com conteúdo gigante.

**Atacante:** quem hospeda a sessão (lobby dev em hyperline.gg ou código de entrada divulgado).

**Correção mínima:** o convidado deve rodar as mesmas regras de `check.Content` sobre o conteúdo recebido. Para isso, o host precisa enviar o nome do addon de cada mod, ou o convidado pode exigir o formato `panorama/<kind>/<addon>/…` e `<asset>/<addon>/…`. Também deve recusar qualquer caminho que colida com os arquivos do renderer ou de stock. Se `check.Scripted` acusar script, o convidado pede confirmação. Vale ainda limitar o tamanho total e por arquivo. A longo prazo, baixar releases publicadas por hash do serviço em vez de receber direto do host.

**Bloqueia o lançamento:** sim, para lobbies públicos e hosts desconhecidos. Para "jogar com amigos de confiança" é aceitável, com aviso.

---

## Achado 2: `ServerCommand` com denylist e remoção das flags cheat/dev (MÉDIA, CONFIRMADO)

**Caminho no código**
- `src/wasm/game_services.cc:50-82`: na linha 52, `RefuseConsoleLine` (a denylist). Nas linhas 71-75, para cada comando da linha (`SplitConsoleLine`), chama `AllowServerChanges(run.name)`. Na linha 78, executa.
- `src/gameinterop/console_variables.cc:234-236`: `AllowServerChanges` limpa `kExposureFlags | kCheatFlag` permanentemente nos dados da cvar. Nada restaura essas flags depois.
- `src/wasm/console_lines.cc:26-125` é a lista do que é proibido. Tudo o que não está nela é permitido, incluindo comandos que o jogo acrescente em atualizações futuras. `sv_cheats` não está na lista.
- A ponte é `src/wasm/game.cc:288-290`, a importação `ServerCommand` do mod.

**Impacto:** um mod pode rodar qualquer comando ou cvar não listado e liberar cvars marcadas como cheat ou development-only. A liberação vale para o processo do servidor inteiro, inclusive para outros mods e para o resto da sessão. A denylist precisa ser mantida a cada patch do jogo, e se ela atrasar um patch, a falha deixa passar em vez de bloquear. Não conseguimos listar comandos perigosos específicos que ficaram de fora sem o dump do console do jogo atual. Por isso a severidade fica em Média.

**Atacante:** autor de mod publicado ou comprometido.

**Correção mínima:** trocar por uma allowlist de comandos/cvars que um mod pode alterar, ou pelo menos aplicar `AllowServerChanges` só a cvars de uma lista revisada ou declarada no `mod.json` e checada no `check`. Também restaurar as flags quando o mod descarrega.

**Bloqueia o lançamento:** sim, para servidores com mods de terceiros. No nosso fork dá para pôr uma allowlist por cima.

---

## Achado 1: `Watch` confia no `SteamId` do convidado (MÉDIA, CONFIRMADO)

**Caminho no código**
- `peernet/host.go:306-338`: a única verificação é `req.GetSession() != s.session` (linha 309). Depois disso, `s.screens.Player(req.GetSteamId())` (linha 326) escolhe a tela pelo `SteamId` que o próprio convidado mandou.
- O `SteamId` sai do cliente: `peernet/host.go:427-430` e `cmd/modlock/host.go:302-312`. Não há vínculo entre o peer ID (`mounted.GetPeerID()`, `peernet/host.go:123-131`) e a conta Steam. `session/screens.go:108-117` só procura pela conta.
- O segredo da sessão é o mesmo para todos os convidados (`peernet/host.go:218-223`) e o lobby o entrega a qualquer membro (`cmd/modlock/host.go:378-386`).

**Impacto:** qualquer pessoa com o código pode assistir em tempo real à UI de outro jogador, inclusive à do host. As Steam IDs são fáceis de descobrir, por exemplo pelo placar. Em modos com informação oculta (cartas, papéis secretos, economia, objetivos) isso é cheat. O `Content` também é protegido só pelo segredo, mas ali o conteúdo é o mesmo para todos, então não é problema.

**Correção mínima:** amarrar a identidade ao peer autenticado. Por exemplo, o host associa peer ID → conta quando aquele stream de jogo conecta (o servidor sabe qual slot entrou por qual gamelink), ou emite um token por convidado no join. No mínimo, recusar a conta do host e qualquer conta já reivindicada por outro peer.

**Bloqueia o lançamento:** sim, para qualquer modo competitivo ou com informação oculta.

---

## Achado 3: `gameinfo.gi` com ler-modificar-gravar não atômico (BAIXA, CONFIRMADO)

**Caminho no código**
- `devmount/devmount.go:112-125` (`edit`): `os.ReadFile`, depois `change`, depois `os.WriteFile` (que trunca e regrava). Não há arquivo temporário com rename nem lock entre processos. O `fileretry` só repete quando o arquivo está ocupado.
- `devmount/devmount.go:93-105`: `Mount` e `Unmount` passam por `edit`.
- `devmount/devmount.go:79-88`: `Hold` pega o lock **compartilhado**, ou seja, várias sessões convivem. Mesmo assim, `session/renderer.go:176-180` (`mount.Close`) chama `Unmount` sem conferir se outra sessão ainda está viva. Como o bloco tem nome fixo (`MODLOCK DEV`), a primeira sessão a fechar remove o bloco da outra.

**Impacto:** com um gerenciador de mods ou uma segunda sessão editando ao mesmo tempo, uma das edições se perde. Uma leitura no meio da gravação pode ver um arquivo truncado. Se o processo cair durante o `WriteFile`, o `gameinfo.gi` fica corrompido e o jogo não abre até verificar os arquivos pela Steam. É um problema de integridade e disponibilidade local, sem atacante remoto.

**Correção mínima:** gravar em `gameinfo.gi.tmp` no mesmo diretório e fazer `os.Rename` (atômico no mesmo volume, e no Windows já existe o retry), segurando um lock exclusivo (`filelock`) durante o ciclo ler-modificar-gravar. No `Unmount`, só remover o bloco se nenhuma outra sessão segurar o lock, ou usar blocos por chave de sessão.

**Bloqueia o lançamento:** não. Basta garantir no nosso cliente uma sessão por instalação.

---

## Achado 5: `/restartmod` sem checar papel (BAIXA, CONFIRMADO, parece intencional)

**Caminho no código**
- `src/wasm/wasm_plugin.cc:297-327` (`ListenForRestart`): qualquer linha de chat `/restartmod` (ou com os prefixos `.`, `+`, `-`) chama `AskRestart()`. O `line.slot` existe (`include/modlock/gameinterop/native_chat_hook.h:22-24`), mas é ignorado.
- `src/wasm/wasm_plugin.cc:369-379` (`AskRestart`) aceita o pedido se o mod estiver parado ou se tiver ficado lento nos últimos 5 minutos (`kOfferWindow`, linha 57). O reinício acontece em `src/wasm/wasm_plugin.cc:474-476` e `385-408`.
- O comentário em `wasm_plugin.cc:345-346` diz "the players choose when it happens", ou seja, é de propósito. Já existe um sistema de papéis (`MOD_ROLE_DEVELOPER`/`TESTER`, `session/session.go`) que poderia ser usado aqui.

**Impacto:** griefing. Depois de qualquer evento lento, qualquer jogador pode reiniciar o mod por 5 minutos, o que zera o estado em memória da partida. Reinícios repetidos de um mod que falha travam o tick, porque o start roda na thread do motor.

**Correção mínima:** restringir ao host, aos papéis developer/tester ou a uma votação da maioria, e aplicar rate limit.

**Bloqueia o lançamento:** não para casual. Para ranqueado, sim (podemos filtrar o comando no nosso lado).

---

## Achado 7: `ReadBuild` (C++) sem normalizar o caminho (BAIXA, PARCIAL)

**Caminho no código**
- `src/wasm/build.cc:76` faz `ReadFile(path / manifest.entry())`. Em `std::filesystem`, um `entry` absoluto (`C:\…` ou `/…`) **substitui** o `path`, e `..` não é barrado.
- `src/wasm/build.cc:82` faz `path / "maps" / (manifest.map() + ".bsp")`, com a mesma situação para `map`.
- O chamador é `src/wasm/wasm_host.cc:111` e `136` (Load/Reload no `modlock-host`).

**O que mitiga:** `check.Mod` passa por `sandbox.ReadBuild` (`sandbox/build.go:40-43`), que exige `fs.ValidPath(entry)` e com isso barra `..` e caminhos absolutos para mods que passaram pelo `check`. Sobram três brechas:
1. `fs.ValidPath` aceita `\` e `:`. Um serviço de publicação rodando em Linux poderia aceitar um arquivo literalmente chamado `..\..\x`, que no Windows vira travessia.
2. O campo `map` não é validado em nenhum lugar do `check`. O build local usa `filepath.IsLocal` (`project/build.go:180`), mas isso não vale para mods vindos de fora.
3. O Modlock em si só carrega mods locais. O contexto de risco real é uma plataforma (como a nossa) que carregue no `modlock-host` mods publicados por terceiros.

**Impacto:** limitado. O arquivo lido vira o módulo WASM (precisa ser WASM válido) ou o fonte do interpretador, e o conteúdo pode vazar em mensagens de erro ou logs. Não encontramos caminho para o mod ler o conteúdo de forma útil. Observação menor no mesmo eixo: `publish/mod.go:32-37` usa `map` sem `IsLocal` ao montar a lista de arquivos da release, então quem publicar um projeto clonado malicioso poderia enviar um `.vpk`/`.bsp` de fora do diretório.

**Correção mínima:** no C++, recusar `entry` e `map` absolutos ou com `root_name`, ou com qualquer componente `..`, e conferir que `(path / entry).lexically_normal()` continua dentro de `path`. No `check.Mod`, validar `map` contra o mesmo padrão do slug e recusar `\` e `:` no `entry`.

**Bloqueia o lançamento:** não. Vamos validar `entry`/`map` no nosso pipeline de publicação.

---

## O que bloqueia nosso lançamento

1. **Entrar na sessão de outro jogador (Windows)**: fica bloqueado até corrigir o nº 6 e o nº 4. Mitigação no nosso fork: validar os caminhos e rodar `check.Content` no `join` antes de montar.
2. **Mods da comunidade nos nossos servidores**: fica bloqueado até corrigir o achado A e endurecer o nº 2. Mitigação: allowlist de comandos e saneamento de nomes de bot no nosso fork.
3. **Modos competitivos ou com informação oculta**: ficam bloqueados até corrigir o nº 1.
4. **Não bloqueiam**: nº 3, nº 5 e nº 7, que dá para contornar no nosso lado.

## O que não conseguimos determinar

- Se o tokenizador do console do Deadlock (Source 2) separa `;` depois de aspas fechadas exatamente como o Source clássico (afeta o achado A). Não executamos nada.
- A superfície real da API Panorama JS no Deadlock (comando de console, abrir URL, acesso à rede), que decide se o nº 4 é Média ou Alta.
- A lista atual de comandos e cvars do servidor do Deadlock, para apontar omissões concretas na denylist do nº 2.
- Se o diretório da biblioteca Steam do usuário tem permissões que limitem o alcance do nº 6 (o escape vale para qualquer caminho gravável pelo usuário).
- Como a hyperline.gg distribui os segredos de lobby (é serviço do autor e não está no repositório).

## Próximos passos

1. Revisar e enviar `modlock-disclosure-en.md` em canal privado (e-mail do autor ou GitHub Security Advisory privado do repositório). Ainda **não enviado**.
2. Aplicar as mitigações no nosso fork fixado em `5da2253` antes de qualquer beta.
3. Prazo de divulgação proposto: 90 dias a partir do envio.
