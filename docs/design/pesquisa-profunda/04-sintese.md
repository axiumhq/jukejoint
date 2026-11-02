# 04 · Síntese: o que muda no v7

*02/11/2026. Junta `01-linguagem-visual.md` (40+ sites com capturas), `02-boas-praticas-ux.md` (UX de produtos sociais de jogo) e `03-diagnostico.md` (diagnóstico frio do v6.1). O usuário reprovou o v6.1 inteiro: "muito arcaico".*

## Veredito

O v6 funcionou como especificado; o conceito é que era velho. Bodoni, faixas de cinema, números em "créditos", torre art déco, sódio e verdete, tabela de planilha, cantos de 2 px e links sublinhados são todos referências a algo antigo. As três pesquisas concordam, por caminhos independentes:

1. **Fim da serifa didone.** Plataforma de jogo em 2026 usa sans grotesca pesada, caixa mista, tracking negativo (Hyperline, Riot, Blitz, Linear, Medal).
2. **Gente em todo lugar.** Avatar em todo nome (amigos, sala, chegando agora, anfitrião), pilha de avatares nos lobbies.
3. **Cartões, não planilha.** Lobby como cartão ou linha-cartão com capa do modo, avatares, chips e um botão cheio. Tabela só como modo "compacto" para quem quer.
4. **Uma capa por modo** (sem IP da Valve): glifo/forma própria sobre gradiente granulado, ou objeto abstrato pré-renderizado.
5. **"Ao vivo" como sistema:** ponto/selo + contagem + algo se mexendo (contador que rola, cartão que entra).
6. **Superfícies, não fios:** cantos de 10 a 16 px, superfície um passo acima do fundo, quase sem borda.
7. **Uma cor de destaque saturada** sobre quase preto (ou sobre claro, na direção D).
8. **Uma marca de verdade** (nome ainda em aberto; o protótipo usa um placeholder neutro de logotipo, não "PROJETO").

"Minimal e preciso" continua válido, mas como **minimalismo de produto** (moldura mínima, conteúdo rico), não como minimalismo editorial (que cortou a gente e a arte).

## O que sobrevive do v6

A lógica inteira de estados (`lib/lobbies.ts`: entrar, entrar no meio, bater na porta, avisar quando vagar, recomendado), a sala e suas fases, o "Na sala…" no cabeçalho, amigos com destino, "Chegando agora", o texto em PT-BR e as contagens com uma fonte de verdade. Muda a pele e a estrutura das telas, não o cérebro.

## Esqueleto comum (todas as direções)

Estrutura de **cliente de jogo** (Riot Client + Discord), que resolve o "parece landing page":

- **Barra superior** (56–64 px): logotipo, navegação (Jogar, Modos, Hoje, Instalar), busca com atalho (Ctrl K), contador "● 143 jogando", avatar da conta.
- **Painel social à direita, fixo** no desktop (280–320 px): seu grupo/estado, amigos online com avatar + anel de presença + "em <lobby>" + Entrar, convites recebidos. No celular vira folha.
- **Centro da home:**
  1. Cartão grande "Jogar agora" com a capa do modo sugerido e o lobby recomendado ("Só mira, sem choro · 11/12 · 22 ms · 1 amigo dentro").
  2. Faixa de **modos** com capas (contagem ao vivo em cada uma); clicar filtra.
  3. **Lobbies** como cartões (grade de 2–3 colunas) ou linhas-cartão: capa do modo pequena, nome, anfitrião com avatar, pilha de avatares, "11/12", região + ping, estado em chip, um botão cheio. Abas: Todos · Amigos · Favoritos.
  4. "Chegando agora" como feed curto com avatares.
- **Sala (`/sala/:id`):** cabeçalho com capa do modo ao fundo, nome, modo, região/ping, anfitrião; **grade de slots** (cartão por jogador com avatar, nome, estado; vazio tracejado com "Convidar"); **barra inferior fixa** com o botão PRONTO grande, "7/12 prontos", e na fase de entrada as etapas do handoff; ao lado, convidar amigos.
- **Movimento:** 150–250 ms, interrompível; contador que rola, slot que "estala" ao encher, presença pulsando devagar; nada de loop decorativo acima de 5 s sem pausa (WCAG 2.2.2).
- **Celular:** uma coluna, "Jogar agora" fixo embaixo, amigos numa folha, filtros numa linha rolável de chips.

## As quatro peles para comparar

| | Referências | Tipo | Cor | Imagem | Assinatura |
|---|---|---|---|---|---|
| **A · Feed ao vivo** | Linear, Blitz, Twitch, Medal | Geist ou Inter Tight 600–700; Geist Mono | grafite neutro (#0d0e11 / #15171c / #1d2027) + 1 acento vivo (lima ácido ou coral) | capas = glifo grande sobre gradiente granulado | precisão, densidade, "ferramenta de verdade" |
| **B · Gelo técnico** | igloo.inc, Raycast, Arc | grotesca apertada (Inter Tight / Mona Sans comprimida); labels mono caixa alta | quase preto frio, branco gelo, cinzas frios + ciano elétrico | capas = objetos abstratos (anel, trilho de vidro, névoa) estilo render | vidro fosco, microtipografia técnica, brilho que segue o cursor |
| **C · Arena BR** | Gamers Club, Valorant, The Finals, PGL | condensada pesada caixa alta (Big Shoulders / Barlow Condensed 800) + Mona Sans | preto + 1 acento saturado (vermelho-coral) + secundário ácido só para "ao vivo/amigo" | capas = pôster 2D duotone/meio-tom com o nome gigante | canto cortado 45° com regra fixa, "AO VIVO" de transmissão, PRONTO como momento-herói |
| **D · Claro editorial** | Vercel, Figma Config, home da Hyperline, Raycast | Schibsted Grotesk 800 enorme, tracking −0.04em; Geist Mono | canvas claro (#f5f4f0) + tinta quase preta + 1 acento (laranja-vermelho ou cobalto); lista ao vivo num bloco escuro | céu de gradiente granulado (pêssego → laranja) | contraste com o mundo "gamer", sofisticado, diferencia |

Fora do páreo: "Brincadeira com amigos" (Discord/Supercell, 3D toy colorido). Só funciona com ilustração 3D de alto nível; feita barata, cai no "3D com cara barata" que o usuário já reprovou. Fica como possível evolução da A ou da C (mascote, adesivos).

## Conteúdo comum dos protótipos (o mesmo nas quatro)

Para comparar pele com pele, as quatro usam exatamente estes dados (fictícios):

- Conta: **Corvo_Noturno**, logado. 143 jogando, 18 lobbies, 14 com vaga.
- Modos (6) e jogadores agora: Círculo Profano 41 · Último Bonde 39 · Neblina 24 · Cerco ao Cofre 32 · Duelo à Meia-Noite 5 · Campo de Treino 2.
- Recomendado: **Só mira, sem choro** · Círculo Profano · BR/SA 22 ms · 11/12 · anfitrião k0rvo (amigo) · "falta 1".
- Lobbies (pelo menos 8): Bonde das 23h (Último Bonde, 10/12, 18 ms) · Círculo da madrugada (Círculo Profano, 9/12, 14 ms, 2 amigos: Odete, Tordo) · Caçada rápida (Neblina, 8/10, em partida, rodada 3 de 5, entrar no meio) · Neblina sem lanterna, iniciantes ok (Neblina, 6/10, anfitrião luz_baixa amigo) · Clã Vigília (Cerco ao Cofre, 7/10, só com convite) · x1 até o sol nascer (Duelo à Meia-Noite, 5/8, 12 ms) · Trilho sul, sem tóxico (Último Bonde, 12/12 lotado) · Testando build de arma (Campo de Treino, 2/6, anfitrião Garoa amigo).
- Amigos online: Odete e Tordo (em Círculo da madrugada), k0rvo (abriu Só mira, sem choro), luz_baixa (abriu Neblina sem lanterna), Garoa (abriu Testando build de arma), Lume e Pixote (no menu do Deadlock).
- Chegando agora: ferro_velho → Bonde das 23h (22 s) · Sereno → Círculo sem pressa (30 s) · Odete → Círculo da madrugada (35 s) · Agulha → x1 até o sol nascer (40 s).
- Sala: **Círculo da madrugada**, 10/12, começa com 8, anfitrião Ametista; jogadores Ametista (anfitriã, pronta), Corvo_Noturno (você, ainda não), Odete (amiga, pronta), Tordo (amigo, pronto), capivara.exe, Lanterneiro, Brasa, Sereno (ainda não), Agulha (ainda não), Ivone; 2 vagas livres. "7 de 10 prontos". Regras do modo: "Todos contra todos, sem times." · "O círculo encolhe a cada 60 s." · "Cada abate dá um item aleatório."
- Avatares: gerados (formas/gradientes determinísticos por nome, estilo "boring avatars"), nunca fotos de pessoas reais nem arte da Valve.

## Próximo passo

Quatro protótipos estáticos (`prototipos/v7/<pele>/home.html` e `sala.html`), mesmo conteúdo, mesmo esqueleto, capturados em 1440×900 e 390×844, para o usuário escolher vendo, não lendo.
