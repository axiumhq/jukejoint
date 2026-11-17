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

- Lutam os primeiros da fila: no duelo, 2; na dupla, 4; nos times e no espelho, até 12. Pela votação, o jeito precisa caber em quem está na sala (a dupla precisa de 4, bots contam; os outros, de 2); com os argumentos do servidor, os lados encolhem como antes (uma dupla com 3 pessoas vira 1 contra 1). Quem sobra espera e assiste, com a câmera em quem está lutando.
- No fim da partida, a fila gira: quem venceu fica na frente, quem esperava entra e quem perdeu vai para o fim. No duelo e na dupla, os lados são a primeira e a segunda metade de quem luta, então a dupla que venceu continua junta. Nos times, os lados se alternam pela ordem da fila, então os times se misturam a cada partida. No empate, quem esperava entra na frente.
- Se um lado inteiro sai do servidor, o outro leva a partida. Se só uma pessoa do time sai, a partida segue.

## Configurações do lobby e argumentos

O `mod.json` declara três configurações. No Modlock v0.1.73 a configuração é de cada pessoa (`player.setting`); a Arena lê a de **quem chegou primeiro à sala** entre as pessoas (bots não contam), e ela só vale enquanto ninguém votou naquele grupo. A leitura acontece no começo de cada partida.

| Chave | Tipo | Padrão |
|---|---|---|
| `variante` | escolha: `duelo`, `dupla`, `times`, `espelho` | `duelo` |
| `tempo` | chave | desligada |
| `pontos` | número de 1 a 15 (duelo e dupla) | 5 |

Argumentos do servidor valem acima de tudo, para quem roda o servidor e para o autoteste: `--arg variante=times`, `--arg tempo`, `--arg pontos=3` e `--arg segundos=60` (a duração com tempo, para testes). A ordem fica: **argumentos do servidor > votação na tela > configuração do lobby de quem chegou primeiro**. O que um argumento fixa aparece na tela desligado, com "definido pelo servidor", e ninguém vota nele.

## A escolha, por votação

Antes de cada partida (quando a sala abre e depois de cada fim de partida), um painel aparece à esquerda (`escolha.tsx`), no desenho "Lista com votos" (`.design/arena-hud/opcoes.html`, opção A), e o meio da tela e a mira ficam livres. Todo mundo continua andando pelo mapa e segura o Tab para clicar. Quem está sem herói (quem assistia a partida anterior) fica com o cursor solto e os ataques presos, porque sem herói o jogo não tem o Tab. No topo, duas linhas: o que vale pela votação ("Duelo no círculo · até 5 rodadas") e quando começa ("Começa quando as 3 pessoas estiverem prontas", ou "Começando em 3"). Cada informação aparece uma vez só.

- **Modo**: uma linha por modo, com o nome, a regra curta e os votos à direita; uma barra de latão por trás mostra a parte dos votos. O modo que vale tem a borda de latão; o voto da própria pessoa ganha a etiqueta "seu voto". Um modo que não cabe na sala fica apagado e diz "Precisa de 4 pessoas · falta 1" (só a dupla precisa de 4; bots contam).
- **Partida e Vence com**: dois controles lado a lado, Rodadas | Tempo e 3 | 5 | 7 | 10, cada um com os votos embaixo; o que vale fica em latão e o voto da pessoa sublinhado. Com tempo, no lugar dos pontos aparece "3 minutos, o círculo fecha"; nos times e no espelho, "3 rodadas".
- **Votos**: cada pessoa na fila vota em cada grupo. Clicar em outro valor muda o voto; clicar de novo no mesmo tira. Bots não votam. Vale o mais votado; no empate, o que valeu na última partida; sem nenhum voto (ou no empate antes da primeira partida), a configuração do lobby de quem chegou primeiro.
- **Herói**: o retrato do herói, o nome e "Seu herói", com o botão **Trocar**, que abre a lista de heróis por cima (a grade com o nome de cada um e o retrato grande do escolhido; vale da primeira rodada). Sem herói, uma silhueta e "Escolha um herói". No espelho, o aviso de que o herói é sorteado a cada rodada.
- **Pronto**: o botão de latão **Estou pronto**; apertado, vira "Pronto · clique para cancelar", em verde; depois de uma partida, **Jogar de novo**. Embaixo, quem está na sala (retrato ou inicial e o nome; verde quando está pronto; bots com "bot"), e a linha "2 de 3 prontos · falta Mina" (ou "falta você"), com a tecla Tab desenhada e "segure para clicar". Com todo mundo pronto e o modo cabendo, a contagem de 3 corre; se alguém cancela, sai ou o modo deixa de caber, ela para. Sozinha com um bot de treino, basta o pronto da pessoa.
- **Bots de treino** (só quando servem: sozinha na sala, ou com bots): **Treinar com um bot**, **Mais um bot** (até completar os lados, no máximo 4 lugares) e **Tirar os bots**. Quem chegou primeiro também vê **Marcar o centro aqui**.
- A partida **não começa sozinha** sem o pronto de todo mundo. A exceção é quando os argumentos do servidor fixam o jeito (`--arg variante=…`) ou no autoteste (`--arg probe`): aí ela começa assim que houver duas pessoas, como antes, sem botão de pronto, e a lista de modos diz "definido pelo servidor".

**Durante a partida**, segurando o Tab (o jogo mostra o cursor), aparece um quadro pequeno à esquerda: **Trocar herói** abre a lista de heróis (o novo herói entra na próxima rodada; não aparece no espelho) e, só para quem chegou primeiro à sala, **Marcar o centro aqui** muda o centro do círculo para onde o herói está, a partir da próxima rodada. Sem centro marcado, o centro é o meio do caminho entre os dois lados, no chão. Quem assiste da fila, sem herói, vê o quadro o tempo todo. Enquanto o Tab está segurado, o nosso placar sai da frente do placar do jogo.

Os comandos antigos (`/placar`, `/heroi`, `/modo`, `/arena`, `/bot`, `/tirarbots`, `/ajuda`) continuam registrados só como reserva, com as mesmas regras da tela (o `/modo` vota). Nenhum texto do jogo manda ninguém para o chat; o `/ajuda` descreve a tela.

## Na tela e nos números

Tudo no mesmo desenho do painel (`paleta.tsx`): painéis escuros translúcidos com uma linha fina, marfim para o texto, latão para o que vale, âmbar e safira para os lados, verde para pronto e um tom de alerta para o gás e para o que falta. As faces de letra são as do próprio jogo. Sem enfeite.

- **O HUD do jogo**: a Arena esconde a barra do topo, a marca do canto, as almas, os números da esquerda, os avisos de nível e o minimapa (`hideHud`, pedido só quando muda, nunca para bots). Vida, munição e habilidades ficam. Com a lista de heróis aberta, somem também munição e habilidades.
- **O placar**, compacto, no lugar da barra do topo: cada lado com o retrato (nos times, até 6, apagados de quem caiu), o nome em âmbar ou safira e o herói ou quantos estão de pé; os pontos grandes de cada lado; no meio, a rodada com o relógio dela, ou o relógio da partida com tempo; marcadores de pontos até 7. Quem olha fica sempre à esquerda. Embaixo, "O círculo fecha" com uma barra do raio que falta. Com o Tab segurado, o placar sai da frente.
- **No meio da tela**: "Rodada N" enquanto os heróis aparecem; a contagem 3, 2, 1 grande e o "Valendo"; a faixa de quem levou a rodada ou a partida ("Você levou a rodada", "Você venceu"), com o retrato de quem venceu e o placar; e os destaques "Primeira queda" e "Sem tomar dano" (quando o lado que levou a rodada não perdeu vida nenhuma, nem no gás).
- **Abaixo da mira**: fora do círculo, "Fora do círculo", quanto o gás tira, quantos metros faltam até o círculo e uma seta para o centro, com a borda da tela pulsando; quem caiu vê "Você volta em 3" (com tempo) ou "Você caiu" (por rodadas); quem assiste vê a posição na fila.
- **À esquerda**: as últimas quedas, com quem derrubou quem, ou o gás; com o Tab, o quadro de Trocar herói e Marcar o centro.
- **O anel no chão**: uma corrente de 40 lasers rentes ao chão, o efeito de mira do Assassinato (`particles/abilities/assassinate_laser_targetting.vpcf`, um dos efeitos que o host v0.1.73 traz liberados), no latão puxado para o âmbar (diferente do anel vermelho do Hyperline). A ponta de cada trecho segue o começo do trecho seguinte, então o anel fecha junto com o círculo. Se o host recusar o efeito, o anel volta a ser de 40 traços de texto (`createText`).
- Métricas (`mod.json`): `arena.abates` (soma), `arena.vitorias` (soma) e `arena.sequencia` (a maior sequência de abates sem cair).

## A vitrine, para a prévia

A prévia do Modlock (`modlock dev --sandbox`) tem uma pessoa de mentira no lugar de quem joga e nenhum bot, então sem ajuda só dá para ver a escolha. Com `--arg vitrine=<estado>`, a Arena não joga: a cada quadro, monta aquele momento com pessoas e números de mentira em volta da pessoa da prévia e põe o anel no chão, para a tela mostrar o momento parado (`vitrine.ts`). Sem o argumento, ou com um estado que não existe, nada disso roda.

| `--arg vitrine=…` | O que aparece |
|---|---|
| `votacao` | a escolha com 3 pessoas e os votos do desenho (duelo 2, espelho 1; rodadas 2, tempo 1; 5 com 2 votos), 2 de 3 prontos |
| `heroi` | a mesma escolha com a lista de heróis aberta |
| `contagem` | a contagem da rodada 2, no 2 |
| `partida` | duelo com tempo, 2 a 1, relógio em 1:47 |
| `times` | 4 contra 4, um caído de cada lado |
| `fora` | fora do círculo, com a distância e a seta (o centro fica à direita de onde a câmera olhava) |
| `caiu` | dupla, a pessoa da prévia caída esperando a próxima rodada |
| `rodada` | a faixa de quem levou a rodada |
| `vitoria` | o resultado da partida com o destaque "Sem tomar dano" |

## Arquivos

- `arena.ts`: jeitos de jogar, votação, Pronto, fila, fases, placar, quedas e o que cada botão da tela faz.
- `escolha.tsx`: o painel da escolha, as duas linhas do topo antes da partida, a lista de heróis e o quadro do Tab.
- `circulo.ts`: o anel de lasers (ou de texto), o raio que fecha, a distância até a borda, a direção do centro e a conta do gás.
- `hud.tsx`: o que cada pessoa vê a cada quadro (placar, contagem, faixas, avisos, quedas), o HUD do jogo escondido, o cursor e os botões presos.
- `paleta.tsx`: as cores, o texto, o painel e o botão de contorno que todas as telas usam.
- `vitrine.ts`: os momentos de mentira para a prévia (`--arg vitrine=…`).
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

O autoteste põe os bots já nos times que a Arena vai dar a eles (2 no duelo, 4 na dupla, 6 nos times, 4 no espelho), segura a partida até todos os bots chegarem e confere: quem luta, os times, os heróis (o mesmo no espelho, cada um o seu nos outros), que todos começam dentro do círculo e que o anel tem as 40 peças (lasers, ou texto se o host recusar o efeito). Depois leva um bot para fora do círculo e espera o jogo aplicar o golpe do gás. Por rodadas, derruba o lado 1 inteiro a cada rodada e confere o placar até o fim. Com tempo, derruba um bot, confere o ponto, a volta dele protegido dentro do círculo e o círculo fechando, e espera o fim do relógio. No fim confere quem venceu e que a fila girou. O servidor fecha com PASS ou FAIL.

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

Os testes cobrem as regras, e o autoteste roda só com bots, sem o jogo aberto. Na primeira partida com gente (17/11/2026), o placar antigo ficava por cima da barra do topo do jogo e o anel de `◆` não aparecia; o HUD, a escolha e o anel foram refeitos depois disso. Falta ver no jogo:
- se o laser do anel aparece rente ao chão, inteiro, e se fecha junto com o círculo: o ponto de controle da ponta (1), a âncora que segue o trecho seguinte, o latão por cima do vermelho do efeito e o precache só foram provados nos testes; se o host recusar o efeito, o anel volta a ser de texto (a linha `círculo` do log do servidor termina em `lasers` ou `texto`);
- se esconder a barra do topo (`topBar`) esconde também os cartões do placar do Tab; se não, o nosso placar some enquanto o Tab está segurado, mas o quadro da escolha (que precisa do Tab) pode ficar debaixo deles;
- tamanhos e leitura do placar, do painel da escolha (se ele termina acima da vida e dos itens do jogo), da contagem e dos avisos sobre o mapa, em 1920×1080 e em 1366×768; se os fundos translúcidos ficam tão leves quanto no desenho (o Panorama costuma pesar a transparência); a borda do gás e se ela pulsa;
- se a seta para o centro gira para o lado certo (o yaw da câmera) e se os metros batem com o que o jogo mostra (a conta usa 1 unidade = 1 polegada);
- a troca de time e de herói de pessoas de verdade: os bots do autoteste já chegam no time e no herói certos (o host não troca o herói de um bot), então `changeTeam`, o `selectHero` do espelho e a troca de herói pela tela só foram provados nos testes;
- no espelho com bots, o herói é sempre o dos bots; o sorteio por rodada só foi provado nos testes;
- se quem cai numa rodada sem tempo e é revivido pelo jogo fica mesmo parado assistindo;
- se o meio do caminho entre as bases (onde o círculo cai sem centro marcado) é um bom lugar para lutar;
- quem assiste sem herói: se o `freeCursor` solta o cursor dessa pessoa para votar e apertar Pronto;
- a sobreposição do "Valendo" ou da contagem com a faixa e os destaques no meio da tela, que só se cruzam por instantes.
