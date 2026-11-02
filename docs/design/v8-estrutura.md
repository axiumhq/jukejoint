# v8 · Esqueleto da B, pele do Deadlock

*02/11/2026. Protótipo estático em `prototipos/v8/` (`home.html`, `sala.html`, `v8.css`, `v8.js`). Dados fictícios, os mesmos de `pesquisa-profunda/04-sintese.md`, para comparar direto com o v7.*

**A regra do v8:** a estrutura e o layout são os da pele **B · Gelo técnico**, sem mudança de esqueleto. O que muda é a pele: o clima do Deadlock (fumaça quente, carmim e latão, line-art de oficina oculta, serifa condensada só nos títulos), com o acabamento e o sistema de temas do Deadlock Mod Manager (DMM) como referência. Não tem menu lateral, barra de status nem carrossel.

---

## 1. Mapa do site

```
Barra superior ─ Jogar · Modos · Hoje · Instalar ─ busca (Ctrl K) ─ ● 143 jogando | pílula "Na sala" ─ tema ─ conta
│
├─ Jogar (home.html)
│   1. Aviso dispensável "O Deadlock atualizou…"
│   2. Recomendado: "Só mira, sem choro" + barra de dados + Ver sala / Jogar agora
│   3. Modos ao vivo (6 capas; clicar filtra os lobbies)
│   4. Lobbies abertos: abas Todos/Amigos/Favoritos, chips, cartões ↔ compacto, "Mostrar os outros 9", cartão Criar lobby
│   5. Chegando agora (feed ao vivo, com Pausar)
│   └─ Trilho social: seu grupo 1/5 · convite recebido · amigos online com Entrar/Chamar · offline
│
└─ Sala (sala.html?l=<id>; "Ver sala" usa &ver=1 e entra como visitante)
    1. Cabeçalho com a capa do modo, ← Lobbies, nome, quem abriu, fase 1–4
    2. "Na sala": grade de 12 vagas (avatar, estado; vazia = Convidar)
    3. Barra PRONTO fixa: "7 de 10 prontos · começa com 8", trilho de prontos, etapas do handoff, Sair, PRONTO (F)
    └─ Trilho: regras do modo · convidar amigos (link + lista) · atividade da sala
```

Modos, Hoje e Instalar ficam como destinos da navegação. Ainda não têm tela no protótipo.

## 2. Regiões da casca por largura

| Largura | Barra superior | Conteúdo | Trilho social | Ação móvel |
|---|---|---|---|---|
| > 1240 | logo, nav, busca 340 px, contagem ao vivo, tema, conta | margem de 32 px; lobbies em 3 colunas; modos em 6 | fixo à direita, 320 px, rola sozinho | não tem |
| 961–1240 | busca 240 px | margem de 24 px; lobbies em 2 colunas; modos rolam na horizontal; a barra de dados perde o ping e os ícones | fixo, 288 px | não tem |
| 761–960 | a navegação some | uma coluna; aparece o cartão "Amigos · 7 online" | vira **folha de baixo** (abre pelo cartão; fecha pelo ×, pelo fundo ou com Esc) | não tem |
| ≤ 760 | logo, contagem, busca (ícone), tema, avatar; na sala, a pílula vira só avatares + 10/12 | o herói empilha (arte, título, dados 2×2); modos e chips rolam na horizontal; lobbies e feed em 1 coluna | folha de baixo | barra "Jogar agora" fixa (capa + falta 1) na home; barra PRONTO de borda a borda na sala |

Sem rolagem horizontal a 375 px (medido: `scrollWidth = innerWidth` em 375 e 390, nas duas telas).

## 3. Componentes

| Componente | Onde | Estados |
|---|---|---|
| Barra superior + pílula "Na sala" | as duas telas | nav atual (ponto de acento), busca com foco, pílula aparece quando você está numa sala |
| Seletor de tema | barra superior (ícone de paleta) e "Ajustes" no trilho | 3 temas, salvo em `localStorage` |
| Aviso dispensável | home | aberto / dispensado (salvo) |
| Cartão recomendado + barra de dados | home | Anfitrião · Vagas (com "falta 1") · Dentro (pilha) · Servidor; Ver sala / Jogar agora (Enter) |
| Capa de modo | modos, lobbies, herói, sala, barra móvel | normal, hover (zoom de 5%), filtro ativo (anel de acento) |
| Cartão de lobby / linha compacta | home | Entrar, Entrar no meio, Bater na porta, Avisar quando vagar/acabar; etiquetas falta N, N da sua lista, em partida, lotado, só com convite, iniciantes ok; favorito |
| Abas, chips e visão | home | selecionado, contagens que mudam com os dados, chip do modo removível, vazio com "Limpar filtros" |
| Avatar gerado, presença, pilha | todo nome | online, em lobby (acento), na sua lista (anel de acento) |
| Feed "Chegando agora" | home | entrada animada, Pausar/Retomar |
| Trilho social | as duas telas | convite Aceitar/Agora não, Entrar/Chamar/Convidar (vira "Chamado") |
| Vaga de jogador | sala | confirmou, ainda não, falta você, vazia (Convidar) |
| Barra PRONTO | sala | visitante (Entrar na sala), esperando, pronto, contagem de 5 s (Cancelar), handoff em 4 etapas, na partida |
| Fase da sala | sala | 1 Juntando gente → 2 Esperando prontos → 3 Contagem → 4 Abrindo o jogo |
| Toast | as duas telas | confirmação curta, 2,6 s |

## 4. Tokens

### Cor (por tema; todos em `v8.css`, nomes iguais nos três temas)

| Token | Papel | Carmim (padrão) | Pergaminho | Gelo |
|---|---|---|---|---|
| `--bg` | fundo | `hsl(345 30% 4%)` | `hsl(20 10% 5%)` | `hsl(218 30% 4%)` |
| `--bg-tint`, `--bg-tint-2` | brilho radial do fundo | carmim 20% | âmbar 10% | ciano 12% |
| `--s1`…`--s4` | superfícies: trilho, cartão, hover, pressionado | vinho 6–16% | quente 6–16% | azul 6–16% |
| `--line`, `--line-2` | fios | | | |
| `--tx`, `--tx-2`, `--tx-3` | texto | | | |
| `--acc`, `--acc-hi`, `--acc-ink` | ação primária, nav atual, botão PRONTO; texto sobre o acento | `hsl(350 76% 49%)` / branco | `hsl(42 60% 84%)` / quase preto | `hsl(190 92% 70%)` / quase preto |
| `--acc-tx` | acento como texto (palavra do título, falta N, confirmou) | `hsl(350 95% 69%)` | `hsl(41.6 60% 66%)` | `hsl(190 92% 72%)` |
| `--acc-soft`, `--acc-line` | fundo e fio do acento | | | |
| `--live` | presença online e "ao vivo"; nunca ação | verde 56% | oliva 60% | menta 58% |
| `--warn` | "em partida" | âmbar | laranja | âmbar |
| `--lineart` | line-art de maquinário (opacidade 5–7,5%) | carmim | latão | gelo |
| `--k0 --k1 --k2 --kh --kl --ks --kc` | capa: fundo, meio, brilho, metal claro, metal escuro, fumaça, núcleo de luz | | | |

Mais dois temas, nos mesmos 28 tokens, como candidatos a padrão:

- **Grafite** (`grafite`): neutro e calmo. Cinza-grafite com pouco croma, superfícies um passo mais claras (fundo 8%, cartão 12,5%), texto levemente quente e um acento argila suave `hsl(20 50% 64%)`. Pensado para quem chega e para sessões longas.
- **Deadlock** (`deadlock`): verde-fumaça quase preto `hsl(170 16% 4.5%)`, texto pergaminho `hsl(42 45% 92%)`, acento âmbar `hsl(35 85% 56%)` e `--live` verde-alma `hsl(166 62% 52%)`. São as cores do clima do jogo, sem nenhum asset.

**Um sistema de acento:** `--acc` para agir, `--acc-tx` para chamar atenção no texto e `--live` só para presença. Cada modo desloca a matiz da capa em −18° a +22° (`--m` em `MODES[k].shift`, aplicado com `oklch(from …)`), então os modos se distinguem sem sair da família do tema.

### Tipo

- **Display:** Roboto Serif (OFL), `font-stretch: 50%`, peso 700, `opsz 144`, tracking −0,015em. Só nos títulos grandes e no logotipo: herói 72 px (60 / 44 no celular), sala 54 px (38), seção 30 px (25), nome do modo 20 px. Título de seção em dois tons: a segunda palavra em `--acc-tx` ("Modos *ao vivo*", "Lobbies *abertos*", "Chegando *agora*", "Na *sala*").
- **Rótulo espaçado (`.cap`):** Roboto Serif 75% de largura, 10,5 px, caixa alta, tracking 0,2em. Só em poucos rótulos: o cabeçalho do herói, os títulos do trilho e o menu de tema.
- **Rótulo de dado (`.lbl`):** Geist 10,5 px, caixa alta, tracking 0,1em (Anfitrião, Vagas, "Lobby 07 · BR/SA · 18 ms").
- **Interface:** Geist 12–13,5 px (base 13 px, densidade de DMM). **Números:** Geist Mono tabular.
- Carregamento: fontsource 5.3.0 fixo via jsDelivr (`@fontsource-variable/geist`, `geist-mono`, `roboto-serif/full.css`).

### Raios, espaço e movimento

- Raios: 4 · 6 (botão, chip) · 8 · 10 (cartão) · 12 (herói, sala) · 16–18 (folha, barras móveis) · pílula.
- Espaço: margem de 32/24/16 px; 34 px entre seções; 14 px entre o título e o conteúdo; grade de 10 px nos modos e nas vagas e de 14 px nos lobbies.
- Movimento: 150 / 200 / 240 ms, `cubic-bezier(.22,1,.36,1)`, tudo interrompível. Movimento só como estado: a vaga "estala" ao confirmar, o tracinho da próxima vaga pisca 3 vezes, a etapa ativa do handoff pulsa só durante ela, o feed entra a cada 8 s e tem **Pausar** (WCAG 2.2.2). Nenhum loop decorativo. `prefers-reduced-motion` zera animações e transições.

## 5. Sistema de temas

- O tema é o atributo `data-theme` no `<html>`. Um script no `<head>` aplica o tema salvo antes de pintar, para não piscar. `?theme=<id>` força um tema, para captura.
- **Tudo** lê os tokens acima: superfícies, acento, fios, line-art, pontos de presença e as capas (os avatares não mudam: são a identidade da pessoa). Elas são SVG gerado em `v8.js` e pintado só com `var(--k*)` / `var(--m*)` (`stop-color`, `flood-color` da fumaça, `fill`, `stroke`). Trocar o tema repinta as capas sem gerar nada de novo.
- **Para adicionar um tema:**
  1. Copie um bloco `[data-theme="…"]` em `v8.css` e preencha os mesmos 28 tokens (as 7 cores `--k*` da capa incluídas).
  2. Adicione `{id, name, note, sw:[fundo, acento]}` em `THEMES` (`v8.js`).
  3. Confira o contraste: `--acc-ink` sobre `--acc` ≥ 4,5:1, e `--tx-2`/`--tx-3` sobre `--s2`.
  4. Capture `home-1440-<id>.png`.

## 6. De onde veio cada coisa

| Da B · Gelo técnico (estrutura) | Do DMM e do clima do Deadlock (pele) | Novo no v8 |
|---|---|---|
| Barra superior com nav, busca Ctrl K, contagem ao vivo, pílula da sala e conta | Fundo quase preto quente, creme/pergaminho (tema Pergaminho) e o vermelho que o usuário usa (Carmim, padrão) | Sistema de 3 temas por tokens, com capas que mudam de cor |
| Trilho social fixo (grupo, convite, amigos com presença e Entrar) | Serifa condensada em títulos, com a palavra de acento em dois tons | Capas como emblemas de oficina oculta (anel ritual, trilho e catenária, bússola na neblina, roda de cofre, relógio com lâminas, estande de tiro) com fumaça, latão, grão e vinheta |
| Ordem da home: recomendado com barra de dados, modos, lobbies com abas e filtros, chegando agora | Rótulos espaçados em caixa alta | Deslocamento de matiz por modo dentro do tema |
| Sala: cabeçalho, grade de vagas, PRONTO fixo, trilho com regras, convite e atividade | Densidade de 12–13 px | Fluxo de PRONTO completo: contagem cancelável e 4 etapas do handoff |
| Comportamento móvel: herói empilhado, cartão de amigos, barra "Jogar agora" fixa | Fios carmim/latão e line-art de engrenagem e régua a 5–7,5% | Aviso dispensável do patch; Pausar no feed; texto neutro em gênero ("abriu a sala", "Confirmou", "da sua lista") |

Não tem nada da Valve nem do DMM: nenhum logo, fonte do jogo, nome de herói ou termo do jogo. A Forevs Demo não entra; só o clima e a estrutura serviram de referência.

## 7. O que levar para o app React (`web/`)

1. **Tokens primeiro:** o bloco de temas de `v8.css` vira `web/src/styles/themes.css`, com os mesmos nomes. Troque Bodoni Moda, Mona Sans e Fragment Mono por Roboto Serif, Geist e Geist Mono (fontsource). O tema fica no `<html data-theme>`, com preferência salva.
2. **Componentes (~12):** `TopBar`, `RoomPill`, `ThemeMenu`, `SocialRail` (vira `Sheet` abaixo de 960 px), `RecommendedCard` + `StatBar`, `ModeCover`, `LobbyCard` (cartão e linha), `FilterBar`, `Avatar`/`Presence`/`AvatarStack`, `ArrivalsFeed`, `PlayerSlot`, `ReadyBar` + `HandoffSteps`.
3. **`ModeCover` como componente SVG** com props `mode` e `wide`. Ele lê o tema por CSS, sem raster. Para performance, use `will-change` só no hover e um `<defs>` por instância (o filtro de fumaça precisa herdar `--m*`).
4. **A lógica já existe:** `lib/lobbies.ts` cobre entrar, entrar no meio, bater na porta, avisar e recomendado. Mapeie cada estado para a etiqueta e o botão do `LobbyCard`, como em `action()`/`stateTag()` no protótipo. As fases da sala (1–4) e as etapas do handoff são as mesmas do v6.
5. **Contagens de uma fonte só:** o "143 jogando", a contagem por modo e "18 abertos · 14 com vaga" saem da lista de lobbies, como no protótipo.
6. **Acessibilidade a manter:** foco visível em `--acc-tx`, tecla F no PRONTO, Esc fecha a folha, Pausar no feed e reduced-motion.

## 8. Ainda em aberto

- O nome e a marca (o "Lobby" com o anel aberto é provisório).
- As telas de Modos, Hoje, Instalar e Criar lobby.
- Avatar real da Steam quando houver login. O gerado fica como reserva.
- As capas são SVG pintado em tempo real. Se pesarem no app, dá para pré-renderizar em AVIF por tema mantendo a mesma arte.
