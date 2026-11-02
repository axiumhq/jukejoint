# Protótipo web: plataforma de modos da comunidade para Deadlock

Protótipo navegável (só front-end, dados fictícios) da plataforma. Nome ainda não decidido: o site usa o marcador **PROJETO** (`src/config/brand.ts`).

Projeto independente da comunidade. Não afiliado à Valve.

Versão atual: **v6, "Minimal + cinema"** (`docs/design/brief-v6.md`, a partir de `docs/design/auditoria-fria.md`). Um site quieto e preciso, com um único momento de cinema: a arte-chave pré-renderizada no Blender. Tudo o mais é tipografia, grade e dados ao vivo.

## Como rodar

Requer Node 20.19+ ou 22.12+.

```bash
cd web
npm install
npm run dev        # servidor de desenvolvimento em http://localhost:5173
npm run typecheck  # checagem de tipos (tsc --noEmit)
npm test           # testes (vitest) das regras de lobby: estados, calor, filtros, "Jogar agora"
npm run build      # typecheck + build de produção em web/dist
npm run preview    # serve o build em http://localhost:4173
```

## Rotas

| Rota | Tela |
| --- | --- |
| `/` | Herói com a arte-chave entre faixas de cinema, lobbies abertos agora (5 linhas), modos em cartaz (linha tipográfica), o que entra no seu PC, rodapé. Cerca de 3,4 telas a 1440×900 |
| `/lobbies` | Tabela precisa (linhas de 60 px, 9 visíveis a 1440×900), filtros numa linha (modo, região, só com vaga, só amigos). O recomendado é a primeira linha |
| `/jogar` | "Jogar agora": escolhe com `pickBestLobby()` (o mesmo pool da lista), pede para entrar e leva a `/lobbies`. `?modo=slug` restringe a um modo |
| `/modos` | Os seis modos em linhas tipográficas: nome, uma frase, formato, jogadores e lobbies agora, e o diagrama pequeno do modo |
| `/modos/:slug` | Detalhe do modo: fatos, entrar ou criar, a mesma tabela de lobbies (só desse modo), sobre, regras, ranking, mudanças recentes |
| `/instalar` | Instalação com foco em confiança: download, hash SHA-256, status do app, antivírus, o que é instalado e onde, o que o app faz e não faz |
| `/novidades` | Lista editorial de versões: data com ano, manchete, resumo, contagem por tipo e as mudanças recolhidas |

Os filtros de `/lobbies` (`?modo=…&regiao=BR,NA&vagas=1&amigos=1`) e de `/novidades` (`?modo=…`) ficam na URL. Para revisar o estado vazio: `/lobbies?vazio=1`.

## Regras do v6

1. **Um efeito só:** a arte-chave no herói. Nada de chuva, partículas, holofotes em código, cartas que inclinam ou carimbos.
2. **Nada de 3D em tempo real.** `three`, `@react-three/fiber` e `@types/three` saíram do projeto.
3. **Um sistema de tipo:** Bodoni Moda nos títulos, Mona Sans no texto e na interface, Fragment Mono só em números (contagens, ping, vagas, versões; e no hash e caminhos de instalação, que são código).
4. **Um cabeçalho e um rodapé** (`SiteHeader` e `SiteFooter` em `components/Shell.tsx`). Na home, o mesmo cabeçalho mora dentro da faixa de cinema de cima (variante `overlay`).
5. **Uma cor de destaque:** a luz de sódio, só em ação e em gente. O verdete só quer dizer amigo ou ao vivo.
6. **Uma fonte de verdade para as contagens:** `liveStats()` em `src/lib/stats.ts` (hook `useLiveStats()`). Jogando agora é a soma dos jogadores nos lobbies; lobbies abertos é a lista inteira (o mesmo número que `/lobbies` mostra sem filtro); com vaga é `isJoinable`. Por modo, as mesmas regras, e a soma dos modos é o total. Cabeçalho, lista, modos e home sempre batem.

## O herói e o loop de vídeo

- **Imagem parada (sempre presente):** `public/media/heroi-1280|1920.{avif,webp,jpg}` em paisagem e `heroi-m-600|900.{avif,webp,jpg}` em retrato (celular, tablet em pé), num `<picture>` com `srcset`. No desktop o navegador baixa o AVIF de 1920 (154 KB); no celular, o AVIF de 900 (106 KB). As fontes originais estão em `prototipos/direcoes/img/`.
- **Abertura:** as faixas de cinema começam fechadas e abrem (1,4 s) enquanto a imagem surge do preto; o título, o apoio e os créditos entram em seguida. Depois, um ken burns lento (48 s, ida e volta). Com `prefers-reduced-motion`: o quadro final, parado, sem transição.
- **Loop de vídeo (quando o render chegar):** coloque em `public/media/` os arquivos `heroi.webm`, `heroi.mp4`, `heroi-poster.jpg` e, para retrato, `heroi-mobile.webm` e `heroi-mobile.mp4`. O `vite.config.ts` verifica quais existem quando o servidor ou o build começa (`__HERO_VIDEO__`), então o site nunca pede um arquivo que não existe (sem 404 no console). **Colocou os arquivos? Reinicie o `npm run dev` ou rode o build de novo.**
- **Quando o vídeo toca** (`components/HeroMedia.tsx`): só se o arquivo existe para a orientação atual, sem movimento reduzido e sem economia de dados (`navigator.connection.saveData` ou `prefers-reduced-data`). O `<video muted loop playsinline autoplay>` fica por cima da imagem e só aparece (fade de 0,9 s) quando dispara o evento `playing`; se falhar, a imagem continua. Pausa fora da tela (IntersectionObserver) e com a aba oculta. Sem vídeo de retrato, o celular fica com a imagem parada.

## Lobbies

A lógica é a da v4, testada (22 testes em `src/lib/lobbies.test.ts`); o v6 mudou só a apresentação.

- `lobbyState(lobby, ctx, now)` dá o estado, o rótulo e o verbo de cada lobby. A tabela (`components/LobbyTable.tsx`) e os diálogos leem dela.
- **Um botão por linha** (`components/LobbyAction.tsx`): Entrar, Entrar no meio, Bater na porta, Pedido enviado, Avisar quando vagar ou quando acabar, Sair. O seu lobby tem Convidar e um botão de fechar ao lado.
- **Estados em texto curto** na linha de baixo do nome: "Você está aqui", "Com convite", "Porta aberta", "Lotado", "Em partida, rodada 3 de 5". Sem estado, a linha mostra amigos (em verdete, só com login), quórum ("Começa com 8: falta 1") ou a atividade ("Ametista entrou agora", "aberto há 3 min").
- **Vagas como janelinhas:** acesa em sódio = jogador, verdete = amigo, contorno = vaga livre, mais o número `9/12`. No tablet ficam só os números.
- **Recomendado = primeira linha** (`hooks/useFeatured.ts`): o lobby que `pickBestLobby()` escolhe, o mesmo do "Jogar agora", com fundo levantado, o único botão cheio da tabela e o porquê ("Recomendado: falta 1"). O ping não se repete (já está na coluna Servidor) e ele não aparece duas vezes. Fica o mesmo enquanto der para entrar; quando lota ou você entra, o próximo assume.
- **Ordem:** seus lobbies (o que abriu ou em que entrou) no topo, depois o recomendado, depois "mais gente agora".
- **Diálogos** (`components/SessionDialogs.tsx`): entrar (pede o app, avisa partida em andamento, quórum e troca de lobby), bater na porta (pede login e aceita recado), criar lobby (modo, nome, região, vagas, "Começa com", acesso).

Saíram da v4/v5: a vista "ingresso", o painel "Em cartaz agora", selos e frisos por modo, chips de calor, o círculo de espera, as "Sessões do dia" e o pedido "Avise-me quando houver 3".

## Estrutura

```
web/
  index.html               <title> inicial e meta tags (fontes vêm do bundle)
  vite.config.ts           build; detecção dos arquivos de vídeo do herói (__HERO_VIDEO__)
  public/media/            arte-chave do herói (AVIF, WebP, JPG) e, quando houver, o loop de vídeo
  src/
    config/brand.ts        BRAND_NAME (nome provisório) e dados do instalador
    i18n/pt-BR.ts          todas as strings de interface; i18n/index.ts: idioma ativo e formatação
    styles/tokens.css      cor, tipo, espaço, forma e movimento
    styles/base.css        reset, tipo, botões, formulários, cabeçalho e rodapé, filtros, diálogo, avisos
    styles/home.css        herói (faixas, abertura, ken burns), modos em linha, confiança
    styles/lobbies.css     a tabela de lobbies (desktop, tablet, celular)
    styles/pages.css       modos, modo, instalar, novidades, 404
    data/*.ts              dados fictícios (modos, lobbies, notas de versão, instalação)
    lib/lobbies.ts         regras de lobby (lobbyState, heat, activity, filtros, pickBestLobby) + testes
    lib/stats.ts           contagens ao vivo, a única fonte de verdade
    state/session.tsx      estado simulado (login, app, entrar, sair, porta, criar, avisos, gente entrando)
    hooks/                 useLiveStats, useFeaturedLobby, useNow, media queries
    components/            Shell (cabeçalho, rodapé, layout), HeroMedia, LobbyTable, LobbyAction,
                           SessionDialogs, Dialog, Common (créditos, campo de cópia), ModeArt, Icon
    pages/                 uma tela por arquivo
```

Os kits 3D da v4/v5 (`torre-kit.glb`, `cidade-kit.glb`) foram para `art/models/`, fora do build.

## Onde trocar as coisas

- **Nome da plataforma:** `src/config/brand.ts` (`BRAND_NAME`) e o `<title>` inicial de `index.html`. A marca provisória é uma janela acesa (retângulo de sódio) ao lado do nome, em `Wordmark` (`components/Shell.tsx`) e `public/favicon.svg`.
- **Cores, tipo, espaços:** `src/styles/tokens.css`.
- **Textos:** `src/i18n/pt-BR.ts`. Para inglês, crie `en.ts` com o tipo `Messages` e troque o objeto em `src/i18n/index.ts`. Conteúdo (modos, notas) fica em `src/data`.
- **Frase de cada modo** (home e índice): campo `line` em `src/data/modes.ts`.

## Tipos e tokens

| Papel | Família | Pacote (auto-hospedado) |
| --- | --- | --- |
| Títulos | Bodoni Moda (eixo de tamanho óptico, peso 500) | `@fontsource-variable/bodoni-moda@5.3.0` (`opsz.css`) |
| Texto e interface | Mona Sans (variável, só eixo de peso) | `@fontsource-variable/mona-sans@5.3.0` (`wght.css`) |
| Números | Fragment Mono 400 | `@fontsource/fragment-mono@5.3.0` (`latin-400.css`) |

Na home baixam três arquivos latinos: Bodoni 46 KB, Mona Sans 40 KB, Fragment Mono 25 KB.

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0a0d12` | azul-noite: fundo e faixas de cinema |
| `--raise` / `--raise-2` | `#11151c` / `#171c24` | linha recomendada, hover, diálogo |
| `--ink` / `--ink-2` / `--ink-3` | `#ece7dc` / `#aaadb2` / `#858a92` | tinta clara quente em três tons |
| `--sodium` | `#f2a33a` | o único destaque: ação e gente |
| `--verdigris` | `#6cc2a8` | só amigo e ao vivo |

Contraste medido (WCAG): tinta 15,8:1, tinta 2 8,6:1, tinta 3 5,6:1 sobre o fundo (4,9:1 sobre `--raise-2`); texto do botão sobre o sódio 8,9:1; verdete 9,2:1. Tudo acima de AA.

## Desempenho (build de produção, v6)

| Parte | v5 leva 2 | v6 |
| --- | --- | --- |
| JS da primeira pintura (gzip) | `index` 110 + `jsx-runtime` 14 + chunk 3D 281 | `index` 74 + `hooks` 30 (React, roteador, sessão) |
| CSS (gzip) | (vários arquivos) | 9,3 KB |
| Home a frio, transferido | ~1,30 MB | **376 KB** no desktop, **328 KB** no celular (DPR 3) |
| Fontes na home | 3 famílias, ~220 KB | 3 arquivos, 111 KB |

Medido com Chrome headless no `vite preview` (que serve gzip). LCP: a imagem do herói em ~0,2 s no desktop.

## O que é simulado

- **Entrar com a Steam:** só alterna um usuário fictício. Nada é enviado. Amigos só aparecem com login.
- **App conectado:** começa desconectado. "Abrir o app" no diálogo de entrada ou "Simular app aberto" em `/instalar` muda o estado.
- **Entrar em lobby:** etapas "Baixando o modo…, Abrindo o Deadlock…, Entrando no lobby…" simuladas; não abre o jogo.
- **Criar, sair, fechar, convidar, bater na porta, treinar com bots, avisos:** estado local; somem ao recarregar. O anfitrião simulado sempre abre a porta depois de 6 s.
- **Gente entrando e saindo:** a cada 3,8 s alguém entra num lobby com vaga ou sai (`liveTick` em `src/state/session.tsx`); as contagens acompanham. Pausa com a aba oculta.
- **Download, hash e link do código-fonte:** valores de exemplo.

## Histórico

As direções anteriores estão no histórico do git, com os documentos em `docs/design/`:

- v3 "Cidade Acesa" (cidade em SVG), v4 "A Torre" (3D procedural em tempo real, commit `528d8de` e anteriores) e v5 "A Obra Encantada" / "a cidade viva" (commit `70e06b5`). A auditoria fria (`docs/design/auditoria-fria.md`) explica por que esse caminho saiu.
- As prévias que levaram ao v6 estão em `prototipos/direcoes/` (`minimal.html` e `cinematografico.html` foram as escolhidas).

## Pendências conhecidas

- **Nome e logotipo:** decisão do dono; tudo segue centralizado em `BRAND_NAME`.
- **Loop de vídeo:** o encaixe está pronto, faltam os arquivos do render.
- **Anti-cheat e risco de banimento:** texto pendente em `/instalar`; não pode ser publicado vazio nem inventado.
- **Dados:** os números são do mock (cerca de 140 jogadores em 18 lobbies). Com backend, `liveStats()` continua sendo o único lugar que conta.
- Sem tradução em inglês ainda (estrutura pronta). Notas de versão e ranking não paginam.
- Teste num Android de entrada real ainda não feito (só emulação de 375×812).
