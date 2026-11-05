# Duelo à Meia-Noite

Um contra um, melhor de cinco, com fila. É o primeiro modo de verdade do Jukejoint. No catálogo do app (`desktop/src-tauri/src/engine/catalog.rs`), o slug `duelo-meia-noite` abre esta pasta.

## Regras

- Os dois primeiros da fila duelam. Quem está na fila assiste, com a câmera no duelo.
- Cada rodada sorteia um herói, o mesmo para os dois, em times opostos. Os dois recebem as quatro habilidades liberadas, com o primeiro upgrade, e o mesmo conjunto de 6 itens: dois de cada aba, de nível 1 ou 2, sem itens ativos. Sem loja.
- Os dois ficam congelados por 3 segundos de contagem. Depois a rodada vale.
- Quem fizer 3 rodadas leva a partida. Quem perde vai para o fim da fila, quem vence fica, e a próxima partida começa sozinha.
- Se ninguém morre em 90 segundos, vence quem tiver mais vida, em proporção. Com vida igual, a rodada repete.
- Se um duelista sai do servidor, o outro leva a partida.

## Comandos no chat

| Comando | O que faz |
|---|---|
| `/placar` | Mostra o placar e a fila para quem pediu. |
| `/arena` | Muda o lugar do duelo para onde você está, a partir da próxima rodada. Sem ele, o duelo acontece no chão, no meio do caminho entre as duas bases. |
| `/bot` | Põe um bot na fila. Só funciona com menos de duas pessoas, para treinar sozinho. |

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

No jogo, sozinho, com o Deadlock fechado: `modlock dev --watch` nesta pasta abre o jogo num servidor local. Lá dentro, `/bot` traz o adversário. O sandbox do Modlock (`modlock dev --sandbox`) roda o modo sem o jogo, mas nele o `addBot` não cria um segundo jogador, então o duelo não começa.

## O que ainda não foi provado no jogo

Os testes cobrem as regras. Falta ver dentro do jogo:
- se o meio do caminho entre as bases é um bom lugar para o duelo (se não for, use `/arena`);
- se `cvar.arena` tira mesmo as tropas e os acampamentos;
- se os itens e as habilidades chegam antes da contagem acabar.
