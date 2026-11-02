import * as THREE from 'three';
import { MELT_GLSL } from './illus';

/**
 * Vida ambiente e camada oculta da cidade (v5 leva 2, itens 2, 3 e 4 do pedido). Cada
 * efeito é UMA chamada de desenho e anda só no shader, por um relógio ambiente (`uTime`)
 * que para com movimento reduzido. A CPU só escreve atributos quando algo nasce.
 *
 *  - Fachos dos holofotes: cones aditivos com densidade de névoa em camadas (ruído 3D).
 *  - Poças de sódio no asfalto molhado, com anéis de chuva nas poças.
 *  - Chuva fina (só no alto): riscos de linha presos numa caixa em volta da câmera.
 *  - Pombos: silhuetas em V que batem asa; levantam da coroa quando um lobby lota.
 *  - Partículas ambiente num `Points` só: vapor dos bueiros e telhados, brasas subindo da
 *    praça, fumaça baixa que se enrola na base da torre e a lanterna da tirolesa.
 *  - Letreiro: texto nosso em textura de canvas (nítido e barato), troca com tremor.
 *  - Sigilos: duas faixas de runas safira orbitando devagar a coroa.
 */

const OUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

const add = (o: Partial<THREE.ShaderMaterialParameters>) =>
  new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });

/* ───────── Fachos dos holofotes ───────── */

export function createBeamMaterial() {
  return add({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.62, 0.78, 1.15) }, uI: { value: 0.5 }, uFogD: { value: 0.006 } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying float vH;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(m) * normal);
  vH = uv.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uI;
uniform float uFogD;
varying vec3 vW;
varying vec3 vN;
varying float vH;
${MELT_GLSL}
void main() {
  vec3 v = normalize(cameraPosition - vW);
  float edge = pow(abs(dot(normalize(vN), v)), 2.2);
  float along = mix(0.18, 1.0, (1.0 - vH) * (1.0 - vH)) * smoothstep(0.0, 0.02, vH);
  float n = trNoise(vW * 0.06 + vec3(0.0, -uTime * 0.35, uTime * 0.2)) * 0.6 + trNoise(vW * 0.17 + vec3(uTime * 0.4, 0.0, 0.0)) * 0.4;
  // Névoa em camadas: uma faixa densa acima da agulha (onde os fachos se cruzam) e outra baixa.
  float layer = 0.5 + 0.75 * exp(-pow((vW.y - 44.0) / 9.0, 2.0)) + 0.45 * exp(-pow((vW.y - 14.0) / 6.0, 2.0));
  float a = edge * along * (0.4 + 0.8 * n) * layer * exp(-distance(vW, cameraPosition) * uFogD);
  gl_FragColor = vec4(uColor * a * uI, 1.0);
  ${OUT}
}`,
  });
}

/** Cone do facho: base estreita no tambor, abrindo para longe (+Y local). */
export function beamGeometry(len: number) {
  const g = new THREE.CylinderGeometry(7.5, 0.42, len, 28, 1, true);
  g.translate(0, len / 2, 0);
  return g;
}

/* ───────── Poças de sódio ───────── */

export function createPoolMaterial() {
  return add({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.56, 0.2) }, uI: { value: 0.55 }, uRain: { value: 0 } },
    vertexShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uI;
uniform float uRain;
varying vec2 vUv;
varying vec3 vW;
${MELT_GLSL}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float fall = exp(-dot(p, p) * 3.4);
  float wet = smoothstep(0.38, 0.72, trNoise(vec3(vW.xz * 0.32, 0.0)) * 0.7 + trNoise(vec3(vW.xz * 1.1, 4.0)) * 0.3);
  // Anéis de chuva nas poças.
  vec2 c = floor(vW.xz * 1.4);
  vec2 f = fract(vW.xz * 1.4) - 0.5;
  float ph = fract(uTime * 0.8 + trHash3(vec3(c, 1.0)));
  float ring = (1.0 - smoothstep(0.0, 0.035, abs(length(f) - ph * 0.42))) * (1.0 - ph) * wet * uRain;
  gl_FragColor = vec4(uColor * fall * (0.22 + 0.95 * wet + ring * 1.2) * uI, 1.0);
  ${OUT}
}`,
  });
}

/* ───────── Chuva ───────── */

export function createRain(count: number) {
  const seed = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random()];
    seed.set(s, i * 6);
    seed.set(s, i * 6 + 3);
    end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(seed, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = add({
    uniforms: { uTime: { value: 0 }, uBox: { value: new THREE.Vector3(46, 30, 46) }, uColor: { value: new THREE.Color(0.5, 0.6, 0.8) } },
    vertexShader: /* glsl */ `
attribute float aEnd;
uniform float uTime;
uniform vec3 uBox;
varying float vA;
void main() {
  vec3 vel = vec3(1.6, -17.0, 0.4);
  vec3 p = position * uBox + vel * uTime;
  p = cameraPosition + mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
  p -= vel * 0.032 * aEnd;
  float d = distance(p, cameraPosition);
  vA = smoothstep(1.2, 4.0, d) * (1.0 - smoothstep(12.0, 22.0, d)) * (1.0 - aEnd * 0.8);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  gl_FragColor = vec4(uColor * vA * 0.16, 1.0);
  ${OUT}
}`,
  });
  const mesh = new THREE.LineSegments(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  return { mesh, mat };
}

/* ───────── Pombos ───────── */

export function createBirds(count: number) {
  const g = new THREE.BufferGeometry();
  const s = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) s.set([i / count + Math.random() * 0.03, Math.random(), Math.random(), Math.random()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uFly: { value: -100 },
      uPx: { value: 600 },
      /** Beirada onde pousam: centro (xyz) e meia largura / frente do último andar (w e uEdge). */
      uNest: { value: new THREE.Vector4() },
      uEdge: { value: 1 },
      uColor: { value: new THREE.Color(0.012, 0.014, 0.02) },
    },
    vertexShader: /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uFly;
uniform float uPx;
uniform vec4 uNest;
uniform float uEdge;
varying float vFlap;
varying float vFly;
void main() {
  float s = aSeed.x;
  // Pousados na beirada da frente (e alguns de lado) do último andar.
  float side = step(0.7, aSeed.y);
  vec3 home = uNest.xyz + mix(vec3((s * 2.0 - 1.0) * (uNest.w - 0.25), 0.1, uEdge - 0.12), vec3(sign(s - 0.5) * (uNest.w - 0.1), 0.1, (aSeed.z - 0.5) * uEdge), side);
  float u = (uTime - uFly - aSeed.w * 0.7) / (8.0 + aSeed.z * 3.0);
  vec3 p = home;
  float fly = 0.0;
  if (u > 0.0 && u < 1.0) {
    float k = sin(3.14159 * u);
    float ang = s * 6.2832 + u * 6.2832 * (0.7 + aSeed.w * 0.6);
    float rad = k * (9.0 + aSeed.w * 12.0);
    p = mix(home, uNest.xyz + vec3(cos(ang) * rad, k * (5.0 + aSeed.y * 9.0) + sin(u * 25.0 + s * 9.0) * 0.3, sin(ang) * rad), smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.9, 1.0, u)));
    fly = smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.95, 1.0, u));
  }
  vFly = fly;
  vFlap = fly > 0.0 ? sin(uTime * (17.0 + aSeed.w * 6.0) + s * 40.0) : -0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = mix(0.42, 0.85, fly) * uPx / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
varying float vFlap;
varying float vFly;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  c.y = -c.y;
  float ax = abs(c.x);
  // Asas em V que batem; pousado é uma bolinha (asa fechada).
  float wing = (1.0 - smoothstep(0.03, 0.07, abs(c.y - ax * vFlap * 0.9))) * step(ax, 0.46);
  float body = (1.0 - smoothstep(0.1, 0.16, length(c * vec2(1.0, 1.3))));
  float a = mix(body, max(wing, body * 0.8), vFly);
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a * 0.95);
}`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return { points, mat };
}

/* ───────── Partículas ambiente ───────── */

/** Tipos (aP.y): vapor, brasa da praça, fumaça da base, lanterna da tirolesa. */
export const AMB = { steam: 0, ember: 1, smoke: 2, lantern: 3 } as const;

export function createAmbient(origins: { p: THREE.Vector3; kind: number }[]) {
  const n = origins.length;
  const pos = new Float32Array(n * 3);
  const ap = new Float32Array(n * 4);
  origins.forEach((o, i) => {
    pos.set([o.p.x, o.p.y, o.p.z], i * 3);
    ap.set([Math.random(), o.kind, Math.random(), Math.random()], i * 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aP', new THREE.BufferAttribute(ap, 4));
  const mat = add({
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: 600 },
      uLantern: { value: new THREE.Vector4() },
      uSteam: { value: new THREE.Color(0.55, 0.52, 0.5) },
      uSmoke: { value: new THREE.Color(0.32, 0.38, 0.5) },
      uAmber: { value: new THREE.Color(3.2, 1.45, 0.4) },
      uCold: { value: new THREE.Color(0.45, 0.85, 3.0) },
      uDawn: { value: 0 },
    },
    vertexShader: /* glsl */ `
attribute vec4 aP;
uniform float uTime;
uniform float uPx;
uniform vec4 uLantern;
varying float vU;
varying float vKind;
varying float vSeed;
varying float vFar;
void main() {
  float kind = aP.y;
  float dur = kind < 0.5 ? 5.5 : kind < 1.5 ? 4.5 : 8.0;
  float u = fract(uTime / dur + aP.x);
  vec3 p = position;
  float size;
  if (kind < 0.5) {
    // Vapor: sobe, abre e o vento leva.
    p += vec3(u * u * 2.6 + sin(u * 4.0 + aP.z * 6.0) * 0.3, u * 7.0 * (0.7 + aP.w * 0.6), cos(u * 3.0 + aP.z * 5.0) * 0.3);
    size = 0.6 + u * 3.4;
  } else if (kind < 1.5) {
    // Brasa subindo do círculo, com balanço.
    p += vec3(sin(u * 7.0 + aP.z * 20.0) * 0.4, u * (4.0 + aP.w * 8.0), cos(u * 6.0 + aP.w * 13.0) * 0.4);
    size = 0.075 * (1.0 - u * 0.5);
  } else if (kind < 2.5) {
    // Fumaça rente ao chão: sai da base da torre e se enrola.
    vec2 dir = normalize(position.xz + 0.001);
    float ang = u * 2.4 * (aP.z - 0.5);
    p.xz += mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * dir * u * 4.5;
    p.y += u * 1.1 + sin(u * 5.0 + aP.w * 9.0) * 0.25;
    size = 1.4 + u * 3.6;
  } else {
    p = uLantern.xyz;
    u = 0.5;
    size = 0.55 * uLantern.w;
  }
  vU = u;
  vKind = kind;
  vSeed = aP.z;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vFar = exp(-length(mv.xyz) * 0.011);
  gl_PointSize = size * uPx / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uSteam;
uniform vec3 uSmoke;
uniform vec3 uAmber;
uniform vec3 uCold;
uniform float uDawn;
varying float vU;
varying float vKind;
varying float vSeed;
varying float vFar;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float soft = (1.0 - smoothstep(0.0, 0.5, d));
  float bell = sin(3.14159 * vU);
  vec3 col;
  if (vKind < 0.5) col = uSteam * soft * soft * bell * mix(0.1, 0.06, uDawn);
  else if (vKind < 1.5) col = (vSeed > 0.72 ? uAmber : uCold) * (soft * 0.5 + (1.0 - smoothstep(0.0, 0.2, d)) * 1.4) * bell;
  else if (vKind < 2.5) col = uSmoke * soft * soft * bell * 0.05;
  else col = uAmber * (soft * 0.35 + (1.0 - smoothstep(0.0, 0.16, d)) * 1.6);
  gl_FragColor = vec4(col * vFar, 1.0);
  ${OUT}
}`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return { points, mat };
}

/* ───────── Letreiro (texto nosso, em canvas) ───────── */

export function createSign() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: null }, uTime: { value: 0 } }]),
    fog: true,
    vertexShader: /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
#include <fog_pars_fragment>
uniform sampler2D uTex;
uniform float uTime;
varying vec2 vUv;
float h1(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  // Dois avisos que se revezam a cada 7 s; na troca as lâmpadas falham e pegam.
  float k = uTime / 7.0;
  float tt = fract(k) * 7.0;
  float msg = mod(floor(k), 2.0);
  if (tt < 0.4 && h1(floor(tt * 28.0) + floor(k)) > 0.5) msg = 1.0 - msg;
  vec3 t = texture2D(uTex, vec2(vUv.x, vUv.y * 0.5 + (1.0 - msg) * 0.5)).rgb;
  gl_FragColor = vec4(t * t * 2.4, 1.0);
  ${OUT}
  #include <fog_fragment>
}`,
  });
  mat.uniforms.uTex!.value = tex;
  let last = '';
  /** Redesenha só quando o texto muda (o número que tiquetaqueia). */
  function draw(lines: [string, string][]) {
    const key = JSON.stringify(lines);
    if (key === last) return;
    last = key;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0a0907';
    g.fillRect(0, 0, 1024, 1024);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffe9c4';
    g.shadowColor = '#ff9a3c';
    g.shadowBlur = 22;
    lines.forEach(([big, small], i) => {
      const y0 = i * 512;
      const fit = (txt: string, px: number, weight: number) => {
        let size = px;
        do g.font = `${weight} ${size}px "Big Shoulders Variable", "Arial Narrow", sans-serif`;
        while (g.measureText(txt).width > 900 && (size -= 6) > 40);
      };
      // Primeira linha grande, segunda menor (o quadro tem proporção 2,46 : 1).
      fit(big, 250, 800);
      g.fillText(big, 512, y0 + 196);
      fit(small, 132, 700);
      g.fillText(small, 512, y0 + 392);
    });
    tex.needsUpdate = true;
  }
  return { mat, tex, draw };
}

/* ───────── Sigilos em volta da coroa ───────── */

export function createSigils() {
  const bands = [
    { r: 3.0, tilt: 0.2, y: 0 },
    { r: 2.45, tilt: -0.26, y: 0.9 },
  ];
  const geos = bands.map((b, i) => {
    const g = new THREE.CylinderGeometry(b.r, b.r, 0.34, 72, 1, true);
    g.rotateX(b.tilt);
    g.translate(0, b.y, 0);
    g.setAttribute('aBand', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count).fill(i), 1));
    return g;
  });
  const g = mergeTwo(geos[0]!, geos[1]!);
  const mat = add({
    uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uCol: { value: new THREE.Color(0.32, 0.62, 2.2) } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
attribute float aBand;
uniform float uTime;
varying vec2 vUv;
varying float vFace;
varying float vBand;
void main() {
  vUv = uv;
  vBand = aBand;
  float a = uTime * (aBand > 0.5 ? -0.09 : 0.06);
  vec3 p = position;
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFace = normalize(mat3(modelViewMatrix) * vec3(p.x, 0.0, p.z)).z;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uI;
uniform vec3 uCol;
varying vec2 vUv;
varying float vFace;
varying float vBand;
float h1(float n) { return fract(sin(n) * 43758.5453); }
float bar(float d, float w) { return 1.0 - smoothstep(w, w + fwidth(d) * 1.5, abs(d)); }
void main() {
  float n = vBand > 0.5 ? 30.0 : 40.0;
  float cell = floor(vUv.x * n);
  float f = fract(vUv.x * n);
  float v = vUv.y;
  float k = h1(cell * 3.17 + vBand * 11.0);
  float k2 = h1(cell * 7.31 + 2.0);
  // Glifo: haste, travessas e uma diagonal, sorteados por célula (nada de alfabeto real).
  float g = bar(f - 0.5, 0.045) * step(0.25, k);
  g = max(g, bar(v - (0.3 + 0.4 * step(0.5, k2)), 0.05) * step(0.2, f) * step(f, 0.8));
  g = max(g, bar((f - 0.5) - (v - 0.5) * (k > 0.6 ? 0.9 : -0.9), 0.05) * step(0.55, k2) * step(0.15, v) * step(v, 0.85));
  g = max(g, bar(length(vec2(f - 0.5, (v - 0.5) * 0.7)) - 0.18, 0.04) * step(0.82, k));
  // Fios de cima e de baixo; a face de trás fica mais fraca (a faixa tem volume).
  g = max(g, bar(v - 0.06, 0.02) + bar(v - 0.94, 0.02));
  float back = mix(0.35, 1.0, smoothstep(-0.4, 0.4, vFace));
  gl_FragColor = vec4(uCol * g * back * uI, 1.0);
  ${OUT}
}`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 7;
  return { mesh, mat };
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'aBand'] as const) {
    const A = a.attributes[k]!;
    const B = b.attributes[k]!;
    const arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array as Float32Array);
    arr.set(B.array as Float32Array, A.array.length);
    out.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize));
  }
  const n = a.attributes.position!.count;
  out.setIndex([...Array.from(a.index!.array), ...Array.from(b.index!.array, (i) => i + n)]);
  return out;
}
