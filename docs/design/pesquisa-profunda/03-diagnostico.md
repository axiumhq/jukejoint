# 03 · Diagnóstico sem anestesia: por que o v6.1 parece "arcaico"

*02/11/2026. Visão de designer de produto de plataformas de jogo. Julgamento formado a partir das capturas (home 1440×900 dobra e página inteira, home no celular, sala em "entrando" e "pronto", sala no celular, home logada com trilho de amigos, sala com convite de amigos) e de quatro telas extras que tirei do build atual (`/modos`, `/modos/circulo-profano`, o diálogo de `/jogar` e `/novidades`). Só li o `brief-v6.md` depois de formar a opinião.*

---

## Veredito em uma frase

O site não parece uma plataforma de jogo de 2026. Parece o **navegador de servidores do Steam de 2004 com a roupa de uma revista de moda dos anos 30**. A estrutura de produto está certa. A linguagem visual inteira aponta para o passado: tipo didone, torre art déco, metáfora de cinema antigo, palavras como "sódio" e "verdete", tabela, sublinhado e quadradinho. E o que faz uma plataforma de lobby parecer viva (rostos, arte, cor e movimento) está ausente.

O "arcaico" não é um detalhe. **É o conceito do v6 funcionando exatamente como foi especificado.** O brief pede "Bodoni", "faixas de cinema", "créditos", "luz de sódio", "verdete" e "tabela precisa", e cada um desses itens é, literalmente, uma referência a algo velho.

---

## 1. Causas do "arcaico", por impacto

### #1 · O display em Bodoni Moda (impacto muito alto · confiança alta)
- **Onde:** "O Deadlock que / a comunidade inventou." (herói), "Lobbies", "Modos", cada nome de modo em `/modos` (corpo gigante), o título da sala ("Só mira, sem choro", "Círculo da madrugada") e até o título do diálogo ("Falta só o app").
- **Por que data:** didone de alto contraste é a letra do século XIX, da *Vogue*, de convite de casamento, de cardápio de bistrô e de perfume. No jogo, só aparece em marca de prestígio ou de época. Nenhuma plataforma de lobby, cliente ou tracker usa serifa no display: FACEIT, Gamers Club, Riot Client, Discord, tracker.gg e Medal usam todos sans geométrica ou grotesca. Os sites de Valorant, Marvel Rivals e The Finals usam sans condensada ou expandida e pesada.
- **Agravante:** posto em nome de lobby de jogador ("Só mira, sem choro"), o didone transforma uma gíria de *gamer* numa manchete de jornal. É a dissonância mais visível do site inteiro.
- **Peso:** sozinha, essa escolha responde por talvez 30–40% da sensação. Troque só a fonte de display por uma sans pesada e o mesmo layout já envelhece uns 20 anos a menos.

### #2 · A cara de navegador de servidores (impacto muito alto · confiança alta)
- **Onde:** a home é uma tabela de 18 linhas com cabeçalho de colunas (Lobby, Modo, Servidor, Vagas) e o mesmo botão contornado "Entrar" repetido 17 vezes. Na sala, a lista de jogadores também é uma tabela: nome, quadradinho laranja e o texto "pronto/ainda não".
- **Por que data:** para quem joga desde o CS 1.6, isso é a lista de servidores do Steam, do HLSW ou do GameSpy: nome, mapa, jogadores e ping em colunas. É *literalmente* a interface que as plataformas modernas vieram substituir. A FACEIT e a Gamers Club nasceram para **matar a lista de servidores** e trocá-la por fila, sala e cartão de jogador.
- **Detalhe que piora:** a barra de vagas em blocos `▮▮▮▮▯▯`, em fonte mono, lembra barra de progresso de DOS ou de instalador.
- "Preciso" foi lido como "planilha". Uma tabela é precisa, mas não é convidativa.

### #3 · Ninguém no site: sem avatares, sem rostos, sem arte (impacto muito alto · confiança alta)
- **Onde:** o trilho de amigos é só texto ("Odete" em verde e "em Círculo da madrugada"). A sala tem 12 nomes sem rosto. As linhas de lobby não mostram quem está dentro. Em "Chegando agora", os nomes também são só texto. Nenhum modo tem imagem na tabela, e em `/modos` cada modo é um desenho de linha minúsculo no canto.
- **Por que data:** desde o Discord (2015), toda interface social de jogo é feita de avatares com anel de presença. A sala da FACEIT são dois times de cartões com foto, nível colorido e bandeira. O Riot Client é feito de arte de jogo enorme e de um painel de *party* com rostos. Até o hyperline.gg, a referência direta, põe uma miniatura em cada lobby de "Live now". Texto puro onde deveria haver gente lembra IRC ou fórum phpBB.
- **Por que pesa tanto:** é a diferença entre "um lugar com gente" e "um documento sobre um lugar". Para um site cujo produto é *juntar pessoas*, é a ausência mais cara de todas.

### #4 · A torre art déco e a metáfora de cinema antigo (impacto alto · confiança alta)
- **Onde:** no herói, um arranha-céu art déco com holofotes, um poste de rua, um letreiro "EM CARTAZ" e o céu azul-noite. Tudo é anos 30: Gotham, *noir*, estreia de filme na Broadway.
- **Por que data:** a imagem *representa* o passado, então não tem como não parecer passado. A ambientação do Deadlock até é dessa época, mas sem herói, sem ação e sem gente ela vira cartão-postal de Nova York em 1931. Ainda por cima, ocupa metade da dobra com pouco contraste, um azul lamacento com janelinhas amarelas, e não diz nada sobre jogar.
- **Conceito por trás:** "faixas de cinema", "créditos", "em cartaz" e "estreia" são metáforas de mídia velha. Funcionam num estúdio de animação (o igloo.inc usa narrativa, mas com estética de *gelo e tecnologia*, não de 1930). Para um lobby de jogo, são o vocabulário errado.

### #5 · O acabamento de "documento impresso" (impacto médio-alto · confiança média-alta)
- **Onde:** cantos de 2 px, caixas de contorno de 1 px, nenhuma elevação, nenhuma camada, nada de desfoque ou de brilho. Links sublinhados por toda parte ("Primeira vez? Instalar o app", "(entre com a Steam)", "Ver a ajuda", "Convidar", "Entrar com a Steam" no cabeçalho, "← Lobbies"). Filtros em caixas retangulares coladas (BR/SA | NA | EU) e *checkboxes* nativos quadrados.
- **Por que data:** sublinhado é a gramática do hipertexto de 1998. Um *app* usa botões, *chips* e ícones. O contorno fino sem profundidade, somado à serifa, dá a sensação de "papel" e não de "software". As interfaces de jogo de hoje usam superfícies em camadas (cinza 1, 2 e 3), cantos de 6–12 px (Discord, Riot, tracker.gg) **ou** um corte de canto intencional que vira assinatura (Valorant, The Finals). O canto de 2 px fica no meio: não é nem macio nem afiado, é só "padrão de tabela".

### #6 · A paleta envelhecida (impacto médio · confiança média)
- **Onde:** azul-noite `#0a0d12`, tinta creme `#ece7dc`, âmbar "sódio" `#f2a33a` e o "verdete" `#6cc2a8` nos nomes de amigos.
- **Por que data:** cada cor *quer dizer* velhice. Sódio é a lâmpada de rua que as cidades estão trocando por LED. Verdete é cobre oxidado. Creme é papel amarelado. Âmbar sobre quase preto é monitor de fósforo âmbar dos anos 80. A soma é quente, baixa e "de época". As cores não estão erradas em si. O problema é que, junto do didone e da torre, todas empurram para a mesma direção.
- **Bom de saber:** o laranja como CTA único sobre fundo escuro é eficiente (bom contraste, hierarquia clara). O problema é o *tom* (âmbar mostarda) e o creme, não a disciplina de uma cor só.

### #7 · O mono com cara de máquina de escrever nos números (impacto médio-baixo · confiança média)
- **Onde:** "1 1 / 1 2", "22 ms", "141 jogando", "agora", "22 s", em Fragment Mono com espaçamento largo.
- **Por que data:** mono em números é moderno (Vercel, Linear, o próprio igloo). O Fragment Mono, porém, tem desenho de máquina de escrever, e com espaçamento aberto vira teletipo. É a parte que o brief chamou de "créditos de filme", e é isso mesmo que parece. Um mono neo-grotesco (Geist Mono, JetBrains Mono) ou numerais tabulares da própria sans resolveriam.

### #8 · Nada se mexe (impacto médio · confiança média, porque inferi pelo código e pelas capturas)
- O único movimento é o loop do herói. A lista não "respira": não há slot preenchendo com animação, nem contador ticando, nem pulso de "ao vivo" convincente, nem entrada de amigo, nem contagem regressiva de *ready check*. A sala é estática, com dois *toasts* empilhados por cima do texto do modo.
- **Por que data:** a FACEIT, a Gamers Club e o Valorant usam movimento como **feedback de estado** (aceitar partida com timer, jogador entrando, slot pulsando). Sem isso, a sensação é de página carregada uma vez e esquecida.

### #9 · Sem marca: "PROJETO" e um quadradinho laranja (impacto médio no "não gostei", baixo no "arcaico" · confiança alta)
- Em caixa alta espaçada e pequena, com um quadrado como símbolo, parece logotipo corporativo de 2005 ou *template*. Toda referência citada (FACEIT, Gamers Club, hyperline.gg, igloo) tem um símbolo forte que carrega metade da identidade. Sem marca, o resto precisa trabalhar o dobro.

### #10 · Ícones e desenhos de modo com cara de gravura (impacto baixo-médio · confiança média)
- Quase não há ícones na interface. Em `/modos`, as "artes" de cada modo são traços finos: um pentagrama num anel, trilhos, ondas, um relógio. Parecem ilustração de almanaque ou diagrama esotérico, ou seja, mais um vetor de antiguidade, e são pequenos demais para servir de identidade do modo.

### #11 · Problemas de execução que dão sensação de "inacabado" (impacto médio · confiança alta)
- A sala tem uma coluna direita vazia abaixo do cartão de ação e um título enorme em serifa. A informação útil (quem falta ficar pronto, quando começa) fica pequena.
- Os *toasts* cobrem conteúdo: dois empilhados na sala, um cobrindo linhas da home logada.
- No celular, a barra fixa "Na sala…" aparece por cima da lista na captura de página inteira, e os dois *toasts* empurram a lista de jogadores para baixo da dobra.
- No cabeçalho da sala em "entrando", "Entrar com a Steam" quebra em três linhas.
- A primeira linha destacada ("Recomendado: falta 1") diferencia pouco da segunda. O "sugerido" precisava ser um cartão, não uma linha um pouco mais clara.

### #12 · Tom do texto (impacto baixo · confiança média)
- O texto de interface é bom (ver §2). O que envelhece é o texto *literário* ao lado do didone. "Até doze num anel ritual que fecha a cada minuto. Do lado de fora, ninguém dura." é frase de contracapa de livro. Num lobby, a regra do modo pede formato de *patch note* (ícone + regra curta).

---

## 2. O que é bom e deve sobreviver

1. **A arquitetura de produto e a lógica de estados.** "Entrar", "Entrar no meio", "Bater na porta" (lobby com convite), "Avisar quando vagar/acabar", o lobby recomendado ("falta 1", "1 amigo dentro"), "Jogar agora" que escolhe o melhor lobby e os passos de entrada (Baixando o modo → Abrindo o Deadlock → Entrando no lobby → Dentro do lobby). Isso é melhor do que muita plataforma grande faz. **Não mexa na lógica; só troque a pele.**
2. **O texto de interface em PT-BR.** É natural, curto e com humor de comunidade: "Bater na porta", "Só mira, sem choro", "Cofre com call, sem flame", "no menu do Deadlock", "Falta só o app". É um diferencial real para o público BR.
3. **O indicador persistente de sala no cabeçalho** ("Na sala Só mira, sem choro 12/12"). É o equivalente ao *party status* do Riot Client. Mantenha e promova a *pill* com avatares.
4. **A presença de amigos com contexto** ("em Círculo da madrugada", "abriu Neblina…", "no menu do Deadlock") com "Entrar" ao lado. Funcionalmente, é o *Rich Presence* do Discord. Falta só o rosto.
5. **"Chegando agora".** Um *feed* ao vivo de gente entrando é ótimo sinal social. Com avatares e animação de entrada, vira a coisa mais viva da home.
6. **A disciplina de uma cor de ação e o fundo escuro.** A regra continua certa, só muda o tom.
7. **A Mona Sans como fonte de interface.** É gratuita, variável e tem eixo de largura (75–125). Pode virar também o display, na largura expandida e no peso pesado, o que mata o didone sem acrescentar fonte nova.
8. **O diálogo "Falta só o app"** (Já tenho / Ainda não tenho, hash e antivírus). A informação está certa e transmite confiança.
9. **O *pipeline* de render no Blender** (vídeo pré-renderizado, sem 3D em tempo real). A capacidade é boa. O que precisa mudar é o *assunto* da imagem.

---

## 3. O que as plataformas atuais fazem e aqui falta

| Padrão | Quem faz | Aqui |
|---|---|---|
| **Avatar com anel de presença** em todo nome (amigo, jogador, anfitrião, feed) | Discord, Steam, Riot Client, FACEIT | Nenhum. O avatar da Steam está disponível via `GetPlayerSummaries` depois do login. |
| **Pilha de avatares no cartão do lobby** ("+7"), mostrando quem está dentro e se tem amigo | Gamers Club e FACEIT (salas), hyperline.gg (miniatura) | Só o texto "2 amigos dentro" |
| **Arte de capa por modo**, grande, com cor própria; o modo como "produto" | Riot Client, modos de Valorant e Marvel Rivals, Fortnite Discover/UEFN, Roblox | Desenho de linha de 60 px |
| **Sala como "match room"**: slots em grade de cartões, slot vazio como silhueta, READY grande com contagem regressiva, controles do anfitrião, chat | FACEIT, Gamers Club, lobby do Valorant e do Overwatch | Lista de texto com quadradinhos |
| **Painel social fixo** (amigos, convites, *party*) disponível em toda tela | Riot Client, Discord, Steam | Trilho só na home; na sala, uma caixa "Convidar amigos" |
| **Party antes do lobby**: montar o grupo e depois entrar junto | Riot, FACEIT (party), Gamers Club | Inexistente |
| **Identidade do jogador**: nível, insígnia, partidas jogadas, modo favorito | FACEIT (nível 1–10 colorido), Gamers Club (nível), tracker.gg | Inexistente (cabe uma versão leve: "142 partidas · fã de Neblina") |
| **Identidade do criador de modo**: autor, curtidas, partidas, "em alta" | Fortnite Creative, Roblox, Steam Workshop | "Criado por velha_guarda" em cinza pequeno |
| **Convites acionáveis** (toast com Aceitar/Recusar e avatar) | Discord, Riot | Toast só informativo, cobrindo conteúdo |
| **Movimento como estado**: contador que tica, slot que "estala" ao encher, pulso ao vivo, timer de aceite | Todos | Quase nada |
| **Busca e filtros em *chips***, com contagem e cor do modo | tracker.gg, Medal, Discord | Caixas retangulares e *checkbox* nativo |
| **Conteúdo de comunidade** (clipes, "jogada da semana" ou print da partida) | Medal, Outplayed, tracker.gg | Inexistente; é o tipo de imagem que *não* fere IP de terceiros, porque é do jogador |
| **Marca com símbolo e uma assinatura gráfica** (o corte diagonal do Valorant, o "H" do hyperline) | Todos | "PROJETO" |

Observação sobre o hyperline.gg (`shots/refs/hyperline-1.png`): ele não é tecnicamente brilhante, mas parece *atual* por três motivos baratos: sans pesada em corpo grande, uma cor quente saturada com degradê e miniaturas nos lobbies. Nenhum dos três exige 3D.

---

## 4. "Minimal e preciso" é o problema?

**Não o conceito; a interpretação.** O v6 leu "minimal" como **minimalismo editorial**: tirar imagem, tirar gente, tirar cor e deixar só tipografia, filetes e dados. Para portfólio, revista ou estúdio, isso funciona. Para uma plataforma social de jogo voltada a jovens BR de 16–30, isso remove justamente o que é o produto (pessoas e modos) e deixa a moldura.

Existe outro minimalismo, o de **produto**: Linear, o Riot Client de hoje, o Discord no tema escuro, o próprio igloo.inc. Nele, a *moldura* é mínima (poucas cores, uma família de tipo, superfícies discretas, nada decorativo) e o *conteúdo* é rico (avatares, capas, estados animados). **Minimal na moldura, rico no conteúdo.** É isso que o usuário provavelmente quis dizer: os pedidos foram "não quero barato" e "não quero genérico", e não "não quero imagem".

Leitura da sequência de reações:
- "3D com cara barata, layout e texto comuns" → queria *acabamento premium*.
- "minimal e preciso" → queria *corte do excesso*, não *corte da vida*.
- "parece landing page, não site de lobby" → queria *app*, não *página*.
- "arcaico, não gostei nem um pouco" → a estética de época falhou; o pedido agora é por *atual*.

O público pesa: a referência cultural do gamer BR é Gamers Club, FACEIT, Valorant, Free Fire e Discord, ou seja, sans forte, cor saturada, avatar e nível. A elegância "museu" soa distante, quase esnobe. O igloo agrada por ser *tecnológico e limpo*, não por ser *antigo*. Portanto: manter a restrição, mas com tipo sans, cor viva, gente e movimento.

---

## 5. Três direções promissoras

Valem para as três, com restrições: nada de IP da Valve ou do Deadlock (sem arte de herói, logo, fonte ou nome próprio do jogo na arte), só fontes gratuitas, nada de 3D em tempo real, e manutenção por um dev solo (tokens + ~12 componentes; capas de modo como imagem estática ou loop curto pré-renderizado). **Obrigatório em qualquer direção:** avatares em todo nome, uma capa por modo, lobbies como cartões com pilha de avatares, a sala como grade de slots com READY grande, o fim do didone e uma marca de verdade.

**A · "Cliente de jogo" (Riot Client + Discord, a mais segura para o "site de lobby").** A home deixa de ser página e vira *app shell*: um trilho de navegação estreito à esquerda (Jogar, Lobbies, Modos, Novidades), conteúdo no centro e o **painel social fixo à direita** em todas as telas (party atual com avatares, amigos com anel de presença e "Entrar", convites com Aceitar/Recusar). No topo do centro, um cartão grande de "Jogar agora" com a capa do modo sugerido. Abaixo, *rails* de modos (capas 16:9 com a cor do modo e a contagem ao vivo) e uma grade de cartões de lobby (capa do modo desfocada ao fundo, nome, pilha de avatares, ping, slots e botão). A sala vira uma grade de 12 cartões de jogador (avatar, nome, estado; slot vazio em silhueta tracejada com "Convidar"), com barra inferior fixa contendo READY grande, contador "7/12 prontos" e timer, e chat à direita. **Tipo:** Mona Sans para tudo; o display em `wdth` 115–125 e peso 800, com tracking negativo. Geist Mono ou numerais tabulares para números. **Cor:** grafite neutro em três superfícies (`#0d0e11`, `#15171c`, `#1d2027`), um acento vivo de ação (um laranja mais quente e saturado que o âmbar atual, ou um lima ácido) e uma cor por modo usada só na capa e no *chip*. **Forma:** cantos de 8–10 px e sombras quase invisíveis. **Movimento:** transições de 150–250 ms, slot que "estala" ao encher, contador que rola, presença pulsando. É a mais fácil de manter, porque é um design system de componentes, e a mais distante do "landing page".

**B · "Gelo técnico" (a lição do igloo.inc aplicada a um app).** Para quem quer o premium do igloo sem a época: monocromático frio (quase preto azulado neutro, branco gelo, cinzas frios) com **um** acento ciano elétrico ou gelo para ação e "ao vivo". Microtipografia de precisão: *labels* em mono pequeno e caixa alta (`LOBBY 04 · BR/SA · 22MS`), display em sans grotesca apertada e grande (Inter Tight, Geist ou Mona Sans comprimida a 85–90), grade fina visível só como guia. As capas dos modos viram **objetos abstratos pré-renderizados no Blender** (um anel de gelo para o Círculo, um trilho de vidro para o Último Bonde, névoa volumétrica para a Neblina), sem cidade, sem época e sem personagem, como stills ou loops de 3–4 s em WebM, com uma linguagem de material comum (vidro, gelo, metal escovado) para parecer uma família. Painéis com leve `backdrop-filter` sobre as capas, transições de página com *crossfade* e *mask*, e um brilho que segue o cursor nos cartões. A sala é uma grade de slots com bordas finas de "vidro" que acendem em ciano quando o jogador fica pronto. Risco: frieza e "site de agência". Por isso os avatares e a cor por modo são obrigatórios. É a mais próxima do gosto declarado do usuário.

**C · "Arena BR" (a energia de Gamers Club, Valorant e The Finals, com freio).** A mais *gamer* e a mais BR: display condensado pesado (Big Shoulders Display, Barlow Condensed 800 ou Saira Condensed) em caixa alta para títulos e números grandes, com Mona Sans no texto. Paleta de fundo preto com um acento saturado forte (vermelho-coral ou magenta) e um secundário ácido para "ao vivo/amigo". **Assinatura gráfica:** canto cortado em 45° (`clip-path`) em botões, cartões e slots, usado com regra fixa (um tamanho de corte só) para não virar cosplay de Valorant. As capas de modo viram **pôsteres gráficos 2D**: duotone, meio-tom, tipografia gigante do nome do modo e formas simples, feitos no Figma, consistentes e baratos de produzir. Home com faixa "AO VIVO" (contador grande ticando), "JOGAR" enorme, grade de lobbies com pilhas de avatares e um *ticker* de "Chegando agora". Na sala, o READY vira o momento-herói: botão gigante, contagem regressiva circular e os slots acendendo em sequência. Também cabe nível ou insígnia leve no cartão do jogador (partidas jogadas), como a Gamers Club. Risco: clichê de "site gamer" e cor demais. Mitigação: uma cor de acento, o corte com regra e muito respiro. É a que mais conversa com o repertório do público 16–30.

**Minha ordem:** **A como esqueleto + a pele de B ou C.** A estrutura de cliente (painel social, cartões, sala em grade) resolve o "site de lobby". A escolha entre B (frio e premium) e C (quente e energético) é de gosto, e o usuário deve decidir **vendo a mesma sala e a mesma home nas duas peles**, não lendo descrições. Recomendo dois *mockups* estáticos das mesmas duas telas antes de qualquer reescrita.

---

## Apêndice · Evidências usadas
- Capturas da v6.1: `scratchpad/shots/v61b/d-fold.png`, `d-full.png`, `v61c/m-fold.png`, `room/d-1-joining.png`, `room2/d-3-ready.png`, `room2/m-2-room.png`, `friends/d-1-in.png` e `friends/d-2-room.png`.
- Telas extras tiradas do build atual: `scratchpad/diag/modos.png`, `modo.png`, `jogar.png` e `novidades.png`.
- Tokens: `web/src/styles/tokens.css` (Bodoni Moda, Mona Sans, Fragment Mono; `--radius: 2px`; sódio e verdete).
- Referências locais: `scratchpad/shots/refs/hyperline-1.png` e `challengermode-1.png`. As descrições de FACEIT, Gamers Club, Riot Client, Discord, Valorant, Marvel Rivals, tracker.gg e Medal vêm de conhecimento de produto, não de capturas desta sessão.
