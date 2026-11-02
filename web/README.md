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
| `/` | Início: a Cidade Acesa (um prédio por região, um andar por lobby, uma janela por vaga), lista "Enchendo agora", modos em cartaz (cartas em leque), três passos |
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
    styles/city.css       a Cidade Acesa (prédios, janelas, quadro de andares, legenda)
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

## Direção visual (v3): Cidade Acesa

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
- **Martian Mono** (v4, camada técnica dos lobbies): idades, ping, contadores e a linha ao vivo. Largura fixa, então "entrou agora" trocando por "aberto há 3 min" não faz a linha pular. `@fontsource-variable/martian-mono@5.3.0`, importada pelos componentes de lobby.
- Auto-hospedadas por `@fontsource-variable/big-shoulders@5.3.0`, `@fontsource-variable/newsreader@5.3.0` e `@fontsource-variable/libre-franklin@5.2.8` (versões fixas, publicadas há mais de duas semanas). Nenhuma requisição ao Google Fonts.

### Movimento

- Um momento orquestrado na home: as janelas acendem uma vez, de baixo para cima (a lâmpada pega, falha e firma), primeiro na torre BR/SA e depois nos prédios do fundo. Depois disso, só acende janela quando alguém entra.
- Cartas: inclinação e brilho seguindo o mouse (só com ponteiro fino e hover); a arte da carta vira a arte do topo da página do modo por View Transition do mesmo documento (`document.startViewTransition`, sem o `<ViewTransition>` experimental do React). Sem suporte, navegação normal. Se o navegador não pintar (aba em segundo plano), a navegação acontece mesmo assim em até 0,5 s.
- O círculo de espera gira devagar e os segmentos acendem; a luz do mastro pisca devagar.
- `prefers-reduced-motion`: nada anima; as janelas aparecem já acesas, sem tilt, sem brilho, sem transição de página. Para testar, ative "Reduzir movimento" no sistema ou, no DevTools do Chrome, Rendering > Emulate CSS media feature prefers-reduced-motion.

### Desempenho (build de produção)

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
