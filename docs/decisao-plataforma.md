# Plataforma de custom games para Deadlock: documento de decisão

> **Nome: em aberto.** Candidatos considerados: Vortex, Backalley, Wardstone, Sigilworks e Hexgate. A escolha fica para depois.

*1º de novembro de 2026. Montado a partir de 6 agentes: análise do código do Modlock em 3 frentes, auditoria de UX do hyperline.gg (Sonnet), panorama de concorrentes (Haiku) e arquitetura (Opus). Os pontos principais foram conferidos no código.*

Legenda: **[V]** verificado no código ou nas fontes. **[I]** inferência, precisa validar.

## Contexto em 30 segundos

- O **hyperline.gg** é gratuito, faz login pela Steam e usa um app de bandeja que abre o Deadlock dentro de um modo. Tinha cerca de 130 jogadores simultâneos, a maioria no Freestyle (movimento). São 5 mods, um time de 2 pessoas e patches diários.
- O motor é o **Modlock** (MIT) **[V]**:
  - o `modlock-host.exe` carrega o `engine2.dll`/`server.dll` do próprio Deadlock e sobe um servidor `-dedicated -insecure`;
  - as funções do jogo são achadas por assinaturas de bytes e RTTI;
  - os mods rodam como `.wasm` no Wasmtime;
  - a UI é JSX transmitido por diffs;
  - a rede P2P usa WebRTC.
- A cada patch do Deadlock, assinaturas e offsets fixos podem quebrar **[V]**. A ferramenta `modlock-sigcheck` ajuda a consertar.
- **Concorrência:** o Deadworks oferece servidores dedicados com SDK em C# e aluguel de US$16–31/mês, e a UI customizada dele ainda está em desenvolvimento. O Deadlock Mod Manager e o Grimoire cuidam só de mods cosméticos.
- **Valve:** não há posição oficial sobre custom games no Deadlock. No Dota 2 (2023), monetizar mods foi declarado violação do EULA.

## 1. Três caminhos

| | **A: Modlock como dependência upstream** | **B: Fork do Modlock** | **C: Motor próprio (ou Deadworks)** |
|---|---|---|---|
| **O que é nosso** | Web, API, auth, lobbies, signaling/TURN, CDN, app desktop, painel do criador, nosso `bridge.html` | A + host C++, daemon Go, SDK | Tudo |
| **Dependência** | `modlock-host`, assinaturas, runtime Wasm, SDK, P2P | Só do Deadlock | Só do Deadlock (ou do Deadworks: beta, licença a confirmar **[I]**) |
| **Tempo até o MVP** | 4–6 semanas **[I]** | 6–8 semanas | 6–12 meses até a paridade **[I]** |
| **Quem conserta o patch do Deadlock** | Eles (nós só atualizamos a versão fixada) | Nós | Nós, sem ferramenta pronta |
| **Manutenção** | Melhor esforço/estabilidade para um time pequeno | Esteira de patch eterna em C++ | A pior |

**Verificado no código:**
- `--ui-relay` (`cmd/modlock/play.go:41`) deixa a página-ponte da UI ser servida pela nossa origem.
- `--origin` existe em `daemon`, `host`, `login` e `publish`. Signaling, login e publicação podem apontar para a nossa API.
- O código-fonte da ponte está em `panorama/src/`.

## 2. Recomendação: **A, com porta de saída para B**

Consumir o Modlock fixado por versão: os pacotes Go importados direto e o `modlock-host` como sidecar. Tudo fica atrás de uma camada `EngineAdapter` (host, join, publish, check). Se o upstream mudar de rumo, viramos fork sem reescrever a plataforma. As correções de segurança vão para o upstream em PRs.

**O que nos diferencia de verdade:**
1. **Confiança e segurança como produto:** pacotes assinados, hash visível, a tela "o que este mod toca" e correção dos furos da seção 4.
2. **BR/LatAm primeiro:** servidor em São Paulo, pt-BR/es e comunidade local **[I]**.
3. **Conteúdo, não só script:** pipeline de assets Source 2 (modelos, mapas, VFX) vindos do Blender, validado no navegador. O hyperline é CLI-first.
4. **Valor sem instalar:** prévia web (o sandbox wazero e a página de preview já existem **[V]**), clipes e deep-link para o jogo.
5. **Social de verdade:** lobby browser com filtros e vagas, amigos, companion mobile e bot de Discord.

## 3. Arquitetura alvo

```
[Web (SSR + SPA)] ─┐
[Companion PWA]  ──┼─► [API Go] ─► Postgres
[Bot Discord]    ──┘      │  └──► Redis/NATS (presença, lobbies, filas)
                          ├─► Signaling WebRTC + TURN
                          ├─► Orquestrador de servidores (VMs Win/Proton, SP primeiro)
                          ├─► Pipeline de publish (worker isolado: modlock check + scan)
                          └─► CDN de conteúdo (endereçada por sha256, manifesto assinado Ed25519)
[App desktop Tauri] ─ sidecar: daemon Modlock + modlock-host fixados
                    └ serve /bridge.html no NOSSO domínio (--ui-relay)
```

- **Web:** monorepo TS (pnpm + Turborepo). Marketing com SSR e CSP estrita, mais um app React (Vite) com design system próprio.
- **API em Go:** importa direto `publish`/`check` e os tipos protobuf do Modlock. Postgres e WebSocket para lobbies.
- **Auth:** Steam OpenID 2.0 com cookie httpOnly. No desktop, login estilo PKCE.
- **Lobbies:** estado autoritativo no servidor, filtros, vagas, amigos e estado vazio honesto ("0 lobbies → hospedar / jogar com bots").
- **App desktop:** Tauri + React, deep-link `nossoapp://join/...` e tela de instalação transparente (o que ele toca, hash, recuperação de falso positivo de antivírus).
- **Painel do criador:** upload pelo navegador ou pela CLI, validação, fila de revisão, analytics e changelog legível.

**Onde a sua experiência pesa:**
- **FiveM/NUI:** a UI do Modlock (JSX → diffs, botões validados no servidor) é o modelo NUI com servidor autoritativo. Dá para oferecer um kit de UI in-game para criadores.
- **Blender/Source 2:** o pipeline de assets custom que o hyperline não tem.

## 4. Riscos

**Valve/EULA**
- `-insecure`, sem VAC, pode ser bloqueado num patch.
- Monetizar mods é proibido pelo precedente do Dota.
- Servidores hospedados exigem os arquivos do jogo na nossa infra, o que é zona cinzenta **[I]**.

**Segurança herdada do Modlock (resolver antes de lançar):**
1. O `Watch` confia no SteamId enviado pelo guest **[V]** (`peernet/host.go:326`). Amarrar a identidade à conexão.
2. O `ServerCommand` usa denylist e chama `AllowServerChanges` para todo nome da linha **[V]** (`src/wasm/game_services.cc:68-74`). Trocar por allowlist.
3. A leitura/escrita do `gameinfo.gi` não é atômica nem travada. Usar lock e escrita via temp + rename.
4. O guest monta o conteúdo do host (incluindo Panorama JS) sem check. Montar só conteúdo assinado pela nossa CDN.
5. Qualquer jogador pode dar `/restartmod`. Restringir ao host/admin.
6. A movimentação quake só tem predição correta com cliente hookado. Avisar na UI.
7. Não verificados: escape `..\` em `session/renderer.go` (`writePackage`) e caminho de entrada do manifesto sem normalização (`src/wasm/build.cc:78`).

→ **Divulgação responsável:** reportar ao autor do Modlock antes de anunciar qualquer coisa. **Relatório verificado (01/11):** `docs/seguranca/modlock-relatorio.md`, com 8 achados (2 altos: escape de caminho no guest Windows e injeção via nome de bot no `kick`). O rascunho para o autor, ainda não enviado, está em `docs/seguranca/modlock-disclosure-en.md`.

**Manutenção:** dia de patch = plantão. Mitigar com CI que testa cada release nova do Modlock, rollback para a última versão fixada e uma página de status.

**Relação com os autores:** o paralin é dono do motor *e* do hyperline. Competir sem contribuir aumenta a chance de mudanças de API ou licença em versões futuras **[I]**. Contribuir correções gera reputação.

**Mercado:** o Deadlock ainda é playtest por convite (~250 mil de pico) e o hyperline tem ~130 CCU. O custo precisa ser mínimo.

## 5. Roadmap

| Fase | Duração | Entrega | Critério de saída |
|---|---|---|---|
| **0. Spike** | 1 semana | Modlock fixado com `--ui-relay` + `--origin` na nossa API | Partida de ponta a ponta com 2 PCs **sem tocar o hyperline.gg** |
| **MVP** | semanas 2–6 | Login Steam, lobby browser em tempo real, app Tauri, 2–3 modos, publish pela CLI com CDN assinada, correções de segurança 1–5 | 20 jogadores reais, crash < 5%/sessão, 0 vulnerabilidades críticas, patch absorvido em < 48 h |
| **Beta** | meses 2–4 | Painel do criador web, prévia web, servidor em SP, filtros/leaderboards, pt-BR/en/es | 10 criadores externos, pico de 100+ CCU, D7 ≥ 20%, patch em < 24 h |
| **Crescimento** | mês 4+ | Companion mobile, bot de Discord, amigos, kit de UI, pipeline Blender, região NA | CCU crescendo mês a mês, < 20% do tempo gasto em manutenção de patch |

## 5b. Ferramentas locais de offsets (checado em 01/11/2026)

Pasta `Downloads\Coisas Deadlock\Coisas Deadlock\dezlock`:
- **`dezlock-dump`**: injeta um worker no processo e gera snapshots de:
  - schema (client e server), globals e protobufs;
  - assinaturas de **funções virtuais** por classe (`signatures/server.txt`, snapshot de 24/09/2026).
- **`patterns.json`**: 13 globais do `client.dll` (entity list, view matrix etc.), mais 2 assinaturas refeitas **à mão** para o build de 06/08/2026, porque as originais quebraram.

O que isso **não** resolve sozinho a cada patch:
1. Não re-deriva assinaturas quebradas. É preciso rodar de novo e mapear à mão.
2. Não cobre funções não virtuais que o Modlock intercepta por detour inline (dano, movimento).
3. Não cobre layouts sem schema (`CMoveData`, `CGlobalVars`, `CCommand`), que são o ponto mais frágil.

O Modlock já faz as partes automáticas, e melhor:
- schema resolvido por nome;
- slots de vtable achados via RTTI;
- `modlock-sigcheck` sugere padrões novos comparando com o build anterior.

**Conclusão:** essas ferramentas não justificam o fork. Servem como apoio de diagnóstico para enviar correções upstream.

## 5c. UI: o que é deles e o que é nosso

| Camada | De quem | Precisamos usar? |
|---|---|---|
| Site/app web (React) | Hyperline, fechado | Não. O nosso é feito do zero |
| App desktop de bandeja | Hyperline (não está no repo do Modlock) | Não. O nosso é Tauri, com o daemon/host do Modlock como sidecar |
| UI dentro do jogo: primitivas JSX + estilos | Modlock (MIT) | É o canal, mas o visual é nosso |
| HUD kit no visual do HUD original + `theme` | Modlock (MIT) | Opcional. Podemos ter o nosso kit |
| Layouts Panorama próprios (`<layout src>`, `.css`) | Nosso conteúdo | Opcional. Liberdade total, mas roda código no jogo do jogador, então precisa de revisão |
| Renderer + página-ponte `bridge.html` | Modlock (MIT) | Sim, é o transporte. Hospedamos a ponte no nosso domínio https via `--ui-relay`; o padrão é `hyperline.gg` (`panorama/src/main.ts:15`) |
| "Frame" com o rótulo "modlock" nos cantos | Modlock | Não. Um host com HUD próprio descarta |

## 6. Decisões que só você pode tomar

1. **Postura com o hyperline:** ✅ **decidido (01/11/2026): regional/complementar.** Foco em BR/LatAm, compatível com o ecossistema do Modlock, contribuindo correções upstream. *(Opções eram: concorrente direto; regional/complementar; parceria antes de construir.)*
2. **Base técnica:** ✅ **decidido (01/11/2026): Modlock fixado por versão** (dependência upstream, sem fork, atrás de um `EngineAdapter`). O fork fica como plano B se o upstream recusar correções críticas, mudar licença/API ou se precisarmos alterar o motor.
3. **Público inicial:** (a) BR/LatAm primeiro; (b) global.
4. **Servidores no MVP:** ✅ **decidido: só P2P** (custo ~zero; servidor em SP fica para o Beta).
5. **Dinheiro:** ✅ **decidido: 100% gratuito.** Mod pago está fora (EULA).
6. **Código da plataforma:** (a) aberto; (b) fechado.
7. **Dedicação:** ✅ **decidido: 10–25 h/semana, sozinho.** O roadmap vale como está (MVP em ~6 semanas); o plantão de patch é seu, o que reforça deixar o motor com o upstream.
