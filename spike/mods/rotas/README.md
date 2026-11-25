# Rotas

Um modo de prática para chegar mais rápido: a **rota de caixas** ensina a ordem mais curta para quebrar as caixas da lane perto de você, e a **rota de movimento** grava um atalho e cronometra quem corre por ele. É um protótipo separado em `spike/mods/rotas/`; ainda não é um dos modos do site nem do catálogo do app.

O mapa fica como o jogo tem, com as caixas, as tirolesas e os acampamentos. O modo só desliga o que atrapalha: tropas (`citadel_trooper_spawn_enabled` falso, para elas não quebrarem caixas, e as que já existirem saem com `removeEntities('npc_trooper')`), a partida solo com bots, o King of the Hill, os bots de prática e o começo em cima da tirolesa. O preset `arena` da SDK não tira as caixas, mas também desliga os acampamentos (`citadel_neutral_spawn_enabled`), então o modo não usa o preset inteiro: aplica só essas variáveis (`AJUSTES` em `rotas.ts`). A escolha de herói é a do jogo.

## Regras

### Rota de caixas

- `/caixas` pega as caixas de pé (`citadel_breakable_prop`) num raio de 2500 unidades em volta de você, medido de cima, e até 450 unidades acima ou abaixo dos seus pés, para não misturar andares. Se houver mais de 30, ficam as 30 mais perto.
- A ordem sai do vizinho mais próximo (da sua posição, sempre para a caixa mais perto que falta), melhorado pelo 2-opt (inverte trechos enquanto o caminho encurta). O 2-opt também roda na ordem em que o mapa lista as caixas, e fica a mais curta das duas, então o plano nunca sai pior que a ordem ingênua. O chat mostra o comprimento do caminho e quanto daria na ordem do mapa.
- Cada caixa ganha o número dela no mundo, em texto virado para a câmera, visto só por você. A próxima fica amarela e maior.
- O relógio começa quando você sai 150 unidades do ponto de partida, ou quando a primeira caixa quebra (para quem atira sem sair do lugar). A caixa conta como quebrada quando some do mapa (`entityPosition` sem resposta) ou quando o jogo diz que você a quebrou (`propBroken` nas amostras de movimento). Uma caixa quebrada fora da ordem conta, mas aparece no resultado.
- Na última caixa aparecem o tempo e o seu recorde naquele lugar, nesta sessão do servidor.
- **Como o lugar é identificado:** pelo mapa, pela partida arredondada numa grade de 400 unidades (200 na altura) e pelo raio, como em `dl_midtown@-800,-2800,400~2500` (`chaveDoLugar` em `caixas.ts`). Começar a poucos passos do mesmo ponto cai no mesmo lugar; atravessar uma linha da grade, ou mudar o raio, cai em outro. O recorde é por pessoa (pelo nome) e vale enquanto o servidor estiver de pé.

### Rota de movimento

- `/gravar` guarda a sua posição a cada 0,1 s e as ações de movimento que o jogo anuncia (`watchMovement` e `FrameEvent.movement`): dash no chão, deslize, pulo com dash, pulo duplo, pulo na parede, dash no ar, tirolesa, plataforma de salto e pouso.
- `/fim` transforma o caminho em pontos de controle a cada 500 unidades, com o último no fim, e mostra o comprimento, o tempo e as técnicas usadas, em ordem (repetições seguidas juntas, pousos contados à parte). Cada ponto guarda as técnicas que a gravação usou para chegar até ele, e o marcador mostra isso ("2 / deslize").
- O tempo da gravação é medido como uma corrida: a gravação é refeita pelo mesmo cronômetro da corrida, da saída da partida até tocar o último ponto. O tempo parado antes de sair e depois de chegar não conta.
- Uma gravação com um salto de mais de 1200 unidades entre duas amostras (teleporte ou volta à base), com menos de 400 unidades, ou que não sai da partida, é recusada. Se o herói morre, a gravação para. Depois de 10 minutos ela termina sozinha.
- `/correr` leva você à partida, virado para o primeiro ponto, e mostra a partida e os pontos. Se o teleporte falhar, o chat pede para ir até o marcador "partida". O relógio começa quando você sai do raio de 150 unidades da partida e para quando você toca o último ponto. Cada ponto precisa ser tocado na ordem, a até 200 unidades. O modo testa o trecho entre dois quadros, e não só a posição, então quem passa rápido (tirolesa, dash) não pula um ponto sem contar. Os tempos são interpolados dentro do quadro.
- No fim aparecem o tempo contra a gravação e contra o recorde da rota.

### Escolhas e números

| O quê | Valor | Onde |
|---|---|---|
| Raio de `/caixas` | 2500 (300 a 6000) | `RAIO_PADRAO` em `caixas.ts` |
| Faixa de altura das caixas | ±450 | `FAIXA_DE_ALTURA` |
| Caixas por rota | até 30, as mais perto | `MAXIMO_DE_CAIXAS` |
| Raio da partida (as duas rotas) | 150 | `RAIO_DA_PARTIDA`, `RAIO_DA_LARGADA` |
| Amostra da gravação | 0,1 s | `INTERVALO_DA_AMOSTRA` em `percurso.ts` |
| Distância entre pontos de controle | 500 | `ESPACO_ENTRE_PONTOS` |
| Raio de toque do ponto | 200 | `RAIO_DO_PONTO` |
| Salto que invalida a gravação | 1200 por amostra | `SALTO_MAXIMO` |
| Checagem das caixas no mapa | a cada 0,1 s | `CHECAGEM_DAS_CAIXAS` em `rotas.ts` |

## Comandos no chat

| Comando | O que faz |
|---|---|
| `/caixas [raio]` | Planeja a ordem mais curta para quebrar as caixas perto de você e marca cada uma com o número. |
| `/parar` | Cancela a rota de caixas, a gravação ou a corrida em andamento. |
| `/gravar` | Começa a gravar o seu trajeto. |
| `/fim` | Termina a gravação: pontos de controle, comprimento, tempo e técnicas. |
| `/correr [nome]` | Corre a última rota gravada, ou uma salva com esse nome. |
| `/salvar <nome>` | Guarda a última rota gravada com um nome (letras, números, hífen, até 24; "Ponte Azul" vira `ponte-azul`). O mesmo nome substitui. |
| `/rotas` | Lista as rotas salvas deste mapa, com autor, tempo gravado e recorde. |
| `/ajuda` | Lista os comandos. |

A faixa do topo (`hud.tsx`) mostra o que está rodando: caixas quebradas e relógio, a gravação, ou o ponto da corrida contra o tempo gravado. Depois do fim, ela mostra o resultado por 8 segundos e some.

## Rotas salvas

As rotas ficam em `rotas-<mapa>.json` pela API de arquivos da SDK (`readFile` e `writeFile`), até 50 por mapa, cada uma com o recorde e quem o fez. O host guarda esses arquivos fora do mod (`--files %APPDATA%\modlock\files`), e eles sobrevivem a um servidor novo: o autoteste grava um contador em `autoteste.txt`, e seis execuções seguidas contaram de 1 a 6, cada uma lendo o número da anterior. Se o host recusar a escrita, o chat avisa que a rota vale só até o servidor fechar, e ela continua valendo na memória. Os recordes de caixas não vão para arquivo: são desta sessão.

## Testar

As regras rodam sem o jogo, contra uma versão falsa da SDK (`test/fake-modlock.ts`). As contas (plano, pontos, cronômetro, recordes) são funções puras em `caixas.ts`, `percurso.ts` e `comum.ts`, e os testes as chamam direto. As caixas dos testes são as de verdade de `dl_midtown`, lidas no servidor (`test/caixas-dl_midtown.json`). Esta pasta não tem `node_modules` próprio, então os testes usam o Vitest do site:

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

O autoteste põe um bot no trecho de lane em (-1000, -3000), roda `/caixas` para ele e confere que o plano não sai pior que a ordem do mapa e que cada caixa ganhou a marca. Depois vai de caixa em caixa na ordem do plano: põe o bot a 220 unidades e atira nela (`drive` com o tiro apertado, mirando do olho do bot). A caixa que não quebra em 4 segundos sai com a entrada `Kill`; depois de três seguidas sem quebrar a tiro, o resto vai direto por `Kill`. Confere que o tempo fecha e vira recorde. Em seguida grava uma rota levando o bot por três pernas a 600 unidades/s, salva, corre por ela a 800 unidades/s e confere que a corrida termina mais rápido que a gravação. No fim, apaga a rota do autoteste do arquivo.

Rodou em 05/11/2026 no servidor do Modlock v0.1.73, mapa `dl_midtown`: **PASS** em cerca de 31 segundos. 30 caixas no raio; caminho planejado de 12 694 unidades, contra 13 981 do vizinho mais próximo sozinho e 58 203 da ordem do mapa (essa muda a cada execução, porque segue os handles das entidades); 30 marcas criadas; as 30 caixas tiradas na ordem, sem nenhuma fora da ordem, tempo 14,44 s. A rota de movimento mediu 2411 unidades (2300 esperadas), 5 pontos, gravação de 3,22 s; a corrida fechou em 2,44 s.

No jogo, com o Deadlock fechado: `modlock dev --watch` nesta pasta abre o jogo num servidor local.

## O que o autoteste mostrou sobre a SDK

- `damage` recusa props (a SDK diz que o cliente cai com o dano neles), e `citadel_breakable_prop` não tem a entrada `Break` ("has no input Break").
- O tiro do bot não chegou nas caixas no servidor sem jogo: com o tiro apertado e a mira na caixa, o jogo não registrou nenhum golpe do bot (`onDamaged`), nenhum `propBroken`, e um `trace` do olho do bot até a caixa não acerta nada (a caixa não responde às camadas padrão do trace). Nenhuma das 30 quebrou a tiro.
- Por isso as caixas saíram com a entrada `Kill`, que remove a entidade. Isso prova a contagem por sumiço, o plano, as marcas e o relógio, mas não prova que uma caixa **quebrada no jogo** some do mapa do mesmo jeito.
- `m_iHealth` da caixa lê 0 mesmo de pé, então a vida não diz se a caixa quebrou. O modo não usa esse campo.
- Perguntar a posição de uma caixa que sumiu deixa uma linha "no live entity has that handle" no log do host, uma por caixa.
- `writeFile` funciona no `modlock dev` e o arquivo sobrevive entre execuções.
- `createText` respondeu com objetos no servidor (30 marcas de caixas, 6 da corrida), mas ninguém os viu numa tela.
- O modo não usa partícula: nenhuma foi testada, e o texto basta para o número.

## O que ainda não foi provado no jogo

- Se uma caixa quebrada por um golpe some do mapa (`entityPosition` sem resposta) ou se o jogo a troca por destroços. Se ela ficar, o modo depende do aviso `propBroken`, que só o host com uma pessoa de verdade manda.
- Se as caixas voltam depois de quebradas e em quanto tempo. Se voltarem, a rota seguinte pega as novas sem problema.
- Se os números no mundo ficam legíveis a 2500 unidades, e se a altura de 70 acima da caixa é boa.
- Se as ações de movimento (deslize, pulo com dash, tirolesa) chegam em `FrameEvent.movement` como a SDK descreve: o bot do autoteste é teleportado e não anuncia nenhuma.
- Se o tiro e o golpe de uma pessoa quebram as caixas e geram o `propBroken` (no servidor sem jogo, o tiro do bot não acertou nenhuma).
- Se 150 unidades de partida e 200 de toque são justos com heróis rápidos e lentos.
- Se a escolha de herói do jogo abre normalmente com este modo rodando.
