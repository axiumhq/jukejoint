# v4 "A Torre": estado (concluído em 03/11/2026)

O v4 foi retomado e concluído: os dois ramos dos agentes (`worktree-agent-a5ee0aaabdf5ce411`, lobbies; `worktree-agent-ab2d93e7f671750c7`, home 3D) foram juntados no `main`.

**Integração feita no merge:**
- rotas sob demanda (da Torre) + `/jogar` (dos lobbies);
- "Jogar agora" da home → `/jogar`;
- o "em cartaz" da home (`nearestToFull`) usa o mesmo `pickBestLobby` de `/lobbies`.

**Verificado:**
- typecheck, 22 testes e build;
- desktop 1440 no nível alto (torre, andares, cofre e elevador);
- celular 375 no nível médio (a torre aparece na primeira tela);
- `?tier=low` (sem canvas);
- console limpo numa aba nova.

## Ajustes conhecidos para a próxima rodada
- **Cofre:** o painel do modo anterior continua visível no topo da cena.
- **Cofre:** o contador do HUD no canto inferior esquerdo cobre o link "Ver …" do painel do modo.
- **Elevador:** o mostrador e as portas 3D só se alinham mais ou menos com a coluna de texto. No celular, os painéis cobrem boa parte da porta.
- **Rótulos dos andares** ficam escondidos abaixo de 1024 px.
- **Fontes da home:** cerca de 220 KB, contra os 120 KB do brief. A Newsreader e a Stencil carregam na home.
- **CSS morto** de `.lobby-row` (v3) em `components.css`.
- **Sem pôster ou kit de andares feitos no Blender.** Não testado num Android fraco de verdade.

## Outras pendências do projeto
- Teste com 2 PCs pela internet (`scripts/spike/LEIA.md`, `dist/kit-amigo.zip`): é o go/no-go do spike.
- Decisões: nome, envio do relatório de segurança ao autor do Modlock, texto de anti-cheat, canal dos avisos.
