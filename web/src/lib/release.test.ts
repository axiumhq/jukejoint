import { describe, expect, it } from 'vitest';
import { fetchLatestRelease, toRelease } from './release';

// O formato que a API do GitHub devolveu para a v1.7.0 (os campos que a página lê).
const gh = {
  tag_name: 'v1.7.0',
  published_at: '2026-11-05T14:23:59Z',
  html_url: 'https://github.com/axiumhq/jukejoint/releases/tag/v1.7.0',
  assets: [
    {
      name: 'Jukejoint-v1.7.0-windows-x64-setup.exe.sig',
      size: 440,
      digest: 'sha256:683ef7fd65c561251b14b269fe60f2a6e72cc5a37423a94281699d8b6787da43',
      browser_download_url: 'https://x/sig',
    },
    {
      name: 'latest.json',
      size: 1097,
      digest: 'sha256:15c6147ba3130bed6403b56f2294bf831929b4210c18a2e0c63636beca104533',
      browser_download_url: 'https://x/json',
    },
    {
      name: 'Jukejoint-v1.7.0-windows-x64-setup.exe',
      size: 37966056,
      digest: 'sha256:55A168B7A893AE85075B8343BCFCBDC1EE6AFCD28FE9AFA778E965E99360231E',
      browser_download_url: 'https://x/setup.exe',
    },
  ],
};

describe('release do app', () => {
  it('pega o instalador, não a assinatura nem o manifesto do updater', () => {
    expect(toRelease(gh)).toEqual({
      version: '1.7.0',
      fileName: 'Jukejoint-v1.7.0-windows-x64-setup.exe',
      sizeMb: 36.2,
      releasedAt: '2026-11-05',
      sha256: '55a168b7a893ae85075b8343bcfcbdc1ee6afcd28fe9afa778e965e99360231e',
      downloadUrl: 'https://x/setup.exe',
      pageUrl: 'https://github.com/axiumhq/jukejoint/releases/tag/v1.7.0',
    });
  });

  it('sem instalador na release não inventa um', () => {
    expect(toRelease({ ...gh, assets: gh.assets.slice(0, 2) })).toBeNull();
  });

  it('um digest fora do formato vira nulo, nunca um hash errado na tela', () => {
    const setup = gh.assets.find((a) => a.name.endsWith('setup.exe'))!;
    const odd = { ...gh, assets: [{ ...setup, digest: 'md5:abc' }] };
    expect(toRelease(odd)?.sha256).toBeNull();
  });

  it('sem rede devolve nulo', async () => {
    const offline = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    await expect(fetchLatestRelease(offline)).resolves.toBeNull();
  });
});
