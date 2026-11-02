import * as THREE from 'three';

/**
 * Texturas geradas no código (nenhum arquivo baixado): ruído para névoa e poças,
 * latão escovado para a placa e a folha da Gazeta para a rua.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor fractal, ladrilhável, 128 px, em escala de cinza. */
export function makeNoiseTexture(size = 128): THREE.DataTexture {
  const rand = rng(7);
  const data = new Uint8Array(size * size * 4);
  const octaves = [8, 16, 32];
  const grids = octaves.map((n) => Array.from({ length: n * n }, rand));
  const smooth = (x: number) => x * x * (3 - 2 * x);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.55;
      let total = 0;
      octaves.forEach((n, o) => {
        const g = grids[o]!;
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const x0 = Math.floor(fx) % n;
        const y0 = Math.floor(fy) % n;
        const x1 = (x0 + 1) % n;
        const y1 = (y0 + 1) % n;
        const tx = smooth(fx - Math.floor(fx));
        const ty = smooth(fy - Math.floor(fy));
        const a = g[y0 * n + x0]!;
        const b = g[y0 * n + x1]!;
        const c = g[y1 * n + x0]!;
        const d = g[y1 * n + x1]!;
        v += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
        total += amp;
        amp *= 0.5;
      });
      const i = (y * size + x) * 4;
      const byte = Math.round((v / total) * 255);
      data[i] = data[i + 1] = data[i + 2] = byte;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Rugosidade de latão escovado: riscos horizontais finos (a luz rasante corre por eles). */
export function makeBrushedTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rand = rng(31);
  g.fillStyle = 'rgb(120,120,120)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const y = rand() * h;
    const v = 70 + rand() * 120;
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + rand() * 0.4})`;
    g.lineWidth = rand() < 0.85 ? 0.6 : 1.4;
    g.beginPath();
    const x = rand() * w;
    g.moveTo(x - 400, y);
    g.lineTo(x + 400, y + (rand() - 0.5) * 0.6);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Folha da Gazeta para a cena da rua. Só forma (cabeçalho, colunas, gravura em retícula):
 * as manchetes de verdade estão no HTML por cima, legíveis e selecionáveis.
 */
export function makeNewspaperTexture(brand: string): THREE.CanvasTexture {
  const w = 256;
  const h = 340;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rand = rng(11);
  g.fillStyle = '#d9d2c3';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#26231e';
  g.font = '800 30px "Big Shoulders Variable", "Arial Narrow", sans-serif';
  g.textAlign = 'center';
  g.fillText(`GAZETA DO ${brand}`.slice(0, 22), w / 2, 40);
  g.fillRect(14, 50, w - 28, 2);
  g.fillRect(14, 55, w - 28, 0.8);
  // manchete (barras grossas) e colunas de texto (linhas finas)
  for (let i = 0; i < 2; i++) g.fillRect(18, 68 + i * 16, w - 36 - i * 60, 10);
  const colW = (w - 36 - 16) / 3;
  for (let col = 0; col < 3; col++) {
    const x = 18 + col * (colW + 8);
    let y = 112;
    if (col === 1) {
      // gravura em retícula
      for (let yy = 0; yy < 70; yy += 4) {
        for (let xx = 0; xx < colW; xx += 4) {
          const r = Math.max(0.2, 1.8 * Math.sin((xx + yy) * 0.08) * 0.5 + 0.9 * rand());
          g.beginPath();
          g.arc(x + xx + 2, y + yy + 2, r, 0, Math.PI * 2);
          g.fill();
        }
      }
      y += 80;
    }
    g.globalAlpha = 0.55;
    while (y < h - 16) {
      g.fillRect(x, y, colW * (0.75 + rand() * 0.25), 2.2);
      y += 6;
      if (rand() < 0.08) y += 6;
    }
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
