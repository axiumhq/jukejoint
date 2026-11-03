# server: a API de lobbies

O primeiro backend de verdade da plataforma. Em Go, só a biblioteca padrão mais `github.com/coder/websocket` (v1.8.15, fixada).

O que faz:
- **Login pela Steam** (OpenID 2.0), com sessão num cookie httpOnly assinado.
- **Lista de lobbies** com os mesmos filtros do site.
- **WebSocket** com as salas **decididas pelo servidor**: vagas, pronto, contagem de 5 s do anfitrião (cancelável), fases do handoff, bater na porta, remover da sala e lobby que fecha quando esvazia.
- **Presença e convites**: quem dos seus amigos está online e em qual lobby, e o "Chamar" (o convite chega como aviso para o amigo, e aceitar leva para o lobby).

O que **não** faz: o servidor nunca abre o jogo. Ele guarda o estado do lobby e entrega para quem está na sala o que o app precisa para hospedar ou entrar (o `joinCode`, que o app desktop vai preencher pelo EngineAdapter; ver `docs/engine-adapter.md`).

O armazenamento fica atrás da interface `store.Store`. Por enquanto a implementação é em memória: reiniciar o servidor desloga todo mundo e fecha os lobbies. O Postgres entra depois, sem mexer nos handlers.

## Rodar

```bash
export PATH="$PWD/../tools/go/bin:$PATH" GOTOOLCHAIN=local   # Go portátil (tools/ fica fora do git)
cd server
go run .
```

Com o site apontando para a API (outro terminal):

```bash
cd web
VITE_API_URL=http://localhost:8090 npm run dev     # o site em http://localhost:5173
```

Sem `VITE_API_URL` o site continua com os dados simulados (a demo e os testes usam esse modo).

### Testar com dois usuários na mesma máquina (só desenvolvimento)

```bash
cd server
DEV_LOGIN=1 go run .
```

Abra o site em duas janelas com cookies separados (uma normal e uma anônima, ou dois perfis do navegador). Em cada uma, clique em **Entrar como teste (dev)** e escolha `Teste_A` numa e `Teste_B` na outra. Os usuários de teste são amigos entre si, então o "Chamar" funciona entre eles.

## Variáveis de ambiente

| Variável | Padrão | O que é |
|---|---|---|
| `ADDR` | `127.0.0.1:8090` | Endereço em que o servidor escuta. |
| `PUBLIC_URL` | `http://localhost:8090` | A origem pública deste servidor. Vira o `realm` e o `return_to` do OpenID. Com `https://`, o cookie sai com `Secure`. |
| `WEB_ORIGIN` | `http://localhost:5173` | As origens do site que podem chamar a API, separadas por vírgula. A primeira é para onde o navegador volta depois do login. |
| `DATA_DIR` | `.data` | Pasta da chave que assina os cookies (`session.key`, 32 bytes, criada na primeira execução). `server/.data/` está no `.gitignore`: **nunca versione a chave**. No Windows o modo 0600 não protege o arquivo; proteja a pasta. |
| `STEAM_API_KEY` | (vazia) | Opcional. Com ela, o login busca o nome, o avatar (`GetPlayerSummaries`) e a lista de amigos (`GetFriendList`). Sem ela, a conta aparece como "Jogador 1234" (os 4 últimos dígitos do SteamID) e sem amigos. A chave é sua: crie em steamcommunity.com/dev/apikey e nunca a coloque no git. |
| `DEV_LOGIN` | (vazia) | `1` liga o login de teste. **Só desenvolvimento.** Ver abaixo. |

## Endpoints HTTP

| Método e caminho | O que faz |
|---|---|
| `GET /healthz` | `ok`. |
| `GET /api/me` | `{ user, devLogin, steamLogin }`. `user` é `null` sem sessão. |
| `GET /api/lobbies` | A lista, com os parâmetros da URL do site: `q`, `modo`, `regiao` (ex.: `BR,NA`), `vagas=1`, `amigos=1`, `iniciantes=1`, `partida=1`, `ping=30` e `ordem` (`ativos`, `ping`, `vagas`, `recentes`). Só leitura. |
| `GET /api/lobbies/{id}` | Um lobby. |
| `GET /api/ws` | O WebSocket (abaixo). Sem sessão, só lê. |
| `GET /auth/steam/login?return=/caminho` | Redireciona para a Steam. |
| `GET /auth/steam/callback` | A volta da Steam: valida, cria a sessão e devolve o navegador ao site (`WEB_ORIGIN` + `return`). Falhou: volta com `?login=falhou`, e o site mostra um aviso. |
| `POST /auth/logout` | Apaga a sessão, limpa o cookie e fecha os sockets dessa sessão. |
| `GET /auth/dev`, `POST /auth/dev/login` | Login de teste. Só com `DEV_LOGIN=1` e de localhost; senão, 404. |

Toda mudança de estado de lobby passa pelo WebSocket. O REST é só leitura.

## WebSocket: `GET /api/ws`

Mensagens em JSON, texto, até 4 KiB. O cliente manda **pedidos** (intents) e o servidor decide. Cada pedido pode levar `req` (número); a resposta é `{type:"ack", req, ...}` ou `{type:"error", req, code, message}`. O `message` já vem em PT-BR, pronto para a tela.

### Pedidos (cliente → servidor)

| `type` | Campos | Quem pode |
|---|---|---|
| `create` | `lobby: {name, modeSlug, region, slots, minPlayers, locked, beginners?, joinInProgress?}` | Quem entrou. Se você estava noutro lobby, sai dele antes. O `ack` traz `lobbyId`. |
| `join` | `lobbyId` | Quem entrou. Troca de lobby se precisar. Lobby com convite só com batida aceita ou convite. |
| `leave` | | Quem está numa sala. |
| `ready` | `ready: true/false` | Quem está na sala (o anfitrião está sempre pronto). Desmarcar durante a contagem cancela. |
| `start` | | Só o anfitrião, com o mínimo de jogadores e de confirmados. Começa a contagem de 5 s. |
| `cancel_start` | | Só o anfitrião. |
| `end_match` | | Só o anfitrião: volta a sala para "aberta" (para o app usar quando a partida acabar). |
| `kick` | `userId` | Só o anfitrião. Quem foi removido não volta para esse lobby. |
| `close` | | Só o anfitrião: fecha o lobby para todos. |
| `knock` | `lobbyId`, `message` (até 80) | Quem entrou, em lobby com convite. |
| `answer_knock` | `userId`, `accept` | Só o anfitrião. |
| `invite` | `userId` | Quem está numa sala, para um amigo online. Em lobby com convite, só o anfitrião. O convite abre a porta. Um convite por amigo a cada 15 s. |
| `decline_invite` | `lobbyId` | Quem recebeu. |
| `set_join_code` | `code` (`[A-Za-z0-9._:-]{1,128}`, vazio limpa) | Só o anfitrião. Lugar reservado para o código/peer do app (EngineAdapter). |
| `ping` | | Qualquer um. |

Campos desconhecidos são recusados (`bad_request`), não ignorados.

### Mensagens (servidor → cliente)

| `type` | Campos |
|---|---|
| `welcome` | `me` (ou `null`), `here` (o lobby em que você está), `serverNow`, `knocks`, `invites`. Vem a cada conexão e reconexão. |
| `lobbies` | `lobbies: [visão]`: o retrato completo, logo depois do `welcome`. |
| `lobby` | `lobby: visão`: um lobby mudou (ou nasceu). |
| `lobby_removed` | `lobbyId`, `reason` (`closed` ou `empty`). |
| `lobby_closed` | `lobbyId`, `name`: quem abriu fechou o lobby em que você estava. |
| `here` | `lobbyId` (ou `null`): o seu lugar mudou. |
| `friends` | `friends: [{id, name, lobbyId?, host?}]`: amigos online (lista completa). |
| `friend` / `friend_gone` | Um amigo entrou, mudou de lugar ou saiu. |
| `invite` / `invite_gone` | Convite recebido (`fromId`, `fromName`, `lobbyId`, `lobbyName`, `at`) ou retirado (o lobby fechou). |
| `knock` | `lobbyId`, `lobbyName`, `status` (`pending`, `accepted` ou `declined`): a sua batida na porta. |
| `kicked` | `lobbyId`, `name`: você foi tirado da sala. |
| `ack` / `error` | Respostas aos pedidos. |

**A visão de um lobby** depende de quem olha: `id, name, modeSlug, region, hostId, hostName, players, slots, minPlayers, locked, beginners, joinInProgress, status (aberto | cheio | em-partida), phase, countdownMs, handoffStep, openedAt, startedAt, fullSince, seats, joins`. Num lobby com convite, quem está fora recebe `hidden: true` e só a contagem (sem `seats` nem `joins`). O `joinCode` vai só para quem está na sala, e `knocks` só para o anfitrião.

### A sala (máquina de estados)

```
open ──start (anfitrião, mínimo de jogadores e de confirmados)──► countdown (5 s)
  ▲                                                                  │
  └── cancel_start · alguém desmarca pronto · saída abaixo do mínimo ┘
countdown ──5 s──► handoff (etapas 0 → 1 → 2: baixando o modo, abrindo o jogo, entrando) ──► playing (etapa 3)
handoff/playing ──end_match (anfitrião)──► open
```

- O anfitrião saiu: a vaga mais antiga vira anfitriã. O último saiu: o lobby fecha.
- Caiu a conexão: a vaga fica guardada por 30 s. Voltou nesse tempo, continua na sala; senão, sai.
- As etapas do handoff andam por tempo (900, 1700 e 1500 ms, os mesmos do site) **até o app mandar os eventos de verdade** pelo EngineAdapter.

## Login pela Steam: o que é verificado

1. `/auth/steam/login` cria um `state` aleatório, guarda num cookie assinado e de vida curta (`hl_login`, 10 min, httpOnly, `SameSite=Lax`, só em `/auth/steam`) e manda o `state` dentro do `return_to`.
2. No callback, antes de qualquer outra coisa: o cookie tem que existir, ter assinatura válida e não ter vencido; o `state` da URL tem que ser o do cookie (um link de callback de outra pessoa não loga você na conta dela).
3. Validação estrita dos campos `openid.*`: nenhum repetido e todos com até 512 caracteres; `mode = id_res`; `ns` do OpenID 2.0; `op_endpoint` exatamente o da Steam; `return_to` exatamente o nosso callback com o mesmo `state`; `claimed_id` igual ao `identity` e no formato `https://steamcommunity.com/openid/id/7656119XXXXXXXXXX`; `response_nonce` com horário a até 5 min do nosso relógio e **nunca usado antes** (é gasto antes de falar com a Steam, então duas cópias da mesma resposta não passam); `assoc_handle` e `sig` presentes; e `signed` cobrindo `op_endpoint`, `claimed_id`, `identity`, `return_to`, `response_nonce` e `assoc_handle`.
4. Só então, `check_authentication` direto com `steamcommunity.com`. A resposta tem que trazer `is_valid:true`.
5. Sessão nova (ID aleatório de 32 bytes) num cookie `hl_session` assinado com HMAC-SHA256, httpOnly, `SameSite=Lax`, `Secure` com `https`, válido por 30 dias. A sessão antiga desse navegador é apagada.

### Como testar o login real (no seu navegador)

Os testes automáticos usam uma Steam falsa (`httptest`). O login real precisa da sua conta e do seu navegador:

1. `cd server && go run .` (sem `DEV_LOGIN`). Opcional: `STEAM_API_KEY=<sua chave> go run .` para ver o seu nome e avatar.
2. `cd web && VITE_API_URL=http://localhost:8090 npm run dev`.
3. Abra http://localhost:5173 e clique em **Entrar com a Steam**. Você vai para steamcommunity.com, entra lá e volta para o site já logado (o nome aparece no canto da barra).
4. Para conferir a recusa: cole de novo na barra de endereço a URL do callback que você acabou de usar (fica no histórico). Tem que voltar com o aviso "Não deu para entrar com a Steam", e o log do servidor mostra o motivo (o cookie de login já foi gasto; se você repetir o fluxo e reaproveitar uma resposta antiga, o motivo é o nonce repetido).
5. **Sair** fica no menu da conta (canto da barra).

A Steam aceita `http://localhost` como `realm`. Em produção, use `PUBLIC_URL=https://...` (o cookie passa a ser `Secure`).

## Segurança básica

- **Origem:** o WebSocket só abre com `Origin` exatamente igual a `PUBLIC_URL` ou a um `WEB_ORIGIN`; sem `Origin`, recusa. Os `POST` (logout, login de teste) exigem o mesmo. Isso é a proteção contra CSRF, já que o cookie viaja junto. O CORS só libera essas origens, com credenciais.
- **Limites:** corpo HTTP até 16 KiB; mensagem do WebSocket até 4 KiB; nomes até 40 caracteres e recado da porta até 80, sem caracteres de controle nem de direção do texto (bidi); até 500 lobbies abertos; até 20 batidas pendentes por lobby; até 6 sockets por usuário e 12 por IP sem login.
- **Ritmo:** 8 pedidos por segundo por usuário (rajada de 20) no WebSocket; 10 tentativas de login seguidas por IP, depois uma a cada 2 s. Mais de 20 pedidos inválidos derrubam o socket. Cliente lento demais para receber é desconectado, em vez de segurar o servidor.
- **Servidor decide:** o cliente só manda intents; toda transição é validada contra o estado atual (anfitrião, quórum, vagas, porta, fase). Campos desconhecidos são recusados.
- **Cabeçalhos:** `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Cache-Control: no-store`.
- Erros da Steam Web API nunca levam a URL (que tem a chave) para o log.

## O que é só para desenvolvimento

O **login de teste** (`DEV_LOGIN=1`) cria usuários falsos (`dev:<nome>`) sem Steam. Ele só funciona quando tudo isto é verdade:
- `DEV_LOGIN=1` (e o servidor se recusa a subir se `PUBLIC_URL` não for localhost);
- a conexão vem de um IP de loopback;
- o `Host` é `localhost`, `127.0.0.1` ou `::1` (contra DNS rebinding);
- não há cabeçalho de proxy (`X-Forwarded-For`, `Forwarded`, `X-Real-Ip`, `X-Forwarded-Host`): atrás de um proxy local, todo visitante pareceria localhost.

Os usuários de teste são amigos entre si. **Nunca ligue isto num servidor público.**

## O que ficou para depois

- **Postgres** no lugar da memória (usuários, sessões, nonces e amigos). Os lobbies também somem num reinício.
- **Amigos:** hoje só da Steam (`GetFriendList`, buscada no login e só com `STEAM_API_KEY`). Lista privada na Steam = nenhum amigo. Não há atualização da lista sem novo login, nem amigos "da plataforma".
- **Grupo (party) de verdade:** o "Chamar" convida para o lobby em que você está. Grupo que segue o líder entre lobbies ainda não existe.
- **Eventos do app:** o handoff anda por tempo; falta o app desktop reportar as etapas e preencher o `joinCode` (EngineAdapter). Também falta o fim de partida automático.
- **Ping real:** o site mostra um ping estimado pela região até o app medir.
- **Atrás de proxy:** o IP do cliente vem do socket; para o limite por IP atrás de um proxy reverso, falta confiar em `X-Forwarded-For` só do proxy conhecido.
- **Escala:** um mutex só e presença enviada amigo a amigo; cada mudança de lobby vai para todos os sockets. Serve para centenas de jogadores, não para dezenas de milhares (aí entram Redis/NATS, como em `docs/decisao-plataforma.md`).
- **Login no app desktop** (estilo PKCE) e revogação de sessões em massa.
- **Moderação:** denúncia, bloqueio e filtro de nomes ofensivos.
- O detector de corrida (`go test -race`) não rodou aqui: precisa de cgo (gcc), que esta máquina não tem.

## Testes

```bash
cd server
go vet ./... && go test ./...
```

- `internal/lobby`: a máquina de estados com relógio falso (contagem, cancelamentos, handoff até "dentro do lobby", passagem de anfitrião, lobby que fecha vazio, remover, lotado, troca de lobby, porta, convite, reconexão dentro e fora dos 30 s, `joinCode` só para quem está na sala, filtros da lista).
- `internal/auth`: OpenID com uma Steam falsa (`httptest`): resposta válida, repetição recusada sem chegar à Steam e mais de 20 respostas adulteradas; cookies assinados (propósito, chave, adulteração, validade); `return` seguro; chave criada e relida; Steam Web API sem vazar a chave.
- `internal/httpapi`: origem do WebSocket e dos `POST`, CORS, login de teste (desligado, proxy, Host estranho, nome inválido), fluxo completo de login da Steam com a Steam falsa, sala pelo WebSocket, logout que fecha os sockets e o limite de ritmo.
- `internal/store`: sessão vencida, nonce repetido e amizade nos dois sentidos.
