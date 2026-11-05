# Duelo à Meia-Noite

Um contra um, melhor de cinco, com fila. É o primeiro modo de verdade do Jukejoint. No catálogo do app (`desktop/src-tauri/src/engine/catalog.rs`), o slug `duelo-meia-noite` abre esta pasta.

## Regras

- Os dois primeiros da fila duelam. Quem está na fila assiste, com a câmera no duelo.
- Cada rodada sorteia um herói, o mesmo para os dois, em times opostos. Os dois recebem as quatro habilidades liberadas, com o primeiro upgrade, e o mesmo kit de 6 itens. O modo tenta os primeiros itens da build recomendada do herói (`heroBuild`), mas no servidor do Modlock v0.1.73 ela volta vazia, então hoje o kit é sorteado a cada rodada: dois itens de cada aba, de nível 1 ou 2, sem itens ativos. Sem loja.
- Os dois ficam congelados por 3 segundos de contagem. Depois a rodada vale. Fora da rodada valendo, ninguém toma dano.
- Um golpe que tira toda a vida decide a rodada na hora.
- Quem fizer 3 rodadas leva a partida. Quem perde vai para o fim da fila, quem vence fica, e a próxima partida começa sozinha.
- Se ninguém morre em 90 segundos, vence quem tiver mais vida, em proporção. Com vida igual, a rodada repete.
- Se um duelista sai do servidor, o outro leva a partida na hora: o modo ouve o aviso de saída do host (`onPlayerLeave`), além de conferir a lista a cada segundo.
- Os corpos de herói que ficam sem dono depois das trocas de herói são tirados do mapa (`Strays`, do Modlock).

## Comandos no chat

| Comando | O que faz |
|---|---|
| `/placar` | Mostra o placar, a fila e a sua sessão (vitórias, derrotas, sequência e rating) para quem pediu. |
| `/arena` | Muda o lugar do duelo para onde você está, a partir da próxima rodada. Sem ele, o duelo acontece no chão, no meio do caminho entre as duas bases. |
| `/bot` | Põe um bot na fila. Só funciona com menos de duas pessoas, para treinar sozinho. |

## Na tela e nos números

- A faixa do topo mostra os dois nomes, os pontos (com marcadores até 3), a rodada, o herói e o relógio. Uma faixa de destaque aparece quando alguém leva a rodada ou o duelo (`hud.tsx`).
- O `mod.json` declara três métricas, que o motor guarda por pessoa: `duelo.vitorias`, `duelo.rodadas` e `duelo.sequencia` (a maior sequência).
- O rating da sessão vem do `Standings` e do `settle` do Modlock, no estilo Elo.

O formato do abate, do bloqueio de dano, do placar e do autoteste veio do exemplo `arena` do Modlock (MIT, `paralin/modlock`).

## Testar

As regras rodam sem o jogo, contra uma versão falsa da SDK (`test/fake-modlock.ts`). Esta pasta não tem `node_modules` próprio, então os testes usam o Vitest do site:

```powershell
node ..\..\..\web\node_modules\vitest\vitest.mjs run --config test\vitest.config.mts
```

Para conferir que o modo compila e os tipos da SDK batem:

```powershell
..\..\..\tools\modlock-v0.1.73\modlock.exe build
node ..\..\..\web\node_modules\typescript\bin\tsc -p tsconfig.json
```

**Autoteste no servidor do jogo, sem pessoas** (`probe.ts`). Com o Deadlock fechado, rode nesta pasta:

```powershell
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --no-game --arg probe
```

Rodou em 05/11/2026 no servidor do Modlock v0.1.73, mapa `dl_midtown`: **PASS** em cerca de 30 segundos. Os dois bots duelaram com o mesmo herói, a 1100 unidades um do outro, e o placar e a fila fecharam certos. Foi o autoteste que mostrou que o host recusa um bot sem herói e não troca o herói de um bot, e que o `heroBuild` vem vazio no servidor.

O modo põe dois bots, espera a rodada valer e confere que os dois têm o mesmo herói, em times opostos e frente a frente. Depois derruba o segundo bot três vezes, confere o placar a cada ponto e confere que quem venceu ficou na frente da fila. No fim, o servidor fecha com PASS ou FAIL.

No jogo, sozinho, com o Deadlock fechado: `modlock dev --watch` nesta pasta abre o jogo num servidor local. Lá dentro, `/bot` traz o adversário. O sandbox do Modlock (`modlock dev --sandbox`) roda o modo sem o jogo, mas nele o `addBot` não cria um segundo jogador, então o duelo não começa.

## O que ainda não foi provado no jogo

Os testes cobrem as regras. Falta ver dentro do jogo:
- se o centro do mapa (onde o duelo cai sem `/arena`) é um bom lugar para lutar, com gente de verdade;
- se `cvar.arena` tira mesmo as tropas e os acampamentos (o servidor aceitou as variáveis, mas ninguém olhou o mapa);
- se o placar na tela aparece no jogo como no sandbox.
