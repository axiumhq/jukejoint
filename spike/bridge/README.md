# bridge: nossa página-ponte da UI dentro do jogo

O Deadlock só carrega páginas **https** nos painéis HTML. Por isso, o renderer do Modlock dentro do jogo (`panorama/src/bridge.ts`) carrega uma página-ponte que:

1. lê a tela do jogador em `http://127.0.0.1:<port>/panorama/stream`, uma linha `~<seq>:<bytes empacotados>` por tela;
2. escreve essa tela no **título** da página, em partes de até 4000 caracteres: `modlock:frame:<id>:<offset>:<total>:<seq>:<pedaço>`;
3. só manda a próxima parte depois do **ack** do renderer, que alterna o fragmento entre `#0` e `#1`.

O código original da página não está no repositório do Modlock (o padrão aponta para `https://hyperline.gg/app/relay/bridge.html`). Esta versão foi reimplementada a partir do protocolo do renderer e do relay da v0.1.68.

## Arquivos

| Caminho | O que é |
|---|---|
| `public/app/relay/bridge.html` | A página, com CSP restrita: só scripts do próprio domínio e conexões só para loopback |
| `public/app/relay/bridge.js` | A lógica: `createBridge` (envio em partes, ack, timeout e tela mais nova) e `readLines` (stream) |
| `test/bridge.test.mjs` | 6 testes com uma cópia do leitor do jogo: `node --test test/bridge.test.mjs` |
| `dev/serve.mjs` + `dev/harness.*` | Teste no navegador: relay falso em `127.0.0.1:4329` e uma página que faz o papel do jogo |

## Como hospedar

Sirva `public/` num domínio **https** nosso, de modo que exista `https://<dominio>/app/relay/bridge.html`.

**Caminho grátis, Cloudflare Pages.** Não precisa de domínio: o endereço fica `https://<projeto>.pages.dev`. O `public/_headers` já define CSP e cache.
1. Crie a conta no Cloudflare (você).
2. Na pasta do projeto:
   ```
   npx wrangler login
   npx wrangler pages deploy spike/bridge/public --project-name <projeto>
   ```
3. Confira se `https://<projeto>.pages.dev/app/relay/bridge.html` abre com o título `modlock:loading` e depois `modlock:bad-port`.

Depois rode o Modlock com:

```
modlock dev --ui-relay https://<dominio>
```

O relay do Modlock só atende quando a `Origin` é **exatamente** o valor de `--ui-relay` e o User-Agent contém `Source2 HTML`. Ou seja, um navegador comum recebe 403, e só o jogo lê a tela.

## Testado em 01/11/2026

- `node --test`: 6/6. Cobre tela pequena, tela grande em partes, tela mais nova vencendo, ack perdido com reenvio e stream quebrado no meio de um caractere.
- Navegador real (harness): 3 rodadas, com 5 telas de 50 a 10.000 bytes chegando íntegras (checksum), sem erros.
- **Ainda não testado dentro do Deadlock.** Falta hospedar em https e rodar `modlock dev --ui-relay`.
