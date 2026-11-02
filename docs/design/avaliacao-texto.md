# Avaliação do texto (copy) do protótipo web

Escopo: todo texto visível do protótipo em `web/` — `web/src/i18n/pt-BR.ts` (interface), `web/src/data/*.ts` (modos, lobbies, notas, instalação). Avaliado no código e nas telas rodando em `http://localhost:5173` (`/`, `/lobbies?vazio=1`, `/instalar`, `/modos/circulo-profano`).

Método: guias `impeccable` (clarify, delight e a rubrica de heurísticas do critique, aplicada só ao texto), `copywriting-kit:copy-diagnose` (palavra atual → problema → efeito no leitor) e `design:ux-copy` (padrões de CTA, estado vazio, erro, diálogo).
Limite: não é um `/impeccable critique` completo. Não houve subagentes nem detector visual, porque o detector procura padrões visuais e não ajuda a julgar texto. Nenhum arquivo do site foi alterado.

---

## 1. Diagnóstico

### Em uma frase

O texto é **claro, correto e honesto, mas não tem voz**. Ele descreve a interface ("Filtre por modo, região e vagas") e quase nunca a experiência ("todo mundo num anel que fecha a cada minuto"). O visual tem uma ideia forte ("luz acesa = gente", a cidade dos anos 1920, latão), mas o texto não usa nenhuma parte dela. Por isso o site parece "seco".

### O que faz o texto parecer seco

1. **O título da home é uma categoria, não uma promessa.**
   `home.title`: "Modos da comunidade para Deadlock." Funciona como etiqueta (e repete o `<title>`), mas não mostra nenhum modo, nenhuma cena, nenhuma razão para ficar. A mesma ideia aparece quatro vezes: `meta.home`, `home.title`, `footer.about` ("Modos personalizados feitos pela comunidade, jogados dentro do Deadlock.") e `modes.lead` ("Cada modo é feito por alguém da comunidade…").
   *Efeito:* quem chega não vê o que tem de diferente. Os modos têm conceitos ótimos (anel ritual, bonde à meia-noite, esconde-esconde na névoa), mas só aparecem depois da dobra.

2. **O texto descreve a interface, não o jogo.**
   - `home.steps[0].body`: "Filtre por modo, região e vagas."
   - `news.lead`: "O que mudou em cada versão, com um resumo no topo." (fala da página, não do que mudou)
   - `lobbies.lead`: "Partidas abertas agora. Entre direto ou crie a sua."
   *Efeito:* soa como manual de software, não como lugar onde se joga.

3. **A metáfora visual não tem texto.** As vagas do painel ao vivo são "janelas acesas", mas nenhum texto diz isso. Os números ficam crus: `live.online` "jogadores online", `live.lobbies` "lobbies abertos", `live.withSlots` "com vaga agora". O empty state tem uma ilustração de prédios com o título genérico "Nenhum lobby aberto agora".
   *Efeito:* o melhor ativo de identidade do site fica mudo e, além disso, sem legenda (é preciso adivinhar o que significa janela latão ou verde).

4. **Os títulos de seção são genéricos de SaaS.** "Modos em destaque", "Como funciona", "Novidades", "Nada encontrado", "Página não encontrada". Qualquer produto poderia usar esses títulos sem mudar nada.

5. **A personalidade que existe está escondida nos dados de exemplo.** Os nomes de lobby ("Só mira, sem choro", "Trilho sul, sem tóxico"), os nomes de modo ("Último Bonde", "Duelo à Meia-Noite") e o TL;DR das notas já têm sabor. A interface em volta deles não tem.

### O que já funciona (manter)

- **A honestidade da página de instalação é o ponto alto.** `install.lead`, `install.avWhy` ("Programas novos e pouco baixados às vezes são marcados por heurística, mesmo sem nada de errado…"), as listas "O que o app faz / não faz" e o guia por antivírus. Nenhum concorrente faz isso tão bem. A voz nova **não pode** encostar nesse tom.
- **Alguns textos já têm voz certa:** `join.title` "Falta só o app", `home.liveTitle` "Enchendo agora", `footer.antivirus` "Antivírus bloqueou?", `lobbies.emptyBody` (dá uma informação real: horário de pico no Brasil).
- **Regras dos modos e notas de versão** são específicas e verificáveis ("O círculo encolhe a cada 60 segundos; o último fechamento leva 90").
- **Plurais, rótulos acessíveis e variáveis** estão bem estruturados (`slots()`, `pingLabel()`, `joinLabel()`).

### Problemas de clareza e honestidade (independentes da voz)

| Prioridade | Texto atual | Problema | Correção |
| --- | --- | --- | --- |
| P1 | `home.play` "Jogar agora" | Leva para a lista de lobbies; não joga agora e ainda depende do app. Promessa que a próxima tela não cumpre. | "Achar uma partida" |
| P1 | `releases[0].tldr` "…o app abre o Deadlock 40% mais rápido." | A nota detalhada diz outra coisa: "O app reaproveita o processo do Deadlock já aberto. A entrada em lobby ficou **cerca de** 40% mais rápida." O resumo exagera (abrir o jogo ≠ entrar em lobby com o jogo já aberto) e tira o "cerca de". | "…e entrar em lobby com o Deadlock já aberto ficou cerca de 40% mais rápido." |
| P1 | `modes.noLobbies` "Crie um e os jogadores chegam." | Promessa que o sistema não garante. | "Nenhum lobby aberto neste modo agora. Abra o primeiro: ele aparece no topo da lista." |
| P1 | O site nunca diz **"grátis"** | É o fato mais forte da proposta e não aparece em nenhuma string. | Incluir na home, no passo 2 e na página de instalação (ver seção 3). |
| P1 | "Código aberto" em `home.steps[1]`, `join.trust`, `footer.source`, enquanto `install.sourceNote` diz "link público em breve" | Hoje a afirmação não pode ser verificada. | Até o repositório estar público: "Código aberto (link público em breve)" ou retirar dos selos de confiança. |
| P2 | `lobbies.emptyFilteredTitle` usa o mesmo `emptyBody` do estado sem nenhum lobby | Com filtros ativos, a pessoa lê "o movimento costuma ser maior entre 19h e 23h", o que não tem a ver com o motivo real (filtros demais), e não há "Limpar filtros" no vazio. | Criar `emptyFilteredBody` + botão "Limpar filtros" (ver seção 3). |
| P2 | "Entrar" com dois sentidos: `account.signIn` "Entrar com Steam" e `lobbies.join` "Entrar" | No diálogo de entrada as duas ações aparecem juntas. | Manter "Entrar" para lobby (é o verbo do jogo) e usar "Entrar com a Steam" só no login (sempre com "com a Steam"). |
| P2 | Cinco formas de dizer "avisar": "Avisar vaga", "Avisar no fim", "Aviso ligado", "Me avise", "Vamos avisar" | Mistura de pessoa e tempo verbal, e não diz **por onde** chega o aviso. | Padronizar em "Avisar quando…" / "Aviso ligado" e dizer o canal (seção 3). O canal real é uma decisão de produto: confirmar antes de publicar. |
| P2 | `modes.joinHint` "Entra no melhor de N lobbies abertos" | "Melhor" sem critério. | "Entra no lobby com mais amigos e menor ping (de N abertos)", usando o critério real de `lib/lobbies.ts`. |
| P2 | `sortOptions.recomendados` "Recomendados" | Critério escondido (amigos, ping baixo, quase cheio). | Rótulo "Recomendados" + dica: "Amigos primeiro, depois ping baixo e lobbies quase cheios." |
| P2 | `modes.lead` "**Cada** modo é feito por alguém da comunidade" | O Campo de Treino é da "equipe PROJETO". | "Quase todos os modos…" ou "Modos feitos por jogadores (e um campo de treino nosso)." |
| P2 | Não há texto sobre risco de banimento ou anti-cheat (o próprio README registra a lacuna) | Para um app que mexe na pasta do jogo, é a pergunta nº 1 do público. | Reservar a seção na instalação. O texto precisa vir de quem conhece o funcionamento real do app. **Não inventar.** |
| P3 | `install.hashHelp` / `join.trust` "Hash SHA-256 publicado" | Jargão para parte do público. | Explicar uma vez: "o hash é a impressão digital do arquivo". |
| P3 | Faltam textos de erro reais: app não detectado depois de instalar, Deadlock não encontrado, falha ao baixar o modo, lobby encheu no clique | O estado mais estressante não tem texto. | Propostas na seção 3. |

### Nota pela rubrica (heurísticas de Nielsen, só o texto)

Aplicação restrita ao texto: 3 (Controle) e 7 (Flexibilidade) ficam `n/a`, porque dependem de comportamento, não de texto.

| # | Heurística | Nota | Ponto-chave no texto |
| --- | --- | --- | --- |
| 1 | Visibilidade do estado | 3 | "Conectando…", "Aguardando o app…" e os avisos são claros; "Conectando…" não diz a etapa real (baixando modo / abrindo jogo). |
| 2 | Linguagem do usuário | 3 | Vocabulário de jogador (lobby, ping, build); "Jogar agora" engana; "heurística" e "SHA-256" sem explicação. |
| 3 | Controle e liberdade | n/a | Comportamento, não texto ("Agora não" e "Cancelar" existem). |
| 4 | Consistência | 2 | "Entrar" com dois sentidos; cinco variantes de "avisar"; "criar" e "hospedar" misturados; "código aberto" sem link. |
| 5 | Prevenção de erro | 3 | "Se for diferente, não execute" e "só entra com convite" são exemplares. |
| 6 | Reconhecer em vez de lembrar | 3 | "Recomendados" e "melhor de N" escondem o critério. |
| 7 | Flexibilidade | n/a | Fora do escopo do texto. |
| 8 | Estética e minimalismo (economia) | 3 | Enxuto, mas "Modos da comunidade" se repete 4 vezes. |
| 9 | Recuperação de erro | 2 | Vazio filtrado sem saída; erros do app e da conexão não têm texto. |
| 10 | Ajuda e documentação | 3 | Guia de antivírus excelente; falta a seção de risco/anti-cheat. |
| **Total** | | **22/32 (69%)** | **Aceitável**, na fronteira de Bom |

**Fora da rubrica, nota de voz e personalidade: 1/4.** A clareza segura o site; a falta de voz é o que o usuário sente como "seco". Os dois problemas se resolvem juntos: textos mais específicos ficam, ao mesmo tempo, mais claros e mais vivos.

---

## 2. Proposta de voz

Três direções. Todas mantêm pt-BR com "você", termos de jogo em inglês quando o jogador usa assim (lobby, ping, build, farm, cooldown, x1) e **zero** metáfora nos textos de confiança, erro e instalação.

### Direção A: "Cronista da Cidade Oculta"

Um narrador que conta a cidade como se ela existisse: lampiões, rituais, madrugada, sociedades secretas. Cada lobby é uma reunião, cada modo é uma lenda local. É a voz mais imersiva e a que mais se distancia do hyperline.gg. O risco é ficar cafona, cansar na 10ª visita e esconder a informação atrás da prosa. Também briga com a direção visual v2, que tirou a cidade do cenário e virou produto.

**Faça:** frases curtas com uma imagem forte; vocabulário de época (bonde, lampião, cofre, ritual); mistério só no título.
**Não faça:** prosa roxa ("as sombras sussurram…"); lore em botão; misticismo em aviso de antivírus; inventar lore oficial da Valve.

| String | Na voz A |
| --- | --- |
| Hero + subtítulo | **"Quando a cidade dorme, a comunidade joga."** Modos feitos por jogadores, rodando dentro do Deadlock. De graça. Veja quem está acordado agora, sem instalar nada. |
| CTA principal | "Entrar na cidade" |
| Lobbies vazios | **"As ruas estão quietas."** Nenhum lobby aberto agora. No Brasil a cidade costuma acordar entre 19h e 23h. Abra o primeiro, treine com bots ou peça um aviso. |
| Instalação (intro) | **"Antes de abrir a porta, veja o que entra."** O app é pequeno (12,4 MB), grátis e só abre o Deadlock com o modo escolhido. Abaixo: o que ele instala, onde, e como conferir o arquivo. |
| TL;DR de nota | "O Cofre ficou mais generoso com os ladrões, o Círculo dá mais fôlego no fechamento final e entrar em lobby com o jogo aberto ficou cerca de 40% mais rápido." |

### Direção B: "Parça de lobby BR"

Um jogador brasileiro experiente falando com quem acabou de chegar no Discord. Direto, gíria leve, humor de lobby ("sem choro", "x1", "bora"). A voz mais calorosa e mais claramente brasileira. O risco é a gíria envelhecer rápido, soar forçada quando a marca fala ("bora, galera!"), não escalar para es-LatAm e tirar seriedade da página de instalação, justo onde a confiança importa.

**Faça:** falar como gente ("dá pra", "pra", "x1"); humor de situação real de lobby; frases de uma linha.
**Não faça:** "bora galera!!!"; emoji; meme datado; tratar antivírus ou segurança com piada; gíria regional demais.

| String | Na voz B |
| --- | --- |
| Hero + subtítulo | **"Cansou do mesmo mapa? Tem modo novo rolando agora."** Modos feitos pela galera, de graça, dentro do próprio Deadlock. Dá pra ver quem tá jogando sem instalar nada. |
| CTA principal | "Bora jogar" |
| Lobbies vazios | **"Tá vazio por enquanto."** O pico no Brasil costuma ser das 19h às 23h. Abre um lobby aí, treina com bot ou deixa que a gente te chama. |
| Instalação (intro) | **"Sem pegadinha: isso é tudo que o app instala."** São 12,4 MB, grátis, e ele só abre o Deadlock no modo certo. Confere aqui o que entra no seu PC e como checar o arquivo. |
| TL;DR de nota | "Quem ataca no Cofre respira melhor, o Círculo segura mais no final e entrar em lobby com o jogo aberto tá cerca de 40% mais rápido." |

### Direção C (recomendada): "Luz Acesa"

Um guia sóbrio e confiante, com sotaque de cidade à noite. Clareza primeiro, **uma** imagem por tela, e só imagens que correspondem a algo real no produto: janela acesa = jogador, madrugada = horário, "em cartaz" = modos disponíveis, bonde/névoa/cofre = o próprio modo. A gramática é de produto moderno; o sabor vem da ideia visual do site ("luz acesa = gente") e do vocabulário dos anos 1920 em títulos curtos. Calor brasileiro nos avisos e estados vazios, sem gíria que envelhece. Seriedade absoluta em instalação, antivírus e afiliação.

**Faça:**
- Título pode ter imagem; corpo sempre diz o fato.
- Uma metáfora por tela, sempre ancorada em dado real (as janelas acesas do painel ao vivo, o horário local).
- Ser específico: nome do modo, número, regra ("três trancas, dois minutos cada").
- Humor seco e curto em notas de correção e no 404, nunca em erro que bloqueia.
- Dizer "grátis", "não afiliado à Valve" e "o antivírus pode reclamar" com a mesma naturalidade.

**Não faça:**
- Hype ("épico", "revolucionário", "a melhor experiência"), exclamação, emoji, CAIXA ALTA.
- Metáfora em botão, navegação, erro, segurança, hash.
- Urgência falsa ("corra!", "últimas vagas!"). Urgência só quando vem do dado ("Falta 1").
- Lore que pareça oficial da Valve.
- Variar palavras por estilo: "lobby" é sempre lobby, "entrar" é sempre entrar no lobby.

| String | Na voz C |
| --- | --- |
| Hero + subtítulo | **"O Deadlock que a comunidade inventou."** Todos contra todos num anel que fecha, esconde-esconde na névoa, x1 com fila de espera. Modos feitos por jogadores, grátis, rodando dentro do próprio Deadlock. Veja quem está jogando agora, sem instalar nada. |
| CTA principal | "Achar uma partida" |
| Lobbies vazios | **"A cidade está quieta agora."** Nenhum lobby aberto no momento. No Brasil, o movimento costuma ser maior entre 19h e 23h. Acenda a primeira janela: abra um lobby, treine contra bots ou peça um aviso. |
| Instalação (intro) | **"Antes de baixar, veja exatamente o que entra no seu PC."** O app é grátis, tem 12,4 MB e faz uma coisa: abrir o Deadlock com o modo escolhido. Abaixo estão o que ele instala e onde, como conferir se o arquivo é o original e o que fazer se o antivírus reclamar, o que é comum com programas novos. |
| TL;DR de nota | "Atacantes do Cofre ganharam 15 segundos por tranca, o Círculo dá mais tempo no fechamento final e entrar em lobby com o Deadlock já aberto ficou cerca de 40% mais rápido." |

### Por que a C

1. **É a mesma regra do visual.** O README da v2 diz "Moderno e limpo primeiro; Deadlock como sotaque". A voz C é exatamente isso em texto. A A contradiz a v2 (traz de volta o cenário que saiu) e a B não conversa com o latão e o déco.
2. **Escala para os lugares sérios.** A instalação é o diferencial de confiança do site. A C deixa essa página quase como está e ganha vida nas bordas (hero, vazio, notas, 404). A A e a B pedem exceções o tempo todo.
3. **Aguenta repetição.** O jogador volta todo dia à lista de lobbies. Uma voz contida não cansa; a narração (A) e a gíria (B) cansam.
4. **Não depende do nome.** O nome ainda não foi decidido; a C se apoia na ideia visual (janela acesa), não no nome.
5. **Traduz.** Vai para es-LatAm e inglês sem reescrever a identidade; gíria BR não vai.

A C pode pegar emprestado da B o calor dos avisos ("a gente te avisa") e da A uma imagem por título de modo. Esse é o limite.

---

## 3. Reescrita completa na voz "Luz Acesa"

Legenda: **manter** = o texto atual já está certo; **novo** = chave que não existe hoje. Variáveis como em `pt-BR.ts`.

### meta (título da aba)

Títulos de aba ficam funcionais (SEO, histórico do navegador). Só a home ganha o fato "grátis".

| Chave | Atual | Proposto |
| --- | --- | --- |
| `meta.home` | `PROJETO \| Modos da comunidade para Deadlock` | `PROJETO \| Modos grátis da comunidade para Deadlock` |
| `meta.lobbies` / `modes` / `install` / `news` / `mode()` | — | manter |
| `meta.notFound` | `Página não encontrada \| PROJETO` | manter |

### a11y

Manter tudo. Rótulos acessíveis devem ser literais.

### nav

| Chave | Atual | Proposto |
| --- | --- | --- |
| `nav.*` | Início, Lobbies, Modos, Novidades, Instalar | manter (navegação não leva voz) |

### account

| Chave | Atual | Proposto |
| --- | --- | --- |
| `account.signIn` | Entrar com Steam | Entrar com a Steam |
| `account.signInShort` | Steam | manter |
| `account.signOut` | Sair | manter |
| `account.friendsOnline(n)` | 1 amigo online / N amigos online | manter |
| `account.mockNote` | Protótipo: login simulado, nada é enviado. | manter |
| `account.signedInToast(name)` | Você entrou como {name}. | `{saudacao}, {name}. Agora dá para ver onde seus amigos estão jogando.` (`saudacao` = Bom dia / Boa tarde / Boa noite pela hora local, ver seção 4) |
| `account.signedOutToast` | Você saiu da conta. | Você saiu da conta. Os lobbies continuam abertos para olhar. |

### footer

| Chave | Atual | Proposto |
| --- | --- | --- |
| `footer.disclaimer` | Projeto independente da comunidade. Não afiliado à Valve. | Projeto independente, feito por jogadores. Não afiliado à Valve. |
| `footer.about` | Modos personalizados feitos pela comunidade, jogados dentro do Deadlock. | Modos feitos por jogadores, jogados dentro do próprio Deadlock. Grátis. |
| `footer.product` | Plataforma | manter |
| `footer.trust` | Confiança | manter |
| `footer.source` | Código aberto | Código aberto (em breve), até o link existir; depois "Código-fonte" |
| `footer.hash` | Verificar o instalador | manter |
| `footer.antivirus` | Antivírus bloqueou? | manter |
| `footer.language*`, `footer.theme*` | — | manter |
| `footer.prototype` | Protótipo navegável com dados fictícios. | manter |
| **novo** `footer.signoff` | — | Acenda uma janela hoje à noite. (assinatura curta, opcional) |

### live (painel ao vivo)

| Chave | Atual | Proposto |
| --- | --- | --- |
| `live.online` | jogadores online | jogando agora (mesmo termo de `modes.playersNow`) |
| `live.lobbies` | lobbies abertos | manter |
| `live.withSlots` | com vaga agora | com vaga |
| `live.label` | Ao vivo | manter |
| **novo** `live.legend` | — | Cada janela acesa é um jogador. As verdes são seus amigos. |
| **novo** `live.kicker(período)` | — | "Noite na cidade" / "Madrugada na cidade" / "Tarde na cidade" / "Manhã na cidade" (seção 4) |

### home

| Chave | Atual | Proposto |
| --- | --- | --- |
| **novo** `home.eyebrow` | — | Modos da comunidade para Deadlock · grátis |
| `home.title` | Modos da comunidade para Deadlock. | O Deadlock que a comunidade inventou. |
| `home.lead` | Veja os lobbies abertos agora, sem instalar nada. Na hora de jogar, o app abre o Deadlock direto na partida. | Todos contra todos num anel que fecha, esconde-esconde na névoa, x1 com fila de espera. Modos feitos por jogadores, grátis, rodando dentro do próprio Deadlock. Veja quem está jogando agora, sem instalar nada. |
| `home.play` | Jogar agora | Achar uma partida |
| `home.liveTitle` | Enchendo agora | manter |
| `home.hotLink` | Ver todos os lobbies | manter |
| `home.modesTitle` | Modos em destaque | Em cartaz |
| `home.modesLink` | Todos os modos | Todos os modos em cartaz |
| `home.howTitle` | Como funciona | Do site à partida em três passos |
| `home.steps[0].title` | Escolha um lobby | manter |
| `home.steps[0].body` | Filtre por modo, região e vagas. Dá para ver tudo antes de instalar. | Filtre por modo, região e ping, e veja onde seus amigos estão. Tudo isso antes de instalar qualquer coisa. |
| `home.steps[1].title` | Instale o app uma vez | manter |
| `home.steps[1].body` | 12,4 MB, código aberto e hash publicado. Se o antivírus reclamar, o passo a passo está na página de instalação. | 12,4 MB e grátis. Publicamos a impressão digital (hash) do arquivo para você conferir. Se o antivírus estranhar, o que é comum com programa novo, o passo a passo está na página de instalação. |
| `home.steps[2].title` | Clique em Entrar | manter |
| `home.steps[2].body` | O app abre o Deadlock já no modo certo e conecta você ao lobby. | O app baixa o modo se precisar, abre o Deadlock e coloca você no lobby. |
| `home.stepsInstallLink` | Ver o que o app instala | manter (no hero e no passo 2) |

Observação: o `home.lead` cita três modos. Se o catálogo mudar, o texto precisa mudar junto. Alternativa: gerar a frase a partir dos `tagline` curtos dos modos em destaque.

### lobbies

| Chave | Atual | Proposto |
| --- | --- | --- |
| `lobbies.title` | Lobbies | manter |
| `lobbies.lead` | Partidas abertas agora. Entre direto ou crie a sua. | Quem está jogando agora. Entre numa partida ou abra a sua. |
| `lobbies.search` | Buscar lobby ou anfitrião | manter |
| `lobbies.searchPlaceholder` | Nome do lobby ou anfitrião | Ex.: Círculo da madrugada, k0rvo |
| `lobbies.slotsOnly` | Só com vagas livres | Só com vaga |
| `lobbies.friendsOnly` | Só lobbies com amigos | Só onde tem amigo |
| `lobbies.friendsNeedSignIn` | Entre com Steam para ver onde seus amigos estão. | Entre com a Steam para ver onde seus amigos estão jogando. |
| `lobbies.sortOptions.recomendados` | Recomendados | manter + **novo** `sortHint`: "Amigos primeiro, depois ping baixo e lobbies quase cheios." |
| demais `sortOptions` | Menor ping, Mais vagas, Mais cheios, Mais recentes | manter |
| `lobbies.filters` / `filtersActive` / `clear` / `results` | — | manter |
| `lobbies.create` | Criar lobby | manter |
| `lobbies.join` | Entrar | manter |
| `lobbies.joinLabel(name)` | Entrar em {name} | manter |
| `lobbies.joining` | Conectando… | Trocar por etapas reais (**novo** `joinSteps`): "Baixando o modo…" → "Abrindo o Deadlock…" → "Entrando no lobby…" |
| `lobbies.notifySlot` | Avisar vaga | Avisar quando vagar |
| `lobbies.notifyEnd` | Avisar no fim | Avisar quando acabar |
| `lobbies.notifyOn` | Aviso ligado | manter |
| `lobbies.host` / `you` / `friendTag` | — | manter |
| `lobbies.slots(...)` | {t} de {n} vagas ocupadas, {f} amigos | manter (rótulo acessível) |
| **novo** `lobbies.almostFull(n)` | — | "Falta 1" / "Faltam {n}" (só quando faltam até 2 vagas; urgência vinda do dado) |
| `lobbies.startedAgo` | agora / há N min | aberto agora / aberto há N min |
| `lobbies.status.*` | Aberto, Em partida, Cheio | manter |
| `lobbies.joinInProgress` | aceita entrada no meio | dá para entrar no meio |
| `lobbies.locked` | Com senha | manter |
| `lobbies.emptyNoneTitle` | Nenhum lobby aberto agora | A cidade está quieta agora |
| `lobbies.emptyBody` → renomear `emptyNoneBody` | No Brasil, o movimento costuma ser maior entre 19h e 23h. Enquanto isso, você pode abrir o seu lobby ou treinar contra bots. | Nenhum lobby aberto no momento. No Brasil, o movimento costuma ser maior entre 19h e 23h. Acenda a primeira janela: abra um lobby, treine contra bots ou peça um aviso. |
| `lobbies.emptyFilteredTitle` | Nenhum lobby com esses filtros | Nada com esses filtros |
| **novo** `lobbies.emptyFilteredBody` | — | Tem lobby aberto, só não com essa combinação. Tire um filtro ou abra um lobby do jeito que você procurava. |
| **novo** `lobbies.emptyFilteredClear` | — | Limpar filtros (botão principal no vazio filtrado) |
| `lobbies.emptyCreate` | Criar lobby | manter |
| `lobbies.emptyBots` | Jogar com bots | Treinar com bots |
| `lobbies.emptyNotify` | Me avise | Avisar quando abrir |
| `lobbies.emptyNotifyOn` | Vamos avisar | Aviso ligado |
| `lobbies.emptyNotifyToast` | Pronto. Você recebe um aviso quando abrir um lobby assim. | Combinado. Quando abrir um lobby assim, a gente avisa {canal}. (`canal` = "por notificação do navegador" ou "pelo app", conforme o produto decidir; não publicar sem isso) |
| `lobbies.botsToast` | O app vai abrir uma partida local com bots. | Abrindo o Campo de Treino com bots, só para você. |
| `lobbies.notifyToast(name)` | Aviso ligado para "{name}". | Aviso ligado. Você fica sabendo quando vagar em "{name}". |

### join (diálogo "Falta só o app")

| Chave | Atual | Proposto |
| --- | --- | --- |
| `join.title` | Falta só o app | manter |
| `join.body(lobby)` | Para entrar em "{lobby}", o app PROJETO precisa estar aberto no seu PC. Ele abre o Deadlock e conecta você ao lobby. | "{lobby}" está esperando. Para entrar, o app PROJETO precisa estar aberto no seu PC: ele abre o Deadlock e coloca você direto no lobby. |
| `join.haveApp` | Já tenho o app | manter |
| `join.openApp` | Abrir o app | manter |
| `join.noApp` | Ainda não tenho | manter |
| `join.install` | Instalar (12,4 MB) | Instalar grátis (12,4 MB) |
| `join.trust` | Código aberto · Hash SHA-256 publicado · Ajuda para antivírus na própria página | Grátis · Hash publicado para conferir o arquivo · Ajuda se o antivírus reclamar · (incluir "Código aberto" só quando o link estiver público) |
| `join.cancel` | Agora não | manter |
| `join.joiningToast(lobby)` | Abrindo o Deadlock. Você entra em "{lobby}" em instantes. | Abrindo o Deadlock. Sua janela em "{lobby}" acende em instantes. |
| `join.botsTitle` | Jogar com bots | Treinar com bots |
| **novo** `join.errorNoApp` | — | Não encontramos o app aberto. Abra o PROJETO no seu PC e tente de novo. Se ele não abriu, [veja a ajuda de instalação]. |
| **novo** `join.errorFull` | — | Esse lobby encheu enquanto você clicava. Quer um aviso quando vagar, ou prefere ver outro do mesmo modo? |
| **novo** `join.errorGame` | — | O app não encontrou o Deadlock. Ele precisa estar instalado pela Steam neste PC. |

### host (diálogo "Criar lobby")

| Chave | Atual | Proposto |
| --- | --- | --- |
| `host.title` | Criar lobby | manter |
| `host.needSignIn` | Para hospedar, entre com sua conta Steam. Assim os jogadores sabem quem é o anfitrião. | Para criar um lobby, entre com a Steam. Assim os jogadores sabem quem está recebendo. |
| `host.name` | Nome do lobby | manter |
| `host.namePlaceholder(user)` | Lobby de {user} | manter + **novo** `host.nameHint`: "Ex.: Círculo da madrugada, Neblina para iniciantes, x1 sem choro" |
| `host.mode` / `region` / `slots` | — | manter |
| `host.private` | Lobby privado (só entra com convite) | manter |
| `host.submit` | Criar lobby | Abrir lobby |
| `host.cancel` | Cancelar | manter |
| `host.createdToast(name)` | Lobby "{name}" criado. Ele aparece no topo da lista. | "{name}" está aberto. Sua janela é a primeira da lista. |

### modes

| Chave | Atual | Proposto |
| --- | --- | --- |
| `modes.title` | Modos | Modos em cartaz |
| `modes.lead` | Cada modo é feito por alguém da comunidade e roda dentro do Deadlock. | Feitos por jogadores (e um campo de treino nosso), rodando dentro do próprio Deadlock. Todos grátis. |
| `modes.playersNow` | jogando agora | manter |
| `modes.openLobbies(n)` | — | manter |
| `modes.view(name)` | Ver {name} | manter |
| `modes.by` | Criado por | Criado por (manter) |
| `modes.facts.*` | Jogadores agora, Lobbies abertos, Formato, Duração média, Atualizado em | manter |
| `modes.durationValue(0)` | Sem limite | Sem relógio |
| `modes.joinLobby` | Entrar em lobby | manter |
| `modes.joinHint(n)` | Entra no único lobby aberto / Entra no melhor de N lobbies abertos | Entra no único lobby aberto / Entra no lobby com mais amigos e menor ping, entre {n} abertos |
| `modes.noLobbies` | Nenhum lobby aberto neste modo. Crie um e os jogadores chegam. | Nenhum lobby aberto neste modo agora. Abra o primeiro: ele aparece no topo da lista. |
| `modes.host` | Criar lobby | manter |
| `modes.seeLobbies` | Ver lobbies deste modo | manter |
| `modes.about` | Sobre o modo | manter |
| `modes.rules` | Regras | manter |
| `modes.leaderboard` | Ranking da temporada | manter |
| `modes.changelog` | Mudanças recentes | manter |
| `modes.changelogLink` | Todas as notas deste modo | manter |
| `modes.changelogEmpty` | Sem mudanças nas últimas versões. | Nada mudou nas últimas versões. Em time que está ganhando… |
| `modes.others` | Outros modos | Também em cartaz |
| `modes.notFoundTitle` | Modo não encontrado | Esse modo saiu de cartaz |
| `modes.notFoundBody` | Esse modo pode ter sido renomeado ou removido. | Ele pode ter sido renomeado ou retirado. Os modos em cartaz estão aqui. |

### install

Regra: aqui a voz fica quase toda de fora. Mudanças só para clareza e para os fatos que faltam.

| Chave | Atual | Proposto |
| --- | --- | --- |
| `install.title` | Instalar o app | manter |
| `install.lead` | O app é um programa pequeno que abre o Deadlock com o modo escolhido. Antes de baixar, veja o que ele instala, onde, e como confirmar que o arquivo é o original. | Antes de baixar, veja exatamente o que entra no seu PC. O app é grátis, tem 12,4 MB e faz uma coisa: abrir o Deadlock com o modo escolhido. Abaixo estão o que ele instala e onde, como conferir se o arquivo é o original e o que fazer se o antivírus reclamar. |
| `install.download(file)` | Baixar {file} | manter |
| `install.version` / `size` / `date` | — | manter |
| `install.requirements` | Windows 10 ou 11 (64 bits) e Deadlock instalado pela Steam. Não precisa de permissão de administrador. | manter |
| `install.mobileNote` | No celular? O app é para Windows. Abra esta página no PC para baixar. | manter |
| `install.hashTitle` | SHA-256 do instalador | Impressão digital do instalador (SHA-256) |
| `install.hashHelp` | Compare com o hash do arquivo baixado. Se for diferente, não execute. | Compare com o hash do arquivo que você baixou. Se for diferente, não execute: o arquivo não é o que publicamos. |
| `install.copy*` | — | manter |
| `install.source` | Ver o código-fonte | manter |
| `install.sourceNote` | link público em breve | manter (e remover "código aberto" dos selos até lá) |
| `install.statusWaiting` | Aguardando o app… | manter |
| `install.statusWaitingHelp` | Depois de instalar, abra o app. Esta página detecta sozinha quando ele estiver rodando. | manter |
| `install.statusConnected(v)` | App conectado (versão {v}) | manter |
| `install.statusConnectedHelp` | Tudo certo. Agora é só escolher um lobby e clicar em Entrar. | Tudo certo, sua janela está acesa. Agora é só escolher um lobby e clicar em Entrar. |
| `install.goLobbies` | Escolher um lobby | manter |
| **novo** `install.statusTimeout` | — | Ainda não encontramos o app. Ele está aberto? Se o antivírus bloqueou a instalação, o passo a passo está logo abaixo. |
| `install.avTitle` | Se o antivírus bloquear | manter |
| `install.avWhy` | Programas novos e pouco baixados às vezes são marcados por heurística, mesmo sem nada de errado. Antes de liberar, confira o hash: se bater com o publicado aqui, o arquivo é o original. | Antivírus costumam desconfiar de programas novos e pouco baixados, mesmo sem nada de errado: é um alarme por suspeita (heurística), não uma ameaça confirmada. Antes de liberar, confira o hash: se bater com o publicado aqui, o arquivo é exatamente o que publicamos. |
| `install.avVerify` / `avTabs` | — | manter |
| `install.whatTitle` / `doesTitle` / `doesntTitle` / `uninstallTitle` / `uninstallBody` | — | manter |
| **novo** `install.affiliation` | — | O PROJETO é um projeto independente da comunidade, sem afiliação com a Valve. A Valve não revisa nem aprova este app. (repetir aqui, não só no rodapé) |
| **novo** `install.riskTitle` | — | Anti-cheat e risco de banimento: **texto a escrever por quem conhece o funcionamento real do app. Não publicar sem ele.** |

### news

| Chave | Atual | Proposto |
| --- | --- | --- |
| `news.title` | Novidades | manter |
| `news.lead` | O que mudou em cada versão, com um resumo no topo. | O que mudou na cidade, versão por versão. Comece pelo resumo; os detalhes estão logo abaixo. |
| `news.search` | Buscar nas notas | manter |
| `news.searchPlaceholder` | Ex.: cooldown, crash, mapa | manter |
| `news.platform` | Plataforma (app e site) | manter |
| `news.categories` | Tipo de mudança | manter |
| `news.tldr` | Em resumo: | manter |
| `news.showMore` / `showLess` / `affects` / `count` | — | manter |
| `news.emptyTitle` | Nada encontrado | Nenhuma nota com esses filtros |
| `news.emptyBody` | Nenhuma nota corresponde a esses filtros. | Tente outra palavra ou tire um filtro. |
| `news.clear` | Limpar filtros | manter |

### categories / regions / common

Manter. São rótulos de sistema.

### notFound

| Chave | Atual | Proposto |
| --- | --- | --- |
| `notFound.title` | Página não encontrada | Essa rua não está no mapa |
| `notFound.body` | O endereço pode estar errado ou a página mudou de lugar. | O endereço pode estar errado ou a página mudou de lugar. A cidade continua aqui. |
| `notFound.back` | Voltar ao início | manter |
| `notFound.lobbies` | Ver lobbies abertos | manter |

### Conteúdo de exemplo (src/data)

**Taglines dos modos.** Todas conferidas contra as regras de `modes.ts`.

| Modo | Atual | Proposto |
| --- | --- | --- |
| Círculo Profano | Todos contra todos dentro de um círculo que encolhe a cada minuto. | Até doze num anel ritual que fecha a cada minuto. Do lado de fora, ninguém dura. |
| Último Bonde | Escolte o bonde até o fim da linha antes da meia-noite. | manter. Já é a melhor do site. |
| Neblina | Esconde-esconde com névoa densa e um caçador por rodada. | Doze metros de visão, um caçador e três minutos para não ser pego. |
| Duelo à Meia-Noite | Um contra um, melhor de cinco, mesmo herói para os dois. | x1, mesmo herói, melhor de cinco. Perdeu, volta para a fila. |
| Cerco ao Cofre | Arrombe o cofre do banco ou defenda até o reforço chegar. | Três trancas, dois minutos cada. Arrombe o cofre ou segure a porta. |
| Campo de Treino | Sandbox com bots, recarga instantânea e alvos configuráveis. | Todos os itens liberados, bots no seu ritmo e nenhum placar olhando. |

Atenção: a tagline atual do Cerco fala em "até o reforço chegar", mas as regras não têm reforço (é tempo por tranca). A proposta corrige.

**Nomes de lobby de exemplo** (substituir os mais neutros, como "Círculo casual", "Rodada rápida", "Treino de duelo"):
- "Madrugada no Círculo"
- "x1 até o sol nascer" (Duelo)
- "Bonde das 23h" (Último Bonde)
- "Neblina sem lanterna, iniciantes ok"
- "Cofre com call, sem flame"
- "Testando build de arma" (manter, é ótimo e realista)
- Lobbies NA/EU continuam em inglês: é realista e mostra que a lista é internacional.

**Notas de versão.** Fato primeiro, uma frase de cor no máximo, só em correção e balanceamento:
- 0.9.2, correção, Último Bonde: "O bonde não trava mais na curva da segunda estação. Ele pede desculpas pelo atraso."
- 0.9.3, correção, Cerco ao Cofre: "Defensores não renascem mais dentro da sala do cofre depois da terceira tranca. Era bug, não estratégia."
- 0.9.2, correção, plataforma: "O ping da região BR/SA agora mede até o servidor de São Paulo, e não até Miami. Se o seu número parecia alto demais, era isso."
- 0.9.3, TL;DR (correção de fato, ver seção 1): "Atacantes do Cofre ganharam 15 segundos por tranca, o Círculo dá mais tempo no fechamento final e entrar em lobby com o Deadlock já aberto ficou cerca de 40% mais rápido."

---

## 4. Microinterações de texto

| Ideia | Como funciona | Custo | Risco |
| --- | --- | --- | --- |
| **Legenda das janelas** no painel ao vivo: "Cada janela acesa é um jogador. As verdes são seus amigos." | Linha fixa sob "Enchendo agora". | Baixo | Nenhum. É a ideia de maior retorno: dá voz e explica a codificação visual. |
| **Saudação pelo horário** no painel: "Madrugada na cidade · 1.284 jogando agora" (00h–5h59), "Manhã…", "Tarde…", "Noite na cidade…" | Hora local do navegador, 4 faixas. | Baixo | Baixo. Não pôr em `aria-live`; calcular uma vez ao carregar. |
| **Saudação no login**: "Boa noite, k0rvo." | Mesmo cálculo de horário. | Baixo | Nenhum. |
| **"Falta 1" / "Faltam 2"** em lobbies quase cheios | Derivado de `players/slots`. | Baixo | Baixo. É urgência real; nunca mostrar sem o dado. |
| **Etapas reais ao entrar**: "Baixando o modo… → Abrindo o Deadlock… → Entrando no lobby…" | Uma etapa por evento vindo do app. | Médio (depende do app reportar) | Baixo. Nunca simular progresso que não existe. |
| **Empty state com horário**: de madrugada, "A cidade dorme. O pico no Brasil costuma ser entre 19h e 23h."; entre 19h e 23h, "Horário de pico e nenhum lobby? Abra o primeiro, alguém já deve estar procurando." | Variante por faixa de horário. | Baixo | Médio. O "19h–23h" precisa vir de dado real antes de ir ao ar; sem dado, usar só a versão neutra. |
| **404 "Essa rua não está no mapa"** | Texto fixo. | Baixo | Nenhum. |
| **Placeholder rotativo** no nome do lobby ("Ex.: Bonde das 23h", "Ex.: Neblina sem lanterna") | Sorteia um a cada abertura do diálogo. | Baixo | Baixo. O placeholder é só exemplo; o rótulo fixo continua. |
| **Contadores como história** ("1.284 janelas acesas na cidade") | Troca o rótulo do número. | Baixo | **Médio.** Atrapalha a leitura rápida. Melhor manter "jogando agora" e deixar a frase só na legenda ou no `title`. |
| **Tagline rotativa no hero** | Alterna frases no título. | Médio | **Alto.** Prejudica compreensão, leitor de tela, `prefers-reduced-motion` e layout. Não recomendo. Se quiser variar, varie o kicker do painel, não o h1. |
| **Easter egg na busca**: buscar "meia-noite" destaca o Duelo e o Bonde com a janela piscando uma vez | Regra na busca. | Médio | Baixo/médio. Divertido para quem descobre, mas precisa respeitar reduced-motion. Prioridade baixa. |
| **Easter egg no rodapé**: clicar 5x na torre acende todas as janelas do logo por 2 s | Estado local. | Médio | Baixo. Puro charme, zero informação; deixar para depois do lançamento. |
| **Primeira conexão do app**: "Tudo certo, sua janela está acesa." | Já existe o estado; só muda o texto. | Baixo | Nenhum. Fecha o ciclo da metáfora no momento de maior alívio (pico-final). |

Prioridade sugerida: legenda das janelas → saudação por horário → "Falta 1" → etapas reais de entrada → 404 → resto.

---

## 5. Checklist de honestidade

| Verificação | Situação nas propostas |
| --- | --- |
| "Grátis" aparece e é verdade | Sim: hero (eyebrow), passo 2, diálogo de instalar, página de instalação, rodapé. Fato dado pelo time. |
| "Não afiliado à Valve" visível | Mantido no rodapé e **repetido** na página de instalação (`install.affiliation`), onde a pessoa decide baixar. |
| O que o app instala | Lista e caminhos mantidos sem mudança; `install.lead` aponta para eles. |
| Falso positivo de antivírus | Dito antes do download, na home (passo 2), no diálogo ("Ajuda se o antivírus reclamar") e na instalação, agora explicando que é "alarme por suspeita, não ameaça confirmada". Nenhuma linha diz "o app é 100% seguro". |
| Hash | Explicado como "impressão digital do arquivo", sem prometer mais do que prova: o arquivo é o que publicamos. |
| Código aberto | Proposta **retira** o selo até o link estar público, ou marca "(em breve)". |
| Risco de banimento / anti-cheat | Nenhuma linha afirma que não há risco. A seção fica reservada e marcada "não publicar sem texto de quem conhece o app". |
| Promessas de comportamento | "Crie um e os jogadores chegam" e "Jogar agora" foram removidos. O TL;DR do 0.9.3 foi corrigido ("cerca de 40%", "entrar em lobby com o Deadlock já aberto"). A tagline do Cofre deixou de citar um "reforço" que não existe nas regras. |
| Urgência | Só "Falta 1/Faltam 2", calculado do dado real. Nenhum "corra", "últimas vagas" ou contagem regressiva. |
| Avisos | O texto não diz mais "você recebe um aviso" sem dizer por onde: o canal (`{canal}`) tem de ser definido antes de publicar. |
| Horário de pico "19h–23h" | É dado de exemplo. Validar com números reais antes do lançamento ou trocar por texto sem horário. |
| Lore | Metáforas (janela, cidade, cartaz, rua) são do próprio site, não da Valve. Nenhuma imita texto oficial do Deadlock. |
| Números | Nenhum número novo foi inventado. Os "15 segundos" vêm da nota 0.9.3 (1min45 → 2min) e os "12 metros / três minutos / doze jogadores" vêm das regras. |
