# Avaliação de design do protótipo v3 ("Cidade Acesa")

*02/11/2026. Alvo: `web/` no commit d8890bb, rodando em `http://localhost:5173`. Nenhum arquivo do site foi alterado.*

**Método.** Duas skills: `impeccable` (rubrica de heurísticas do critique, auditoria técnica de 5 dimensões, detector) e `design-taste-frontend` (leitura do brief, dials e checklist anti-slop).
- **Avaliação A (revisão de design):** feita nesta sessão. Li o código, o `web/README.md` e os três documentos em `docs/design`. Abri no navegador `/`, `/lobbies`, `/lobbies?vazio=1`, `/lobbies` com filtro vazio, `/modos`, `/modos/circulo-profano`, `/instalar`, `/novidades` e uma 404. Cada rota foi vista a 1440×900 e a 375×812, nos temas escuro e claro. Também abri os diálogos de entrar (lobby comum e privado) e de criar lobby, criei um lobby e conferi o console numa aba nova.
- **Avaliação B (detector):** rodou num subagente isolado. Ele fez `impeccable detect` no código e injetou o detector no navegador em 6 rotas.
- **Limite do método:** o relatório B chegou antes de eu terminar a avaliação A, então o isolamento entre as duas não foi total. O snapshot em `.impeccable/critique/` não foi gravado: o entregável combinado era este arquivo. A pasta vazia `web/.impeccable/` que o detector criou foi removida. O console ficou limpo em todas as rotas (só mensagens do Vite e do React DevTools).

---

## 1. Notas

### 1.1 Rubrica do impeccable (heurísticas de Nielsen, interface inteira)

| # | Heurística | Nota | Ponto-chave |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | As etapas de entrada ("Baixando o modo…") e os avisos são bons. **Depois de entrar**, a linha do lobby volta a "Entrar", sem nenhum "você está aqui". Gente entrando ao vivo não aparece na lista. |
| 2 | Linguagem do usuário | 3 | Vocabulário de jogador e "Falta 1" funcionam. O mesmo lobby privado se chama "Com senha" no ícone e "só entra com convite" no diálogo de criar. |
| 3 | Controle e liberdade | 3 | Esc fecha os diálogos, existe "Limpar filtros" e os filtros ficam na URL. Não dá para sair de um lobby nem fechar o lobby que você criou. |
| 4 | Consistência | 3 | O sistema é coeso, mas: a coluna de ação muda de largura (128 px contra 210 a 218 px) e um botão sobrepõe o status; "privado" tem dois sentidos; as cartas de tarô ficam escuras no tema claro. |
| 5 | Prevenção de erro | 2 | **Lobby privado aceita "Entrar" sem convite nem senha.** O seu próprio lobby mostra "Entrar". O estado vazio de exemplo diz "Nenhum lobby aberto" embaixo de "16 lobbies abertos". |
| 6 | Reconhecer em vez de lembrar | 3 | Há legenda das janelas e filtros visíveis. O modo de cada lobby é só um texto cinza de 13 px, então é preciso ler linha por linha para reconhecê-lo. |
| 7 | Flexibilidade e eficiência | 2 | Atalhos bons: "Entrar em lobby" na página do modo escolhe o melhor e a cidade navega por setas. Faltam vista compacta, favoritos ou recentes, e "Achar uma partida" leva para a lista, sem partida rápida. |
| 8 | Estética e minimalismo | 3 | Visual limpo e contido. Pesam contra o texto de apoio do hero (33 palavras), "Aberto" repetido em 15 linhas e 18 linhas idênticas. |
| 9 | Recuperação de erro | 3 | O vazio com filtros tem "Limpar filtros", e há textos de erro do app (`join.errorNoApp`, `errorFull`, `errorGame`). O vazio filtrado não sugere a alternativa mais próxima. |
| 10 | Ajuda e documentação | 3 | A página de instalação continua exemplar. O texto de anti-cheat segue pendente, o que é honesto. |
| **Total** | | **28/40 (70%)** | **Bom, no limite de baixo** |

**Comparação:**
- **v1: 27/40.** O v3 ganhou só 1 ponto em usabilidade. O salto do v3 foi de **identidade**: tipografia, cidade, voz, Gazeta. As heurísticas medem sobretudo comportamento, e ali surgiram problemas novos de estado (lobby próprio, lobby privado) que comem o que a identidade ganhou. É um resultado esperado, não um fracasso, mas é a explicação honesta do "ainda temos muito para melhorar".
- **Texto: 22/32 (69%) e voz 1/4.** Reavaliado só o texto do v3, chega a **cerca de 24/32**. Subiram consistência e recuperação de erro: o vazio filtrado agora tem texto próprio e "Limpar filtros", e os avisos foram padronizados em "Avisar quando…". A **voz sobe de 1/4 para 3/4**: "Essa rua não está no mapa", "Cada janela acesa é um jogador", "Acenda uma janela hoje à noite" e "Madrugada na cidade". Fica abaixo de 4 porque a voz some justo onde o usuário passa mais tempo, na lista de lobbies (veja a seção 4).

### 1.2 Auditoria técnica (impeccable audit)

| # | Dimensão | Nota | Achado principal |
|---|---|---|---|
| 1 | Acessibilidade | 3 | O listbox da cidade tem um só ponto de tabulação, rótulos completos e setas funcionando. Falhas: título pulado (h1 → h3) em `/lobbies`; links de modo com 16 px de altura no celular; contorno do andar selecionado fino e de pouco contraste. |
| 2 | Desempenho | 3 | 112 KB de JS gzip num arquivo só, sem dividir por rota; as fontes estão bem resolvidas. |
| 3 | Responsivo | 3 | Sem rolagem horizontal a 375 px e com barra de abas no celular. Falhas: sobreposição na tabela a 1440 px; no celular a cidade fica fora da primeira tela; cada lobby ocupa 196 px de altura (cerca de 3 por tela). |
| 4 | Tema | 3 | Tokens completos e tema claro bem pensado. O tema padrão é sempre escuro e ignora `prefers-color-scheme`. |
| 5 | Integridade | 3 | Poucos achados do detector, a maior parte verdadeira e pequena (abaixo). |
| **Total** | | **15/20** | **Bom** |

### 1.3 Leitura do Taste (dials)

**Leitura do brief:** plataforma de jogo da comunidade com dois tipos de página.
- **Persuadir:** home, modos e Gazeta, para jogadores de Deadlock no Brasil, em linguagem art déco noturna orientada a dados.
- **Operar:** lista de lobbies, diálogos e instalação.

O Taste é feito para landing pages e declara a tabela de lobbies fora do seu escopo. Por isso, as regras anti-slop dele valem com rigor para home, modos e Gazeta, e só como referência na lista.

| Dial | v3 hoje (home) | Alvo sugerido (home) | v3 hoje (/lobbies) | Alvo sugerido (/lobbies) |
|---|---|---|---|---|
| DESIGN_VARIANCE | 5 | 7 | 3 | 5 |
| MOTION_INTENSITY | 4 | 5 | 2 | 4 (sinais ao vivo, não decoração) |
| VISUAL_DENSITY | 4 | 4 | 5 (no celular, 3) | 6, com vista compacta em 7 |

**Leitura dos números:**
- **Home:** o hero é ousado (cidade de dados ao lado do título). Da dobra para baixo o ritmo vira template: lista em 2 colunas, 4 cartas iguais em fileira e "3 passos" numerados.
- **Lobbies:** é uma tabela competente e anônima, com a variação no mínimo.
- **Movimento:** existe (janelas acendendo uma vez, tilt, anel girando, luz do mastro), mas está todo na vitrine (home e modos) e quase nada onde o dado muda de verdade, que é a lista.

**Checklist anti-slop do Taste:**

| Regra | Resultado |
|---|---|
| Travessão (em-dash) | **0.** Passa. |
| Eyebrows | 0. Passa. |
| Paleta | Latão como acento único, sem roxo de IA. Passa. |
| Serifa | Newsreader só na Gazeta, justificada. Passa. |
| Hero: título | **Falha.** Ocupa 4 linhas a 92 px ("O Deadlock / que a / comunidade / inventou."). O limite é 2. |
| Hero: texto de apoio | **Falha.** Tem 33 palavras contra o limite de 20; são 4 linhas no desktop e 6 no celular. |
| Seção "Do site à partida em três passos" | **Falha.** Os três passos numerados (1, 2, 3 em círculos de latão) são o template de "como funciona" mais reconhecível de IA. O texto é bom; o formato é genérico. |
| Pontos de status | **Falha.** O ponto verde de "Aberto" se repete em 15 das 18 linhas. É semântico, mas repetido vira ruído (a regra pede ponto só para estado real e com parcimônia). |
| Avatares | **Falha.** Os avatares são a inicial num quadradinho, o "avatar genérico" que a regra condena. Com login Steam, o avatar real existe. |
| Cartões | Borda fina com sombra larga no quadro de andares e nos diálogos (o detector também marcou). Brilhos radiais no hero e nas cartas. Aceitável no conceito "luz", mas é a assinatura de template mais visível depois da tipografia. |
| Tema claro | A quadrícula do hero é o padrão "grid de fundo" que o detector caça. Ela é justificada pela planta de arquiteto, mas é a parte menos própria da planta: falta o que faz uma planta parecer planta (cotas, eixos, carimbo). |

### 1.4 Detector (Avaliação B)

**CLI (`detect --json web/src`):** saída 0 com 1 achado de aviso.
- `codex-grid-background` em `web/src/styles/pages.css:70`: a quadrícula de 24 px do hero no tema claro. **Verdadeiro positivo.** É intencional ("papel de planta"), mas genérico. `web/index.html` saiu limpo.

**Navegador (injeção do detector):**

| Rota | Regra | Onde | Veredito |
|---|---|---|---|
| `/` | `radial-spotlight-glow` ×9 | `section.hero` e brilho/face das 4 cartas | Verdadeiro, de baixo risco: é a "luz de latão" do conceito. Vale reduzir na carta. |
| `/` | `gpt-thin-border-wide-shadow` ×7 | `section.directory` (quadro de andares), 4 faces de carta, 2 diálogos | Verdadeiro. É o jeito "card de template" de dar elevação. |
| `/` | `dark-glow` ×2 | Amostras da legenda (jogador e amigo) | Falso positivo: o brilho espelha a janela acesa. |
| `/` | `cramped-padding` | `.btn-ghost.btn-lg` | Falso positivo: a altura vem de `min-height: 3.25rem`. |
| `/lobbies` | `skipped-heading` | h1 "Lobbies" seguido de h3 (nome do lobby), sem h2 | **Verdadeiro.** |
| `/instalar` | `line-length` | Itens de lista e `p.install-affiliation` com 89 a 111 caracteres por linha | **Verdadeiro.** |
| `/instalar` | `first-viewport-column-overflow` | Coluna principal com 206% da altura da tela, lateral com 76% | Verdadeiro, mas aceitável: a lateral é fixa. |
| Todas | `cramped-padding` | Seletor de tema `segmented-sm` no rodapé | Verdadeiro e menor: os botões encostam no contorno. |

**Onde o detector e a revisão concordam:** os padrões de template estão nas **superfícies** (cartões, diálogos, quadro de andares), não na estrutura. O detector **não** pega o maior problema: a monotonia da lista de lobbies, porque 18 linhas idênticas e "limpas" não disparam nenhuma regra.

---

## 2. O que funciona (manter)

- **A cidade é o dado.** Um prédio por região, um andar por lobby, uma janela por vaga, e o recuo escalonado sai dos dados. É a ideia mais forte do projeto e continua sem paralelo.
- **O quadro de andares é acessível de verdade:** listbox com um só ponto de tabulação, rótulo completo por andar e a lista "Enchendo agora" como equivalente em texto.
- **A tipografia saiu da Jost e ganhou caráter:** Big Shoulders nos títulos e números, Libre Franklin no texto. A Gazeta com Newsreader resolveu a página mais seca do site.
- **Honestidade em instalação, hash e antivírus**, e a seção de anti-cheat marcada como "Texto pendente" em vez de inventada.
- **Voz "Luz Acesa"** na 404, no vazio ("A cidade está quieta agora"), na legenda e no rodapé.
- **Diálogo "Falta só o app"** com o círculo de espera: claro, com duas saídas, e funciona no celular.
- **Mobile com barra de abas embaixo** e sem rolagem horizontal; filtros e ordenação na URL.

---

## 3. Problemas priorizados

Severidade: **P0** bloqueia, **P1** atrapalha muito, **P2** incomoda, **P3** é polimento. Não encontrei P0: todos os fluxos principais se completam.

### 3.1 Transversais

- **[P1] Os lobbies são anônimos.** Nenhuma apresentação de lobby carrega a identidade do modo, embora ela já exista nos dados: `hue`, `motif` e o número de arcano em `data/modes.ts`, além da arte em `ModeArt.tsx`. A identidade vive só nas cartas de `/modos` e na página do modo. Detalhes na seção 4.
- **[P1] O tema é cenário na vitrine e ausente no balcão.** Home, modos e Gazeta estão "vestidos". `/lobbies`, onde o jogador passa o tempo, é uma tabela de SaaS escura com fio entre as linhas. Aqui o tema funciona como fantasia, não como produto.
- **[P2] Superfícies de template:** borda fina com sombra larga no quadro de andares e nos diálogos, e brilho radial nas cartas (ver detector). Trocar a elevação por material déco: fio duplo de latão, chanfro nos cantos ou recuo escalonado no topo, como a carta já faz.
- **[P2] O tema padrão ignora `prefers-color-scheme`** (`hooks/index.ts`, `useTheme` devolve sempre `'dark'`).
- **[P3] Um bundle só de 112 KB gzip.** A Gazeta, a página do modo e a de instalação poderiam carregar por rota.

### 3.2 Início (`/`)

- **[P1] No celular a cidade fica fora da primeira tela** (375×812). A primeira tela tem título em 4 linhas, texto de apoio em 6 linhas e dois botões empilhados; só aparece o rótulo "Madrugada na cidade". O ativo que distingue o site está na segunda dobra.
- **[P1] Hero longo no desktop:** o título ocupa 4 linhas a 92 px e o texto de apoio tem 33 palavras. Cortar o apoio para no máximo 20 palavras, por exemplo: "Anel que fecha, esconde-esconde na névoa, x1 com fila. Modos de jogadores, grátis, dentro do Deadlock." Alargar `.hero-copy` ou baixar o `clamp` para o título caber em 3 linhas.
- **[P2] O andar selecionado é difícil de achar:** contorno fino cor de osso, sem destaque da fachada. Quando o quadro de andares mostra "Andar 2 · NA", o olho não acha o andar.
- **[P2] Todos os andares são iguais.** Só o número de janelas acesas varia, então a cidade mostra lotação mas não mostra "o quê". Cheio, em partida e privado parecem a mesma coisa vistos de fora.
- **[P2] "Enchendo agora"** é a mesma linha de `/lobbies`, enxugada, em 2 colunas: 4 cartões de texto praticamente iguais logo abaixo do hero mais rico do site. A queda de energia é visível.
- **[P2] "Do site à partida em três passos"** é um template genérico (ver Taste). Ele poderia virar a própria rota do bonde: três estações num trilho, com o latão acendendo da estação 1 até a 3, e entrar no "Clique em Entrar" já mostrando um lobby real.
- **[P3] Quatro cartas iguais em leque.** O leque ajuda, mas a regra das "colunas iguais" continua valendo. Uma carta de destaque (o modo mais jogado agora) maior que as outras quebraria a simetria.

### 3.3 Lobbies (`/lobbies`)

- **[P1] Ação errada no seu próprio lobby.** Depois de "Abrir lobby", a linha "Lobby de Corvo_Noturno" (tag "você") mostra **"Entrar"**. O anfitrião já está lá: o certo é "Você está aqui" com "Convidar" e "Fechar lobby" (`LobbyAction.tsx`).
- **[P1] Lobby privado dá para entrar direto.**
  - "Clã Vigília (privado)" tem o ícone de cadeado ("Com senha") e mesmo assim mostra "Entrar".
  - O diálogo diz que o lobby "está esperando" e que o app "coloca você direto no lobby", e a entrada termina com sucesso.
  - O texto do diálogo de criar diz "só entra com convite".
  - Isso falha em três frentes: prevenção de erro, honestidade e consistência. `isJoinable` em `lib/lobbies.ts` não considera `locked`.
- **[P1] Sobreposição a 1440 px.** Em "Cofre com call, sem flame" (em partida, cheio), o botão "Avisar quando acabar" (218 px) começa 8 px antes do fim do texto "Em partida". A coluna de ação tem 8rem, mas os botões de aviso medem 210 a 218 px, então a borda direita da tabela fica serrilhada (`components.css`, `.lobby-row` acima de 48em).
- **[P1] Depois de entrar, nada muda na linha.** A contagem não sobe, não aparece "você está aqui" e o botão volta a "Entrar". Fica só o aviso flutuante.
- **[P2] "Aberto" com ponto verde em 15 de 18 linhas.** É informação redundante (aberto é o normal) e ocupa uma coluna inteira que poderia mostrar calor ou atividade.
- **[P2] O sinal de vida existe, mas não aparece.** A simulação faz alguém entrar a cada 3,8 s e o dado `minutesAgo` existe, mas a linha não mostra "entrou agora", "aberto há 3 min" nem a rodada em andamento. `minutesAgo` só serve para ordenar.
- **[P2] Celular:** cada lobby mede 196 px (cerca de 3 por tela) e a página tem 5.171 px para 18 lobbies. Não há vista compacta.
- **[P2] Link de modo com 16 px de altura** em cima do nome do lobby. No celular é fácil tocar sem querer e sair da página; fica abaixo dos 24 px do WCAG 2.5.8.
- **[P2] Título pulado:** h1 "Lobbies" vai direto para o h3 de cada linha.
- **[P2] Estado vazio de exemplo contraditório** (`?vazio=1`): o painel diz "16 lobbies abertos, 15 com vaga" e a lista diz "0 lobbies, nenhum lobby aberto". Zerar o painel junto.
- **[P3] O vazio filtrado não oferece o vizinho mais próximo.** Ex.: "Duelo à Meia-Noite em EU não tem lobby; em BR/SA tem 1, com 12 ms".

### 3.4 Diálogos (entrar e criar)

- **[P2] O círculo de espera é igual para todos os modos.** O sigilo é calculado só pelo número de vagas (`RitualCircle.tsx`), então Neblina e Círculo Profano ganham a mesma estrela. É o lugar mais óbvio para a arte do modo.
- **[P2] "Criar lobby" escolhe o modo num `<select>`.** É o único momento em que o jogador escolhe um modo e ele não vê a carta. Faltam também a prévia de como o lobby vai aparecer na lista e a explicação da diferença entre privado e com senha.
- **[P3] Borda fina com sombra larga** (detector).

### 3.5 Modos (`/modos`, `/modos/:slug`)

- **[P1] A página do modo não lista os lobbies do modo.** Tem "Entrar em lobby" (escolhe o melhor), "Criar lobby" e o link "Ver lobbies deste modo", mas nenhuma linha. É justamente onde a identidade do modo e a lista deveriam se encontrar.
- **[P2] No tema claro as cartas continuam escuras.** Como objeto físico até se defende, mas no claro elas parecem coladas de outro site. O ideal é uma carta clara (creme e tinta) com a moldura de latão.
- **[P3] Arte em traço SVG** (pendência já registrada): sem material próprio, as cartas dependem só da moldura.

### 3.6 Instalar (`/instalar`)

- **[P2] Linhas longas:** 89 a 111 caracteres nos itens e na nota de afiliação (detector). Limitar a cerca de 70ch.
- **[P3] Texto de abertura com 5 linhas no celular** antes do botão de download. No celular o download nem é a ação (o app é para Windows): a nota "No celular? O app é para Windows" poderia subir para o topo.

### 3.7 Novidades (`/novidades`)

- **[P2] No celular, a primeira tela é só cabeçalho e filtros:** três linhas de faixa da edição, o nome da Gazeta, duas linhas de apoio, busca, seletor e três etiquetas. A manchete só aparece depois da dobra. Juntar a faixa numa linha e recolher os filtros num botão.
- **[P3] Três cores de etiqueta** (verde, ferrugem, anil). Elas são semânticas, mas são as únicas cores fora de latão e verdete no site; conferir se o anil não briga com o céu.

### 3.8 404

- Funciona e tem voz. **[P3]** A cidade quieta está pequena e quase decorativa. Poderia usar a própria `CityScene` apagada, com uma janela acesa ("a sua").

---

## 4. Lobbies e servidores: variação (foco do pedido)

### 4.1 Diagnóstico: por que as apresentações de lobby não interessam

1. **Uma só forma para tudo.** "Enchendo agora", a tabela de `/lobbies`, o quadro de andares e o diálogo usam a mesma gramática: modo em texto cinza pequeno, nome em Big Shoulders 18 px, inicial do anfitrião num quadradinho, pips, região, barrinhas de ping e botão contornado. São 18 linhas com a mesma silhueta. Não há hierarquia entre um lobby quase lotado com dois amigos e um vazio do outro lado do mundo.
2. **A identidade do modo não chega ao lobby.** Cada modo já tem cor (`hue`), motivo (`rings`, `rails`, `fog`, `clock`, `vault`, `grid`), número de arcano e arte. Nada disso aparece fora das cartas: na lista, Círculo Profano e Neblina diferem por uma palavra cinza de 13 px.
3. **O dado ao vivo fica escondido.** O produto *é* gente entrando agora, e a simulação já gera isso. A lista não mostra quem entrou, há quanto tempo o lobby está aberto, se está esquentando nem em que rodada está a partida.
4. **Os estados não têm forma própria.** Cheio, em partida, privado, seu e "você entrou" são uma palavra e um botão diferente. Dois deles têm até a ação errada (seção 3.3).
5. **A coluna mais larga diz a coisa menos útil:** "Aberto", repetido em 15 linhas.
6. **A cidade mostra lotação, não caráter.** Todos os andares são a mesma fachada com janelas de latão.

O princípio que fecha com o resto do site: **a variedade tem de nascer do dado** (modo, lotação, ritmo de entrada, estado), não de decoração aleatória, do mesmo jeito que o recuo escalonado nasce da contagem de vagas.

**Regra de cor que precisa sobreviver:** latão é gente e ação, verdete é amigo e ao vivo. A cor do modo **nunca** entra nos pips nem nas janelas; ela fica no selo, no friso, na moldura e na arte.

### 4.2 Conceitos de variação

#### A. Selo e friso do modo (identidade por modo, a fundação)

- **Desenho:**
  - Cada lobby ganha à esquerda um **selo de 40 px**: o motivo do modo recortado da `ModeArt` (anel, trilho, névoa, relógio, cofre, grade) dentro de uma moldura com o numeral romano do arcano.
  - Um **friso de 3 px** na borda esquerda da linha usa o `hue` do modo, dessaturado e com luminosidade fixa (OKLCH), para o contraste não variar.
  - O nome do modo vira texto ao lado do selo, e o link para o modo passa a ser o selo inteiro (alvo de 40 px).
- **Por superfície:**
  - **Cidade:** o modo aparece na cornija de cada andar (um ornamento por motivo: roseta, trilho, onda, mostrador, ferrolho, grade) e numa faixa colorida estreita na lateral do andar.
  - **Quadro de andares:** ganha a arte do modo como faixa de fundo à direita, com opacidade baixa.
  - **Diálogo de entrar:** o sigilo central do círculo vira o motivo do modo.
  - **Criar lobby:** a escolha do modo vira uma fileira de mini cartas.
- **Estados:**
  - Cheio: o selo fica em tom pleno e a linha esmaece.
  - Em partida: o selo ganha um contorno animado lento (estático com movimento reduzido).
  - Privado: o selo ganha uma fechadura no canto.
  - Vazio: a lista não tem linhas, e o vazio mostra os selos dos 6 modos como atalhos de "abrir o primeiro".
- **Por que dá interesse:** a lista vira um mosaico de 6 identidades reconhecíveis à distância. O olho acha "os de Neblina" sem ler.
- **Celular:** o selo cai para 32 px e o friso fica igual. É a variação mais barata em altura.
- **Acessibilidade:** o selo é decorativo (`aria-hidden`) porque o nome do modo continua em texto. O friso não carrega significado sozinho. É preciso conferir o contraste de 3:1 do selo sobre o painel nos dois temas.
- **Esforço:** M (componente `ModeSeal`, 6 motivos em tamanho pequeno, tokens de cor).
- **Risco:** virar arco-íris e quebrar a regra "latão = gente". Mitigação: matiz só no selo e no friso, saturação baixa e nunca nos pips.

#### B. Ingresso com canhoto (vista rica)

- **Desenho:** cartão horizontal dividido por uma linha picotada. À esquerda, o "ingresso": selo do modo, nome do lobby grande, anfitrião, região e modo. À direita, o "canhoto": vagas em pips grandes, "Faltam 2" e o botão.
- **Estados como carimbo de texto:**
  - "LOTADO": carimbo inclinado sobre o canhoto, com o botão "Avisar quando vagar".
  - "EM PARTIDA" com "Rodada 3 de 5", ou "dá para entrar no meio".
  - "COM CONVITE": canhoto com fechadura e "Pedir convite".
  - "VOCÊ ESTÁ AQUI": canhoto em latão, com "Convidar" e "Sair".
  - Vazio: um ingresso em branco com "Abra a primeira sessão".
- **Por que dá interesse:** dá materialidade déco ao objeto central do produto, combina com "Em cartaz" (nome que a home já usa) e os estados ganham forma, não só cor.
- **Celular:** o canhoto desce para baixo do ingresso, como faixa destacável; o picote fica horizontal.
- **Acessibilidade:** o carimbo é texto real, não imagem. O picote é decorativo.
- **Esforço:** M.
- **Risco:** kitsch de vaudeville. Mitigação: nada de código de barras falso nem número de série; um ornamento só (o picote).

#### C. Sinais ao vivo (quem entrou agora, há quanto tempo, que rodada)

- **Desenho:** uma linha de atividade discreta abaixo do nome, que troca conforme o evento:
  - "Ametista entrou agora" (6 s, depois some);
  - "aberto há 3 min", vindo de `minutesAgo`;
  - "rodada 3 de 5, 07:40", para lobbies em partida (precisa do dado);
  - "começa quando fechar 12", ou a contagem regressiva, se houver regra de início.
- **Animação:** o pip que acabou de acender pisca uma vez em latão (600 ms), o mesmo "plim" visual da janela da cidade. Amigo entrando ganha o nome em verdete.
- **Estados:**
  - Cheio: "lotou há 1 min".
  - Privado: só a contagem, sem nomes.
  - Seu lobby: "2 entraram desde que você abriu".
- **Por que dá interesse:** a lista passa a ter pulso, e é a promessa central do produto ("veja quem está jogando agora") cumprida onde ela importa.
- **Celular:** uma linha só, truncada.
- **Acessibilidade:**
  - Nada de `aria-live` em cada linha. Uma região "Atividade" resumida, com `polite` e limite de 1 anúncio a cada 15 s.
  - Com movimento reduzido: sem piscar, só o texto.
- **Esforço:** S-M. `liveTick` já existe em `state/session.tsx`; falta emitir o evento com nome e horário.
- **Risco:** ruído. Mitigação: no máximo 1 evento visível por linha e 3 na tela.

#### D. Calor do lobby ("Esquentando", "Lotando", "Recém-aberto", "Quieto")

- **Desenho:** substitui a coluna "Aberto" por um rótulo calculado com regra explícita em `lib/lobbies.ts`:
  - **Lotando:** pelo menos 80% de ocupação e entrada nos últimos 2 min.
  - **Esquentando:** 3 ou mais entradas em 2 min.
  - **Recém-aberto:** aberto há menos de 2 min.
  - **Quieto:** nenhuma entrada há 10 min.

  A intensidade aparece como **brilho da faixa de pips**, sem fogo e sem emoji: mais quente é mais luz, coerente com a cidade.
- **Estados:** em partida e cheio mantêm o próprio rótulo; privado não mostra calor.
- **Por que dá interesse:** cria hierarquia real entre lobbies e dá à ordenação "Recomendados" um porquê visível.
- **Celular:** o rótulo vai ao lado do nome.
- **Acessibilidade:** o rótulo é texto e o brilho é redundante.
- **Esforço:** S.
- **Risco:** métrica inventada. Mitigação: definir as janelas de tempo com o backend e não publicar com número falso.

#### E. Lobby em destaque ("Em cartaz agora")

- **Desenho:** um painel largo no topo de `/lobbies`, que substitui a primeira linha de "Enchendo agora" na home.
  - Arte grande do modo à esquerda.
  - Círculo de espera médio (reaproveita o `RitualCircle`), com "Faltam 2" em display.
  - Anfitrião, região, ping e o porquê do destaque: "quase cheio, 2 amigos, 14 ms".
  - "Entrar" em latão cheio.
- **Escolha e rotação:** o critério é o `score()` que já existe. Quando lota, troca com uma transição curta ("Lotou. Próximo:").
- **Estados:**
  - Nenhum candidato: o painel vira "Abra o primeiro de [modo mais jogado]".
  - Você está nele: "Você está aqui", com o círculo acendendo.
- **Por que dá interesse:** quebra a monotonia com um "pico" (regra pico-fim) e dá à home um segundo momento forte depois da cidade.
- **Celular:** cartão de altura total com a arte em cima.
- **Acessibilidade:** um título h2 e a razão do destaque em texto.
- **Esforço:** M.
- **Risco:** favorecer sempre os mesmos. Mitigação: rodar entre modos e explicar o critério.

#### F. Agrupar por modo ou por hora

- **Desenho:** um seletor "Lista / Por modo".
  - **Por modo:** um bloco por modo com selo, nome, "3 abertos · 412 jogando" e as linhas compactas dentro, ordenadas por calor.
  - **Por hora:** "Começando agora", "Em partida", "Agendados", se um dia houver agenda.
- **Página do modo:** usa o próprio bloco do modo como "Lobbies abertos" (resolve o P1 da seção 3.5).
- **Por que dá interesse:** dá ritmo vertical (cabeçalho, linhas, cabeçalho) e transforma 18 itens em 6 grupos de no máximo 4, dentro do limite de memória de trabalho.
- **Celular:** grupos recolhíveis, com o primeiro aberto.
- **Acessibilidade:** cada grupo é uma seção com h2, o que também resolve o título pulado.
- **Esforço:** M.
- **Risco:** mais um controle na barra de filtros. Mitigação: manter a lista como padrão.

#### G. Vista compacta ou rica

- **Desenho:** botão "Compacta / Rica" ao lado de "Ordenar", guardado no navegador e na URL (`?vista=`).
  - **Compacta:** uma linha de 56 px com selo, nome, pips, ping e ação; cabem 10 a 12 por tela, inclusive no celular.
  - **Rica:** ingressos (B) com sinais ao vivo (C).
- **Por que dá interesse:** atende ao jogador que só quer achar rápido sem tirar a vitrine de quem está descobrindo, e corrige os 196 px por linha no celular.
- **Acessibilidade:** é um botão de alternância com `aria-pressed`; a ordem do DOM não muda.
- **Esforço:** S-M.
- **Risco:** manter duas apresentações. Mitigação: as duas usam os mesmos subcomponentes (`ModeSeal`, `SlotPips`, `LobbyAction`).

#### H. Região e ping como medidor de distância

- **Desenho:** em vez de "BR/SA + 3 barrinhas + 22 ms", um trilho curto com três paradas (BR, NA, EU) e o lobby marcado na sua parada; a espessura do trilho até você indica o ping. Em lobbies de outra região, o trilho fica tracejado.
- **Por que dá interesse:** conversa com o motivo do bonde e da cidade, e "longe" vira algo visual.
- **Celular:** some e fica só "BR/SA 22 ms".
- **Acessibilidade:** o rótulo atual (`pingLabel`) continua.
- **Esforço:** S.
- **Risco:** é a de menor valor; só faz sentido junto com A.

#### I. Anfitrião com rosto e reputação

- **Desenho:** o avatar real da Steam no lugar da inicial; uma pilha de até 3 avatares dos amigos que estão dentro; e, se o backend permitir, uma linha "hospedou 47 · 92% terminam".
- **Por que dá interesse:** gente reconhecível é o sinal mais forte para entrar, e tira o "avatar genérico".
- **Acessibilidade:** `alt` vazio no avatar, porque o nome já está em texto.
- **Esforço:** M (depende de dados).
- **Risco:** privacidade e métrica de reputação mal definida. Começar só com os avatares.

#### J. A cidade com estados (andares que se diferenciam)

- **Desenho:** cada andar ganha a cornija do modo (de A) e um estado visível de fora:
  - em partida: cortinas, janelas em listras;
  - cheio: letreiro pequeno "LOTADO" aceso no andar;
  - privado: persianas, janelas com traço horizontal;
  - seu: a janela "você" com moldura;
  - recém-aberto: o andar acende de baixo para cima, uma vez.
- **Por que dá interesse:** a cidade passa a contar o que está acontecendo, não só quanto.
- **Celular:** a torre BR/SA ganha os mesmos estados.
- **Acessibilidade:** o estado já está no `aria-label` do andar; a forma é redundante.
- **Esforço:** L.
- **Risco:** poluir uma imagem hoje elegante. Mitigação: um só sinal por estado e nada de cor nova.

### 4.3 Combinação recomendada

1. **A, Selo e friso do modo, em todo lugar:** lista, cidade, quadro de andares, diálogo e criar. É a fundação, barata, e resolve o "não interessante" pela raiz.
2. **C + D, Sinais ao vivo e calor,** no lugar da coluna "Aberto": a lista ganha pulso e hierarquia com dado que já existe.
3. **E, Lobby em destaque,** no topo da home ("Enchendo agora") e de `/lobbies`: um pico visual por tela.
4. **G, Compacta ou rica,** com a vista rica feita como **B (ingresso com canhoto)**: a compacta resolve o celular e a rica dá a vitrine.

Depois disso, com mais tempo: **F** (por modo, começando pela página do modo) e **J** (cidade com estados). **I** espera o backend.

---

## 5. Plano de melhorias

### 5.1 Rápidas (até 1 h cada)

1. **Seu lobby (`components/LobbyAction.tsx`):** com `lobby.mine`, trocar "Entrar" por "Você está aqui", com "Convidar" e "Fechar lobby". *Impacto:* corrige um erro de estado visível (P1).
2. **Lobby privado (`lib/lobbies.ts`, `LobbyAction.tsx`, `i18n/pt-BR.ts`):** `locked` não pode entrar direto. Mostrar "Pedir convite" (ou um passo "Tenho convite" no diálogo). Unificar "Com senha" e "só entra com convite" numa palavra só. *Impacto:* prevenção de erro e honestidade (P1).
3. **Sobreposição e coluna serrilhada (`styles/components.css`, `.lobby-row` acima de 48em):** a coluna de ação passa a ter largura fixa de cerca de 13rem com o botão em 100%, ou "Avisar quando acabar" vira ícone + "Avisar" com rótulo acessível completo. *Impacto:* tabela alinhada a 1440 px (P1).
4. **Tirar "Aberto" (`components/LobbyBits.tsx`, `LobbyRow.tsx`):** mostrar status só nas exceções (em partida, cheio). A coluna fica livre para o calor (D). *Impacto:* menos ruído e espaço para o que importa.
5. **Hero mais curto (`i18n/pt-BR.ts` `home.lead`, `styles/pages.css` `.hero-title`):** apoio com até 20 palavras e título em até 3 linhas. *Impacto:* hierarquia e primeira dobra.
6. **Título pulado (`pages/Lobbies.tsx`):** um h2 (pode ser visualmente oculto) "Lobbies abertos" antes da lista. *Impacto:* acessibilidade (detector).
7. **Link de modo na linha (`components.css` `.lobby-mode`):** alvo mínimo de 24 px, ou mover o link para o selo (A). *Impacto:* toque no celular.
8. **Tema pelo sistema (`hooks/index.ts` `useTheme`):** sem escolha salva, usar `prefers-color-scheme`. *Impacto:* respeito à preferência do usuário.
9. **Vazio de exemplo coerente (`pages/Lobbies.tsx`):** com `?vazio=1`, zerar também o painel de números. *Impacto:* evita a contradição na revisão.
10. **Linhas longas em `/instalar` (`styles/pages.css`):** `max-width: 70ch` nos itens e na nota de afiliação. *Impacto:* leitura (detector).

### 5.2 Médias (meio dia a 2 dias)

11. **`ModeSeal` e tokens do modo (A):**
    - Criar `components/ModeSeal.tsx`, reaproveitando os motivos de `ModeArt.tsx` em 32 a 40 px, com o numeral do arcano.
    - Usar `--mode-h` vindo de `mode.hue` (OKLCH com luminosidade fixa) em `.lobby-row`, no quadro de andares (`City.tsx`), no `RitualCircle` (sigilo central passa a ser o motivo) e no "Criar lobby" (mini cartas no lugar do `<select>`).
    - *Impacto:* alto. É o centro do pedido.
12. **Sinais ao vivo e calor (C + D):**
    - `state/session.tsx`: o `liveTick` passa a guardar `lastEvent` (quem, qual lobby, quando).
    - `lib/lobbies.ts`: novo `heat()` com as regras da seção 4.2 D.
    - `LobbyRow.tsx`: linha de atividade, "aberto há N min" e piscada do pip, respeitando movimento reduzido.
    - Uma região `aria-live` resumida.
    - *Impacto:* alto, porque a lista ganha pulso.
13. **Lobby em destaque (E):** criar `components/FeaturedLobby.tsx`, usado em `pages/Home.tsx` (topo de "Enchendo agora") e em `pages/Lobbies.tsx`, com a razão do destaque em texto. *Impacto:* alto na home.
14. **Lobbies na página do modo (`pages/Mode.tsx`):** seção "Lobbies abertos" com as linhas do modo, no estilo F. *Impacto:* fecha um P1 e conecta modo com lobby.
15. **Estado "você entrou" (`state/session.tsx`, `LobbyRow.tsx`):** depois de entrar, a linha sobe a contagem, marca "Você está aqui" e oferece "Sair". *Impacto:* visibilidade do estado.
16. **Celular primeiro na home (`pages/Home.tsx`, `styles/pages.css`, `styles/city.css`):** no celular, a torre BR/SA (ou uma faixa compacta dela) vem antes do texto de apoio, ou o apoio é cortado para a torre aparecer na primeira tela. *Impacto:* o ativo principal na primeira dobra.
17. **Vista compacta ou rica (G) em `pages/Lobbies.tsx`, com `?vista=`:** a compacta em 56 px. *Impacto:* densidade no celular e para quem joga sempre.
18. **Superfícies déco no lugar de sombra larga (`components.css`, `.directory`, `.dialog`):** fio duplo de latão e topo escalonado, como a carta. *Impacto:* tira as marcas de template apontadas pelo detector.

### 5.3 Grandes (mais de 2 dias)

19. **Ingresso com canhoto (B)** como a vista rica, com os carimbos de estado. *Impacto:* identidade forte no objeto central do produto.
20. **Cidade com estados (J) em `components/City.tsx` e `styles/city.css`:** cornija por modo, cortinas (em partida), letreiro (cheio), persianas (privado) e a janela "você". *Impacto:* a cidade passa a contar o que está acontecendo.
21. **Sala de espera `/lobbies/:id`:** o círculo grande com o motivo do modo, quem está dentro (avatares), anfitrião, regra de início e "Sair". A pesquisa já previa essa tela. *Impacto:* fecha o ciclo entrar, esperar e jogar.
22. **"Três passos" vira a linha do bonde (`pages/Home.tsx`):** trilho com três estações que acendem, e o passo 3 mostrando um lobby real. *Impacto:* tira o último template da home.
23. **Avatares reais da Steam e pilha de amigos (I)**, quando houver dado. *Impacto:* confiança e reconhecimento.
24. **Dividir o código por rota** (Gazeta, Modo, Instalar com `lazy`). *Impacto:* menos JS no primeiro carregamento.

**Ordem sugerida:** itens 1 a 4 (bugs de estado e layout); depois 11, 12 e 13 (a variação dos lobbies); depois 14 a 17; por último, os grandes.
