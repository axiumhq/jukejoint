# Pesquisa de direção de arte: a âncora igloo.inc e o resto do mundo

*02/11/2026. Pedido: um site que, ao abrir, faça a pessoa pensar "caraca, esse serviço é muito bem feito". Mais marcante que o site do próprio Deadlock, único, intuitivo, bonito e sem cara de IA. Nada do site foi alterado: o protótipo v3 em `web/` (React 19.3, Vite 8, sem three.js) só foi lido e aberto em `localhost:5173`.*

**Direção do usuário durante a pesquisa:** o usuário gostou muito de https://www.igloo.inc/ e quer ver o site "naquele estilo". Por isso o igloo.inc é a **âncora** deste documento (seções 1 a 3). O resto da pesquisa (regras anti-slop, outros sites de jogo, art déco e ocultismo, tipografia, movimento e os 4 conceitos de hero) continua valendo, agora a serviço dessa direção.

**Método.**
- Abri 10 sites no navegador embutido, a 1440×900 (e o igloo.inc também a 375×812). Em cada um medi, com um script no console, as fontes calculadas, as cores mais frequentes, a contagem de `canvas`, `video` e `svg`, a altura da página e os bytes pela Resource Timing API. Também tirei capturas de tela.
- Li os documentos anteriores (`avaliacao-v3.md`, `pesquisa-referencias.md`, `direcoes.md`). Carreguei as skills `design-taste-frontend` e `frontend-design` para os critérios anti-slop. As notas do `impeccable` vieram da avaliação v3.
- Para fontes, baixei os metadados oficiais do Google Fonts (`fonts.google.com/metadata/fonts`, 1.959 famílias), com eixos variáveis, data de inclusão e posição de popularidade. Medi o gzip de bibliotecas 3D direto do jsDelivr.

**Limites (leia antes de confiar):**
- **Bytes medidos são pisos, não totais.** A Resource Timing devolve 0 para arquivos de outro domínio sem `Timing-Allow-Origin`. Por isso indico, em cada site, quantos pedidos ficaram sem medida. No igloo.inc nenhum ficou sem medida, então ali o número é confiável.
- **Não consegui percorrer todas as cenas do igloo.inc.** A rolagem é virtual (a página tem `overflow: hidden` e 900 px de altura), e os eventos de roda que mandei avançaram pouco a câmera. As cenas internas foram reconstruídas pelos nomes dos arquivos carregados, pelo estudo de caso oficial do Awwwards e por um clone público que se declara "inspirado" no site (fonte secundária, marcada como tal).
- `playdispatch.com` foi recusado pelo navegador; Dispatch, Split Fiction, Hades II, Silksong e Balatro não foram reabertos (os três últimos estão medidos em `pesquisa-referencias.md`).
- Não é parecer jurídico sobre direito autoral ou marca.

---

## 0. Resumo executivo

**Veredito.** O igloo.inc funciona por **uma** ideia executada com obsessão: um objeto monolítico, iluminado por dentro, num mundo monocromático, percorrido por uma câmera que obedece à rolagem. Em volta, uma camada mínima de texto técnico em mono nos quatro cantos e som desenhado para cada gesto. Ele **não** funciona por ter "muito 3D". A tradução para nós já existe em semente no v3: **a torre déco é o dado**. Cada andar é um lobby e cada janela acesa é um jogador. No v3 ela é SVG chapado; na nova direção vira o objeto 3D do igloo, feito de obsidiana, latão e luz de sódio, com névoa.

**O que copiar e o que não copiar do igloo.inc:**
- **Copiar:** o objeto único, a luz vinda de dentro, a câmera presa à rolagem, a interface em mono nos cantos, o embaralhamento de texto, o som opcional e as transições com aberração cromática.
- **Não copiar:** o texto todo desenhado em WebGL (o DOM do igloo tem 220 caracteres; leitor de tela e buscador não leem nada), a rolagem virtual e os ~15 MB baixados até nos celulares.

### As 10 regras anti-slop e de ofício deste projeto

1. **Uma ideia, gasta num lugar só.** A torre acesa é o momento memorável; o resto fica quieto e disciplinado.
2. **Toda imagem nasce de dado real.** Andar = lobby, janela = vaga, luz = gente. Nada de painel falso, número inventado ou "1.284 jogando" sem backend.
3. **Nenhuma seção de template.** Proibidos: "3 passos" numerados, 3 ou 4 cards iguais, rótulo em caixa-alta acima de cada título, faixa de estatísticas e herói centralizado com brilho atrás. Cada seção usa uma família de layout diferente.
4. **Tipografia com contraste de verdade.** O título fica pelo menos 3× maior que o texto, com no máximo 2 linhas no hero e apoio de até 20 palavras. Rótulos em caixa normal, e nada de uma palavra só destacada em itálico ou em cor.
5. **Luz é material, não efeito.** Nada de brilho radial solto, card de vidro fosco ou borda fina com sombra larga. A luz sai de uma fonte na cena (janela, poste, frestas do latão), e a sombra tem a cor do ambiente.
6. **Movimento com motivo.** Uma abertura orquestrada; o resto do movimento responde a gestos. Molas interrompíveis, nada de "surgir de baixo" em cada seção, e movimento reduzido como versão desenhada, não como site quebrado.
7. **Texto é HTML, sempre.** O WebGL é cenário (`aria-hidden`). Título, lista de lobbies e botões são DOM real, legíveis, indexáveis e focáveis. É aqui que superamos o igloo.
8. **Ofício nos lugares chatos.** Carregamento, 404, vazio, erro, aviso de cookies, foco do teclado, números tabulares, aspas curvas e reticências (…) também levam a voz do site.
9. **Imagem própria.** Blender, shader e SVG gerado por código. Nada de banco de imagem, imagem de IA, arte, logo ou fonte da Valve, nem nome próprio do jogo como marca.
10. **Desempenho também é design.** Orçamento por nível de aparelho, LCP em HTML com pôster leve, 3D carregado depois e teste num Android de entrada. Um site lindo que trava no Moto G não impressiona ninguém.

### As 3 referências que mais importam (uma ideia cada)

1. **igloo.inc** (Abeto + Bureaux; Site of the Year e Developer Site of the Year 2024 no Awwwards). **Um monólito aceso por dentro, percorrido pela rolagem**, com interface em mono e som.
2. **ARC Raiders** (arcraiders.com). **O estado ao vivo do jogo na home:** um bloco "Map Conditions" com eventos por mapa e contagem regressiva (`36:53`). O site vira painel do mundo, que é exatamente o nosso produto.
3. **Marathon** (marathonthegame.com). **Um sistema gráfico vira identidade:** o nome em vertical num trilho lateral verde-ácido `#C0FE04`, microtipografia em mono (`ppFraktionMono`), colchetes `[↗]` nos links e um botão de pausa no vídeo. Prova de que a interface técnica pode ser a marca.

### Par tipográfico recomendado

**Big Shoulders** (títulos e números; variável `opsz 10-72`, `wght 100-900`, com cortes Inline e Stencil) + **Martian Mono** (camada técnica, rótulos e embaralhamento; variável `wdth 75-112.5`, `wght 100-800`) + **Libre Franklin** só para leitura longa (já no v3; Franklin Gothic é de 1902, da mesma era do cenário). Detalhes e alternativas na seção 7.

### Os 4 conceitos de hero (uma linha cada)

- **A. A Torre Acesa (escolhido):** a torre déco em WebGL, na névoa, com andares que são lobbies ao vivo; a rolagem separa os andares como o iglu "explodido".
- **B. A Marquise:** o título é escrito por centenas de lâmpadas que mostram números reais, com uma onda de luz quando um lobby lota.
- **C. O Livro-Caixa:** um livro de registros ocultista que se escreve sozinho com cada entrada em lobby, só com HTML e CSS.
- **D. A Relíquia:** um loop renderizado no Blender (um relógio-sigilo de latão) com pontos clicáveis e paralaxe por mapa de profundidade.

**Escolha: A**, com D como pôster de carregamento e fallback (é a mesma cena renderizada no Blender) e B como micro-momento de celebração ("lotou").

---

## 1. igloo.inc desmontado

### 1.1 Ficha

| Item | Dado | Fonte |
|---|---|---|
| Cliente | Igloo Inc., controladora da Pudgy Penguins | Estudo de caso no Awwwards: https://www.awwwards.com/igloo-inc-case-study.html |
| Autores | Abeto (desenvolvimento, arte técnica) com Bureaux (direção criativa, renders, música e efeitos sonoros) | Idem |
| Prêmios | Site of the Year e Developer Site of the Year 2024 (anunciado em março de 2025) | https://x.com/awwwards/status/1901665664332435526 e https://x.com/abeto_co/status/1900152588768579701 |
| Stack declarada | Three.js, three-mesh-bvh, Svelte, GSAP, Vite, JavaScript puro | Estudo de caso |
| Ferramentas | Houdini e Blender (3D e texturas), Figma, Photoshop, Affinity (interface), DaVinci Resolve (som), mais ferramentas próprias: exportador de volume (VDB) e simulação de fluido | Estudo de caso |
| Versão do three.js | r165 (`window.__THREE__ = "165"`) | Medido por mim |

### 1.2 O que medi (desktop, 1440×900, cache vazio, 6 s depois de abrir)

| Medida | Valor |
|---|---|
| Pedidos | 94 (nenhum sem medida) |
| Total transferido | **~15,0 MB** |
| Texturas KTX2 (Basis) | ~10,5 MB em 45 arquivos. As maiores: `scroll-datatexture` 1,26 MB, `cube3_normal` 1,1 MB, `cube1_normal` 1,05 MB, `igloo_exploded_color` 823 KB e `volumes/peachesbody_64` 817 KB, uma textura de volume 64³ |
| Geometria Draco (`.drc`) | ~543 KB em 20 arquivos; a maior é `igloo.drc` (217 KB) |
| Áudio OGG | ~2,9 MB em 18 arquivos: `music-highq` (1,49 MB), `room` (596 KB), `wind` (560 KB) e 15 efeitos de 3 a 61 KB (`beeps`, `click-project`, `enter-project`, `leave-project`, `shard`, `circles`, `particles`, `ui-short`, `ui-long`, `logo`, `manifesto`…) |
| JS | `App3D` 413 KB gzip (1,45 MB descomprimido), mais Draco (wasm 83 KB), Basis (wasm 225 KB) e workers próprios: `msdfworker`, `exrworker`, `bitmapworker`, `audioworker` (77 KB) |
| Fonte | IBM Plex Mono Medium, não como arquivo de fonte e sim como **atlas SDF** (`IBMPlexMono-Medium-datatexture.ktx2` + `.json`) desenhado em WebGL |
| DOM | `body` com **220 caracteres** de HTML: um `div#app` com um `div#webgl` vazio. `body { overflow: hidden }`, altura 900 px, nenhum `canvas` visível na árvore (provavelmente dentro de shadow root fechado) e nenhum texto em HTML. Só a `meta description` existe para buscadores |
| Celular (375×812, UA Android) | Pediu a **mesma lista de 94 arquivos**, inclusive os 18 áudios; não vi um conjunto de assets próprio para celular. A câmera é reenquadrada em retrato e mostra o iglu "explodido", com números e linhas de constelação entre os blocos |

**Leitura técnica dos nomes de arquivo** (inferência minha, plausível mas não confirmada pelo autor):
- `scroll-datatexture`, `frost-datatexture`, `logo-datatexture`, `numbers-datatexture`: dados de animação e de transição guardados em texturas e lidos no shader.
- `volumes/*_64` e `medium_32`: volumes 3D (os personagens "dentro do gelo") renderizados por raymarching ou por fatias.
- `caustics`, `bokeh`, `blue-8-128-rgb` (ruído azul para dither), `clouds_noise`, `wind_noise`, `perlin-datatexture`: o "ar" da cena é feito de ruído pré-calculado, não de geometria.
- `igloo_exploded_color`: o iglu tem dois estados assados (montado e explodido), e a rolagem interpola entre eles.

### 1.3 A gramática visual

**Cena e objeto.**
- Um iglu de blocos de gelo num vale de neve, em tons quase monocromáticos de cinza-azulado.
- As frestas entre os blocos **emitem luz branca**: o objeto parece aceso por dentro.
- Ao rolar, os blocos sobem e se separam (estado "explodido"), ganham números (`07`, `26`, `41`) e uma constelação de linhas finas entre eles.
- Depois a câmera entra num espaço interno (`room.ogg`, `floor`, `ceilingsmoke`), onde cada projeto do portfólio é um **bloco de gelo com o personagem dentro**, cada um de desenho único. O estudo de caso conta que eles escreveram um algoritmo procedural que simula o crescimento de cristais de gelo dentro de uma forma base, porque blocos iguais "pareciam parecidos demais ao rolar".
- O rodapé de links é uma **simulação de partículas** que gira e assume a forma de cada link selecionado, com cor que muda com a velocidade e som sincronizado.

**Camada de interface (o que dá o ar "técnico").**
- **Layout de quatro cantos**, sem nada no centro:
  - em cima à esquerda, o logotipo, `// Copyright © 2026` e `Igloo, Inc. All Rights Reserved.`;
  - em cima à direita, `////// Manifesto` com 20 palavras alinhadas à direita;
  - embaixo à esquerda, `Scroll down to discover.` e `Sound: Off` com ícone.
- **Uma fonte só** (IBM Plex Mono Medium), corpo pequeno (cerca de 12 a 14 px) e **caixa normal**. Os prefixos `//` e `//////` viram ornamento tipográfico de código.
- **Texto que se embaralha** antes de assentar. O estudo de caso explica que trocam as letras deslocando o offset da textura SDF, para evitar o recálculo de estilo que mudar texto em HTML provoca. Também usam *glitch* por shader, sem máscara de CSS.

**Transições.** O estudo de caso cita mistura de **aberração cromática**, "deslocamento técnico" e **efeito de geada**. Nas capturas a aberração aparece nas bordas do primeiro plano, com franjas de cor no chão desfocado.

**Introdução.** É animada "no motor", em tempo real, com código e shaders, e não em vídeo pré-renderizado, para economizar peso e emendar sem corte no resto do site. A equipe acrescentou uma abertura "tecnológica" porque temia que uma cena só ao ar livre não passasse o tom "voltado ao futuro" da marca.

**Som.** O padrão é desligado (`Sound: Off`). Há uma trilha (1,5 MB), duas ambiências (vento e sala) e 15 efeitos curtos, um por tipo de gesto: entrar e sair de projeto, clique, estilhaço, círculos, partículas, texto do projeto e logo.

**Processo (vale copiar).** Primeiro maquetes cinzas e rascunhos da jornada. Depois uma "previs" (animações rápidas sem textura) para as partes difíceis de desenhar. Código e arte 3D andam juntos no navegador, com ferramentas próprias que atualizam shaders, texturas e modelos em tempo real. Fonte: estudo de caso.

### 1.4 O que NÃO copiar

| Escolha do igloo | Por que não serve para nós | O que fazemos no lugar |
|---|---|---|
| Todo texto em WebGL (SDF) | O DOM vazio deixa leitor de tela, tradução automática, busca, `Ctrl+F` e seleção de texto sem nada. Para um site de portfólio é aceitável; para um produto com lista de lobbies, não | HTML real por cima do canvas. Embaralhamento feito em HTML com fonte mono (largura fixa, sem reflow) e `aria-label` com o texto final |
| Rolagem virtual (`overflow: hidden`) | Quebra rolagem por teclado, âncoras, "voltar" com posição e acessibilidade | Rolagem nativa do documento. A câmera **persegue** a posição da rolagem com amortecimento, o que dá a mesma suavidade sem sequestro |
| ~15 MB, inclusive no celular | O público é Android de faixa média e baixa no Brasil (cerca de 75% dos acessos móveis, segundo o StatCounter citado em `pesquisa-referencias.md`) | Orçamento por nível de aparelho (seção 3.4): cerca de 1/5 do peso no desktop e cerca de 1/12 no celular |
| 2,9 MB de áudio baixados antes do clique | Gasta dados de quem nunca liga o som | Áudio só depois de "Ligar som" (o navegador já exige gesto para tocar: https://developer.chrome.com/blog/autoplay) |
| Sem alternativa estática verificada | Não confirmei comportamento com `prefers-reduced-motion` | Versão com movimento reduzido desenhada de propósito (seção 3.3) |

### 1.5 Lições transferíveis (as que importam)

1. **Um objeto, um mundo, uma luz.** O mundo é quase monocromático para que a única cor (a luz das frestas) mande na hierarquia.
2. **O objeto tem estados que contam a história:** montado, explodido e por dentro. A rolagem é o controle entre os estados.
3. **Variação procedural dentro de um sistema:** blocos únicos gerados por algoritmo, não desenhados um a um.
4. **A interface técnica é decoração funcional:** mono, cantos, prefixos, números nos objetos e linhas de ligação. Nada de cartão, sombra ou gradiente.
5. **Som por gesto, desligado por padrão.**
6. **Ruído e dados em textura no lugar de geometria pesada.** Névoa, cáusticas e bokeh vêm de texturas pequenas.

---

## 2. Tradução para o nosso tema: A Torre

### 2.1 A ideia central em uma frase

**Uma torre art déco de obsidiana e latão, sozinha numa cidade apagada pela névoa, acesa por dentro pelos jogadores que estão nela agora.** Cada andar é um lobby aberto, cada janela é uma vaga, e a luz de sódio que vaza pelas frestas é gente. A rolagem desce do céu até o porão: torre, andares separados, cofre dos modos, elevador (como funciona), cartório (instalar e confiança) e a rua com a gazeta voando (novidades e rodapé).

Por que a torre e não outra coisa:
- **O recuo escalonado é história de Nova York.** A lei de zoneamento de 1916 limitou a massa máxima dos prédios e obrigou os recuos que criaram a silhueta "bolo de noiva" dos anos 1920 a 1950 (Skyscraper Museum: https://skyscraper.org/skyline/impact-of-1916-zoning/; Cooper Hewitt: https://si.edu/object/study-maximum-mass-permitted-1916-new-york-zoning-law-stage-4%3Achndm_1969-137-4).
- No nosso caso, **quem dita os recuos é o dado** (vagas e lotação), como já acontece no v3. A metáfora tem raiz histórica e é nossa, não da Valve.
- Hugh Ferriss desenhou esses envelopes em carvão, de noite e na névoa (*The Metropolis of Tomorrow*, 1929). É a referência de luz e de clima mais exata para a cena; veja a seção 6.

### 2.2 Igloo → nós

| igloo.inc | A Torre (nosso) |
|---|---|
| Iglu de blocos de gelo | Torre déco de recuos, com andares modulares de obsidiana (vidro preto) e frisos de latão |
| Luz branca saindo entre os blocos | Luz de **sódio** (âmbar quente) saindo pelas janelas e pelas frestas dos frisos; janelas de **verdete** para amigos (regra do v3: latão = gente, verdete = amigo) |
| Vale de neve monocromático | Cidade apagada: silhuetas de prédios genéricos sem luz, telhados com caixas d'água, neblina baixa e asfalto molhado refletindo a torre |
| Iglu "explodido" com números | Andares que se **separam** e flutuam, cada um com etiqueta mono: `Andar 07 / Círculo Profano / 9 de 12 / BR 22 ms`, e linhas finas ligando andares do mesmo modo |
| Blocos de gelo com personagem dentro | **Cartas-relicário:** 6 lâminas altas de vidro fumê com moldura de latão; dentro, o motivo do modo (anel, trilho, névoa, relógio, cofre, grade) em volume ou planos em camadas |
| Partículas que formam o link | **Fuligem e papel:** partículas que formam o sigilo de cada destino do rodapé (Discord, Gazeta, código-fonte) |
| `// Copyright`, `////// Manifesto` | Prefixos próprios da era: `№`, `§` e o fio duplo déco `═`, em vez de `//` de código |
| Texto que se embaralha | Texto que se **decifra**: as letras passam por glifos de sigilo antes de assentar (cifra ocultista em vez de "hacker") |
| Aberração cromática e geada | Aberração cromática leve + **chuva no vidro** ou **fumaça** como transição entre cenas |
| Vento, sala, bipes | Chuva fina, zumbido de lâmpada de sódio, campainha de elevador, clique de interruptor de baquelite, máquina de escrever no livro-caixa e sino quando um lobby lota |

### 2.3 Materiais, luz e paleta

**Materiais (todos em `MeshStandardMaterial` ou `MeshPhysicalMaterial` com shader próprio onde indicado):**

| Material | Receita | Uso |
|---|---|---|
| **Obsidiana** | Base quase preta azulada, rugosidade 0,15-0,25, metalicidade 0, borda com fresnel puxando para o céu, reflexo de um HDR noturno pequeno (256 px) | Corpo da torre, cartas-relicário |
| **Latão escovado** | Metalicidade 1, rugosidade 0,3-0,45, cor quente, mapa de rugosidade com riscos verticais | Frisos, cornijas, coroa, moldura das cartas, placa do cartório |
| **Verdete** | Máscara de ruído sobre o latão nas reentrâncias (AO assada no Blender), cor verde-azulada fosca | Pátina; também é a cor do "amigo" |
| **Luz de sódio** | Emissivo âmbar (por volta de 2000 K) com bloom barato; nas janelas, **interior mapping** (salas falsas atrás do vidro por shader, sem geometria: https://joostdevblog.blogspot.com/2018/09/interior-mapping-real-rooms-without.html) | Janelas ocupadas, postes |
| **Névoa** | Neblina por altura + ruído 3D em textura, cor amostrada do céu | Mundo inteiro; esconde a cidade e baixa o custo de desenhar distância |
| **Asfalto molhado** | Plano com reflexo de baixa resolução e normal de chuva animada | Primeiro plano da cena 1 |

**Paleta (tokens propostos para a cena; ajustar com contraste medido):**

| Token | Hex | Papel |
|---|---|---|
| `--noite` | `#0D1218` | Céu e fundo. Azul-preto com matiz real, não `#0B0B0B` |
| `--asfalto` | `#1A2027` | Superfícies próximas, painéis do overlay |
| `--neblina` | `#6E7B86` | Cor da névoa e do texto secundário sobre a noite |
| `--sodio` | `#F0A040` | **A** cor de luz: janelas, ação primária. Mais amarela que o laranja `#DD6638` do site oficial (não colide) |
| `--verdete` | `#5FB3A1` | Amigos e "ao vivo" |
| `--osso` | `#E8E2D6` | Texto principal |

A regra do igloo vale para nós: **mundo monocromático e uma luz só.** O sódio é a única cor quente na tela; o verdete aparece em pontos contados.

### 2.4 Storyboard (7 cenas)

Convenções:
- **Câmera** = o que a rolagem faz.
- **Overlay** = HTML real por cima do canvas (texto de exemplo em pt-BR; o nome "PROJETO" é provisório).
- **Reduzido** = versão para `prefers-reduced-motion` e aparelho fraco.

#### Cena 0. Carregamento: "A cidade está acendendo"
- **Imagem:** tela `--noite`. O contorno da torre se desenha em fio de latão de 1 px, de baixo para cima. **O progresso do carregamento é a luz:** cada pacote de assets que chega acende um andar.
- **Overlay:** canto inferior esquerdo, em mono: `№ 0412 jogadores na cidade agora` (número real da API, decifrando). Nada de porcentagem genérica.
- **Duração:** no máximo 1,2 s em conexão boa. Se o 3D não chegar em 2,5 s, o pôster (Blender) entra e o 3D assume em silêncio quando estiver pronto.
- **Reduzido:** sem animação; o pôster aparece direto.

#### Cena 1. A Torre (hero)
- **Câmera:** baixa, em contra-plongée leve, a uns 30 m da torre. Deriva lenta de 2 a 3 graus (respiração). O ponteiro desloca a câmera no máximo 1,5 grau (paralaxe, não giro).
- **Ação de abertura (o "caraca"):** a torre está apagada. Em cerca de 1,5 s as janelas acendem **na ordem real em que os jogadores entraram**, de baixo para cima, com um "plim" visual de 600 ms por janela (o som só toca se estiver ligado). As frestas do latão acendem por último, como um circuito que fecha.
- **Overlay (layout de cantos, como o igloo, mas com hierarquia):**
  - **Em cima à esquerda:** marca e navegação curta.
  - **Embaixo à esquerda:** o **H1 em Big Shoulders**, em 2 linhas: "Modos da comunidade, / dentro do Deadlock." Abaixo, o apoio (13 palavras): "Escolha um andar aceso, entre no lobby e o jogo abre sozinho. Grátis." Botão primário em sódio: **"Achar partida"**.
  - **Em cima à direita:** um manifesto curto em mono (até 20 palavras).
  - **Embaixo à direita:** `Som: desligado`.
- **Interação:** tocar ou clicar numa janela acesa aproxima a câmera do andar e abre a etiqueta do lobby.
- **Reduzido:** pôster estático da torre acesa com as janelas em SVG por cima (o `CityScene` atual, reaproveitado) e o mesmo overlay.

#### Cena 2. Os andares (lobbies ao vivo)
- **Câmera:** sobe e recua. A torre **se separa em andares** que flutuam com 6 a 12 m de vão (o "iglu explodido"). A rolagem controla o quanto separa.
- **Cada andar:** ganha a cornija do motivo do modo (proposta J da avaliação v3) e uma etiqueta mono que se decifra quando entra em cena: `Andar 07 / Círculo Profano / faltam 3 / BR 22 ms`. Linhas finas de latão ligam andares do mesmo modo (a "constelação" do igloo vira "sociedade secreta").
- **Estados com forma:** em partida = persianas listradas; lotado = letreiro aceso; privado = cortina; o seu = moldura de verdete.
- **Overlay:** à direita, **a lista real de lobbies em HTML** (vista compacta da avaliação v3), sincronizada com a cena. Passar o mouse numa linha acende o andar e vice-versa. A lista é a verdade; a torre é a ilustração dela.
- **Reduzido:** só a lista, com o selo do modo (proposta A da avaliação v3).

#### Cena 3. O Cofre dos Modos
- **Câmera:** desce pelo poço da torre até o porão. Seis **cartas-relicário** de vidro fumê em semicírculo; a rolagem gira o semicírculo e traz uma carta por vez ao centro.
- **Dentro de cada carta:** o motivo do modo em luz (anéis, trilhos, névoa, relógio, cofre, grade), feito com planos em camadas ou volume barato. Cada uma tem desenho próprio, gerado por semente a partir do modo, como os blocos únicos do igloo.
- **Overlay:** nome do modo em display grande, uma frase de regra e "Ver 4 lobbies abertos" (número real). Clicar faz a carta "virar" para a página do modo (View Transition no HTML e câmera atravessando o vidro no 3D).
- **Reduzido:** as cartas de tarô 2D do v3, em lista.

#### Cena 4. O Elevador (como funciona), no lugar dos "3 passos"
- **Imagem:** a porta de um elevador déco com o **indicador de andar em meia-lua**, ponteiro de latão e numerais. A rolagem move o ponteiro por três paradas.
- **Overlay:** cada parada é um verbo, sem "Passo 1": **"Instale o app"** (Windows, 4 MB), **"Escolha um andar"** e **"O jogo abre sozinho"**. Na terceira parada a porta abre e mostra, dentro do elevador, **o lobby real mais perto de lotar**, com botão "Entrar".
- **Som:** campainha de elevador ao chegar em cada parada (se ligado).
- **Reduzido:** o indicador fica parado em cada estado, como três ilustrações em linha.

#### Cena 5. O Cartório (instalar e confiança)
- **Câmera:** close macro de uma **placa de latão gravada**, com luz rasante que corre pela gravação conforme a rolagem.
- **Gravado na placa:** versão, tamanho, data e hash SHA-256 do instalador. O texto é **HTML por cima** (selecionável e copiável); a placa é só o fundo.
- **Overlay:** "Baixar para Windows", a nota sobre antivírus que já existe em `/instalar` e o aviso de não afiliação à Valve.
- **Reduzido:** a placa como imagem estática.

#### Cena 6. A Rua (Gazeta e rodapé)
- **Câmera:** volta à rua, ao pé da torre. Folhas da Gazeta voam com o vento; ao parar a rolagem, a manchete do dia assenta no asfalto molhado.
- **Rodapé:** os links (Gazeta, Discord, código-fonte) viram **sigilos de fuligem**. Passar o mouse sobre um link faz as partículas formarem o sigilo dele (o rodapé de partículas do igloo).
- **Overlay:** rodapé completo em HTML.
- **Reduzido:** rodapé normal, sem partículas.

### 2.5 Voz do overlay (para não virar fantasia)

- **Rótulos técnicos em mono, caixa normal, curtos:** `Som: desligado`, `№ 0412 na cidade`, `Andar 07`, `faltam 3`.
- **Termos de ação sempre diretos:** "Achar partida", "Entrar", "Abrir lobby", "Baixar para Windows". O ocultismo fica na imagem, não no botão.
- **Evitar:**
  - "A cidade que nunca dorme": é o nome da atualização oficial do jogo (*City Never Sleeps*);
  - nomes próprios do jogo;
  - "desvende", "mergulhe", "eleve";
  - qualquer travessão como enfeite.

---

## 3. Plano técnico (React 19 + Vite 8)

### 3.1 Arquitetura

```
<body>
  ├─ <canvas> fixo, z-index abaixo, aria-hidden, pointer-events só onde há hotspots
  └─ <main> rolagem nativa
       ├─ <section data-cena="torre">     H1, apoio, CTA (HTML real)
       ├─ <section data-cena="andares">   lista real de lobbies
       ├─ <section data-cena="cofre">     modos (links reais)
       ├─ <section data-cena="elevador">  como funciona
       ├─ <section data-cena="cartorio">  instalar, hash
       └─ <footer  data-cena="rua">       links
```

- **Um canvas só**, fixo atrás do conteúdo. Cada `section` tem altura real e diz à cena "estou entre 0 e 1". A câmera segue uma curva (Catmull-Rom) e **amortece** em direção ao alvo, para não pular quando a rolagem pula.
- **O HTML é a fonte da verdade.** O 3D lê o mesmo estado (lobbies, modos) que a lista. Se o 3D falhar, nada se perde.

**R3F ou three.js puro?**

| | @react-three/fiber v9 (+ drei seletivo) | three.js puro num módulo isolado |
|---|---|---|
| Encaixe no projeto | O estado de lobbies já é React; o 3D lê o mesmo store sem ponte | Precisa de uma ponte (eventos ou store externa) |
| Ferramentas prontas | `useGLTF`, `useKTX2`, `Instances`, `PerformanceMonitor`, `AdaptiveDpr`, `Detailed` (LOD) | Escrever ou portar |
| Risco de desempenho | Re-render React no laço de quadro, se alguém usar `setState` por quadro | Nenhum, mas tudo é manual |
| Quem fez o igloo | (não usou) | Abeto usou three.js puro com Svelte |
| Peso extra | R3F + reconciler: cerca de 40 a 50 KB gzip (estimativa; medir no build) | 0 |

**Recomendação: R3F v9 + drei seletivo**, com três regras duras:
1. Nada de `useState` no laço; tudo por `ref` e `useFrame`.
2. A cena inteira num chunk `React.lazy` carregado **depois** do LCP.
3. `frameloop="demand"` quando a cena está parada (economiza bateria; ver https://r3f.docs.pmnd.rs/advanced/scaling-performance).

Se o protótipo mostrar custo de React no laço, a migração para three puro é localizada (só o chunk da cena).

**Pós-processamento:** evitar a biblioteca `postprocessing` inteira (o bundle publicado tem 610 KB, 151 KB gzip antes de tree-shaking, medido no jsDelivr). Escrever **um passe de composição próprio** (aberração cromática + grão + vinheta + bloom barato por mip) em um shader, ligado só nos níveis 2 e 3.

**Rolagem:** GSAP + ScrollTrigger (27 + 17 KB gzip, medidos) só para os gatilhos de cena e o *scrub*. **Sem Lenis e sem rolagem suave sequestrada:** a suavidade vem do amortecimento da câmera, e a página continua rolando como página. Nada de `window.addEventListener('scroll')`.

### 3.2 Texto que se decifra, em HTML

- O texto fica num `<span>` com fonte mono (Martian Mono). Como todas as letras têm a mesma largura, trocar letras **não muda o layout**: o mesmo ganho que o igloo buscou com SDF, sem perder o DOM.
- O texto final vai em `aria-label` (ou num irmão `visually-hidden`), e o `span` animado fica com `aria-hidden`.
- A animação dura 300 a 500 ms, roda **uma vez** por entrada em cena e é cortada por qualquer gesto. Com movimento reduzido, o texto aparece pronto.

### 3.3 Níveis de aparelho e alternativas

Detecção por **detect-gpu** (pmndrs), que classifica a GPU por benchmarks de FPS em níveis 0 a 3 (https://github.com/pmndrs/detect-gpu; o próprio README avisa que a base de dados parou de ser atualizada em dez/2025). Ela é combinada com:
- `prefers-reduced-motion`;
- `navigator.connection.saveData`;
- suporte a WebGL2;
- `deviceMemory` (só Chromium; usar como dica);
- e o `PerformanceMonitor` em tempo de execução, que **rebaixa** o nível se o FPS cair.

| Nível | Quem | O que roda |
|---|---|---|
| **3** | Desktop com GPU dedicada, notebook bom | Cena completa, DPR até 1,5, composição (aberração, bloom, grão), interior mapping, partículas (~30 mil), volumes nas cartas, som opcional |
| **2** | Android médio, notebook integrado | Mesma cena, DPR 1 a 1,25, **sem** composição (bloom falso por sprite), iluminação 100% assada, janelas instanciadas sem interior mapping, ~5 mil partículas, cartas com planos em camadas |
| **1** | Android de entrada, `saveData`, WebGL1 | **Sem 3D.** Pôster AVIF renderizado no Blender (a mesma torre) + camada SVG com as janelas ao vivo (o `CityScene` do v3) + paralaxe CSS de 2 ou 3 planos |
| **Reduzido** | `prefers-reduced-motion: reduce` | Como o nível 1, sem paralaxe e sem decifrar texto; troca de cena por corte seco. Um botão "Ligar animação" permite optar pela cena 3D parada (sem deriva) |

O nível 1 **não é "site quebrado"**: é a mesma direção de arte em 2D, com o mesmo dado ao vivo.

### 3.4 Orçamento de peso e de GPU

| Item | Nível 3 (desktop) | Nível 2 (Android médio) | Nível 1 |
|---|---|---|---|
| HTML + CSS + JS da casca (primeira pintura) | ≤ 150 KB gz (o v3 tem 112 KB) | igual | igual |
| Fontes (subconjunto latino, woff2) | ≤ 120 KB | ≤ 120 KB | ≤ 120 KB |
| Pôster do hero (LCP) | AVIF ≤ 120 KB | AVIF ≤ 70 KB (retrato) | AVIF ≤ 70 KB |
| Chunk 3D (three + R3F + cena) | ≤ 280 KB gz. Para referência: o `three.module.min.js` r180 mais o `three.core.min.js` somam 77 + 98 KB gzip (medido); com tree-shaking, deve ficar menor | igual | 0 |
| Geometria (glTF + Draco ou meshopt) | ≤ 400 KB | ≤ 250 KB | 0 |
| Texturas KTX2 | ≤ 1,8 MB (1024 px) | ≤ 600 KB (512 px) | 0 |
| Áudio (só depois de ligar o som) | ≤ 600 KB (Opus em WebM + AAC de reserva) | ≤ 300 KB | 0 |
| **Total da primeira visita, sem som** | **≤ ~3 MB** (igloo: ~15 MB) | **≤ ~1,2 MB** | **≤ ~0,45 MB** |
| Draw calls | ≤ 120 | ≤ 60 | n/a |
| Triângulos visíveis | ≤ 250 mil | ≤ 80 mil | n/a |
| Metas | LCP < 2,5 s, INP < 200 ms, CLS < 0,1 em Moto G de faixa baixa com 4G lento simulado | | |

**Táticas obrigatórias:**
- Compilar shaders antes de mostrar (`renderer.compileAsync`).
- Pausar o laço com aba oculta e com o canvas fora da tela.
- Instanciar janelas e andares (uma chamada de desenho por tipo).
- Assar luz no Blender em vez de luzes em tempo real.
- Névoa para cortar a distância.
- Texturas KTX2/Basis (o mesmo formato do igloo, que reduz memória de GPU).

### 3.5 Pipeline de assets: vale usar o Blender? Sim, no lugar certo

| Peça | Origem | Por quê |
|---|---|---|
| **Kit de andares** (3 ou 4 variações de andar déco com recuo, cornijas, coroa, poço) | **Blender**, glTF | Detalhe de cornija e friso feito à mão é o que separa "3D de template" de "3D de autor" |
| **Montagem da torre** | **Procedural no código**, a partir dos dados (n andares = n lobbies; recuo pela lotação) | O número de andares muda a cada minuto; não dá para ser modelo fixo. É o "algoritmo de cristais" do igloo, versão nossa |
| **Iluminação** | **Assada no Blender** (AO + luz indireta em lightmap) e aplicada em tempo real | Visual de render a custo de textura. O clone público do igloo faz o mesmo com dois lightmaps (montado e explodido) (https://github.com/ne-he/igloo, fonte secundária) |
| **Janelas** | Procedural (instâncias + shader de interior mapping) | Uma chamada de desenho para centenas de janelas; cada uma liga e desliga por dado |
| **Cartas-relicário** | Moldura no Blender; interior procedural por semente do modo | Moldura bonita uma vez; seis interiores únicos sem modelar seis vezes |
| **Pôster, imagem OG e fallback nível 1** | **Render do Blender** (Cycles) da mesma cena | Coerência total entre o 3D e o 2D; também vira a imagem de compartilhamento |
| **Otimização** | `gltf-transform` (Draco ou meshopt, KTX2, *prune*, *dedup*) | Mesmo princípio do igloo (Draco + KTX2) |

**Ordem de trabalho (copiada do processo da Abeto):** maquete cinza e previs → um andar bonito de ponta a ponta (modelo, material, luz assada, janela ao vivo) → só então multiplicar.

### 3.6 Divisão de código

- **Casca** (sem three): rotas, lista de lobbies, diálogos e o pôster do hero.
- **`scene-tower` (lazy):** three, R3F, a cena e os shaders. Começa a baixar com `requestIdleCallback` depois do LCP, ou quando o usuário mexe o ponteiro ou rola.
- **`audio` (lazy):** só depois de "Ligar som".
- **Páginas internas** (Gazeta, Modo, Instalar) com `lazy` (já pedido na avaliação v3, item 24).
- **Assets da cena por proximidade:** o cofre dos modos só carrega quando a cena 2 começa.

### 3.7 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Virar "site de agência" que esconde o produto | A lista de lobbies continua na cena 2 e em `/lobbies`, e o CTA fica no hero. Teste: "consigo entrar num lobby em 2 cliques sem rolar?" |
| Custo de produção (arte 3D) | Começar pelo spike de 1 andar (seção 10). Se em 1 semana não ficar bonito, o conceito D (pôster + SVG) segura sozinho |
| Celular esquentar e gastar bateria | Níveis + `PerformanceMonitor` + pausa fora da tela + `frameloop="demand"` |
| Acessibilidade | HTML é a verdade; canvas `aria-hidden`; foco visível; nada de rolagem sequestrada; movimento reduzido desenhado |
| Parecer derivado do igloo | Material, luz, cor, tema e tipografia são outros. O que levamos é **método** (objeto único, estados, cantos, som), não visual |

---

## 4. Premium vs. slop de IA

### 4.1 Os sinais de site feito por IA (com fonte)

- **Auditoria de Adrian Krebs com landing pages do Show HN** (secundária: https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it; repositório: https://github.com/AdrianKrebs/ai-design-checker).
  - **Método:** checagens determinísticas de CSS e DOM com Playwright, não julgamento de IA; 5 a 10% de falso positivo segundo o autor.
  - **Os 16 padrões:**
    - Inter em tudo; os mesmos pares (Space Grotesk, Instrument Serif, Geist); uma palavra do hero em serifa itálica;
    - roxo "lavanda"; tema escuro permanente com texto cinza e rótulos em caixa-alta; contraste raspando o mínimo; gradiente em tudo; brilho colorido grande;
    - hero centralizado; selo acima do H1; borda colorida em cima ou à esquerda dos cards; cards iguais com ícone em cima; passos "1, 2, 3"; faixa de estatísticas; emoji na navegação; títulos em caixa-alta.
  - **Resultado:** 22% "slop pesado" (4 padrões ou mais), 32% leve e 46% limpo. O tamanho da amostra varia entre as fontes (500, ~1.000 ou 1.590); trate os números como ordem de grandeza.
- **Cookbook da Anthropic**, *Prompting for Frontend Aesthetics* (https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics). Pede para evitar:
  - fontes batidas: "Never use: Inter, Roboto, Open Sans, Lato, default system fonts";
  - "purple gradients on white backgrounds";
  - layouts previsíveis.
  
  Também admite que o modelo "converge" para escolhas comuns como Space Grotesk.
- **Skills carregadas** (`frontend-design`, `design-taste-frontend`). Os agrupamentos típicos de IA hoje:
  - creme `#F4F1EA` com serifa e acento terracota;
  - quase-preto com **um** acento ácido;
  - layout de jornal com fio fino e raio zero;
  - o kit de cards SaaS;
  - o "chrome" de template: rótulo em caixa-alta acima de cada título, metadados com ponto médio, travessão como enfeite e `→` no fim de todo link.
  - **Atenção:** dois desses grupos tocam a gente (o "quase-preto com acento" e o "jornal com fios"). Por isso a cor da cena é luz de uma fonte, não "acento", e a Gazeta precisa de grid editorial com hierarquia real, não fios em tudo.
- **A avaliação v3** já marcou no nosso próprio código: brilho radial (×9), borda fina com sombra larga (×7), quadrícula de fundo e os "três passos".

### 4.2 Os sinais de ofício humano (com fonte)

- **Rauno Freiberg**, *Invisible Details of Interaction Design* (https://rauno.me/craft/interaction-design):
  - movimento **interrompível**;
  - preservar o momento do gesto;
  - disparar ações leves no meio do gesto e as destrutivas só ao soltar;
  - responder ao input na hora;
  - relações espaciais consistentes;
  - **sem animação em ações de alta frequência**;
  - lei de Fitts;
  - mostrar o que o dedo cobre.
- **Emil Kowalski**, *Great animations* (https://emilkowal.ski/ui/great-animations):
  - molas para movimento natural;
  - a maioria das animações abaixo de 300 ms com `ease-out`;
  - animar só onde informa;
  - nunca animar ação de teclado repetida;
  - 60 fps animando só `transform` e `opacity`;
  - interrompível;
  - respeitar movimento reduzido.
- **Vercel**, Web Interface Guidelines (https://vercel.com/design/guidelines):
  - foco visível com `:focus-visible`;
  - alvo de no mínimo 24 px (44 px no celular);
  - spinner com atraso de 150 a 300 ms e mínimo de 300 a 500 ms na tela;
  - atualização otimista com desfazer;
  - `font-variant-numeric: tabular-nums`;
  - aspas curvas e o caractere "…";
  - nunca `transition: all`;
  - ajuste óptico de 1 px.
- **Apple**, *Animate with springs* (WWDC23, https://developer.apple.com/videos/play/wwdc2023/10158/):
  - molas preservam velocidade quando interrompidas;
  - configuração por **duração + "bounce"**;
  - comece com bounce 0 e não passe de cerca de 0,4 em interface.
- **Linear** (https://linear.app/now/how-we-redesigned-the-linear-ui): redesenho com sistema de cor em LCH e tempo gasto alinhando rótulos, ícones e botões. O cuidado invisível é o produto.
- **Awwwards** (https://awwwards.com/about-evaluation): a nota pesa Design 40%, **Usabilidade 30%**, Criatividade 20% e Conteúdo 10%. Até o júri que premia WebGL dá 30% para usabilidade.

### 4.3 Tabela de bolso: slop → ofício, no nosso contexto

| Slop | Ofício (nosso) |
|---|---|
| Brilho radial atrás do título | Luz que sai de uma janela da torre e ilumina o título por baixo |
| Card de vidro fosco | Painel de asfalto opaco com fio duplo de latão e canto chanfrado |
| "Como funciona" em 3 passos | O indicador de andar do elevador |
| Avatar com inicial | Avatar da Steam ou nenhum |
| Spinner | O andar acendendo como carregamento |
| Contagem inventada | Número da API ou nada |
| Fade-up em cada seção | Uma abertura (as janelas acendendo); o resto responde a gesto |
| Rótulo em caixa-alta acima de cada título | Mono em caixa normal só onde informa (`Andar 07`) |
| Ícone de emoji | Glifo desenhado no sistema (sigilos do modo) |
| 404 genérica | A rua apagada com uma janela acesa: "Essa rua não está no mapa" (já existe no v3) |

---

## 5. Sites de jogo e entretenimento: o que cada um ensina

Medidos por mim hoje, salvo os marcados "(medido em `pesquisa-referencias.md`)". "Medido" é piso quando há pedidos sem medida.

| # | Site | A ideia que fica | Ofício (tipo, cor, movimento, layout) | Peso medido | Combina com a direção igloo? |
|---|---|---|---|---|---|
| 1 | **igloo.inc** | Monólito aceso, câmera presa à rolagem | IBM Plex Mono em SDF, monocromático + luz branca, aberração cromática, 18 sons | **~15 MB**, 94 pedidos, 0 sem medida | É a âncora |
| 2 | **ARC Raiders** https://arcraiders.com/pt-BR | **Estado do mundo ao vivo na home:** "Map Conditions" com eventos por mapa e cronômetro `36:53` | Uma fonte só (Barlow), H1 de 96 px/105, peso 700, caixa-alta, tracking −2,6 px; fundo `#130918`, âmbar `#F1AA1C`, creme `#ECE2D0`; listras retrô de arco-íris na lateral; selos de prêmio | 70 KB (48 de 49 sem medida: piso inútil) | **Muito:** é a prova de que "dado ao vivo na vitrine" é premium. As etiquetas dos andares (cena 2) seguem essa lógica |
| 3 | **Marathon** https://www.marathonthegame.com | Sistema gráfico como identidade: nome vertical num trilho verde-ácido, código de barras, microtipo | `marathonShapiro`, `ppFraktionMono`, `khInterference`; `#C0FE04` e `#0072CE` sobre preto; vídeo de fundo com **botão de pausa**; `[↗]` nos links | 672 KB (32 de 57 sem medida) | **Muito**, na camada de interface: a mono como marca e o trilho lateral como navegação |
| 4 | **Clair Obscur: Expedition 33** https://www.expedition33.com | A pintura é o meio: arte-chave com **bordas de pincel rasgadas**, títulos entre « aspas francesas » | Ouro `#ECCFA3` sobre preto; 2 canvas e 5 vídeos; feito em Wix (fontes `wfont_*`, 176 elementos em Arial de fallback) | 5,3 MB (32 de 223 sem medida) | Médio: o "material da arte vira moldura" pode virar nosso **vidro com chuva** como borda de transição |
| 5 | **Alan Wake 2** https://www.alanwake.com | Título condensado gigante em **uma cor fria** (`#97AC9F`, verde-sálvia) sobre arte vermelha e preta | aktiv-grotesk extended, peso 900, caixa-alta; uma cor de tipo, uma de imagem | 8,2 MB (7,8 MB em imagem) | Sim, na regra: **texto numa cor só, a luz é da cena** |
| 6 | **Disco Elysium** https://discoelysium.com | Uma tela só (900 px de altura): pintura a óleo enche a viewport e o texto vem em **tarjas pretas** como fita de rotulador | Dobra (light e bold); laranja `#E55023`, ciano `#00CAC0` | 1,8 MB | Sim: o texto do hero sobre a cena pode usar **tarjas de asfalto** em vez de sombra ou brilho |
| 7 | **Lies of P** https://www.liesofp.com | Belle Époque: display com floreio (`brilon`) e **banner de cookies no estilo do jogo**, com botões ornamentados | brilon, Loretta, Montserrat; ouro velho `#796741` | 2,5 MB | Sim, no "ofício nos lugares chatos": nosso aviso de cookies em placa de latão |
| 8 | **Arcane** https://www.arcane.com/pt-br/ | Contraexemplo: muito orçamento, **template** da Riot | Inter (82 elementos) + Tungsten; travessão no H1 ("2ª temporada… — já disponível!") | 634 KB (43 de 68 sem medida) | Não. Lição: tamanho de estúdio não garante ofício |
| 9 | **Deadlock** https://www.playdeadlock.com/cityneversleeps | Metáfora única (guia turístico) + lettering de cartão-postal recheado de ilustração | Oracle (260), Jost (214), Pulp (26); creme `#F7E9D5`, carvão `#2C2E31`, laranja `#DD6638`, cores de pista; **0 canvas, 7 vídeos**; página com **50.017 px** de altura (eram ~44.000 na pesquisa anterior) | 351 KB (201 de 212 sem medida: piso inútil) | É o rival a superar. **Onde ele é fraco:** rolagem longa e passiva, sem interação e sem dado vivo. É exatamente onde a Torre é forte |
| 10 | **Balatro** | O shader do jogo é o fundo do site; voz até no aviso de cookies | Fonte pixel própria | (medido em `pesquisa-referencias.md`) | Sim: um shader de névoa próprio como "assinatura" ambiente |
| 11 | **Hades II** / **Silksong** | A arte é o efeito: pouca tecnologia, ilustração forte | Coluna única, wallpapers | (medido em `pesquisa-referencias.md`) | Indireto: lembra que o render do Blender (pôster) tem de ser bonito sozinho |
| 12 | **Haunted Boulder City** (Honorable Mention no Awwwards, 26/09/2026) | Clima sem WebGL: carregamento com névoa e "lanterna" que segue o mouse | ~943 KB, ~18 KB de JS | (medido em `pesquisa-referencias.md`) | Sim: a **lanterna** pode ser a luz de sódio que o ponteiro arrasta pela fachada no nível 1 (sem 3D) |
| 13 | **Don't Look Up** (Site of the Day no Awwwards em 01/11/2026) https://www.dontlookup.app/ | Restrição extrema (duas cores) com conceito claro | GSAP + Three.js | (ficha no Awwwards) | Sim, na disciplina de cor |
| 14 | **Game UI Database** https://www.gameuidatabase.com | Não é referência visual: é **ferramenta** de pesquisa (1.984 jogos, 79.069 telas) | Roboto e system-ui | 4,8 MB | Usar para pesquisar telas de jogo déco e ocultas (filtro por cor) |

**Padrões que se repetem nos bons:** uma ideia central; uma cor de tipo; a arte própria manda; um detalhe de ofício num lugar inesperado (cookies, pausa do vídeo, aspas francesas); e, nos melhores de 2025-2026, **o mundo do jogo aparecendo vivo no site** (ARC Raiders).

---

## 6. Direção de arte: déco ocultista, feito hoje

### 6.1 Referências fora dos jogos

| Referência | O que levar | O que deixar | Fonte |
|---|---|---|---|
| **Lei de zoneamento de 1916 e os desenhos de Hugh Ferriss** (*The Metropolis of Tomorrow*, 1929) | Massa escalonada, carvão, noite, névoa, prédios como montanhas de luz e sombra. É a referência de **luz e de clima** da cena 1 | Cópia literal de desenhos | https://skyscraper.org/skyline/impact-of-1916-zoning/ ; https://publicdomainreview.org/essay/modern-babylon-ziggurat-skyscrapers-and-hugh-ferriss-retrofuturism/ ; https://en.wikipedia.org/wiki/The_Metropolis_of_Tomorrow. **Direito autoral:** obras publicadas nos EUA em 1929 entraram em domínio público nos EUA em 01/01/2025 (conhecimento geral; Ferriss morreu em 1962, então **fora dos EUA** pode não estar livre). Usar como referência, não como asset |
| **A. M. Cassandre**, cartaz *Normandie* (1935) | Geometria, ponto de vista heroico de baixo para cima, gradientes de aerógrafo, um objeto monumental. É o enquadramento da câmera da cena 1 | Tipografia de Cassandre (Bifur, Peignot: não são livres) | V&A: https://collections.vam.ac.uk/item/O1405126/normandie-poster-cassandre ; https://oceanlinersmagazine.com/2021/01/23/cassandre-man-poster/ |
| **Chrysler, Rockefeller Center** (conhecimento geral) | Coroa em raios, triângulos de janela, frisos e relevos; o indicador de elevador e as portas marchetadas do Chrysler inspiram a cena 4 | Silhuetas reconhecíveis (Empire State, Chrysler). A torre é genérica e nossa | (sem fonte aberta nesta sessão) |
| **BioShock** (Rapture) | Déco funciona em 3D porque é "curvas e linhas" com silhuetas fortes (Ken Levine); o contraste entre propaganda alegre e decadência | Pôsteres no estilo BioShock (seria derivado) | https://whatculture.com/gaming/art-perspective-bioshock-art-deco ; https://gamezone.com/originals/e3-06-bioshock-interview-transcript/amp |
| **Golden Thread Tarot** (Tina Gong, Labyrinthos) | **Ocultismo moderno sem kitsch:** linha fina dourada sobre preto e iconografia mínima. É a linguagem das cartas-relicário e dos sigilos | Os desenhos | https://labyrinthos.co/products/golden-thread-tarot-deck ; resenha: https://benebellwen.com/2016/10/24/golden-thread-tarot-review/ |
| **Liam Wong**, *TO:KY:OO* | Noite urbana com teoria de cor de diretor de arte de games: poucas cores saturadas sobre escuro, horário como título | O ciano e magenta "cyberpunk" (seria outro gênero) | https://www.canon-europe.com/pro/stories/liam-wong-tokyo-cityscapes/ |
| **Christophe Jacrot**, *Paris in the Rain*, *New York in Black* | Chuva, guarda-chuva, cidade apagada após o furacão Sandy. É o clima do asfalto molhado e da cidade sem luz em volta da torre | | https://www.ignant.com/?p=77479 ; https://spacegallerystbarth.com/post/12342-cocktail---christophe-jacrot-lost-in-bad-weather-french-article-translated-into-english |
| **Erté** (conhecimento geral) | Silhueta alongada e ornamento de linha contínua, para os sigilos | Figurinos e figura humana | (sem fonte aberta nesta sessão) |

### 6.2 O que traduz para interface premium sem kitsch

- **Paleta:** noite azulada + **uma** luz quente (sódio) + verdete contado. O latão é **material** (frisos 3D, fio de 1 px na interface), não cor de fundo. Isso também evita o "creme + latão + espresso" que as skills marcam como paleta-padrão de IA.
- **Ornamento:** um por tela, e com função:
  - fio duplo déco para separar;
  - chanfro de 45° nos cantos de painel;
  - recuo escalonado no topo de painel importante;
  - sigilo do modo como identificador.
  - Nada de moldura rococó, borda queimada, pergaminho ou pentagrama.
- **Ocultismo = geometria, não fantasia.** Círculos, raios, numerais romanos e constelações de linha fina (como a linha dourada do Golden Thread). A "magia" aparece em comportamento: o texto que se decifra, a luz que acende quando alguém entra.
- **Fotografia noturna como regra de luz:** fonte de luz visível na cena, reflexo no molhado e escuro que engole a distância (Jacrot e Ferriss).

---

## 7. Sistema tipográfico

### 7.1 Critérios

1. Não estar no site do Deadlock (Pulp, Oracle, Jost) nem ser clichê de IA (Inter, Space Grotesk, Geist, Instrument Serif, Fraunces, Syne, Unbounded, Bricolage).
2. Licença aberta (OFL) e auto-hospedável (Fontsource).
3. pt-BR completo (todas as famílias abaixo têm o subconjunto `latin-ext` no Google Fonts; nas do Collletttivo conferi `ã õ ç` na tabela de glifos).
4. Eixos variáveis úteis.
5. Popularidade baixa (a posição no ranking do Google Fonts vem dos metadados oficiais; quanto maior o número, menos usada).

### 7.2 Três pares

| | Display | Camada técnica (HUD) | Leitura | Por que |
|---|---|---|---|---|
| **1 (recomendado)** | **Big Shoulders** (Patric King; `opsz 10-72`, `wght 100-900`; famílias irmãs **Inline** e **Stencil** com os mesmos eixos; posição 307) | **Martian Mono** (Evil Martians; `wdth 75-112.5`, `wght 100-800`; posição 344) | **Libre Franklin** (Impallari; `wght 100-900`; já no v3) | A Big Shoulders é "gótica americana condensada" feita para o sistema de design de Chicago, com raiz em ferrovia e cartaz: é anos 1920 sem ser fantasia. A Inline serve para a marquise (conceito B) e a Stencil para a placa do cartório. A Martian Mono tem eixo de **largura**, o que permite uma etiqueta condensada tipo fita de telégrafo e, por ser mono, o texto se decifra sem reflow. A Libre Franklin revive a Franklin Gothic de 1902, da mesma era. **Continuidade com o v3:** troca só a mono |
| **2 (editorial e glamour)** | **Bodoni Moda** (Owen Earl; `opsz 6-96`, `wght 400-900`; posição 140) | **Azeret Mono** (Displaay; `wght 100-900`; inspirada em OCR e sistemas operacionais; posição 293) | Libre Franklin | A didone de alto contraste é a voz das revistas de moda e dos cartazes de luxo dos anos 1920-30; o eixo óptico mantém os filetes finos inteiros em tamanho grande. Melhor para a **Gazeta** e as páginas de modo; mais "Bazaar" que "rua" |
| **3 (ocultista e livro-caixa)** | **League Gothic** (revival da Alternate Gothic de M. F. Benton, ATF **1903**; `wdth 75-100`; posição 260) para números e manchetes + **Sinistre** (Collletttivo, Jules Durand, OFL; uncial, romana e toques de Fraktur) **só** para o nome dos modos | **Xanh Mono** (Yellow Type; **mono com serifa**, ar de máquina de escrever e livro-caixa; posição 930) | Libre Franklin | Para o conceito C (livro-caixa). A Sinistre dá o "arcano" sem cair em Cinzel ou UnifrakturMaguntia. Risco: três personalidades fortes. Usar a Sinistre em no máximo 6 palavras por tela |

Evitar como display, mesmo sendo "déco": Limelight, Poiret One, Federo, Monoton, Cinzel e Marcellus. São óbvias, de baixo ofício ou batidas em sites "de luxo" gerados.

### 7.3 Escala do par 1 (proporção 1,333 a partir de 17 px; títulos com `clamp`)

| Papel | Fonte e eixos | Tamanho e entrelinha | Notas |
|---|---|---|---|
| H1 do hero | Big Shoulders `opsz 72`, `wght 800` | `clamp(3.25rem, 7.2vw, 7.5rem)` / 0,92 | No máximo 2 linhas; tracking 0; caixa normal ("Modos da comunidade, / dentro do Deadlock.") |
| H2 de cena | Big Shoulders `opsz 48`, `wght 700` | `clamp(2rem, 4vw, 3.5rem)` / 1,0 | |
| Número grande (vagas, contagem) | Big Shoulders `opsz 72`, `wght 600`, `tabular-nums` | 3 a 5 rem | |
| Etiqueta HUD | Martian Mono `wdth 87.5`, `wght 450` | 12 a 13 px / 1,35, tracking +0,02em | Caixa normal; prefixo `№` ou `§` só onde informa |
| Botão | Martian Mono `wdth 100`, `wght 600` | 14 a 15 px | Uma linha sempre |
| Texto | Libre Franklin `wght 400` | 17 px / 1,55, no máximo 68ch | |
| Legenda | Libre Franklin `wght 500` | 14 px / 1,45 | |

**Peso estimado:** as três variáveis em woff2 com subconjunto latino somam cerca de 100 a 140 KB. Medir no build; o v3 já traz Big Shoulders e Libre Franklin pelo Fontsource.

---

## 8. Movimento e "juice"

### 8.1 Princípios de jogo que valem para a web

- **Juice** (Jonasson e Purho, *Juice it or lose it*, 2012, https://gdcvault.com/play/1016487/; Nijman, *The Art of Screenshake*, 2013, https://roblog.co.uk/2024/03/juicy-games/): partícula, som, tremor, escala e atraso transformam um clique em evento. **Na web, a dose é outra:** o juice vai no **momento de recompensa** (entrou no lobby, o lobby lotou), não em cada hover.
- **Antecipação:** antes de algo grande acontecer, um sinal pequeno (a janela pisca uma vez antes de acender).
- **Peso e personalidade:** latão é pesado, então a mola é mais amortecida e menos elástica. Vidro e luz são rápidos.

### 8.2 Tokens de movimento (proposta)

| Token | Valor | Uso |
|---|---|---|
| `--t-micro` | 120 ms, `ease-out` | Hover, foco, pressão de botão (`scale 0.98`) |
| `--t-ui` | 220 ms, `cubic-bezier(.2,.8,.2,1)` | Abrir menu, etiqueta de andar |
| Mola "latão" | duração 0,5 s, bounce 0 | Painéis, diálogos, câmera mudando de alvo (interrompível) |
| Mola "carta" | duração 0,6 s, bounce 0,15 | Carta virando, carta entrando no centro do cofre |
| Acender janela | 600 ms (sobe 80 ms, assenta 520 ms) | O "plim" de luz, uma vez por evento |
| Decifrar texto | 300 a 500 ms | Uma vez por entrada em cena |
| Câmera seguindo a rolagem | amortecimento crítico com fator ~0,08 por quadro, ajustado ao delta de tempo | Nunca linear |

### 8.3 Com gosto e gimmick

| Com gosto (fazer) | Gimmick (não fazer) |
|---|---|
| Janela acende quando alguém entra **de verdade** | Pulso infinito em todo ponto verde |
| Câmera que persegue a rolagem com amortecimento | Rolagem sequestrada e travada em seções |
| View Transition da carta para a página do modo | Transição de página em toda navegação, inclusive filtros |
| Botão magnético **só** no CTA do hero, 4 a 6 px | Cursor personalizado que esconde o do sistema |
| Som opcional por gesto, volume baixo e uma trilha só | Som automático; som em hover |
| Letreiro "Lotado" acende com onda lenta (no máximo 3 piscadas por segundo, WCAG 2.3.1) | Lâmpadas piscando sem parar |
| Decifrar a etiqueta ao entrar em cena | Decifrar todo texto, sempre |

### 8.4 Acessibilidade do movimento

- **`prefers-reduced-motion: reduce`:** sem deriva de câmera, sem paralaxe, sem decifrar e sem partículas; troca de cena por corte. A cena 3D só por opção explícita.
- **Todo movimento contínuo tem pausa** (o Marathon põe botão de pausa no vídeo de fundo; a cena 3D também terá).
- **Foco do teclado:** ao focar um lobby na lista, o andar correspondente acende. O teclado ganha a mesma recompensa visual que o mouse.
- **Som:** desligado por padrão; o `AudioContext` só nasce depois do gesto de ligar; a preferência fica salva.

---

## 9. Quatro conceitos de hero

Público: maioria em Android médio e baixo, pt-BR, gente que já joga e quer achar partida rápido.

### A. A Torre Acesa (WebGL) **← escolhido**
- **Descrição:** a cena 1 do storyboard. Torre déco de obsidiana e latão na névoa, apagada; em 1,5 s as janelas acendem na ordem real de entrada dos jogadores, e as frestas de latão fecham o circuito. O H1 e o CTA ficam embaixo à esquerda, em HTML, sobre uma tarja de asfalto (a lição do Disco Elysium). A rolagem separa os andares (lobbies).
- **Por que é único:** a imagem **é** o produto ao vivo. Nenhum site de jogo (nem o igloo, nem o Deadlock) mostra o próprio uso em tempo real como objeto 3D.
- **Técnica:** R3F + kit de andares do Blender + montagem procedural pelos dados + janelas instanciadas com interior mapping + luz assada + névoa + composição própria (nível 3).
- **Peso:** cerca de 3 MB no desktop, cerca de 1,2 MB no Android médio e cerca de 0,45 MB no nível 1 (seção 3.4).
- **Fallback:** pôster renderizado no Blender com as janelas ao vivo em SVG por cima.
- **Risco:** custo de arte 3D e de afinação. Mitigação: o spike de um andar (seção 10).

### B. A Marquise
- **Descrição:** o H1 é montado por centenas de lâmpadas (pontos instanciados em canvas 2D ou WebGL leve) numa fachada de teatro escura. As lâmpadas formam números vivos ("412 na cidade agora") e o nome do modo mais jogado; quando um lobby lota, uma onda de luz corre a marquise (ritmo lento, seguro para fotossensibilidade).
- **Por que é único:** tipografia cinética **feita de luz e de dado**, com raiz no cartaz de vaudeville, sem ilustração.
- **Técnica:** Big Shoulders Inline rasterizada em grade de pontos; canvas 2D; cerca de 15 a 30 KB de JS.
- **Peso:** muito baixo.
- **Fallback:** a mesma Big Shoulders Inline em HTML.
- **Risco:** virar Las Vegas ou circo. Melhor como **momento** (lotou) do que como hero fixo.

### C. O Livro-Caixa
- **Descrição:** uma página de livro de registros ocultista em papel escuro. Cada entrada real em lobby é escrita a tinta numa linha em Xanh Mono ("23h41 / Círculo Profano / BR / faltam 2"), com o sigilo do modo carimbado em latão. A rolagem vira páginas (View Transition).
- **Por que é único:** o dado vira documento e o ocultismo vira burocracia (sociedade secreta com contabilidade). Tem voz, humor e pt-BR.
- **Técnica:** só HTML e CSS + View Transitions; acessível de nascença (é uma lista).
- **Peso:** quase zero.
- **Fallback:** ele mesmo.
- **Risco:** pede texto bom e fica "jornal com fios" (um dos agrupamentos de IA) se o grid não tiver hierarquia forte.

### D. A Relíquia (Blender + 2.5D)
- **Descrição:** um loop de 6 a 8 s renderizado no Blender (Cycles) de um objeto ocultista de latão e vidro, um **relógio-sigilo** cujos ponteiros apontam o lobby mais perto de lotar. Paralaxe por mapa de profundidade num shader de 1 plano (o mouse ou o giroscópio deslocam a imagem) e pontos clicáveis em HTML sobre partes do objeto.
- **Por que é único:** qualidade de render de cinema a custo de vídeo, sem 3D em tempo real.
- **Técnica:** vídeo AV1 ou H.264 (≤ 1,5 MB, 1080p) + pôster AVIF + mapa de profundidade (≤ 60 KB) + shader de paralaxe (cerca de 5 KB).
- **Peso:** médio no desktop. No celular, só o pôster com paralaxe.
- **Fallback:** o pôster.
- **Risco:** o objeto não mostra dado ao vivo de verdade (ponteiros são overlay) e o loop cansa na terceira visita.

**Por que A, e como os outros entram:**
- **A** é o único em que o "caraca" e a função coincidem: a pessoa vê, em 3 segundos, que tem gente jogando agora, e onde.
- **D** é o render da mesma torre no Blender e serve de pôster (LCP), de fallback do nível 1 e de imagem de compartilhamento.
- **B** aparece só quando um lobby lota (micro-celebração).
- **C** pode ser a linguagem da página de Novidades (Gazeta) ou de um "histórico do lobby".

---

## 10. Próximo passo sugerido: spike de 5 dias antes de redesenhar tudo

1. **Dia 1, previs cinza:** a torre em caixas, a câmera em 7 posições e o overlay HTML de cantos sobre ela. Testar a rolagem nativa com câmera amortecida.
2. **Dias 2-3, um andar bonito:** modelar 1 andar no Blender (cornija, friso, janelas), assar a luz, exportar com `gltf-transform` (Draco + KTX2) e montar 8 andares por dado com janelas instanciadas acendendo via store.
3. **Dia 4, níveis e fallback:** detect-gpu, `PerformanceMonitor`, o pôster do Blender como LCP, o nível 1 em SVG e o movimento reduzido.
4. **Dia 5, medir:** Lighthouse no celular, FPS em Android de entrada (ou CPU 4× mais lenta no DevTools), bytes por nível. Decidir: seguir com A, ou parar em D + SVG (que já seria mais forte que o v3).

Critério de aprovação do spike: em 3 segundos, uma pessoa que nunca viu o site diz, sem ajuda, "tem gente jogando agora e eu posso entrar".

---

## 11. Fontes

**igloo.inc**
- https://www.igloo.inc/ (inspeção direta, desktop e celular)
- https://www.awwwards.com/igloo-inc-case-study.html (estudo de caso, Abeto)
- https://x.com/awwwards/status/1901665664332435526 e https://x.com/abeto_co/status/1900152588768579701 (prêmios)
- https://github.com/ne-he/igloo (clone independente "inspirado", fonte secundária)

**Slop e ofício**
- https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it ; https://github.com/AdrianKrebs/ai-design-checker
- https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics
- https://rauno.me/craft/interaction-design
- https://emilkowal.ski/ui/great-animations
- https://vercel.com/design/guidelines
- https://developer.apple.com/videos/play/wwdc2023/10158/
- https://linear.app/now/how-we-redesigned-the-linear-ui
- https://awwwards.com/about-evaluation
- https://www.awwwards.com/websites/games/ (lista consultada hoje)

**Sites de jogo (inspeção direta)**
- https://arcraiders.com/pt-BR ; https://www.marathonthegame.com ; https://www.expedition33.com ; https://www.alanwake.com ; https://discoelysium.com ; https://www.liesofp.com ; https://www.arcane.com/pt-br/ ; https://www.playdeadlock.com/cityneversleeps ; https://www.gameuidatabase.com
- https://www.dontlookup.app/ ; Balatro, Hades II, Silksong e Haunted Boulder City em `pesquisa-referencias.md`

**Art déco, ocultismo, noite**
- https://skyscraper.org/skyline/impact-of-1916-zoning/ ; https://si.edu/object/study-maximum-mass-permitted-1916-new-york-zoning-law-stage-4%3Achndm_1969-137-4
- https://en.wikipedia.org/wiki/The_Metropolis_of_Tomorrow ; https://publicdomainreview.org/essay/modern-babylon-ziggurat-skyscrapers-and-hugh-ferriss-retrofuturism/
- https://collections.vam.ac.uk/item/O1405126/normandie-poster-cassandre ; https://oceanlinersmagazine.com/2021/01/23/cassandre-man-poster/
- https://whatculture.com/gaming/art-perspective-bioshock-art-deco ; https://gamezone.com/originals/e3-06-bioshock-interview-transcript/amp
- https://labyrinthos.co/products/golden-thread-tarot-deck ; https://benebellwen.com/2016/10/24/golden-thread-tarot-review/
- https://www.canon-europe.com/pro/stories/liam-wong-tokyo-cityscapes/
- https://www.ignant.com/?p=77479 ; https://spacegallerystbarth.com/post/12342-cocktail---christophe-jacrot-lost-in-bad-weather-french-article-translated-into-english

**Tipografia**
- https://fonts.google.com/metadata/fonts (metadados: eixos, subconjuntos, popularidade)
- https://raw.githubusercontent.com/google/fonts/main/ofl/bigshoulders/DESCRIPTION.en_us.html (e as de `martianmono`, `bodonimoda`, `azeretmono`, `xanhmono`, `leaguegothic`)
- https://www.collletttivo.it/typefaces ; https://www.collletttivo.it/typefaces/sinistre ; https://www.collletttivo.it/typefaces/mazius-display

**Técnica**
- https://r3f.docs.pmnd.rs/advanced/scaling-performance
- https://github.com/pmndrs/detect-gpu
- https://joostdevblog.blogspot.com/2018/09/interior-mapping-real-rooms-without.html
- https://developer.chrome.com/blog/autoplay
- jsDelivr (medição de gzip): `three@0.180.0` (`three.module.min.js` 77 KB gz, `three.core.min.js` 98 KB gz), `postprocessing@6.37.8` (151 KB gz), `gsap@3.13.0` (27 KB gz) + `ScrollTrigger` (17 KB gz), `lenis@1.3.11` (7 KB gz), `motion@12.23.12` (27 KB gz)

**Game feel**
- https://gdcvault.com/play/1016487/ ; https://roblog.co.uk/2024/03/juicy-games/
