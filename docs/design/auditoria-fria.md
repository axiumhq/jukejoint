# Auditoria fria: por que o site ainda parece "mal feito"

*02/11/2026. Auditoria externa feita por quem não trabalhou no projeto, sobre o build de produção do commit `70e06b5` (v5 leva 2, "a cidade viva"), servido com `vite preview`. Os documentos de `docs/design/` só foram lidos depois de formada a primeira impressão. As capturas estão em `docs/design/auditoria/`.*

**Como foi medido:** painel de navegador do app (1440×900, DPR 1,25) e um Chrome headless com GPU no mesmo PC (1440×900 e 375×812 emulando um Android). A GPU é uma AMD RX 9070 XT com tela de 160 Hz, ou seja, uma máquina de topo: os números de quadro abaixo são o **melhor caso possível**. Depois da abertura, o painel do app passou a estrangular o `requestAnimationFrame` (um quadro a cada ~2 s, `visibilityState = hidden`). Isso é do ambiente, não do site, e essas amostras foram descartadas. As medições de rolagem vêm do Chrome headless.

---

## Veredito em uma frase

O site não parece mal feito por falta de esforço. Parece mal feito porque **tenta fazer coisa demais num meio que expõe cada falta de arte**: uma cidade 3D inteira de caixas sem textura, quatro estéticas diferentes ao longo da página e uma interface de painel por cima. E faz isso **no território exato da Valve** (Nova York art déco à noite com ocultismo), onde a comparação é inevitável e perdida.

---

## 1. Impressão em 5 segundos

Linha do tempo de uma visita fria a `/` em 1440×900. Os tempos vêm do marcador do HUD lido quadro a quadro no painel; as imagens vêm do Chrome headless.

| Tempo | O que se vê | Leitura de quem chega |
|---|---|---|
| **0,14 s** | O título já pintado (é o LCP), **em contorno dourado vazado**, sobre fundo azul-marinho liso. À direita, um esboço de retângulos em fio fino. Embaixo, à esquerda: "Riscando o círculo… 78%". Captura `01`. | "Carregando. Por que o título está vazado? O que é 'riscando o círculo'?" |
| **0,5 s** | "Erguendo a torre…". O 3D entra: uma praça vazia, uma laje cinza retangular com um círculo azul desenhado, prédios-caixa com janelas quadradas, um borrão laranja enorme no canto direito (poste desfocado em primeiro plano), chuva riscando **por cima do título**. Captura `02`. | "Parece SimCity ou uma maquete de arquiteto. A laje parece um placeholder." |
| **1 a 3 s** | Andares em wireframe vermelho-salmão caem do céu e se empilham; fios sobem; uma tampa paira no topo. O título continua vazado e disputa com a cena e com a chuva. | "Algo está montando. Não sei o quê nem por quê. Não consigo ler o título direito." |
| **3,2 s** | "Chegando gente…". Brasas voam para as janelas. | A metáfora (cada brasa = um jogador real chegando à sua janela) **não é legível** para quem chega. Vê-se só "pontinhos". |
| **4,1 s** | "Cidade acesa." O título preenche. A torre está pronta: farol de chama azul, anel azul em volta da coroa e dois holofotes formando **um X gigante** atrás dela. | "Ok, é um prédio." |
| **5,7 s** | O HUD se acomoda ("§ 1/6 A torre"). | Estado final. |
| **8 s** | Composição final (captura `03`): título à esquerda **sobre** janelas de prédios, texto de apoio cruzando grades de janelas, torre à direita sem dominar, X de holofotes, placa "1.291 JOGANDO AGORA", bokeh laranja no canto. | Um template "texto à esquerda, imagem à direita" com uma cena de jogo indie de 2012 atrás. |

**O que eu lembraria depois:** o X dos holofotes e o borrão laranja. Não a torre.

**Mandaria para um amigo?** Não. Mandaria a página da Valve. Não há nada aqui que pareça melhor do que o que o jogo já mostra. E o nome do produto é literalmente **"PROJETO"** (marcador do README), na barra, no rodapé, na "Gazeta do PROJETO" e no `PROJETO-Setup-0.9.3.exe`. Um site sem nome não parece produto.

**Quebrado, vazio, lento, piscando, desalinhado, ilegível ou confuso:**
- **Ilegível:** o título vazado por cerca de 4 s; a chuva riscando sobre o texto; o texto de apoio sobre a grade de janelas (desktop e, pior, no celular, capturas `03` e `09`).
- **Vazio:** a praça antes da torre; as cenas do cofre e do elevador são vazios pretos com 3 a 5 objetos.
- **Sobreposição:** o título "Do site ao jogo, em três paradas" passa por baixo do HUD fixo "Nº 1.292 jogando agora" (captura `06`). No celular, o HUD fica em cima das linhas de lobby ("Nº 1.278 jogando agora" sobre "2 amigos", captura `09`).
- **Artefato de render:** tracinhos pretos soltos no chão perto dos postes, no hero e na rua (captura `10`).
- **Confuso:** "Riscando o círculo…", "Erguendo a torre…", "Chegando gente…" e "§ 1/6 A torre" são jargão interno do roteiro, não informação para o visitante.

---

## 2. Medições

| Métrica | Valor | Comentário |
|---|---|---|
| Primeira pintura (FCP) | 136 a 140 ms | Ótimo: o HTML vem antes do 3D. |
| LCP | 136 ms no painel, 352 ms headless (é o `<span>` do título) | Ótimo no papel, mas o LCP é um título **vazado e ilegível**. |
| CLS | 0,008 a 0,010 | Ok. Pequenos deslocamentos no nav aos 133 ms e no HUD aos 5,8 s. |
| Abertura até o clímax | ~4,1 s ("Cidade acesa."), estável aos ~5,7 s | Longa para algo que termina num quadro estático comum. |
| Quadros na abertura | mediana 6,3 ms, p95 6,4 ms, máximo 100 a 150 ms (1 a 2 quadros acima de 33 ms) | Travada pontual (compilação de shader). Na GPU de topo, sem problema. **Não medido em GPU integrada.** |
| Quadros na rolagem (wheel, headless) | mediana 6,3 ms, p95 6,4, p99 12,5, máximo 112 ms (4 quadros acima de 33 ms) | Idem. |
| Bytes da `/` a frio (sem cache, até 8 s) | **~1,30 MB transferidos**, ~2,2 MB descomprimidos | O chunk `TowerScene` tem 1.017 KB minificado (279 KB gzip). Os GLBs têm 247 + 269 KB, sem Draco nem meshopt. Dentro do orçamento de 3 MB do brief. |
| Outras páginas | 450 a 507 KB cada | Ok. |
| Fontes | **5 famílias** no projeto: Big Shoulders, Big Shoulders Stencil, Libre Franklin, Martian Mono e Newsreader (3 na home) | Sintoma de sistema tipográfico sem dono. |
| Console | 0 erros. Avisos: `THREE.Clock` obsoleto (2×) e aviso de precisão HLSL X4122 num shader | Limpo. |
| Altura da home | **12.892 px = 14,3 telas** de 900 px | O cofre sozinho ocupa 4.351 px (~5 telas) para 6 modos. |
| Lobbies na primeira dobra | **1** (vista ingresso) e **2** (compacta) em 1440×900; **0** em 375×812 | Ver seção 4. |
| Para comparar | playdeadlock.com: 41,9 MB e 50.549 px de altura. igloo.inc: 15,6 MB | O peso não é o problema de vocês. A arte é. |

**Conclusão das medições:** desempenho **não** é a causa do "mal feito". O site é rápido e estável numa máquina boa. A causa está no que aparece na tela.

---

## 3. As causas, por impacto

### 3A. Estratégia e meio (as que mais pesam)

**1. Vocês escolheram lutar no ringue da Valve, com luvas de criança.** (impacto 5)
O tema é Nova York art déco à noite com ocultismo, exatamente a identidade do Deadlock. O site oficial (capturas de referência feitas nesta auditoria, não salvas no repositório) abre com letreiro de cartão-postal pintado à mão, recheado de vinhetas da cidade, retratos de heróis pintados e capturas do jogo com luz assada, vitrais de neon e materiais com textura. A Torre mostra a mesma cidade feita de caixas lisas. Quem conhece o jogo compara na hora, e "melhor que a Valve" fica impossível no mesmo assunto com 1% do orçamento de arte.

**2. O meio (WebGL procedural, sem textura, materiais lisos) não consegue parecer caro.** (impacto 5)
Os prédios de fundo são caixas com janelas quadradas em grade uniforme, sem chanfro, sem textura, sem oclusão de ambiente assada nem luz global (capturas `02` e `03`). Isso lê como "jogo antigo" ou "maquete": é exatamente o "3D com cara barata" que o dono sente. O próprio `diagnostico-assinatura.md` já listava isso (itens 1, 4 e 5), e a resposta foi **acrescentar objetos** (trem, vapor, holofote, letreiro, chuva, torre de cabos), não subir a qualidade de cada um. Mais caixas sem textura deixam o problema maior, não menor. O igloo.inc, a referência declarada do brief v4, funciona porque é **um objeto** esculpido e texturizado, numa névoa monocromática, com quase nada em volta (capturas de referência). Vocês copiaram o método (monólito, câmera na rolagem, HUD mono nos cantos) e inverteram a parte que importa: a contenção.

**3. Iteração por acúmulo, e design guiado por documento.** (impacto 4)
Foram quatro direções em cerca de 17 commits (v2 "déco clean", v3 "Cidade Acesa" em SVG, v4 "Torre" ao estilo igloo, v5 "Obra Encantada"), com **~280 KB de documentos de design** em `docs/design/`. Cada diagnóstico vira uma lista de itens a acrescentar, e cada item é cumprido isoladamente. A regra 1 do brief ("Uma ideia, gasta num lugar só. O resto quieto e preciso") é violada pelo próprio roteiro: torre + cidade + chuva + holofotes + cofre de vidro neon + elevador de madeira + placa de latão + jornal de papel. Checklist cumprido não gera gosto; edição (tirar coisas) gera.

**4. A regra "imagem só nossa: geometria procedural, sem stock, sem IA" sem artista no time é uma regra que garante ausência de arte.** (impacto 4)
É uma escolha legítima de pureza. Mas, sem um ilustrador ou artista 3D de verdade, ela empurra tudo para primitivas e line-art: as cartas de tarô dos modos são ícones de linha (pentagrama, trilhos em perspectiva, ondas) que parecem clip-art, e a página de um modo não tem **nenhuma** imagem do modo sendo jogado.

### 3B. Gosto e direção de arte

**5. Salada de estilos: cinco linguagens visuais numa página.** (impacto 4)
Há uma cidade low-poly iluminada (cenas 1, 2 e 6), um cofre em wireframe neon laranja e azul sobre preto absoluto (captura `05`), um elevador de madeira com mostrador (cena 4), uma placa de latão em gradiente (cena 5) e um jornal de papel bege em serifa (cena 6). Some-se a isso a camada mono estilo HUD e as cartas de linha em SVG. Cada cena parece de outro site. Um estúdio de ponta escolhe um material e uma luz e gasta tudo neles.

**6. Tipografia e layout de template.** (impacto 4)
- **Título:** Big Shoulders condensada (uma Google Font comum em sites de jogo), em caixa normal, alinhada à esquerda, em ~64 px de altura de x, com uma linha de apoio e **dois botões retangulares (dourado cheio + contorno)**. É o hero padrão de qualquer landing page.
- **Sem marca:** não há logotipo, letreiro desenhado nem gesto tipográfico próprio. Compare com o letreiro de cartão-postal do Deadlock ou a fonte pixel própria e o logotipo do Balatro.
- **Fontes demais:** cinco famílias, três delas às vezes na mesma linha de lobby (título condensado, meta em sans e "aberto há 6 min" em mono).
- **Barra superior com ruído:** relógio "São Paulo, 12:47" e "Som: desligado" na barra principal.

**7. A home tem painéis demais.** (impacto 4)
Na cena 2 (captura `04`) aparecem **18 rótulos mono com fios-guia** do lado esquerdo, colidindo com os prédios, e uma **lista de lobbies inteira em painel** do lado direito, com botões "Entrar", barrinhas de vagas e tags. É um painel de controle por cima de uma cena 3D. O brief v4 proibia isso ("nada de dashboard falso"). O igloo usa rótulos com fio porque o fundo dele é névoa lisa; aqui o fundo é uma cidade cheia de janelas, e os rótulos viram ruído.

**8. A abertura tem um conceito que ninguém consegue ler.** (impacto 3)
"Andares caem na ordem de criação dos lobbies" e "uma brasa por jogador real voa até a janela dele" são ideias boas no papel e invisíveis na tela. O visitante vê retângulos salmão caindo e pontinhos. E a abertura acontece **atrás de um título já posto**, então disputa a atenção em vez de preparar a entrada. O desfecho é um quadro estático comum (captura `03`). Uma abertura memorável precisa terminar numa imagem melhor do que qualquer quadro do meio, e aqui o melhor quadro é o do meio (captura `02`, a praça com o círculo azul).

**9. Composição sem foco.** (impacto 3)
A torre fica a ~70% da largura, cortada embaixo, competindo com o X dos holofotes, a placa "1.284 JOGANDO AGORA", o bokeh laranja e a grade de janelas atrás do texto. Não existe um ponto onde o olho descansa.

**10. Excesso de metáforas para decifrar.** (impacto 3)
Torre, andar, janela, brasa, círculo, cofre, elevador, placa, gazeta, tarô, ingresso, Em cartaz, sessões. Cada página pede para aprender uma metáfora nova antes de entender o produto.

### 3C. Bugs de execução (baratos, mas corroem a confiança)

| Bug | Evidência |
|---|---|
| Marca é um marcador: **"PROJETO"** | Barra, rodapé, Gazeta, nome do instalador. |
| Duas barras superiores diferentes | Na home: itens centralizados em mono, com relógio e som. Nas internas: logo com cadeado, itens à esquerda em sans. Compare as capturas `03` e `08`. |
| Contagens que não batem | /lobbies diz "16 lobbies" no topo e "18 lobbies" na lista; os modos somam 5+3+2+1+2+1 = 14; o HUD da home mostrou 15, 16 e 17 em cargas diferentes. "1.284 jogando" pula para 1.277 durante a abertura. |
| Texto sob o HUD fixo | Captura `06` (desktop) e `09` (celular). |
| Texto ilegível sobre o 3D | Título vazado por ~4 s, chuva sobre o texto, texto de apoio sobre as janelas. |
| Texto de mouse no toque | "Passe o mouse ou o foco numa linha" aparece no celular (captura `09`). |
| Tracinhos pretos no chão | Captura `10`, perto dos postes no hero e na rua. |
| Cards translúcidos no cofre | As barras verticais do cofre aparecem através do card de texto (captura `05`). |
| Redundâncias | O destaque "Só mira, sem choro" repete como 1ª linha da lista; "22 ms" aparece duas vezes no destaque; a tag "amigo" vem ao lado de "1 amigo"; a frase "O mesmo lobby que 'Jogar agora' escolhe…" aparece duas vezes no texto da página. |
| X dos holofotes e bokeh laranja | O brief proíbe "brilho radial solto"; o bokeh do canto direito é exatamente isso. |

---

## 4. Lobbies

**Primeira impressão (captura `08`):** um título "Lobbies", três números em mono, um botão "Criar lobby", e então **um cartão de destaque de 330 px** com uma carta de pentagrama em linha, um anel de vagas, um botão dourado e uma explicação em letra miúda. Na dobra de 1440×900 cabe **uma** linha de lobby (vista ingresso) ou duas (compacta). No celular, **nenhuma**. A página que é o coração do produto esconde o produto.

**Hierarquia:** cada linha de "ingresso" tem ~180 px de altura e traz selo do modo, nome do modo, região, barras de ping e ms, título, anfitrião, tag de amigo, contador de amigos, temperatura colorida, "aberto há X min" em mono, número grande X/12, "Falta 1", barra de vagas segmentada, picote de ingresso e botão. Isso dá cerca de 14 elementos por linha, com **~400 px de vazio no meio**. Todos os botões "Entrar" têm o mesmo peso, então nada diz "este é o melhor para você".

**Cara de painel ou de amador:** a barra segmentada com brilho, o anel tipo "gauge" do destaque, o picote de ingresso, as cores de friso por modo, a tag verde e os ms com barrinhas de sinal juntos parecem um painel de admin de servidor fantasiado de art déco. As vistas "compacta" e "ingresso" existem porque ninguém decidiu qual é a certa.

**Faz parte do mesmo produto que a home?** Não. A home é uma experiência 3D noturna com HUD; /lobbies é um app escuro genérico com outra barra superior. A única ponte são as cores latão e verdete.

**O que deveria ser:** uma tabela tipográfica precisa, de **56 a 64 px por linha**, com **8 a 10 lobbies na primeira dobra**. Colunas fixas: modo, nome, vagas (número tabular, sem barra), ping e ação. Um único botão primário no lobby recomendado, e as outras linhas clicáveis inteiras. O destaque vira a primeira linha marcada, não um cartão.

---

## 5. Consistência

| Página | Linguagem |
|---|---|
| Home | Cena 3D noturna + HUD mono + barra própria + 5 estéticas por cena |
| Lobbies | App escuro "SaaS", ingresso com picote, gauge, barras |
| Modos | Cartas de tarô em line-art, molduras de latão com casinha em cima |
| Modo | Layout de produto (imagem + ficha técnica + dois botões) |
| Instalar | Página de documentação (passos numerados, hash em caixa) |
| Novidades | Jornal em serifa Newsreader: "Gazeta do PROJETO", um terceiro site |

São **pelo menos três produtos** costurados: o experimento 3D, o app escuro e o jornal. As páginas internas são competentes, limpas e legíveis, e justamente por isso parecem genéricas: são o "tema escuro" padrão com Big Shoulders nos títulos.

**Achado incômodo:** o nível `?tier=low` (a cidade SVG do v3 com o cartão do lobby, captura `07`) é **mais claro, mais coerente e mais bonito** que o 3D de alto nível. Ele é plano, intencional, legível e mostra o produto (o andar com vagas e um botão "Entrar"). O 3D trouxe complexidade sem trazer qualidade.

---

## 6. Meio: qual caminho pode superar a Valve

**Veredito:** o 3D procedural em tempo real, low-poly e sem textura, é o meio **errado**. Ele só supera ilustração pintada com o nível de artesanato do igloo.inc: modelos esculpidos, texturas, luz assada, meses de um estúdio especializado e cerca de 15 MB. Nada disso está disponível aqui. Cada caixa sem chanfro denuncia o orçamento.

E a pergunta certa não é "como ser mais bonito que a Valve no estilo da Valve". É **"como não ser comparado"**. A Valve vence em ilustração e cidade; vocês vencem sendo o oposto: contidos, precisos e tipográficos, com um único gesto memorável. Isso casa com a direção que o dono pediu agora: **"Minimal e preciso"**.

| Caminho | Pode parecer melhor que a Valve? | Custo | Risco |
|---|---|---|---|
| **3D em tempo real** (o atual) | Não, sem um artista 3D sênior e meses de trabalho | Alto e contínuo (desempenho, níveis de aparelho, manutenção) | O "barato" já está à vista |
| **Loop pré-renderizado do Blender** (Cycles, texturas, luz assada, volumetria, profundidade de campo), 6 a 8 s em vídeo AV1 + H.264, 2 a 4 MB, com pôster estático | Sim, num único objeto bem feito. Render offline perdoa o que o tempo real denuncia | 1 a 3 semanas de um artista 3D competente (cerca de US$ 1.000 a 4.000) ou do próprio dono no Blender, com referência forte | Perde o "dado vivo" na imagem (o dado vai para o HTML). Se o modelo for fraco, o render só ilumina a fraqueza |
| **Ilustração encomendada** | Sim, com um ilustrador muito bom. Mas é competir no estilo da Valve | US$ 1.500 a 8.000 por key art, mais variações | Volta para o ringue da Valve |
| **2.5D com camadas pintadas e paralaxe** | Raramente; costuma virar "parallax de 2014" | Médio | Kitsch |
| **Site tipográfico contido + um efeito 2D** | Não "supera" a arte, **sai da comparação**. E não tem como parecer barato se a tipografia for impecável | Baixo em arte; alto em rigor de design | Ficar sem graça se o efeito único for fraco |

### Recomendação concreta para "Minimal e preciso"

**O que remover (tudo isto sai):**
- A cena 3D inteira: cidade, torre, chuva, holofotes, trem, vapor, letreiros, cerca, laje com círculo, brasas, farol, anel azul e pássaros. Saem também `three`, `@react-three/fiber`, os GLBs e os níveis de aparelho.
- As cenas 2 a 6 da home: andares com 18 rótulos, cofre neon, elevador, placa de latão e jornal na rua.
- O HUD de cantos (relógio, som, "§ 1/6"), os textos de carregamento com jargão ("Riscando o círculo…") e o título vazado.
- As cartas de tarô em line-art, as molduras com "casinha", o picote de ingresso, o anel/gauge, as barras segmentadas com brilho, os frisos coloridos por modo e as vistas duplas de lobby.
- Três das cinco fontes, e o tema "jornal" da Novidades (vira a mesma página que as outras).

**O único efeito marcante. Proposta principal: "As janelas" em 2D.**
- **A ideia:** o conceito bom do projeto (cada janela acesa é um jogador) sai do prédio 3D e vira **tipografia de luz**. O número de jogadores agora (ou o nome da marca) aparece enorme na primeira dobra, entre 30 e 50% da altura da tela, composto por uma grade fina de "janelas": células retangulares de 6 a 10 px.
- **O movimento:** na entrada, as células acendem uma vez numa cascata de 900 ms a 1,2 s, em ordem de leitura. Depois, a cada jogador que entra, uma célula acende com um leve calor de luz de sódio (2 a 3 tons, sem bloom solto), e as verdes são amigos.
- **A técnica:** canvas 2D ou um shader de tela cheia simples. Vetorial, nítido em qualquer DPR, com menos de 30 KB de código e sem modelo 3D que possa "parecer barato".
- **Por que funciona:** é o produto (gente jogando agora) virando imagem, sem imitar a ilustração da Valve.
- **Referência de linguagem:** placas de matriz de pontos, painéis split-flap de estação e a identidade em matriz de pontos da Nothing. O cuidado é desenhar a célula como janela art déco (proporção vertical, cantos duros), não como LED genérico.

**Alternativa, se o dono quiser imagem:** um único loop pré-renderizado no Blender de **um objeto** (por exemplo, uma porta ou fechadura de obsidiana e latão com luz vazando pelas frestas), com texturas reais e luz assada, centralizado em fundo quase preto, sem cidade. Nunca em tempo real.

**Padrão de tipografia e composição a atingir:**
- **Duas famílias, no máximo, e mono só para números tabulares.** Uma display com caráter, de preferência licenciada e pouco vista em sites de jogo (evitar Big Shoulders e Druk, que estão em toda parte), mais uma de texto neutra e excelente. Ideal: um **logotipo desenhado** para a marca, nem que seja só o letreiro.
- **Escala com saltos claros** (razão ≥ 1,5): display de 120 a 200 px no hero, com tracking de -2 a -4% e a altura do título alinhada à grade; texto a 17 a 19 px, linhas de 60 a 70 caracteres e entrelinha de 1,5.
- **Grade de 12 colunas**, um eixo de alinhamento à esquerda do qual tudo pende, e ritmo vertical de 8 px. Seções separadas por 160 a 240 px de vazio, não por cards.
- **Uma cor de ação** (o latão), usada só em ação e em "gente". Todo o resto em 3 tons de cinza quente sobre quase preto. Fios de 1 px a 10–12% de opacidade, no lugar de caixas com borda.
- **Título com no máximo 6 palavras**, com texto real por cima de fundo **liso**: nada atrás do texto.
- **Movimento:** uma única entrada (o efeito), transições de 200 a 300 ms com uma curva só, e nada se movendo em loop além do efeito.
- **A mesma barra superior em todas as páginas**, com 4 itens e a marca.

**Referências de "minimal e preciso" em jogos e entretenimento** (não abertas nesta auditoria; conferir antes de usar como referência):
1. **a24films.com**: entretenimento, tipografia como imagem, contenção extrema.
2. **play.date** (Panic/Playdate): jogo e hardware, layout preciso, humor sem ruído.
3. **teenage.engineering**: grade e tipografia de precisão; cada detalhe é intencional.
4. **nothing.tech**: matriz de pontos como identidade, o parente mais próximo do efeito "janelas".
5. **igloo.inc** (aberto nesta auditoria): a lição não é o 3D, é **um objeto só**, num fundo calmo.

---

## 7. O que um estúdio de ponta faria agora, em ordem

1. **Congelar funcionalidades e decidir o nome.** Encomendar um logotipo ou letreiro (US$ 500 a 3.000) ou desenhar um. Nada de "PROJETO" em mais nenhuma tela.
2. **Fazer dois quadros estáticos antes de qualquer código:** o hero "janelas" e o hero com loop pré-renderizado, em 1440×900, **lado a lado com uma captura do playdeadlock.com**. Escolher pelo lado a lado, não por documento.
3. **Remover o 3D e as cenas 2 a 6.** A home passa a ter, no máximo, 4 telas: hero com o efeito, lobbies ao vivo (5 linhas), modos (só tipografia e números), confiança no instalador (uma linha com link) e rodapé.
4. **Escrever o sistema tipográfico** (2 famílias, escala, grade, cores) e reaplicar em todas as páginas com **uma** barra superior. A Novidades perde o "jornal".
5. **Refazer /lobbies como tabela precisa:** linhas de 56 a 64 px, 8 a 10 na dobra, um botão primário só, o destaque como 1ª linha marcada e uma vista só.
6. **Corrigir dados e bugs:** contagens consistentes em todas as páginas (uma fonte única de verdade no mock), HUD e texto que não se sobrepõem, cópia de toque no celular e textos duplicados.
7. **Imagem dos modos:** ou capturas reais dos modos rodando no jogo (gravadas por vocês; conferir os termos da Valve para material de jogo), ou nenhuma imagem, só nome, uma frase e números. Line-art de tarô, não.
8. **Pôr um designer sênior humano** numa revisão de 2 semanas, com autoridade para cortar. Parar de produzir documentos de 30 a 60 KB e iterar com capturas lado a lado.
9. **Especificação de movimento:** uma entrada de até 1,2 s, sem texto de carregamento, uma curva de easing para o site todo e `prefers-reduced-motion` mostrando o estado final.
10. **Teste de 5 segundos com 5 jogadores de Deadlock:** "O que é isto? O que você faria agora? Mandaria para alguém?". Só avança quando 4 de 5 responderem "dá para entrar numa partida da comunidade" sem ajuda.

---

## Capturas (`docs/design/auditoria/`)

| Arquivo | O que mostra |
|---|---|
| `01-abertura-carregando.png` | Primeiro estado: título vazado, esboço em fio, "Riscando o círculo… 78%". |
| `02-abertura-praca-vazia.png` | O 3D entrando: praça vazia, laje cinza com círculo, prédios-caixa, bokeh laranja, chuva sobre o título. |
| `03-hero-final.png` | Estado final do hero: título sobre janelas, X de holofotes, torre a 70%, bokeh. |
| `04-cena-andares-painel.png` | Cena 2: 18 rótulos mono com fios sobre a cidade e lista de lobbies em painel à direita. |
| `05-cofre-neon.png` | Cofre: wireframe neon em vazio preto, outra estética; barras visíveis através do card. |
| `06-transicao-sobreposicao-hud.png` | Transição cofre → elevador com objetos cortados; o título "Do site ao jogo…" sob o HUD fixo. |
| `07-nivel-low-svg.png` | O nível low em SVG, mais claro e coerente que o 3D. |
| `08-lobbies-dobra-1440.png` | /lobbies em 1440×900: uma linha de lobby na dobra; o destaque ocupa o espaço. |
| `09-mobile-andares.png` | Celular: texto sobre a torre, "Passe o mouse…" e HUD sobre as linhas. |
| `10-artefato-chao.png` | Tracinhos pretos no chão perto dos postes (artefato de render). |

*Capturas dos sites de referência (playdeadlock.com, igloo.inc, playbalatro.com) foram feitas para a comparação e não foram salvas no repositório, por serem material de terceiros. hadesgame.com não respondeu em 30 s e hades2.com devolveu "Access Denied" ao navegador headless.*
