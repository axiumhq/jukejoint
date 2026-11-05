import { useEffect, useState } from 'react';
import { REPO } from '../config/brand';

/**
 * A release do app que a página Instalar mostra: a mais recente do repositório no GitHub, que é
 * público. Cada release traz o instalador do Windows (`Jukejoint-vX.Y.Z-windows-x64-setup.exe`,
 * de .github/workflows/release-desktop.yml) com o SHA-256 que o GitHub calcula na publicação.
 */
export interface Release {
  version: string;
  fileName: string;
  sizeMb: number;
  /** Data da publicação, AAAA-MM-DD. */
  releasedAt: string;
  /** O SHA-256 do instalador, ou nulo quando o GitHub não deu. */
  sha256: string | null;
  downloadUrl: string;
  pageUrl: string;
}

export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
export const SOURCE_URL = `https://github.com/${REPO}`;
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const SETUP = /-windows-x64-setup\.exe$/i;

interface GhAsset {
  name: string;
  size: number;
  digest?: string | null;
  browser_download_url: string;
}
interface GhRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
  assets: GhAsset[];
}

/** O que a API do GitHub devolve, no formato da página; nulo quando a release não tem instalador. */
export function toRelease(gh: GhRelease): Release | null {
  const asset = gh.assets?.find((a) => SETUP.test(a.name));
  if (!asset) return null;
  const digest = asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : null;
  return {
    version: gh.tag_name.replace(/^v/, ''),
    fileName: asset.name,
    sizeMb: Math.round((asset.size / (1024 * 1024)) * 10) / 10,
    releasedAt: gh.published_at.slice(0, 10),
    sha256: digest && /^[0-9a-f]{64}$/i.test(digest) ? digest.toLowerCase() : null,
    downloadUrl: asset.browser_download_url,
    pageUrl: gh.html_url,
  };
}

let cached: Promise<Release | null> | null = null;

/** Lê a release uma vez por carga da página. Sem rede, ou sem instalador, devolve nulo. */
export function fetchLatestRelease(fetcher: typeof fetch = fetch): Promise<Release | null> {
  cached ??= fetcher(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? (r.json() as Promise<GhRelease>) : null))
    .then((gh) => (gh ? toRelease(gh) : null))
    .catch(() => null);
  return cached;
}

export type ReleaseState = { status: 'loading' } | { status: 'ready'; release: Release } | { status: 'unavailable' };

export function useLatestRelease(): ReleaseState {
  const [state, setState] = useState<ReleaseState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    void fetchLatestRelease().then((release) => {
      if (alive) setState(release ? { status: 'ready', release } : { status: 'unavailable' });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
