import { afterAll, describe, expect, it } from 'vitest';
import { modes } from '../data/modes';
import { cartao } from './cartao';
import { desktop } from './desktop';
import { getMessages } from './index';
import { installTexts } from './install';
import { live } from './live';
import { setLocale } from './locale';
import { mesa } from './mesa';
import { modosHome } from './modos-home';
import { modosPagina } from './modos-pagina';
import { salaAtual } from './sala-atual';

/**
 * O catálogo em inglês não pode mostrar português: nem chave esquecida (que cai no pt-BR pelo
 * merge), nem função que monta frase com palavra fixa. Proper nouns (nomes dos modos) não contam.
 */

const PT = /[ãõçâêôáéíóú]|\b(de|da|não|você|para|com|sala|vagas?|jogando|faltam?|agora|entrar|abrir)\b/i;
const NAMES = modes.map((m) => m.name);
const SAMPLE_ARGS = [3, 12, 6, 'Ana', 'Ana'];

function portuguese(text: string) {
  const clean = NAMES.reduce((s, n) => s.split(n).join(''), text);
  return PT.test(clean);
}

/** Percorre o catálogo e devolve "caminho: texto" de cada folha (funções chamadas com exemplos). */
function leaves(node: unknown, path: string, out: string[]) {
  if (typeof node === 'string') {
    out.push(`${path}: ${node}`);
  } else if (typeof node === 'function') {
    try {
      const value = (node as (...a: unknown[]) => unknown)(...SAMPLE_ARGS);
      if (typeof value === 'string') out.push(`${path}(): ${value}`);
    } catch {
      // Funções que esperam outro formato de argumento ficam de fora; as de texto simples bastam.
    }
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) leaves((node as Record<string, unknown>)[key], `${path}.${key}`, out);
  }
}

function englishLeaks(name: string, catalog: () => unknown) {
  setLocale('en');
  const out: string[] = [];
  leaves(catalog(), name, out);
  return out.filter((line) => portuguese(line.slice(line.indexOf(': ') + 2)));
}

describe('catálogo em inglês', () => {
  afterAll(() => setLocale('pt-BR'));

  it('o catálogo principal não tem português', () => {
    expect(englishLeaks('t', () => getMessages('en'))).toEqual([]);
  });

  it('os textos ao vivo, do app desktop e da /instalar não têm português', () => {
    expect(englishLeaks('live', () => ({ ...live }))).toEqual([]);
    expect(englishLeaks('desktop', () => ({ ...desktop }))).toEqual([]);
    expect(englishLeaks('install', () => ({ ...installTexts }))).toEqual([]);
    expect(englishLeaks('mesa', () => ({ ...mesa }))).toEqual([]);
    expect(englishLeaks('cartao', () => ({ ...cartao }))).toEqual([]);
    expect(englishLeaks('modosHome', () => ({ ...modosHome }))).toEqual([]);
    expect(englishLeaks('modosPagina', () => ({ ...modosPagina }))).toEqual([]);
    expect(englishLeaks('salaAtual', () => ({ ...salaAtual }))).toEqual([]);
  });
});

describe('texto fixo nos componentes', () => {
  const sources = import.meta.glob<string>('../**/*.tsx', { query: '?raw', import: 'default', eager: true });

  it('nenhum template junta números com "de" fixo (vai para o i18n)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    const hits = Object.entries(sources).flatMap(([file, text]) =>
      text
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => /\}\s+(de|do|da)\s+\$\{/.test(line) || /\}\s+de\s+\{/.test(line))
        .map(({ i }) => `${file}:${i + 1}`),
    );
    expect(hits).toEqual([]);
  });
});
