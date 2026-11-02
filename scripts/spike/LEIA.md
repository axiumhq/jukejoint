# Teste com 2 PCs (bloco 3 do spike)

Objetivo: dois PCs jogam a mesma sessão usando **o nosso** servidor de signaling, sem passar pelo hyperline.gg.

## Antes (nos dois PCs)

1. O projeto no PC. No PC B basta ter `scripts\` e `tools\` (o mod vem do host).
2. Exclusões do antivírus para `tools\` e `%LOCALAPPDATA%\modlock`.
3. `powershell -ExecutionPolicy Bypass -File scripts\install-modlock.ps1`
4. Opcional, para provar que não usamos o hyperline.gg: adicione `0.0.0.0 hyperline.gg` ao arquivo `C:\Windows\System32\drivers\etc\hosts`. Isso exige administrador, então você faz.

> Neste PC (o do desenvolvimento) ficou um socket travado em `%APPDATA%\modlock\state`. Reinicie o PC antes, ou passe `-StateDir C:\Users\<voce>\.mlA` aos scripts.

## Passo a passo

**PC A, terminal 1: servidor**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\spike\servidor.ps1
```
Anote o endereço `http://192.168.x.x:8080` que ele mostra. Se o Windows perguntar, permita o acesso em rede privada.

**PC A, terminal 2: hospedar**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\spike\hospedar.ps1 -Origin http://192.168.x.x:8080
```
O Deadlock abre no servidor local, e o terminal mostra o **código de entrada**.

**PC B: entrar**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\spike\entrar.ps1 -Origin http://192.168.x.x:8080 -Codigo <CODIGO>
```

**Fim (nos dois PCs)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\spike\parar.ps1
```
Nunca encerre o `modlock.exe` pelo Gerenciador de Tarefas: isso deixa um socket travado até reiniciar o PC.

## Critério de sucesso
- Os dois estão no mesmo servidor e `/hello` responde para os dois.
- O terminal do servidor mostra `ticket issued` e `signaling connected` para os dois peers.
- Com o `hosts` bloqueando o hyperline.gg, tudo funciona igual.

## Teste pela internet, com um amigo

Você hospeda; o amigo entra da casa dele.

1. **Você, terminal 1:** `scripts\spike\servidor.ps1`
2. **Você, terminal 2:** `scripts\spike\tunel.ps1`. Ele baixa o `cloudflared` 2026.10.1 (com hash conferido) e mostra um endereço `https://….trycloudflare.com`, que muda a cada execução.
3. **Você, terminal 3:** `scripts\spike\hospedar.ps1 -Origin https://….trycloudflare.com`. Some `-StateDir C:\Users\<voce>\.mlA` se ainda não reiniciou o PC desde o socket travado. Anote o **código**.
4. **Amigo:** gere o pacote com `scripts\spike\empacotar-amigo.ps1` e mande o `dist\kit-amigo.zip`. Ele segue o `LEIA-AMIGO.md` (`ENTRAR.cmd`, cola o endereço e o código).
5. No fim, `parar.ps1` no seu lado e `SAIR.cmd` no dele. Ctrl+C no túnel e no servidor.

> **Risco conhecido:** sem TURN, o link é direto entre os PCs. Operadoras com CGNAT ou NAT simétrico (comum no Brasil) podem impedir a conexão. Se o servidor mostrar `signaling connected` para os dois e mesmo assim o join não fechar, o problema é NAT, e o próximo passo é adicionar TURN (o Modlock recebe as credenciais pelo lobby).

## Opções
- `-UiRelay https://<projeto>.pages.dev`: liga a UI dentro do jogo pela nossa ponte (veja `spike/bridge/README.md`). Sem essa opção, a UI fica desligada (`--ui-port 0`).
- `-SemJogo`: sobe só o servidor ou a sessão, sem abrir o Deadlock.
- Pela internet, em vez da rede local: o servidor precisa de um endereço público, como uma VPS ou um túnel. Sem TURN, NAT restritivo pode bloquear o link. Teste primeiro na rede local.
