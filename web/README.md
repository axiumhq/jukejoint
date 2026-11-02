# Protótipo web — plataforma de modos da comunidade para Deadlock

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
| `/` | Início: proposta de valor, números ao vivo, lobbies enchendo, modos em destaque, como funciona |
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
  index.html              fontes (Google Fonts) e <title> inicial
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
    components/           Shell (cabeçalho, nav móvel, rodapé), Skyline, ModeArt, LobbyRow, diálogos…
    pages/                uma tela por arquivo
```

## Onde trocar as coisas

- **Nome da plataforma:** `src/config/brand.ts` (`BRAND_NAME`). Também aparece no `<title>` inicial de `index.html` e no `favicon.svg`/marca (só o desenho, sem texto).
- **Cores, tipografia, espaçamentos:** `src/styles/tokens.css`. O tema claro é `[data-theme='light']`; o seletor no rodapé alterna e guarda a escolha no navegador. O hero da home fica sempre noturno (`.force-night`).
- **Textos:** `src/i18n/pt-BR.ts`. Para adicionar inglês, crie `en.ts` com o mesmo tipo `Messages` e troque o objeto em `src/i18n/index.ts`. O conteúdo dos dados (nomes de modos, notas) está em `src/data` e viria localizado do backend.

## O que é simulado

- **Entrar com Steam:** só alterna um usuário fictício. Nenhuma autenticação real, nada é enviado.
- **App conectado:** começa desconectado. "Abrir o app" no diálogo de entrada ou "Simular app aberto" em `/instalar` muda o estado.
- **Entrar em lobby:** mostra "Conectando…" e um aviso; não abre o jogo.
- **Criar lobby / Jogar com bots / Me avise / Avisar vaga:** estado local; somem ao recarregar a página.
- **Números ao vivo:** oscilam em torno de um valor fixo (`src/data/stats.ts`).
- **Download, hash e link do código-fonte:** valores de exemplo. O botão de download só mostra um aviso.

## Direção visual

Cidade ocultista dos anos 1920 à noite: céu índigo profundo, luz de lampião a sódio (âmbar) como único acento forte, verdete para "ao vivo". A regra que amarra tudo: **luz acesa = gente**. As janelas da silhueta da cidade no hero acendem ao carregar e piscam como jogadores entrando; as vagas ocupadas de cada lobby são janelas acesas; os botões de ação usam o mesmo âmbar.

Tipografia: Big Shoulders Display (inspirada em letreiros de Chicago dos anos 1920) para títulos e Libre Franklin (herdeira da Franklin Gothic, de 1902) para o texto.

Movimento: a cidade acende uma vez ao abrir a home; a arte dos modos anima ao passar o mouse/focar (e na página do modo, com botão de pausa). Tudo é desligado com `prefers-reduced-motion`.

## Pendências conhecidas

- Sem testes automatizados.
- Fontes carregadas do Google Fonts (não auto-hospedadas).
- Notas de versão e ranking não paginam.
- Sem tradução em inglês ainda (estrutura pronta).
