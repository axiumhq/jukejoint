# Spike da Fase 0: Modlock sem hyperline.gg

**Objetivo (go/no-go):** dois PCs jogam uma sessão Modlock de ponta a ponta usando **o nosso servidor de signaling**, com o `hyperline.gg` bloqueado no arquivo `hosts` dos dois PCs.

**Orçamento:** 1 semana, cerca de 15 h, 5 blocos de 2–4 h.
**Base:** Modlock fixado numa versão (a mesma nos dois PCs) e Spacewave no commit que o `go.mod` do Modlock já fixa.

---

## O que o nosso servidor precisa ter (contrato verificado no código)

No spike só existem **dois endpoints obrigatórios**:

| Endpoint | O que faz |
|---|---|
| `POST /api/signal/ticket` | O cliente manda os cabeçalhos assinados (`X-Peer-ID`, `X-Timestamp`, `X-Sw-Hash`, `X-Signature`, Ed25519). Respondemos `200` com o protobuf `SignalTicketResponse{token}`. ⚠️ **Nunca responder 401**: na versão fixada, isso derruba o peer de vez. |
| `GET /api/signal/ws?tk=<token>` | WebSocket que leva o protocolo `Signaling` (starpc dentro de `Frame`). Ele só repassa mensagens entre peers pelo ID; não vê sessão nem segredo. |

O servidor já existe pronto no Spacewave (Apache-2.0): `net/signaling/rpc/server.NewServerWithIdentify`. Exemplo de ligação em ~60 linhas: `e2e/wasm/signaling-endpoint.go`.

**Dispensáveis no spike:**
- `/api/signal/peer` (admissão): só abre quando há login salvo.
- `/api/dev-lobby`: usar `--no-lobby`.
- Login e publish.
- TURN: sem lobby é só STUN.

## Pegadinhas (todas verificadas)

1. **O daemon decide a origem, e o que sobe sozinho usa o hyperline.gg.** É preciso subir à mão, antes de tudo, nos dois PCs:
   `modlock daemon stop` e depois `modlock daemon --origin http://<servidor>:8080`.
   O daemon encerra sozinho depois de 10 min ocioso. A origem do daemon aceita `http` (o `checkOrigin` só vale para login e publish).
2. **UI dentro do jogo:** usar `--ui-port 0` em `host` e `join`. Sem isso o jogo carrega a página-ponte do hyperline.gg (`panorama/src/main.ts:15`).
3. **O código-fonte do `bridge.html` não está no repo.** Para a UI precisamos reimplementar a página a partir do protocolo em `panorama/src/bridge.ts`. Fica para o bloco 4, como meta extra.
4. **Dependências externas que sobram:**
   - download do `modlock-host` no GitHub, só na primeira vez (dá para fixar com `MODLOCK_HOST`);
   - STUN do Google, fixo no código;
   - verificação de update (desligar com `MODLOCK_NO_UPDATE_CHECK=1`).

   Nenhuma delas é o hyperline.gg.
5. **Duas contas Steam com acesso ao Deadlock** (playtest), uma por PC.
6. **Mesma versão do `modlock`** nos dois PCs. O daemon de outra versão é reiniciado.

---

## Blocos

### Bloco 1 (2–3 h): preparação
- [x] Git inicializado na pasta `Hyperline`, mais a estrutura `spike/signal` e `spike/mods`.
- [x] `modlock` **v0.1.68** em `tools/modlock-v0.1.68/` e Go 1.27.3 portátil em `tools/go/` (fora do git).
- [x] `modlock new hello` + `modlock build` → `build/mod.js` compilado.
- [x] **Teste no jogo (02/11):** com o Deadlock fechado antes, o `modlock dev` montou o conteúdo sem erro, o servidor subiu no `dl_midtown`, o jogador `lagunav.` entrou, e o servidor recebeu o comando `/hello`. ✅ Bloco 1 concluído.

### Bloco 2 (3–4 h): nosso servidor de signaling ✅
- [x] `spike/signal/main.go`: `/api/signal/ticket` + `/api/signal/ws` sobre o `signaling_server` do Spacewave, com ticket = `X-Peer-ID`.
- [x] Log de cada ticket e de cada conexão.
- [x] Teste local com **dois daemons** (pastas de estado separadas via `APPDATA`): `modlock daemon probe` abriu o link WebRTC A→B pelo nosso servidor, com round trip de 527 µs. As pegadinhas estão em `spike/signal/README.md`.
- **Saída atingida:** os peers se encontram pelo nosso signaling, sem o hyperline.gg.
- [x] **Reforço (01/11):** o ticket agora verifica a assinatura Ed25519 do pedido (hash do corpo, payload e janela de ±5 min); qualquer falha dá 403. Há 7 testes Go, e o e2e com o cliente real passou (probe de 529 µs). Pendente: token opaco no WebSocket.

### Bloco 3 (3–4 h): dois PCs, sem hyperline.gg
> **Pela internet com um amigo (01/11):** `scripts/spike/tunel.ps1` (quick tunnel do Cloudflare, com hash conferido) e `scripts/spike/empacotar-amigo.ps1` → `dist/kit-amigo.zip` (`ENTRAR.cmd`, `SAIR.cmd`, `LEIA-AMIGO.md`). Roteiro em `scripts/spike/LEIA.md`. Risco: NAT sem TURN.
>
> **Kit pronto (01/11):** `scripts/spike/` (`servidor`, `hospedar`, `entrar`, `parar`), com o passo a passo em `scripts/spike/LEIA.md`. Testado numa máquina com dois daemons: os dois sobem, o script é idempotente e o WebRTC fecha (`link established`). Observação: o `modlock daemon probe` sobre um link já aberto às vezes não mede (`0s`, "did not answer"). Isso não tem relação com o nosso servidor (0 recusas), e o teste que vale é o `host`/`join` no jogo.
- [ ] Nos dois PCs: adicionar `0.0.0.0 hyperline.gg` ao arquivo `hosts` e usar `set MODLOCK_NO_UPDATE_CHECK=1`.
- [ ] Subir o servidor num lugar que os dois alcancem: **primeiro na rede local** (IP do PC A); depois pela internet (VPS barata ou túnel com https).
- [ ] PC A: `modlock daemon --origin …` e depois `modlock host --no-lobby --ui-port 0` no projeto `hello`. Anotar o código.
- [ ] PC B: `modlock daemon --origin …` e depois `modlock join <CÓDIGO> --ui-port 0`.
- **Saída (critério go/no-go):** os dois no mesmo servidor, `/hello` funciona para os dois, e nenhuma conexão com o hyperline.gg (o bloqueio no `hosts` prova isso).

### Bloco 4 (2–3 h, meta extra): UI pela nossa ponte
- [x] **Feito em 01/11:** `spike/bridge/` com página, lógica, 6 testes e harness no navegador validados. Falta hospedar em https e testar no jogo (ver `spike/bridge/README.md`).
- [x] Reimplementar a `bridge.html` a partir de `panorama/src/bridge.ts`:
  - título no formato `modlock:frame:<id>:<offset>:<total>:<seq>:<chunk>`;
  - ack via fragmento `#0`/`#1`;
  - leitura de `http://127.0.0.1:<porta>/panorama/stream`.
- [ ] Hospedar em https no nosso domínio e rodar com `--ui-relay https://nosso.dominio`.
- **Saída:** um painel JSX do `hello-ts` aparece no jogo do guest.

### Bloco 5 (2 h): resultado e próximos passos
> **Adiantado (01/11):** especificação do `EngineAdapter` em `docs/engine-adapter.md`. Teste no jogo (bloco 1): o servidor subiu e o mod iniciou, mas o conteúdo não montou porque o Deadlock já estava aberto (`gameinfo.gi` travado). Repetido com o jogo fechado em 02/11: funcionou.
- [ ] Registrar em `docs/spike-resultado.md` o que funcionou, latência, falhas de NAT e versão testada.
- [ ] Esboçar a interface `EngineAdapter` (host, join, publish, check) com base no que foi usado.
- [ ] Decidir: **go** (seguir para o MVP) ou **no-go** (reavaliar o fork).

---

## Se der errado

| Sintoma | Provável causa | Ação |
|---|---|---|
| O daemon continua indo ao hyperline.gg | Ele subiu sozinho antes do nosso | `modlock daemon stop` e subir com `--origin` |
| O peer falha logo de cara | O ticket respondeu 401 ou o daemon é de outra versão | Ticket sempre 200; conferir versões |
| O join não conecta pela internet | NAT simétrico sem TURN | Testar na LAN; depois adicionar TURN (coturn) via lobby |
| O jogo abre mas não entra | `-insecure` ou playtest sem acesso | Conferir a conta Steam e o console (`-condebug`) |

## Fora do escopo do spike
Login Steam, lobbies, app Tauri, publish, correções de segurança e conteúdo/mapas. Tudo isso é MVP.
