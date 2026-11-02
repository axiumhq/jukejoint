# Contrato do kit da Torre (Blender → web)

*v5, 03/11/2026. O código lê este arquivo e o artista modela de acordo com ele. Mudou algo? Atualize aqui primeiro.*

## Arquivo
- `web/public/models/torre-kit.glb`: um glTF binário, **sem Draco** (o three carrega direto com `GLTFLoader`, sem decodificador extra), com no máximo **250 KB**.
- Eixo Y para cima, metros = unidades do three. Origem de cada peça no **centro da base** (y = 0 no piso da peça).
- Cada peça tem normais corretas, chanfros nas arestas e **sem texturas embutidas**. Os materiais são trocados no código pelos shaders da torre, que leem o **nome do material**.

## Medidas (de `web/src/three/world.ts`)
- Altura de um andar: `FLOOR_H = 1`.
- Uma vaga (janela) a cada `BAY = 0.62`, com `PAD = 0.46` de margem em cada ponta. Largura de um andar com N vagas = `2·PAD + N·BAY`. N vai até 12.
- Abertura da janela: `WIN_W = 0.4` × `WIN_H = 0.6`, centrada na vaga. As janelas **continuam sendo geradas pelo código** (acendem ao vivo), então os módulos de fachada deixam esses vãos **abertos**.
- Pedestal: `PLINTH_H = 3.2`.

## Peças (nomes exatos dos objetos)
| Nome | O que é | Notas |
|---|---|---|
| `floor_A`, `floor_B`, `floor_C` | Módulos de fachada de um andar, **para 1 vaga** (largura `BAY`, altura `FLOOR_H`, profundidade 0,5) | O código repete o módulo N vezes ao longo da largura. A, B e C são ritmos diferentes: pilastra lisa, nervura vertical, arco escalonado |
| `floor_cap_L`, `floor_cap_R` | Remates das pontas do andar (largura `PAD`) | Cantos chanfrados ou contrafortes |
| `setback_ledge` | Cornija de recuo, para 1 vaga | Usada onde a torre "recua" |
| `base` | Pedestal com arcada e porta | Largura de referência 8, altura `PLINTH_H`; o código escala em X |
| `crown` | **Coroa-assinatura**: arcos escalonados, janelas triangulares, sol em relevo | Original, nada de Chrysler ou Empire State; altura ~6 |
| `spire` | Agulha que sobe de dentro da coroa | Separada, para animar a subida |
| `ornament_gargoyle` | Gárgula déco genérica | Usada nos cantos dos recuos |
| `ornament_sunburst` | Sol escalonado em relevo | Para a fachada e a placa |
| `ornament_pilaster` | Pilastra de latão com capitel | Para o pedestal |

## Materiais (nomes exatos)
`obsidian`, `obsidian_matte`, `brass`, `brass_dark`, `verdigris`, `stone`, `glass`. O código substitui cada um pelo material equivalente da torre. Uma peça pode usar vários.

## Kit da cidade (entorno, leva 2)

- **Arquivo:** `web/public/models/cidade-kit.glb`. Mesmas regras: glTF binário, sem Draco, sem texturas, Y para cima, origem no centro da base, frente em +Z, no máximo **300 KB**.
- **Distância:** os prédios de fundo são vistos de longe e em grande número, então a silhueta importa mais que o detalhe. Cada um com no máximo **1,5 mil triângulos**.

| Nome | O que é | Notas |
|---|---|---|
| `bldg_A` … `bldg_E` | Cinco prédios de fundo art déco com silhuetas distintas (recuos, torres d'água, mansarda, cúpula pequena, escalonado) | Alturas entre 12 e 40. As janelas são faces separadas, com os materiais `window_lit` e `window_dark`, para o shader acender e apagar |
| `water_tank` | Caixa d'água de madeira sobre pés de aço | Para os telhados |
| `lamp_post` | Poste déco de luz de sódio, com braço e lanterna | Altura ~4,2. Um objeto vazio `lamp_light` marca onde fica a luz |
| `el_track` | Módulo de trilho elevado com vigas de aço rebitadas | 4 de comprimento, emendável. Altura do trilho ~6 |
| `el_car` | Vagão de trem elevado dos anos 1930 | Comprimento ~3,8, com janelas `window_lit` |
| `searchlight` | Holofote de estreia (base com tambor inclinável) | Um objeto vazio `beam_origin` marca a saída do facho |
| `steam_vent` | Bueiro e grade de vapor | Ponto de onde sai a fumaça |
| `billboard_frame` | Moldura de letreiro luminoso vazia | Para texto nosso; nunca nomes do jogo |
| `cable_pylon` | Torre de cabos para tirolesa sobre a rua | O cabo é gerado no código |

**Materiais extras:** `window_lit`, `window_dark`, `sodium` (lâmpada) e `steel`, além dos 7 da torre.

## Comportamento esperado no código
- Se o arquivo **não existir ou falhar**, a torre continua com a geometria procedural atual. O kit é uma melhoria progressiva.
- O kit carrega dentro do chunk 3D e não muda a primeira pintura.

## Como o código encaixa (v5 leva 1, `web/src/three/world.ts` → `applyKit`, `layout`, `buildPlinth`, `buildCrown`)
- Módulos `floor_*`, remates e `setback_ledge`: fundo (z = −0,25) encostado na face do corpo do andar (`z = d/2 + 0,25`); as janelas do código vão para `z ≈ +0,035` do módulo. O ritmo A/B/C sai do modo do lobby.
- `ornament_gargoyle`: nos dois cantos de cada recuo, girada ±45° para fora.
- `base`: escala X = largura do andar de baixo / 8 e **também Z** = profundidade / 5 (os módulos de fachada deixam a torre mais funda que 5). Pilastras a x = ±1,0 (escaladas com X) e sol em y = 2,4, nos encaixes do modelador.
- `crown`: escala **uniforme** para a largura do último andar (0,9 a 1,6). A agulha assenta em y = 5,3 da coroa e, na abertura, sobe de dentro da lanterna.
- Material `glass` vira luz: âmbar no `base` (gente), azul-frio na coroa e nas gárgulas (o sobrenatural).

## Como o código encaixa a cidade (v5 leva 2, `web/src/three/city.ts`)
- Peças parecidas viram uma geometria só por peça (`mergeKit`), com a classe do material por vértice; tudo que fica parado é assado numa malha única. Trem e holofotes são instanciados.
- `bldg_*`: escala por fileira (1,0 perto a 1,6 longe), giro de no máximo ±0,12 rad (a frente continua para a câmera). Caixas d'água vão para o telhado plano mais baixo achado na geometria (`roofAt`).
- `lamp_post` ×1,25 (a luz pontual e o cone saem de `lamp_light`); `el_track` ×1,25, emendado de ponta a ponta em z = −17; `el_car` ×1,25 correndo no trilho.
- `searchlight` ×1,6: a base gira em Y (pan), `searchlight_drum` gira em X (tilt) e o facho sai de `beam_origin`.
- `cable_pylon` ×1,15 girada 90° (o cabo corre em X na cena); o cabo sai de `cable_anchor`.
- `billboard_frame` ×1,25 no telhado do prédio à direita da torre; o texto vai num plano em `text_anchor` (5,9 × 2,4). O `sodium` dela vira lâmpada que corre.
- `stone` da cidade é uma pedra mais clara que a da torre; `window_lit` do vagão vira janela quente; `sodium` do tambor vira lente fria.

