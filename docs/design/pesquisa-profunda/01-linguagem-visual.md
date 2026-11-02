# 01 - Linguagem visual de plataformas de jogos (2024-2026)

Data da coleta: 2026-11-02. Objetivo: entender o que parece moderno hoje em plataformas, launchers e sites de jogos, porque o usuário chamou nosso site de "arcaico". Esta pesquisa não assume nenhuma regra da direção de arte atual (Bodoni, art déco, âmbar).

Método: capturas reais com Chrome headless (1440x900; 390x844 em alguns), leitura de CSS computado (família, peso, tamanho, raio, cor) e buscas na web. Só páginas públicas, sem login, sem formulário, sem baixar arquivo. Banners de cookie ficaram visíveis nas capturas.

Pasta das capturas: `C:\Users\lagun\AppData\Local\Temp\claude\C--Users-lagun-OneDrive-Documents-Github-Hyperline\a7795b7c-fc37-4f93-8948-691c5d117c03\scratchpad\shots\refs\` (abaixo cito só o nome do arquivo). Scripts: `...\scratchpad\refs-scripts\`.

Limites honestos:
- Bloqueados por desafio do Cloudflare (não contornei, regra de não passar por detecção de bot): FACEIT, Gamers Club, ESEA, tracker.gg, Mobalytics, op.gg, Epic Games Store, u.gg, HLTV, Liquipedia, Stripe, Guilded (página mínima). Para esses, só tenho o que a busca confirma (marcado como "não visto").
- Steam: o que carregou foi a loja web antiga (deslogado). O novo layout da loja/biblioteca só tenho por reportagem.
- Riot Client, Battle.net app, EA app, Xbox app (desktop), Ubisoft Connect app, Outplayed: são apps nativos, não os vi. Uso as páginas de marketing e reportagem.
- Várias "fontes de design" encontradas na busca são blogs de SEO; trato como indicativo, não como prova.

---

## 1. Notas por produto

Legenda das capturas: `-1` = dobra, `-2`/`-3` = após rolar, `-m` = mobile 390x844, `-h` = captura extra.

### 1.1 Concorrente direto e ecossistema Deadlock

**Hyperline (hyperline.gg)** - https://hyperline.gg/ , /mods , /freestyle
Capturas: `hyperline-1`, `hyperline-2`, `hyperline-m-1`, `hyperline-mods-1`, `hyperline-free-1`.
- Tipografia: títulos em Schibsted Grotesk 800, 76px, tracking -0.03em (-2.28px), caixa mista; UI em Inter Variable 14-15px. Palavra de destaque ("Deadlock.") em itálico, na home em script caligráfico vermelho, em /freestyle em itálico do mesmo grotesk. Microcopy técnica em monoespaçada ("Route finish · 5.92 s", "Sign in with Steam · No invite needed").
- Cor: a home é um gradiente de pôr do sol rosa/salmão claro sobre silhueta de skyline, virando bordô escuro (rgb 23,10,17) na lista "Live now". As subpáginas são cinza-carvão neutro (oklch 0.165, zero croma) com UM acento salmão (oklch 0.72 0.17 25). Ou seja, o mesmo site tem duas atmosferas.
- Layout: lista de lobbies em duas colunas de linhas (miniatura 64px, nome "X's lobby", chip de região NA/EU, estado "In game" em laranja, "3/14", botão "Join" contornado). /mods é uma tabela limpa: miniatura, título, descrição de uma linha, jogadores, votos (polegar), botão "Play" contornado. Filtros em abas segmentadas (All / Arena / Movement / Duel / Practice) e busca à esquerda.
- Forma: cantos praticamente retos (raio 0), botão primário em paralelogramo (cantos cortados em diagonal, herdado da logo "H" inclinada), bordas finas em vez de sombras. Etapas 1-2-3 com círculos numerados na home.
- "Ao vivo": título "Live now" + ponto, "33 playing now in 34 lobbies", lista atualizada, estado por linha. Sem avatares de pessoas, só miniaturas de mapa. Sem rank.
- Observação: é o concorrente direto e já saiu da estética de "arte do jogo": usa grotesco pesado + gradiente atmosférico. Nossa tabela densa é parecida com a /mods deles.

**Statlocker (statlocker.gg)** - https://statlocker.gg/ (tracker de Deadlock)
Capturas: `statlocker-1`, `statlocker-2`, `statlocker-h-3`.
- Tipografia: Saira Condensed 700 (botões/destaques), Rajdhani (cartões), Barlow (corpo); títulos em CAIXA ALTA condensada, "NATIVE COMPANION APP." em verde. Numeração de FAQ em mono pequena (02, 03...).
- Cor: fundo quase preto (rgb 10,10,10), acento verde-menta (105,231,153), botão com fundo verde a 15% e borda verde a 35%.
- Imagens: retratos pequenos de heróis em grade de tier (S/A/B), skyline escurecido como fundo.
- Raio 0, cantos retos, sombra rgba(0,0,0,.5) 0 5 15. Pop-up de vídeo ao vivo (streamer "is currently live!") com botão roxo "WATCH".
- Leitura: coerente com o jogo, mas pesado em "gamer clássico" (condensada + verde neon + tudo em caixa alta).

**Blitz (blitz.gg)** - https://blitz.gg/ e /deadlock
Capturas: `blitz-1`, `blitz-h-3`, `blitz-m-1`.
- Tipografia: Inter inteira (peso variável 400-725), título 36px peso 725, caixa mista, sem tracking agressivo.
- Cor: fundo rgb 14,16,21, cartões rgb 21,24,30, CTA rosa-choque/vermelho saturado, chips âmbar a 15%.
- Layout: barra superior de jogos como abas com ícone (League, TFT, Valorant, CS2, Deadlock, Fortnite, Tarkov, Apex, Rivals), busca larga com atalho "Ctrl K", grade de capas verticais (arte do jogo, raio ~16px, sombra difusa 0 4 34 rgba(7,9,14,.75)), cartões de notícia 16:10, cabeçalhos de seção "Latest News" + subtítulo discreto + "View All". Mobile: duas colunas de capas.
- Leitura: padrão "app de stats" 2025: neutro, Inter, cartões de 16px, UM CTA quente. Muito limpo, pouca personalidade.

**Deadlock Wiki** - https://deadlock.wiki/ - captura `deadlockwiki-1`. Usa as fontes da Valve (não usar), marrom-sépia, layout de MediaWiki com blocos 3x2 de ícones. Referência negativa de "arcaico" e de fontes proibidas para nós.

**Steam (loja de Deadlock)** - `deadlocksteam-1`: Motiva Sans, azul-petróleo escuro, estética Steam clássica.

**dak.gg** - https://dak.gg/ - `dakgg-1`. Fundo preto, Inter, grade de capas com cantos 6-8px, cartão de gradiente laranja para "criar seu cartão". Mostra que "card de jogador compartilhável" virou recurso padrão.

### 1.2 Plataformas competitivas e de torneio

**Challengermode** - https://www.challengermode.com/ - `challengermode-1`, `challengermode-2`, `challengermode-m-1`.
- Poppins 700 nos títulos (48px, caixa mista, sem tracking), Inter no corpo. Fundo azul-ardósia (rgb 23,28,38) com brilho laranja/teal nas bordas.
- O herói é a própria interface do produto numa moldura inclinada em perspectiva (barra lateral de ícones de jogos, cartões de arte), com um telefone ao lado. Barra de logos de parceiros. Botões pílula/raio médio, CTA ciano.
- Leitura: "mostre o produto real no herói", bom; o resto é corporativo B2B.

**start.gg** - https://www.start.gg/ - `startgg-1`, `startgg-m-1`.
- Roboto, Material Design clássico, trilho lateral de 56px com ícones, cartões brancos com miniatura 16:9, sombras Material, chips verdes "Registration Open". Cabeçalho azul-marinho com logotipo em pixel.
- Leitura: funcional, comunitário, mas visualmente de 2018 (Material 1). Exemplo de "datado".

**Blast.tv** - https://blast.tv/ - `blast-1`. TT Norms Pro, fundo vinho-escuro (31,12,25), cartões por jogo com arte + lista compacta de eventos (data à direita, "LIVE" em vermelho pequeno), CTA amarelo. Densidade alta em listas simples.

**PGL** - https://www.pglesports.com/ - `pgl-1`. Mark Pro Black em caixa alta 56px, tracking -2.2px (-0.04em), bloco vermelho com corte diagonal sobre foto de arena, seções brancas com padrão de raios. Esporte tradicional, impacto alto, contraste duro.

**LoL Esports (Riot)** - https://lolesports.com/ - `lolesports-1`. Três colunas: esquerda (temporadas, item ativo com gradiente ciano), centro (feed por dia com cartões de partida: hora, logos de times como avatares, "Bo5"), direita (ranking com logos, notícias). Inter, raio ~8px, preto-azulado. Melhor referência de "feed de eventos ao vivo" em plataforma Riot.

**Não vistos (Cloudflare):** FACEIT (usa a fonte Play nos materiais corporativos; "FACEIT 2.0" reconstruiu a interface web/desktop em React com barra lateral, fim de 2024, recepção mista segundo relatos), Gamers Club, ESEA, HLTV, Liquipedia.

### 1.3 Launchers, lojas e clientes

**Battle.net / Blizzard** - https://www.blizzard.com/ - `battlenet-1`, `battlenet-2`. Poppins 600 48px, navy (19,25,40), grade de 5 pôsteres verticais com título 18-20px, gênero em caixa alta pequena (12px) e ícone de plataforma. Cards "capa" com raio ~8px.

**Steam** - `steam-1`. Loja antiga web: Motiva Sans, azul-petróleo, carrossel de destaque com arte 16:9 + capturas + preço em bloco verde. A reportagem de abril/2026 (Notebookcheck) fala de novo layout mais largo, arte de maior resolução, rolagem infinita estilo feed, microtrailers que podem ser desligados; a nova biblioteca usa "prateleiras" (shelves) customizáveis. Não vi a UI em si.

**Epic, EA app, Ubisoft Connect, Xbox app:** Epic bloqueada (fonte Brutal, fundo 16,16,20 conforme a tela de desafio). Ubisoft Connect (`ubisoft2-1`): preto com névoa roxa/magenta desfocada, "Ubisoft Sans" geométrica, títulos grandes mistos peso 700 + fino. Xbox app mobile (`xbox2-1`): branco, Segoe UI, mockups de tela embaçados ao fundo; é página institucional clara, nada de "gamer".

**Riot (empresa)** - `riot-1`. Inter V Latin 700/800, tracking -0.03em; herói com recorte de personagens (cutout) sobre gradiente, botão laranja pílula com ícone circular preto. Banners de cookie enormes. **Valorant** (`valorant-1`): Tungsten condensada caixa alta, botão rosa-coral retangular com borda dupla, banner em vídeo/arte full-bleed. **2XKO** (`2xko-1`): Shapiro 75 Heavy Extended, logo verde-limão contornado de preto, botão preto com cantos diagonais. Navbar 80px preta com links em caixa alta 13px, tracking leve.

### 1.4 Apps sociais e de captura

**Discord** - https://discord.com/ - `discord-1`, `discord-2`, `discord-m-1`.
- ABC Ginto Nord 700, CAIXA ALTA, 56px, tracking -0.01em, entrelinha ~0.9 (linhas quase se encostando); corpo em gg sans. Fundo azul-índigo saturado (26,32,129) com estrelinhas, ilustrações 3D "toy" (robô, personagens) em vez de captura de jogo.
- Botões: raio 14-16px, branco sólido + roxo-azulado (blurple) sólido. Seções como grandes "ilhas" arredondadas (raio ~60px) com vidro translúcido sobre gradiente (`discord-2`).
- Mostra o produto (app escuro em monitor e telefone) mais mascotes e emojis. Humor e cor, zero realismo.

**Medal.tv** - https://medal.tv/ - `medal-1`, `medal-m-1`. Fundo preto puro, Funnel Display 500 (48px) + Inter, UM acento lima (#b8ff2c aprox.), botão retangular lima com texto preto, três números gigantes ("5,4 bilhões de clipes"). Minimalismo "preto + lima". 

**Overwolf** - https://www.overwolf.com/ - `overwolf-1`. Montserrat 700, preto, porta 3D com texto de código em volta (arte rendida), botão contorno retangular. Corporativo-dev.

**Porofessor.gg** - `porofessor-1`. Open Sans, fundo cinza-claro, banner ilustrado de mascote, botões azuis de região, tipografia de giz no cabeçalho. Exemplo claro de datado (layout de 2015, tudo centralizado em caixa branca).

**Twitch** - https://www.twitch.tv/ - `twitch-1`. Referência canônica de "ao vivo": barra lateral esquerda com avatares redondos, pontinho vermelho e contagem de espectadores ("8.7K"), miniaturas com selo "LIVE" vermelho + "553 viewers" sobre a imagem, avatar do streamer + título + jogo + chips de tag (raio de pílula pequena). Aplicável quase 1:1 a lobbies.

**Não vistos:** Guilded (praticamente morto/limitado), tracker.gg, op.gg, Mobalytics, Outplayed (página não rendeu útil).

### 1.5 Sites de jogos recentes

| Jogo | Fonte de título | Cor/atmosfera | Imagem | Capturas |
|---|---|---|---|---|
| Marvel Rivals (marvelrivals.com) | Refrigerator Deluxe (condensada pesada), itálico inclinado em nav | Laranja de fogo + amarelo, botão amarelo com cantos diagonais | Arte de cena full-bleed, logo em recorte | `marvelrivals-1/2`, `-m-1` |
| The Finals (reachthefinals.com) | Saira 850 caixa alta + condensada vertical gigante ("THE FINALS" girado 90 graus) | Vermelho chapado + preto + branco, "mid-century" duro | Personagem recortado grande, vídeo em caixa | `thefinals-1/2`, `-m-1` |
| ARC Raiders (arcraiders.com) | Barlow 700 caixa alta 96px, tracking -0.027em | Bege-areia (236,226,208) + listras arco-íris retrô, botão âmbar | Fotografia/render sujo, máscara, selos de prêmio (DICE/BAFTA) | `arcraiders-1/2` |
| Overwatch (overwatch.blizzard.com) | Big Noodle Too itálico caixa alta; UI em "Config" | Barra de navegação "pílula" flutuante clara com cantos 8px, CTA laranja | Time de personagens em pose, cena clara | `overwatch-1/2` |
| Splitgate (splitgate.com) | TT Supermolot, logotipo extended | Fundo claro azul-gelo + azul-marinho, linhas de circuito, botão azul com corte diagonal | Personagem 3D recortado com sombra projetada | `splitgate-1/2` |
| Valorant / 2XKO | ver 1.3 | | | |
| Apex | não carregou (erro HTTP2) | | | |

**Deadlock oficial**: a loja Steam foi o único canal capturado (`deadlocksteam-1`). Não vi site oficial próprio.

### 1.6 Referências "de craft" fora de jogos

- **Linear** - https://linear.app/ - `linear-1`, `linear-m-1`. Inter Variable peso 510 a 64px, tracking -0.022em, fundo #08090a, hierarquia por opacidade de cinza, captura real do produto cortada na base com borda fina arredondada e brilho interno sutil. Raio 8-12px. Praticamente nenhum gradiente colorido.
- **Vercel** - https://vercel.com/ - `vercel-1`. Geist 400, 64px, tracking -0.06em, fundo #fafafa claro, botão pílula preto + pílula branca com borda fina, logos de clientes em linha. Claro, tipográfico, silêncio visual.
- **Raycast** - https://www.raycast.com/ - `raycast-1`. Inter 600, fundo #07080a, faixas diagonais vermelhas com granulação (grain gradient), barra de navegação em cápsula com borda fina, nota técnica em mono. É a referência de "atmosfera sem arte de personagem".
- **Figma Config** - https://config.figma.com/ - `config-1`. Fundo branco, tipografia grande leve (figmaSans 300) + figmaMono em caixa alta 16px para rótulos, logotipo customizado em blocos, foto real de multidão borrada em movimento. Grade tipográfica de duas colunas.
- **Arc** (`arc-1/2`): o navegador será descontinuado em 22/12/2026 (texto do próprio site), serve só como lembrete: o estilo "editorial serifado" caiu junto.

---

## 2. Tendências 2024-2026 em plataformas de jogos

Cada item traz evidência (produto) e o que significa para nós.

1. **Sans grotesco pesado em caixa mista, tracking apertado, em vez de serifa ou display "gamer".** Hyperline (Schibsted Grotesk 800, -0.03em), Linear (Inter 510, -0.022em), Blitz (Inter 725), Medal (Funnel Display 500), Challengermode (Poppins 700), Riot (Inter 700-800, -0.03em), Vercel (Geist, -0.06em). Quase ninguém em plataforma/stats usa serifa. Corpo em 14-16px, hierarquia por cor/opacidade mais que por peso.
2. **Condensada ou extended em CAIXA ALTA só onde há "broadcast/combat"**: Marvel Rivals, The Finals (girada 90 graus), PGL, Valorant (Tungsten), Statlocker, Arc Raiders (Barlow). Funciona em jogo e evento; em ferramenta/plataforma o movimento é afastar-se disso (Blitz, Medal, Hyperline).
3. **Produto real no herói (captura/mock da interface), não só arte de personagem.** Challengermode (UI em perspectiva), Linear (captura cortada), Discord (app em monitor + telefone), Hyperline (vídeo gameplay com HUD), Statlocker (tela de vitória). "Mostrar o app funcionando" é o hero de 2025.
4. **Cartões com raio 12-20px, sem borda grossa, fundo 1 passo acima da página.** Blitz (16px, rgb 21,24,30 sobre 14,16,21, sombra grande e suave), Discord (14-16px botões; ilhas de 60px), Medal/Linear (8-12px). Contraste entre superfície e página é de poucos pontos de luminosidade.
5. **Capas verticais (pôster 3:4 / 2:3) para escolher jogo/modo.** Blitz, Battle.net, dak.gg. Para nós, cada MODO é um "jogo" e merece capa.
6. **Avatares e presença em todo lugar.** Twitch (avatar + ponto vermelho + contagem), LoL Esports (logos de times como avatares), Blitz (ícone por jogo), Statlocker (retratos em grade). Pessoas, não linhas de texto.
7. **"Ao vivo" é um sistema de 3 elementos**: ponto/selo pulsante (Twitch "LIVE" vermelho), contagem ("8.7K", "33 playing now"), e movimento (miniatura animada, lista que atualiza). Hyperline tem só o texto "Live now"; Twitch tem o selo sobre a imagem.
8. **Um único acento saturado sobre neutro quase preto**: Medal (lima), Blitz (rosa-choque), Hyperline /freestyle (salmão), Statlocker (menta), Linear (nenhum). Nada de 3-4 cores competindo. Preto não é #000 puro na maioria: 8-15% de luminosidade, levemente azulado ou quente.
9. **Atmosfera por gradiente/granulação/blur em vez de arte**: Raycast (faixas com grain), Ubisoft Connect (névoa roxa), Hyperline home (pôr do sol sobre silhueta), Discord (estrelas + vidro). Barato de produzir, sem IP, forte.
10. **Cantos cortados em diagonal e itálico como marca de energia, em dose pequena**: Hyperline (botão e logo), Splitgate, 2XKO, Marvel Rivals (botões em paralelogramo). Só no CTA/logo, não no layout inteiro.
11. **Ilustração/3D "toy" e mascotes para tom amigável**: Discord, Medal, Supercell. Para comunidade BR/LatAm de modos custom (jogo casual entre amigos), tom caloroso encaixa melhor que tom "militar".
12. **Mono para dados e microcopy**: Hyperline ("Route finish · 5.92 s"), Config (figmaMono em caixa alta), Statlocker (numeração mono). Números tabulares, placares, tempos e códigos em monoespaçada pequena dão ar de ferramenta.
13. **Numerais grandes como elemento gráfico**: Medal (5.428.668.935), Blitz (240M+, 3B+), Blast (datas à direita). Cabe a "34 lobbies agora".
14. **Navegação em cápsula flutuante / barra fina com abas de ícone e busca com atalho**: Raycast, Overwatch, Blitz (Ctrl K). Para app, comando de teclado é sinal de modernidade.
15. **Lista densa com linha de 56-72px e ação à direita ainda funciona**, mas feita de "linhas-cartão" limpas (Hyperline /mods, Blast, LoL Esports) e não de tabela de planilha. Densidade alta ok quando há avatar + tipografia clara.
16. **Rolagem contínua e conteúdo "feed" em lojas** (Steam 2026 beta: rolagem infinita, arte maior, prateleiras). Sites estão ficando mais largos e mais "estante", menos "página com seções".
17. **Dark é padrão, mas claro volta como contraste**: Vercel, Config, Xbox (institucional), Overwatch (nav clara), Splitgate (fundo claro), Hyperline home. Em 2026 fundo claro num produto de jogo é escolha de diferenciação, não erro.
18. **Foco em acessibilidade de contraste na dark** (as análises de tendência alertam para texto fino claro sobre preto); preferem corpo 15-16px peso 400-500 com cinza ~#a0a4ad, não #666.

---

## 3. O que parece datado / arcaico em 2026

Com exemplos, porque o usuário rejeitou nosso site justamente por isso.

1. **Serifa de alto contraste (Bodoni, didone) como display em plataforma de jogo.** Nenhum produto da amostra faz isso; a rara serifa (site do navegador Arc com "Exposure", script do Hyperline) vem como acento de UMA palavra. Para público de jogo BR, lê-se "revista/hotel de luxo", não "jogar agora".
2. **Art déco / arquitetura tombada / vídeo de torre em "banda cinematográfica"** como moldura da home. Raro hoje; o equivalente moderno é produto real ou gradiente atmosférico.
3. **Tabela fria de planilha (colunas, cabeçalho, linhas finas) como peça principal.** Porofessor, start.gg, wikis. A versão moderna é linha-cartão com avatar, chip, estado e botão. Nossa tabela densa + rail direito lembra a /mods do Hyperline, que já é de nível básico.
4. **Tudo em caixa alta com tracking largo (letter-spacing 0.1-0.3em) em rótulos pequenos** em excesso: Overwatch/Splitgate "LESS LOOTING MORE SHOOTING", rótulos "FEATURED EVENTS" (start.gg). Em doses mínimas passa; como sistema, é 2016.
5. **Material Design 1 / sombras Roboto, trilho lateral de ícones sem rótulo** (start.gg).
6. **Banners de cookie gigantes, barras de navegação de 80px com 8 links** (Riot, Ubisoft). Cansativo, pesado.
7. **Caixa branca central sobre fundo cinza com banner ilustrado** (Porofessor). Layout de 2014.
8. **Neon ciano/verde + condensada + cantos chanfrados em TUDO** (Statlocker, esports 2018-2021): "gamer-RGB". Aceitável como detalhe, datado como sistema.
9. **Carrossel de destaque com setas e bolinhas** (Steam web, Twitch hero 3D em perspectiva). Setas laterais e dots são do início dos anos 2010.
10. **Tema escuro com 3+ cores de acento (amarelo, ciano, magenta, verde)** sem hierarquia. Hoje é 1 acento.
11. **Muitas bordas finas + cantos retos 0px em tudo** (Hyperline mods, Statlocker): lê-se "wireframe". Moderno é raio 12-16px + superfície com leve elevação.
12. **Texto longo em cinza médio sobre preto com peso 300** (dificulta leitura, alerta de acessibilidade).
13. **Fundo 100% preto com serifa fina e "luxo" sem produto**: não comunica nada sobre lobbies.
14. **Linhas de hero muito centralizadas com título + subtítulo + CTA, sem produto, sem pessoas** (fórmula "SaaS 2019" de Overwolf/Medal-lite). Funciona só se o título for muito bom.

Resumo do que nossa versão atual aciona: itens 1, 2, 3, 13 e parcialmente 11. Pior: a "primeira dobra" não mostra o que o usuário ganha (um clique, está no lobby, com amigos).

---

## 4. Direções visuais possíveis

Todas: gratuitas/open source (Google Fonts/Fontsource), SEM fontes, logos, arte, nomes próprios ou captura de tela da Valve/Deadlock. Imagens são geradas/ilustradas por nós. O produto vende "entrar num lobby em um clique" e "ver amigos".

Regra de imagem comum (IP): capas de modos = glifo/ícone próprio sobre gradiente, não print do jogo. Avatares vêm do Steam do usuário (o dado já é dele). Se um dia quisermos print de gameplay, é decisão jurídica à parte (Hyperline e Blitz fazem, nós não precisamos).

### Direção A - "Feed ao vivo" (neutro, produto primeiro)
Refs: Linear, Blitz, Twitch, LoL Esports, Medal, dak.gg.
- Tipografia: Geist (OFL) ou Inter Variable, títulos 600-700, caixa mista, tracking -0.02 a -0.03em; números em Geist Mono / JetBrains Mono (tabular).
- Paleta: fundo #0B0C10-#0F1117, superfície #151821 / #1B1F2A, texto #EAECEF e #9BA1AE; UM acento (sugestão: lima #C6FF3D como Medal, OU coral #FF5A4E); verde só para "ao vivo", âmbar só para "quase cheio".
- Imagem: capas de modo 3:4 geradas (glifo vetorial grande sobre gradiente com granulação); avatar do Steam redondo em toda parte; zero ilustração de jogo.
- Componentes: cartão de lobby 16px de raio com capa à esquerda, nome do host + avatar, chips (região, modo), pilha de avatares dos presentes ("3/14"), ponto "ao vivo" pulsante, botão "Entrar" preenchido. Barra de busca com Ctrl K. Trilho esquerdo de amigos com avatar + estado ("no lobby X"). Hero = captura real do app/lista, cortada na base como Linear.
- Densidade: média-alta (cartões de ~72px em lista de duas colunas, ou grade de 3-4). É o caminho mais seguro e mais próximo do que o usuário "espera de plataforma moderna".
- Risco: parecer genérico (Blitz). Mitigar com acento, motion e capas próprias.

### Direção B - "Brincadeira com amigos" (Discord/Supercell: colorido, arredondado, 3D toy)
Refs: Discord, Riot (botão pílula laranja), Supercell, Medal (tom), Overwatch (nav flutuante).
- Tipografia: Bricolage Grotesque 800 ou Unbounded 700 (display), caixa alta nos grandes títulos curtos como Discord, tracking -0.01em, entrelinha ~0.92; corpo em Onest ou Manrope 15-16px.
- Paleta: fundo índigo escuro #12123A-#1A2081 com camadas, acentos saturados em blocos (violeta #6C5CFF, rosa #FF4FA3, lima #B6FF3B); cartões podem ser de cor chapada, não só cinza.
- Imagem: mascote e adesivos originais (3D "toy" renderizado no Blender: controles, escudos, faíscas, personagens genéricos abstratos), emojis/reações de lobby, formas arredondadas flutuando. Nada de skyline.
- Componentes: "ilhas" de seção com raio 28-48px, botões pílula 14-16px de raio com sombra interna, avatares com anel de status, emoji reactions no lobby, confete ao entrar. Raio generoso em tudo.
- Densidade: baixa-média, mais ar, tipografia grande; o navegador de lobbies ainda precisa de uma lista compacta para o usuário "power".
- Risco: infantil demais para quem joga ranqueado; é bom para público "casual BR", mas exige ilustração de qualidade (se barato, vira "cheap 3D" que o usuário já reprovou, ver memória de gosto do projeto). Só vale se houver renders bem feitos.

### Direção C - "Transmissão de arena" (broadcast esports)
Refs: PGL, Blast, Marvel Rivals, The Finals, Statlocker, LoL Esports.
- Tipografia: Barlow Condensed ou Big Shoulders Display 800-900 em CAIXA ALTA para títulos e placares (tracking -0.01em); Archivo (variável com largura) ou Barlow para UI; números tabulares em Rajdhani/Space Mono. Itálico oblíquo no CTA.
- Paleta: preto azulado #0A0B10, branco puro, UM bloco de cor de alto contraste (vermelho #FF2D3D OU amarelo #FFD400), faixas diagonais. Contraste duro, pouco gradiente.
- Imagem: padrões geométricos (raios, faixas, halftone) gerados; tipografia gigante cortada, girada 90 graus como The Finals; fotos/ilustrações de jogadores reais da comunidade BR (com permissão) em vez de personagens.
- Componentes: cartões com um canto cortado em diagonal, "scorebug" (barra inferior com hora, lobbies, jogadores online), selo "AO VIVO" vermelho, linhas de lobby em estilo placar, contador regressivo. CTA em paralelogramo.
- Densidade: alta, bom para plataforma de "partidas ao vivo". Alta energia.
- Risco: cai em "gamer 2018" se exagerar nos chanfros/caixa alta (item 4 e 8 da seção 3); funciona se contido a título, selo e CTA e o resto (cartões) for limpo.

### Direção D - "Utilitário editorial claro" (contrarian)
Refs: Vercel, Figma Config, Hyperline home (gradiente rosa), Raycast (grain), Xbox app (institucional claro).
- Tipografia: Schibsted Grotesk 800 (ou Instrument Sans / Geist) em títulos enormes (72-96px, tracking -0.04 a -0.06em), uma palavra em itálico/Instrument Serif Italic como acento; rótulos em Geist Mono caixa alta 11-12px.
- Paleta: canvas claro #F5F4F0 / #FAFAFA, tinta #14130F, cartões brancos com borda 1px #E6E3DC e sombra suave; acento único (laranja-vermelho #FF4A1C OU azul-cobalto #2B4BFF); trechos escuros (#0E0E10) para a lista ao vivo, como Hyperline alterna claro/escuro.
- Imagem: campos de gradiente granulado (rosa-pêssego a laranja, estilo Raycast/Hyperline) como "céu"; tipografia como imagem; fotos reais de pessoas jogando (stock próprio/da comunidade).
- Componentes: botões pílula (preto/branco), cartões brancos com avatar e chips, linha ao vivo com ponto verde, tabela clara com numerais mono. Muito espaço em branco.
- Densidade: média; o app (Windows) pode ser escuro e o site claro, como Xbox/Discord alternam.
- Risco: foge totalmente do "gamer", o que diferencia, mas pode parecer SaaS e não "lugar para jogar". Hyperline já usa um gradiente claro na home, então precisa de assinatura própria (tipografia e cor) para não parecer cópia.

### Comparativo rápido

| | A Feed | B Brincadeira | C Arena | D Editorial claro |
|---|---|---|---|---|
| Energia | média | alta, amigável | muito alta | baixa-média, sofisticada |
| Custo de imagem | baixo | alto (3D/ilustração) | médio | baixo |
| Risco "genérico" | alto | baixo | médio | médio |
| Risco "datado" | baixo | baixo | médio-alto | baixo |
| Encaixe com lobbies/amigos/presença | excelente | bom | bom | bom |
| Diferenciação do concorrente | média | alta | média | alta |

Recomendação de estudo: começar por A como base de componentes (ela resolve lista, amigos, sala), e testar como "pele" B (cor + mascote) ou D (claro editorial) antes de decidir; C só em detalhes (selo AO VIVO, scorebug). Combinação promissora: A + acento do hero em D (gradiente granulado + título grande tight), pois entrega "moderno" sem custo de 3D.

---

## 5. Valores concretos para reutilizar (medidos)

- Título de herói: 56-96px, peso 700-850, tracking -0.02 a -0.06em, entrelinha 0.92-1.05 (Linear, Vercel, Hyperline, Arc Raiders, Discord).
- Corpo: 14-16px, 400-500; legenda 12-13px em cinza #9BA1AE.
- Raio: botões 8-16px (Blitz 8px chips, Discord 14-16px), cartões 12-16px, "ilhas" 28-60px (Discord).
- Superfície: página L 8-15%, cartão +3 a +6 pontos de luminosidade, sem borda ou borda 1px de baixa opacidade, sombra grande e suave (0 4 34 rgba(7,9,14,.75)).
- Chips de status: 15% de opacidade da cor + texto na cor cheia (Blitz âmbar, Statlocker verde 15%/borda 35%).
- Navegação: barra 56-64px; abas com ícone por jogo; busca com atalho.
- Mobile: empilha para 1 coluna de linhas (Hyperline) ou 2 colunas de capas (Blitz); CTA fixo "Sign in"/"Download" no topo direito.

## 6. Capturas que considero as melhores referências

Vistas e boas: `hyperline-free-1`, `hyperline-mods-1`, `hyperline-1`, `hyperline-m-1`, `blitz-1`, `blitz-h-3`, `blitz-m-1`, `twitch-1`, `lolesports-1`, `discord-1`, `discord-2`, `medal-1`, `challengermode-1`, `linear-1`, `raycast-1`, `config-1`, `vercel-1`, `marvelrivals-1`, `thefinals-1`, `arcraiders-1`, `statlocker-1`, `blast-1`, `pgl-1`, `dakgg-1`.
Como exemplos de datado: `porofessor-1`, `startgg-1`, `deadlockwiki-1`.

## Avisos

Nenhuma das páginas visitadas continha texto dirigido a uma IA ou pedindo ação; nada foi seguido. Apenas desafios do Cloudflare ("Just a moment...") e erros 403/HTTP2 em alguns sites, que não foram contornados. Alguns resultados de busca eram blogs genéricos de SEO e foram descartados ou marcados como indicativos.

## Fontes de busca usadas (indicativas)

- FACEIT, interface nova: https://blog.faceit.com/the-new-faceit-ui-41071a18fbc8 (403 ao abrir; só o resumo da busca) e cobertura em dust2.us / hotspawn.
- FACEIT, marca (fonte Play): https://corporate.faceit.com/branding
- Steam, home beta 2026: https://www.notebookcheck.net/Beta-Here-s-what-the-new-Steam-homepage-looks-like.1265754.0.html
- Discord, fontes (informação conflitante entre blogs; confirmo só pelo CSS: ABC Ginto Nord + gg sans).
- Tendências gerais de web design 2026 (dark mode padrão, tipografia ousada, bento, glass): agregados de Hostinger, Clay, Figma resource library e outros; tratados como direção, não como prova.
