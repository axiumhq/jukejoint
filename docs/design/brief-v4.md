# Brief v4: "A Torre"

*Direção de design, 02/11/2026. Referência principal: igloo.inc. Fontes: `pesquisa-direcao-arte.md`, `pesquisa-ux-lobbies.md`, `avaliacao-v3.md`, `avaliacao-texto.md`.*

## A ideia, numa frase
**Uma torre art déco de obsidiana e latão, viva, que você percorre rolando a página.** Cada andar é um lobby de verdade, cada janela acesa é um jogador, e as janelas verdes são amigos. A cena é o produto; o texto é sempre HTML por cima.

Do igloo.inc pegamos o **método**: um único monólito iluminado por dentro, uma câmera que a rolagem conduz, uma camada técnica em fonte mono nos cantos, texto que se decifra e uma abertura memorável. Corrigimos as **falhas** dele: o texto é HTML (acessível e indexável), a rolagem é nativa, e o celular baixa outra coisa.

## Regras (inegociáveis)
1. **Uma ideia, gasta num lugar só:** a torre. O resto da interface é quieto e preciso.
2. **Toda imagem vem de dado real**, mesmo que simulado no protótipo: nada de dashboard falso.
3. **Sem seção-modelo:** nada de "3 passos numerados", fileira de cards idênticos, rótulo pequeno em caixa-alta acima de cada título ou faixa de estatísticas.
4. **Título com no máximo 2 linhas** e texto de apoio com no máximo 20 palavras. Caixa normal, sem palavra destacada sozinha.
5. **A luz é material, não efeito:** ela vem das janelas e dos postes de luz de sódio. Nada de brilho radial solto nem cards de vidro fosco.
6. **Movimento tem motivo:** uma única sequência de abertura, molas interrompíveis e uma versão para movimento reduzido desenhada de propósito.
7. **Texto sempre em HTML; o WebGL é só cenário.**
8. **Capricho nos lugares chatos:** carregamento, 404, vazio, erro, foco de teclado, números alinhados e aspas curvas.
9. **Imagem só nossa:** geometria procedural e shaders. Nada da Valve, sem stock e sem imagem gerada por IA.
10. **Desempenho faz parte do design:** orçamento por nível de aparelho.

## Sistema
- **Tipografia:**
  - **Big Shoulders** nos títulos e números (eixo óptico; cortes Inline e Stencil em momentos de destaque);
  - **Martian Mono** na camada técnica (cantos, rótulos, contadores e o texto que se decifra; a largura fixa evita que o layout pule);
  - **Libre Franklin** em textos longos.
- **Cor:** noite de obsidiana, latão (gente e ação principal), verdete (ao vivo e amigos), anil (céu) e luz de sódio como temperatura. Cada modo tem a sua cor de friso, que **nunca** entra nas janelas: o latão continua significando "gente".
- **Camada técnica estilo igloo,** em mono nos cantos:
  - canto superior esquerdo: marca e hora local da cidade;
  - canto superior direito: Steam e som (desligado por padrão);
  - canto inferior esquerdo: jogadores agora e lobbies;
  - canto inferior direito: posição da rolagem ou cena atual.

  O texto se decifra uma vez quando entra, e fica estático com movimento reduzido.

## Roteiro da home (rolagem nativa, câmera amortecida)
| # | Cena | Câmera / 3D | Camada HTML |
|---|---|---|---|
| 0 | **Abertura** | A torre acende de baixo para cima conforme o carregamento avança (o progresso real vira luz) | "Acendendo a cidade… 42%" em mono |
| 1 | **A Torre** | Plano de baixo, névoa, postes de sódio; as janelas acendem na ordem real de entrada | Título (2 linhas) + uma frase + **"Jogar agora"** (põe você no melhor lobby) e "Ver lobbies" |
| 2 | **Os andares** | A câmera sobe; os andares se separam e cada um ganha um rótulo; foco no andar com amigos | Lista **equivalente** sincronizada (acessível): selo do modo, temperatura e "Ametista entrou agora" |
| 3 | **O cofre de modos** | Seis cartas de vidro e latão, em pé num cofre; a carta em foco gira | Nome, uma linha e "Em cartaz agora" |
| 4 | **O elevador** | Um mostrador art déco de andar (ponteiro) substitui os "3 passos": Escolha → Instale → Jogue | Uma frase por parada do ponteiro |
| 5 | **A placa** | Placa de latão gravada com o hash do instalador | Confiança: o que instala, hash e antivírus, com link para /instalar |
| 6 | **A rua** | Nível da rua, o jornal no chão, o rodapé | Últimas da Gazeta + rodapé |

**Níveis de aparelho:**
- **Alto:** 3D completo.
- **Médio:** 3D com menos andares e sem pós-processamento.
- **Baixo, sem WebGL ou com movimento reduzido:** a cidade SVG do v3, com o mesmo roteiro em HTML.

O 3D carrega **só depois** da primeira pintura (lazy).

**Orçamento:** cerca de 3 MB no desktop, 1,2 MB num Android médio e menos de 0,5 MB no nível baixo. Primeira pintura sem o 3D.

## Lobbies (pesquisa de UX + avaliação v3)
1. **Tabela de estados**, cada um com rótulo e verbo próprios:

   | Estado | Rótulo | Ação |
   |---|---|---|
   | Aberto | (sem rótulo) | Entrar |
   | Seu lobby | Você está aqui | Convidar / Fechar |
   | Já entrou | Você está aqui | Sair |
   | Privado | Com convite | **Bater na porta** (pede ao anfitrião) |
   | Cheio | Lotado | Avisar quando vagar |
   | Em partida | Em partida (rodada X) | Entrar se aceitar, senão Avisar |

   O lobby privado **não** deixa entrar direto (corrige o bug do `isJoinable`).
2. **Identidade do modo em todo lugar:** selo de 40 px recortado da arte da carta, com o numeral, e um friso de 3 px na cor do modo. Vale nas linhas, nos andares, no quadro do andar, no círculo de entrada e no criar lobby (com mini-cartas no lugar do `<select>`).
3. **Sinais ao vivo honestos** no lugar do "Aberto": "Ametista entrou agora", "aberto há 3 min", e temperatura (**Lotando**, **Esquentando**, **Recém-aberto**, **Quieto**). Ordenação por jogadores ativos.
4. **"Em cartaz agora":** um lobby em destaque no topo da home e de /lobbies.
5. **Alternância compacto/rico** em /lobbies (`?vista=`). O compacto tem linhas de 56 px; o rico usa cards de **ingresso** com carimbos (LOTADO, COM CONVITE, VOCÊ ESTÁ AQUI).
6. **Página do modo** com a seção "Lobbies abertos" desse modo.
7. **População baixa:** "Sessões do dia" (horários fixos) e "Avise-me quando houver 3". O vazio sempre traz um próximo passo.
8. **Quórum:** o lobby declara um mínimo, e as janelas ficam vazadas até chegar nele.
9. Correção da sobreposição do botão de aviso: a coluna de ação fica com largura fixa.

## Fora deste ciclo
Blender (pôster e kit de andares), som real, Maré (linha do tempo da cidade), Fusão de lobbies, página `/lobbies/:id`.

## Como aprovar
Um visitante novo, em 3 segundos, entende: **"tem gente jogando agora e eu consigo entrar"**, e acha bonito o bastante para mandar para um amigo.
