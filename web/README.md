# Protótipo web: plataforma de modos da comunidade para Deadlock

Protótipo navegável (só front-end, dados fictícios) da plataforma. Nome ainda não decidido: o site usa o marcador **PROJETO**.

Projeto independente da comunidade. Não afiliado à Valve.

## Como rodar

Requer Node 20.19+ ou 22.12+.

```bash
cd web
npm install
npm run dev        # servidor de desenvolvimento em http://localhost:5173
npm run typecheck  # checagem de tipos (tsc --noEmit)
npm run build      # typecheck + build de produção em web/dist
npm test           # testes (vitest) das regras de lobby: estados, calor, filtros, "Jogar agora"
npm run preview    # serve o build em http://localhost:4173
```

## Rotas

| Rota | Tela |
| --- | --- |
| `/` | Início v4, "A Torre": torre déco em 3D feita dos lobbies ao vivo, percorrida pela rolagem em 6 cenas (torre, andares, cofre dos modos, elevador, placa do instalador, rua com a Gazeta). `?tier=low` força a versão sem 3D |
| `/lobbies` | "Em cartaz agora" no topo, lista em duas vistas (`?vista=compacta` ou `?vista=ingresso`), filtros com contagem, sugestão do vizinho mais próximo quando o filtro zera, Sessões do dia |
| `/jogar` | "Jogar agora": escolhe o melhor lobby com `pickBestLobby()` (o mesmo pool da lista), pede para entrar e leva a `/lobbies`. `?modo=slug` restringe a um modo |
| `/modos` | Todos os modos, como cartas de tarô |
| `/modos/:slug` | Detalhe do modo (ex.: `/modos/circulo-profano`): prévia, "Lobbies abertos" desse modo, Sessões do dia, regras, ranking, mudanças recentes |
| `/instalar` | Instalação com foco em confiança: o que é instalado e onde, hash SHA-256, antivírus, status do app |
| `/novidades` | A Gazeta: notas de versão como jornal (manchete, resumo, colunas), tags por tipo, filtro por modo e busca |

Os filtros de `/lobbies` e `/novidades` ficam na URL (`?modo=…&regiao=BR,NA&vagas=1&ordem=ping&vista=compacta`), então dá para compartilhar o link.
Para revisar o estado vazio sem filtros, use `/lobbies?vazio=1`.

## Estrutura

```
web/
  index.html              <title> inicial e meta tags (as fontes vêm do bundle, sem Google Fonts)
  public/grain.png        grão de filme (96 px, 9 KB), ladrilhado numa camada fixa
  src/
    config/brand.ts       BRAND_NAME (nome provisório) e dados do instalador
    i18n/pt-BR.ts         todas as strings de interface
    i18n/index.ts         idioma ativo + formatação de número e data
    styles/tokens.css     tokens de design (cores, tipo, espaço, raio, movimento; tema escuro e claro)
    styles/base.css       reset, foco, grão, View Transitions, prefers-reduced-motion
    styles/components.css botões, formulários, cabeçalho, lobby, diálogos, avisos
    styles/pages.css      layout de cada tela
    styles/city.css       a Cidade Acesa (prédios, janelas, quadro de andares, legenda); hoje é o nível baixo da home
    styles/torre.css      home v4: palco fixo, camada técnica (HUD), painéis de asfalto, cenas e nível baixo
    lib/tier.ts           nível de aparelho (alto, médio, baixo) e o parâmetro ?tier=
    lib/towerBus.ts       canal HTML ↔ cena 3D (progresso, andar em foco, rolagem → cena)
    lib/towerData.ts      andares a partir dos lobbies, ordem de chegada, temperatura do lobby
    lib/sound.ts          som de interface sintetizado (WebAudio), desligado por padrão
    components/Decode.tsx texto que se decifra (mono, sem reflow, estático com movimento reduzido)
    components/torre/     palco e esboço de carregamento, HUD, lista dos andares, cenas 3 a 6 em HTML
    three/                chunk 3D carregado depois da primeira pintura (R3F + cena + shaders próprios)
    styles/cards.css      cartas de modo (tarô), círculo de espera, View Transitions
    styles/gazette.css    a Gazeta (Novidades)
    styles/lobbies.css    lobbies v4: selo, friso, linha compacta, ingresso, destaque, sessões, diálogos (importado pelos componentes)
    data/*.ts             dados fictícios (modos, lobbies, notas de versão, instalação, números ao vivo)
    lib/lobbies.ts        regras de lobby: lobbyState() (rótulo + verbo), heat(), activity(), quórum, filtros com contagem, pickBestLobby()
    lib/lobbies.test.ts   testes (vitest) dessas regras
    lib/time.ts           faixa do dia (madrugada, manhã, tarde, noite) para a saudação
    lib/viewTransition.ts carta → página do modo com View Transitions (mesmo documento)
    state/session.tsx     estado simulado (login, app conectado, lobbies criados, gente entrando, avisos)
    components/           Shell, City (a cidade), TarotCard, RitualCircle, ModeSeal, LobbyRow/LobbyTicket/LobbyAction, FeaturedLobby, DaySessions, Deco, ModeArt, diálogos…
    pages/                uma tela por arquivo
```

## Onde trocar as coisas

- **Nome da plataforma:** `src/config/brand.ts` (`BRAND_NAME`). Também aparece no `<title>` inicial de `index.html`, no nome da Gazeta e no `favicon.svg`/marca (só o desenho, sem texto).
- **Cores, tipografia, espaçamentos:** `src/styles/tokens.css`. O tema claro é `[data-theme='light']`; o seletor no rodapé alterna e guarda a escolha no navegador.
- **Marca provisória:** `TowerMark` em `src/components/Deco.tsx` e `public/favicon.svg` (torre escalonada com uma janela acesa, sem texto).
- **Textos:** `src/i18n/pt-BR.ts`. Para adicionar inglês, crie `en.ts` com o mesmo tipo `Messages` e troque o objeto em `src/i18n/index.ts`. O conteúdo dos dados (nomes de modos, notas, manchetes) está em `src/data` e viria localizado do backend.

## O que é simulado

- **Entrar com a Steam:** só alterna um usuário fictício. Nenhuma autenticação real, nada é enviado.
- **App conectado:** começa desconectado. "Abrir o app" no diálogo de entrada ou "Simular app aberto" em `/instalar` muda o estado.
- **Entrar em lobby:** mostra as etapas "Baixando o modo… → Abrindo o Deadlock… → Entrando no lobby…" (simuladas; no produto cada etapa vem de um evento do app) e um aviso; não abre o jogo.
- **Criar lobby / Sair / Fechar / Convidar / Bater na porta / Treinar com bots / avisos / Marcar presença:** estado local; somem ao recarregar a página. "Convidar" copia um link de exemplo.
- **Bater na porta:** o anfitrião simulado sempre abre a porta depois de 6 s ("Porta aberta" e o botão vira Entrar).
- **Números ao vivo:** oscilam em torno de um valor fixo (`src/data/stats.ts`).
- **Gente entrando e saindo:** a cada 3,8 s alguém entra num lobby com vaga (uma janela acende na cidade e um segmento no círculo de espera) ou, às vezes, sai. Pausa com a aba oculta (`liveTick` em `src/state/session.tsx`).
- **Sessões do dia** (`src/data/sessions.ts`): horários e "N marcaram presença" são dados de exemplo; validar antes de publicar.
- **Download, hash e link do código-fonte:** valores de exemplo. O botão de download só mostra um aviso.

## Lobbies (v4, "A Torre")

Spec: seção "Lobbies" de `docs/design/brief-v4.md`, com os bugs e o plano de `docs/design/avaliacao-v3.md` e as recomendações de `docs/design/pesquisa-ux-lobbies.md`.

**Uma fonte de verdade.** `lobbyState(lobby, ctx, now)` em `src/lib/lobbies.ts` devolve o estado, o rótulo e o verbo de qualquer lobby. Lista, ingresso, destaque, quadro de andares da cidade e diálogos leem dela:

| Estado | Rótulo | Ação |
| --- | --- | --- |
| Aberto | (nenhum: aberto não grita) | Entrar |
| Seu lobby | Você está aqui | Convidar + Fechar |
| Já entrou | Você está aqui | Sair |
| Com convite | Com convite | Bater na porta, depois Pedido enviado, depois (Porta aberta) Entrar |
| Cheio | Lotado | Avisar quando vagar |
| Em partida | Em partida, rodada X de Y | Entrar no meio, se o lobby aceitar; senão Avisar quando acabar |

Lobby com convite nunca entra direto (`isJoinable` agora considera `locked`). Entrar noutro lobby quando você já está num pede confirmação ("Trocar de lobby?"; se o lobby for seu, avisa que ele fecha).

- **Identidade do modo:** `ModeSeal` é uma placa de 40 px (32 px no celular) com o topo escalonado, o motivo recortado da própria arte da carta (`ModeGlyph` em `ModeArt.tsx`) e o numeral do arcano. Um friso de 3 px na cor do modo marca linhas, ingressos, destaque e sessões. A cor do modo (`--mode-h`, OKLCH com luminosidade fixa) fica só no selo, no friso e na moldura da escolha de modo; as janelas continuam latão (gente) e verdete (amigo). O selo da linha é o link para o modo (alvo de 40 px).
- **Sinais ao vivo e calor no lugar de "Aberto":** cada lobby mostra uma linha em Martian Mono ("Ametista entrou agora", "aberto há 3 min", "Rodada 3 de 5, começou há 6 min", "lotou há 1 min", "2 entraram desde que você abriu"; o privado mostra só a contagem). Calor com regra pública em `heat()`: **Lotando** (80% ou mais e entrada nos últimos 2 min), **Esquentando** (3 entradas em 2 min), **Recém-aberto** (menos de 2 min), **Quieto** (ninguém entra há 10 min). O calor é mais luz nas janelas, não cor nova. A janela de quem acabou de entrar pisca uma vez (parada com movimento reduzido). O leitor de tela recebe um resumo, no máximo um a cada 15 s.
- **Quórum:** cada lobby tem `minPlayers`. Abaixo dele as janelas acesas ficam vazadas e um marco de latão mostra onde a partida começa ("Começa com 8"). O círculo de espera faz o mesmo.
- **Em cartaz agora** (`FeaturedLobby`): o lobby que `pickBestLobby()` escolhe, com o porquê em texto ("1 amigo dentro, falta 1, 22 ms"). Fica no mesmo lobby enquanto der para entrar; quando lota, troca e diz "Lotou. Próximo:". Se você está nele, vira "Você está aqui". Sem candidato: "Abra o primeiro de [modo mais jogado]".
- **Duas vistas:** compacta (linhas de 56 px no desktop, cerca de 60 px no celular, 10 a 11 por tela) e ingresso (cartão com picote, canhoto com janelas grandes e carimbos LOTADO, COM CONVITE, EM PARTIDA, VOCÊ ESTÁ AQUI). As linhas leem a largura da lista (container queries), então a mesma linha serve a `/lobbies`, a página do modo e o celular. A escolha fica na URL e no navegador; sem escolha, compacta no celular e ingresso no desktop. A coluna de ação tem largura fixa (nada se sobrepõe a 1440 px).
- **Filtros com contagem:** cada modo (com o selo), região e caixa mostra quantos lobbies devolve. A ordem padrão é "Mais gente agora": onde dá para entrar primeiro, depois mais jogadores, depois ping. Filtro zerado sugere o vizinho mais próximo ("Em BR/SA tem 1 (12 ms)", "Em qualquer modo: 3").
- **População baixa:** "Sessões do dia" (horários fixos da casa, num quadro de partidas, com "Marcar presença") em `/lobbies` e na página do modo; "Avise-me quando houver 3" por modo; o vazio (`?vazio=1`) zera os números, mostra os seis selos como atalho para abrir o primeiro lobby e sempre traz um próximo passo.
- **Diálogos:** o círculo de espera usa o motivo do modo como sigilo e mostra o quórum; "Bater na porta" pede o login (o anfitrião precisa saber quem é) e aceita um recado curto; "Criar lobby" escolhe o modo por mini-cartas, define "Começa com" e "Qualquer um" ou "Com convite", e mostra a prévia de como o lobby aparece na lista.
- **Depois de entrar:** a linha sobe a contagem, ganha "Você está aqui" e vai para o topo; a vaga fica reservada enquanto o app entra (o ao vivo não a ocupa).

**APIs para a home:** `pickBestLobby(lobbies, { mode?, region?, ctx?, now? })` e `lobbyState()` em `src/lib/lobbies.ts`; `<FeaturedLobby headingLevel mode? />`, `<ModeSeal mode size state link />`, `<LobbyRow lobby now? />` (a prop `mini` da v3 continua aceita), `<LobbyTicket />`, `<DaySessions mode? />`, `<QuorumAsk mode />`; e a rota `/jogar` para o botão "Jogar agora". Os estilos vêm junto com os componentes (`components/lobbyStyles.ts`), sem mexer no `main.tsx`.

**Fora deste ciclo:** página `/lobbies/:id` (sala de espera), fusão de lobbies, Maré, avatares reais e pilha de amigos, canal real dos avisos.

## Home v4: A Torre

Brief: `docs/design/brief-v4.md` (método do igloo.inc, com texto em HTML, rolagem nativa e um orçamento por aparelho). Uma torre art déco de obsidiana e latão, na névoa, com postes de luz de sódio. **Cada andar é um lobby, cada janela é uma vaga:** latão aceso = jogador, verdete = amigo, apagada = vaga livre. O recuo escalonado sai do dado (andares com mais vagas embaixo). Tudo é geometria procedural e shader; nada da Valve, nada baixado além do código.

### As cenas (rolagem nativa, câmera amortecida)

| # | Cena | 3D | HTML |
| --- | --- | --- | --- |
| 0 | Abertura | O esboço da torre em fio de latão acende andar por andar conforme o **progresso real** (fontes → módulo 3D → cena montada → ambiente → shaders compilados → primeiro quadro). Depois as janelas da torre 3D acendem **na ordem de chegada dos jogadores** (derivada de `minutesAgo`) | "Acendendo a cidade… 42%" no HUD |
| 1 | A torre | Contra-plongée, névoa, postes de sódio, asfalto molhado com reflexo; deriva lenta e paralaxe do mouse | Título (2 linhas), apoio (18 palavras), **Jogar agora** (vai para `/lobbies` por enquanto) e **Ver lobbies** (desce até a lista) |
| 2 | Os andares | A torre se separa em andares com etiqueta mono e fios de latão ligando andares do mesmo modo | Lista equivalente: selo do modo com friso, temperatura (Lotando, Esquentando, Recém-aberto, Quieto), "Fulano entrou agora", vagas e Entrar. Mouse ou foco numa linha acende o andar na torre. "Em cartaz agora" no topo |
| 3 | O cofre dos modos | Porão: seis cartas de vidro e latão num carrossel; a rolagem gira e traz uma por vez | Nome, regra em uma linha, o lobby mais cheio do modo e "Ver modo" |
| 4 | O elevador | Portas de latão gravadas e mostrador em meia-lua; o ponteiro para em Escolha, Instale e Jogue; na terceira parada as portas abrem | Uma frase por parada; a cabine mostra o lobby mais perto de lotar, com Entrar |
| 5 | A placa | Close de latão escovado com luz rasante que corre conforme a rolagem | Placa gravada (HTML selecionável): versão, tamanho, data, SHA-256 com Copiar, nota de antivírus, link para `/instalar`, "Não afiliado à Valve" |
| 6 | A rua | Volta ao asfalto; folhas da Gazeta voam com a velocidade da rolagem e assentam quando ela para | As três últimas manchetes reais da Gazeta e o rodapé |

**Camada técnica (Martian Mono, nos cantos):** em cima, marca + hora local da cidade (fuso do navegador) e nav, som e Steam; embaixo, jogadores agora + lobbies abertos e a cena atual (`§ 2/6 Os andares`) com uma régua de posição da rolagem (animação ligada à rolagem em CSS, sem JS). Os rótulos se decifram uma vez ao entrar (glifos de cifra; mono, então nada pula) e aparecem prontos com movimento reduzido. O cabeçalho é transparente no hero e ganha fundo depois dele.

**Som:** desligado por padrão. "Som: ligado" cria o `AudioContext` e sintetiza (WebAudio, zero arquivos) um clique de interruptor, um "plim" quando alguém entra num lobby (no máximo um a cada 1,2 s) e a campainha do elevador em cada parada. A escolha fica salva.

### Níveis de aparelho

| Nível | Quem | O que roda |
| --- | --- | --- |
| Alto | WebGL2 em GPU capaz | 18 andares, DPR até 1,5, passe de composição próprio (bloom pelas mips do quadro, aberração cromática nas bordas e na travessia do chão, vinheta, grão), 3 postes, 3 lençóis de névoa |
| Médio | Celular, GPU integrada modesta, ≤4 núcleos ou ≤4 GB | 12 andares, DPR até 1,25, sem composição, 2 postes, 1 lençol de névoa |
| Baixo | Sem WebGL2, GL por software, `prefers-reduced-motion`, `saveData`, aparelho fraco | Sem canvas e sem baixar o chunk 3D: a Cidade Acesa SVG do v3 no hero e o mesmo roteiro em HTML (cartas de tarô no cofre, três mostradores SVG no elevador, placa em CSS) |

- Detecção própria em `lib/tier.ts` (sem `detect-gpu`, que busca a base de benchmarks num CDN de terceiros a cada visita e parou de ser atualizada). Um monitor de quadros na cena **rebaixa** em tempo de execução: alto → médio se a média passar de ~29 ms por quadro; médio → baixo se passar de ~45 ms.
- **Para revisar um nível:** `/?tier=low`, `/?tier=mid` ou `/?tier=high`. O nível escolhido aparece em `data-tier` (e o motivo em `data-tier-reason`) na raiz da home.
- Em desenvolvimento, `window.__torre` expõe câmera e cena, e `window.__torreSettle = true` tira o amortecimento da câmera (útil para capturas de tela).

### Tema claro: amanhecer

O tema claro não vira planta na home 3D: vira **amanhecer**. Céu anil que clareia até um horizonte pêssego, névoa clara, a torre de obsidiana como silhueta e as janelas ainda acesas. Painéis e HUD usam os tokens do tema claro. No nível baixo continua a planta de arquiteto do v3.

### Técnica

- `three@0.186.1` + `@react-three/fiber@9.8.2`, sem drei e sem biblioteca de pós-processamento. A cena é montada imperativamente em `three/world.ts` (tudo que se repete é `InstancedMesh`: corpos, frisos, pilares, janelas) e desenhada em `three/TowerScene.tsx` num `useFrame` de prioridade 1. Nada de `setState` no laço; as etiquetas dos andares são movidas direto no DOM.
- Janelas com **interior falso** por shader (sala com abajur e, em metade delas, uma silhueta de gente), persiana quando o lobby está em partida, cortina quando é com convite, moldura verdete no seu lobby. Acender = a lâmpada pega, falha e firma (600 ms); só na entrada real de alguém.
- Luzes pontuais num banco fixo, reaproveitadas entre a rua e o porão (nenhum shader recompila na travessia). Shaders compilados antes de mostrar (`compileAsync`).
- A câmera lê `scrollY` uma vez por quadro dentro do laço (sem ouvir o evento de scroll) e mistura as poses das cenas numa zona de meia tela entre elas.

### Desempenho (build de produção)

| Parte | Tamanho (gzip) |
| --- | --- |
| JS da primeira pintura (`index` + `Icon` + `jsx-runtime`, as rotas internas viraram chunks próprios) | 91,4 + 21,6 + 3,6 = **116,6 KB** (orçamento 150) |
| CSS | 17,8 KB |
| Chunk 3D (`TowerScene`: three + R3F + cena), só depois da primeira pintura | **256,5 KB** (orçamento 280) |
| Rotas internas (Lobbies, Modos, Instalar, Novidades) | 2 a 3 KB cada |

Geometria e texturas são geradas no código (0 KB baixados). Fontes da home: Big Shoulders (58 KB), Libre Franklin (29 KB), Martian Mono (38 KB), mais Newsreader (58 KB, manchetes da Gazeta na rua) e Big Shoulders Stencil (37 KB, placa), todas `font-display: swap`.

## Home v5, leva 1: "A Obra Encantada"

Plano: `docs/design/diagnostico-assinatura.md` (itens 1, 3, 4 e 10, mais o pedaço do item 5 que serve à abertura). Contrato do kit: `docs/design/contrato-kit-torre.md`. A torre não aparece mais pronta: ela é **conjurada** na frente da pessoa, com o dado ao vivo.

### A abertura (nível alto, ~3,7 s depois que o 3D aparece)

| t (s) | O que acontece | De onde vem |
| --- | --- | --- |
| carregando | No esboço SVG, o **círculo ritual** da praça acende anel por anel com o progresso **real** (fontes → módulo 3D → cena → ambiente → shaders) e os fios âmbar sobem dele desenhando o esqueleto. HUD: "Riscando o círculo… 42%" | `TowerSketch.tsx` |
| 0,0 | O 3D assume do mesmo ponto: o círculo (azul-safira, shader num plano) inflama; a câmera começa alta, olhando a praça | `occult.ts` |
| 0,30 a 1,25 | **Fios âmbar** sobem do círculo e desenham o esqueleto 3D (cada segmento cresce do começo, ponta mais quente) | `createThreadMaterial` |
| 0,35 a 0,85 | O saguão sobe do chão, com um leve passo a mais (mola) | `world.ts` |
| 0,90 + 0,08 × n | **Andares caem do céu** na ordem de **criação** dos lobbies (`minutesAgo`), girando de 15° a 0°, com tranco de pouso e poeira de brasa. No alto, cada andar se condensa da fumaça na primeira metade da queda (dissolução por ruído com borda em brasa) | `lib/obra.ts`, `floorBuild()` |
| pouso + 0,10 | Ornamentos se aparafusam: pilastras giram 90° e encaixam, frisos e faixas abrem com mola (com o kit: módulos de fachada, cornijas e gárgulas) | `layout()` |
| ~2,3 a 3,1 | Os fios se soltam ponto a ponto; a coroa desce; a **agulha sobe de dentro** dela (com o kit, da lanterna aberta) | |
| ~3,5 | O farol pega em **chama azul fria**, com faíscas frias | `createFlame` |
| 1,8 a ~3,6 | **Uma brasa por jogador real** sai de um telhado da cidade e voa até a janela dele, na ordem real de entrada; a janela acende quando ela chega (amigos em verdete) | `planObra().embers` |
| clímax | A última janela acende → o título deixa de ser fio e **acende** como as janelas (pega, falha, firma). HUD: "Erguendo a torre…" → "Chegando gente…" → "Cidade acesa." | `data-obra` na raiz |

- **Qualquer gesto** (roda, toque, tecla, clique) pula: o relógio da obra acelera para o resto caber em 300 ms. Nada trava a rolagem nem o teclado.
- **Depois da abertura a obra continua viva:** lobby novo → andar conjurado (cai do céu se for o topo, entra como gaveta no meio da pilha; os de cima sobem um nível) e o HUD diz "Andar 07 erguido agora"; lobby que fecha → o andar se desfaz em fumaça e brasa (no médio, desaba sobre si) e os de cima descem. Alguém entrou → uma brasa voa da cidade até a janela e o círculo pulsa.
- **Médio:** sem fumaça e sem dissolução (os andares caem e assentam), até 400 brasas, sem cauda. **Baixo:** sem 3D; o esqueleto da cidade SVG se desenha em fio (`stroke-dashoffset`) e só depois ganha massa e janelas. **Movimento reduzido:** a torre aparece pronta, sem abertura (mesmo com `?tier=` forçado).

### Luz ilustrativa e duas temperaturas

- `three/illus.ts` costura nos materiais da torre (por `onBeforeCompile`, sem trocar de material): rampa quente e fria (sombra cai para o azul-safira, nunca para o preto), contorno de luz (lua fria por trás, sódio quente por baixo) e **fio de aresta** nas caixas, calculado em metros pela escala da instância (parece chanfro, custa zero geometria).
- Duas temperaturas com significado: **âmbar é gente** (janelas, brasas, fios da obra, sódio), **azul-safira é o sobrenatural** (céu alto, lua, círculo, farol, vidro da lanterna e olhos das gárgulas do kit). O verdete continua sendo amigo.

### Vista explodida de verdade (cena 2)

Cada andar se solta com atraso próprio (escada), gira no eixo vertical, inclina até ±4° e se afasta em Z conforme o modo; a **luz do interior vaza pelo vão** (faces de cima e de baixo acendem com a separação); cada andar ganha mira **"+ 07"** no remate direito (HTML, `aria-hidden`); os fios da constelação **se desenham** quando a cena entra. A lista ficou numa coluna de 30 rem à direita (linha em duas camadas), e a câmera recuou para a torre explodida caber inteira.

### Câmera heroica

Contra-plongée com a câmera quase no asfalto: a torre inteira ocupa ~65% da altura, à direita do título (no celular, no meio). Um primeiro plano fora de foco em espaço de tela (grade de ferro com lanças e poste com lanterna, contorno quente do sódio, paralaxe de perto com o mouse; no celular só a grade). O poste que cruzava a fachada saiu da frente.

### Kit do Blender (`public/models/torre-kit.glb`)

- `three/kit.ts`: melhoria progressiva. Se o arquivo existir e começar com a assinatura `glTF`, o `GLTFLoader` vem num **chunk próprio** (13,5 KB gzip, só baixa com o kit) e as peças trocam fachada, remates, cornija de recuo, gárgulas, pedestal (com pilastras e sol nos encaixes do modelador), coroa e agulha. Corpos, janelas, frisos e letreiros continuam do código (são o dado ao vivo). Peça ausente no arquivo = fica a procedural.
- Materiais pelo nome do Blender (`obsidian`, `brass`…); `glass` vira luz: âmbar no saguão, azul na lanterna e nas gárgulas.
- Sem o arquivo: no build, `__TORRE_KIT__` (vite.config.ts) é falso e nada é pedido; no dev, um arquivo ausente volta como `index.html` e é recusado pela assinatura, sem erro no console.
- **Para comparar:** `?kit=0` força a torre procedural. Em dev, `window.__torre.world.usingKit()` diz qual está valendo.

### Ferramentas de revisão (dev)

- `window.__torreObraT = 1.4` congela a abertura nesse instante (capturas de tela); `delete window.__torreObraT` solta.
- `window.__torre.replay()` reinicia a abertura; `window.__torre.floors()` devolve os andares atuais (para testar andar novo e andar desfeito com `__torre.world.setFloors(lista, 'live')`).

### Desempenho (build de produção, v5 leva 1)

| Parte | v4 | v5 leva 1 |
| --- | --- | --- |
| JS da primeira pintura (gzip) | `index` 96,1 + `i18n` 22,0 + `jsx-runtime` 6,0 = **124,1 KB** | `index` 110,0 + `jsx-runtime` 13,7 = **123,7 KB** (o Rollup juntou o `i18n` nos dois; o total não subiu) |
| CSS (gzip) | 26,5 KB | 27,0 KB |
| Chunk 3D `TowerScene` (gzip) | 256,8 KB | **269,2 KB** (orçamento 280) |
| `GLTFLoader` (gzip, só com o kit) | não existia | 13,5 KB |
| Kit `torre-kit.glb` | não existia | 242 KB |
| Chamadas de desenho no hero (alto) | n/d | 64 sem o kit, 92 com o kit (≈95 mil triângulos) |
| Chamadas de desenho no hero (médio) | n/d | 56 sem o kit, 86 com o kit (≈67 mil triângulos) |

Brasas: um `Points` só (uma chamada), animado no shader pelo relógio da obra. Círculo, fios, chama e primeiro plano: uma chamada cada.

## Direção visual (v3): Cidade Acesa

*A home v3 agora é o nível baixo da v4; o resto desta seção continua valendo para as outras telas.*

**O produto vira o cenário.** A home é o corte de prédios art déco à noite, gerado a partir dos lobbies: um prédio por região (BR/SA na frente, NA e EU ao fundo), um andar por lobby, uma janela por vaga. Janela acesa (latão, com brilho) é jogador, verde é amigo, apagada é vaga livre. Os andares com mais vagas ficam embaixo, então o recuo escalonado (setback) dos arranha-céus dos anos 1920 sai dos próprios dados. A ordem dos andares é estável: quando alguém entra, só a janela muda. Legenda fixa: "Cada janela acesa é um jogador. As verdes são seus amigos."

- **Interação:** passar o mouse, tocar ou focar um andar mostra o lobby no **quadro de andares** (o diretório do saguão): modo, anfitrião, região e ping, vagas, "Falta 1" e Entrar. O desenho é um `listbox` com um só ponto de tabulação: setas sobem e descem andares e trocam de prédio, Home/End vão ao topo e ao térreo, Enter leva ao botão Entrar. Cada andar tem rótulo completo para leitor de tela, e a lista "Enchendo agora", logo abaixo, é o equivalente em texto.
- **Celular:** só a torre BR/SA, vertical, com a linha "Também acesos: N em NA e N em EU" que leva à lista.
- **Tema claro:** a cidade vira planta de arquiteto (traço anil, quadrícula leve no fundo do hero).
- **Atmosfera barata:** grão de filme em PNG (camada fixa, sem blend mode), névoa e luz de latão como gradientes radiais, dois fachos de holofote estáticos, brilho das janelas por gradiente (sem filtro de blur), céu anil como terceiro tom da paleta.
- **Pedaços da direção C, só como componentes:** o **círculo de espera** (um segmento por vaga, acende conforme a turma chega) nos diálogos de entrar e de criar lobby; as **cartas de tarô** dos modos em `/modos`, na home (em leque) e em "Também em cartaz", com inclinação e brilho seguindo o mouse e a transição carta → página do modo.
- **Novidades = a Gazeta:** jornal dos anos 1920 inventado por nós ("Gazeta do PROJETO", segue o `BRAND_NAME`): faixa da edição com data e versão, manchete em serifa de jornal, resumo, mudanças em duas colunas com fio, gravura em retícula (halftone em CSS) da arte do modo mais citado, edições anteriores em colunas. No celular vira uma coluna só, na ordem do DOM. Cada versão ganhou o campo `headline` em `src/data/patches.ts`.
- **404:** "Essa rua não está no mapa", com a cidade quieta (janelas apagadas).

### Voz: "Luz Acesa"

Implementada a reescrita de `docs/design/avaliacao-texto.md` (seção 3): guia sóbrio com sotaque de cidade à noite, uma imagem por tela e sempre ancorada em dado real, zero metáfora em instalação, segurança, hash e afiliação. Inclui as correções de fato (grátis visível, "Achar uma partida", TL;DR do 0.9.3 com "cerca de 40%", nada de prometer jogadores, vazio filtrado com texto próprio e "Limpar filtros", "Entrar com a Steam" separado do "Entrar" do lobby, tagline do Cofre sem o "reforço" que não existe) e as microinterações baratas: legenda das janelas, saudação pelo horário ("Noite na cidade", "Boa noite, Corvo_Noturno."), "Falta 1 / Faltam 2" (só com até 2 vagas livres) e a 404. A manchete rotativa **não** foi feita (a avaliação desaconselha). Não há eyebrow acima do título da home; "grátis" está no texto de apoio.

**Decisões pendentes, marcadas no próprio site e no código:**
- **Anti-cheat e risco de banimento:** seção reservada em `/instalar` com o selo "Texto pendente". Não publicar vazia nem com texto inventado.
- **Código aberto:** fora dos selos de confiança; no rodapé aparece "Código aberto (em breve)", sem link, até o repositório ser público.
- **Canal do aviso** ("a gente avisa" pelo navegador ou pelo app): decidir antes de publicar.
- **Horário de pico:** dado de exemplo.

### Tokens principais (tema escuro / claro)

| Token | Escuro | Claro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#0f1413` | `#eef0ec` | fundo da página |
| `--surface` | `#141a19` | `#f9faf7` | painéis, cartas, quadro de andares |
| `--text` / `--text-muted` | `#ebe5d6` / `#a4aca6` | `#121816` / `#4a5451` | texto |
| `--accent` | `#d2a55a` | `#c99a4e` | botão principal, "você" |
| `--accent-text` | `#dcb26a` | `#7a5514` | latão como texto |
| `--sky-top` / `--sky-mid` | `#0a1120` / `#101a2b` | `#dfe5ee` / `#e9edf0` | céu anil (terceiro tom, só no céu) |
| `--facade` / `--facade-line` | `#131918` / `#2b3633` | `#f7f9f8` / `#3a5078` | prédios |
| `--win-lit` | `#f1c877` | `#b8812a` | janela acesa (jogador) |
| `--win-friend` | `#8fd8bb` | `#1b6a54` | janela de amigo |
| `--win-free` / `--win-free-line` | `#1b2322` / `#64716c` | `#e9edf2` / `#6d7b93` | vaga livre |

### Contraste (WCAG, medido a partir dos tokens)

| Par | Escuro | Claro |
| --- | --- | --- |
| título do hero sobre o céu | 15,0 | 14,2 |
| texto de apoio do hero sobre o céu | 7,5 | 6,2 |
| texto sobre fundo | 14,8 | 15,7 |
| texto secundário sobre painel | 7,6 | 7,5 |
| latão como texto sobre painel ("Andar 2", "Falta 1") | 8,9 | 6,4 |
| texto do botão principal sobre latão | 8,2 | 7,3 |
| janela acesa sobre fachada (gráfico, mínimo 3) | 11,2 | 3,2 |
| janela de amigo sobre fachada (gráfico) | 10,8 | 6,1 |
| contorno da vaga livre sobre fachada (gráfico) | 3,5 | 4,1 |
| segmento livre do círculo sobre painel (gráfico) | 3,2 | n/d |
| selo "Texto pendente" | 6,5 | 5,0 |

A cor nunca é o único canal: cada andar tem rótulo com "N de M vagas ocupadas, K amigos", e o quadro de andares e o círculo mostram os números.

### Tipografia

- **Big Shoulders** (títulos, números grandes, marca): grotesca condensada desenhada para a cidade de Chicago a partir da sinalização industrial e déco dos anos 1920 e 30. É vertical como os prédios escalonados, tem eixo de tamanho óptico e não lembra as fontes da Valve (Pulp, Occult). Substitui a Jost, que o site oficial do Deadlock também usa.
- **Libre Franklin** (texto e interface): mantida. Herdeira da Franklin Gothic (1902), legível em tamanho pequeno, com todos os acentos do pt-BR, e não aparece no site oficial.
- **Newsreader** (só na Gazeta): serifa feita para leitura de jornal (Production Type). Só baixa quando a página de Novidades abre.
- **Martian Mono** (v4, camada técnica, rótulos, hash e código): mono com eixo de largura; o texto se decifra sem pular o layout.
- **Big Shoulders Stencil** (v4): só na placa de latão do instalador.
- Auto-hospedadas por `@fontsource-variable/big-shoulders@5.3.0`, `@fontsource-variable/big-shoulders-stencil@5.3.0`, `@fontsource-variable/martian-mono@5.3.0`, `@fontsource-variable/newsreader@5.3.0` e `@fontsource-variable/libre-franklin@5.2.8` (versões fixas, publicadas há mais de duas semanas). Nenhuma requisição ao Google Fonts.

### Movimento

- Um momento orquestrado na home: as janelas acendem uma vez, de baixo para cima (a lâmpada pega, falha e firma), primeiro na torre BR/SA e depois nos prédios do fundo. Depois disso, só acende janela quando alguém entra.
- Cartas: inclinação e brilho seguindo o mouse (só com ponteiro fino e hover); a arte da carta vira a arte do topo da página do modo por View Transition do mesmo documento (`document.startViewTransition`, sem o `<ViewTransition>` experimental do React). Sem suporte, navegação normal. Se o navegador não pintar (aba em segundo plano), a navegação acontece mesmo assim em até 0,5 s.
- O círculo de espera gira devagar e os segmentos acendem; a luz do mastro pisca devagar.
- `prefers-reduced-motion`: nada anima; as janelas aparecem já acesas, sem tilt, sem brilho, sem transição de página. Para testar, ative "Reduzir movimento" no sistema ou, no DevTools do Chrome, Rendering > Emulate CSS media feature prefers-reduced-motion.

### Desempenho (v3, histórico)

- JS: 357,9 KB (112,4 KB gzip, medido pelo Vite) num único arquivo. CSS: 61,0 KB (13,2 KB gzip). Orçamento da pesquisa: 150 KB de JS gzip.
- Fontes por página: Big Shoulders latin (58 KB) e Libre Franklin latin (29 KB); a Newsreader latin (58 KB) só em Novidades.
- Sem three.js, sem biblioteca de animação, sem canvas. Dependências novas: só as duas fontes.
- **Depois dos lobbies v4:** JS 394,2 KB (122,5 KB gzip); CSS 90,3 KB (21,8 KB gzip). Novas dependências: `@fontsource-variable/martian-mono@5.3.0` (latin 23,6 KB, o navegador só baixa quando a página usa a camada técnica) e `vitest@4.1.12` (só desenvolvimento).

## Pendências conhecidas

- Sem testes automatizados.
- Notas de versão e ranking não paginam.
- Sem tradução em inglês ainda (estrutura pronta).
- A arte dos modos continua sendo desenho de linha em SVG; quando houver material próprio (sem arte da Valve), ele entra nas cartas.
- Anti-cheat e risco de banimento: texto pendente (ver acima).
- A cidade comporta bem até uns 15 andares por prédio; com muito mais lobbies, agrupar por modo ou paginar os andares.
- **Home v4:** sem kit de andares do Blender nem pôster renderizado (o esboço em SVG faz o papel do pôster); "Jogar agora" ainda leva a `/lobbies` (entrada rápida é de outra frente); "Fulano entrou agora" usa nomes simulados porque o protótipo não sabe quem entrou; as fontes da home somam ~220 KB (acima dos 120 KB do brief, por causa da Newsreader e da Stencil, que poderiam sair da home); nenhum teste num Android de entrada real ainda (só emulação de 375 px).
