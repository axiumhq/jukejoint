export type ChangeCategory = 'novo' | 'correcao' | 'balanceamento';
/** Slug de um modo, ou 'plataforma' para o app e o site. */
export type ChangeScope = string;

export interface Change {
  category: ChangeCategory;
  scope: ChangeScope;
  text: string;
}

export interface Release {
  version: string;
  date: string;
  tldr: string;
  changes: Change[];
}

export const PLATFORM_SCOPE = 'plataforma';

export const releases: Release[] = [
  {
    version: '0.9.3',
    date: '2026-10-28',
    tldr: 'Cerco ao Cofre ficou mais justo para quem ataca, o Círculo Profano fecha mais devagar no fim e o app abre o Deadlock 40% mais rápido.',
    changes: [
      { category: 'balanceamento', scope: 'cerco-ao-cofre', text: 'Tempo por tranca aumentado de 1min45 para 2min.' },
      { category: 'balanceamento', scope: 'cerco-ao-cofre', text: 'Defensores perdem 10% de vida máxima por tranca aberta (antes 6%).' },
      { category: 'balanceamento', scope: 'circulo-profano', text: 'O último fechamento do círculo agora leva 90 segundos em vez de 60.' },
      { category: 'novo', scope: 'plataforma', text: 'O app reaproveita o processo do Deadlock já aberto. A entrada em lobby ficou cerca de 40% mais rápida.' },
      { category: 'novo', scope: 'circulo-profano', text: 'Placar ao vivo mostra quem está fora do círculo.' },
      { category: 'correcao', scope: 'cerco-ao-cofre', text: 'Defensores não renascem mais dentro da sala do cofre depois da terceira tranca.' },
      { category: 'correcao', scope: 'plataforma', text: 'Corrigido o aviso "lobby cheio" aparecendo em lobbies com vaga.' },
      { category: 'correcao', scope: 'plataforma', text: 'O instalador não pede mais para fechar a Steam.' },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-10-14',
    tldr: 'Último Bonde ganhou uma segunda linha de trilhos e o Campo de Treino aceita comandos de chat para configurar bots.',
    changes: [
      { category: 'novo', scope: 'ultimo-bonde', text: 'Nova rota: Linha do Porto, com três estações e uma ponte levadiça.' },
      { category: 'novo', scope: 'campo-de-treino', text: 'Comandos !bots, !cooldown e !vida no chat do lobby.' },
      { category: 'balanceamento', scope: 'ultimo-bonde', text: 'Raio de escolta reduzido de 10 para 8 metros.' },
      { category: 'correcao', scope: 'ultimo-bonde', text: 'O bonde não trava mais na curva da segunda estação.' },
      { category: 'correcao', scope: 'plataforma', text: 'Ping da região BR/SA agora mede até o servidor de São Paulo, não até Miami.' },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-10-02',
    tldr: 'Neblina saiu do beta. Também corrigimos o crash ao entrar num lobby logo depois de atualizar o Deadlock.',
    changes: [
      { category: 'novo', scope: 'neblina', text: 'Neblina saiu do beta e entrou na lista de modos em destaque.' },
      { category: 'balanceamento', scope: 'neblina', text: 'Pulso de passos no mapa do caçador a cada 20 segundos (antes 15).' },
      { category: 'balanceamento', scope: 'neblina', text: 'Visão na névoa aumentada de 10 para 12 metros.' },
      { category: 'correcao', scope: 'plataforma', text: 'Crash ao entrar em lobby logo após uma atualização do Deadlock.' },
      { category: 'correcao', scope: 'neblina', text: 'Jogadores pegos não mantêm mais a cor do time anterior.' },
      { category: 'correcao', scope: 'plataforma', text: 'Nomes com acento aparecem corretamente na lista de lobbies.' },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-09-21',
    tldr: 'Filtros por região e "só amigos" na lista de lobbies, além de um novo modo de duelo 1 contra 1.',
    changes: [
      { category: 'novo', scope: 'plataforma', text: 'Filtros de região, vagas livres e só amigos na lista de lobbies.' },
      { category: 'novo', scope: 'duelo-meia-noite', text: 'Novo modo: Duelo à Meia-Noite, melhor de cinco com fila de espera.' },
      { category: 'novo', scope: 'plataforma', text: 'Aviso por notificação quando abrir vaga num lobby cheio.' },
      { category: 'balanceamento', scope: 'circulo-profano', text: 'Itens de abate agora são do mesmo nível para todos os jogadores.' },
      { category: 'correcao', scope: 'plataforma', text: 'O app não fica mais aberto em segundo plano depois de fechar o jogo.' },
    ],
  },
  {
    version: '0.8.4',
    date: '2026-08-30',
    tldr: 'Versão de correções: estabilidade do app no Windows 10 e ajustes de som no Cerco ao Cofre.',
    changes: [
      { category: 'correcao', scope: 'plataforma', text: 'App fechava ao minimizar no Windows 10 21H2.' },
      { category: 'correcao', scope: 'cerco-ao-cofre', text: 'Som do alarme do cofre tocava duas vezes.' },
      { category: 'correcao', scope: 'plataforma', text: 'Ícone da bandeja não sumia depois de sair.' },
    ],
  },
  {
    version: '0.8.0',
    date: '2025-12-12',
    tldr: 'Primeira versão pública: Círculo Profano, Último Bonde e Cerco ao Cofre, com lobbies em BR/SA, NA e EU.',
    changes: [
      { category: 'novo', scope: 'plataforma', text: 'Lista de lobbies com entrada em um clique.' },
      { category: 'novo', scope: 'circulo-profano', text: 'Lançamento do Círculo Profano.' },
      { category: 'novo', scope: 'ultimo-bonde', text: 'Lançamento do Último Bonde.' },
      { category: 'novo', scope: 'cerco-ao-cofre', text: 'Lançamento do Cerco ao Cofre.' },
    ],
  },
];
