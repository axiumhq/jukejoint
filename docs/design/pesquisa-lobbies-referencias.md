# Pesquisa: o que faz um site parecer um produto de lobby

Data: 2026-11-02. Complementa `docs/design/pesquisa-ux-lobbies.md` (comparativo amplo, de antes do v6) e parte do `brief-v6.md`. Aqui o foco é uma pergunta só: **o feedback do usuário foi "parece landing page, não um site de lobby" (FACEIT e Gamers Club como referência). O que, concretamente, esses produtos têm que o nosso não tem?**

Nada de código foi alterado. Direção de arte intocada.

## 0. Como ler

Legenda de confiança, por fato:

- **[V]** li a página (ou a resposta da busca citava o trecho de forma direta).
- **[S]** fonte secundária ou trecho de busca; a página oficial bloqueou a leitura (HTTP 403 em quase todo o `support.faceit.com`, `blog.faceit.com`, `help.gamersclub.com.br`, `battlemetrics.com`, `developer.valvesoftware.com`).
- **[NV]** não verificado nesta rodada. Quando aparece "conhecimento prévio", é o que eu lembro do produto, sem fonte aberta agora.
- **[Inferência]** conclusão minha.

Limite da ferramenta: o leitor de páginas devolve resumos feitos por um modelo pequeno, então detalhes finos (nome exato de coluna, texto de botão) podem estar perdidos. Onde isso pesa, marquei.

### O que já temos (lido no código)

`LobbyBrowser` + `LobbyTable` + `lib/lobbies.ts` já fazem bem: estado único por lobby (`lobbyState`: aberto, entrando, seu, já entrou, cheio, em partida, com convite, batendo na porta), calor, linha de atividade, quórum ("começa com 6: faltam 2"), "vizinho mais próximo" no vazio, `pickBestLobby` com motivos, aviso de vaga, filtros na URL, faixa "Chegando agora". **A lógica de lobby é sólida. O que falta é o entorno de produto**: nada persiste na tela fora da tabela, não existe "sala" depois do clique, amigos só aparecem como filtro e como cor, e não há um lugar onde "o que eu estou fazendo agora" viva.

---

## 1. Produto a produto

### 1.1 FACEIT (referência nomeada pelo usuário)

Fontes: <https://scope.gg/guides/faceit-en/> [V]; <https://dust2.us/news/55559/faceit-launch-20-update-with-ui-anti-smurfing-fpl-improvements> [V]; <https://www.hotspawn.com/counter-strike/news/faceit-2-0-unveils-massive-overhaul> [V]; <https://www.dust2.in/news/61890/faceit-rolls-out-detailed-post-match-pages-makes-qol-changes-to-party-finder> [V]; <https://game-docs.faceit.com/match-lifecycle/match-lifecycle-events/match-ready> [V]; trechos de `support.faceit.com` (artigos "How to Join a Match", "Navigating FACEIT", "Intro and Overview of Parties", "Waiting for players to join a CS2 match", "How to join an Overwatch match") [S, bloqueados]; <https://community.skin.club/en/news/faceit-2-0-update-all-changes-and-features> [V].

O que faz parecer produto de lobby:

- **Navegação em duas barras laterais** (redesenho "2.0", reconstruído em React): esquerda com matchmaking, Track e Clubs; **direita com perfil e opções de grupo** [V]. Ou seja, o "grupo" mora numa coluna fixa, não numa página.
- **Botão Play é o verbo dominante.** Passar o mouse mostra seus torneios/ladders em andamento; clicar leva à página Play, com matchmaking como padrão [S]. Na página de fila: escolher **Sozinho / Em grupo / Em time** [V].
- **Caixa de grupo (party)** na barra direita, com "+" que abre os amigos online; aparece como popover, fecha sem bloquear o resto [S]. Lista de amigos reconstruída para convidar mais fácil [S].
- **Fila -> "Aceitar" -> sala da partida -> conectar.** Quando a partida é achada, o indicador da fila fica laranja e há um pop-up com som para aceitar [S/V, o guia fala em bipe e botão]. Quem não aceita ou não conecta leva cooldown crescente [S].
- **Sala da partida (match room):** etapa de veto de mapa; depois um **cronômetro no centro** mostra quanto falta para conectar (3 min em matchmaking, 10 em torneio) [S]; botão **Connect** entra sozinho, ou há o comando de console para copiar [V]. Em alguns jogos a sala mostra um **código oculto com "copiar"** para colar no jogo [S]. Há chat na sala [S, pesquisa anterior].
- **Party Finder:** anúncios de grupos abertos com filtros de nível, idioma e região, **entrada em um clique**, chat e voz embutidos; mostra latência de áudio, perda de pacote e jitter para quem entra [V].
- **Pós-partida:** placar completo por jogador, abas de utilitários/mira/clutch, "Match Legends" com clipe [V]. **Isso é gamificação/estatística; não copiar.**
- API de ciclo de vida: estados `configuration -> ready -> started -> finished/aborted/cancel`; "ready" significa "pronto para começar, só esperando os jogadores entrarem" [V]. Bom vocabulário para o nosso estado interno da sala.

Lacunas: duração exata do "Aceitar" e a aparência da lista de amigos atual [NV].

### 1.2 Gamers Club (referência nomeada pelo usuário)

Fontes: <https://www.dust2.com.br/noticias/76042/cs2-como-jogar-na-gamers-club-gc> [V]; <https://www.exitlag.com/blog/pt/gamers-club-counter-strike/> [S, via busca]; tuíte oficial sobre amigos unificados (2023) <https://x.com/GamersClubCS/status/1702004363710054544> [S, trecho de busca]; tuíte oficial do beta ("convidar amigos direto da lobby", 2017) <https://x.com/GamersClubCS/status/921133597792366592> [S]; <https://help.gamersclub.com.br/pt_br/gerenciar-amigos-adicionar-remover-ryXrpfYF> [S, 403].

- **Menu em duas categorias:** "Jogo competitivo" (Lobby, Ranked solo/dupla/trio, campeonatos) e "Jogo casual" (Warmup, KZ, X1 com amigos) [V]. O produto abre **no modo de jogar**, não numa página de apresentação.
- **A unidade é a "sala" (lobby de 5):** você cria a sala, convida amigos, e **desafia outras salas**. A lista de salas filtra por nível de habilidade da sala ou dos jogadores [V]. Sala fechada não aceita estranhos; aberta aceita, a menos que o dono remova [V].
- **Fluxo do desafio:** o outro lado aceita ou recusa; ao aceitar, **as duas salas vão para a "sala da partida"**, onde há veto de mapa e o IP do servidor [V].
- **Convite de amigo em dois cliques;** na lista só aparecem amigos que **não estão em outra sala**; há notificação de convite [S, anúncio do beta de 2017].
- **Amigos unificados por GC ID** (2023), com chat, independente do jogo [S].
- **Cliente com anti-cheat é obrigatório;** o CS2 abre pelo próprio cliente [V]. Este é exatamente o nosso desenho (app abre o jogo).
- Ranked abre em janela diária (10h-23h59 dias úteis, 12h-23h59 fim de semana) [V]. Ranked exige assinatura e horas mínimas de CS [V]. **Isso é restrição de acesso, não copiar.**
- Assinatura gate: criar lobby fora de horário, escolher mapa, site sem anúncios etc. [V]. **Paywall; não copiar.**

Lacunas: não consegui ver a tela real da lista de salas, da fila nem do "Aceitar" [NV]. O que sobra é o **modelo mental** (sala > desafio > sala da partida), que é bem útil.

### 1.3 BattleMetrics (lista de servidores + página do servidor)

Fontes: tudo bloqueado (403). Só trechos de busca: lista ranqueada por uptime, jogadores e avaliações; histórico de jogadores por servidor (janelas 24 h / 7 d / 30 d); filtros por recursos e modos de jogo via parâmetros [S, <https://supercraft.host/wiki/project-zomboid/battle-metrics>; <https://app.unpkg.com/battlemetrics-wrapper@0.2.0/files/src/components/server.ts>].

- O que se sabe: **a página do servidor é uma página de dados** (status, jogadores x/máx, histórico em gráfico, endereço) [S + conhecimento prévio, NV na aparência].
- Ideia que vale: **o histórico de ocupação** (quando este lobby/modo costuma encher) vira confiança sem inventar número.
- Não consegui verificar colunas, ordenações nem layout. Não use como referência de visual.

### 1.4 Lichess (lista aberta mínima)

Fontes: <https://lichess.org> [V, página inicial; o lobby é renderizado por JS e não veio no resumo]; guia de acessibilidade <https://lichess.org/page/blind-mode-guide> e fóruns [S].

- A home oferece três verbos: **"Create lobby game"**, **"Challenge a friend"**, **"Play against computer"** [V]. Uma ação por intenção; nenhuma cópia de marketing antes.
- "Open tournaments" é uma tabela de **nome, controle de tempo, jogadores** [V]; o resto da página mostra partida ao vivo (TV), puzzle do dia e blog. Sem anúncios, tom seco [V].
- O lobby lista jogos que outras pessoas criaram; clicar em uma linha entra [S]. Há **pareamento rápido** com botões predefinidos e a possibilidade de **desmarcar os que você não quer** nas configurações [S].
- Colunas do lobby (jogador, rating, tempo, modo) e contadores "N jogadores / N partidas em andamento": conhecimento prévio, **[NV] nesta rodada**.
- Lição: **uma lista seca, ordenada, que muda sozinha, é o produto**. Não precisa de cartas.

### 1.5 Navegador de servidores do Steam + "Join Game" de amigos

Fontes: <https://wiki.teamfortress.com/wiki/ServerBrowser> [V]; Steam Rich Presence e `connect` via <https://kb.heathen.group/steam/multiplayer/rich-presence> (trecho de busca) e <https://wiki.facepunch.com/steamworks/SteamFriends> [S].

- **Abas fixas:** Internet, Favoritos, Histórico, Spectate, LAN, **Amigos** (em que servidor cada amigo está), Lista negra [V].
- **Colunas:** cadeado (senha), escudo (VAC), nome, jogo, **jogadores x/máx**, bots, mapa, **latência**, tags [V]. Clicar no cabeçalho ordena [V].
- **Filtros:** região, ping máximo, mapa, nº máximo de jogadores, tags incluir/excluir, e caixas "ocultar cheios / vazios / com senha" [V].
- **Atualização manual** (Refresh / Quick refresh): é um defeito para nós (ver `pesquisa-ux-lobbies.md`, item 2.2.6).
- **Servidor cheio:** abre "Server Info" com **Auto-Retry**, que avisa ou entra quando abrir vaga [V]. Já temos "avisar quando abrir vaga"; vale subir de importância.
- **Join Game dos amigos:** o botão existe porque o jogo publica um campo `connect` na Rich Presence; ele **abre o jogo se não estiver aberto** e passa o destino; há um campo de agrupamento (`steam_player_group`) para mostrar quem está junto [S]. Se o amigo esconde "detalhes do jogo", o botão some [S]. Lição: **presença com destino** é o que transforma lista de amigos em lista de lobbies.

### 1.6 Discord Rich Presence: "Join" e "Ask to Join"

Fontes: <https://docs.discord.com/developers/rich-presence/overview> [V]; <https://docs.discord.com/developers/discord-social-sdk/development-guides/managing-game-invites> [V]; trecho do Help Center <https://support.discord.com/hc/en-us/articles/115001557452> [S].

- **Join:** botão no perfil/lista do amigo, **quando ele compartilha atividade e há vaga** [V/S]. **Ask to Join:** quando não dá para entrar direto (ele está em partida), você pede; o anfitrião aprova e o convite sai [V].
- Os botões só aparecem se a presença tiver **id do grupo, tamanho atual, tamanho máximo e segredo de entrada**; o cartão mostra "x de y" [V]. Convite com tamanho 0 é inválido [S].
- **Cartão de convite:** imagem, mensagem do remetente, botão Join [V].
- **Entrada a frio:** se o jogo não está aberto, o Discord o abre e **segura a entrada pendente por 180 s** após o clique; se o jogo não conectar nesse prazo, a entrada se perde [V]. Esse é o tempo de referência para o nosso "abrindo o Deadlock".
- Lição: **dois verbos honestos conforme o estado** (Entrar / Pedir para entrar). Já temos "bater na porta" para privados; falta o mesmo vocabulário para amigos em partida.

### 1.7 Overwatch (Custom Game Browser / Workshop) e Halo (Customs Browser)

Fontes: <https://overwatch.fandom.com/wiki/Custom_Game> [S, 402 ao abrir; só trecho de busca]; <https://support.halowaypoint.com/hc/en-us/articles/11285208310932> [S, 403]; <https://www.purexbox.com/news/2022/12/halo-infinite-adds-custom-game-browser-new-multiplayer-map-and-much-more>; <https://destructoid.com/?p=353158> [S].

- **Overwatch:** navegador com abas **Popular, Favoritos, Recentes, Todos**; busca por **código** ou nome do modo; ícone de martelo marca modo de Workshop; compartilhamento por código curto [S]. Espectadores e tamanho de equipe configuráveis na sala [S, wiki de fãs].
- **Halo:** o navegador mora na aba Comunidade; lista **só partidas em andamento onde se pode entrar já**; filtros por mapa/modo; máximo de 24 jogadores + 4 observadores; entra no grupo (fireteam) e carrega a partida em curso [S].
- Lição: **abas de escopo (Favoritos, Recentes) e busca por código** são o que dá sensação de "meu lugar" dentro de uma lista pública.

### 1.8 Riot Client e Battle.net (chrome de cliente)

Fontes: guias de Valorant (Beebom, Twinfinite, 1v9.gg) [S, conflitantes entre si]; <https://us.forums.blizzard.com/en/blizzard/t/faqs-new-battlenet-launcher-app-feb-%E2%80%93-2021/14885> [S]; <https://playhearthstone.com/en-us/blog/13611768> [S].

- **Valorant/Riot Client:** lista de amigos **à direita da tela inicial, sempre visível**; botão direito no amigo -> Convidar; **código de grupo** (só funciona na mesma região); em partida personalizada há Convidar por Riot ID mesmo sem ser amigo [S]. Posição exata do botão Play varia entre as fontes [NV].
- **Battle.net (relançado em 2021):** mostra só as opções de lançamento do jogo selecionado, **uma** notícia e a lista de amigos; Play grande; configurações atrás da engrenagem do Play [S]. Em 2017, amigos jogando eram fixados no topo e agrupados por jogo; a lista "Now Playing" mostra quem joga o jogo selecionado [S].
- Lição: **cliente = um verbo + amigos**. A crítica à Battle.net antiga é justamente mistura de notícia, chat e grupos no mesmo nível (`pesquisa-ux-lobbies.md`).

### 1.9 hyperline.gg (concorrente direto)

Fontes: <https://hyperline.gg/> [V]; <https://hyperline.gg/mods> [V]; <https://hyperline.gg/movement> [V]; documentação do Modlock em <https://pkg.go.dev/github.com/paralin/modlock> [S].

- **Cabeçalho:** Mods, Freestyle, Creators, Patch notes, Questions, Discord, "Sign in with Steam" [V].
- **Passos de uso na home:** "Sign in with Steam" -> "Install the app (Windows or Linux)" -> "Press Play" ("Deadlock opens into the game") [V].
- **"Live now":** linha-resumo **"37 playing now in 43 lobbies"** e uma lista vertical. **Cada linha:** miniatura do modo, "<anfitrião>'s lobby", etiqueta de região (NA/EU/AS), nome do modo, texto de atividade (ex.: "Playing Box Routes and Healing Routes"), status "In game", **contagem "3/14"**, botão **Join** [V]. Sem filtros, sem amigos, sem ping visíveis na home [V]. Os números mudaram entre duas leituras (45 e 43 lobbies), então a lista é viva [V].
- **Catálogo /mods:** busca, filtros em chips (All, Arena, Movement, Duel, Practice), ordem (Hot, Newest, Most votes, A to Z), seções "By Hyperline" e "From the community", cartões com faixa de jogadores, gênero, votos e **Play** [V]. Existe um diálogo **"Join lobby" em que o anfitrião inicia o jogo**, e um rodapé "SIGNED OUT · SIGN IN TO PLAY" [V, vindo do resumo, texto exato [NV]].
- **Freestyle:** "Drop in any time, with whoever is on the server" e "No invite needed" -- modo de servidor sempre aberto [V].
- FAQ cobre custo, requisitos, convites, cheating, bans de matchmaking, criadores e falso-positivo de antivírus [V].
- **Leitura crítica [Inferência]:** a linha deles é nome do anfitrião + região + modo + status + x/y + Join. A nossa já é mais rica (ping, vagas como janelas, estados, quórum, destaque). O que eles têm e nós não: **miniatura do modo** (identidade visual por linha) e um **diálogo de lobby depois do clique, com início pelo anfitrião**. O que ninguém deles mostra: amigos, ping, filtros, favoritos, sala persistente. É aí que dá para ficar claramente na frente.

### 1.10 Extras (máx. 2): Challengermode e o lobby nativo do Deadlock

Fontes: <https://support.challengermode.com/en/game-specific/how-to-play-a-valorant-tournament> [S]; <https://www.dexerto.com/gaming/how-to-make-custom-lobbies-in-deadlock-2899778> [V]; <https://shacknews.com/article/141139/invite-friends-start-party-deadlock> [S].

- **Challengermode:** sala no site com **janela de "pronto"** antes do horário; cada jogador marca pronto; **quando todos estão prontos, um botão Play aparece no centro**; depois da partida o mesmo botão vira "Report Results"; há início automático opcional; para LoL, um código cria o lobby no jogo [S]. Lição: **um botão principal que muda de rótulo conforme a fase da sala**.
- **Lobby nativo do Deadlock** (o que o jogador já conhece e nossa sala não deve contradizer) [V]: Play > Custom Match > Custom Lobby; **12 vagas, 6 por time** (Amber Hand / Sapphire Flame); divisão por rotas com opção de desligar rotas; vaga de espectador (2) e "sem time"; **botão de pronto ao lado de cada jogador**, depois seleção de herói (um por jogador), e o anfitrião aperta **Start Match**; configurações: convites (amigos ou **código, oculto por padrão** para streamers), região (ou automática), bots, rotas, **visibilidade pública/privada**, cheats. Não achei, nas fontes, navegador público dentro do jogo [S].

---

## 2. Síntese: padrões para adotar, em ordem

Critério de ordem: quanto o padrão transforma "página com tabela" em "produto onde eu moro", dividido pelo custo visual de caber no "Minimal e preciso".

### 1. Dock persistente: "Jogar agora" + o que estou fazendo
- **O quê:** uma barra fina e fixa em todas as páginas (rodapé de 48 a 56 px, ou parte do cabeçalho) com três estados: **ocioso** ("Jogar agora" + "N jogando"), **na sala** ("Em <lobby> · 4/6 · você está pronto" + Sair + Abrir sala), **entrando** ("Abrindo o Deadlock..." + tempo).
- **Quem faz:** Battle.net/Riot (Play grande sempre à vista), FACEIT (Play + caixa de grupo na lateral), Steam (barra de amigos/atividade) [1.1, 1.8].
- **Por que dá sensação de produto:** o site passa a ter **estado**. Landing page não lembra de você; produto sim.
- **Encaixe:** só texto, uma linha, botão âmbar único. Corte: nada de ícones decorativos, contador em bolinha, nem animação. O ponto verdete de "ao vivo" é permitido (significa ao vivo).
- **Fere a arte?** Não.

### 2. A "sala do lobby" como tela própria, com URL de convite
- **O quê:** clicar "Entrar" abre `/sala/:id` (ou painel lateral largo): quem está, vagas, pronto, modo, servidor, convite, e o handoff para o jogo. A URL é o link de convite.
- **Quem faz:** FACEIT (match room), Gamers Club (sala da partida), Challengermode (lobby com Play), Deadlock nativo (lobby com pronto e Start), Hyperline ("Join lobby") [1.1, 1.2, 1.9, 1.10].
- **Por quê:** é o momento em que a lista vira "um lugar". Sem sala, o clique parece um download.
- **Encaixe:** reaproveita as "janelinhas" de vaga como slots; tipografia e números em mono. Proposta completa na seção 3.
- **Fere a arte?** Não.

### 3. Trilho de amigos com destino ("Joga em X · Entrar" / "Pedir para entrar")
- **O quê:** coluna direita fixa (some em mobile para um sheet) com **só amigos online**, cada um em uma linha: nome (verdete), onde está, x/y, e **um** verbo conforme o estado: Entrar, Pedir para entrar (privado/cheio), ou nada (offline some). Sem login: uma linha "Entre com a Steam para ver seus amigos".
- **Quem faz:** Steam Join Game, Discord Join/Ask to Join, Valorant (lista à direita), Battle.net (jogando no topo), FACEIT (lista e convite) [1.5, 1.6, 1.8].
- **Por quê:** é o sinal social mais forte de lobby. Hoje amigos só existem como filtro e cor; aqui eles viram **atalho de entrada**.
- **Encaixe:** troca "Chegando agora" no alto da trilha (ou o divide: Amigos em cima, Chegando agora embaixo). Verdete já significa "amigo". Corte: avatar redondo, status colorido de cinco cores, chat. Só texto e um ponto.
- **Fere a arte?** Não, desde que o verdete só marque amigo/ao vivo.

### 4. Handoff "Abrindo o Deadlock" com progresso e saída de emergência
- **O quê:** depois do clique, etapas curtas e verdadeiras: **Reservando sua vaga -> Abrindo o app -> Abrindo o Deadlock -> Dentro do lobby**, cada uma com tempo em mono; falha clara ("O app não respondeu · Tentar de novo · Copiar código · Instalar").
- **Quem faz:** Discord (abre o jogo e segura a entrada 180 s), Steam Join Game (abre o jogo se fechado), FACEIT (cronômetro de conexão 3 min + botão Connect + comando para copiar), Hyperline ("Deadlock opens into the game") [1.1, 1.5, 1.6, 1.9].
- **Por quê:** o maior risco do nosso produto é o intervalo web->app->jogo. Mostrar o progresso é o que faz parecer cliente e não link.
- **Encaixe:** lista de passos em texto, sem barra animada decorativa; o passo atual fica em âmbar. Não precisa de som.
- **Fere a arte?** Não. (Beep de "aceitar" do FACEIT: não, som está fora do v6.)

### 5. Lista viva e honesta (cabeçalho com totais, linhas que mudam no lugar)
- **O quê:** "**37 jogando em 43 lobbies**" no topo da lista (já temos algo como `Credits`), linhas que **mudam sem recarregar** e sem pular de posição durante o clique (congelar a ordem por ~2 s sob o cursor), lobby que fecha some com "encerrado" por um instante, nenhuma contagem que não bata (brief-v6 já exige fonte única).
- **Quem faz:** Hyperline (resumo + lista viva), Halo/Steam (Refresh manual é o anti-exemplo), Dota (lobbies falsos são o anti-exemplo) [1.5, 1.7, 1.9, `pesquisa-ux-lobbies.md`].
- **Por quê:** "ao vivo" é a promessa do produto. Se parece estático, é landing.
- **Encaixe:** já está quase pronto. Falta o congelamento sob o cursor e o "encerrado" gracioso. Corte: pulsar e destacar toda linha que muda.
- **Fere a arte?** Não, se a mudança for discreta (a linha "fresh" já faz isso).

### 6. Escopos em abas: Todos · Amigos · Favoritos · Recentes (com contagem)
- **O quê:** uma linha de abas de texto sobre a tabela, no lugar do "só amigos" como caixa; Favoritos (lobbies/anfitriões/modos fixados) e Recentes (onde você jogou) dão "meu espaço". Busca também por **código** do lobby.
- **Quem faz:** Steam (Internet/Favoritos/Histórico/Amigos), Overwatch (Popular/Favoritos/Recentes/Todos), Halo (filtros), Lichess (lista única, sem abas -- o contraponto) [1.5, 1.7].
- **Por quê:** abas de escopo são o que faz uma lista pública parecer uma ferramenta pessoal.
- **Encaixe:** texto sublinhado, números em mono. Corte: não adicionar "Popular", "Em alta", "Novos" (viram gamificação).
- **Fere a arte?** Não.

### 7. Fases da sala dentro da linha: Aguardando · Escolhendo heróis · Em partida (rodada 3/5)
- **O quê:** o estado do lobby ganha vocabulário de **ciclo de vida** (como o Deadlock nativo: pronto -> seleção de herói -> Start; como a API do FACEIT: ready -> started -> finished). A linha mostra a fase real; "Em partida" já existe.
- **Quem faz:** FACEIT (match lifecycle), Deadlock nativo, Challengermode (Play -> Report Results) [1.1, 1.10].
- **Por quê:** lista que descreve **o que está acontecendo agora** parece produto; lista que só mostra "x/y" parece catálogo.
- **Encaixe:** a segunda linha de texto do lobby já existe (`rowNote`/`activity`). Só amplia o vocabulário. Depende de o app/servidor reportar a fase [NV se o app consegue].
- **Fere a arte?** Não.

### 8. "Pronto" por vaga + início pelo anfitrião (sem fila de aceite)
- **O quê:** dentro da sala, cada vaga tem seu estado (vazia, ocupada, pronta); o anfitrião inicia quando há quórum. O "Aceitar partida" com cronômetro e cooldown (FACEIT) **só** se justifica para "Jogar agora" quando o servidor monta uma partida; para lobby público, não.
- **Quem faz:** Deadlock nativo (pronto por jogador + Start Match), Challengermode (todos prontos -> Play), FACEIT (aceitar com prazo) [1.1, 1.10].
- **Por quê:** o "pronto" é o ritual que dá peso ao grupo.
- **Encaixe:** janelinha acesa em âmbar = pronto; contorno = ocupado, não pronto. **Não usar verdete para pronto** (ele significa amigo/ao vivo).
- **Fere a arte?** Só se usar verde para "pronto" ou pop-up com som. Evitar.

### 9. Aviso de vaga com reentrada automática ("Auto-Retry")
- **O quê:** em lobby cheio, "Avisar quando abrir vaga" fica **visível no dock** ("Aguardando vaga em <lobby>") e, ao abrir, a notificação do navegador diz "Abriu 1 vaga · Entrar" (o clique é do jogador; nunca entrar sozinho).
- **Quem faz:** Steam (Server Info com Auto-Retry) [1.5]. Já temos `notify-slot`.
- **Por quê:** transforma o estado "Lotado" (que é beco sem saída) em uma fila leve.
- **Encaixe:** zero visual novo além de uma linha no dock.
- **Fere a arte?** Não.

### 10. Detalhe em expansão na linha (sem sair da lista)
- **O quê:** uma linha expande no lugar: anfitrião, regras do modo em uma frase, quem está dentro (amigos primeiro), ping por região, ocupação nas últimas 24 h em um traço de dados.
- **Quem faz:** Halo ("Ver detalhes"), Steam (Server Info), BattleMetrics (histórico 24 h/7 d/30 d [S]), Among Us ("Mais") [1.3, 1.5, 1.7].
- **Por quê:** o produto deixa explorar sem comprometer a entrada.
- **Encaixe:** expandir abaixo da linha com a mesma grade; o traço de ocupação é gráfico de dados (funcional), em ink e âmbar, sem gradiente. Se parecer enfeite, cortar.
- **Fere a arte?** Só se o gráfico virar ornamento. Manter só se for legível e com eixo.

### 11. Convite como link + código oculto + "Pedir para entrar"
- **O quê:** link copiável (a URL da sala), código curto **oculto por padrão** com "mostrar" (cuidado de streamer, como no Deadlock), e para lobby privado o "bater na porta" que já temos.
- **Quem faz:** Deadlock nativo (código oculto), Valorant (código de grupo), FACEIT (código oculto com "copiar"), Discord (Ask to Join) [1.1, 1.6, 1.8, 1.10].
- **Por quê:** o convite é o canal de crescimento em lobbies; sem ele a sala não é compartilhável.
- **Encaixe:** uma linha de texto com botão "Copiar link".
- **Fere a arte?** Não.

### 12. Grupo (party) antes de entrar: "Entrar com 2 amigos"
- **O quê:** montar um grupo no dock e entrar juntos no mesmo lobby; a vaga é reservada para o grupo.
- **Quem faz:** FACEIT (grupo na lateral direita, Party Finder), Valorant, Battle.net [1.1, 1.8].
- **Por quê:** é o que existe em todo "cliente".
- **Encaixe:** fase 2. Exige reservar vagas e tem custo de backend; não é necessário para sentir lobby. Fica por último de propósito.
- **Fere a arte?** Não, mas aumenta muito a superfície.

**Pergunta de identidade por linha (miniatura do modo, como Hyperline e Halo):** é o único item que **pode ferir** a direção ("sem efeito decorativo, sem selo"). Recomendo **não** usar miniatura ilustrada. Se precisarmos de identidade por modo, usar o **número/arcano do modo em Bodoni** (já existe `modeArcana`) ou simplesmente o nome do modo em ink médio.

### O que fica de fora do "aceitar com cronômetro"
O Aceitar com som, cooldown e penalidade (FACEIT) existe porque a fila monta 10 estranhos e uma recusa desperdiça todo mundo. Em lobby público aberto não há esse problema. Se um dia "Jogar agora" montar partidas, usar a versão leve: mensagem no dock, prazo visível, **sem penalidade**.

---

## 3. Proposta: a "sala do lobby"

Tela `/sala/:id`, aberta ao clicar "Entrar" (ou "Criar lobby"). No desktop, página inteira com a mesma grade do site; no mobile, folha cheia. O dock mostra "Em <lobby>" enquanto a sala existe, mesmo se você navegar para outra página.

```
cabeçalho do site (igual em todas as páginas)

 <  Lobbies                                            Tempo na sala 00:42 (mono)

 Bodoni:  Arena de Rotas #4                         [ Copiar link ]  [ Sair ]
 Mona, ink médio:  Modo: Arena  ·  BR-Sul  ·  22 ms (mono)  ·  anfitrião: nick

 ────────────────────────────────────────────────────────────────────────────
 Jogadores   4 / 6 (mono)    Começa com 6 · faltam 2

 Equipe A                                  Equipe B
 [●] Você            pronto  (âmbar)       [●] nick2         pronto
 [●] amigo1  (verdete)  pronto             [○] vaga livre
 [○] não pronto: nick3                     [○] vaga livre

   [●] janela acesa âmbar = pronto    [○] contorno = ocupado, não pronto
   Vaga livre mostra "Convidar" (copia o link)

 ────────────────────────────────────────────────────────────────────────────
 O modo (uma frase da ficha do modo)
 Regras em 3 linhas no máximo. "Entra no meio da partida: sim/não" · "Rodadas: 5"

 ────────────────────────────────────────────────────────────────────────────
 Controles do anfitrião (só para ele, mesma grade, texto)
   Visibilidade: Aberto · Só convite        Vagas: 6
   Remover jogador · Passar o comando · Fechar o lobby
   [ Iniciar partida ]  (inativo até o quórum; âmbar quando ativo)

 ────────────────────────────────────────────────────────────────────────────
 Entrada no jogo (só aparece para quem entra, o botão principal muda de rótulo)
   1  Vaga reservada                 00:01
   2  App aberto                     00:02
   3  Abrindo o Deadlock             00:09   <- passo atual em âmbar
   4  Dentro do lobby

   Não abriu?  Tentar de novo  ·  Copiar código  ·  Abrir manualmente  ·  Ajuda

 Rodapé do site
```

### Botão principal (um só), conforme a fase
| Fase | Rótulo do botão | Quem vê |
|---|---|---|
| Antes de abrir o jogo | **Abrir o Deadlock** | todos |
| Jogo aberto, você fora do lobby do jogo | **Voltar para o lobby** | todos |
| Dentro, falta pronto | **Estou pronto** | jogadores |
| Pronto, sem quórum | (texto) "Aguardando 2 jogadores" | jogadores |
| Quórum, anfitrião | **Iniciar partida** | só o anfitrião |
| Em partida | **Entrar na partida** (se `joinInProgress`) | todos |
| Encerrada | **Jogar de novo** / **Sair** | todos |

### Estados
- **Cheio:** a sala mostra "Lotado" e "Avisar quando abrir vaga" (mesmo vocabulário da lista).
- **Anfitrião sai:** "O comando passou para <nick>" (sem alarme).
- **Privado:** chega por link; sem link, aparece "Com convite · Bater na porta".
- **Convite por Steam:** quem tem Steam vê "Convidar amigos" com a lista de amigos online (os mesmos do trilho), um verbo por linha.
- **Falha do app:** nenhuma mensagem de erro genérica; sempre a próxima ação (tentar de novo, instalar, copiar código).
- **Desconexão:** "Reconectando..." em mono + tentativas; sala continua visível.
- **Espelhar o Deadlock:** nomes de times, quórum, vagas e a ordem "pronto -> herói -> Start" seguem o lobby nativo para o jogador não aprender duas coisas.

### Regras visuais
- Verdete só em amigo e no ponto "ao vivo". "Pronto" é âmbar.
- Sem avatar redondo colorido, sem badge de nível, sem som, sem confete ao iniciar.
- Chat: **não**. Link para o Discord da comunidade se existir.

---

## 4. O que NÃO copiar

| O quê | Origem | Por que não |
|---|---|---|
| Pontos, níveis, Elo, "Season Points", Hall da Fama | Gamers Club, FACEIT | Gamificação; é a identidade de ranqueado, não de lobby comunitário. |
| Assinatura que limita criar lobby, escolher mapa ou ver o site sem anúncios | Gamers Club (Plus/Premium) | O produto é gratuito. Paywall quebra a promessa. |
| Janela diária de fila | Gamers Club | Artificial; nossa escassez é natural. |
| Cooldown e penalidade por não aceitar | FACEIT | Só faz sentido com fila de estranhos; pune o novato. |
| Beep e pop-up de "Aceitar" | FACEIT | Som está fora do v6; modal interrompe o que a pessoa lê. |
| Placar pós-partida, "Match Legends", clipes | FACEIT | Estatística/gamificação. Fora do escopo. |
| Muralha de selos (Alpha, Hot, votos, "Novo") | Hyperline mods | Fere "sem selos"; "Hot" e votos viram corrida de popularidade. |
| Atualização manual da lista | Steam, Halo | Contradiz "ao vivo". |
| Lobbies-fantasma ou número inflado | Dota (lobbies falsos) | Destrói confiança. Uma fonte de verdade para as contagens. |
| Notícia, chat e grupos no mesmo nível | Battle.net antigo | É o que o brief-v6 corta. |
| Chat e voz embutidos | FACEIT Party Finder | Fora do foco; o Discord já existe. |
| Auto-aceite e auto-entrada | extensões de FACEIT [S] | Entrar é sempre ato do jogador. |
| Miniatura ilustrada e vídeo por modo na linha | Hyperline, Fortnite | Ferem "um efeito só" e "sem decoração". |
| Métricas de latência de áudio (jitter, perda de pacote) | FACEIT Party Finder | Informação técnica demais; ping já basta. |

---

## 5. Próximos passos sugeridos (ordem de custo/benefício)

1. Dock persistente (item 1) e trilho de amigos (item 3): mudam a sensação em todas as páginas.
2. Sala `/sala/:id` + handoff (itens 2 e 4): é o buraco funcional.
3. Abas de escopo (6) e congelar ordem sob o cursor (5): ajuste de lista.
4. Fases e pronto (7 e 8), dependem de o app reportar estado [NV].
5. Detalhe em expansão (10), aviso de vaga no dock (9), link/código (11), grupo (12).

## Avisos

- **Nenhuma instrução dirigida a mim foi encontrada** nas páginas lidas (hyperline.gg, Lichess, Discord, wikis, blogs). Uma só observação de higiene: várias páginas de busca vinham de sites duvidosos (espelhos de fórum, domínios `.pages.dev`, "skill.club"); só usei como apoio e marquei [S].
- Muitas páginas oficiais bloquearam leitura (FACEIT support/blog, Gamers Club ajuda, BattleMetrics, Valve dev wiki, Halo Waypoint, Discord Help Center, fandom). Onde apareceu **[S]** ou **[NV]**, trate como hipótese a confirmar abrindo o produto.
- hyperline.gg: os resumos vieram de um leitor automático; nomes de botão e contagens podem ter variação de grafia. A leitura mostra o estado no dia 2026-11-02, deslogado.
- Nada foi baixado, nenhuma conta foi criada, nenhum dado foi inserido em formulário.
