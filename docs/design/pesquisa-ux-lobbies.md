# Pesquisa de UX: lobbies, servidores, matchmaking e descoberta de modos

Data da pesquisa: 2026-11-02. Escopo: referências externas para redesenhar o lobby, os modos e o fluxo de entrada da Hyperline (plataforma comunitária gratuita de modos customizados para o Deadlock, site + app desktop). Lê em conjunto com `docs/design/avaliacao-v3.md` (seção 3.3 e seção 4), que já diagnosticou: lobbies anônimos (18 linhas idênticas), estados errados (lobby próprio mostra "Entrar", lobby privado entra direto) e ausência de sinais ao vivo.

## 0. Como ler este documento

**Legenda de confiança** (cada fato cita a fonte; nada aqui foi inventado):

- **[P]** fonte primária/oficial que eu abri e li (página de suporte, post de dev, documentação).
- **[P*]** fonte oficial, mas só vi o trecho que a busca devolveu (a página bloqueou a leitura direta).
- **[S]** fonte secundária: imprensa, wiki de fãs, blog, guia de terceiros.
- **[C]** comunidade: fórum, Steam Community, Reddit via espelho, petição.
- **[Inferência]** conclusão minha a partir das fontes. Está sempre marcada.

**Lacunas assumidas (honestidade):**

- Não consegui ler a tela real de: Valorant (custom e seleção de modo), Apex, Fall Guys, Brawl Stars/Clash Royale, Steam, Riot Client, Battle.net, Epic, Xbox, PS5 e Gamers Club. Para esses uso apenas notas de imprensa, guias e trechos de busca, sempre marcados [S] ou [P*]. Para Brawl Stars e Clash Royale não achei fonte primária sobre a UI; trato apenas do que sei por trechos e peço verificação.
- Várias páginas oficiais (Rocket League, Bungie, Epic Help, Reddit, o blog da Gamers Club) devolveram 403 ou não resolveram. Onde isso importa, está dito.
- Não existe, nas fontes que achei, estudo quantitativo sobre "qual UI de lobby converte mais". As conclusões vêm de padrões convergentes e de reclamações recorrentes, não de A/B publicado.

---

## 1. Resumo executivo

1. **Os melhores navegadores de lobby mostram pouca coisa por item, mas a certa**: arte/identidade do conteúdo, vagas, e uma ação direta. Halo mostra mapa + modo + miniatura do mapa e dois verbos (Entrar, Ver detalhes) [P]. Among Us mostra região, mapa, tripulantes, velocidade e papéis, e entra com um toque, com "Mais" para detalhes [P].
2. **O que mais gera reclamação é lista que mente**: lobbies-fantasma, contagem inflada, servidores espelho, spam, estimativas de fila que sobem. Dota 2 [P/C], CS2 [S], FFXIV/Overwatch [C].
3. **Rotação e poucos modos ativos concentram população.** Rocket League explica o motivo no próprio texto: equilibrar o número de modos ativos "para garantir partidas de qualidade e tempos de fila razoáveis" [S, espelho de post da Psyonix]. Overwatch admitiu filas longas no Arcade e considerou reduzir cartas [S].
4. **Plataformas premium têm um verbo dominante** ("Jogar") e empurram notícia para baixo; as criticadas por "poluição" (Battle.net) misturam notícia, chat e grupos no mesmo nível [S/C].
5. **Com pouca gente, o que funciona é previsibilidade**: horários fixos (Splatoon, rotação de 2 h [P]), sessões agendadas (Fireteam Finder da Destiny 2 [P*]), avisos de quórum e, em último caso, bots com transparência (Battlefield 6 [S]).
6. **Para nós**: a cidade (um prédio por região, um andar por lobby, uma janela por vaga) já é a melhor ideia visual do mercado para população. O que falta é (a) identidade do modo em cada lobby, (b) estados com forma e verbo próprios, (c) sinais ao vivo honestos, (d) um caminho "Jogar agora" que usa o MESMO pool de lobbies e (e) uma estratégia explícita de baixa população.

---

## 2. Q1: navegadores de lobby/servidor e jogos customizados

### 2.1 Tabela comparativa

| Produto | O que cada item mostra | Filtros/ordenação | Estados e sinais sociais | Entrada | Reclamações |
|---|---|---|---|---|---|
| **Halo Infinite, Customs Browser** [P] | Nome do mapa e do modo + miniatura do mapa. 12 sessões por página. | Menu de filtros à direita muda ordenação e limita sessões (mapa, modo). Atualização é **manual** ("Refresh"). | Só entram sessões **em partida**; esperar no lobby aberto não lista. Sessões encerradas ou cheias somem no refresh. Máx. 24 jogadores + 4 observadores. Convite de amigo é pelo menu Social. | "Entrar" instantâneo ou "Ver detalhes". Não há fila: "não coloca você em fila para um jogo futuro". Ao fim da partida, o grupo vai junto ao mesmo lobby. | Jogos lotam antes de dar para entrar (um relato isolado) [S]; versão inicial com bugs e telas de carregamento infinitas [S]. |
| **Among Us, Find Game (v16.0.0)** [P] | Nº de lobbies online na sua região, mapa, tripulantes, velocidade, papéis. | Botão "Filtros": modo (Clássico/Esconde-Esconde), mapa, nº de impostores, papéis, velocidade, cooldown, tempo de voto, tags Iniciante/Intermediário/Experiente. Depois de fechar, mostra **quantos lobbies batem**; se zero, "desmarque filtros ou limpe". | Entrar por código mostra anfitrião, capacidade, região e tipo de chat **antes** de entrar. | Tocar na listagem entra direto; "Mais" abre detalhes. Criar lobby tem tela de confirmação. | A própria Innersloth cita "gritos por filtros melhores" como motivo da mudança. |
| **CS2, navegador de servidores comunitários** [S] | Lista de servidores com Steam. | Poucos. | Tokens inválidos delistam servidores online; muitos espelhos do mesmo servidor. | Entrar direto. | "Interface desajeitada, listagens de spam e muitos espelhos" levaram a um site de fã que "consulta todos os servidores e filtra espelhos falsos" [S: dust2.us]. Análises de blogueiros falam em spam e monopólio [S, só título/trecho, não li o conteúdo]. |
| **Dota 2, Arcade / Custom Games** [C/S] | Jogo + nº de lobbies abertos. | Valve descreve filtro/ordenação por tipo, descrição, conexão e vagas restantes [P*]. | Ranking por **nº de lobbies abertos**. | Botão Play pode colocar você num lobby "armadilha". | Desenvolvedores criam lobbies falsos para subir: max players -1, 24 vagas num jogo de 10; bots mantêm lobbies velhos abertos por meses; os 6 primeiros jogos teriam lobbies artificiais [C: fcalife.github.io/fixthelobbies, lido]. Correções propostas: validar configuração, delistar lobbies inalcançáveis ou de versão antiga, fechar lobbies a cada atualização. |
| **Overwatch, Custom Games** [S] | Navegador com abas **Popular, Favoritos, Recentes e Todos** (wiki de fãs). | As abas fazem o papel de filtros. | Compartilhamento por **código de Workshop**, descoberta fora do jogo (workshop.codes) [S]. | Código ou lista. | Pouca informação oficial lida; guias de baixa qualidade. |
| **Fortnite, Discover / UEFN** [P] | Arte retrato + logo em camadas, % de curtidas, selos "Novo"/"Atualizado", vídeo curto no hover (Epic's Picks). | Linhas (Top 10, Epic's Picks, gêneros) com ordem personalizada pelo histórico do jogador. | Social proof mais rico e CCU (jogadores simultâneos) ao lado do % de curtidas aparecem em "o que vem", sem data [P]. | Tile -> página de detalhes -> jogar. | 81 mil ilhas de spam removidas desde março; última leva: 44.535 duplicadas e 707 contas [P]. Miniaturas fora do padrão perdem ranking [P]. |
| **Roblox, página do jogo/Servidores** [P] | Lista paginada de servidores; seções "Servidores privados" e "Servidores em que minhas conexões estão"; filtro "Excluir servidores cheios"; ordenação asc/desc. | Teste (set/2025) para limitar quantos servidores o usuário pode navegar e restringir a API a logados; adicionar ordenações/filtros. | Comunidade pede região, idioma, idade do servidor e ping [C]; ping vem de extensões de terceiros [S]. | Entrar na linha. | Reação majoritariamente negativa ao limite de navegação: "preciso da lista toda para achar idioma, desempenho ou amigos" [P: devforum, lido]. |
| **TF2 / Garry's Mod (navegador Steam)** [S/C] | Lista clássica Steam. | Ordenar por ping, jogadores, mapa. | Quickplay existia; foi trocado por Casual (Meet Your Match). | Quickplay "deixa o computador escolher". | Críticos dizem que o matchmaking esvaziou servidores comunitários, "escondidos" no navegador [C: Steam Community; wiki.tf2.com]. PC Gamer: o navegador de servidores "saiu de moda" e fica enterrado sob opções de matchmaking [S, só manchete lida]. |
| **Minecraft Java, lista de servidores** [S/C] | Nome, MOTD, ping, jogadores (padrão do cliente). | Nenhum oficial. | Pedidos no feedback para um navegador oficial dentro do jogo; em 2026 Mojang adicionou lista de amigos e P2P (Java 26.2) [S]. | Colar IP. | "Não existe lista pré-populada no jogo" [S]. Mods de grade de cartões existem [S]. |
| **Destiny 2, Fireteam Finder** [P*] | Listagens de atividade com vagas. | Plataforma, atividade, **agora ou agendado**. | Líder escolhe entrada automática ou por candidatura. Disponível no menu Roster, no botão "Find" da atividade, no site e no app companion. | Entrar direto ou aplicar e aguardar. | Sem racional de design oficial achado. |
| **Gamers Club (BR), Lobby CS2** [P*/S] | Salas com times de 5; criar sala escolhendo time existente ou jogador a jogador. | Filtro por nível de habilidade; assinantes limitam por barra de nível mín./máx.; pré-vetos de mapa (3 para assinantes, 1 para não assinantes). | Restrição por nível desabilitada em salas privadas; mudar a faixa depois pode remover quem ficou fora. | Exige o anti-cheat da plataforma aberto para criar/entrar. | Não consegui ler a UI real; descrição vem de ajuda/blog via busca e de um guia da ExitLag [S]. |
| **FACEIT** [S] | Fila até achar 10; pop-up com som e "Aceitar" com limite de tempo, senão cooldown; depois vetos de mapa; 3 min para conectar. | Hubs por comunidade. | Chat geral e de time na "sala da partida". | Aceitar -> vetar -> conectar. | Extensões de auto-aceite existem [S]; pedido de "Aceitar partida" no Valorant para evitar dodges acidentais [S]. |

### 2.2 Padrões que se repetem

1. **O item da lista carrega a identidade do conteúdo.** Halo (miniatura do mapa), Fortnite (arte retrato + logo), Among Us (mapa). Lista de texto cinza é a exceção, e é onde a Hyperline está hoje.
2. **Dois verbos por item, no máximo**: entrar já, ou ver detalhes (Halo, Among Us). O detalhe fica um nível abaixo.
3. **O filtro devolve uma contagem** e um caminho de saída quando zera (Among Us). Nosso `avaliacao-v3` já pede o "vizinho mais próximo".
4. **Higiene da lista é parte da UX**: Dota (validação, delistar inalcançáveis), CS2 (espelhos), Fortnite (spam), Roblox (limites). Se a lista tem lixo, ninguém confia no resto.
5. **Ordenar por "número de lobbies" é manipulável** (Dota). Ordenar por jogadores ativos ou por saúde do lobby é mais difícil de falsificar [Inferência a partir de fcalife].
6. **Atualização manual (Halo) é um defeito**, não um padrão a copiar: o produto é "gente entrando agora".
7. **A fila e o navegador competem**: TF2 mostra que oferecer "Achar partida" separado da lista pode drenar a lista [C]. Nosso desenho precisa que "Jogar agora" use o mesmo pool.

### 2.3 O que os jogadores reclamam (resumo)

- Lobbies que não existem mais, que lotam antes de entrar, ou que são armadilha (Dota, Halo) [C/S].
- Interface lenta, desajeitada, cheia de spam (CS2) [S].
- Não conseguir filtrar o que importa: idioma, região, ping (Roblox, Among Us) [P/C].
- Sem lugar oficial para descobrir (Minecraft, Overwatch dependendo de sites externos) [S].

---

## 3. Q2: launchers e plataformas

Fontes aqui são majoritariamente [S]; nenhuma delas foi aberta no cliente real. O que segue é leitura de padrão, marcada como tal.

| Plataforma | O que a evidência mostra | Premium vs poluído |
|---|---|---|
| **Steam (biblioteca 2019)** [S] | Beta em set/2019, aberto a todos em out/2019. Coluna de amigos à direita destacando quem joga cada jogo, feed de atividade, módulo de "jogados recentemente", hub com notícias, amigos e coleções. Página do jogo traz "Eventos e atualizações recentes" e atividade de amigos. | [Inferência] Amigos aparecem **no contexto do jogo**, não numa aba separada. |
| **Riot Client / Valorant 5.08** [S] | Client único com páginas de entrada por jogo. No 5.08: abas viraram menu vertical em texto grosso, botão Play maior e vermelho, lobby sem decoração inútil, mais contraste, cartas de jogador mais destacadas. Citação do designer: remover "muita poluição visual" e melhorar a legibilidade. | Premium = **um verbo grande** e remoção de enfeite. |
| **Battle.net** [S/C] | Redesenho de 2021. Fórum: "ocupado demais", comparado a feed de rede social, notícias demais e pouca biblioteca, chat e grupos embutidos sem recolher. | Poluído = notícia/social no mesmo nível do Play. |
| **Epic Games Launcher** [S] | Epic admite lentidão; reescrita em curso (2026) com página dedicada por jogo com status, atividade, detalhes e controles de jogar; biblioteca em grade/lista. Primeiros testes: bugs. | Lição: página do jogo com status + atividade + Play, mas **velocidade** também é premium. |
| **Xbox app PC** [S] | Home reformulada (dez/2024) com linha "Amigos e comunidade" e lista de amigos resumida sem aba separada; nova reforma anunciada em out/2026 focada em velocidade e navegação simples. | Menos abas, mais contexto. |
| **PS5 Activities / cartas** [S] | Cartas no Control Center mudam com o jogo; cartas de festa/amigos permitem **entrar direto** na sessão deles. | Entrada em 1 passo pela carta do amigo. |
| **Discord Activities** [P] | Prateleira ("Activity Shelf") com metadados e arte configuráveis; guia de design: "bom sozinho, melhor com amigos", grupos de 3 a 8 retêm mais; prever entrada no meio da sessão (dar algo para fazer, espectar); convidar em **momentos certos** (alguém saiu, falta o mínimo); sessão fecha quando o último sai; evitar login/paywall cedo. | Referência direta de "sala de espera" e vazio com propósito. |

**Padrão "Jogar agora" vs "Procurar" (síntese minha, apoiada em Valorant 5.08, Among Us e TF2):**

- Um CTA primário dominante ("Jogar agora") alimentado pelos mesmos dados da lista.
- "Procurar" como segunda porta, para quem quer escolher modo/amigos.
- Evitar um segundo pool só para o "rápido" (efeito TF2).

---

## 4. Q3: matchmaking, sala de espera e baixa população

### 4.1 Filas, temporizadores e "aceitar partida"

- **Overwatch Role Queue** (análise de blog sobre a beta, não documentação Blizzard) [S]: o tempo de fila fica no alto de cada caixa de papel, caixa verde para fila rápida; botão principal cinza até escolher, depois laranja; o mesmo símbolo do papel aparece em seleção, personagem, avatar, grupo e tela pós-partida (reconhecer em vez de lembrar); incentivos (créditos/caixas) ligados aos papéis mais necessários. Lição: **mostrar a fila no ponto de decisão** e premiar quem preenche vaga escassa.
- **Estimativas enganam** [C]: no FFXIV a média mostra só o tempo de quem espera há mais; sozinho na fila, o número sobe até 30 min; no Overwatch 6v6 "7 min" virou 0 quando 3 tanques apareceram; petição na The Finals pede estatísticas ao vivo em vez de estimativa. Prática sugerida por um guia: contador ao vivo, posição, e **refletir que o critério foi ampliado** [S]. Lição: **mostrar fatos observáveis ("3 na fila, último entrou há 40 s") antes de prometer um tempo.**
- **Aceitar partida / ready check** [S]: LoL tem timeout de 5 min por perder o check; jogadores de Valorant pediram "Aceitar partida" para evitar dodge acidental; FACEIT usa pop-up com som, limite de tempo e cooldown. Lição: estado crítico com **tempo visível**, som opcional e consequência clara.

### 4.2 Sala de espera e grupos

- Halo: o grupo (Fireteam) entra no match em andamento e, ao fim, volta junto ao lobby; o líder reinicia com o mesmo grupo [P]. Lição: **"Jogar de novo com este grupo"** é o melhor retorno que existe.
- Discord: convite sugerido no momento em que alguém sai ou falta o mínimo; sala vazia tem finalidade (espectar, convite, prévia) [P].
- Destiny: líder escolhe se qualquer um entra ou se precisa candidatar-se [P*].

### 4.3 Baixa população: o que as fontes sustentam

| Tática | Evidência | Observação |
|---|---|---|
| **Concentrar modos** | Rocket League: Dueling Arcade Playlists com duas vagas rotativas por semana; o mais popular fica, o outro volta mais tarde; se ambos vão mal, trocam os dois; um modo de tempo limitado toma uma vaga e pausa o sistema [S: espelho do post da Psyonix]. Overwatch: Arcade exibe no máximo 5 modos (2022) e a Blizzard cogitou "reduzir o número de cartas e/ou juntar modos numa fila rotativa" por causa de filas longas (fev/2023) [S]. | O texto dos fontes **não** diz que as cartas dividem o pool; isso é [Inferência] minha, razoável mas não confirmada. |
| **Ritmo previsível** | Splatoon 3: rulesets do Anarchy Battle mudam a cada duas horas; cronograma fica numa seção de estágios; Splatfest é previsto nas notícias [P]. | Rotação transforma "tem gente?" em "quando?". |
| **Sessões agendadas / entrar por candidatura** | Fireteam Finder: "agora ou agendado" e entrada automática ou por candidatura [P*]. | Único exemplo de agenda em LFG oficial que achei. |
| **Bots / backfill** | Battlefield 6: bots entram quando um grupo inicia e a pré-rodada demora; cada vez que um humano entra, um bot sai; justificativa: evitar esperar "possivelmente para sempre" em regiões de baixa população [S: GamesRadar, só manchete e trechos]. Splitgate: backfill criticado por jogadores [S]. | Funciona, mas a percepção de "fila morta disfarçada" é a queixa. Se usar, **diga**. |
| **Trap/ghost lobbies** | Halo (lobbies vazios por desafios de passe) [S]; Dota (lobbies armadilha) [C]. | O vazio mentiroso é pior que o vazio honesto. |
| **Notificar / avisar** | Não achei um jogo grande com "avise-me quando houver N jogadores". Sinais indiretos: Halo não tem fila para jogos cheios [P]; botão "Avisar quando vagar" é proposta do nosso `avaliacao-v3`. | [Inferência] espaço livre no mercado. |
| **Mapa de calor de população por hora** | Busca não achou UI oficial que mostre "melhor hora para jogar este modo". Só guias genéricos [S] e queixas de baixa população no horário morto [C]. | Possível diferencial; exige histórico próprio. |

### 4.4 O que isso diz para uma comunidade pequena

1. **Menos modos "ligados" ao mesmo tempo, mais horário marcado.** [Inferência apoiada em RL, OW, Splatoon, Destiny]
2. **Vazio com propósito**: nunca "Nenhum lobby"; sempre um próximo passo (abrir o primeiro, entrar na próxima sessão, avisar). [Discord, Among Us]
3. **Nada de número falso.** Dota, Roblox e os fãs de CS2 mostram o custo.
4. **Se entrar bot/ensaio, rotule.**

---

## 5. Q4: descoberta de modos

| Jogo | O que a fonte mostra | Lição |
|---|---|---|
| **Fortnite** [P] | Hero carousel em vídeo, tiles retrato grandes, Top 10, "Epic's Picks" com trailer no hover, selos Novo/Atualizado, % de curtidas, linhas personalizadas pelo histórico; miniaturas e logo obrigatórios (retrato, paisagem, logo) e fora do padrão afetam ranking (Epic Dev Community, 5 out 2026; 4 ago 2026). GamesBeat (cobertura do Unreal Fest 2026) [S] cita convite para experimentar algo novo no login e CCU/curtidas nas miniaturas. | Arte forte e obrigatória por modo; a lista é curada **e** automática; explicar o ranking. |
| **Rocket League** [S] | Menu Play em cartas por categoria (nov/2023); Arcade com dois slots rotativos e votação implícita por popularidade semanal; LTM ocupa um slot. | Duas vagas, popularidade decide quem fica, tempo limitado como evento. |
| **Overwatch Arcade** [S] | Arcade como categoria do Play (junto de Rápido, Competitivo, Custom, Treino); limite de 5 modos; rotação mais frequente (1 a 2 semanas); Mystery Heroes e Team Deathmatch saíram do Arcade para o Não Ranqueado; filas longas em alguns modos. | Cuidado com cartas demais. |
| **Splatoon 3** [P] | Rotação de 2 h, cronograma na seção de estágios, Splatfest anunciado nas notícias. | Relógio público de rotação. |
| **Fall Guys** [S] | Seletor com Em destaque / Criados por jogadores / Clássicos; aba Descobrir com rodadas criativas que atualiza a cada poucas horas; fila para vários shows ao mesmo tempo. | Separar "oficial" de "da comunidade" em abas simples. |
| **Apex** [S] | Guias dizem que o menu Play mostra o mapa atual e o tempo até a troca; LTMs em "Tempo limitado". Não verifiquei a UI oficial. | Contagem regressiva pública. |
| **Valorant** [S] | Cartões de modo e menu Play maior (5.08). Detalhes de duração/regras conflitam entre fontes; não usei. | Um Play dominante. |
| **Brawl Stars / Clash Royale** | Sem fonte primária; trechos de terceiros falam de rotação de modos por horas e contadores de "próximo evento". | Marcado como não verificado. |

**Síntese para modos:** cada modo precisa de (a) arte própria reconhecível a distância, (b) uma linha de regra em 1 frase, (c) um indicador de "agora" (rotação, jogando, melhor hora) e (d) um limite de quantos ficam "em cartaz" ao mesmo tempo. [Inferência]

---

## 6. Q5: heurísticas de intuitividade relevantes para lobby e modos

Base: Nielsen (10 heurísticas) [P: nngroup.com/articles/ten-usability-heuristics/]; Hodent, *The Gamer's Brain* (usabilidade + "engage-ability", incluindo sinais e feedback, forma segue função, carga mínima, acessibilidade) [S: Creative Bloq; Routledge]; Desurvire et al., HEP (CHI 2004, 43 heurísticas em jogo, história, mecânica e usabilidade) e PLAY (50 heurísticas), com a crítica de que a lista era longa demais para memorizar [S: CHI'04, Springer 2009]; Game UI Database como biblioteca visual [P: gameuidatabase.com, 1.984 jogos, 79.069 telas; categorias "Mode & Screen Select", "Title & System Menus" e "Meta-Game Features"].

Os princípios que mais pesam num site de lobby e modos (a ligação ao nosso caso é minha):

| # | Princípio | Origem | Aplicação aqui |
|---|---|---|---|
| 1 | **Visibilidade do estado do sistema** | Nielsen 1 | Quem entrou, há quanto tempo, em que rodada, "você está aqui". É o problema nº 1 do `avaliacao-v3`. |
| 2 | **Sinais e feedback** | Hodent | Cada estado precisa de forma + texto, não só cor (cheio, em partida, privado, seu). |
| 3 | **Carga mínima / divulgação progressiva** | Hodent; Among Us ("Mais") [P] | Nível 1 com 5 itens, o resto no detalhe. |
| 4 | **Reconhecer em vez de lembrar** | Nielsen 6; Overwatch (símbolo repetido) [S] | O selo do modo aparece idêntico em lista, cidade, diálogo e criar lobby. |
| 5 | **Prevenção de erro** | Nielsen 5; Dota (lobbies inválidos) [C] | Privado não entra direto; seu lobby não mostra "Entrar"; validar configuração ao criar. |
| 6 | **Consistência e padrões** | Nielsen 4 | Usar o vocabulário que o jogador BR já tem (lobby, sala, vagas, "falta 1", nível), como a Gamers Club [P*]. |
| 7 | **Flexibilidade e eficiência** | Nielsen 7 | Jogar agora para o apressado, filtros/atalhos para o veterano, vista compacta. |
| 8 | **Estética e design minimalista** | Nielsen 8; Valorant 5.08 [S] | Retirar o que não decide. Remover o "Aberto" repetido. |
| 9 | **Controle e liberdade** | Nielsen 3 | Sair do lobby, fechar o seu, cancelar entrada. |
| 10 | **Motivação por autonomia, competência, relação** | Hodent (engage-ability); análise do Role Queue [S] | Escolher sem pressão, objetivo claro, ver quem está (relação). |
| 11 | **Honestidade dos dados** | Dota, CS2, Fortnite spam [P/C/S] | Nada de lotação fabricada; estimativas como faixa ou fato observado. |

Observação sobre Fitts/Hick: não achei fonte específica de jogo para estes dois; os tratei como conhecimento geral de IHC. Alvos de 40 px para o selo e 24 px mínimos (WCAG 2.5.8, já citados no `avaliacao-v3`) continuam valendo.

---

## 7. Q6: síntese para a Hyperline

### 7.1 Informação por lobby: três camadas

**Camada 1 (leitura de lista; máx. 5 itens visíveis):**

1. **Selo + nome do modo** (arte do modo; nunca só texto cinza). Refs: Halo (miniatura), Fortnite (arte + logo), Among Us (mapa).
2. **Nome do lobby** (curto) e anfitrião.
3. **Vagas em pips + "Faltam N"**. Pips ficam em latão (regra do projeto: latão é gente).
4. **Amigos dentro** (até 3 avatares, verdete). Refs: Steam (amigos por jogo), Roblox ("servidores em que minhas conexões estão").
5. **Região/ping** curtos + **ação**.

**Camada 2 (hover/foco/toque em "Detalhes"):** nomes dos jogadores, regras do modo em 1 frase, aberto há X, atividade recente ("Ametista entrou agora"), rodada/tempo, tipo de entrada (aberto/convite/senha). Refs: Halo "Ver detalhes", Among Us "Mais".

**Camada 3 (diálogo de entrada ou página do lobby):** sala de espera, convidar, link, chat mínimo, sair.

### 7.2 Estados e rótulos (propostos, em pt-BR)

| Estado | Rótulo | Ação primária | Ação secundária | Referência |
|---|---|---|---|---|
| Aberto (padrão) | sem rótulo (só "Faltam N") | **Entrar** | Detalhes | Among Us: o normal não grita |
| Quase cheio | "Falta 1" | **Entrar** | Convidar | `avaliacao-v3` D |
| Começando | "Começa em 00:45" | **Entrar** | n/a | FACEIT/LoL: tempo visível |
| Em partida, entra no meio | "Em partida · rodada 3/5" | **Entrar no meio** | Avisar quando acabar | Discord: drop-in |
| Em partida, não aceita | "Em partida" | **Avisar quando acabar** | Ver jogadores | `avaliacao-v3` |
| Cheio | "Lotado" | **Avisar quando vagar** | Ver jogadores | Halo: "cheia some" (nosso melhor: avisar) |
| Só com convite | "Com convite" (uma palavra só; hoje há "Com senha" e "só entra com convite") | **Bater na porta** / **Tenho convite** | n/a | Fireteam Finder (candidatura) |
| Seu lobby | "Você está aqui · Anfitrião" | **Convidar** | Fechar lobby | corrige o P1 |
| Você entrou | "Você está aqui" | **Sair** | Convidar | controle e liberdade |
| Obsoleto/sem sinal | removido da lista; se for seu, "Sem sinal há 2 min" | n/a | n/a | Dota: delistar o que não dá para entrar |

**Higiene da lista (obrigatória):** validar vagas e modo na criação; heartbeat com tempo limite; delistar lobbies fantasmas; fechar lobbies ao mudar de versão do modo. Refs: fcalife, Dota; Fortnite spam [P].

### 7.3 Dez recomendações priorizadas

Prioridade: **P0** = corrige erro ou é fundação; **P1** = grande ganho; **P2** = depois. Esforço: S/M/L.

1. **[P0, S] Corrigir estados errados e criar a tabela de estados acima.** "Você está aqui" no seu lobby; privado exige convite/senha; uma palavra só para "privado"; heartbeat/delistar fantasmas. Ref: `avaliacao-v3` 3.3; Dota fcalife [C]; Halo (sessões cheias/encerradas saem) [P].
2. **[P0, M] Identidade do modo em todo lobby** (selo de 40 px + friso + nome do modo como texto). É a fundação do `avaliacao-v3` 4.2.A, agora apoiada por Halo, Fortnite e Among Us. Valor: reconhecer à distância.
3. **[P0, M] "Jogar agora" que usa o MESMO pool de lobbies**, com "Procurar" como segunda porta. Escolhe pelo `score()` (vagas, amigos, ping, calor); se não houver, oferece abrir o primeiro lobby do modo mais jogado. Refs: TF2 Quickplay/Casual [C/S]; Valorant 5.08 Play dominante [S]; Among Us "toque entra" [P].
4. **[P1, S-M] Sinais ao vivo honestos + calor** no lugar da coluna "Aberto": "entrou agora", "aberto há 3 min", "Esquentando/Lotando/Quieto" com regra pública; cabeçalho com "N jogando agora · N lobbies". Ordenar por jogadores ativos/saúde, nunca por contagem de lobbies. Refs: Dota (ranking manipulável) [C]; Fortnite (CCU + % curtidas planejados) [P]; fila que mente [C].
5. **[P1, S] Filtros curtos com contagem e vizinho mais próximo.** Visíveis: modo, região, "com vaga", "com amigos". Contagem após filtrar; se zero, "Duelo em EU: nenhum. BR/SA: 1 (12 ms)" + "Abrir o primeiro". Ordem padrão: amigos > calor > ping. Atualização automática, sem botão Refresh. Refs: Among Us [P]; Halo (refresh manual é defeito) [P]; Roblox "Excluir cheios" e pedidos de região/idioma [P/C].
6. **[P1, M] Mode cards como cartaz, com "Em cartaz agora" e limite de modos ligados.** No máximo 3 a 5 modos em destaque por vez, com rotação marcada e um relógio público. Cartaz com arte, 1 frase de regra, jogando agora e melhor hora. Refs: Fortnite (arte obrigatória, hero, Top 10) [P]; RL Dueling [S]; OW Arcade (limite de 5 e queixas) [S]; Splatoon (2 h) [P].
7. **[P1, M-L] Estratégia explícita de baixa população**: Sessões do Dia em horários fixos hospedadas pela casa ("Quartas, 21h BRT: Cofre"); "Marcar presença"; "Avise-me quando houver 3" (in-app/Discord/e-mail); estados vazios com próximo passo; indicador "quieto agora, mas 14 jogaram ontem às 21h". Se um dia houver bots/ensaio, rotular. Refs: Fireteam Finder (agendado) [P*]; Splatoon (previsibilidade) [P]; BF6/Splitgate (bots com custo de percepção) [S]; Discord (empty states com propósito) [P].
8. **[P1, M] Sala de espera viva** após "Entrar": lista de quem chegou aparecendo, "Faltam 2", tempo de começo, ready check com contagem e som opcional, convidar amigos, link com prévia ao vivo (vagas e modo), sair e "Jogar de novo com este grupo". Refs: Discord (convite no momento certo) [P]; FACEIT/LoL (aceitar com tempo) [S]; Halo (grupo volta junto) [P].
9. **[P1, S-M] Amigos primeiro**: faixa "Amigos jogando agora" no topo de `/lobbies` e na home, entrar com 1 clique; amigos como padrão de ordenação e seção própria. Refs: Steam (amigos no contexto do jogo) [S]; PS5 (carta de amigo com "Entrar") [S]; Roblox ("servidores em que minhas conexões estão") [P]; Xbox (linha Amigos e comunidade) [S].
10. **[P2, M] Celular: vista compacta (56 px, 10 a 12 por tela), folha inferior de filtros, "Jogar agora" fixo, grupos recolhíveis por modo.** Premissa a confirmar: se o jogo só inicia no desktop, o celular é para descobrir, reservar, avisar e compartilhar ("Entrar quando eu estiver no PC"). Refs: Among Us (toque entra) [P]; Fireteam Finder também no app/web [P*]; Discord (carregamento curto para quem entra de passagem) [P]; `avaliacao-v3` P2 (196 px por linha).

### 7.4 Três interações de assinatura (sem equivalente nos concorrentes que encontrei)

Aviso: "não achei" não é "não existe". Procurei nas fontes acima e não vi essas combinações; confirme antes de comunicá-las como inéditas.

**A. A Maré (população por hora, no horizonte da cidade).**
- Um controle de tempo no rodapé da cidade ("agora, +1 h, +3 h, 21:00") que acende ou apaga as janelas conforme a ocupação histórica esperada de cada prédio/modo (BR/SA, NA, EU).
- Clique numa janela futura: "Marcar presença às 21h" -> alimenta Sessões do Dia (rec. 7).
- Dado: histórico próprio de entradas por hora/dia; no início, exibir só as Sessões do Dia agendadas pela casa e rotular "previsão" quando houver pouco histórico.
- Por que é nosso: a cidade já traduz população em arquitetura; o tempo vira o eixo que falta. Não achei UI oficial de "melhor hora" (seção 4.3).

**B. Quórum e Fusão.**
- Um lobby "em formação" declara seu mínimo ("abre com 6"); as janelas ficam vazadas até chegar. Quem quiser pode "Avise-me quando houver 3".
- Dois lobbies do mesmo modo e região, ambos pela metade, mostram a oferta "Juntar os dois?" para os jogadores de cada um; se a maioria aceitar, as janelas de um andar migram para o outro com uma animação curta e o andar vazio se fecha.
- Por que é nosso: resolve fragmentação por consentimento, não por escondê-la. Equivalentes parciais: Rocket League consolida modos por popularidade (consolida o catálogo, não os lobbies) [S]; Overwatch considerou "juntar modos numa fila rotativa" [S].

**C. A Janela Espiada (e a porta que se bate).**
- Passar o mouse, focar com teclado ou segurar o toque numa janela/linha abre um cartão vivo da sala: quem está (amigos em verdete), a regra do modo, rodada/tempo, últimas três entradas. Em lobby privado, o cartão mostra a porta e o botão **Bater na porta**: o anfitrião recebe o pedido com o perfil do candidato e decide.
- Por que é nosso: une Halo "Ver detalhes" (estático), Among Us "Mais" (estático) e Fireteam Finder (candidatura) numa leitura espacial e ao vivo, com o tema de bar clandestino dos anos 20 servindo à função (resolve o P1 do lobby privado).
- Cuidado: privacidade (mostrar só contagem em privados, como o `avaliacao-v3` propõe) e `aria-live` contido.

---

## 8. Anti-padrões a evitar (com fonte)

| Anti-padrão | Onde aparece | Fonte |
|---|---|---|
| Ranking por número de lobbies abertos | Dota 2 Arcade | [C] fcalife.github.io/fixthelobbies |
| Lobby que só aparece quando já começou | Halo CGB | [P] support.halowaypoint.com |
| Atualização manual da lista | Halo CGB | [P] |
| Home com notícia, chat e grupos no mesmo nível do Play | Battle.net | [C] fórum Blizzard |
| Estimativa de fila que sobe sozinha | FFXIV, Overwatch 6v6 | [C] fóruns |
| Vários modos competindo pela mesma gente | Overwatch Arcade (queixa de filas; a relação causal é inferência) | [S] |
| Fila separada que esvazia o navegador | TF2 Quickplay -> Casual | [C/S] |
| Bots sem aviso | Splitgate, BF6 (percepção) | [S] |
| Limitar o que o usuário pode navegar sem oferecer filtro melhor | Roblox (teste) | [P] devforum |
| Espelhos/spam na lista | CS2, Fortnite | [S]/[P] |

---

## 9. Fontes

**Primárias lidas [P]**

- Halo Infinite, Custom Game Browser Overview: https://support.halowaypoint.com/hc/en-us/articles/11285208310932-Halo-Infinite-Custom-Game-Browser-CGB-Overview
- Among Us, update 16.0.0 (Innersloth): https://www.innersloth.com/a-match-made-in-update-16-0-0-emergency-meeting-40
- Epic, Discover Redesign and Spam Enforcement (5 out 2026): https://forums.unrealengine.com/t/discover-redesign-and-spam-enforcement/2837451
- Epic, Discover update (4 ago 2026): https://forums.unrealengine.com/t/discover-update-elevating-quality-and-matching-players-to-content-theyll-love/2741174
- Roblox DevForum, teste da lista de servidores (set/2025): https://devforum.roblox.com/t/test-updates-to-server-list-page/3966648
- Roblox DevForum, metadados nas miniaturas: https://devforum.roblox.com/t/upcoming-tests-improving-game-discovery-with-relevant-information/3907203
- Discord, Activities design patterns: https://docs.discord.com/developers/activities/design-patterns
- Nintendo, Splatoon 3 beginner basics: https://splatoon.nintendo.com/en/news/beginner-basics-for-splatoon-3-the-ins-and-outs-of-playing-online
- Nielsen Norman Group, 10 heurísticas: https://www.nngroup.com/articles/ten-usability-heuristics/
- Game UI Database: https://www.gameuidatabase.com

**Oficiais, só trecho de busca [P*]**

- Bungie, Finding and Creating Fireteams / Fireteam Finder Guide: https://help.bungie.net/hc/articles/360048721772 e https://help.bungie.net/hc/articles/25787853699220-Fireteam-Finder-Guide
- Gamers Club, ajuda e blog (pré-vetos, restrição por skill level, anti-cheat): https://help.gamersclub.com.br/pt_br/pre-vetos-csgo-BJu87DNn5 , https://blog.gamersclub.com.br/nova-funcionalidade-da-lobby-restricao-por-skill-level/
- Valve/Dota 2 (descrição do navegador de custom games): https://www.dota2.com/reborn/part2/
- Roblox Creator Docs, discovery: https://create.roblox.com/docs/production/promotion/discovery

**Comunidade [C]**

- Dota 2, "Fix the lobbies" (desenvolvedores): https://fcalife.github.io/fixthelobbies
- Fórum Square Enix FFXIV (estimativa de fila): https://forum.square-enix.com/ffxiv/showthread.php?p=6141343
- Fórum Blizzard (6v6 estimativas): https://us.forums.blizzard.com/en/overwatch/t/matchmaker-queue-time-estimates-are-lying-in-6v6/945223
- Fórum Blizzard (launcher "ocupado demais"): https://us.forums.blizzard.com/en/blizzard/t/new-desktop-launcher-feels-too-busy/15346
- Steam Community (TF2/CS2): https://steamcommunity.com/app/440/discussions/0/727997490786251243 e https://steamcommunity.com/app/730/discussions/0/4637112066660934883
- Petição The Finals (estatísticas de fila): https://www.change.org/p/add-live-queue-statistics-to-the-finals-to-help-small-regions

**Secundárias [S]**

- Dust2.us, navegador comunitário de fã para CS2: https://www.dust2.us/news/65129/new-community-server-browser-aims-to-fix-major-issue-with-counter-strike-2
- TF2 Wiki, Quickplay: https://wiki.tf2.com/wiki/Quickplay
- PC Gamer, servidores customizados "em suporte de vida" (só manchete lida): https://www.pcgamer.com/custom-servers-arent-dead-but-this-decade-put-them-on-life-support
- Overwatch Wiki (Custom Game, Arcade): https://overwatch.fandom.com/wiki/Custom_Game , https://overwatch.fandom.com/wiki/Arcade
- GamingBolt sobre a fala de Keller (Arcade): https://gamingbolt.com/overwatch-2-team-will-look-at-reducing-arcade-cards-rolling-some-modes-together
- Espelho do post da Psyonix (Dueling Arcade): https://devtrackers.gg/rocket-league/p/83f64ffa-keep-a-favorite-extra-mode-in-rotation-with-dueling-arcade-playlist
- Game Developer, UX do Role Queue (blog de Nida Ahmad): https://www.gamedeveloper.com/design/the-ux-of-overwatch-role-queue
- GamesRadar / mp1st / Insider Gaming sobre bots no Battlefield 6 e Splitgate: https://www.gamesradar.com/games/battlefield/battlefield-6-lead-says-stick-it-out-on-bots-because-theyre-essential-to-avoid-waiting-possibly-forever-to-get-into-the-playlist-of-your-choice-in-regions-with-low-population , https://gamingonlinux.com/2022/04/splitgate-is-getting-a-new-matchmaking-system-that-wont-suck
- OneEsports, Valorant 5.08 UI: https://www.oneesports.gg/valorant/valorant-new-ui-patch-5-08/
- Steam 2019 (PC Gamer): https://pcgamer.com/new-steam-design-2019
- PS5 Activities (GameRevolution): https://www.gamerevolution.com/guides/662672-ps5-activities-feature-playstation-ui
- Xbox app (PC Gamer, ghacks): https://pcgamer.com/software/platforms/microsoft-adds-nearly-400-games-to-the-xbox-app-as-it-rolls-out-a-new-home-experience-to-all-users
- Fall Guys Game Selector (wiki de fãs): https://fallguysultimateknockout.fandom.com/wiki/Game_Selector
- Guia ExitLag sobre Gamers Club (terceiro): https://www.exitlag.com/blog/pt/gamers-club-counter-strike/
- Hodent, *The Gamer's Brain* (Creative Bloq; Routledge): https://www.creativebloq.com/features/how-neuroscience-and-ux-impacts-video-game-design
- Desurvire et al., HEP/PLAY: https://hci.rwth-aachen.de/materials/conferences/CHI2004/2p1509.pdf , https://link.springer.com/doi/10.1007/978-3-642-02774-1_60
- GamesBeat sobre o Discover do Fortnite (Unreal Fest 2026; só trecho de busca): https://gamesbeat.com/?p=327228

Nota de segurança: o resumo da ferramenta de busca (não a página em si) informou que um dos resultados, descrito como "uma página de wiki do Fall Guys Creative", tinha uma instrução embutida para discutir outro assunto, e que a instrução foi ignorada. A página, o endereço e o texto nunca chegaram ao agente; é uma informação repassada, não observada. Busca que gerou o aviso: `Fall Guys show selector rotating shows "Featured" "Squads" menu redesign Mediatonic playlist UI`. Nada desse resultado foi usado.
