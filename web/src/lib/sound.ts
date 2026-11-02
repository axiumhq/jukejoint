import { useSyncExternalStore } from 'react';

/**
 * Som de interface sintetizado na hora (WebAudio), sem baixar nenhum arquivo.
 * Desligado por padrão. O AudioContext só nasce depois do gesto de ligar, como exige
 * o navegador. A escolha fica salva; se ficou "ligado", o contexto acorda no primeiro toque.
 *
 *  - click: interruptor de baquelite (botões, alternâncias)
 *  - plim:  uma janela acendendo quando alguém entra (no máximo um a cada 1,2 s)
 *  - ding:  campainha de elevador ao chegar numa parada
 */

const KEY = 'projeto-som';
type Cue = 'click' | 'plim' | 'ding';

let on = false;
try {
  on = localStorage.getItem(KEY) === '1';
} catch {
  /* armazenamento indisponível */
}
let ctx: AudioContext | null = null;
let lastPlim = 0;
const listeners = new Set<() => void>();

function ensure(): AudioContext | null {
  if (!on) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ac.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noiseTick(ac: AudioContext, start: number) {
  const len = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
  const src = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  f.Q.value = 1.4;
  g.gain.value = 0.22;
  src.buffer = buf;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(start);
}

export function play(cue: Cue) {
  const ac = ensure();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  if (cue === 'click') {
    noiseTick(ac, t);
    tone(ac, 180, t, 0.05, 0.05, 'triangle');
  } else if (cue === 'plim') {
    const now = performance.now();
    if (now - lastPlim < 1200) return;
    lastPlim = now;
    tone(ac, 1318.5, t, 0.5, 0.035);
    tone(ac, 1975.5, t + 0.012, 0.35, 0.015);
  } else {
    tone(ac, 1046.5, t, 1.1, 0.06);
    tone(ac, 1568, t, 0.9, 0.025);
    tone(ac, 2093, t + 0.004, 0.5, 0.012);
  }
}

export function setSound(next: boolean) {
  on = next;
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    /* ignora */
  }
  if (next) play('click');
  else void ctx?.suspend();
  listeners.forEach((l) => l());
}

export function useSoundOn() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
    () => false,
  );
}
