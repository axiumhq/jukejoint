/**
 * Textos do site dentro do app desktop (lib/desktop.ts). Como os de live.ts, ficam fora de
 * pt-BR.ts. As mensagens de erro do motor vêm prontas do app (Rust): aqui só o que o site diz.
 */
export const desktop = {
  checking: 'Conferindo o app…',
  ready: 'O app está pronto. Quando a partida começar, ele abre o Deadlock e coloca você no lobby.',
  problemsTitle: (n: number) => (n === 1 ? 'O app precisa de um ajuste antes da partida' : `O app precisa de ${n} ajustes antes da partida`),
  problemsHint: 'Dá para entrar na sala agora e resolver isso na tela Instalação antes de a partida começar.',
  checkFailed: 'Não deu para conferir o app agora.',
  details: 'Detalhes técnicos',
  openInstall: 'Abrir a tela Instalação',
  recheck: 'Checar de novo',
  enterAnyway: 'Entrar mesmo assim',
  /** Enquanto não há modos de verdade, todo modo abre o projeto de teste (desktop/src-tauri/src/engine/catalog.rs). */
  testMode: (project: string) => `Modo de teste: por enquanto o app abre o projeto "${project}" no lugar do modo escolhido.`,
  testTag: 'modo de teste',
  invalidLink: 'Esse link de convite não abriu: ele não está no formato certo. Peça o link de novo para quem convidou você.',
  invalidLoginLink: 'O login não terminou: a volta do navegador chegou incompleta. Clique em Login e tente de novo.',
  retry: 'Tentar de novo',
  endMatch: 'Encerrar a partida',
  endMatchLabel: (lobby: string) => `Encerrar a partida de "${lobby}" e reabrir a sala`,
  failedHost: 'O app não conseguiu abrir a partida no seu PC.',
  failedJoin: 'O app não conseguiu colocar você na partida.',
  hostEnded: 'A partida no seu PC terminou. A sala voltou a ficar aberta.',
  statusInApp: (v: string) => (v ? `Você está no app (versão ${v})` : 'Você está no app'),
  statusInAppHelp: 'Este site está aberto dentro do app. O motor, o serviço e o antivírus ficam na tela Instalação.',
};
