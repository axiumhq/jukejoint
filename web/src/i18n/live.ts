/**
 * Textos do modo ao vivo (API real, `VITE_API_URL`). Ficam fora de pt-BR.ts para não disputar o
 * arquivo com o trabalho visual. Sobre outras pessoas, sempre neutro ("confirmaram", "quem abriu").
 */
export const live = {
  connecting: 'Conectando ao servidor…',
  offline: 'Sem conexão com o servidor. Tentando de novo…',
  offlineError: 'Sem conexão com o servidor agora. Tente de novo em instantes.',
  timeoutError: 'O servidor demorou para responder. Tente de novo.',
  steamNote: 'Você entra pela página da Steam. A senha fica com a Steam; aqui chegam só o seu ID e o nome público.',
  devNote: 'Conta de teste, só para desenvolvimento.',
  devSignIn: 'Entrar como teste (dev)',
  signedInToast: (name: string) => `Você entrou como ${name}.`,
  signInToJoin: 'Entre com a Steam para entrar num lobby.',
  loginFailed: 'Não deu para entrar com a Steam. Tente de novo.',
  callNeedsLobby: 'Abra ou entre num lobby para chamar alguém.',
  calledToast: (name: string) => `Convite enviado para ${name}.`,
  inviteToast: (from: string, lobby: string) => `${from} chamou você para "${lobby}".`,
  kickedToast: (lobby: string) => `Quem abriu "${lobby}" tirou você da sala.`,
  closedByHost: (lobby: string) => `"${lobby}" foi fechado por quem abriu.`,
  knockDeclined: (lobby: string) => `A porta de "${lobby}" não abriu desta vez.`,
  knocksTitle: 'Batendo na porta',
  knockAccept: 'Abrir',
  knockDecline: 'Recusar',
  knockAcceptLabel: (name: string) => `Abrir a porta para ${name}`,
  knockDeclineLabel: (name: string) => `Recusar o pedido de ${name}`,
  kick: 'Remover',
  kickLabel: (name: string) => `Tirar ${name} da sala`,
  kickedOther: (name: string) => `${name} não está mais na sala.`,
  hiddenSeat: 'Vaga ocupada',
  hostCountdown: (s: number) => `A partida começa em ${s} s. Ainda dá para cancelar.`,
  pingNote: 'Ping estimado pela região até o app medir.',
  friendsNote: 'Amigos da Steam online aqui. Lista privada na Steam aparece vazia.',
};
