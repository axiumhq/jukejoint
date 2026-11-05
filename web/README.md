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
| `/` | Home v8: aviso dispensável, recomendado (barra de dados, Ver sala / Jogar agora), modos ao vivo (6 capas que filtram), lobbies abertos (abas, chips, cartões ou compacto) e chegando agora (com Pausar). Trilho social fixo à direita |
| `/lobbies` | Tabela precisa (linhas de 60 px, 9 visíveis a 1440×900), filtros numa linha (modo, região, só com vaga, só amigos). O recomendado é a primeira linha |
| `/jogar` | "Jogar agora": escolhe com `pickBestLobby()` (o mesmo pool da lista), pede para entrar e leva a `/lobbies`. `?modo=slug` restringe a um modo |
| `/modos` | Os seis modos em linhas tipográficas: nome, uma frase, formato, jogadores e lobbies agora, e o diagrama pequeno do modo |
| `/modos/:slug` | Detalhe do modo: fatos, entrar ou criar, a mesma tabela de lobbies (só desse modo), sobre, regras, ranking, mudanças recentes |
| `/instalar` | Instalação com foco em confiança: download, hash SHA-256, status do app, antivírus, o que é instalado e onde, o que o app faz e não faz |
| `/novidades` | Lista editorial de versões: data com ano, manchete, resumo, contagem por tipo e as mudanças recolhidas |

Os filtros da home (`?modo=…&regiao=BR,NA&vagas=1&amigos=1&favoritos=1&iniciantes=1&partida=1&ping=30`; `/lobbies` redireciona para cá) e de `/novidades` (`?modo=…`) ficam na URL. Para revisar o estado vazio: `/?vazio=1`.

## Regras do v8 (docs/design/v8-estrutura.md)

1. **Esqueleto da pele B, pele do Deadlock:** barra superior + coluna principal + trilho social fixo (`components/Shell.tsx`). Abaixo de 960 px o trilho vira folha de baixo; no celular, a barra "Jogar agora" fica fixa embaixo.
2. **Cinco temas por tokens** (`styles/tokens.css`, `lib/theme.ts`, `state/theme.tsx`): Deadlock (padrão), Carmim, Pergaminho, Gelo e Grafite. O script inline de `index.html` aplica o salvo (`localStorage['lobby.theme']`) antes de pintar; `?theme=<id>` força um tema para captura.
3. **Capas e ícones dos modos em SVG** (`lib/cover.ts`, `components/ModeCover.tsx`; cenas em `src/assets/modes/scenes/*.tokens.svg`, uma por chunk; ícones em `icons/`) inlinados e pintados só com tokens do tema: trocar o tema repinta. Estáticas; só o zoom de 5% no hover.
4. **Um sistema de tipo:** Roboto Serif condensada só em títulos grandes, logotipo, títulos de seção em dois tons e rótulos `.cap`; Geist na interface (12–13,5 px); Geist Mono nos números.
5. **Um sistema de acento:** `--acc` para agir, `--acc-tx` para chamar atenção no texto, `--live` só para presença.
6. **Uma fonte de verdade para as contagens:** `liveStats()` em `src/lib/stats.ts` (hook `useLiveStats()`). Barra superior, modos e lobbies sempre batem; amigos vêm de `friendsOnline()`.
7. **O trilho por tela:** `<Rail title="…">…</Rail>` (`components/Rail.tsx`) põe o conteúdo no trilho fixo; sem `<Rail>`, a casca mostra o social padrão.

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
  index.html               <title> inicial, meta tags e o script de tema antes de pintar
  src/
    config/brand.ts        BRAND_NAME (nome provisório, ainda não decidido) e dados do instalador
    i18n/pt-BR.ts          todas as strings de interface; i18n/index.ts: idioma ativo e formatação
    styles/tokens.css      os cinco temas + tokens fixos (+ aliases v6 para as telas da fase 2)
    styles/base.css        reset, tipo, botões, chips, etiquetas, avatares, capas, line-art, formulários
    styles/shell.css       barra superior, busca, menus, trilho/folha, aviso, toasts, espera de rota
    styles/home.css        recomendado, modos ao vivo, chegando agora, barra móvel
    styles/lobbies.css     abas, chips, cartões e lista compacta
    styles/pages.css, room.css   telas da fase 2
    lib/                   lobbies, room, friends, stats, theme, avatar, cover, search, lobbyCard (+ testes)
    state/                 session.tsx (sessão simulada), liveSession.tsx (ao vivo), useDesktopApp.ts e
                           engineHandoff.ts (dentro do app desktop), theme.tsx (tema e menu)
    hooks/                 useLiveStats, useFriends, useIncomingInvite, useFavorites, usePref, useLobbyFilters…
    components/            Shell, Rail, Search, ThemeMenu, Friends (trilho social), Recommended,
                           LobbyBrowser, LobbyCard, LobbyAction, Arrivals, Avatar, ModeCover, LineArt,
                           Common (Chip, Tag, LiveDot, SectionTitle, CopyField), Icon; compat: LobbyTable, ModeArt
    pages/                 uma tela por arquivo
```

## Onde trocar as coisas

- **Nome da plataforma:** `src/config/brand.ts` (`BRAND_NAME`) e o `<title>` inicial de `index.html`. A marca provisória (anel aberto) é `BrandMark` em `components/Icon.tsx`.
- **Cores, tipo, espaços:** `src/styles/tokens.css`.
- **Textos:** `src/i18n/pt-BR.ts`. Para inglês, crie `en.ts` com o tipo `Messages` e troque o objeto em `src/i18n/index.ts`. Conteúdo (modos, notas) fica em `src/data`.
- **Frase de cada modo** (home e índice): campo `line` em `src/data/modes.ts`.

## Tipos

| Papel | Família | Pacote (auto-hospedado, versão fixa) |
| --- | --- | --- |
| Títulos, logotipo, rótulos `.cap` | Roboto Serif (eixos de largura e tamanho óptico) | `@fontsource-variable/roboto-serif@5.3.0` (`standard.css`) |
| Interface | Geist | `@fontsource-variable/geist@5.3.0` |
| Números | Geist Mono | `@fontsource-variable/geist-mono@5.3.0` |

Contraste no tema Deadlock (WCAG): `--tx-3` 5,8:1 sobre `--s2` e 5,2:1 sobre `--s3`; texto do botão sobre o acento 8,5:1.

## O que é simulado

- **Entrar com a Steam:** só alterna um usuário fictício. Nada é enviado. Amigos só aparecem com login.
- **App conectado:** fora do app, começa desconectado. "Abrir o app" no diálogo de entrada ou "Simular app aberto" em `/instalar` muda o estado. Dentro do app desktop isso não é simulado (abaixo).
- **Entrar em lobby:** etapas "Baixando o modo…, Abrindo o Deadlock…, Entrando no lobby…" simuladas; não abre o jogo.
- **Criar, sair, fechar, convidar, bater na porta, treinar com bots, avisos:** estado local; somem ao recarregar. O anfitrião simulado sempre abre a porta depois de 6 s.
- **Gente entrando e saindo:** a cada 3,8 s alguém entra num lobby com vaga ou sai (`liveTick` em `src/state/session.tsx`); as contagens acompanham. Pausa com a aba oculta.
- **Download, hash e link do código-fonte:** valores de exemplo.

## Dentro do app desktop

O mesmo site roda na janela do app (`desktop/`). A ponte é `src/lib/desktop.ts`: detecta o app (`window.__DESKTOP_APP__` ou `__TAURI_INTERNALS__`) e carrega o `@tauri-apps/api` (2.12.4, a mesma versão do `desktop/`) por import dinâmico, então o bundle do navegador não traz código do Tauri. Fora do app nada muda (simulado e ao vivo seguem como acima).

- **App conectado** vem do app (sem botão de simulação). O diálogo de entrar mostra a checagem real (`engine_check`): pronto, ou cada problema com a frase do app e o detalhe técnico em "Detalhes técnicos", com o botão "Abrir a tela Instalação" (`open_install_window`). `/instalar` mostra o mesmo botão (`state/useDesktopApp.ts`).
- **Deep link:** `app://deep-link` navega pelo React Router (sem recarregar); `app://deep-link-invalido` vira aviso no site.
- **Partida de verdade (ao vivo):** `state/engineHandoff.ts`, com as regras puras em `lib/handoff.ts`. Quando o servidor passa a sala para o handoff, quem hospeda chama `engine_host { mode }` (o slug do lobby; o app resolve a pasta) e manda o código do evento `hosting` (`set_join_code`); quem entra espera o `joinCode` na visão do lobby e chama `engine_join { code }`. Cada etapa que o app anuncia vai ao servidor (`handoff_progress`, protocolo 2 em `server/README.md`) e é a etapa que a sala mostra para você. Falhou: a barra mostra o erro do app com os detalhes e "Tentar de novo". Sessão de quem hospeda acabou: `end_match`. Saiu da sala ou a partida acabou: `engine_stop`. Recarregou no meio: a sessão do app é retomada (`engine_session`).
- **Modo de teste:** enquanto não há modos de verdade, todo modo abre o projeto `hello`; o diálogo e a barra dizem isso.

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
