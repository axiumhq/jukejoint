# Três direções para o v3 do site

*02/11/2026. Síntese de `avaliacao-texto.md` (texto avaliado com Impeccable: nota 22/32, voz 1/4) e `pesquisa-referencias.md` (Deadlock oficial, Balatro, Haunted Boulder City, Lusion e outros).*

## Vale para qualquer direção (corrigir já)
- **Trocar a fonte dos títulos:** a Jost é usada no site oficial do Deadlock.
- **Diferenciar a paleta:** a combinação latão + verde-azulado também aparece num site premiado recente. Ela funciona, mas não basta para ser única. Precisa de textura (grão), luz emissiva e um terceiro tom próprio.
- **Correções de fato no texto:**
  - "grátis" visível;
  - "Jogar agora" → "Achar uma partida";
  - o TL;DR com os 40% corrigido;
  - nada de prometer jogadores;
  - selo "código aberto" só quando o repositório for público;
  - estado vazio com filtros com texto próprio e "Limpar filtros";
  - "Entrar" (login) separado de "Entrar" (lobby).
- **Evitar o que é da Valve:** a metáfora de cartão-postal, o par carvão + laranja, as fontes Pulp/Occult e nomes do jogo (Cursed Apple, Patrons).

## A. Cidade Acesa ⭐ recomendada
**Ideia:** a home é um **corte de prédio art déco à noite**, e cada lobby aberto é um andar com janelas. As janelas acendem quando jogadores entram, e as verdes são amigos. O produto vira o cenário.
- **Voz:** "Luz Acesa", da avaliação de texto. Exemplos: "O Deadlock que a comunidade inventou." e "Cada janela acesa é um jogador."
- **Novidades** em formato de jornal ("A Gazeta"), resolvendo a página mais seca.
- **Técnica:** SVG/canvas 2D, grão leve, brilho emissivo nas janelas, View Transitions entre páginas. Sem three.js, leve para Android.
- **Risco de kitsch:** baixo, porque a metáfora é feita de dados reais.

## B. A Gazeta
**Ideia:** o site inteiro como um **jornal dos anos 1920 inventado por nós**. Manchetes ao vivo ("1.284 jogadores tomam a cidade esta noite"), lobbies como classificados, ranking como cotações da bolsa, halftone e tipografia editorial forte.
- **Técnica:** quase só CSS: grid editorial, halftone e textura de papel. Custo de desempenho perto de zero.
- **Risco:** fica denso e lento de escanear no celular, e o lobby browser perde agilidade. Pede muito texto bom.

## C. Ritual e Tarô
**Ideia:** o lado oculto em primeiro plano. Cada **lobby é um círculo de sigilos** que se completa conforme os jogadores chegam, cada **modo é uma carta de tarô** (tilt 3D, brilho, a carta "vira" a página do modo), e há fumaça ou névoa em shader no fundo.
- **Técnica:** WebGL/shader, tilt 3D e animações mais pesadas.
- **Risco:** o maior de kitsch, e também o maior custo de desempenho e manutenção. Fica mais "gamer", menos clean.

## Recomendação
**A, com pedaços de C como componentes:** o círculo na sala de espera do lobby e as cartas nos cards de modo, sem virar metáfora global. É a única direção em que a parte única nasce do próprio produto (lobbies ao vivo), sem depender de arte do jogo, e que continua moderna e leve.

## Implementado (v3, 02/11/2026)
A direção **A** foi implementada em `web/` com a voz "Luz Acesa": a home é a Cidade Acesa (prédios gerados dos lobbies, janelas ao vivo, quadro de andares acessível por teclado), Novidades virou a Gazeta, e de C entraram só o círculo de espera (diálogos de entrar e criar lobby) e as cartas de tarô (modos, com transição carta → página). Títulos em Big Shoulders no lugar da Jost; Newsreader só na Gazeta. Detalhes, contraste e tamanhos em `web/README.md`. Pendentes: texto de anti-cheat, selo de código aberto, canal dos avisos, horário de pico real.
