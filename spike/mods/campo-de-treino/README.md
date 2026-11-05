# Campo de Treino

Um mapa aberto para testar heróis e itens, sozinho ou com mais gente, sem placar. É o segundo modo de verdade do Jukejoint. No catálogo do app (`desktop/src-tauri/src/engine/catalog.rs`), o slug `campo-de-treino` abre esta pasta.

## Regras

- De 1 a 6 pessoas. Não tem placar, ranking nem métrica: nada daqui conta para lugar nenhum.
- O mapa fica vazio: sem tropas, sem acampamentos, sem partida de bots do jogo (`cvar.arena`). Heróis repetidos valem.
- Quem entra sem herói ganha um sorteado. As pessoas ficam todas no time 2; os bots e os alvos ficam no time 3.
- Ninguém fica caído: quem cai volta em 3 segundos. Os bots de treino também, no mesmo lugar onde foram chamados.
- Todos os itens estão liberados pelo `/item`, de graça, de qualquer nível. Almas, pelo `/almas`.
- Sem recarga e vida infinita valem só para quem pediu, até `/reset` ou até a pessoa sair do servidor.
- Bots de treino: até **4** no campo ao mesmo tempo. Somando os alvos dos treinos (3 por treino), o modo põe no máximo **12** bots no servidor. Com 6 pessoas, são no máximo 18 jogadores no servidor.

## Comandos no chat

Todos respondem a quem pediu, no chat. `/ajuda` lista todos. Os comandos com maiúscula no meio também funcionam em minúsculas (`/sembots`, `/semrecarga`).

| Comando | O que faz |
|---|---|
| `/ajuda` | Lista os comandos. |
| `/alvos [segundos]` (ou `/drill`) | Treino de alvos: três heróis-alvo aparecem no arco à sua frente, entre 500 e 900 unidades. Acerto vale 1 ponto, tiro na cabeça vale 2, e o alvo atingido pula para outro lugar. Os alvos não tomam dano e não andam nem atiram; o tiro de outra pessoa num alvo seu não conta. Dura 30 segundos, ou de 10 a 120 com o número. No fim aparece o resultado e o seu melhor da sessão, que fica guardado enquanto o servidor estiver de pé (sem ranking). Se você cair, o treino acaba. |
| `/parar` | Termina o seu treino de alvos antes do tempo, com o resultado. |
| `/bot [herói]` | Chama um bot de treino 600 unidades à sua frente, no outro time, virado para você. Com nome, o herói é achado pelo `findHero` (nome ou começo do nome, como `/bot geist`); sem nome, ou com um nome que não existe, vem um sorteado (e a resposta diz). Chame longe da sua base: a defesa da base atira nos bots e nos alvos do outro time (nos alvos o tiro é barrado; o bot de treino cai e volta). |
| `/semBots` | Tira todos os bots de treino. Os alvos dos treinos ficam. |
| `/dificuldade [parado\|passivo\|ativo]` | O que os bots fazem: `parado` (ficam parados e não atacam, o padrão), `passivo` (andam, mas não atacam) ou `ativo` (andam e atacam). Vale para todos os bots do servidor, porque são variáveis do servidor. Sem nível, mostra o atual. |
| `/semRecarga` | Liga ou desliga as habilidades sem recarga, só para você. A cada recarga que começa, o modo chama `refreshAbility` (ou zera `cooldownEnd` pelo `setAbility`). |
| `/vida` | Liga ou desliga a vida infinita, só para você. Você vê o dano, mas a vida volta no quadro seguinte, e um golpe que tiraria metade da vida ou mais é barrado no `onDamage`. Se algo passar mesmo assim (dano contínuo, um golpe que não passa pelo `onDamage`), você volta na hora, no lugar onde estava. |
| `/almas [quantidade]` | Ganha almas (`adjustSouls`): 10000 sem número, até 100000 de uma vez. |
| `/item <nome>` | Ganha um item. O nome é o da loja do jogo, em inglês, com ou sem `upgrade_` (`/item headshot_booster`); um pedaço do nome também serve se só um item bater. Com vários, a resposta lista até 6. |
| `/heroi <nome>` | Troca o seu herói (`selectHero`), no mesmo time. Os ajustes continuam. |
| `/reset` | Herói como no começo (`resetHero`): sem itens, sem melhorias, sem almas. Desliga sem recarga e vida infinita. |

## Na tela

Sem placar. Quem tem um ajuste ligado vê uma linha pequena à esquerda, como `Sem recarga · Vida infinita` (`hud.tsx`). Durante o treino de alvos, o centro da tela mostra os pontos e os segundos que faltam.

O treino de alvos (`drill.ts`) foi adaptado do exemplo `drill` do Modlock (MIT, `paralin/modlock`). Mudou: os alvos ficam presos no lugar por `drive` (sem botões nem movimento) e voltam se saírem dele, no lugar das variáveis de servidor do exemplo, que parariam também os bots de treino; os lugares dos alvos ficam no chão (`ground`); a duração vem do comando; o melhor fica na sessão, não numa métrica.

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

O modo põe um bot no lugar de uma pessoa, leva esse bot para o meio do mapa (entre as duas bases, longe da defesa) e roda os comandos em nome dele: `/ajuda`; `/bot` com um herói e confere herói, time e distância; `/almas 5000` e confere as almas; `/item`; `/semRecarga` (escreve uma recarga de 30 segundos e confere que ela zera, e que fica quando desligado); `/vida` com um golpe fatal (a pessoa volta no mesmo lugar) e um pequeno (a vida volta inteira); `/dificuldade ativo` e `parado` sem recusa do servidor; `/alvos 30` e confere os três alvos no arco, que nenhum tiro de outro pontua nem fere um alvo, que **a arma de verdade do bot de teste** acerta um alvo e pontua pelo `onDamage` do jogo, sem ferir o alvo, e que o alvo atingido pula; depois a conta da cabeça (+2), do corpo (+1) e do tiro do bot de treino (0), entregando golpes ao `onDamage` do modo com os alvos de verdade; o fim do relógio, o recorde e a saída dos alvos; `/parar`; `/semBots`; `/heroi`; `/reset`. No fim, o servidor fecha com PASS ou FAIL.

Rodou em 05/11/2026 no servidor do Modlock v0.1.73, mapa `dl_midtown`: **PASS** em cerca de 40 segundos, três vezes seguidas. O autoteste mostrou:
- o `damage()` do modo não passa pelo `onDamage` (o golpe chega, mas o modo não vê), então ele não serve para testar pontos nem o bloqueio da vida infinita. Por isso a arma do bot de teste (por `drive`, segurando o tiro) faz o teste de ponta a ponta, e a vida infinita ganhou a volta na hora, no mesmo lugar;
- a defesa da base atira nos alvos e nos bots do outro time quando eles estão perto da base: os tiros chegam ao `onDamage` com atacante e grupo de acerto, e o modo barra sem pontuar;
- um herói recém-chegado diz herói 0 nos primeiros quadros;
- o host recusa o `/heroi` num bot ("a bot keeps the hero AddBot gave it"), como no duelo.

No jogo, com o Deadlock fechado: `modlock dev --watch` nesta pasta abre o jogo num servidor local. O sandbox do Modlock (`modlock dev --sandbox`) roda os comandos de chat, mas lá o `addBot` não cria jogador, então `/bot` e `/alvos` não aparecem.

## O que ainda não foi provado no jogo

Os testes cobrem as regras e o autoteste cobre o que o servidor mostra sem gente. Falta ver dentro do jogo, com uma pessoa:
- se o tiro de uma pessoa (arma e habilidades) chega no `onDamage` com o `attacker` dela e o `hitGroup` 1 na cabeça. A arma de um bot já chegou e pontuou; a cabeça só foi contada com golpes entregues ao modo;
- se o bloqueio da vida infinita no `onDamage` pega um golpe de verdade (o autoteste só conseguiu provar a volta na hora, porque o `damage()` do modo não passa pelo `onDamage`);
- se a linha dos ajustes na tela aparece como no sandbox;
- se `/dificuldade` muda mesmo o que os bots fazem: o servidor aceita as variáveis (`citadel_bot_test_mode`, `citadel_bot_brain_disable_movement`, `citadel_bot_brain_disable_attacks`), mas ninguém olhou um bot andar ou atirar. A mira e o tempo de reação dos bots não mudam: a SDK não tem dificuldade por bot e não lê o valor padrão das variáveis de mira para voltar a ele;
- se `/heroi` troca o herói de uma pessoa (num bot, o host não troca, então o autoteste só vê a resposta);
- se o herói sorteado para quem entra sem herói aparece certo, e no time 2;
- se `/semRecarga` zera também os itens ativos (depende de `abilities()` listar as habilidades dos itens).
