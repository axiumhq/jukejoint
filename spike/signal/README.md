# signal: nosso servidor de signaling (spike)

Implementa os dois endpoints que um daemon do Modlock chama na origem:
- `POST /api/signal/ticket`
- `GET /api/signal/ws`

Também tem `GET /healthz`. O núcleo é o servidor do Spacewave (`net/signaling/rpc/server`), nas mesmas versões que o Modlock v0.1.68 fixa. Ele só repassa ofertas WebRTC entre peers pelo ID.

## Segurança

O `POST /api/signal/ticket` **verifica a assinatura** do pedido em vez de confiar no `X-Peer-ID`:

- recalcula o sha256 do corpo e exige que seja igual ao `X-Sw-Hash`;
- remonta o `SigningPayload` do Spacewave (prefixo de ambiente, método, caminho, timestamp, tamanho e hash do corpo), serializa como o cliente e confere o `X-Signature` (Ed25519) com a chave pública contida no peer ID;
- rejeita timestamps fora de ±5 minutos;
- qualquer falha responde **403** (nunca 401: o cliente fixado desiste do peer para sempre depois de um 401) e o motivo vai para o log, com o campo `peer`.

O prefixo de ambiente vem do flag `-env` (padrão `hyperline`, o valor fixo no Modlock v0.1.68).

O ticket devolvido é um **token opaco com validade de 10 minutos**, e o `GET /api/signal/ws` só aceita esse token:

- formato: `base64url(peer ID || validade em ms unix, 8 bytes) + "." + base64url(HMAC-SHA256(segredo, mensagem))`, só caracteres seguros em URL;
- o ws confere o HMAC em tempo constante **antes** de ler a mensagem, depois a validade, e **deduz o peer do próprio token**: um token de A não serve para se passar por B, e saber o peer ID de alguém não adianta mais nada;
- token inválido, adulterado, de outro segredo ou vencido responde **403 antes do upgrade** (nunca 401, pelo mesmo motivo do ticket) e o motivo vai para o log (`signaling refused`), sem nunca registrar o token nem o segredo;
- a validade só vale para **abrir** o socket: um socket já aberto continua aberto. O cliente pede um ticket novo a cada (re)conexão, então 10 minutos bastam.

O segredo do HMAC vem do flag `-secret-file`: se o arquivo não existe, o servidor gera 32 bytes aleatórios e grava com permissão 0600 (um arquivo de tamanho errado é erro, nunca é sobrescrito). Sem o flag, o segredo é aleatório e só vive em memória, e o servidor avisa que os tickets não sobrevivem a um reinício. No Windows o bit 0600 não restringe o acesso: proteja a pasta do arquivo.

**O que falta:** um pedido de ticket assinado pode ser repetido dentro da janela de 5 minutos do timestamp, o que só devolve outro ticket válido para o mesmo peer (não dá para virar outro peer). Não há como revogar um ticket antes dos 10 minutos além de trocar o segredo, e o ticket vai na query string, então pode aparecer em logs de proxies na frente do servidor.

## Compilar

```bash
export PATH="$PWD/../../tools/go/bin:$PATH" GOTOOLCHAIN=local
go build -o ../../tools/signal.exe .
```

## Imagem Docker

`spike/signal/Dockerfile` gera um binário estático sobre o distroless `static:nonroot` (usuário 65532, sem shell). O CI (`.github/workflows/images.yml`) publica `ghcr.io/axiumhq/jukejoint-signal` para `linux/arm64` e `linux/amd64`.

```bash
docker buildx build --platform linux/arm64 -t jukejoint-signal spike/signal
```

A imagem roda `-addr :8080 -secret-file /data/signal-secret.key`: monte um volume em `/data` para os tickets sobreviverem a um reinício. `-healthcheck` pede o `/healthz` da porta do `-addr` pelo loopback e sai com 0 ou 1; é o `HEALTHCHECK` da imagem (que supõe a porta 8080).

## Testes

```bash
go vet ./... && go test ./...
```

`main_test.go` assina os pedidos com o próprio `transport.SignHTTPRequest` do Spacewave, com uma chave recém-gerada. Cobre: assinatura válida (200), corpo adulterado, peer ID errado e timestamp velho ou futuro (403). Para o token: ida e volta do ticket até o ws (101), validade, segredo de outro servidor, adulteração (validade ou peer trocado sob o HMAC de A), lixo e peer ID puro (403 antes do upgrade) e o `-secret-file` (criação, releitura, tamanho errado).

## Testado em 01/11/2026 (um PC, dois peers)

```bash
tools/signal.exe -addr 127.0.0.1:8080
APPDATA='C:\Users\lagun\.mlA' modlock daemon --origin http://127.0.0.1:8080 --idle 30m
APPDATA='C:\Users\lagun\.mlB' modlock daemon --origin http://127.0.0.1:8080 --idle 30m
APPDATA='C:\Users\lagun\.mlA' modlock daemon probe <peer de B>
```

Resultado: os dois peers receberam ticket (já com a assinatura verificada) e conectaram no signaling, e o `probe` abriu o link WebRTC A→B com **round trip de 529 µs**. Nenhuma chamada foi ao hyperline.gg.

Repetido em 01/11/2026 com o token HMAC (`tools/signal.exe -addr 127.0.0.1:8080 -secret-file <arquivo>`): os dois peers conectaram com o ticket opaco, o `probe` deu 580 µs e 538 µs, e `curl "…/api/signal/ws?tk=<peer ID de B>"` passou a responder **403**. Os dois primeiros `probe`, logo após os daemons subirem, não deram medida útil: um mostrou `0s` e o seguinte `the peer did not answer the probe`, embora o link WebRTC tenha sido estabelecido nos dois lados pelo signaling. Causa não investigada.

## Pegadinhas encontradas

1. **`modlock daemon status` sobe um daemon sozinho apontado para o hyperline.gg** quando nenhum está rodando. Lá o ticket volta 403 sem login. Sempre suba o daemon com `--origin` **antes** de qualquer outro comando.
2. **Socket AF_UNIX travado:** matar um daemon à força deixa um `modlock.sock` que o Windows não deixa apagar (erro 1920). O daemon seguinte falha com `bind: invalid argument`. Pare com `modlock daemon stop`, nunca matando o processo.
3. **Caminho do socket longo demais:** com `APPDATA` muito comprido, o bind falha (limite de caminho do AF_UNIX). Use pastas curtas como `C:\Users\<voce>\.mlA`.
4. A troca de `APPDATA` dá a cada daemon a sua própria pasta de estado. Isso permite simular dois PCs numa máquina só.
