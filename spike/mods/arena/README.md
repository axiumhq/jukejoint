# Arena

Lutas num círculo marcado no chão, com gás do lado de fora. Um modo só, com quatro jeitos de jogar e uma chave "com tempo", escolhidos numa tela antes de cada partida. É o modo 1 do plano de `docs/modos/estrutura-dos-modos.md` (seção 6): a ideia vem de um modo de arena do Hyperline; o código, os nomes e o texto são nossos.

## Jeitos de jogar

| Jeito (`variante`) | Lados | Como se vence, sem tempo |
|---|---|---|
| `duelo` (padrão) | 1 contra 1 | Quem levar primeiro os pontos do lobby (`pontos`, padrão 5) |
| `dupla` | 2 contra 2 | Igual ao duelo |
| `times` | até 6 contra 6 | Primeiro time a levar 3 rodadas |
| `espelho` | até 6 contra 6, todo mundo com o mesmo herói | Igual a times |

- **Sem tempo** (padrão), a partida vai por rodadas. Um lado leva a rodada quando ninguém do outro lado está de pé. Quem cai fica fora até a próxima rodada: se o jogo reviver o herói, ele fica parado assistindo a alguém do time e não toma dano. Se ninguém cai, o círculo começa a fechar aos 45 segundos e chega a 30% do raio aos 105. Aos 120 segundos, vence o lado com mais vida de pé, em proporção; com vida igual, a rodada vai de novo.
- **Com tempo** (`tempo` ligado), a partida dura 3 minutos. Quem cai volta em 3 segundos no seu lado do círculo, protegido por 2 segundos. Cada queda vale um ponto para o outro lado, com ou sem autor (o gás também conta). O círculo fecha desde o começo até 30% do raio no fim. Vence quem fizer mais pontos; empate é empate.
- **Fora do círculo**, o gás tira 8% da vida máxima por segundo (no mínimo 25), sem dar o abate a ninguém.
- Cada rodada começa com 3 segundos de contagem, com todo mundo parado. Fora da rodada valendo, ninguém toma dano.
- Nos jeitos com herói livre, cada pessoa usa o herói que escolheu na tela (sem escolha, o que já tem; quem não tem herói recebe um sorteado). No espelho, um herói sorteado por rodada para todo mundo. Todo mundo recebe as quatro habilidades com o primeiro upgrade e o mesmo kit de 6 itens (dois de cada aba, nível 1 ou 2, sem ativos), sorteado por partida (por rodada no espelho). Sem loja.

## A fila

- Lutam os primeiros da fila: no duelo, 2; na dupla, 4; nos times e no espelho, até 12. Com menos gente, os lados encolhem (uma dupla com 3 pessoas vira 1 contra 1). Quem sobra espera e assiste, com a câmera em quem está lutando.
- No fim da partida, a fila gira: quem venceu fica na frente, quem esperava entra e quem perdeu vai para o fim. No duelo e na dupla, os lados são a primeira e a segunda metade de quem luta, então a dupla que venceu continua junta. Nos times, os lados se alternam pela ordem da fila, então os times se misturam a cada partida. No empate, quem esperava entra na frente.
- Se um lado inteiro sai do servidor, o outro leva a partida. Se só uma pessoa do time sai, a partida segue.

## Configurações do lobby e argumentos

O `mod.json` declara três configurações. No Modlock v0.1.73 a configuração é de cada pessoa (`player.setting`); a Arena lê a de **quem chegou primeiro à sala** entre as pessoas (bots não contam), e é com ela que a tela de escolha abre. O que essa pessoa muda na tela vale acima da configuração, só nesta sala (não muda o perfil dela). A leitura acontece no começo de cada partida.

| Chave | Tipo | Padrão |
|---|---|---|
| `variante` | escolha: `duelo`, `dupla`, `times`, `espelho` | `duelo` |
| `tempo` | chave | desligada |
| `pontos` | número de 1 a 15 (duelo e dupla) | 5 |

Argumentos do servidor valem acima de tudo, para quem roda o servidor e para o autoteste: `--arg variante=times`, `--arg tempo`, `--arg pontos=3` e `--arg segundos=60` (a duração com tempo, para testes). A ordem fica: **argumentos do servidor > escolha na tela de quem abriu a sala > configuração do lobby dessa pessoa**. O que um argumento fixa aparece na tela desligado, com "definido pelo servidor".

## A tela de escolha

Antes de cada partida (quando a sala abre e depois de cada fim de partida), todo mundo na fila vê a mesma tela (`escolha.tsx`). O cursor aparece sozinho, sem o Tab, e atirar, golpear e as habilidades ficam presos enquanto ela está aberta, para um clique não virar tiro (o jogo não faz isso sozinho com o cursor solto).

- **Jeito de jogar**: quatro cartões (Duelo no círculo, Dupla, Times, Espelho), cada um com os lados e a regra em uma linha; o escolhido fica marcado. Embaixo, a chave **Com tempo** (3 minutos, o círculo fecha) e **Pontos para vencer** (menos e mais, de 1 a 15), que só aparece no duelo e na dupla sem tempo; nos outros casos aparece a regra no lugar.
- **Quem decide**: quem abriu a sala (a primeira pessoa a chegar, bots não contam). As outras pessoas veem a mesma tela, só para ler, com a linha "Quem abriu a sala escolhe o jeito de jogar" e o nome. Um clique de outra pessoa é ignorado também no servidor, não só desligado na tela.
- **Seu herói**: cada pessoa clica no retrato do herói dela (vale da primeira rodada em diante). No espelho, a grade dá lugar ao aviso de que o herói é sorteado a cada rodada.
- **Bots de treino**: sozinha na sala, a pessoa vê **Treinar com um bot** (depois **Mais um bot**, até completar os lados, no máximo 4 lugares) e **Tirar os bots** quando há bots.
- **Começar**: só quem abriu a sala tem o botão, ligado quando há duas pessoas na fila (ou uma pessoa e um bot). As outras veem "Esperando quem abriu a sala começar". Com mais gente que lugares, a tela diz como vai ficar ("3 na sala: vai ser 1 contra 1, e 1 pessoa espera na fila").
- A partida **não começa sozinha** com a tela aberta. A exceção é quando os argumentos do servidor fixam o jeito (`--arg variante=…`) ou no autoteste (`--arg probe`): aí ela começa assim que houver duas pessoas, como antes, e a tela não tem Começar.
- Ao começar, a tela some, o cursor volta para a mira e os botões soltam. No fim da partida, a tela volta com o resultado da última partida no canto.

**Durante a partida**, segurando o Tab (o jogo mostra o cursor), aparece um quadro pequeno à esquerda, longe da faixa do topo: **Trocar herói** abre a grade de heróis (o novo herói entra na próxima rodada; não aparece no espelho) e, só para quem abriu a sala, **Marcar o centro aqui** muda o centro do círculo para onde o herói está, a partir da próxima rodada. Sem centro marcado, o centro é o meio do caminho entre os dois lados, no chão. Quem assiste da fila, sem herói, vê o quadro o tempo todo.

Os comandos antigos (`/placar`, `/heroi`, `/modo`, `/arena`, `/bot`, `/tirarbots`, `/ajuda`) continuam registrados só como reserva, com as mesmas regras da tela (o `/arena` agora também é só de quem abriu a sala). Nenhum texto do jogo manda ninguém para o chat; o `/ajuda` descreve a tela.

## Na tela e nos números

- A faixa do topo mostra os lados, os pontos (com marcadores até 7), o jeito de jogar, a rodada ou "com tempo", o herói do espelho e o relógio. Uma faixa de destaque aparece quando um lado leva a rodada ou a partida (`hud.tsx`, no mesmo padrão do Duelo à Meia-Noite).
- O anel são 28 marcadores `◆` roxos flutuando sobre o chão (`createText`), que se aproximam do centro quando o círculo fecha.
- Métricas (`mod.json`): `arena.abates` (soma), `arena.vitorias` (soma) e `arena.sequencia` (a maior sequência de abates sem cair).

## Arquivos

- `arena.ts`: jeitos de jogar, fila, fases, placar, quedas e o que cada botão da tela faz.
- `escolha.tsx`: a tela de escolha e o quadro do Tab.
- `circulo.ts`: o anel de marcadores, o raio que fecha e a conta do gás.
- `hud.tsx`: o que cada pessoa vê a cada quadro (a tela de escolha ou o placar), o cursor e os botões presos.
- `probe.ts`: o autoteste no servidor do jogo.
- `test/`: os testes com a SDK falsa.

O formato do abate pelo golpe fatal, do bloqueio de dano, do placar e do autoteste veio do exemplo `arena` do Modlock, e o anel de marcadores do exemplo `hill` (os dois MIT, `paralin/modlock`). A fila e a troca de herói vêm do Duelo à Meia-Noite.

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

**Autoteste no servidor do jogo, sem pessoas** (`probe.ts`). Com o Deadlock fechado e um servidor de cada vez, rode nesta pasta:

```powershell
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --no-game --arg probe --arg variante=duelo --arg pontos=3
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --no-game --arg probe --arg variante=times
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --no-game --arg probe --arg variante=duelo --arg tempo --arg segundos=40
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --no-game --arg probe --arg variante=dupla --arg pontos=2
..\..\..\tools\modlock-v0.1.73\modlock.exe dev --no-game --arg probe --arg variante=espelho
```

Com o jeito nos argumentos (ou com `probe`), a partida começa sozinha assim que os bots chegam, como antes da tela de escolha; por isso o autoteste não precisou mudar.

O autoteste põe os bots já nos times que a Arena vai dar a eles (2 no duelo, 4 na dupla, 6 nos times, 4 no espelho), segura a partida até todos os bots chegarem e confere: quem luta, os times, os heróis (o mesmo no espelho, cada um o seu nos outros), que todos começam dentro do círculo e que o anel tem os 28 marcadores. Depois leva um bot para fora do círculo e espera o jogo aplicar o golpe do gás. Por rodadas, derruba o lado 1 inteiro a cada rodada e confere o placar até o fim. Com tempo, derruba um bot, confere o ponto, a volta dele protegido dentro do círculo e o círculo fechando, e espera o fim do relógio. No fim confere quem venceu e que a fila girou. O servidor fecha com PASS ou FAIL.

Rodou de novo em 17/11/2026, já com a tela de escolha, no servidor do Modlock v0.1.73, mapa `dl_midtown`, um servidor de cada vez:

| Comando (`--arg`) | Resultado |
|---|---|
| `variante=duelo pontos=3` | **PASS**: 3×0, quem venceu na frente da fila, círculo no mesmo lugar nas 3 rodadas |
| `variante=times` (3 contra 3) | **PASS**: 3×0, fila `Bot 1,Bot 3,Bot 5,Bot 2,Bot 4,Bot 6` |
| `variante=duelo tempo segundos=40` | **PASS**: ponto da queda, volta protegida a 538 do centro, círculo em 977 de 1100, fim 1×1 (empate) |
| `variante=dupla pontos=2` | **PASS**: 2×0, a dupla que venceu continua junta (fila `Bot 1,Bot 2,Bot 3,Bot 4`) |
| `variante=espelho` (2 contra 2) | **PASS**: 3×0, os quatro com o mesmo herói, fila `Bot 1,Bot 3,Bot 2,Bot 4` |

Em todos, o gás pegou no primeiro segundo fora do círculo: cerca de 8% da vida máxima por golpe (96 de 1195, por exemplo).

O autoteste mostrou duas coisas do host da v0.1.73:
- Um golpe de `damage` sem atacante chega no `onDamaged` com **a própria vítima como atacante**, e não com zero, como diz a documentação. A Arena trata os dois casos como gás (e a SDK falsa imita o host).
- Sem centro marcado, o centro é achado na primeira rodada do mapa e guardado. Antes, ele era recalculado a cada rodada a partir de onde os heróis estavam e andava pelo mapa.

## O que ainda não foi provado no jogo

Os testes cobrem as regras, e o autoteste roda só com bots, sem o jogo aberto. Falta ver com gente:
- se os marcadores `◆` aparecem e se dá para ler o anel no chão (ninguém olhou o mapa: o servidor só criou os 28 objetos);
- se o placar na tela aparece como no Duelo à Meia-Noite;
- a troca de time e de herói de pessoas de verdade: os bots do autoteste já chegam no time e no herói certos (o host não troca o herói de um bot), então `changeTeam`, o `selectHero` do espelho e a troca de herói pela tela só foram provados nos testes;
- no espelho com bots, o herói é sempre o dos bots; o sorteio por rodada só foi provado nos testes;
- se quem cai numa rodada sem tempo e é revivido pelo jogo fica mesmo parado assistindo;
- se o meio do caminho entre as bases (onde o círculo cai sem centro marcado) é um bom lugar para lutar;
- a tela de escolha e o quadro do Tab: só foram provados nos testes, com a SDK falsa (quem clica, o que fica desligado, o cursor solto e os botões presos). Ninguém viu ainda o desenho no jogo (tamanhos, a grade de retratos, a chave Com tempo, se o quadro do Tab fica fora do placar do Tab), nem se o cursor solto e o `blockInput` seguram mesmo o tiro com a tela aberta;
- quem assiste sem herói: se o `freeCursor` solta o cursor dessa pessoa para a lista de heróis.
