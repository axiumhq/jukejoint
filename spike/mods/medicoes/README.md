# Medições

Um modo de laboratório, sem pessoas, que mede no servidor do jogo os números que as rotas precisam. Não é um modo do site nem entra no app.

```powershell
..\..\..\tools\modlock-v0.1.73\modlock.exe --json dev --no-game
```

Cada medida sai no log como `MEDIDA <tipo> <json>`.

## O que já saiu (05/11/2026, Modlock v0.1.73, `dl_midtown`, sem partida rolando)

| Medida | Resultado |
|---|---|
| Andar (`hero_inferno`) | 312 unidades/s |
| Tirolesa | mediana de 891 unidades/s, pico de 2046 na arrancada |
| Pular sem parar | 118 unidades/s, mais devagar que andar |
| Wave até o guardião inimigo | 34 a 36 s no meio, 40 a 42 s nas laterais (duas rodadas iguais) |
| Marcos | 672 caixas, 6 guardiões (`npc_trooper_boss`), 12 barracas, 6 walkers (`npc_boss_tier2`), o chefe do meio |

## O que o bot não consegue medir

- **Dash, dash-jump e slide:** o bot não dá dash. Tentei `drive` com o botão tocado, o botão segurado por 4 ticks e `player.press`, e nenhum deles gerou ação de dash nem gastou estamina. O pulo funciona.
- **Valor e volta das caixas:** `m_nGoldCost` vem 0 nas 672 caixas. O bot não quebra caixa no soco nem a tiro, nem depois de `citadel_respawn_all_breakables`. O mais provável é que, sem partida rolando, as caixas não estejam ativas.

Esses números dependem de uma sessão gravada com uma pessoa: o Modlock grava o comando dela a cada tick, e o `steer` repete esse comando num bot.
