# Pesquisa de referências: como tornar o site realmente único

Data da pesquisa: 2026-11-02. Escopo: plataforma gratuita de modos da comunidade para Deadlock, Brasil/LatAm primeiro, pt-BR. Site atual: v2 em `web/` (preto de pátina, latão, Jost + Libre Franklin, fio déco, painel de lobbies ao vivo).

## 0. Resumo executivo

**Diagnóstico do "seco".** O v2 é limpo, mas não tem quase nada do que faz um site de jogo ser lembrado: textura (nada de grão, papel, tinta), luz (latão é só cor, não brilha), imagem própria (zero arte além de linhas SVG), voz (o texto é de produto, não de personagem), contraste tipográfico (um único estilo geométrico em dois pesos) e uma metáfora central (é um "painel com tabela", não um lugar). Pior: **Jost, que é a nossa fonte de títulos, é também a fonte secundária do site oficial do Deadlock** (medido por mim em `playdeadlock.com/cityneversleeps`: `Jost, Oracle, sans-serif`), e o nosso par verdete + latão é quase idêntico ao de um site premiado que não tem nada a ver com jogo (Haunted Boulder City, `#35463d` + `#d9b47b`). A paleta é boa; o que falta é ofício e uma ideia.

**Recomendação em uma frase.** Faça do próprio produto (gente entrando em lobbies) a imagem de marca: uma **cidade acesa** em SVG/canvas leve, narrada por uma **gazeta** com voz própria. Barato em desempenho, impossível de copiar da Valve, e aproveita o que o v2 já começou ("luz acesa = gente").

**Os cinco conceitos (uma linha cada):**

1. **A Cidade Acesa:** a home é um corte de uma torre/quarteirão déco onde cada lobby é uma janela ou andar aceso; entrar num lobby é acender uma janela.
2. **A Gazeta:** a primeira página de um jornal dos anos 1920 inventado, com manchetes ao vivo (lobbies, rankings, novidades), halftone, tinta e classificados.
3. **O Círculo Ritual:** um círculo de sigilos que se preenche conforme jogadores entram; cada lobby é um ritual esperando quórum.
4. **O Tarô dos Modos:** cada modo é uma carta (arcano) com moldura própria, giro 3D e brilho holográfico sutil; hospedar é "tirar uma carta".
5. **Em Cartaz:** marquise de teatro com lâmpadas de latão e cartazes de vaudeville em tipo de madeira; os lobbies são "sessões de hoje".

**Top 2:** (1) Cidade Acesa como espinha dorsal visual, (2) Gazeta como voz e como layout das páginas de texto (Novidades). Detalhes na seção 5.

**As cinco referências mais úteis:**

1. https://www.playdeadlock.com/cityneversleeps (como a Valve fala com o próprio público; também o que **não** copiar)
2. https://www.hauntedbouldercity.com/ (clima de neblina, lanterna no mouse e letra de pincel com só ~18 KB de JS e sem canvas)
3. https://www.playbalatro.com/ (o shader do jogo vira o fundo do site; voz até no banner de cookies)
4. https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/ (estado real de suporte, para decidir o que é seguro usar)
5. https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/ (tramas, dither e halftone em shader para React/R3F)

**Limites desta pesquisa (leia antes de confiar):** a ferramenta de busca devolveu pouca coisa útil sobre análises de design; muitos sites de jogo são SPAs e não renderizam via fetch. Por isso abri vários deles num navegador real e **medi** fontes, canvases, vídeos e peso. Onde a informação vem de blog/wiki de fã ou de uma única fonte, marquei como **(secundária)**. Roblox e Fortnite Creative: a lista de experiências carrega dinamicamente / retornou 403, então **não consegui verificar** o visual deles e não os incluo na análise. Isto não é parecer jurídico sobre propriedade intelectual.

---

## 1. A linguagem visual do próprio Deadlock

### 1.1 O que está confirmado

| Observação | Fonte |
| --- | --- |
| Cenário: Nova York de um século XX alternativo, apelidada de "Cursed Apple". Um evento sobrenatural, o "Maelstrom", revelou magia e mortos-vivos e a humanidade se adaptou. Dois deuses rivais, os "Patrons", prometem um desejo a quem destruir o Patron inimigo num ritual de invocação. | https://en.wikipedia.org/wiki/Deadlock_(video_game) |
| A arte promocional mostra os Patrons "pairando" sobre um skyline Art Déco; a wiki da comunidade mostra o Maelstrom sobre o Empire State. Maelstrom acontece no fim do século XIX; a história se passa cerca de 50 anos depois (secundária: wiki de fãs). | https://en.wikipedia.org/wiki/Deadlock_(video_game), https://deadlock.wiki/Lore |
| Um resumo de fã descreve a cidade como "Art Déco encontra horror eldritch" com atmosfera noir pesada; Abrams tem "visual de cartaz de boxe dos anos 1920"; a loja do jogo é uma "Curiosity Shop"; a lore é esparsa e vive em descrições de itens e no ambiente (secundária). | https://www.ninjarefinery.com/deadlock-understanding-the-world/ |
| Influências citadas pela imprensa: entre a Nova Orleans do fim do século XIX e a Nova York do início do XX; Hidden King lembra *The King in Yellow* e *True Detective*; arte "entre quadrinhos, cinema e a imaginação da Valve". | https://www.destructoid.com/latest-deadlock-overhaul-turns-valves-not-so-mysterious-game-into-one-of-the-most-stylish-titles-of-all-time/ |
| Comparações críticas: City 17 (Half-Life 2) e BioShock Infinite. | https://en.wikipedia.org/wiki/Deadlock_(video_game) |
| Tela de seleção de herói redesenhada com inspiração declarada nos menus da série Persona (Atlus); novo "Hideout" como hub social; ícones/HUD refeitos, números de dano novos, contornos de visibilidade. | https://www.pcgamesn.com/deadlock/patch-notes-new-heroes-visual-overhaul, https://finalboss.io/deadlock-old-gods-new-blood-ushers-in-the |
| Facções de fundo na lore incluem um jornal ("The New York Oracle"), uma empresa industrial ocultista (Fairfax Industries), uma sociedade caçadora de monstros (Baxter Society); a wiki diz que marcas "também anunciam" na cidade (secundária). | https://deadlock.wiki/Lore |
| O jogo continua em beta fechado, só Windows (Wikipedia, consulta de hoje). | https://en.wikipedia.org/wiki/Deadlock_(video_game) |

### 1.2 O que medi no site oficial (`playdeadlock.com/cityneversleeps`, 2026-11-02)

- **Estrutura narrativa:** a página inteira é um **"guia do visitante de Nova York"**: paradas numeradas (1 Uptown, 2 Times Square, 3 Downtown, ..., 9 Old Fairfax Factories), textos com humor seco de guia turístico ("Break a leg on...", "Watch out for...", "Don't feed the Crabbage Pots").
- **Título:** lettering estilo **cartão-postal vintage ("Greetings from")**, letras grossas com contorno e **recheio de ilustrações da cidade**, sobre skyline em tons de cinza (Chrysler Building visível). Selo laranja "MAJOR UPDATE". Cartas dos heróis como **fotos instantâneas** com borda creme, levemente inclinadas.
- **Cor:** fundo carvão `rgb(44,46,49)` (`#2C2E31`) como cor mais frequente; laranja `rgb(221,102,56)` (`#DD6638`) para selos; marrom escuro `#262115`; e **cores de pista** ciano `#60CDE3`, verde `#97DA79`, amarelo `#FFE14D`. Cada seção usa a cor da "lane" correspondente (a seção verde tem tipografia e moldura verdes).
- **Tipografia:** `Pulp` (display), `Oracle` (texto, 780 elementos) e `Jost` (227 elementos). A wiki de fãs lista os arquivos `ValvePulp-Bold.woff2` e `ValveOccult-SemiBold.woff2` como fontes do jogo (secundária) https://deadlock.wiki/Help:Font. São fontes próprias da Valve: **não usar**.
- **Técnica:** site em React, **0 canvas, 7 vídeos**, página com ~44.000 px de altura. Ou seja: a Valve resolveu com **ilustração, vídeo e lettering**, não com WebGL.

### 1.3 O que dá para EVOCAR sem copiar

O que é gramática histórica geral (livre) versus o que é assinatura da Valve (evitar):

| Evocar (domínio comum, anos 1920) | Evitar (assinatura/IP do Deadlock) |
| --- | --- |
| Art déco: setbacks, sunburst/raios, chevrons, escalonados, leque (fan), vitral geométrico | Nomes: Cursed Apple, Patrons, Hidden King, Archmother, Amber Hand, Sapphire Flame, nomes e rostos de heróis, "Maelstrom" como marca |
| Latão, bronze, verdete/pátina, fumaça, neblina, lampião, lâmpadas de marquise | Fontes Valve Pulp/Occult; o par carvão + laranja `#DD6638` do site oficial; as cores de pista ciano/verde/amarelo |
| Jornal impresso, halftone, tinta que vaza, anúncios classificados, cartaz de vaudeville, tipo de madeira | Estrutura "guia do visitante" com paradas numeradas e o letreiro de cartão-postal "Greetings from" (é a ideia central do site oficial; ficaria derivado) |
| Tarô (Marselha, Rider-Waite-Smith 1909 são de domínio público), sigilos, círculos, tábua espírita (séc. XIX), cartas de baralho | Capturas de tela, arte de heróis/mapa, logotipo, silhuetas de personagens reconhecíveis |
| Ocultismo genérico: sociedades secretas, rituais, alquimia, selos | A estética Persona-like do menu de seleção de heróis como cópia; ícones do HUD |

Regra prática: **inventar as nossas próprias instituições** (a gazeta, a sociedade, o prédio, o teatro) em vez de reaproveitar as do jogo. Isso também dá liberdade de voz em pt-BR.

---

## 2. Sites de jogo e de plataforma que se destacam (13 casos)

Método: Awwwards (páginas dos sites), `fontsinuse`, e **inspeção direta no navegador** (fontes calculadas, contagem de `canvas`/`video`, bytes transferidos). Aviso de datas: Star Guardian é de 2022 (entrou por ser a referência mais clara de jogo + WebGL), os demais são de 2026 ou atuais.

| # | Site | O que o torna memorável (técnica concreta) | URL |
| --- | --- | --- | --- |
| 1 | **Deadlock, City Never Sleeps** | Metáfora única (guia turístico) + lettering de postal recheado de arte + cartas tipo instantâneo + cor por seção. Sem WebGL: ilustração e humor. Lição: **uma metáfora forte vence efeito.** | https://www.playdeadlock.com/cityneversleeps |
| 2 | **Haunted Boulder City** (Honorable Mention, 26/09/2026; Awwwards o lista com JS, CSS e HTML5) | "Foggy Loader", "Spirit Hover" e "Searchlight Mouse" (lanterna que segue o mouse) listados no Awwwards. Medido: **~943 KB totais, só ~17,6 KB de JS, 0 canvas**; letra de pincel + condensada grossa + CTA em ouro fosco. Paleta `#35463d` + `#d9b47b`, quase igual à nossa. Lição: clima não exige WebGL. | https://www.hauntedbouldercity.com/ (ficha: https://www.awwwards.com/sites/haunted-boulder-city) |
| 3 | **Balatro** | O **shader de fundo do próprio jogo** (redemoinho de tinta vermelho/azul) rodando em `canvas`, fonte pixel própria (`m6x11`), cartas flutuando, navegação em pílula; **voz até no aviso de cookies** ("Hello traveler, it's cookie time!"). Lição: o site é uma extensão do jogo, não um folheto. | https://www.playbalatro.com/ |
| 4 | **Cult of the Lamb** | Contraste "fofo vs. ocultista": serifa fina arredondada tipo blackletter (`Lapture Display`) + Fira Sans legível; mudança de cor por estado (verdes/pastéis em calma, vermelho e preto em ritual, magenta em horror). Medi 10 `canvas` e 3 vídeos; botão em faixa vermelha ("Watch Trailer"). Lição: **a paleta muda com o estado do jogo.** | https://www.cultofthelamb.com/ (tipografia: https://fontsinuse.com/uses/77885/cult-of-the-lamb-video-game) |
| 5 | **Grail** (Honorable Mention, 20/09/2026) | App que transforma tarefas em atributos de RPG: site 3D rolável (Blender + WebGL + Matter.js), "Quest Card Flow" (transição de carta), "Totems" (interação). Paleta carvão `#182124` + off-white. Lição: **cartas como transição entre telas.** | https://grail-app.com/ (ficha: https://www.awwwards.com/sites/grail) |
| 6 | **Don't Look Up** (Site of the Day, 01/11/2026, onde era o jogo) | GSAP + Three.js + JS puro; **só duas cores** (`#F4F3EF` e `#14140F`) e um conceito claro ("um jogo sobre o preço da atenção"). Dev Award: Animations 8,2. Lição: restrição extrema premiada; **conceito > ornamento.** | https://www.dontlookup.app/ (ficha: https://www.awwwards.com/sites/dont-look-up-game) |
| 7 | **Huxley Saga** (Studio Freight, nominado, 23/10/2026) | WebGL + GSAP + Vue; "Home Title Sequence", "Cinematic Product Cards", "Parallax Desert", "Footer Reveal", até uma 404 desenhada. Lição: **cada micro-página (404, rodapé) é uma cena.** | https://www.awwwards.com/sites/huxley-saga |
| 8 | **Riot Games: Star Guardian** (makemepulse, SOTD 16/09/2022) | Experiência WebGL imersiva ("Dive into the stars"), navegação incomum. Dev Award: Animations 8,8 mas **Accessibility 7,0, a nota mais baixa**. Lição: o preço do espetáculo costuma ser a11y. | https://awwwards.com/sites/riot-games-star-guardian |
| 9 | **Lusion** (estúdio 3D; Lusion v3 foi Site of the Year 2023 e Igloo Inc 2024, segundo a coleção WebGL do Awwwards) | Hero com **peças 3D com física** reagindo ao mouse. Medi 3 canvases e ~305 KB de scripts + ~192 KB de CSS transferidos nos primeiros 8 s (mais assets depois). Lição: é o teto de ambição, e também de custo. | https://lusion.co/ |
| 10 | **s&box** (plataforma comunitária da Facepunch) | Funciona como "loja de mods" que a gente também é: vitrine "MADE IN S&BOX" com jogos da comunidade no topo, **tom irreverente** ("Make games without the bullshit."), atualizações como diário com contagem de comentários/visualizações. Lição: **voz e prova social (comunidade) acima de efeito.** | https://sbox.game/ |
| 11 | **Hades II** (página no site da Supergiant) | Quase 100% **arte de imagens + wallpapers**, layout de coluna única, citações de imprensa; há até um aviso "Parallax hover is not yet ready" (efeito planejado). Lição: arte própria forte dispensa tecnologia. | https://www.supergiantgames.com/games/hades-ii/ |
| 12 | **Hollow Knight: Silksong** | Rolagem longa, fundos de largura total com a arte desenhada à mão, slideshow, trilha sonora em destaque. Lição: o mesmo; **a arte é o efeito.** | https://www.hollowknightsilksong.com/ |
| 13 | **VALORANT** | Contra-exemplo útil: fonte `Tungsten Bold` (condensada, memorável) + `DIN Next`, **2 vídeos, 0 canvas**, página relativamente curta. Memorável pela tipografia e pelo vídeo, bem menos pelo layout. | https://playvalorant.com/pt-br/ |

**Padrões que se repetem** (e que valem para nós):

1. Os sites mais lembrados têm **uma metáfora central** (guia turístico, baralho, nevoeiro, ritual), não um efeito.
2. Os que custam pouco (Haunted Boulder City, Deadlock oficial, Hades II) investem em **tipografia, ilustração e voz**; os caros (Lusion, Star Guardian) investem em WebGL e pagam em a11y/peso.
3. **Estados do produto mudam a aparência** (Cult of the Lamb): bom encaixe para lobby cheio/vazio/ao vivo.
4. **Microcopy com personalidade** em pontos "chatos" (cookies no Balatro, 404 no Huxley, rodapé).

---

## 3. Técnicas de unicidade: impacto, custo e riscos (React + Vite)

Escala: Impacto (1 a 5), Esforço (S = horas, M = dias, L = semanas), Custo de desempenho (baixo/médio/alto). Considere o público: no Brasil o Android responde por cerca de 75% dos acessos móveis (StatCounter, ago/2026, via busca; https://gs.statcounter.com/os-market-share/mobile/brazil) e há longa cauda de versões antigas, então **assuma aparelhos modestos**.

### 3.1 Estado de suporte do navegador (primária: web-features-explorer, consulta de hoje)

| Recurso | Chrome/Edge | Safari | Firefox | Baseline | Fonte |
| --- | --- | --- | --- | --- | --- |
| Animações guiadas por rolagem (`animation-timeline: scroll()/view()`) | 115 | 26 (set/2025) | **não suporta** | Limitada (bloqueada pelo Firefox desde set/2025) | https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/ |
| View Transitions (mesmo documento) | 111 | 18 | 144 (out/2025) | **Newly available desde 2025-10-14**; Widely em 2028-04-14 | https://web-platform-dx.github.io/web-features-explorer/features/view-transitions/ |
| View Transitions entre documentos | 126 | 18.2 | não suporta | Limitada | https://web-platform-dx.github.io/web-features-explorer/features/cross-document-view-transitions/ |
| Scroll-triggered animations (recurso novo, distinto do anterior) | 146 (mar/2026) | não | não | Limitada | https://web-platform-dx.github.io/web-features-explorer/features/scroll-triggered-animations/ |
| WebGPU | Chrome/Edge sim; Safari 26 sim; Firefox parcial (Windows 141, macOS ARM 145; Android/Linux em andamento) (fontes divergem) | | | n/a | https://en.wikipedia.org/wiki/WebGPU |

Consequência: **use scroll-driven em CSS só como melhoria progressiva** (`@supports (animation-timeline: view())`) com fallback estático. View Transitions entre rotas do SPA já são razoavelmente seguras. O `<ViewTransition>` do React ainda estava em Canary nas fontes que consultei (https://react.dev/reference/react/ViewTransition); **verifique o canal estável antes de depender dele**, ou chame `document.startViewTransition` direto.

### 3.2 Tabela de técnicas

| Técnica | Impacto | Esforço | Desempenho | Acessibilidade e riscos | Referência |
| --- | --- | --- | --- | --- | --- |
| **Grão de filme / papel** (PNG ladrilho em `::before` com `mix-blend-mode`) | 4 | S | Baixo se for PNG pré-assado; **médio-alto** com `feTurbulence` em aparelho fraco (a favor do SVG: zero bytes de rede e infinito, mas sem benchmarks que comprovem custo baixo no móvel) | Contraste: grão forte reduz legibilidade de texto pequeno; manter ≤ 6% de opacidade sob texto | https://css-tricks.com/?p=351302 e a discussão em https://loke-dev-lokedevs-projects.vercel.app/blog/svg-grain-textures-performance (secundárias) |
| **Halftone / dither / impressão** (CSS `radial-gradient` + `mask`, ou shader em imagens) | 4 | S (CSS) a M (shader) | Baixo (CSS) a médio (shader em tela cheia) | Imagens com dither podem prejudicar leitura de texto em cima; manter texto em camada limpa | https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/ (Bayer, blue noise, quantização, R3F + postprocessing); referência de jogo: *Return of the Obra Dinn* (demo three.js: https://github.com/mblode/dither-3d) |
| **Fundo com shader** (névoa, fumaça, tinta) via biblioteca mínima | 5 | M | Médio: um quad em tela cheia, mas queima bateria; limitar DPR (≤ 1,5), pausar fora da viewport e com aba oculta | `prefers-reduced-motion` => quadro estático; decorativo, `aria-hidden` | `@paper-design/shaders-react` (28 shaders: Smoke Ring, Grain Gradient, Halftone Dots, Halftone CMYK) https://shaders.paper.design/smoke-ring ; OGL (~20-24 KB gz, secundária) vs three.js (~115 KB gz num benchmark, secundária) — **meça no seu bundle** |
| **R3F/three.js 3D** (objeto de marca, torre giratória) | 5 | L | Alto: ≥ 115 KB gz de lib + modelos; carregar sob demanda após o LCP | Rolagem sequestrada e giro por mouse atrapalham teclado e leitor de tela; precisa de alternativa estática e botão de pausa | https://lusion.co/ (teto de custo: ~305 KB de scripts na carga inicial medida) |
| **Spline** (3D embutido sem código) | 3 | S | Alto e opaco (runtime próprio); **não medi**, verificar antes | Mesmo que acima | https://spline.design (não verificado) |
| **Animações de rolagem** (CSS `animation-timeline`) | 3 | S-M | Baixo (roda na thread do compositor quando só usa transform/opacity) | WCAG 2.3.3 (AAA) trata movimento disparado por interação como risco vestibular e cita parallax; honrar `prefers-reduced-motion` | https://w3c.github.io/wcag/understanding/animation-from-interactions e MDN https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations |
| **View Transitions** entre rotas (carta que vira página) | 4 | S-M | Baixo | Respeitar reduced-motion; manter foco gerenciado na troca de rota (já é problema de SPA) | https://web-platform-dx.github.io/web-features-explorer/features/view-transitions/ |
| **Tipografia cinética / variável** (peso e largura reagem ao scroll ou ao hover) | 4 | S | Baixo se usar fonte variável (um arquivo) | Texto móvel prejudica leitura; usar só em títulos curtos | Fontsource variável (já usado no v2) |
| **Cursor personalizado** (lanterna, planchete) | 3 | S | Baixo (um elemento com `transform`) | **Nunca substituir o cursor do sistema em áreas de ação**; invisível no toque; não esconder foco do teclado. Em Haunted Boulder City o "Searchlight Mouse" é só reforço | https://www.hauntedbouldercity.com/ |
| **Som opt-in** (ambiência baixa, cliques de latão) | 4 | M | Baixo-médio (Web Audio; ~200-500 KB de áudio) | Navegadores bloqueiam autoplay até haver gesto do usuário, então o fluxo "Ativar som" é natural; **padrão desligado**, respeitar `prefers-reduced-motion` não basta (nunca tocar sozinho), controles de volume, legenda se houver fala | Balatro e s&box não dependem de som no site; é diferencial |
| **Cartas com tilt/parallax** (3D CSS + holo sutil) | 4 | S-M | Baixo (CSS `transform` + custom properties) | Só em ponteiro fino; no toque, usar giroscópio com permissão ou nada; alternativa estática | https://poke-holo.simey.me/ (efeito holográfico de cartas em CSS) |
| **Metáfora tarô / jornal** | 5 | M | Baixo | Texto dentro de molduras ornamentadas precisa manter contraste; headline em fonte display não pode vazar tradução | Ver conceitos |
| **Ornamento generativo** (SVG com semente: sigilos, bordas, selos por lobby/modo) | 4 | M | Baixo (SVG estático, calculado uma vez) | Decorativo (`aria-hidden`), sem informação só no desenho | Grail ("Totems"); Cult of the Lamb (runas) |
| **Brilho emissivo de latão no escuro** (`box-shadow`, `drop-shadow`, `mix-blend-mode: screen`, gradientes cônicos) | 4 | S | Baixo-médio (blur grande em muitos elementos pesa; limitar a poucos) | Brilho não substitui contraste; manter razão ≥ 4,5:1 do texto sobre o fundo | Já temos tokens `--accent`; falta luz |
| **Dado como arte** (lobbies em mapa/constelação/janelas acesas) | 5 | M-L | Baixo (SVG/canvas 2D) | Precisa de **versão em lista/tabela equivalente** para teclado e leitor de tela; cor não pode ser o único canal | Radio Garden (geografia vira navegação) https://radio.garden/ ; no próprio v2 já existe "janela acesa = gente" |

### 3.3 Orçamento de desempenho sugerido para este público

- JS inicial ≤ 150 KB gz; qualquer WebGL **carregado depois do primeiro conteúdo útil** (`import()` dinâmico + `IntersectionObserver`).
- Detectar capacidade: `prefers-reduced-motion`, `navigator.hardwareConcurrency`, `navigator.connection.saveData` e `deviceMemory` (esta última só em Chromium; tratar como dica, não como regra). Em dúvida, entrar no **modo estático** (imagem SVG/PNG do mesmo visual).
- DPR máximo 1,5 em canvas de fundo; `requestAnimationFrame` pausado com aba oculta e fora da viewport.
- Toda animação com informação tem **botão de pausa** (o v2 já faz isso na arte do modo).
- Teste em Android de entrada (Moto G de faixa baixa) e com CPU 4x mais lenta no DevTools.

### 3.4 Tipografia: o que trocar e candidatas (Google Fonts / Fontsource)

Não verifiquei suporte a `ã õ ç á é` em todas; **testar os glifos de pt-BR antes de decidir**.

- **Display déco/geométrico:** Limelight (déco de cartaz), Poiret One (fina), Federo, Gruppo.
- **Condensada de cartaz (vaudeville/Cartaz de boxe):** Big Shoulders Display, Bebas Neue, Anton, Oswald.
- **Serifa de jornal:** Old Standard TT (didone de jornal), Playfair Display, Bodoni Moda, Fraunces.
- **Manchete de jornal (blackletter):** UnifrakturMaguntia / UnifrakturCook (uso só em cabeçalho da gazeta).
- **Máquina de escrever / carimbo:** Special Elite, Courier Prime.
- Manter **Libre Franklin** como texto de interface (pouco chama atenção, bom); trocar **Jost** nos títulos, que hoje é compartilhada com o site oficial do jogo.

---

## 4. Estado atual do site (o que vi em `localhost:5173`)

Home: cabeçalho simples, título grande em Jost claro ("Modos da comunidade para Deadlock."), dois botões, painel de lobbies à direita com um fio déco em cima. É coerente, mas **o título e o painel são o único evento visual**; o resto é fundo liso. Sem textura, sem luz, sem imagem, sem personagem. Para evitar retrabalho, tudo abaixo respeita os tokens, a acessibilidade (contraste medido) e `prefers-reduced-motion` do v2.

---

## 5. Cinco conceitos para o nosso site

Convenções: "Telas que muda" são as rotas do README. "Risco de kitsch" é a chance de virar fantasia de Halloween ou de pastiche.

### Conceito 1: A Cidade Acesa (recomendado)

**Pitch.** A home deixa de ser "texto + painel" e vira uma **seção de uma torre déco à noite**, num corte frontal tipo casa de bonecas: cada andar é um lobby/modo, cada janela é uma vaga. Janelas acesas em latão = gente; verdete = amigos; apagadas = vagas livres (exatamente a semântica que o v2 já definiu, só que agora é o cenário, não uma tabela). O skyline completo vira o filtro de lobbies: clicar num prédio filtra por modo; passar o mouse num andar mostra o lobby e o "Entrar". À noite (tema escuro) a cidade brilha; no tema claro vira planta de arquiteto em azul de projeto/sépia. Vira a **marca**: a `TowerMark` já existente cresce até ser a cidade inteira.

- **Telas que muda:** Início (hero), Lobbies (alternar "cidade" e "lista"), página do modo (o prédio daquele modo), Instalar (a "obra" que acende quando o app conecta).
- **Interação-assinatura:** ao abrir a página, **as janelas acendem uma a uma** conforme os dados chegam; quando alguém entra num lobby, uma janela acende **em tempo real** com um leve "plim" (som opt-in). O botão "Entrar" é uma porta/elevador no térreo do andar.
- **Paleta/tipo:** manter pátina + latão + verdete; adicionar **uma cor de neon fria** só para o céu (azul-noite), sem usar laranja nem as cores de pista do site oficial. Display: Limelight ou Big Shoulders para números e nomes de modo; texto em Libre Franklin.
- **Técnicas (seção 3):** SVG de cenário gerado por código (ornamento generativo + dado como arte); brilho emissivo CSS; grão em PNG; neblina com shader mínimo opcional (Smoke Ring ou OGL) só no desktop; View Transitions para "zoom" do prédio para a página do modo; scroll-driven opcional com `@supports`.
- **Desempenho:** SVG/canvas 2D, sem three.js. Alvo: < 60 KB adicionais gz fora o shader opcional.
- **A11y:** versão em lista é a "verdade" (já existe em `/lobbies`); a cidade é a mesma informação em outra forma, com `role="img"` + resumo textual e todos os andares focáveis por teclado.
- **Risco de kitsch: baixo-médio.** Cai no kitsch se virar "ilustração gigante demais"; mantenha a cidade **como dado**, não como pano de fundo decorativo, e nunca desenhe edifícios reconhecíveis da Valve (nada de Empire State sob o Maelstrom; use setbacks genéricos).

### Conceito 2: A Gazeta (recomendado como voz)

**Pitch.** Um jornal dos anos 1920 inventado por nós (nome próprio, por exemplo "A Gazeta do Círculo"; **não** usar nome de jornal do jogo). A primeira página tem: manchete principal ("Lobby de Círculo Profano lota em 4 minutos"), colunas com texto de verdade (patch notes viram matérias), **classificados** (cada lobby aberto é um anúncio: "PROCURAM-SE 3 jogadores, BR/SA, 22 ms"), **cotações** (ranking como bolsa de valores, ligando com o clima ocultista-financeiro) e uma **charge** (arte própria). Textura de papel, tinta com leve registro desalinhado, imagens em halftone. É um **site de texto que parece caro**, e dá ao pt-BR espaço para humor.

- **Telas que muda:** Novidades (vira a edição do dia, com seções e data de edição), Início (faixa "últimas do dia" ao vivo), página do modo ("reportagem" com box de regras), 404 (página rasgada), rodapé (expediente com ficha técnica e aviso "não afiliado à Valve").
- **Interação-assinatura:** **a manchete é um dado vivo** (muda com os números reais); passar o mouse numa foto revela o halftone se transformando em imagem; "virar a página" entre Novidades por View Transition (papel que desliza).
- **Paleta/tipo:** papel `#e9dfc8` / tinta `#17130d` no tema claro; no escuro, "jornal à luz de lampião" (papel carvão-sépia, texto creme, latão para manchete). Manchete em UnifrakturMaguntia **só no cabeçalho** (nome do jornal), títulos em Old Standard TT ou Playfair Display, texto em Libre Franklin ou Old Standard para o corpo longo; fio duplo déco como separador de colunas.
- **Técnicas:** halftone/dither em CSS/shader, grão de papel, tipografia variável, View Transitions, microcopy irreverente (referência de voz: s&box e Balatro).
- **Desempenho:** praticamente zero custo (CSS e imagens). Risco só em imagens grandes: usar AVIF/WebP e `loading="lazy"`.
- **A11y:** jornal de múltiplas colunas atrapalha leitura em telas pequenas: **uma coluna no móvel**, ordem de leitura = ordem do DOM; textos longos em fonte legível; contraste checado em papel sépia.
- **Risco de kitsch: médio.** O perigo é "pergaminho Halloween" (bordas queimadas, fonte medieval em tudo). Evite: sem rasgos fakes em todo canto, sem Fraktur no corpo, sem sépia puro; use **impressão limpa de jornal**, e deixe a graça no texto.

### Conceito 3: O Círculo Ritual

**Pitch.** Cada lobby é um **círculo de sigilos** com 12 (ou N) lugares. Jogadores entrando acendem os sigilos; quando fecha o círculo, o lobby "dispara" e o jogo abre. A home tem **um círculo grande no centro, ao vivo**, mostrando o lobby mais próximo de completar ("faltam 2 para fechar"). Casa direto com o modo existente "Círculo Profano". Ideal como **tela de espera** do lobby (em vez de spinner).

- **Telas que muda:** Início (hero), detalhe de lobby (sala de espera), página do modo "Círculo Profano" (hero próprio), Instalar (anel de progresso do download).
- **Interação-assinatura:** **o círculo se preenche e gira devagar**, com rastro de luz latão; arrastar o círculo gira o anel de filtros (região, modo, vagas) como um disco de cofre.
- **Paleta/tipo:** latão sobre pátina-preto, verdete para amigos; tipografia estreita para os rótulos em volta do círculo; sigilos gerados com semente (cada lobby tem o seu, determinístico a partir do id).
- **Técnicas:** SVG generativo, `conic-gradient` e `stroke-dashoffset` para o preenchimento, cursor planchete opcional, som opt-in de "sino" ao fechar.
- **Desempenho:** baixo (SVG).
- **A11y:** o círculo é decorativo + `aria-label`/`aria-live="polite"` ("9 de 12 lugares ocupados"), e o filtro-disco tem equivalente em `<select>`/botões.
- **Risco de kitsch: alto.** É o mais "fantasia ocultista". Funciona melhor **como detalhe** (espera de lobby, página de um modo) do que como linguagem do site inteiro; para evitar pastiche, desenhar sigilos geométricos abstratos (déco), não pentagramas explícitos.

### Conceito 4: O Tarô dos Modos

**Pitch.** Cada modo vira **uma carta** (retrato, número romano, nome embaixo, moldura própria por categoria). A página de modos é um **leque/espalhamento** (spread) que o usuário pode "abrir"; passar o mouse inclina a carta em 3D com brilho holográfico sutil; clicar **vira a carta** e ela vira a página do modo (View Transition). Hospedar um lobby é "tirar uma carta" do baralho; o resultado aleatório de "jogar com bots" pode ser uma carta. Cartas de baralho e tarô de Marselha/RWS (1909) são gramática pública.

- **Telas que muda:** Modos, Início (modos em destaque), detalhe do modo (verso da carta = regras), Hospedar (escolha de carta).
- **Interação-assinatura:** giro 3D da carta + transição "carta vira página"; arrastar para espalhar as cartas, `Enter`/`Espaço` para virar (teclado).
- **Paleta/tipo:** fundo de feltro verde-pátina, cartas em creme com tinta e um acento de latão; numeração romana em Limelight ou Poiret One; ilustração própria (hoje a arte dos modos é linha em SVG; precisa evoluir para gravura/halftone).
- **Técnicas:** tilt + holo em CSS (referência: https://poke-holo.simey.me/), View Transitions, ornamento generativo, grão.
- **Desempenho:** baixo; cuidado com muitas cartas com filtros e sombras ao mesmo tempo (limitar a ~12 animadas).
- **A11y:** tilt só com ponteiro fino e sem `prefers-reduced-motion`; carta sempre acessível por teclado, com `button` real e leitura de nome e resumo; contraste do texto sobre o brilho.
- **Risco de kitsch: alto.** Tarô é um território muito batido (e Grail/Balatro já fizeram "cartas"); só funciona com **ilustração de verdade e um sistema de moldura coerente**. Funciona como **componente** (o "card de modo") mais que como metáfora do site.

### Conceito 5: Em Cartaz (marquise e cartaz de vaudeville)

**Pitch.** O site é a **fachada de um teatro**: marquise com lâmpadas de latão que piscam em sequência, cartazes de tipo de madeira (condensada pesada) anunciando "HOJE: Círculo Profano, 22h, lotação 12" e "sessões" que são os lobbies. É tipografia pura: cartaz grande, listras, selo "ÚLTIMAS VAGAS". Dá bastante identidade com pouquíssimo peso, e o público brasileiro entende cartaz de cinema/circo.

- **Telas que muda:** Início (marquise no hero), Lobbies ("programação do dia"), Novidades ("próximas atrações"), Instalar ("bilheteria").
- **Interação-assinatura:** **lâmpadas que acendem em onda** quando um lobby enche; "SOLD OUT" (lotado) carimbado na hora; o botão Entrar é "Comprar ingresso" (gratuito, e a ironia pode ser parte da voz).
- **Paleta/tipo:** latão e rubi escuro (usar o vermelho só como "ferrugem" do README), creme; Big Shoulders Display / Bebas Neue / Anton para cartaz; Libre Franklin no resto.
- **Técnicas:** `radial-gradient` + `box-shadow` para lâmpadas, brilho emissivo, tipografia cinética, grão; zero WebGL.
- **Desempenho:** muito baixo.
- **A11y:** lâmpadas piscando podem violar limite de flash (WCAG 2.3.1: nada pisca mais de 3 vezes por segundo): manter ondas lentas e parar com reduced-motion.
- **Risco de kitsch: médio-alto.** Pode virar "Las Vegas" ou "circo". Segura com **contenção**: uma marquise só (hero), cartazes em tipografia, não em ilustração; sem neon colorido.

### Comparação

| Conceito | Distintivo | Custo de desempenho | Esforço | Casa com o produto | Kitsch |
| --- | --- | --- | --- | --- | --- |
| 1 Cidade Acesa | alto | baixo-médio | M-L | **muito** (dado ao vivo, já existente no v2) | baixo-médio |
| 2 Gazeta | alto | quase zero | M | muito (voz, patch notes, ranking) | médio |
| 3 Círculo Ritual | médio-alto | baixo | M | bom como detalhe | alto |
| 4 Tarô dos Modos | médio | baixo | M-L (arte) | bom como componente | alto |
| 5 Em Cartaz | médio-alto | muito baixo | S-M | médio (lobby = sessão) | médio-alto |

---

## 6. Recomendação

**1. Cidade Acesa (espinha visual) + 2. Gazeta (voz e páginas de texto).** Motivos:

1. **É o único conceito em que o produto É a imagem.** Os lobbies ao vivo, que já são o melhor ativo do site, viram o cenário. Ninguém mais (nem a Valve, nem um mod hub genérico) tem isso, e não depende de arte do jogo.
2. **Cabe no público brasileiro:** SVG/canvas 2D, poucos KB, sem three.js; o shader de névoa é opcional e só no desktop.
3. **Não colide com o IP:** o site oficial é postal/guia do visitante, laranja sobre carvão, com fontes próprias. A nossa cidade é déco noturno com latão e verdete, uma gazeta inventada por nós, e tipografia livre.
4. **A Gazeta dá o que falta ao pt-BR: personalidade.** Custa quase nada em desempenho, resolve Novidades (a página mais "seca" por natureza) e permite humor de comunidade (referência de tom: https://sbox.game/ e o banner de cookies do Balatro).
5. **Elementos dos outros conceitos entram como componentes**, sem virar metáfora global: o **Círculo** na sala de espera do lobby e na página de "Círculo Profano"; a **carta** no card de modo; a **marquise** só em momentos de celebração (lobby lotado).

### Plano em fases (cada fase entrega valor sozinha)

| Fase | Entrega | Esforço |
| --- | --- | --- |
| 0 (quick wins, sem mudar estrutura) | Trocar a fonte de títulos (sair de Jost), grão em PNG, brilho emissivo no latão e nas janelas acesas, microcopy com voz, selos/carimbos, 404 desenhada | 1 a 3 dias |
| 1 | Cidade Acesa no hero da Início: SVG gerado a partir dos dados, janelas que acendem em tempo real, alternância "cidade/lista" em Lobbies | 1 a 2 semanas |
| 2 | Gazeta: Novidades como edição, manchete viva na Início, expediente e 404 no rodapé | 1 semana |
| 3 | Card de modo estilo carta com tilt e transição "carta vira página"; Círculo na sala de espera do lobby | 1 a 2 semanas |
| 4 (opcional) | Névoa em shader no desktop, som opt-in | 3 a 5 dias |

### Princípios para não virar kitsch

- **Um** ornamento, **uma** textura, **uma** cor de acento por tela (a regra do v2 continua valendo, agora com mais matéria).
- Sempre texto limpo por cima: o efeito vai no fundo e nas bordas, nunca atrás de parágrafos.
- Humor seco e curto, nunca "mística de cosplay" em todos os rótulos. Termos de UI continuam diretos ("Entrar", "Hospedar").
- Toda animação: `prefers-reduced-motion`, botão de pausa, equivalente estático.

---

## 7. Lista completa de URLs consultadas

**Deadlock (visual e lore)**
- https://www.playdeadlock.com/cityneversleeps (inspeção direta)
- https://en.wikipedia.org/wiki/Deadlock_(video_game)
- https://deadlock.wiki/Lore e https://deadlock.wiki/Help:Font (wiki de fãs, secundária)
- https://www.ninjarefinery.com/deadlock-understanding-the-world/ (secundária)
- https://www.destructoid.com/latest-deadlock-overhaul-turns-valves-not-so-mysterious-game-into-one-of-the-most-stylish-titles-of-all-time/
- https://www.pcgamesn.com/deadlock/patch-notes-new-heroes-visual-overhaul
- https://finalboss.io/deadlock-old-gods-new-blood-ushers-in-the (resumo de busca)

**Sites de jogo e plataforma**
- https://www.hauntedbouldercity.com/ , https://www.awwwards.com/sites/haunted-boulder-city
- https://www.playbalatro.com/
- https://www.cultofthelamb.com/ , https://fontsinuse.com/uses/77885/cult-of-the-lamb-video-game
- https://grail-app.com/ , https://www.awwwards.com/sites/grail
- https://www.dontlookup.app/ , https://www.awwwards.com/sites/dont-look-up-game
- https://www.awwwards.com/sites/huxley-saga
- https://awwwards.com/sites/riot-games-star-guardian
- https://lusion.co/
- https://sbox.game/
- https://www.supergiantgames.com/games/hades-ii/ , https://www.hollowknightsilksong.com/ , https://playvalorant.com/pt-br/
- https://www.awwwards.com/websites/games/ (lista de jogos, consulta de hoje)

**Técnicas e suporte**
- https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/
- https://web-platform-dx.github.io/web-features-explorer/features/view-transitions/
- https://web-platform-dx.github.io/web-features-explorer/features/cross-document-view-transitions/
- https://web-platform-dx.github.io/web-features-explorer/features/scroll-triggered-animations/
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- https://react.dev/reference/react/ViewTransition e https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more
- https://en.wikipedia.org/wiki/WebGPU
- https://w3c.github.io/wcag/understanding/animation-from-interactions
- https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/ , https://github.com/mblode/dither-3d
- https://shaders.paper.design/smoke-ring , https://shaders.paper.design/grain-gradient
- https://css-tricks.com/?p=351302 (grão com feTurbulence)
- https://poke-holo.simey.me/ , https://radio.garden/
- https://gs.statcounter.com/os-market-share/mobile/brazil (dado vindo da busca, não aberto)
