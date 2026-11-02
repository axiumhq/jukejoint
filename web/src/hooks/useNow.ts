import { useEffect, useState } from 'react';

/**
 * Relógio para textos relativos ("aberto há 3 min"). Atualiza a cada `ms` e para com a aba oculta.
 * Fica fora de hooks/index.ts para não disputar o arquivo com o trabalho da home.
 */
export function useNow(ms = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
