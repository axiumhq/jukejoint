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
npm run preview    # serve o build em http://localhost:4173
```

## Rotas

| Rota | Tela |
| --- | --- |
| `/` | Início: proposta de valor ao lado do painel ao vivo (lobbies enchendo agora, sem instalar nada), modos em destaque, como funciona |
| `/lobbies` | Lista de lobbies com busca, filtros (modo, região, vagas, só amigos), ordenação e estado vazio |
| `/modos` | Todos os modos |
| `/modos/:slug` | Detalhe do modo (ex.: `/modos/circulo-profano`): prévia, regras, ranking, mudanças recentes, Hospedar / Entrar em lobby |
| `/instalar` | Instalação com foco em confiança: o que é instalado e onde, hash SHA-256, antivírus, status do app |
| `/novidades` | Notas de versão com resumo, tags por tipo, filtro por modo e busca |

Os filtros de `/lobbies` e `/novidades` ficam na URL (`?modo=…&regiao=BR,NA&vagas=1`), então dá para compartilhar o link.
Para revisar o estado vazio sem filtros, use `/lobbies?vazio=1`.

## Estrutura

```
web/
  index.html              <title> inicial e meta tags (as fontes vêm do bundle, sem Google Fonts)
  src/
    config/brand.ts       BRAND_NAME (nome provisório) e dados do instalador
    i18n/pt-BR.ts         todas as strings de interface
    i18n/index.ts         idioma ativo + formatação de número e data
    styles/tokens.css     tokens de design (cores, tipo, espaço, raio, movimento; tema escuro e claro)
    styles/base.css       reset, foco, utilitários, prefers-reduced-motion
    styles/components.css botões, formulários, cabeçalho, lobby, cards, diálogos, avisos
    styles/pages.css      layout de cada tela
    data/*.ts             dados fictícios (modos, lobbies, notas de versão, instalação, números ao vivo)
    lib/lobbies.ts        filtro, ordenação e regras de "dá para entrar"
    state/session.tsx     estado simulado (login, app conectado, lobbies criados, avisos)
    components/           Shell (cabeçalho, nav móvel, rodapé), Deco (ornamento e marca), ModeArt, LobbyRow, diálogos…
    pages/                uma tela por arquivo
```

## Onde trocar as coisas

- **Nome da plataforma:** `src/config/brand.ts` (`BRAND_NAME`). Também aparece no `<title>` inicial de `index.html` e no `favicon.svg`/marca (só o desenho, sem texto).
- **Cores, tipografia, espaçamentos:** `src/styles/tokens.css`. O tema claro é `[data-theme='light']`; o seletor no rodapé alterna e guarda a escolha no navegador. Não há mais seção forçada no escuro: a página inteira segue o tema escolhido.
- **Marca provisória:** `TowerMark` em `src/components/Deco.tsx` e `public/favicon.svg` (torre escalonada com uma janela acesa, sem texto).
- **Textos:** `src/i18n/pt-BR.ts`. Para adicionar inglês, crie `en.ts` com o mesmo tipo `Messages` e troque o objeto em `src/i18n/index.ts`. O conteúdo dos dados (nomes de modos, notas) está em `src/data` e viria localizado do backend.

## O que é simulado

- **Entrar com Steam:** só alterna um usuário fictício. Nenhuma autenticação real, nada é enviado.
- **App conectado:** começa desconectado. "Abrir o app" no diálogo de entrada ou "Simular app aberto" em `/instalar` muda o estado.
- **Entrar em lobby:** mostra "Conectando…" e um aviso; não abre o jogo.
- **Criar lobby / Jogar com bots / Me avise / Avisar vaga:** estado local; somem ao recarregar a página.
- **Números ao vivo:** oscilam em torno de um valor fixo (`src/data/stats.ts`).
- **Download, hash e link do código-fonte:** valores de exemplo. O botão de download só mostra um aviso.

## Direção visual (v2)

**Moderno e limpo primeiro; Deadlock como sotaque.** A v1 era uma cidade ocultista à noite: índigo, âmbar de lampião e uma silhueta de cidade no hero. A v2 destila esse clima numa interface de produto contemporânea. A base é preto de pátina (bronze oxidado na sombra). O latão é o único acento. A geometria déco aparece como uma linha só, usada em poucos lugares.

- **Cor (Restrita):** neutros tingidos de verde-pátina e um acento. Latão (`--accent`) só para a ação principal e para "gente": vaga ocupada e janela acesa. Verdete (`--live`) só para estado: ao vivo, amigos, app conectado. Ferrugem e ardósia ficam para as categorias de notas e os erros.
- **Ornamento:** o recuo escalonado (*setback*) dos arranha-céus dos anos 1920, em fio de 1px (`Setback` em `components/Deco.tsx`). Aparece em três lugares: no painel ao vivo da home, na arte da página do modo e no painel de download. Esses três painéis também têm fio duplo (um contorno interno a 5px). Fora deles, nada de moldura.
- **Luz acesa = gente (mantida):** deixou de ser cenário e virou dado. As vagas ocupadas de cada lobby são janelas acesas (latão), os amigos são verdete e as vagas livres são janelas apagadas. A silhueta da cidade saiu do hero. No lugar dela entrou o próprio produto: um painel com os lobbies enchendo agora, cujas janelas acendem em sequência ao abrir a página. É o único momento animado da home e é desligado com `prefers-reduced-motion`.
- **Hierarquia de botões:** `btn-primary` (latão cheio) para uma ação por tela. `btn-outline` para a ação que se repete em listas (o "Entrar" de cada lobby, que só fica cheio no hover). `btn-ghost` para a secundária. `btn-quiet` para alternâncias como "Avisar vaga". Assim a lista de lobbies deixou de ser uma parede de botões âmbar.
- **Forma:** cantos quase retos, um sistema só: 2px em tags, 4px em controles e painéis, 6px em contêineres grandes. Nada de pílula. Avatares são quadrados arredondados. A lista de lobbies é uma tabela com fios entre as linhas, sem um cartão para cada uma.

### Tokens principais (tema escuro / claro)

| Token | Escuro | Claro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#0f1413` | `#eef0ec` | fundo da página |
| `--surface` / `--surface-2` | `#141a19` / `#1a2120` | `#f9faf7` / `#e8ece7` | painéis, hover |
| `--text` / `--text-muted` | `#ebe5d6` / `#a4aca6` | `#121816` / `#4a5451` | texto |
| `--accent` | `#d2a55a` | `#c99a4e` | preenchimento do botão principal (texto `--accent-ink` `#17120a`) |
| `--accent-text` | `#dcb26a` | `#7a5514` | latão como texto e link |
| `--live` | `#7cc0a7` | `#1b6a54` | ao vivo, amigos, conectado |
| `--line-input` | `#5f6c68` | `#7d8781` | borda de campos e vagas livres (≥ 3:1) |

### Contraste (WCAG, medido a partir dos tokens)

| Par | Escuro | Claro |
| --- | --- | --- |
| texto sobre fundo | 14,8 | 15,7 |
| texto secundário sobre painel | 7,6 | 7,5 |
| texto secundário sobre hover | 6,3 | 6,1 |
| texto do botão principal sobre latão | 8,2 | 7,3 |
| latão como texto sobre painel | 8,9 | 6,4 |
| verdete sobre painel | 8,4 | 6,2 |
| borda de campo sobre fundo | 3,4 | 3,2 |

### Tipografia

- **Jost** (títulos e números grandes): revival da Futura, de 1927. Traz a geometria da era déco num desenho atual, em pesos 300 a 600 e com tracking negativo nos títulos.
- **Libre Franklin** (texto e interface): herdeira da Franklin Gothic, de 1902.
- As duas são auto-hospedadas pelos pacotes `@fontsource-variable/jost` e `@fontsource-variable/libre-franklin` (versão 5.2.8, fixada) e importadas em `src/main.tsx`. Nenhuma requisição vai para o Google Fonts, e o navegador só baixa os subconjuntos de caracteres que usa.
- Os números ao vivo usam algarismos tabulares (classe `.num`).

### Movimento

- A home tem um único momento orquestrado: as vagas do painel ao vivo acendem.
- A arte dos modos anima ao passar o mouse ou focar. Na página do modo, ela tem botão de pausa.
- Os botões afundam 1px ao clicar.
- Tudo é desligado com `prefers-reduced-motion`.

## Pendências conhecidas

- Sem testes automatizados.
- Notas de versão e ranking não paginam.
- Sem tradução em inglês ainda (estrutura pronta).
- A arte dos modos é desenho de linha em SVG. Não há fotos nem capturas reais de partidas: quando houver material próprio (sem arte da Valve), ele entra nos cartões de modo.
- O site não diz nada sobre risco de banimento ou anti-cheat. Esse texto precisa vir de quem conhece o funcionamento real do app.
