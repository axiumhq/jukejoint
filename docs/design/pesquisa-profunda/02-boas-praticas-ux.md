# Boas práticas de UX e UI para produtos sociais de jogo em tempo real

Data: 2026-11-02. Escopo: navegadores de lobby, fila/"jogar agora", sala, amigos, launcher e sites de comunidade. Complementa `docs/design/pesquisa-lobbies-referencias.md` (que cobre FACEIT, Gamers Club, Steam, Discord, Lichess, etc.). **Não repito aqui** o que cada produto faz; aqui entram princípios, evidência de pesquisa de UX, guias de acessibilidade e orientação de ofício. Nenhum código foi alterado.

## 0. Como ler

- **[V]** li a página (ou o resumo do leitor citava o trecho de forma direta).
- **[S]** fonte secundária ou trecho de busca (imprensa, fórum, blog de terceiros). Hipótese a confirmar.
- **[NV]** não verificado nesta rodada (conhecimento prévio meu, sem página aberta).
- **[Inferência]** conclusão minha, sem fonte que a afirme.
- Limite honesto: o leitor devolve resumos feitos por modelo pequeno. Os talks do GDC Vault só abriram como resumo (a palestra é de assinante). Não achei post de engenharia/design do Riot Client nem post do blog de design do Discord; as páginas de Material 3 e da Apple HIG vieram vazias (renderizadas por JS), então os números de Material/Apple abaixo são **[NV]**. O Game UI Database bloqueou a leitura (403).
- Contexto lido no repositório (não é pesquisa): tokens v6 (`web/src/styles/tokens.css`: fundo #0a0d12, tinta quente, destaque "sódio" #f2a33a, verdete só para amigo/ao vivo, raio 2 px, Bodoni Moda + Mona Sans + Fragment Mono), `brief-v6.md`, `Room.tsx`, `QuickPlay.tsx`. Já existem: `role="status"`/`aria-live` em vários pontos, `prefers-reduced-motion`, `tabular-nums`, sala com etapas de entrada, texto "pronto/não pronto" por vaga. Não recomendo o que já está feito.
- Medi o contraste dos tokens (cálculo WCAG, sobre #0a0d12): tinta 15,8:1; ink-2 8,6:1; **ink-3 5,6:1**; sódio 9,3:1; verdete 9,2:1. Texto passa em 4.5:1 com folga. O que **não** passa é linha fina (`--rule` a 10% de opacidade) quando ela é o único sinal de um controle ou estado (ver P9/P10).

---

## 1. Princípios (15)

Formato: **Regra** / **Evidência** / **Para nós** (home e lista, jogar agora, sala, hospedar, amigos, instalar).

### P1. Uma intenção por tela, um verbo dominante
- **Regra:** cada tela tem um ponto focal e uma chamada principal; o resto é secundário e entra por divulgação progressiva (no máximo dois níveis).
- **Evidência:** a Riot descreve a reforma da interface do Valorant com "foco claro e uma CTA por tela", menos ornamento e mais contraste [V, <https://playvalorant.com/en-us/news/game-updates/preview-the-future-of-valorant-s-interface/>]. NN/g: o que está na tela principal sinaliza importância; mais de dois níveis de divulgação perdem o usuário [V, <https://www.nngroup.com/articles/progressive-disclosure/>].
- **Para nós:** home = "Jogar agora" + lista; sala = **um** botão que muda de rótulo conforme a fase; hospedar = modo, vagas, visibilidade (3 campos) e "Avançado" fechado (nível 2); instalar = um passo por vez com o atual em destaque.

### P2. Status do sistema sempre visível, em palavras, com tempo
- **Regra:** o usuário nunca fica sem saber o que o sistema está fazendo; toda ação tem resposta visível em até ~100 ms e, passando de 1 s, um indicador.
- **Evidência:** NN/g, heurística 1 [V, <https://www.nngroup.com/articles/ten-usability-heuristics/>]; limites de 0,1 s / 1 s / 10 s [V, <https://www.nngroup.com/articles/response-times-3-important-limits/>]; limiar de Doherty, 400 ms [V, <https://lawsofux.com/doherty-threshold/>]; Vercel: POST/PATCH/DELETE em até 500 ms, atualização otimista com reversão ou "Desfazer" [V, <https://vercel.com/design/guidelines>].
- **Para nós:** clicar "Entrar" muda o botão na hora (otimista) para "Entrando…" e abre a sala; "Estou pronto" vira pronto imediatamente e reverte com aviso se o servidor recusar; o estado do app ("App conectado / não encontrado") fica visível no cabeçalho, não só dentro do fluxo.

### P3. Reconhecer em vez de lembrar: o produto mostra o que a pessoa precisa agora
- **Regra:** coloque o relevante à mão (amigos com destino, último lobby, favoritos) em vez de exigir busca.
- **Evidência:** NN/g, "recognition rather than recall" [V, ten-usability-heuristics]; Hodent separa affordances físicas, cognitivas, sensoriais e **funcionais** (ordenar, fixar) [V, <https://www.celiahodent.com/gamers-brain-ux-onboarding/>]; a Steam passou a agrupar amigos pelo jogo que estão jogando, com Rich Presence mostrando modo e tamanho do grupo [S, <https://www.tomshardware.com/news/valve-updated-steam-chat-beta,37290.html>].
- **Para nós:** retornante vê primeiro "Seus amigos agora" e "Voltar ao último modo"; favoritos e recentes são abas de escopo (já recomendadas na pesquisa anterior), com contagem.

### P4. Orçamento de carga cognitiva: poucas coisas novas por vez
- **Regra:** apresente no máximo ~3 conceitos novos de cada vez; ensine fazendo; troque parágrafo por sinal.
- **Evidência:** Hodent: memória de trabalho pequena, cerca de 3 itens por etapa de aprendizado; aprender fazendo supera texto; tela de espera pode ensinar, mas em ~3 pontos e sobre o "porquê"; falsas affordances são caras e difíceis de desaprender; o material citado traz queda de ~20% de jogadores na primeira hora de Warframe [V, celiahodent.com, link acima].
- **Para nós:** sem tour nem modal de boas-vindas. Primeira visita ensina 3 coisas, na ordem do uso: (1) escolher lobby, (2) o app abre o jogo, (3) "pronto" na sala. O resto (convite, favoritos, avisos) aparece **no momento em que serve**, como dica de uma linha.

### P5. Linhas para comparar, cartas para descobrir
- **Regra:** conteúdo semelhante e comparável (lobbies) vai em lista/tabela; conteúdo heterogêneo e de poucos itens (modos, eventos) pode ir em cartas.
- **Evidência:** NN/g: cartas servem a navegação e conteúdo misto; listas vencem em busca, comparação e varredura, cabem mais itens, e o rastreamento ocular mostra "pula-pula" entre cartas [V, <https://www.nngroup.com/articles/cards-component/>]. Tabelas: primeira coluna legível por humano, colunas por importância, cabeçalho fixo, **painel lateral não modal** em vez de modal ou acordeão para ver/editar uma linha [V, <https://www.nngroup.com/articles/data-tables/>].
- **Para nós:** a tabela da v6 está certa. Detalhe de um lobby: **painel lateral** ao clicar a linha (desktop) em vez de expansão no lugar. Isso ajusta o item 10 da pesquisa anterior: NN/g diz que acordeão polui a tabela.

### P6. A lista viva não pode se mexer debaixo do dedo
- **Regra:** dado ao vivo atualiza no lugar; **reordenar ou inserir linhas só quando a pessoa não está interagindo**; mudanças que ela não pediu viram aviso ("3 novos"), não salto.
- **Evidência:** a métrica CLS trata como mau o que desloca conteúdo sem entrada do usuário (bom ≤ 0,1; ruim > 0,25); deslocamentos até 500 ms após clique/toque são perdoados, mas rolagem e arrasto não [V, <https://web.dev/articles/cls>]. WCAG 2.2.2: conteúdo que se atualiza sozinho precisa ser pausável, e ao retomar deve ir para o estado atual (exemplo do próprio texto: informação em tempo real) [V, <https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html>]. Padrão "há atualizações, clique para ver" para listas vivas: relato de desenvolvedores [S, <https://elixirforum.com/t/ideas-on-small-ux-issue-with-sudden-html-changes-on-liveview-reconnect/38320>]. "Congelar sob o cursor" não achei documentado em fonte oficial: [Inferência].
- **Para nós:** (a) números de vagas/ping mudam no lugar, sem mexer a linha; (b) a ordem congela enquanto há hover, foco ou ponteiro pressionado numa linha e por ~1,5 s depois; (c) lobbies novos entram por um chip "N novos" no topo da lista; (d) um controle "Pausar lista / Atualizar" (cumpre 2.2.2 e resolve o medo de clicar errado).

### P7. Vazio, cheio, erro e carregando são telas desenhadas, cada uma com próximo passo
- **Regra:** nunca deixe o contêiner em branco; diga o estado (carregando / erro / realmente vazio), ensine e ofereça a saída.
- **Evidência:** NN/g, três diretrizes de estado vazio: mostrar status, ensinar, dar caminho; não mostrar "nenhum item" enquanto ainda carrega [V, <https://www.nngroup.com/articles/empty-state-interface-design/>]. Esqueletos com as dimensões finais evitam salto [V, vercel/design/guidelines].
- **Para nós:** tabela de estados na seção 3.6.

### P8. Espera tem estrutura: etapas concretas, tempo conhecido e algo para fazer
- **Regra:** espera longa sem informação parece falha. Mostre etapa atual, contagem ("etapa 2 de 4"), estimativa quando há, uma saída, e dê ocupação.
- **Evidência:** NN/g: indicador para qualquer coisa > 1 s; spinner de 2 a 10 s; percentual acima de 10 s com estimativa; contagem de etapas; opção de interromper; quem vê barra animada espera ~3x mais [V, <https://www.nngroup.com/articles/progress-indicators/>, <https://www.nngroup.com/articles/skeleton-screens/>]. Maister: tempo ocupado parece mais curto, espera incerta parece mais longa [S, <https://davidmaister.com/blog/201/The-Psychology-of-Waiting-Lines.html>]. Hodent: progresso que anda de forma constante e ter o que fazer encurtam a espera [V, celiahodent.com]. Referência de prazo: o Discord segura a entrada pendente 180 s [V, na pesquisa anterior].
- **Para nós:** handoff web->app->jogo e "aguardando jogadores" na sala (ver 3.7 e 3.4). Na sala de espera: mostrar "faltam 2", tempo na sala, histórico de quando esse modo costuma encher, e ações úteis (copiar link, convidar amigo online).

### P9. Cor nunca é o único sinal; todo estado tem forma e texto
- **Regra:** cada estado se distingue por texto ou forma além da cor; indisponível não é só "cinza".
- **Evidência:** WCAG 1.4.1 [V, <https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html>]; XAG 103: cor reforça, nunca representa sozinha; item indisponível = cinza **mais** cadeado e rótulo "não disponível"; não usar caracteres Unicode como ícone (leitores de tela leem "busto em silhueta"); use imagem/SVG com texto alternativo [V, <https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103>]. Game Accessibility Guidelines: não transmitir informação essencial só por cor fixa (nível básico) [V, <https://gameaccessibilityguidelines.com/full-list/>]. Caso real: a troca forçada dos ícones de status do Discord gerou queixas de daltônicos e pedido de opção, mostrando que remover diferenciação por forma é custo [S, <https://support.discord.com/hc/it/community/posts/1500000471962-Accessibility-Suggestion-Disabling-status-colors>].
- **Para nós:** "pronto" = sódio **e** glifo de check **e** a palavra; "amigo" = verdete **e** marca textual ("amigo"); ao vivo = ponto **e** a palavra "ao vivo". "Lotado" = texto, não só botão apagado. Ícones em SVG com `aria-label` ou `aria-hidden`, nunca emoji ou glifo Unicode.

### P10. Contraste e tamanho são orçamento fixo, não gosto
- **Regra:** texto 4.5:1 (3:1 se grande); componentes e indicadores de estado 3:1; alvo de toque/clique ≥ 24 px (44 px no celular); texto escalável a 200% sem perder função.
- **Evidência:** WCAG 1.4.3, 1.4.11 e 2.5.8 [V, <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>, <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>, <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>]. XAG 101: em PC o mínimo é 18 px de "altura de corpo" a 1080p, escala até 200%, linha ≤ 80 caracteres, entrelinha ≥ 1,5, e texto de erro/notificação também precisa seguir [V, <https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101>]. Vercel: alvo ≥ 24 px, 44 px no celular, input ≥ 16 px no celular para não dar zoom no iOS [V].
- **Para nós:** tokens de texto já passam. Falta checar: bordas das janelinhas de vaga, `--rule` em controles, `ink-3` em corpo pequeno (13 px é a menor escala, `--fs-xs`; para dado crítico use ≥ 14 px). A medida do XAG é por altura de corpo (ascendente + descendente), então ~16 px CSS cumpre; 13 px não [Inferência].

### P11. Notificação proporcional à urgência e à necessidade de ação
- **Regra:** indicador (no lugar) < banner persistente < toast < modal. Toast só para o passivo e de baixo risco; o que exige ação não some sozinho.
- **Evidência:** NN/g: toasts somem rápido e são péssimos para erro; banners para passivo; modal só para urgente que exige ação [V, <https://www.nngroup.com/articles/indicators-validations-notifications/>]. WCAG 4.1.3: mensagens de status via `role="status"` (educadas); `role="alert"` para o que é importante e urgente; excesso torna o leitor de tela "tagarela" [V, <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>]. WCAG 2.2.1: limite de tempo precisa poder ser estendido (aviso + 20 s) salvo evento em tempo real [V, <https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html>]. Permissão de notificação do navegador: pedir **no momento de valor**, com diálogo próprio antes do nativo ("dupla permissão"), nunca ao carregar; a recusa no nativo é difícil de reverter [V, <https://web.dev/articles/push-notifications-permissions-ux>].
- **Para nós:** "Abriu 1 vaga em X · Entrar" é um cartão persistente (no dock), não um toast de 4 s. "Lobby encerrado" é toast. Falha de handoff é inline na sala. O pedido de permissão do navegador só aparece ao clicar "Avisar quando abrir vaga" (valor óbvio), com nosso diálogo antes.

### P12. Movimento explica; não decora; é curto e interrompível
- **Regra:** animar para mostrar de onde veio algo, o que mudou ou confirmar ação; ficar em 100 a 300 ms; respeitar "reduzir movimento".
- **Evidência:** NN/g: faixa de 100 a 500 ms, feedback simples ~100 ms, entrada de modal 200 a 300 ms, entrar um pouco mais longo que sair, acima de 500 ms "arrasta", e "é muito mais comum a animação ser longa demais do que curta" [V, <https://www.nngroup.com/articles/animation-duration/>]. Vercel: animar só `transform` e `opacity`, nunca `transition: all`, animações interrompíveis, variante para `prefers-reduced-motion`, laço > 5 s exige pausar [V]. web.dev: `transform`/`opacity` ficam no compositor [V, <https://web.dev/articles/animations-guide>]. MDN: trocar escala/pan por dissolver [V, <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>]. Apple e Material (brevidade, movimento opcional, Reduce Motion) [NV].
- **Para nós:** seção 4.

### P13. Confiança é parte da interface, e vem antes do pedido
- **Regra:** diga o que será instalado, quem assina, como verificar, e o que o Windows vai mostrar, **antes** de o usuário baixar.
- **Evidência:** SmartScreen avalia reputação do editor e do hash; sem assinatura aparece "Windows protegeu seu PC" e o usuário precisa escolher "Executar assim mesmo"; certificado EV **não** evita mais o aviso; reputação se constrói em semanas e "centenas de instalações limpas"; o Smart App Control do Windows 11 pode bloquear não assinados; a Microsoft recomenda comunicar aos primeiros usuários que o aviso pode aparecer; Store evita o aviso; o serviço de assinatura da Microsoft começa em US$ 9,99/mês [V, <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation>].
- **Para nós:** `/instalar` mostra, antes do botão: o que instala, hash SHA-256, "o Windows pode avisar" com captura de tela do aviso e do botão "Mais informações > Executar assim mesmo", e o que fazer se o antivírus reclamar. Assinar todo release com a mesma identidade.

### P14. Projetar por contexto de uso, não encolher o desktop
- **Regra:** conteúdo e funções iguais, mas interface própria por dispositivo; navegação escondida reduz uso.
- **Evidência:** NN/g: "mobile-first" não basta; navegação oculta herdada do celular prejudicou o desktop e reduz uso nos dois [V, <https://www.nngroup.com/articles/mobile-first-not-mobile-only/>]. Links compartilhados em apps sociais abrem em navegador embutido (webview) onde esquemas customizados e redirecionamentos falham; a saída recomendada é uma página intermediária que detecta isso e oferece "Abrir no navegador" [S, <https://deeplinks.linkrunner.io/blog/universal-links-app-links-break-in-app-browsers>]. Open Graph exige og:title, og:type, og:image, og:url (e `og:image:alt`) para pré-visualização de link [V, <https://ogp.me/>].
- **Para nós:** seção 6.3.

### P15. Densidade com precisão: o "moderno" vem de alinhamento e consistência, não de efeito
- **Regra:** menos elementos, perfeitamente alinhados, com poucos tokens e estados completos; sem ornamento que não carrega informação.
- **Evidência:** Linear apertou densidade, alinhou rótulo/ícone/botão "mais sentido que visto", reduziu o uso do azul de destaque, e gera os temas a partir de 3 entradas (base, destaque, contraste) em espaço LCH [V, <https://linear.app/now/how-we-redesigned-the-linear-ui>]. Valorant: remover ornamento sem função, mais contraste, formas mais simples [V, link no P1]. Vercel: números tabulares, estados vazio/esparso/denso/erro, testar conteúdo curto e muito longo gerado por usuário [V]. NN/g painéis: legível de relance, cor como sinal secundário, agrupar por forma/borda/proximidade [V, <https://www.nngroup.com/articles/dashboards-preattentive/>].
- **Para nós:** o sistema de tokens é bom; o risco é outro. Ver "arcaico" abaixo e a seção 5.

#### Nota sobre "arcaico" [Inferência, não vi o site hoje]
A v6 combina Bodoni (didone de alto contraste), vocabulário "arcana"/"sódio"/"cinema" e faixas de cinema com loop de vídeo. Isso lê como **editorial/cinematográfico**, que é um registro de revista, não de produto de jogo ao vivo. Produtos de lobby que parecem atuais (Linear, Vercel, Valorant após a reforma) usam sans de interface em todo lugar, hierarquia por tamanho/peso, e a personalidade vem de **um** acento e de dados vivos. Hipótese a testar em horas, não em semanas: trocar o display de títulos de Bodoni para a própria Mona Sans (peso 600, tracking negativo) em duas telas e mostrar a 5 pessoas do público (pergunta única: "isso parece um site de agora?"). Se "arcaico" for sobre **comportamento** (lista parada, sem sala, sem amigos), a pesquisa anterior já cobre e foi implementado; então o gargalo restante é de **estados, movimento e fluxo**, as seções 3 e 4.

---

## 2. Arquitetura de informação recomendada

### 2.1 Mapa (melhor versão do produto)

| Rota | Papel | Observação |
|---|---|---|
| `/` | **Jogar**: navegador de lobbies + "Jogar agora" | É o produto. Abas de escopo: Todos, Amigos, Favoritos, Recentes. |
| `/sala/:id` | A sala; URL de convite | Também é a página que recebe quem vem de link. Tem pré-visualização pública (sem login). |
| `/criar` (ou folha) | Fluxo de hospedar | 3 campos + "Avançado". Preset por modo. Termina na sala. |
| `/modos`, `/modos/:slug` | Descoberta | Cartas ou tipografia; lista de lobbies daquele modo reutiliza a tabela. |
| `/hoje` | "Hoje à noite": agenda e horários de pico | Retenção (6.2). Pode começar como seção na home. |
| `/instalar` | Confiança e instalação | Detecta o app; se já instalado, vira "tudo certo". |
| `/conta` | Steam, região, privacidade de presença, avisos | Um lugar só para permissões e opt-outs. |
| `/novidades`, `/ajuda` | Apoio | Sem destaque na navegação principal. |

Camadas **persistentes** (todas as rotas): cabeçalho único; **dock** inferior de 48 a 56 px (ocioso / na sala / entrando / aguardando vaga); trilho de amigos no desktop (folha no celular). Navegação principal com 4 itens visíveis (Jogar, Modos, Hoje, Instalar). **Sem hambúrguer** no desktop; no celular, no máximo 3 a 4 destinos sempre visíveis (NN/g, P14).

### 2.2 Primeira tela (a): visitante que veio de um link no Discord

Dois casos, porque o link define a intenção:

1. **Link de sala (`/sala/:id`), o caso mais comum.** A primeira tela **é a sala**, não a home: nome do lobby, modo (uma frase), quem já está (amigos em evidência se logado), vagas, "começa com 6 · faltam 2", ping/região, e **um** botão: "Entrar". Requisitos em linha e só quando faltam, em fila curta: (1) entrar com a Steam, (2) app instalado ("App não encontrado · Instalar · Já tenho"), (3) abrir. Nada de herói, nada de marketing acima da dobra. Se o lobby fechou/encheu: estado dedicado com vizinhos ("outros 3 lobbies do mesmo modo") e "Avisar quando abrir". Se vier de webview (Instagram, etc.): faixa "Abrir no navegador".
2. **Link da home (`/`).** O primeiro viewport precisa responder, sem rolar, a 3 perguntas: o que é isto (uma frase), tem gente agora (contador vivo + **pelo menos 3 linhas reais** da lista) e qual é o próximo passo (**Jogar agora**). A arte-chave pode continuar, mas ocupando ~55 a 65% da altura com a lista "espiando" por baixo; em 1440×900, a lista não pode começar abaixo da dobra. Lichess e Hyperline fazem o mesmo: a home oferece verbos e dado vivo, não explicação [V, ver pesquisa anterior].

Métrica-guia: **tempo até o primeiro clique em "Entrar"** e **taxa de chegada à sala** [Inferência; ver 6.2].

### 2.3 Primeira tela (b): jogador que volta

- Abre direto em `/` com escopo **"Meus"** (ordem: lobby em que você está > amigos em lobbies > favoritos com vaga > resto). Sem herói expandido (colapsa para uma linha de título; guardar a preferência com `localStorage` em try/catch).
- O dock já diz "Voltar ao Deadlock" ou "Continuar em <modo>".
- Se você tem um aviso de vaga pendente, ele é o item mais alto da página.
- Se nada acontece (madrugada), em vez de "Nenhum lobby", mostrar o histórico: "esse modo costuma encher entre 20h e 23h" e "Criar lobby" como verbo primário.

---

## 3. Guia por componente

### 3.1 Cartão de lobby x linha de tabela

| Critério | Linha (tabela/lista) vence | Carta vence |
|---|---|---|
| Itens simultâneos | > ~8 | ≤ ~6 |
| Tarefa | comparar (vagas, ping, região), ordenar, varrer | descobrir, escolher por identidade |
| Conteúdo | homogêneo, mesmos campos | heterogêneo, com arte/descrição |
| Densidade | 8 a 10 linhas em 1440×900 | 3 a 4 por viewport |
| Dado ao vivo | número muda no lugar, sem mexer o layout | cartas mudam de altura e "pulam" |

- **Evidência:** NN/g cartas x listas e tabelas (P5). Tabela: primeira coluna legível, colunas por importância, linha inteira como alvo, painel lateral não modal.
- **Decisão:** lobbies = **linha** (já na v6, 56 a 64 px). Modos, eventos de "hoje à noite" e o "Recomendado" único = carta/bloco. No celular a linha vira **linha de duas linhas** (título + meta, vagas à direita), toda a linha é o alvo (≥ 44 px), com o botão como reforço visual; **não** virar carta grande, porque perde varredura.
- Ordem de colunas por importância [Inferência]: lobby (nome do anfitrião + modo), vagas, ping/região, estado/ação. Cabeçalho fixo ao rolar. Ordenação por clique no cabeçalho **mais** o padrão inteligente.

### 3.2 Presença e status
- **Vocabulário mínimo e estável:** ao vivo, em partida, em lobby X (amigo), online no app, offline (some da lista de amigos). Cinco estados é o teto; cada um com **ponto + palavra**.
- **Presença com destino:** "joga em X · Entrar" / "Pedir para entrar" (pesquisa anterior). A linha de amigo mostra **o que fazer**, não só quem está online.
- Ponto de 8 px, anel de 2 px da cor do fundo, nunca só cor (P9). O verdete significa "amigo/ao vivo"; **pronto é sódio** (já decidido).
- Cuidado de privacidade: opção de **não mostrar minha presença** em `/conta` e "esconder detalhes" (a Steam some com o botão Join quando o amigo esconde os detalhes [S]).
- Anúncio para leitor de tela de mudanças de presença: **não** anunciar cada uma; resumir ("2 amigos online") em região educada (WCAG 4.1.3, "tagarela") [V].

### 3.3 Avatares
- Quadrados com raio 2 px (combina com o sistema), 24/32/40 px; tamanho reservado no HTML para não causar CLS.
- Sem foto (ou falha de carga): **iniciais em Fragment Mono** sobre cor derivada do ID da Steam (estável entre sessões, tons baixos de saturação para passar 4.5:1 do texto). Nunca avatar aleatório novo a cada render [Inferência].
- Grupos: no máximo 4 sobrepostos + "+N"; nome completo no `title`/rótulo acessível. Em lista, preferir **nome em texto** ao avatar quando o espaço é pouco: nome vale mais que rosto para reconhecer [Inferência].
- Avatar decorativo é `alt=""`; se for o único identificador, texto alternativo é o nome.

### 3.4 Pronto (ready-check) e sala de espera
- **Cada vaga mostra o próprio estado em texto + glifo + cor** (hoje a sala já tem texto "pronto/não pronto"); a janelinha com contorno precisa de 3:1 contra o fundo, senão o texto carrega o sinal (WCAG 1.4.11).
- "Estou pronto" é **reversível** até o início (NN/g: prevenção de erro e desfazer [V, ten-usability-heuristics]).
- "Iniciar partida" desabilitado **com motivo** ao lado ("faltam 2 jogadores"), não só apagado (XAG 103: indisponível ganha rótulo [V]). Inativo é isento de contraste, mas o motivo não.
- **Sem aceite cronometrado para lobby aberto.** Se um dia houver (fila automática): prazo visível em texto + barra, anunciado em marcos (30 s, 10 s), jamais por segundo; "Agora não" sem punição; respeitar 2.2.1 (evento em tempo real é isento, mas oferecer saída é boa prática) [V/Inferência].
- Mudanças de quórum aparecem como linha de atividade no próprio lugar ("nick2 ficou pronto"), com anúncio educado único.
- Espera ocupada (P8): o que fazer enquanto falta gente, em duas ações: copiar link e convidar amigo online; mais o histórico "esse modo costuma encher em ~X min" quando houver dado real.

### 3.5 Toasts e notificações

| Evento | Meio | Duração | Observação |
|---|---|---|---|
| Entrou/saiu da sala, copiou link | toast | 3 a 4 s | passivo; `role="status"` |
| Lobby encerrou, você foi removido | banner na sala | persiste até dispensar | NN/g: erro não pode ser toast |
| Abriu vaga (aviso pedido) | cartão no dock + notificação do navegador | persiste até agir/dispensar | ação "Entrar"; nunca entrar sozinho |
| App não respondeu no handoff | inline na sala, com 3 ações | persiste | tentar de novo, copiar código, instalar |
| Conexão perdida | banner fino no topo | enquanto durar | e esmaecer valores "velhos" |
| Convite de amigo | item no trilho/dock + notificação opcional | até responder | aceitar/recusar sem sair da lista (Riot faz isso na app do League Friends [S, <https://medium.com/riot-games-ux-design/design-at-riot-and-the-league-friends-mobile-app-8089933594a5>]) |
| Falha de rede ao salvar | inline no campo | persiste | com "Tentar de novo" |

Regras: um canal por evento (sem toast **e** banner); empilhar no máximo 2 toasts; toast com ação nunca some em menos de ~8 s [Inferência]; texto em frases, com o nome do lobby, não "Ação concluída".

### 3.6 Estados vazio, cheio e erro

| Situação | O que mostrar | Próximo passo |
|---|---|---|
| Carregando lista | esqueleto com 6 a 8 linhas do tamanho final; contagem "carregando" (não "0") | nenhum; sem spinner < 1 s, esqueleto só após ~200 ms [V, Vercel/NN/g] |
| Sem lobbies agora | "Ninguém jogando agora" + hora de pico histórica + vizinho mais próximo | Criar lobby; "Avisar quando alguém criar" |
| Filtro sem resultado | quais filtros estão ativos + quantos lobbies existem sem eles | "Limpar filtros" |
| Lobby cheio | "Lotado" em texto; o que fazer | "Avisar quando abrir vaga"; sugerir 2 vizinhos |
| Lobby encerrou | "Esse lobby acabou" (inclui o motivo se houver) | 2 lobbies parecidos; Criar |
| Lobby privado | "Só com convite" | "Bater na porta" |
| Sem login | explicar o que se ganha | "Entrar com a Steam" |
| App não encontrado | o que é e que é seguro (P13) | Instalar · Já tenho · Abrir manualmente |
| Sem rede / API fora | "Sem conexão. Última atualização há N s" + valores esmaecidos | tentar agora (com tentativa automática ao fundo) |
| Erro de permissão do navegador | como reverter nas configurações | link para `/conta` |
| 404 / sala inexistente | link pode ter expirado | ver lobbies do mesmo modo |

NN/g: não confundir carregando com vazio, e sempre dar o caminho [V]. Para texto de erro: dizer o que houve, o que a pessoa pode fazer e o que o sistema já está fazendo.

### 3.7 Carregando e passagem para o jogo (handoff)
- **Etapas concretas, com tempo (mono)**: Reservando vaga → App aberto → Abrindo o Deadlock → Dentro do lobby. Cada troca com 150 a 200 ms de fade; **sem barra de percentual** (não há total real); contagem de etapas (NN/g aceita "etapa 2 de 4" quando não há percentual [V]).
- **Prazos [Inferência calibrada nas referências]:** até ~2 s só o estado do botão; 2 a 10 s spinner/etapa; passou de ~8 a 10 s sem avançar, mostrar ajuda ("Demorando mais que o normal") com as três saídas; o limite duro de referência é o do Discord, 180 s [V].
- **Saída de emergência sempre visível:** Cancelar; Tentar de novo; Copiar código/comando; Abrir manualmente; Ajuda.
- **O app como entidade de primeira classe:** o navegador **não tem como saber** de forma confiável se um link de protocolo abriu o app [S: sem detecção padrão; o pop-up "Abrir aplicativo?" varia por navegador e, segundo relatos, não deixa mais marcar "sempre" desde o Chrome 77]. Logo, em vez de depender de `hyperline://` a cada clique: o app conectado publica presença no backend ("App conectado") e o clique do site cria uma **intenção** que o app recebe e executa, sem prompt do navegador. O protocolo fica só para quando o app está fechado, com texto preparatório ("O navegador vai perguntar; clique em Abrir") [Inferência; fontes: <https://textslashplain.com/2019/11/21/web-to-webapp-communication-custom-scheme-handlers/>, S].
- Ao concluir: o dock passa a "No lobby · Voltar ao Deadlock" e a aba pode ganhar o contador no título (`(4/6) Arena`), que é o jeito barato de "estar em segundo plano" [Inferência].
- Sem tela cheia de carregamento; a sala continua visível e navegável durante o handoff.

---

## 4. Movimento e "liveness"

### 4.1 O que animar e por quanto tempo
Calibração: faixas do NN/g [V] + minha escolha dentro delas [Inferência]. Material/Apple como confirmação [NV].

| Elemento | Duração | Curva | Propriedade |
|---|---|---|---|
| Hover/pressionar botão e linha | 100 a 120 ms | ease-out | cor/opacity |
| Alternar (pronto, favorito, filtro) | 120 a 160 ms | ease-out | cor, transform |
| Número muda (vagas, ping) | **sem animação de contagem**; marca "fresh" 600 a 900 ms | fade do fundo | opacity |
| Linha entra na lista | 180 a 220 ms | `--ease` atual | opacity + translateY 4 px |
| Linha sai (lobby fechou) | 160 a 200 ms, depois de ~1,5 s com o rótulo "encerrado" | ease-in | opacity |
| Reordenar | 200 ms (FLIP) **só** se a pessoa não está interagindo | ease-in-out | transform |
| Painel lateral/folha | 240 a 300 ms entrando, 180 a 220 saindo | `--ease` | transform |
| Diálogo | 200 a 240 ms | `--ease` | opacity + scale 0,98 → 1 |
| Troca de etapa do handoff | 150 a 200 ms | ease-out | opacity |
| Troca de rota | nenhuma, ou fade ≤ 150 ms | – | opacity |

O `--t: 220ms` e a curva `--ease` já existentes estão dentro da faixa; basta usar tempos menores para microinteração. Entrar um pouco mais lento que sair (NN/g: 300 x 200 a 250 ms) [V].

### 4.2 Como a lista "respira" sem cansar
1. **Agrupar** atualizações em janelas de ~1 a 2 s [Inferência; NN/g: evitar atualizações tão rápidas que o usuário não acompanha [V]].
2. **Sinal de frescor, não de alarme:** só quem mudou ganha o brilho curto; se muitas linhas mudam ao mesmo tempo (conexão voltou), **nenhuma** brilha.
3. **Honestidade de obsolescência:** se o fluxo ao vivo ficar mudo (> ~10 s), esmaecer os valores, trocar "ao vivo" por "atualizado há 14 s" e tentar reconectar. Dado velho com cara de vivo é o pior erro de confiança [Inferência].
4. **Totais coerentes:** cabeçalho, lista, modos e dock saem de uma fonte só (já no brief-v6).
5. **Pausar:** controle único de "Pausar atualizações", e ao retomar pula para o estado atual (WCAG 2.2.2 [V]).
6. **Aba em segundo plano:** reduzir a frequência e, ao voltar, uma única atualização, sem reproduzir fila de animações.

### 4.3 O que não animar
- Rotas inteiras, listas inteiras entrando em cascata a cada visita, números contando de 0, qualquer coisa em laço infinito perto de texto que se lê, parallax (inclusive no herói ao rolar), pulso permanente em botão, badge piscando, confete ou som ao iniciar.
- **Achado importante sobre o brief-v6:** o loop de vídeo de **6 s** no herói começa sozinho e repete; WCAG 2.2.2 (nível A) exige mecanismo de pausar/parar para movimento que dure mais de 5 s, e o Vercel repete a regra para laços > 5 s [V]. Há `prefers-reduced-motion`, mas isso não substitui o controle para quem não tem a preferência ligada. Opções: botão "Pausar vídeo" (pequeno, no canto do herói), ou parar no último quadro depois do primeiro ciclo, ou encurtar para ≤ 5 s.
- Reduzir movimento: manter a informação (troca de estado por cor/texto), tirar translate/scale, deixar só fade; nunca desligar o feedback (WCAG 2.3.3 AAA, MDN, Apple [V/NV]).

### 4.4 Som e tátil (referência, fora do v6)
Clientes como FACEIT e Valorant usam som para "partida encontrada" e para pedir atenção. Se algum dia entrar: nunca como único sinal (XAG 103 e GAG) [V]; desligado por padrão ou fácil de silenciar; só para eventos que a pessoa pediu (aviso de vaga). Háptico não se aplica ao site.

---

## 5. Anti-padrões que fazem um site de jogo parecer amador ou datado

1. **Herói que ocupa tudo e esconde o produto.** Ninguém veio ler a marca; veio entrar num lobby. Corrigir com lista viva já no primeiro viewport (2.2). [Inferência + Lichess/Hyperline]
2. **Tipografia de revista num produto ao vivo** (display serifado alto contraste em títulos, itálicos, numeração romana). Lê como editorial. Ver nota "arcaico".
3. **Lista estática com "Atualizar"** ou que muda sozinha sem congelar sob o cursor. Steam/Halo (manual) e o oposto (salta) falham pelo mesmo motivo: perda de controle [S/V].
4. **Contadores que não batem** entre cabeçalho, lista e modos; "0 jogando" que, na verdade, é "carregando" (NN/g: vazio x carregando [V]).
5. **Estados só em cor** (verde/vermelho; "pronto" só dourado) e ícones por glifo Unicode (P9).
6. **Cartas de tamanhos diferentes para dado comparável**; cartão com sombra, gradiente e brilho no hover em tudo. Em lista, cada pixel decorativo custa varredura (NN/g).
7. **Modal para tudo** (confirmar favorito, boas-vindas, cookies grandes). NN/g: modal só para urgente que exige ação [V]. Painel lateral não modal para detalhes.
8. **Toast para erro** que some antes de ser lido (NN/g [V]).
9. **Pedido de notificação ao carregar a página** (web.dev: o pior momento [V]); ou entrar em "dupla permissão" sem valor claro.
10. **Spinner infinito** sem etapa, tempo, saída. E o oposto: spinner de 200 ms que pisca (Vercel: atraso de 150 a 300 ms e mínimo visível de 300 a 500 ms [V]).
11. **Salto de layout** por fonte tardia, imagem sem tamanho, anúncio de "ao vivo" que empurra a tabela (CLS [V]). Reservar altura do dock e da faixa de "reconectando".
12. **Alvos pequenos e botão colado ao destrutivo** (Riot: Convidar ao lado de Remover amigo sem confirmação, queixa de jogadores [S, <https://devtrackers.gg/valorant/p/c4921597-quality-of-life-on-friends-list-the-invite-button-is-right-next-to-the-remove-friend-button-with-no-removal-confirmation>]); confirmar ou oferecer Desfazer (NN/g/Vercel [V]).
13. **Barras de progresso falsas** que correm e travam em 90% (NN/g: expectativa se forma pelo ritmo inicial [V]). Sem percentual quando não há total real.
14. **Empresa fala, jogador não:** "solução de matchmaking de próxima geração". Frases curtas, concretas, verbo no imperativo; números reais.
15. **Gamificação e prova social fabricada:** "47 pessoas vendo esta página", ranking de popularidade, selos "Hot". Fere confiança e o brief-v6 [V, pesquisa anterior].
16. **Mobile como cópia encolhida**, com hover para revelar e sem alvo de 44 px (brief-v6 já proíbe "Passe o mouse…").
17. **Dark pattern de retenção** (sequências diárias, culpa ao sair, contagem regressiva falsa). Em comunidade pequena, o custo de confiança é maior que o ganho.
18. **Sem pré-visualização ao compartilhar:** link do lobby no Discord/WhatsApp aparece como URL pelada (falta Open Graph) [V, ogp.me].

---

## 6. Extras pedidos

### 6.1 Instalação e confiança (terceiro app que abre o jogo de outra empresa)
- Ordem que reduz atrito: **ver primeiro, instalar depois.** Visitante vê lobbies e a sala sem login; só pedimos Steam ao "Entrar" e só pedimos o app quando falta. Cada requisito aparece **no momento do clique**, não antes [Inferência; consistente com web.dev: pedir no momento de valor [V]].
- Mensagens de segurança em uma tela: o que o app faz (abre o Deadlock e informa o lobby), o que não faz (não lê senha, não injeta no jogo [só se for verdade; confirmar com o desenvolvedor]), de onde vem (hash SHA-256, repositório), como remover.
- **SmartScreen / antivírus** (P13): captura do aviso, passo a passo, e "se o antivírus reclamar, é falso positivo; envie para a análise". Assinatura de código em todo release e identidade constante; avaliar o serviço de assinatura da Microsoft (US$ 9,99/mês na página lida) [V]. Hyperline também responde "falso positivo de antivírus" na própria FAQ [V, pesquisa anterior].
- Estado do app na UI: "App conectado · versão X" / "Atualização disponível" / "Não encontrado". Mostrar a **versão** e uma data reduz a sensação de caixa-preta [Inferência].
- Valve: avisar que o produto é da comunidade, não da Valve, para não parecer app oficial ou golpe [Inferência].

### 6.2 Do primeiro acesso à primeira partida, e retenção
- **Funil a instrumentar** (eventos, sem dado pessoal): ver lista → clicar Entrar → login Steam → app detectado → jogo aberto → dentro do lobby → partida iniciada. O **tempo até estar dentro do lobby** é a métrica-mãe [Inferência]. Não achei benchmarks públicos confiáveis de conversão para esse nicho [NV]; não invente metas, meça a base.
- **Onde se perde** (hipóteses a testar): app não instalado (maior), aviso do Windows, prompt do navegador de protocolo, lobby encher durante o handoff. Todos têm remédio nos itens 3.7 e 6.1.
- **Laços de retorno sem manipulação:**
  1. **Avisos pedidos pela própria pessoa**: "abriu vaga", "um amigo entrou em lobby", "esse modo tem lobby hoje às 21h". Dupla permissão no momento do clique [V].
  2. **Favoritos** (modos e anfitriões) e **Recentes**, com contagem nas abas.
  3. **Agenda "Hoje à noite"**: lobbies agendados por anfitriões com horário local e botão "Lembrar-me" (arquivo `.ics`/notificação). O Discord tem "Eventos" com botão "Tenho interesse" e lembrete [NV: a página oficial bloqueou a leitura]. Anfitrião cria o evento em 3 campos.
  4. **Histórico de ocupação** por modo ("costuma encher 20h a 23h"), em um traço de dados legível, derivado de dado real (BattleMetrics faz algo parecido [S]).
  5. **Convite** como canal principal: link da sala com pré-visualização OG; o novo jogador chega direto à sala (2.2).
- GDC Vault (só resumos): o Blizzard tratou o LFG do Overwatch como lista de grupos de outros jogadores, **não matchmaker**, com restrições definidas pelo líder (função, voz); 343 Industries (Halo 5) apresenta dados de que várias práticas aceitas de matchmaking têm pouca evidência e algumas são críticas, sem dizer quais no resumo; Bungie construiu um grafo social novo para amigos e convites entre plataformas [V resumos: <https://gdcvault.com/play/1026022/Social-Systems-Design-Implementation-and>, <https://gdcvault.com/play/1026588/Matchmaking-for-Engagement-Lessons-from>, <https://gdcvault.com/play/1027567/Bringing-Players-Together-Building-Cross>]. Uso útil: **requisitos declarados no lobby** (ex.: "usa voz", "entra no meio") como filtro e como expectativa; não prometer matchmaking que não existe.
- Hodent sobre motivação: competência, autonomia e relação; metas curtas/médias/longas visíveis; "provocar" slot vazio antes de liberar [V]. Aplicação limitada: slots vazios na sala já fazem isso; evitar sistema de metas.

### 6.3 Celular x desktop
- **Realidade:** joga-se no PC, mas o **link chega no celular** (Discord/WhatsApp). Portanto o celular não precisa de todo o produto; precisa de **três coisas bem feitas**: ver a sala do link, ver quem está lá, e transferir a intenção para o PC.
- **Celular:** a primeira tela é a sala (2.2). Botão principal: "Entrar" se o app/PC estiver conectado à conta (dispara a intenção no PC), senão "Enviar para o meu PC" (copiar link / abrir no PC / QR code) [Inferência]. "Instalar o app" aparece como instrução para depois, não como bloqueio. Sem hover; alvo 44 px; input 16 px; `touch-action: manipulation` [V, Vercel].
- **Webviews de apps sociais** (P14): detectar e mostrar "Abrir no navegador"; não depender de esquema `hyperline://` ali [S].
- **Pré-visualização do link** (OG): título "Arena de Rotas #4 · 4/6", imagem estática do modo, `og:image:alt`, URL canônica [V, ogp.me]. A imagem é gerada no servidor para refletir vagas atuais [Inferência; dentro do que o Discord/WhatsApp fazem com cache, o número pode ficar velho, então a página abre com o dado vivo].
- **Desktop:** trilho de amigos à direita, dock inferior, painel lateral de detalhe, atalhos (`/` busca, `J` jogar agora, `Esc` fecha painel), cabeçalho de tabela fixo.
- **Não** esconder a navegação primária atrás de menu no desktop (NN/g [V]).

### 6.4 Acessibilidade aplicada (lista curta, ordenada por retorno)
1. Estados por texto + forma + cor (P9). XAG 103, GAG básico [V].
2. Foco visível com 3:1 em todos os controles, ordem lógica, tudo operável por teclado (a tabela com `Enter`/`Space` na linha), sem armadilha de foco em painel/diálogo [V, Vercel/WCAG].
3. Regiões ao vivo: **uma** região educada para o resumo ("2 novos lobbies"), `role="alert"` só para erros que exigem ação; nada anunciando cada vaga que muda [V, WCAG 4.1.3].
4. Pausar/atualizar lista e pausar vídeo > 5 s (2.2.2) [V].
5. `prefers-reduced-motion` já existe; completar com troca de translate/scale por fade (MDN) [V].
6. Texto: ≥ 14 a 16 px em dados; escalável a 200% sem quebrar layout; linhas ≤ 80 caracteres; evitar caixa alta em frases (XAG 101) [V].
7. Alvos ≥ 24 px (44 no celular) (WCAG 2.5.8) [V].
8. Tema: o produto é escuro por convenção do público. NN/g mostra que, para leitura em visão normal, modo claro tende a render melhor e recomenda **não impor** o escuro por padrão e oferecer escolha [V, <https://www.nngroup.com/articles/dark-mode/>]. Dois cuidados: o estudo é sobre leitura, e nosso uso é de relance em tela escura de jogo; mesmo assim, respeitar `prefers-color-scheme` e oferecer um tema claro simples (trocar tokens) é pequeno e fecha o ponto [Inferência].
9. Texto de chat/voz: não há chat; se o link do Discord for usado, GAG pede alternativa a voz e a texto [V].
10. Lista de teste: testar com leitor de tela (NVDA) a lista e a sala, e com simulador de daltonismo (Color Oracle, indicado pela XAG) [V].

---

## 7. Se eu só pudesse fazer 10 coisas (ordem de retorno sobre esforço)

1. **Congelar a ordem sob o cursor + chip "N novos" + "Pausar"** (P6).
2. **Pré-visualização pública da sala** como primeira tela de quem vem de link, com os requisitos aparecendo só quando faltam (2.2).
3. **Estado do app como entidade:** "App conectado" no cabeçalho e intenção via backend em vez de protocolo a cada clique (3.7).
4. **Tabela de estados completa** (3.6) incluindo "obsoleto/reconectando" e sem rede (4.2).
5. **Painel lateral de detalhe** no lugar de expandir a linha (P5).
6. **Open Graph da sala** e detecção de webview com "Abrir no navegador" (P14, 6.3).
7. **Pausar o vídeo do herói** (ou ≤ 5 s) e herói colapsado para quem volta (4.3, 2.3).
8. **Aviso de vaga como cartão persistente no dock** com dupla permissão de notificação (P11).
9. **`/instalar` com captura do SmartScreen**, hash, o que faz e não faz; assinar releases (P13, 6.1).
10. **Teste rápido da hipótese "arcaico"**: duas telas com display em sans, 5 pessoas do público, uma pergunta (nota após P15).

---

## Avisos

- **Nenhuma instrução dirigida a mim foi encontrada** nas páginas lidas (NN/g, W3C, MDN, web.dev, Microsoft Learn, Linear, Vercel, Riot/Valorant, GDC Vault, Hodent, ogp.me). Os resultados de busca incluíram fóruns e blogs de terceiros; usei como [S] e só como apoio.
- **Falhou ou veio vazio:** Medium da Riot (403: "League Friends app", "Team Builder"), Game UI Database (403), Apple HIG Motion e Material 3 (veio só o título; o resumo de Apple no retorno do leitor era do próprio leitor, não da página, então ficou [NV]), Discord Help Center (403), Hodent no Goodreads (só chamada; li o texto em celiahodent.com), `nngroup.com/articles/web-notifications` e `live-updates` (404). Não achei post técnico do Riot Client nem post de design do Discord sobre presença; o que há sobre isso é imprensa e fórum.
- Os GDC Vault abriram só como resumo (conteúdo de assinante). Números de Blizzard ("50 a 70%") vieram de um único veículo e não repito.
- Os tempos da seção 4.1 e os prazos de 3.7 são calibrações minhas **dentro** das faixas do NN/g; teste em produção real (1440×900 e 375×812, build de produção) antes de fixar, como pede o brief-v6.
- O relato de que o Chrome 77 removeu "sempre permitir" para protocolos e o comportamento de webviews são [S]; confirmar em dispositivos reais (Discord/WhatsApp/Instagram, Android e iOS).
- Conflitos com decisões anteriores, para você decidir: (1) o painel lateral substitui a "expansão em linha" do item 10 da pesquisa anterior; (2) o loop de 6 s do herói precisa de controle de pausa; (3) a hipótese sobre Bodoni é minha e não foi testada.
- Nada foi baixado, nenhuma conta foi criada, nenhum formulário foi enviado. Nenhum código foi alterado e nada foi commitado.

## Fontes principais

- NN/g: <https://www.nngroup.com/articles/response-times-3-important-limits/> · <https://www.nngroup.com/articles/ten-usability-heuristics/> · <https://www.nngroup.com/articles/empty-state-interface-design/> · <https://www.nngroup.com/articles/skeleton-screens/> · <https://www.nngroup.com/articles/progress-indicators/> · <https://www.nngroup.com/articles/animation-duration/> · <https://www.nngroup.com/articles/cards-component/> · <https://www.nngroup.com/articles/data-tables/> · <https://www.nngroup.com/articles/indicators-validations-notifications/> · <https://www.nngroup.com/articles/progressive-disclosure/> · <https://www.nngroup.com/articles/mobile-first-not-mobile-only/> · <https://www.nngroup.com/articles/dark-mode/> · <https://www.nngroup.com/articles/dashboards-preattentive/>
- Acessibilidade: <https://gameaccessibilityguidelines.com/full-list/> · <https://learn.microsoft.com/en-us/gaming/accessibility/guidelines> · XAG 101 e 103 (links no corpo) · WCAG 2.2 Understanding: 1.4.1, 1.4.3, 1.4.11, 2.2.1, 2.2.2, 2.3.3, 2.5.8, 4.1.3 (links no corpo).
- Web/performance: <https://web.dev/articles/cls> · <https://web.dev/articles/animations-guide> · <https://web.dev/articles/push-notifications-permissions-ux> · <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion> · <https://ogp.me/> · <https://vercel.com/design/guidelines> · <https://lawsofux.com/doherty-threshold/>
- Jogo e produto: <https://www.celiahodent.com/gamers-brain-ux-onboarding/> · <https://playvalorant.com/en-us/news/game-updates/preview-the-future-of-valorant-s-interface/> · <https://linear.app/now/how-we-redesigned-the-linear-ui> · <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation> · GDC Vault (3 resumos, links no corpo) · <https://davidmaister.com/blog/201/The-Psychology-of-Waiting-Lines.html> [S] · <https://www.tomshardware.com/news/valve-updated-steam-chat-beta,37290.html> [S] · <https://deeplinks.linkrunner.io/blog/universal-links-app-links-break-in-app-browsers> [S] · <https://textslashplain.com/2019/11/21/web-to-webapp-communication-custom-scheme-handlers/> [S].
