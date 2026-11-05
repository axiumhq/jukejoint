export const enModosHome = {
  title: 'Modes',
  sub: 'Pick one and open the first lobby of the night.',
  rituals: 'the six rituals of the house',
  filterHint: 'Filter the lobbies by this mode.',
  none: 'No lobbies right now',
  lobbies: (n: number) => (n === 1 ? '1 lobby' : `${n} lobbies`),
  playing: (n: number) => `${n} playing`,
  filterLabel: (name: string) => `${name}: filter the lobbies`,
  openLabel: (name: string) => `${name}: open a lobby`,
  meta: (format: string, min: number, max: number) => `${format} · ${min === max ? max : `${min} to ${max}`} players`,
};
