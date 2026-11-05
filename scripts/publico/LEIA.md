# Teste com um amigo pela internet

A partida é P2P: o jogo vai direto de um PC para o outro. Do seu PC saem só os dois pontos de encontro, publicados no seu domínio por um túnel da Cloudflare (sem abrir porta no roteador):

| Endereço | O que é | Roda em |
|---|---|---|
| `https://api.jukejoint.app` | A API: login pela Steam, lobbies, salas | `127.0.0.1:8291` |
| `https://signal.jukejoint.app` | A sinalização: os dois PCs trocam o endereço um do outro e depois se ligam direto | `127.0.0.1:8080` |

Os comandos abaixo rodam no PowerShell, na pasta do repositório.

## Uma vez só: o domínio na Cloudflare

### Se o domínio está na conta de outra pessoa

1. Mande `scripts\publico\PARA-O-DONO-DO-DOMINIO.md` para quem tem a conta. A pessoa cria o túnel pelo painel dela (os dois endereços ficam configurados lá) e te manda o token, no privado.
2. Guarde o token (ele não aparece na tela e fica em `tools\cloudflared\token`, fora do git):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\publico\guardar-token.ps1
   ```
3. Pronto: o `ligar.ps1` usa o token sozinho. Pule para "O app".

### Se o domínio está na sua conta

1. Crie uma conta grátis em dash.cloudflare.com e adicione o site `jukejoint.app` (plano Free).
2. A Cloudflare mostra dois *nameservers*. No lugar onde você comprou o domínio, troque os nameservers por esses dois. Espere o site aparecer como **Ativo** no painel (de minutos a algumas horas).
3. Rode:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\publico\configurar-tunel.ps1
   ```
   O navegador abre: entre na Cloudflare e escolha `jukejoint.app`. O script cria o túnel `jukejoint`, aponta `api.` e `signal.` para ele e grava a configuração em `tools\cloudflared\` (fora do git). As credenciais do túnel ficam em `%USERPROFILE%\.cloudflared`: não mande essa pasta para ninguém.

## O app (você e o amigo usam o mesmo zip)

Baixe `Jukejoint-vX.Y.Z-windows-x64.zip` na página **Releases** do GitHub e mande esse arquivo para o amigo. Ele já inclui o app, o Modlock fixado e o modo de teste `hello`, com os endereços de produção configurados. Não precisa compilar o app para cada release.

Os dois extraem o zip inteiro numa pasta própria e abrem `Jukejoint.exe`. O `LEIA-ME.txt` incluído explica o aviso do SmartScreen, o login e como preparar o jogo.

## No dia do teste

1. **No seu PC, ligue tudo** e deixe a janela aberta até o fim:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\publico\ligar.ps1
   ```
   Espere `Tudo no ar`. O script confere os dois endereços públicos antes de dizer isso.
2. **Os dois abrem o Jukejoint e clicam em Login.** O navegador abre a Steam; depois de entrar, aceite abrir o Jukejoint.
3. **Você cria o lobby** (qualquer modo: por enquanto todos abrem o modo de teste `hello`). O amigo acha o lobby na lista e entra. O "Copiar convite" dá um link `jukejoint://join/...`, que funciona colado no navegador do amigo, mas o Discord não deixa clicar nele.
4. **Deadlock fechado nos dois PCs.** Os dois marcam pronto, você inicia, e o app abre o jogo em cada PC.
5. **Deu certo quando** os dois estão no mesmo servidor e o comando `/hello` responde para os dois.
6. **No fim**, feche a sala pelo app e depois feche o app. Nunca encerre o `modlock.exe` pelo Gerenciador de Tarefas: isso deixa um arquivo travado até reiniciar o PC.

## Se der errado

- **O amigo não consegue entrar na sala, mas os dois estão logados:** a ligação direta entre os PCs não fechou. A causa mais provável é CGNAT ou NAT restritivo numa das redes. Ainda não temos servidor de retransmissão (TURN), então a saída é tentar de outra rede (por exemplo, um dos dois no roteador de casa em vez de 4G).
- **Login não volta para o app:** abra o Jukejoint de novo pela pasta extraída (isso refaz o registro do link) e tente outra vez.
- **Logs para me mandar:**
  - seus servidores: `tools\publico-logs\` (`api.log`, `signal.log`, `tunel.log`);
  - o motor, nos dois PCs: `%APPDATA%\modlock\state\daemon-app.log`.

## Para conferir sem a Cloudflare

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publico\ligar.ps1 -SemTunel
```

Sobe só a API e a sinalização neste PC, para ver se compilam e respondem.

## Limites conhecidos

- **O seu PC precisa ficar ligado** durante o teste. Depois, os dois servidores vão para o Raspberry Pi do pi-infra, como imagens Docker (`.github/workflows/images.yml`).
- **Reiniciar a API desloga todo mundo e fecha os lobbies:** o estado fica só na memória.
