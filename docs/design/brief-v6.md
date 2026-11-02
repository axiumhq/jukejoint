# Brief v6: "Minimal + cinema"

*03/11/2026. Escolha do usuário entre as prévias de `prototipos/direcoes/`: **Minimal e preciso** + **3D cinematográfico**. Base: `docs/design/auditoria-fria.md`.*

## A ideia
Um site **quieto e preciso**, com **um único momento de cinema**: a arte-chave pré-renderizada no Blender. Tudo o mais é tipografia, grid e dados ao vivo. Menos coisa, cada uma impecável.

## Regras
1. **Um efeito só:** a arte-chave cinematográfica no herói. Nenhum outro efeito decorativo (sem chuva, partículas, holofotes em código, cartas que inclinam ou carimbos).
2. **Nada de 3D em tempo real.** A arte é imagem ou vídeo pré-renderizado. `three` e `@react-three/fiber` saem do bundle.
3. **Um sistema de tipo em todo o site:**
   - **Bodoni Moda** no display (títulos);
   - **Mona Sans** no texto e na interface;
   - **Fragment Mono** só em números, como contagens, ping e vagas.

   Nada além dessas três.
4. **Um cabeçalho e um rodapé iguais em todas as páginas.**
5. **Uma cor de destaque** (luz de sódio) sobre o azul-noite. O verdete só significa "amigo" ou "ao vivo".
6. **Cortar antes de acrescentar.** Cada elemento precisa responder "um estúdio de ponta manteria isso?".
7. **Verificar em tela cheia e em velocidade real** (build de produção, 1440×900 e 375×812), não no painel pequeno.

## Home (no máximo ~4 telas)
1. **Herói:** a arte-chave em tela cheia, com faixas de cinema e a navegação dentro da faixa de cima. O título fica à esquerda, no espaço negativo: **"O Deadlock que / a comunidade inventou."** (aprovado). Abaixo, a linha de apoio (≤20 palavras), "Jogar agora" (→ `/jogar`) e "Ver lobbies".
   - A abertura: as faixas se abrem e a imagem surge do preto, em ≤1,5 s, e depois faz um *ken burns* lento.
   - Os números ao vivo aparecem como créditos na faixa de baixo.
   - Com o **loop de vídeo** (`web/public/media/heroi.webm` e `heroi.mp4`, pôster `heroi-poster.jpg`; no celular, `heroi-mobile.*`), o vídeo substitui a imagem. Com movimento reduzido ou economia de dados, só a imagem parada.
2. **Lobbies agora:** 5 lobbies ao vivo no estilo **painel de partidas** da prévia Minimal (nome em destaque, modo, servidor e ping, vagas como janelinhas, um botão), mais "Ver todos os lobbies".
3. **Modos:** uma linha tipográfica com os 6 modos (nome, uma frase, jogadores agora). Sem cartas.
4. **Confiança:** o que instala, o hash SHA-256 e o antivírus em três frases, com link para `/instalar`.
5. Rodapé.

## /lobbies
- **Tabela precisa:** linhas de 56–64 px, com 8–10 visíveis em 1440×900. Colunas: lobby, modo, servidor e ping, vagas, ação.
- **Um botão por linha.** Os estados são texto curto ("Você está aqui", "Com convite", "Lotado", "Em partida") e não carimbos ou selos.
- **Filtros discretos** numa linha: modo, região, só com vaga, só amigos.
- **"Em cartaz agora"** vira **a primeira linha destacada**, e não um painel enorme.
- **Mantém a lógica da v4,** que está certa e testada: `lobbyState`, `pickBestLobby`, "Bater na porta" e `/jogar`. Muda só a apresentação.

## Outras páginas
- **/modos e /modos/:slug:** tipográficos, com a arte do modo pequena e discreta. O "Lobbies abertos" desse modo usa a mesma tabela.
- **/instalar:** quase como está (é a melhor página), no novo sistema de tipo.
- **/novidades:** sem a roupa de jornal. Lista editorial simples, com resumo, categorias e datas com ano.

## Bugs a corrigir (auditoria)
- As contagens precisam bater entre si (cabeçalho, lista, modos, home): uma única fonte de verdade.
- O contador fixo não pode cobrir conteúdo. No novo herói, os números ficam na faixa de baixo, e não fixos na página.
- Nada de "Passe o mouse…" no celular.
- Lobby em destaque repetido como primeira linha e frases duplicadas.

## Fora do v6
Nome e logotipo (decisão pendente do usuário; o `BRAND_NAME` continua centralizado), som, 3D em tempo real.
