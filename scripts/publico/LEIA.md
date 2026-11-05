# Teste com duas pessoas pela internet

A partida é P2P: o jogo vai direto de um PC para o outro. Os dois pontos de encontro rodam no Raspberry Pi do `axiumhq/infra-pi`, publicados pelo túnel da Cloudflare dele (sem abrir porta no roteador):

| Endereço | O que é |
|---|---|
| `https://api.jukejoint.app` | A API: login pela Steam, lobbies, salas |
| `https://signal.jukejoint.app` | A sinalização: os dois PCs trocam o endereço um do outro e depois se ligam direto |

Ninguém precisa deixar servidor ligado no próprio PC. Os comandos abaixo rodam no PowerShell, na pasta do repositório.

## Antes do teste: o servidor está no ar?

```powershell
curl.exe -s https://api.jukejoint.app/healthz; curl.exe -s https://signal.jukejoint.app/healthz
```

Os dois têm de responder. Se um falhar, fale com quem cuida do Pi: a correção é lá, não no seu PC.

Cada build do `main` e cada release publicam imagens novas e abrem um PR de versões no `infra-pi`. Quando esse PR entra, o Pi reinicia a API. Combine com quem cuida do Pi para não fazer isso durante o teste: o login continua valendo depois do reinício, mas os lobbies abertos somem.

## O app (um instalador para as duas pessoas)

Baixe `Jukejoint-vX.Y.Z-windows-x64-setup.exe` na página **Releases** do GitHub e mande esse único arquivo para a outra pessoa. O instalador já traz o app, o Modlock fixado e os modos, com os endereços de produção configurados. Ninguém precisa baixar o Modlock separado nem compilar o app.

As duas pessoas rodam o instalador e abrem o Jukejoint pelo atalho criado. O Windows pode mostrar o aviso do SmartScreen, porque o instalador ainda não é assinado. O `LEIA-ME.txt` instalado explica o login e como preparar o jogo.

Para testar uma mudança que ainda não virou release, gere o app no seu PC. Ele sai em `desktop\out\Jukejoint.zip`, que o próximo build apaga, então extraia numa pasta sua. O app registra o link `jukejoint://` para a pasta de onde ele abriu por último.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publico\gerar-app.ps1
```

## No dia do teste

1. **Confira o servidor** com o comando acima.
2. **As duas pessoas abrem o Jukejoint e clicam em Login.** O navegador abre a Steam; depois de entrar, aceite abrir o Jukejoint.
3. **Uma pessoa cria o lobby**, em qualquer modo, porque por enquanto todos abrem o modo de teste `hello`. A outra acha o lobby na lista e entra. O "Copiar convite" gera um link `jukejoint://join/...`, que funciona colado no navegador, mas o Discord não deixa clicar nele.
4. **Deadlock fechado nos dois PCs.** As duas pessoas marcam pronto, quem criou inicia, e o app abre o jogo em cada PC.
5. **Deu certo quando** as duas pessoas estão no mesmo servidor e o comando `/hello` responde para as duas.
6. **No fim**, feche a sala pelo app e depois feche o app. Nunca encerre o `modlock.exe` pelo Gerenciador de Tarefas: isso deixa um arquivo travado até reiniciar o PC.

## Se der errado

- **A segunda pessoa não consegue entrar na sala, mas as duas estão logadas:** a ligação direta entre os PCs não fechou. A causa mais provável é CGNAT ou NAT restritivo numa das redes. Ainda não temos servidor de retransmissão (TURN), então a saída é tentar de outra rede (por exemplo, uma das pessoas no roteador de casa em vez de 4G).
- **O login não volta para o app:** abra o Jukejoint de novo pela pasta extraída (isso refaz o registro do link) e tente outra vez.
- **O lobby sumiu no meio do teste:** a API reiniciou no Pi. Entrem de novo (o login continua valendo) e criem outro lobby.
- **Logs para juntar:**
  - o motor, nos dois PCs: `%APPDATA%\modlock\state\daemon-app.log`;
  - a API e a sinalização: com quem cuida do Pi (`docker logs` dos containers do projeto `pi-infra-jukejoint`).

## Rodar os servidores no seu PC (só para desenvolvimento)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publico\ligar.ps1 -SemTunel
```

Sobe a API e a sinalização neste PC, em `127.0.0.1:8291` e `127.0.0.1:8080`, para ver se compilam e respondem. O app do zip não usa esses servidores: ele fala com os endereços públicos.

O `ligar.ps1` sem `-SemTunel`, o `configurar-tunel.ps1`, o `guardar-token.ps1` e o `PARA-O-DONO-DO-DOMINIO.md` são do tempo em que o servidor rodava num PC. Os endereços `api.` e `signal.` agora apontam para o túnel do Pi, então um túnel ligado no seu PC não recebe nada. Para voltar a esse modo, alguém teria de apontar os endereços de novo para o túnel antigo na Cloudflare.

## Limites conhecidos

- **Os lobbies ficam só na memória da API.** Um reinício no Pi fecha todos eles; o login sobrevive, porque a chave da sessão fica gravada no volume do container.
- **Sem TURN**, duas redes com CGNAT não se ligam.
