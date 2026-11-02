# Retomada do v4 (pausado em 02/11/2026)

O v4 "A Torre" (estilo igloo.inc) estava sendo implementado por dois agentes em paralelo, cada um num worktree próprio. A pedido, os dois foram **parados** e o trabalho foi **salvo como commit WIP** no ramo de cada um. Nada disso está no `main` ainda.

| Parte | Ramo | Commit | Estado ao parar |
|---|---|---|---|
| **Home 3D "A Torre"** | `worktree-agent-ab2d93e7f671750c7` | `fe71330` | **Meio do caminho.** Já tem: a cena three.js (`web/src/three/`: mundo, shaders, texturas), o HUD em mono, o texto que se decifra, as cenas, a lista de andares, o esboço da torre, a detecção de nível do aparelho e o som. Estava escrevendo o componente R3F principal (câmera, pós-processamento, rótulos e o guarda de FPS). **Não testado; pode não compilar.** |
| **Lobbies** | `worktree-agent-a5ee0aaabdf5ce411` | `f135378` | **Quase pronto.** Já tem: estados com "Bater na porta", `ModeSeal`, `FeaturedLobby`, `LobbyTicket`, `DaySessions`, a página `/jogar` (`QuickPlay`), testes de `lib/lobbies` e a coluna de ação de largura fixa (sobreposição resolvida, sem "Aberto" repetido). Estava na verificação final (celular no tema claro e console). |

Pastas dos worktrees: `.claude/worktrees/agent-ab2d93e7f671750c7` e `.claude/worktrees/agent-a5ee0aaabdf5ce411`.

## Para retomar
1. **Lobbies:** rodar `npm install`, `npm run typecheck`, `npm run build` e os testes no worktree. Terminar a verificação (1440 e 375, escuro e claro, `/lobbies`, a página do modo e os diálogos) e fazer o commit final.
2. **Torre:** terminar o componente R3F e as 7 cenas do `docs/design/brief-v4.md`, os níveis de aparelho e a reserva SVG; testar no dev server (porta 5180).
3. **Juntar no `main`:** dar merge dos dois ramos. O conflito esperado é só em `web/src/i18n/pt-BR.ts` (e talvez no `package.json`). Depois, ligar `pickBestLobby` / `FeaturedLobby` / `ModeSeal` na home nova.
4. Revisão no navegador, auditoria com Impeccable, e o commit do v4.

## Outras pendências do projeto
- Teste com 2 PCs pela internet (`scripts/spike/LEIA.md`, pacote `dist/kit-amigo.zip`): é o go/no-go do spike.
- Decisões: nome, envio do relatório de segurança ao autor do Modlock, texto de anti-cheat, canal dos avisos.
- Reiniciar o PC para liberar o socket travado em `%APPDATA%\modlock`.
