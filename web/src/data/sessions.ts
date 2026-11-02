import type { Region } from './modes';

/**
 * Sessões do dia: lobbies que a casa abre em horário fixo, todo dia, para concentrar gente
 * quando a cidade está quieta. Horário de Brasília. `going` é dado de exemplo (quem marcou
 * presença), a validar com números reais antes de publicar.
 */
export interface DaySession {
  id: string;
  modeSlug: string;
  /** "HH:MM", horário de Brasília. */
  time: string;
  region: Region;
  going: number;
}

export const daySessions: DaySession[] = [
  { id: 's-treino', modeSlug: 'campo-de-treino', time: '19:30', region: 'BR', going: 6 },
  { id: 's-cofre', modeSlug: 'cerco-ao-cofre', time: '21:00', region: 'BR', going: 14 },
  { id: 's-neblina', modeSlug: 'neblina', time: '22:00', region: 'BR', going: 9 },
  { id: 's-bonde', modeSlug: 'ultimo-bonde', time: '23:00', region: 'BR', going: 17 },
  { id: 's-circulo', modeSlug: 'circulo-profano', time: '23:30', region: 'BR', going: 21 },
  { id: 's-duelo', modeSlug: 'duelo-meia-noite', time: '00:00', region: 'BR', going: 8 },
];
