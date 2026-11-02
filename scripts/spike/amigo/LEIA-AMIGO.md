# Teste de sessão em Deadlock

Valeu por ajudar! Você vai entrar numa partida de teste que eu hospedo no meu PC.

## O que você precisa
- Windows, Steam aberta e **acesso ao Deadlock** na sua conta.
- Uns 120 MB livres: o Modlock (~85 MB) mais o servidor do jogo, baixados na primeira vez.

## O que isto instala, e onde
- **Modlock v0.1.68** (projeto aberto: github.com/paralin/modlock), na pasta `tools\` **dentro desta pasta**. O script só aceita o arquivo se o hash SHA-256 bater com o oficial do GitHub.
- Na primeira partida, o Modlock baixa o servidor do jogo em `%LOCALAPPDATA%\modlock`.
- Nada é instalado no sistema, e nada muda nas suas configurações do Deadlock. Para desfazer, basta apagar esta pasta e `%LOCALAPPDATA%\modlock`.

## Antes de começar
Alguns antivírus apagam programas novos que mexem com jogos. Para evitar, adicione como exceção **no antivírus que estiver ativo**:
- esta pasta (a que tem o `ENTRAR.cmd`);
- `%LOCALAPPDATA%\modlock`.

Onde fica a exceção:
- **Kaspersky:** Configurações → Configurações de segurança → Ameaças e Exclusões → Gerenciar exclusões → Adicionar.
- **Windows Defender:** Segurança do Windows → Proteção contra vírus e ameaças → Gerenciar configurações → Exclusões.

Se o antivírus já apagou algo, restaure da **quarentena** dele antes.

## Passo a passo
1. Descompacte o zip numa pasta **com caminho curto**, como `C:\teste`.
2. Dê dois cliques em **`ENTRAR.cmd`**. Se o Windows avisar sobre arquivo baixado, clique em "Mais informações" e depois em "Executar assim mesmo".
3. Cole o **endereço** e o **código** que eu te mandar.
4. O Deadlock abre e entra na minha sessão. No chat, digite `/hello`.
5. No fim, feche o jogo e dê dois cliques em **`SAIR.cmd`**.

**Não** feche o `modlock.exe` pelo Gerenciador de Tarefas. Use sempre o `SAIR.cmd`.

## Se der erro
Tire um print da janela preta e me mande. Ajuda muito saber também a sua operadora de internet, porque algumas bloqueiam conexão direta entre PCs.
