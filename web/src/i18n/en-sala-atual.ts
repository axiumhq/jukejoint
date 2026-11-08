export const enSalaAtual = {
  inOther: (name: string) => `You are in “${name}”. Opening this lobby takes you out of there and frees your seat.`,
  inMine: (name: string) => `Your lobby “${name}” is open. Opening this one closes it, and everyone in it has to find another.`,
  submit: 'Leave and open lobby',
};
