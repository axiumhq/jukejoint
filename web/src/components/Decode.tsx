import { useEffect, useRef } from 'react';

/**
 * Texto que se decifra: as letras passam por glifos de cifra antes de assentar.
 * Só em fonte mono (Martian Mono), então trocar letra não muda a largura nem o layout.
 *
 *  - O texto final fica num irmão visualmente oculto (leitor de tela lê só ele).
 *  - Roda uma vez quando entra na tela (`on="view"`) ou ao montar (`on="mount"`);
 *    com `replay`, roda de novo quando o texto muda (ex.: nome da cena no HUD).
 *  - Escreve direto no DOM a cada quadro: nenhum re-render do React.
 *  - prefers-reduced-motion: aparece pronto.
 */

const GLYPHS = '§¤¶±×÷°¬#%&*+=/<>|';
const DURATION = 460;

interface DecodeProps {
  text: string;
  className?: string;
  on?: 'mount' | 'view';
  replay?: boolean;
  delay?: number;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Decode({ text, className, on = 'view', replay = false, delay = 0 }: DecodeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || (played.current && !replay)) {
      el.textContent = text;
      return;
    }
    let raf = 0;
    let timer = 0;
    let io: IntersectionObserver | null = null;

    const run = () => {
      played.current = true;
      const start = performance.now() + delay;
      const chars = [...text];
      const frame = (now: number) => {
        const p = Math.min(1, Math.max(0, (now - start) / DURATION));
        const settled = Math.floor(p * chars.length);
        let out = '';
        for (let i = 0; i < chars.length; i++) {
          const c = chars[i]!;
          if (i < settled || c === ' ' || c === ',' || c === '.') out += c;
          else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) raf = requestAnimationFrame(frame);
        else el.textContent = text;
      };
      raf = requestAnimationFrame(frame);
    };

    // Antes de decifrar, mostra a cifra (mesma largura), nunca o espaço vazio.
    el.textContent = [...text].map((c) => (c === ' ' ? c : '·')).join('');
    if (on === 'mount') {
      run();
    } else {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io?.disconnect();
            run();
          }
        },
        { threshold: 0.6 },
      );
      io.observe(el);
      // Se o elemento nunca entrar na tela (ex.: aba em segundo plano), não fica cifrado.
      timer = window.setTimeout(() => {
        if (!played.current) el.textContent = text;
      }, 4000);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      io?.disconnect();
      // Interrompido no meio (desmontou ou o texto mudou): assenta no texto final.
      if (el) el.textContent = text;
    };
  }, [text, on, replay, delay]);

  return (
    <span className={className ? `decode ${className}` : 'decode'}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true" className="decode-glyphs">
        {text}
      </span>
    </span>
  );
}
