# Para quem tem o jukejoint.app na Cloudflare

Oi! Preciso que você crie um túnel da Cloudflare na sua conta para o teste do Jukejoint. Leva uns 10 minutos e não precisa instalar nada no seu PC. No fim, você me manda um token (no privado).

O túnel publica dois endereços que vão apontar para servidores rodando no meu PC:
- `api.jukejoint.app` → `http://127.0.0.1:8291`
- `signal.jukejoint.app` → `http://127.0.0.1:8080`

## 1. Domínio ativo

Em dash.cloudflare.com, o `jukejoint.app` precisa aparecer como **Ativo**. Se estiver pendente, os nameservers do registrador ainda não foram trocados pelos dois que a Cloudflare mostra.

## 2. Criar o túnel

1. No menu da esquerda, abra **Zero Trust**. Se for a primeira vez, ele pede um nome de equipe e um plano: escolha o **Free**.
2. Vá em **Networks → Tunnels** (em algumas versões do painel: **Networks → Connectors**) e clique em **Create a tunnel**.
3. Tipo: **Cloudflared**. Nome: `jukejoint`. Salve.
4. Na tela de instalar o conector, escolha **Windows**. Ela mostra um comando com um texto bem longo que começa com `eyJ`: **esse é o token**. Copie só ele.
   **Não rode o comando no seu PC:** quem vai rodar o conector sou eu.
5. Clique em **Next**.

## 3. Os dois endereços (Public hostnames)

Adicione dois, um de cada vez:

| Subdomain | Domain | Type | URL |
|---|---|---|---|
| `api` | `jukejoint.app` | HTTP | `127.0.0.1:8291` |
| `signal` | `jukejoint.app` | HTTP | `127.0.0.1:8080` |

Deixe o caminho (path) vazio e as opções avançadas como estão. Salve o túnel.

## 4. Conferir

- Em **DNS → Records** do `jukejoint.app`, devem aparecer `api` e `signal` como CNAME para `…cfargotunnel.com`, com a nuvem laranja (proxied). O painel cria sozinho.
- **Não** coloque Cloudflare Access (tela de login) na frente desses dois endereços: o app precisa chegar neles direto.
- Em **Security → Bots**, se o **Bot Fight Mode** estiver ligado, desligue. Ele bloqueia o app e o motor do jogo, que não são navegadores.
- **Network → WebSockets** precisa estar ligado (já vem ligado).

## 5. Me mandar o token

Mande o token **no privado** (não em grupo nem em canal). Quem tiver esse token consegue ligar um servidor nesses dois endereços.

Se ele vazar, ou quando o teste acabar: no túnel `jukejoint`, use **Refresh token** (ou apague o túnel). O token antigo para de funcionar na hora.

Valeu!
