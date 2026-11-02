# Diagnóstico de assinatura: por que a Torre ainda não dá "uau"

*03/11/2026. Diretor de arte, leitura crítica da home v4 ("A Torre"). Pedido do usuário, em resumo: "Parece bem feito, mas não parece MUITO bem feito. Não tem tantos detalhes quanto o igloo.inc. Não tem o momento do prédio se montando. Acho que ainda faltam toques de Deadlock. Parece um site normal sobre um prédio; não tem *aquele estilo*." Nenhum código foi alterado.*

**Método.**
- Abri a home em `localhost:5173/?tier=high` a 1440×900, com `window.__torreSettle = true`, e capturei as 6 cenas e a abertura (3 quadros durante o carregamento).
- Li `web/README.md` (Home v4), `docs/design/brief-v4.md`, `docs/design/pesquisa-direcao-arte.md` e `web/src/three/world.ts` (1.084 linhas), mais `TowerSketch.tsx`, `Decode.tsx` e `lib/sound.ts`.
- Reabri o igloo.inc e o playdeadlock.com no navegador, a 1440×900, e dei zoom nos blocos do iglu.
- Pesquisei na web: estudo de caso do Awwwards, deadlock.wiki, Wikipedia, Destructoid, o artigo de renderização ilustrativa da Valve (TF2), referências de construção dos anos 1930 e técnicas de shader pintado.

**Limites.**
- A rolagem virtual do igloo.inc avançou pouco com a roda do mouse (o mesmo problema da pesquisa anterior). Aqui descrevo o que vi na cena de abertura, que é justamente onde está o "momento de montagem", e completo o resto com o estudo de caso e com `pesquisa-direcao-arte.md`.
- Não achei palestra técnica da Abeto sobre o iglu explodido. O estudo de caso não descreve essa parte.
- Alguns fatos do Deadlock vêm da wiki da comunidade e de memória de jogador. Estão marcados como "(confirmar no jogo)".

---

## A. Em uma frase: o que o usuário está sentindo

**A Torre é uma maquete bem iluminada, não um lugar com alma: ela tem a ideia certa (prédio = dado vivo), mas a forma é genérica (caixas com grade de janelas), a luz é de render de arquitetura, nada nela se monta, se mexe ou é sobrenatural, e por isso ela lê como "hotel art déco à noite" e não como "um pedaço da cidade amaldiçoada onde a gente joga".**

Dito de outro jeito: **falta assinatura**. Temos o *método* do igloo (objeto único, câmera na rolagem, HUD em mono). Não temos o *ofício* dele (densidade de detalhe, estados com coreografia, transições com efeito, som) nem o *mundo* do Deadlock (oculto, pintado, estranho, vivo).

---

## B. Vocabulário: 12 nomes para o que está faltando

Use estes nomes para pedir as coisas. Cada um tem uma referência para olhar.

| # | Conceito | O que é, em uma linha | Onde ver |
|---|---|---|---|
| 1 | **Densidade de detalhe (3 escalas)** | Um objeto "caro" tem detalhe em três escalas: silhueta (de longe), forma média (cornija, pilastra, gárgula) e micro (chanfro, risco, lasca, sujeira). A Torre só tem a primeira | Blocos do igloo.inc: cada bloco tem aresta lascada, ruído na superfície e brilho no fio da aresta (https://www.igloo.inc/); conceito de *greeble*: https://en.wikipedia.org/wiki/Greeble |
| 2 | **Silhueta-assinatura** | Uma forma que você reconhece só pela sombra. Nossa torre é um bolo de caixas com uma agulha. A do Chrysler tem sete arcos escalonados em raios de sol e janelas triangulares | Chrysler Building, coroa e agulha: https://en.wikipedia.org/wiki/Chrysler_Building ; a Valve trata silhueta legível como regra de estilo: https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf |
| 3 | **Momento-assinatura (set piece)** | Os 3 a 5 segundos que a pessoa conta para o amigo. No igloo, é o iglu respirando, com os blocos se abrindo e a luz vazando. Hoje a nossa abertura é um desenho 2D em fio que acende atrás do título | Abertura do igloo.inc (o iglu já começa "explodido" e se fecha) |
| 4 | **Vista explodida com estados** | O objeto tem estados (montado, explodido, por dentro), e cada peça se move com rotação, atraso e luz próprios, e não só "sobe um pouco" | igloo.inc (blocos com números `27`, `48` e mira `+` ligados por fios); desenho técnico: https://en.wikipedia.org/wiki/Exploded-view_drawing |
| 5 | **Renderização ilustrativa (luz quente e fria + contorno de luz)** | O jeito Valve de iluminar: o sombreado mistura uma cor quente e uma fria em vez de escurecer para o preto, e um contorno de luz (*rim light*) separa a forma do fundo. A nossa luz é PBR "correta", o que dá cara de render de arquitetura | *Illustrative Rendering in Team Fortress 2* (Mitchell, Francke e Eng, Valve, 2007): https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf e slides: https://cdn.fastly.steamstatic.com/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2_Slides.pdf |
| 6 | **Acabamento pintado (painterly)** | A imagem parece pintada (pincelada, borda que respeita a forma, papel). É o que separa "3D de site" de "arte de jogo" | Maxime Heckel, *On Crafting Painterly Shaders*: https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders ; Susurrus (Codrops, 2026), com o filtro Kuwahara como único pós-processamento: https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/ |
| 7 | **Camada sobrenatural** | O que torna a cidade *amaldiçoada*: rituais, chamas de cor errada, sigilos, almas em forma de luz, fumaça que se comporta como viva. Hoje o oculto só aparece nas linhas das cartas do cofre | Deadlock: Nova York alternativa, anos após um cataclismo que trouxe o sobrenatural (https://en.wikipedia.org/wiki/Deadlock_(video_game)); padroeiros com chifres e efígie em chamas (https://deadlock.wiki/The_Hidden_King) |
| 8 | **Vida ambiente** | O mundo se mexe sozinho mesmo sem você rolar: vapor, trem, pássaros, faróis no céu, chuva, raio, gente. É o que faz parecer *lugar* e não *maquete* | igloo.inc (neve soprando, vento, `wind.ogg`); mapa do Deadlock com marquises, caminhão, tirolesa (https://www.playdeadlock.com/cityneversleeps) |
| 9 | **Roteiro de cor (dualidade)** | Duas temperaturas em conflito, com significado. Deadlock nasce de dois lados (um padroeiro âmbar e um padroeiro de chama azul). A Torre é monocromática âmbar, com o verdete contado | deadlock.wiki: a Hidden King foi "The Amber Hand" antes da atualização *Old Gods, New Blood* (https://deadlock.wiki/The_Hidden_King) |
| 10 | **Transição com efeito** | A troca de cena é um efeito desenhado (deslocamento, geada, aberração cromática, pixel esticado), não só a câmera andando na névoa | Estudo de caso do igloo (cita "chromatic aberration, tech displacement, frost"): https://www.awwwards.com/igloo-inc-case-study.html ; vi o deslocamento com pixels esticados ao rolar do iglu |
| 11 | **Juice (suco)** | Cada evento importante ganha partícula, som, leve tremor e escala. Na web, só no momento de recompensa | *Juice it or lose it* (GDC 2012): https://gdcvault.com/play/1016487/ |
| 12 | **Moldura e ornamento com voz** | Os painéis de texto têm a linguagem do mundo (papel, latão rebitado, carimbo, canto chanfrado), não "card escuro com borda fina". O site do Deadlock usa cartão-postal, papel rasgado e placa de metrô; nós precisamos da nossa versão | playdeadlock.com (letreiro de cartão-postal recheado de ilustração, bordas de papel rasgado, linha tracejada de rota) |

---

## C. Diagnóstico, por impacto

Notas: **Impacto** = quanto pesa na sensação de "não é tão bem feito" (5 = máximo). Evidência = o que vi ou li.

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| 1 | **A silhueta é genérica: lê como prédio de escritório ou hotel** | Em `world.ts`, tudo é `unitBox` escalado: corpo, faixa, ressalto, friso, pilar, tira. A coroa são 2 caixas, um cone de 4 lados e 9 varetas de latão. Janelas em grade uniforme de 12 por andar, iguais em todos os andares. No hero (cena 1), a torre fica num terço da tela, sem coroa marcante e com o poste de luz cortando a fachada | 5 |
| 2 | **Não existe o "prédio se montando"** | A abertura é um SVG de retângulos em fio (`TowerSketch.tsx`) atrás do título já visível; vai de 55% a 100% em cerca de 1 a 2 s. Quando o 3D chega, a torre já está inteira e só as janelas acendem. A "explosão" da cena 2 é `y += f * explode * 0.9`, com giro de no máximo ±0,08 rad: os andares sobem juntos, quase como fatias de pão | 5 |
| 3 | **Falta a camada oculta, o "toque Deadlock"** | Nenhuma magia na torre: sem ritual, sem chama, sem sigilo, sem alma, sem fumaça viva. O oculto mora só nas cartas do cofre (desenhos em linha). Obsidiana com latão sozinhos dão "luxo déco" (Gatsby, hotel), não "Nova York amaldiçoada" | 5 |
| 4 | **Luz de render de arquitetura, não de jogo da Valve** | `HemisphereLight` + lua direcional + `MeshStandardMaterial` liso. Sem *rim light*, sem rampa quente e fria, sem luz de contorno na silhueta. O céu é um gradiente liso. Resultado: a torre fica "um bloco escuro com janelinhas" | 4 |
| 5 | **Sem micro-detalhe nos materiais** | Obsidiana `#06080b` com rugosidade única; latão `#b98d48` uniforme, sem riscos, sem pátina e sem desgaste. Arestas a 90° perfeitos, sem chanfro, então nada pega brilho de aresta. Compare com o zoom no igloo: lasca, ruído e um filete de luz em cada bloco | 4 |
| 6 | **O mundo está parado (maquete, não lugar)** | A cidade em volta são 90 caixas pretas sem janela e 24 caixas d'água. O que se mexe: névoa em lençol e a deriva da câmera. Sem trem, vapor, pássaro, chuva, raio, holofote ou tirolesa | 4 |
| 7 | **A interface por cima é "SaaS escuro"** | Na cena 2, um painel retangular escuro com borda fina cobre o centro da tela e empurra a torre para a esquerda, metade escondida. No cofre e no elevador, cards escuros com borda de 1 px. O HUD em mono é bom, mas é a única "voz" de interface; o resto é card | 3 |
| 8 | **Transições sem efeito** | A troca rua → porão é a câmera descendo na névoa. O igloo faz da transição um evento (pixel esticado, aberração, geada) | 3 |
| 9 | **Som quase inexistente** | Três sons sintetizados (clique, "plim", campainha), desligados por padrão, sem ambiência. O igloo tem trilha, 2 ambiências e 15 efeitos por gesto | 3 |
| 10 | **Enquadramento tímido** | A câmera do hero está a meia distância e centraliza pouco a torre; não há primeiro plano (gárgula, grade, poste desfocado) nem a contra-plongée heroica dos cartazes de Cassandre e de Ferriss | 3 |
| 11 | **Paleta sem o acento estranho do Deadlock** | O Deadlock põe acentos saturados (verde de parque, rosa, laranja, azul de chama) sobre uma cidade cinza e úmida. Nós temos âmbar + verdete, elegante mas "contido demais" | 2 |
| 12 | **Tom sério demais** | O Deadlock é grotesco e engraçado (padroeiro de chifres, urna que provoca quem a carrega, porteiro narrador). Nosso texto tem graça ("Sobe, que tem vaga"), mas a imagem não tem nenhum detalhe estranho ou bem-humorado | 2 |
| 13 | **Cenas internas com cara de vetor** | Cartas do cofre: linhas finas sobre vidro escuro. Placa: gradiente de latão quase CSS. Faltam volume, relevo e gravação real | 2 |

**O que já está bom e deve ficar:** o conceito (andar = lobby, janela = vaga), a camada mono nos cantos, o `Decode`, as etiquetas com fios na cena 2 (o embrião certo do igloo), o porão, a placa com hash, o desempenho medido e os níveis de aparelho.

---

## D. Deadlock: o que evocar e o que não copiar

### D.1 O que faz algo *parecer* Deadlock (observado e pesquisado)

1. **Cenário:** uma Nova York alternativa do começo do século XX, anos depois de um cataclismo que trouxe o sobrenatural para o cotidiano. Rituais e anomalias mágicas são parte da vida (https://en.wikipedia.org/wiki/Deadlock_(video_game)). A atualização *Old Gods, New Blood* (jan/2026) misturou **Nova Orleans do fim do século XIX com Nova York do começo do XX** (https://www.destructoid.com/latest-deadlock-overhaul-turns-valves-not-so-mysterious-game-into-one-of-the-most-stylish-titles-of-all-time/).
2. **Dois deuses em guerra:** a partida é um ritual para invocar o seu padroeiro destruindo o do outro lado. Um é sombrio, com chifres, olhos amarelos e preso a uma efígie de vime em chamas; o outro é pálido e etéreo, de chama azul, com uma máscara quebrada (https://deadlock.wiki/Map ; https://deadlock.wiki/The_Hidden_King). **Âmbar contra azul** é o código de cor mais profundo do jogo.
3. **O mapa é transporte:** três pistas com cor própria (amarela, azul e verde, segundo https://deadlock.wiki/Map), uma **tirolesa** colorida por pista correndo no alto de base a base, **túneis e esgoto** com o chefe do meio, máquinas que dão almas, uma urna que anda pelas pistas.
4. **As almas são a moeda:** você ganha almas e gasta em itens. No jogo elas são orbes luminosos que saltam dos inimigos (confirmar no jogo). Itens em três famílias (arma, vitalidade e espírito: https://deadlock.wiki/Items), cada uma com uma cor no HUD (laranja, verde e roxo, pela memória de jogador; confirmar no jogo).
5. **Renderização:** estilizada e herdeira do TF2. Formas exageradas, silhuetas legíveis, texturas pintadas à mão, luz de contorno e mistura quente e fria. A arte dos heróis no site oficial é pintura de ilustrador com pincelada visível. A Valve descreveu essa escola no artigo do TF2 (Leyendecker como referência, luz quente e fria, contorno de luz).
6. **Cidade:** marquises de teatro e de lanchonete em néon, viaduto com outdoors, caminhão, estátuas de pedra, igrejas góticas, praças com círculo ritual no chão, árvores e mato tomando a cidade nas áreas de parque, cartazes ocultos colados nas paredes. Névoa, umidade, crepúsculo azulado com luz quente de vitrine (capturas em https://www.playdeadlock.com/cityneversleeps).
7. **Gráfico do site oficial:** letreiro de cartão-postal recheado de ilustração, molduras de papel com borda rasgada, linhas de rota tracejadas, "balas" de linha de metrô com letra, mapas de pista em círculo, chevrons. É um tom de **guia turístico com humor**.
8. **Tom:** grotesco, engraçado e teatral (uma urna que provoca, um narrador-porteiro), nunca solene.

### D.2 O que **evocar** (seguro e nosso)

| Evocar | Como, no nosso mundo |
|---|---|
| A era (1900 a 1935, Nova York e Nova Orleans) | Ferro fundido, rebite, varanda de ferro rendado, letreiro de lâmpadas, viaduto de trem elevado, caixa d'água, holofotes de estreia varrendo o céu |
| Ocultismo como *coisa do cotidiano* | Círculos rituais gravados no chão da praça, sigilos riscados a giz nas paredes, velas nas janelas de lobby privado, chama de cor "errada" no farol da coroa |
| A dualidade quente × fria | A torre âmbar (nossa luz de gente) contra um céu e uma névoa de **chama azul-safira**: lua, faróis e magia em azul frio. Não usar os nomes |
| "Alma" como luz que viaja | Cada jogador que entra é uma **brasa** que sai da rua, sobe pela fachada e acende a janela dele. É nosso, porque nasce do dado |
| Transporte como estrutura | Cabos de tirolesa genéricos ligando a torre a prédios vizinhos, com lanternas correndo; o trem elevado passa na cena 1 |
| Subterrâneo | O porão (cofre) já existe. Acrescentar vapor, canos, trilhos e o ronco de algo grande lá embaixo |
| Pintura e ilustração | Shader de luz quente e fria, contorno de luz, pós-processo pintado leve, papel |
| Humor estranho | Um detalhe vivo por cena: um gato na marquise, uma janela onde alguém acena, um pombo que foge quando o lobby lota, um cartaz oculto meio rasgado |

### D.3 O que **não** copiar

- **Logo, nome, ícones e fontes da Valve.** O site oficial usa Oracle, Jost e Pulp (medido em `pesquisa-direcao-arte.md`). As fontes do jogo também ficam de fora.
- **Personagens e semelhanças:** nada de chifres de cervo com efígie de vime, máscara da Estátua da Liberdade quebrada ou rostos de heróis. Evocar "deus âmbar contra deusa azul" **só pela cor**, nunca pela figura.
- **Nomes próprios:** Cursed Apple, Maelstrom, Patron, Hidden King, Archmother, Amber Hand, Sapphire Flame, Soul Urn, Rejuvenator, Midboss, Walker, Guardian, Broadway, York, Greenwich (como pista), *City Never Sleeps*. Nos textos: "alma", "padroeiro" e "urna" só como palavras comuns e com cuidado. Melhor "brasa", "chama" e "relicário".
- **O sistema gráfico do site oficial:** cartão-postal com letras recheadas de ilustração, "balas" circulares de metrô com letra, bordas rasgadas com aquela textura. É a identidade deles. A nossa moldura é latão rebitado, papel de registro e placa gravada.
- **Arte real:** nenhuma captura, render ou textura extraída (o usuário é modder; a tentação existe). Também nada de modelos do jogo, mesmo "de referência".
- **As cores exatas das famílias de item** como sistema da interface (laranja, verde, roxo). Já temos cor por modo; não sobrepor ao código do jogo.

### D.4 O que os sites da comunidade fazem (e por que não basta)

- **deadlock.wiki:** MediaWiki temático, escuro, com ícones do jogo. É útil, mas o visual é emprestado do jogo.
- **Statlocker** (https://statlocker.gg) e os rastreadores de estatística: painel escuro de dados, retratos de heróis e cores de item. É o padrão "site de stats de MOBA".
- **GameBanana:** portal genérico de mods.

**Lição:** todos parecem Deadlock porque **usam a arte da Valve**. Nós não podemos. Logo, a nossa "cara de Deadlock" tem de vir de **atmosfera, era, materiais, comportamento sobrenatural e renderização ilustrativa**, não de ícones. Feito isso, seremos o único site da comunidade com identidade própria, e é exatamente isso que o usuário quer.

---

## E. Coreografias de montagem

Regras comuns às três:
- O progresso **real** de carregamento comanda a primeira metade.
- O **dado ao vivo** comanda a segunda: andares na ordem de criação dos lobbies e luzes na ordem de entrada dos jogadores.
- Qualquer gesto (rolar, clicar, tecla) **acelera para o fim** em 300 ms; nada trava a página.
- O título e os botões em HTML aparecem **depois** do clímax (ou junto dele), não antes. Hoje o título pinta antes e mata o momento.
- Tudo num atributo por instância `aBuild` (0 a 1) lido pelos shaders existentes via `onBeforeCompile`: zero chamadas de desenho novas para a torre.
- Com movimento reduzido: a torre aparece pronta, com um *fade* de 200 ms.

### E.1 "A Obra" (construção de 1930, realista e mecânica)

Referências:
- O Empire State subiu cerca de quatro andares e meio por semana, e Lewis Hine fotografou os rebitadores nas vigas (NYPL: https://digitalcollections.nypl.org/collections/lewis-wickes-hine-documentary-photographs-1905-1938 ; Eastman Museum, *Riveters, Empire State Building*, c. 1931).
- A agulha do Chrysler foi montada **escondida dentro do prédio** e içada em cerca de 90 minutos, em 23/10/1929 (https://en.wikipedia.org/wiki/Chrysler_Building).

| t (s) | 3D | Dado | Som |
|---|---|---|---|
| 0 a carga | O fio de latão atual (`TowerSketch`) vira **esqueleto 3D de vigas em I**: pilares sobem do chão, as vigas horizontais encaixam com um tranco curto. Um guindaste de treliça no topo gira | Cada etapa real (fontes, módulo, cena, ambiente, shaders) ergue um trecho do esqueleto | Rebite (3 batidas secas), guincho |
| +0,0 a 1,4 | **Andares deslizam para dentro** do esqueleto, de baixo para cima, como gavetas. Primeiro o corpo de obsidiana, depois a faixa de latão que "fecha" com uma faísca | Ordem dos andares = ordem de criação dos lobbies (`minutesAgo`), 70 ms entre eles | Batida grave por andar |
| +1,4 a 2,2 | **Ornamentos aparafusam:** pilastras, frisos e cornijas caem 20 cm e assentam com um pequeno *overshoot* (mola de latão, bounce 0,1) | | Tilintar metálico |
| +2,2 a 2,8 | **A agulha é içada de dentro da coroa** (homenagem ao Chrysler sem copiar a forma) e o farol acende | | Corrente e sino |
| +2,8 a 4,2 | Janelas acendem na ordem real de entrada (já existe) | `writeStates(opening)` | "Plim" agrupado |

- **A favor:** literal, legível, histórico, ótimo para "prédio se montando".
- **Contra:** é *engenharia*, não *magia*, e por isso fica pouco Deadlock. Custa caro em geometria (vigas, guindaste).

### E.2 "O Ritual" (a torre conjurada, sobrenatural)

| t (s) | 3D | Dado | Som |
|---|---|---|---|
| 0 a carga | Na praça, um **círculo ritual** gravado no chão acende anel por anel, conforme o progresso real. Os anéis giram em sentidos opostos. Fumaça baixa corre para o centro | Progresso real = anéis acesos | Zumbido grave subindo |
| +0,0 a 0,6 | Uma **coluna de fumaça** sobe do círculo até a altura final da torre; sigilos orbitam a coluna | Altura da coluna = número de lobbies | Sopro, sino invertido |
| +0,6 a 2,0 | **Os andares se condensam da fumaça**, de baixo para cima: shader de dissolução com ruído, a borda da dissolução **queima em âmbar** (como papel em brasa) e a fumaça se recolhe para dentro | Um andar por lobby, na ordem de criação | Crepitar |
| +2,0 a 3,2 | **Brasas** (os jogadores) vêm da cidade em arcos, sobem pela fachada e entram cada uma na sua janela, que acende com o "pega, falha, firma" atual | Uma brasa por jogador, na ordem real de entrada; amigos em verdete | "Plim" por brasa, com limite |
| +3,2 a 3,8 | O farol da coroa acende em **chama azul fria** (a outra temperatura), o círculo apaga, e o título decifra | | Sino |

- **A favor:** é o mais Deadlock (ritual, invocação, almas viram luz) e o mais "nosso" (cada brasa é um jogador de verdade).
- **Contra:** sem forma reconhecível de "construção". Depende muito de partículas e fumaça bonitas.

### E.3 "A Obra Encantada" (híbrido; **a recomendada**)

A construção de 1930 feita por mãos invisíveis. É o melhor dos dois: o **"prédio se montando"** que o usuário pediu, com a **magia** que falta.

| t (s) | 3D | Dado | Som |
|---|---|---|---|
| 0 a carga | Círculo ritual acende na praça (progresso real). Do círculo saem **fios de luz âmbar** que desenham o esqueleto da torre no ar: é o nosso fio de latão atual, agora 3D e em perspectiva | Progresso real; esqueleto do tamanho do dado | Zumbido, giz riscando |
| +0,0 a 1,5 | **Andares descem do céu** (não sobem), cada um girando de 15° a 0° e caindo no seu lugar, guiado pelo fio, com um tranco seco e poeira de brasa no encaixe. Ordem: base → topo. Alternativa: o andar se condensa de fumaça com a borda em brasa | Ordem de criação dos lobbies; 80 ms entre andares (18 andares ≈ 1,5 s) | Batida grave + rebite |
| +1,5 a 2,1 | **Ornamentos se aparafusam sozinhos:** pilastras, frisos e gárgulas giram 90° e encaixam. Os fios se apagam ponto a ponto, como pontos de costura sendo puxados | | Tilintar |
| +2,1 a 2,6 | A agulha sobe **de dentro** da coroa, e o farol acende em chama azul fria | | Corrente e sino |
| +2,6 a 4,0 | **Brasas da cidade** voam para as janelas (uma por jogador real, na ordem de entrada) | `writeStates(opening)` + partículas | "Plim" agrupado |
| +4,0 | Título e CTA decifram (Decode). O HUD fecha: `Cidade acesa. № 1.279 na cidade` | | |

**A montagem continua viva depois da abertura** (é o que dá sentido ao momento):
- **Lobby novo** → um andar novo é conjurado no topo, ao vivo: a coroa sobe, o andar desce e encaixa. Notícia no HUD: `Andar 19 erguido agora`.
- **Lobby que fecha** → o andar se desfaz em fumaça e os de cima descem um nível.
- **Lobby que lota** → os fios da cena 2 piscam e o letreiro do andar acende.

Assim o "prédio se montando" vira **o próprio produto**, não um vídeo de abertura.

**Integração com a cena 2 (explosão):**
- A explosão vira **a obra ao contrário**: cada andar sobe com atraso próprio (escada de 30 ms), gira no eixo vertical e inclina levemente (±4°), e se afasta em Z conforme o modo.
- A **luz interior vaza pelo vão** e cresce com a separação, como no igloo, onde as frestas brilham mais quando os blocos se abrem.
- Cada andar ganha mira `+` e número em mono no centro da face, e os fios de constelação **se desenham** (traço que cresce), em vez de aparecer prontos.

**Desempenho e reservas:**

| Nível | O que roda |
|---|---|
| Alto | Tudo: fios em `LineSegments` (já existem), dissolução por ruído no shader da obsidiana, até 2.000 brasas em `Points` com uma chamada de desenho, fumaça em 2 ou 3 *billboards* com textura de ruído, círculo ritual como um plano com shader |
| Médio | Sem fumaça volumétrica e sem dissolução (os andares caem e assentam); no máximo 400 brasas; círculo ritual simples |
| Baixo e movimento reduzido | SVG: o esqueleto se desenha com `stroke-dashoffset` (já existe), as janelas acendem em sequência e a praça mostra o círculo em SVG. Com movimento reduzido, a torre aparece pronta |
| Lento | Se o 3D demorar mais de 2,5 s, o círculo e o esqueleto continuam girando (a espera *é* a cena); o 3D assume quando chegar |

**Custo estimado em código:** cerca de 6 a 10 KB gzip (timeline, shaders de dissolução e brasa). Precisa caber no orçamento do chunk 3D (256,5 de 280 KB hoje); se apertar, mover o kit de ornamentos para glTF fora do JS.

---

## F. Plano v5, por prioridade

Legenda:
- **Impacto:** 1 a 5.
- **Esforço:** P (até 1 dia), M (2 a 4 dias), G (1 a 2 semanas).
- **Desempenho:** custo extra no nível alto.

### F.1 Lista ordenada

| # | Mudança | Impacto | Esforço | Desempenho | Onde mexe |
|---|---|---|---|---|---|
| 1 | **Abertura "Obra Encantada"** (seção E.3): círculo ritual comandado pelo carregamento real, fios que desenham o esqueleto, andares descendo na ordem de criação, ornamentos aparafusando, agulha subindo, brasas por jogador. Título só depois. Andar novo e andar que fecha, ao vivo | 5 | G | Baixo: atributo `aBuild` por instância, 1 `Points`, 1 plano de círculo | `three/world.ts` (`layout`, novo `build(t)`), `three/TowerScene.tsx` (linha do tempo), `three/shaders.ts` (dissolução, brasa, círculo), `components/torre/TowerSketch.tsx` (vira esqueleto + círculo no nível baixo), `components/torre/Hud.tsx` |
| 2 | **Silhueta-assinatura e kit de andares com detalhe:** coroa própria (arcos escalonados, janelas triangulares, leque de raios em relevo, lanterna da chama azul), contrafortes nos recuos, gárgulas e águias déco genéricas nos cantos, base com arcadas e marquise de lâmpadas. Três ou quatro tipos de andar (escritório, salão de baile, clube fechado e torre d'água), escolhidos por modo ou estado. Janelas em **ritmos variados** (pares, trios, arco no último andar de cada bloco) | 5 | G | Médio: kit em glTF + Draco ou meshopt, cerca de 150 a 250 KB; tudo instanciado; ≤ 60 mil triângulos na torre | Novo `public/models/kit-andares.glb` (Blender); `three/world.ts` (trocar `unitBox` por peças do kit em `inst()`); README (levantar "Blender fora do ciclo") |
| 3 | **Luz ilustrativa (jeito Valve):** rampa quente e fria no sombreado, contorno de luz na silhueta (lua azul atrás, âmbar na frente) e brilho no fio das arestas. Acrescentado ao `MeshStandardMaterial` atual | 4 | P a M | Quase zero (algumas linhas de shader) | `three/world.ts` (`materials()`), `three/shaders.ts` (pedaço comum de `onBeforeCompile`) |
| 4 | **Micro-detalhe nos materiais:** chanfro real nas peças (o kit já vem chanfrado), mapas procedurais de riscos verticais no latão, **pátina verdete nas reentrâncias e escorrida de chuva** sob os ressaltos, obsidiana com veios e reflexo variado por painel, poeira na base | 4 | M | Baixo: 2 ou 3 texturas de 512 px geradas no código ou KTX2 de cerca de 300 KB | `three/textures.ts`, `three/world.ts` |
| 5 | **Explosão de verdade na cena 2:** atraso por andar, giro e inclinação próprios, vazamento de luz pelo vão, mira `+` e número no andar, fios que se desenham. A lista HTML passa para uma coluna mais estreita e alinhada à direita, para a torre ficar inteira no centro e à esquerda | 4 | M | Zero | `three/world.ts` (`layout(explode)`), `three/shaders.ts` (luz pelo vão = emissivo pela distância ao andar vizinho), `components/torre/FloorList.tsx` e CSS da cena |
| 6 | **Camada sobrenatural permanente:** círculo ritual na praça que pulsa a cada entrada; brasas subindo quando alguém entra; sigilos que orbitam devagar a coroa; farol em chama azul fria; janelas com vela nos lobbies com convite; névoa com "fios" de fumaça que se enrolam (ruído de *curl*) | 5 | M | Baixo a médio: partículas compartilhadas com o item 1 | `three/world.ts`, `three/shaders.ts`, `three/TowerScene.tsx` (eventos de entrada já existem) |
| 7 | **Vida ambiente na rua:** trem elevado cruzando ao fundo a cada 20 a 30 s (caixas instanciadas com janelas acesas, faísca no trilho); **cabos de tirolesa** da torre a 2 prédios, com lanternas correndo; vapor de bueiro; **holofotes de estreia** varrendo o céu e a névoa; chuva fina com respingo no asfalto; raio distante a cada ~45 s, que recorta a cidade; uma revoada de pombos que levanta quando um lobby lota | 4 | M | Médio: cada item ≤ 1 chamada de desenho; chuva e raio só no alto | `three/world.ts` (cidade), `three/shaders.ts` (cone de holofote reaproveita `createConeMaterial`) |
| 8 | **Cidade com janelas e letreiros:** os prédios vizinhos ganham janelas escuras com 3 a 5% acesas em **azul frio** (cor que não colide com "vaga" âmbar e verdete), 3 letreiros de lâmpadas genéricos e caixas d'água com silhueta melhor | 3 | P a M | Baixo: shader de janela por UV, sem geometria | `three/world.ts` (`city`), `three/shaders.ts` |
| 9 | **Pós-processo "pintado" leve** no nível alto: Kuwahara anisotrópico em meia resolução ou só no fundo (por profundidade), grão de papel, contorno de tinta por profundidade nas silhuetas. Ajustar com cuidado para não borrar o texto, que é HTML e fica fora do efeito | 4 | M | Médio a alto: um passe extra em meia resolução; só no nível alto, desligável pelo monitor de quadros | Passe de composição em `three/TowerScene.tsx` / `three/shaders.ts` |
| 10 | **Transições com efeito:** rua → porão por "tinta e fumaça" (deslocamento por ruído + aberração cromática + escurecimento em círculo ritual); porão → rua com chuva escorrendo no vidro; troca de cena no HUD com um *glitch* de 150 ms | 3 | M | Baixo (no passe de composição que já existe) | `three/TowerScene.tsx`, `three/shaders.ts` |
| 11 | **Câmera heroica e primeiro plano:** contra-plongée mais baixa, torre ocupando 60 a 70% da altura no hero, um elemento desfocado em primeiro plano (grade de ferro rendado, gárgula, poste) e uma leve respiração de câmera na mão. Tirar o poste de cima da fachada | 3 | P | Zero | Poses em `three/TowerScene.tsx`, posições em `three/world.ts` |
| 12 | **Som de verdade** (opcional, ligado pelo usuário): ambiência de chuva e cidade distante, zumbido de lâmpada de sódio, trem passando, e sons da obra encantada (rebite, giz, sino, crepitar). Gravados ou de biblioteca com licença, Opus em WebM, ≤ 600 KB, baixados só depois de "Som: ligado" | 3 | M | Zero até ligar | `lib/sound.ts` (sair da síntese pura para amostras), `components/torre/Hud.tsx` |
| 13 | **Molduras com voz (interface):** painéis com canto chanfrado e rebite, fio duplo de latão, faixa de "registro" em mono no topo do painel (`№ 07 · Andar · 19:42`), contadores que giram como odômetro, carimbos nos estados, e um cursor que vira **lanterna** (luz de sódio arrastando pela fachada) só sobre o canvas | 3 | M | Zero | CSS das cenas (`components/torre/*`), `components/Deco.tsx` |
| 14 | **Cofre e placa com volume:** cartas com relevo (o motivo em latão estampado, em camadas com paralaxe interna) e vidro com refração barata; placa com gravação de verdade (*normal map* do texto e luz rasante) | 2 | M | Baixo | `three/world.ts` (cofre e placa), `three/textures.ts` |
| 15 | **Um detalhe estranho e bem-humorado por cena:** um gato na marquise que vira a cabeça para o cursor, alguém que acena numa janela quando você passa o mouse no andar, um cartaz oculto meio rasgado que muda a cada visita, o elevador com um passageiro esquisito | 2 | P a M | Zero a baixo | `three/shaders.ts` (interior das janelas já tem silhueta), `three/world.ts` |
| 16 | **Rodapé de fuligem que forma sigilos** (prometido na pesquisa anterior e ainda não feito) | 2 | M | Baixo (só quando visível) | Cena 6 em `three/TowerScene.tsx` |
| 17 | **Paleta com a segunda temperatura:** azul-safira frio para magia, lua, farol e cidade; âmbar para gente; verdete para amigo. Um acento saturado por cena, vindo da cor do modo | 3 | P | Zero | `PALETTES` em `three/world.ts`, tokens CSS |

### F.2 Ordem de execução sugerida (3 ondas)

**Onda 1: ganhos rápidos que mudam a leitura (cerca de 1 semana)**
- 3. Luz ilustrativa.
- 11. Câmera heroica.
- 17. Segunda temperatura.
- 8. Cidade com janelas.
- 5. Explosão de verdade.
- O título só aparece depois do clímax da abertura atual.

**Teste:** uma captura do hero sem logo, ao lado de uma do Deadlock, "parece do mesmo universo"?

**Onda 2: o momento e a magia (cerca de 2 semanas)**
- 1. Obra Encantada.
- 6. Camada sobrenatural.
- 7. Vida ambiente.
- 10. Transições.

**Teste:** gravar 6 s de abertura; alguém que nunca viu o site consegue dizer "o prédio se montou com a gente chegando"?

**Onda 3: ofício e textura (2 a 3 semanas)**
- 2. Kit de andares no Blender.
- 4. Micro-detalhe.
- 9. Pós pintado.
- 12. Som.
- 13. Molduras.
- 14 a 16. Cofre, placa, detalhes estranhos e rodapé.

**Teste:** zoom de 200% numa cornija aguenta como papel de parede?

### F.3 Regras novas para o brief v5 (acrescentar ao `brief-v4.md`)

1. **Três escalas de detalhe** em tudo que a câmera chega a menos de 15 m: silhueta, forma média e micro.
2. **Nada aparece pronto:** tudo que entra em cena é montado, conjurado ou aceso, e a montagem obedece ao dado.
3. **Duas temperaturas:** âmbar é gente; azul-frio é o sobrenatural. O verdete continua sendo amigo.
4. **Um ser vivo ou máquina em movimento por cena**, além da câmera.
5. **Luz ilustrativa, não fotográfica:** rampa quente e fria, contorno de luz e aresta que brilha.
6. **Levantar a regra 9 do v4 parcialmente:** modelos e texturas feitos por nós no Blender passam a valer (continuam proibidos assets da Valve, de banco de imagem e de IA).

---

## Fontes consultadas

- igloo.inc (aberto em 03/11/2026): https://www.igloo.inc/
- Estudo de caso no Awwwards: https://www.awwwards.com/igloo-inc-case-study.html
- Deadlock, site oficial: https://www.playdeadlock.com/cityneversleeps
- Deadlock na Wikipedia: https://en.wikipedia.org/wiki/Deadlock_(video_game)
- deadlock.wiki, mapa: https://deadlock.wiki/Map
- deadlock.wiki, padroeiro âmbar: https://deadlock.wiki/The_Hidden_King
- deadlock.wiki, itens: https://deadlock.wiki/Items
- Destructoid, *Old Gods, New Blood*: https://www.destructoid.com/latest-deadlock-overhaul-turns-valves-not-so-mysterious-game-into-one-of-the-most-stylish-titles-of-all-time/
- PC Gamer (só o título lido): https://www.pcgamer.com/games/moba/deadlocks-occult-new-york-setting-already-has-such-excellent-vibes-that-i-might-become-a-moba-guy-just-to-see-where-valve-takes-it
- Valve, *Illustrative Rendering in Team Fortress 2*:
  - artigo: https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf
  - slides: https://cdn.fastly.steamstatic.com/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2_Slides.pdf
- Chrysler Building: https://en.wikipedia.org/wiki/Chrysler_Building
- Lewis Hine:
  - NYPL: https://digitalcollections.nypl.org/collections/lewis-wickes-hine-documentary-photographs-1905-1938
  - Portland Art Museum: https://portlandartmuseum.org/blog/daily-art-moment-lewis-w-hine
- Townscaper, montagem por colapso de função de onda: https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making
- Shaders pintados:
  - Maxime Heckel: https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders
  - Susurrus (Codrops): https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/
- *Juice it or lose it* (GDC 2012): https://gdcvault.com/play/1016487/
- Conceitos de apoio:
  - *greeble*: https://en.wikipedia.org/wiki/Greeble
  - vista explodida: https://en.wikipedia.org/wiki/Exploded-view_drawing
- Documentos internos: `docs/design/pesquisa-direcao-arte.md`, `docs/design/brief-v4.md`, `web/README.md`.
