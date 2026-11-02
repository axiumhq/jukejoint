import * as THREE from 'three';

/**
 * Camada sobrenatural (plano v5, itens 1, 5 e 10). Duas temperaturas com significado:
 * azul-safira = o sobrenatural (círculo, farol, faíscas frias); âmbar = gente (fios da
 * obra, brasas dos jogadores); verdete = amigo.
 *
 *  - Círculo ritual: um plano na praça com shader (anéis, banda de runas, heptagrama),
 *    aceso anel a anel pelo progresso real do carregamento.
 *  - Fios: material de linha que se desenha (cada segmento cresce do começo) e se solta
 *    ponto a ponto, como pontos de costura puxados. Serve ao esqueleto e à constelação.
 *  - Brasas: um único `Points` (uma chamada de desenho) animado só no shader pelo relógio
 *    da obra; a CPU só escreve atributos quando nasce uma brasa.
 *  - Chama azul fria do farol: um plano virado para a câmera, ruído subindo.
 *  - Primeiro plano: grade de ferro e poste fora de foco, desenhados em espaço de tela.
 */

const SAPPHIRE = new THREE.Color(0.32, 0.62, 2.2);

/* ───────── Círculo ritual ───────── */

const CIRCLE_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CIRCLE_FRAG = /* glsl */ `
uniform float uClock;
uniform float uProg;
uniform float uFlare;
uniform float uIdle;
uniform float uPulse;
uniform float uWaveT;
uniform vec3 uCol;
uniform vec3 uHot;
varying vec2 vP;
#define TAU 6.2831853
float h1(float n) { return fract(sin(n) * 43758.5453); }
float line(float d, float w) { float aa = fwidth(d) * 1.2; return 1.0 - smoothstep(w, w + aa, abs(d)); }
// Arco revelado conforme o progresso deste anel (gira no sentido horário a partir do norte).
float reveal(float a, float p) { return step(fract(0.25 - a / TAU), p); }
float segLine(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return line(length(pa - ba * h), w);
}
void main() {
  float r = length(vP);
  if (r > 1.02) discard;
  float a = atan(vP.y, vP.x);
  float t = uClock;
  // Seis peças acendem em sequência com o progresso real (de fora para dentro).
  float p0 = clamp(uProg * 6.0 - 0.0, 0.0, 1.0);
  float p1 = clamp(uProg * 6.0 - 1.0, 0.0, 1.0);
  float p2 = clamp(uProg * 6.0 - 2.0, 0.0, 1.0);
  float p3 = clamp(uProg * 6.0 - 3.0, 0.0, 1.0);
  float p4 = clamp(uProg * 6.0 - 4.0, 0.0, 1.0);
  float p5 = clamp(uProg * 6.0 - 5.0, 0.0, 1.0);
  float v = 0.0;
  v += line(r - 0.985, 0.004) * reveal(a, p0);
  // Banda de runas (gira num sentido)
  float aR = a + t * 0.05;
  float cell = floor(fract(aR / TAU) * 72.0);
  float u = fract(fract(aR / TAU) * 72.0);
  float band = step(0.885, r) * step(r, 0.945);
  float k = h1(cell * 3.17);
  float glyph = step(0.3, u) * step(u, 0.42 + 0.3 * step(0.6, k));
  glyph *= step(0.89 + 0.03 * step(0.5, h1(cell * 7.1)), r) * step(r, 0.94 - 0.025 * step(0.7, k));
  glyph = max(glyph, line(u - 0.75, 0.04) * step(0.82, k) * band);
  v += glyph * band * 0.9 * reveal(a, p1);
  v += line(r - 0.86, 0.003) * reveal(a, p2);
  // Anel tracejado (gira no outro sentido)
  float aD = a - t * 0.08;
  v += line(r - 0.72, 0.004) * step(0.5, fract(aD / TAU * 60.0)) * reveal(a, p3);
  // Régua de traços finos
  float tick = line(fract(fract((a + t * 0.03) / TAU) * 144.0) - 0.5, 0.06) * step(0.6, r) * step(r, 0.645 + 0.025 * step(0.9, fract((a + t * 0.03) / TAU * 12.0)));
  v += tick * 0.8 * reveal(a, p4);
  // Heptagrama {7/3} e anel interno
  float star = 0.0;
  for (int i = 0; i < 7; i++) {
    float a1 = float(i) * TAU / 7.0 + 1.5708 + t * 0.02;
    float a2 = float(i + 3) * TAU / 7.0 + 1.5708 + t * 0.02;
    star = max(star, segLine(vP, vec2(cos(a1), sin(a1)) * 0.58, vec2(cos(a2), sin(a2)) * 0.58, 0.004));
  }
  v += (star + line(r - 0.3, 0.004)) * p5;
  // Brilho: inflama na ignição, assenta num resto aceso que pulsa quando alguém entra.
  float level = mix(uIdle, 1.0, uFlare) + uPulse * 0.8;
  float shimmer = 0.85 + 0.15 * sin(t * 2.3 + a * 3.0);
  vec3 col = uCol * v * level * shimmer;
  // Faíscas âmbar onde o progresso "escreve" (a ponta do arco que está acendendo).
  col += uHot * line(r - 0.985, 0.012) * (1.0 - step(0.999, p0)) * step(0.0001, p0) * (1.0 - smoothstep(0.0, 0.03, abs(fract(0.25 - a / TAU) - p0)));
  // Alguém entrou: uma onda sai do centro e corre o círculo até a borda.
  float wt = uClock - uWaveT;
  col += uCol * 1.6 * line(r - wt * 0.95, 0.012) * exp(-wt * 2.2) * step(0.0, wt) * step(r, 1.0);
  // Halo baixo no chão
  col += uCol * 0.05 * level * smoothstep(1.0, 0.5, r) * (1.0 - smoothstep(0.5, 0.0, r));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createRitualCircle(radius: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uClock: { value: 0 },
      uProg: { value: 0 },
      uFlare: { value: 0 },
      uIdle: { value: 0.35 },
      uPulse: { value: 0 },
      uWaveT: { value: -100 },
      uCol: { value: SAPPHIRE.clone() },
      uHot: { value: new THREE.Color(3.2, 1.6, 0.5) },
    },
    vertexShader: CIRCLE_VERT,
    fragmentShader: CIRCLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(radius);
  mesh.renderOrder = 4;
  return { mesh, mat };
}

/* ───────── Fios que se desenham ───────── */

const THREAD_VERT = /* glsl */ `
attribute vec3 aDraw; // x: 0 no começo do segmento, 1 no fim; y: ordem (0..1); z: semente
varying vec3 vD;
#include <fog_pars_vertex>
void main() {
  vD = aDraw;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const THREAD_FRAG = /* glsl */ `
uniform float uDraw;
uniform float uUndraw;
uniform float uAlpha;
uniform vec3 uColor;
varying vec3 vD;
#include <fog_pars_fragment>
void main() {
  float grow = clamp((uDraw - vD.y * 0.7) / 0.3, 0.0, 1.0);
  if (vD.x > grow || vD.z < uUndraw) discard;
  // Ponta acesa: o trecho que acabou de crescer brilha mais.
  float tip = 1.0 - smoothstep(0.0, 0.25, grow - vD.x);
  gl_FragColor = vec4(uColor * (1.0 + tip * 2.0) * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createThreadMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uDraw: { value: 0 }, uUndraw: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: color } },
    ]),
    vertexShader: THREAD_VERT,
    fragmentShader: THREAD_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
}

/* ───────── Brasas ───────── */

/** Tipos de brasa (aT.z). */
export const EMBER = { player: 0, friend: 1, spark: 2, smoke: 3, cold: 4 } as const;

const EMBER_VERT = /* glsl */ `
attribute vec3 aFrom;
attribute vec3 aTo;   // destino (voo) ou velocidade (faísca, fumaça)
attribute vec4 aT;    // início, duração, tipo, semente
uniform float uClock;
uniform float uPx;
varying float vU;
varying float vKind;
varying float vSeed;
void main() {
  float u = (uClock - aT.x) / aT.y;
  vU = u;
  vKind = aT.z;
  vSeed = aT.w;
  if (u < 0.0 || u > 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec3 p;
  float size;
  if (aT.z < 1.5) {
    // Voo da cidade até a janela: arco alto, com tremor que acalma ao chegar.
    float e = u * u * (3.0 - 2.0 * u);
    vec3 side = normalize(cross(aTo - aFrom, vec3(0.0, 1.0, 0.0)) + 1e-4) * (aT.w - 0.5) * 8.0;
    vec3 mid = (aFrom + aTo) * 0.5 + vec3(0.0, 7.0 + aT.w * 7.0, 0.0) + side;
    p = mix(mix(aFrom, mid, e), mix(mid, aTo, e), e);
    p += sin(vec3(u * 17.0 + aT.w * 30.0, u * 13.0 + aT.w * 11.0, u * 19.0)) * 0.22 * (1.0 - u);
    size = 0.2 * (0.75 + 0.25 * sin(u * 50.0 + aT.w * 20.0));
    size *= 1.0 + 2.2 * smoothstep(0.86, 1.0, u);
  } else if (aT.z < 2.5 || aT.z > 3.5) {
    // Faísca: espirra e sobe, freando.
    p = aFrom + aTo * (1.0 - exp(-u * 3.5)) / 3.5 + vec3(0.0, u * u * 1.2, 0.0);
    size = 0.09 * (1.0 - u * 0.6);
  } else {
    // Fumaça: sobe devagar e abre.
    p = aFrom + aTo * u + vec3(sin(u * 3.0 + aT.w * 9.0) * 0.4, u * 2.2, cos(u * 2.0 + aT.w * 5.0) * 0.3);
    size = 0.7 + u * 1.9;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = size * uPx / max(0.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const EMBER_FRAG = /* glsl */ `
uniform vec3 uAmber;
uniform vec3 uFriend;
uniform vec3 uCold;
uniform vec3 uSmoke;
varying float vU;
varying float vKind;
varying float vSeed;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  vec3 col;
  float a;
  if (vKind > 2.5 && vKind < 3.5) {
    a = smoothstep(0.5, 0.0, d) * 0.16 * sin(3.14159 * vU);
    col = uSmoke * a;
  } else {
    float core = smoothstep(0.22, 0.0, d);
    float halo = smoothstep(0.5, 0.0, d);
    vec3 base = vKind < 0.5 ? uAmber : vKind < 1.5 ? uFriend : vKind > 3.5 ? uCold : uAmber * 0.8;
    float life = vKind < 1.5 ? smoothstep(0.0, 0.08, vU) : (1.0 - vU) * (1.0 - vU);
    col = base * (halo * 0.55 + core * 1.6) * life;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Embers {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  /** Nasce uma brasa (o lote é circular: a mais antiga dá lugar). */
  emit(from: THREE.Vector3, to: THREE.Vector3, start: number, dur: number, kind: number, seed?: number): void;
  flush(): void;
  clear(): void;
}

/** Cada brasa de voo leva `trail` pontos (a cauda), um pouco atrasados. */
export function createEmbers(capacity: number, trail: number): Embers {
  const geo = new THREE.BufferGeometry();
  const from = new Float32Array(capacity * 3);
  const to = new Float32Array(capacity * 3);
  const tt = new Float32Array(capacity * 4);
  for (let i = 0; i < capacity; i++) tt[i * 4] = -1e6; // apagadas
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
  geo.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  geo.setAttribute('aTo', new THREE.BufferAttribute(to, 3));
  geo.setAttribute('aT', new THREE.BufferAttribute(tt, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uClock: { value: 0 },
      uPx: { value: 600 },
      uAmber: { value: new THREE.Color(3.4, 1.55, 0.42) },
      uFriend: { value: new THREE.Color(0.6, 2.2, 1.6) },
      uCold: { value: SAPPHIRE.clone().multiplyScalar(1.4) },
      uSmoke: { value: new THREE.Color(0.55, 0.62, 0.8) },
    },
    vertexShader: EMBER_VERT,
    fragmentShader: EMBER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  let next = 0;
  let dirty = false;
  const put = (i: number, f: THREE.Vector3, t: THREE.Vector3, start: number, dur: number, kind: number, seed: number) => {
    from[i * 3] = f.x;
    from[i * 3 + 1] = f.y;
    from[i * 3 + 2] = f.z;
    to[i * 3] = t.x;
    to[i * 3 + 1] = t.y;
    to[i * 3 + 2] = t.z;
    tt[i * 4] = start;
    tt[i * 4 + 1] = dur;
    tt[i * 4 + 2] = kind;
    tt[i * 4 + 3] = seed;
  };
  return {
    points,
    mat,
    emit(f, t, start, dur, kind, seed = Math.random()) {
      const n = kind <= EMBER.friend ? trail : 1;
      for (let k = 0; k < n; k++) {
        // a cauda sai um pouco depois e chega um pouco depois (mesma curva)
        put(next, f, t, start + k * 0.035, dur, kind, seed);
        next = (next + 1) % capacity;
      }
      dirty = true;
    },
    flush() {
      if (!dirty) return;
      dirty = false;
      for (const k of ['aFrom', 'aTo', 'aT'] as const) (geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    },
    clear() {
      for (let i = 0; i < capacity; i++) tt[i * 4] = -1e6;
      dirty = true;
    },
  };
}

/* ───────── Chama azul fria do farol ───────── */

const FLAME_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FLAME_FRAG = /* glsl */ `
uniform float uClock;
uniform float uIgnite;
uniform vec3 uCol;
uniform vec3 uCore;
varying vec2 vUv;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vUv * 2.0 - 1.0; // y: -1 base, 1 ponta
  float y = p.y * 0.5 + 0.5;
  float n = n2(vec2(p.x * 2.5, y * 3.0 - uClock * 3.4)) + 0.5 * n2(vec2(p.x * 6.0, y * 7.0 - uClock * 6.0));
  float w = 0.5 * sqrt(max(0.0, 1.0 - y)) * smoothstep(0.0, 0.18, y) + 0.02;
  float x = p.x + (n - 0.75) * 0.28 * y;
  float body = 1.0 - smoothstep(w * 0.55, w, abs(x));
  float core = 1.0 - smoothstep(0.0, w * 0.45, abs(x));
  body *= smoothstep(1.0, 0.55 - 0.25 * n, y);
  core *= smoothstep(0.62, 0.1, y);
  float glow = exp(-length(vec2(p.x * 1.2, (y - 0.2) * 1.4)) * 3.2) * 0.35;
  vec3 col = (uCol * (body + glow) + uCore * core) * uIgnite;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createFlame() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uClock: { value: 0 },
      uIgnite: { value: 0 },
      uCol: { value: SAPPHIRE.clone().multiplyScalar(1.3) },
      uCore: { value: new THREE.Color(1.8, 2.4, 3.2) },
    },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), mat);
  mesh.geometry.translate(0, 1.0, 0);
  mesh.renderOrder = 7;
  return { mesh, mat };
}

/* ───────── Primeiro plano fora de foco (cena 1) ─────────
 * Grade de ferro com lanças e um poste com lanterna, colados na borda do quadro e
 * desfocados (bordas largas), como uma lente longa na calçada. Espaço de tela: não
 * entra no reflexo nem na névoa; mexe mais que o fundo com o mouse (paralaxe de perto). */

const FG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FG_FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uAspect;
uniform vec2 uOff;
uniform vec3 uIron;
uniform vec3 uLamp;
uniform vec3 uRim;
varying vec2 vUv;
float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  // x em unidades de altura da tela, com o lado direito como referência (sobra no celular).
  vec2 p = vec2((vUv.x - 1.0) * uAspect, vUv.y) + uOff;
  float blur = 0.03;
  // Grade: barras a cada 0,075, lança na ponta, travessa embaixo, só à direita.
  float bx = (fract(p.x / 0.075) - 0.5) * 0.075;
  float bar = box(vec2(bx, p.y - 0.05), vec2(0.007, 0.12));
  float tipY = p.y - 0.185;
  float tip = max(abs(bx) * 1.9 + tipY - 0.02, -tipY - 0.012);
  float rail = box(vec2(p.x, p.y - 0.125), vec2(4.0, 0.006));
  float fence = min(min(bar, tip), rail);
  float side = smoothstep(-0.95, -0.45, p.x);
  // Poste com lanterna na borda direita.
  float post = box(p - vec2(-0.055, 0.32), vec2(0.016, 0.34));
  float arm = box(p - vec2(-0.1, 0.655), vec2(0.06, 0.008));
  float lantern = box(p - vec2(-0.16, 0.62), vec2(0.028, 0.04));
  // Tela em pé (celular): a torre fica no meio, então o poste sai e fica só a grade.
  float wideF = step(1.0, uAspect);
  float iron = min(fence + (1.0 - side) * 0.2, min(post, min(arm, lantern)) + (1.0 - wideF));
  float a = 1.0 - smoothstep(-blur, blur, iron);
  // Lanterna fora de foco: núcleo pequeno e halo curto (grande demais, vira uma segunda lua).
  float bk = length(p - vec2(-0.16, 0.6));
  float bokeh = (smoothstep(0.018, 0.011, bk) * 0.9 + exp(-bk * 40.0) * 0.35) * wideF;
  // Contorno quente largo no ferro (o sódio da rua batendo de lado): é o que separa a
  // silhueta escura do céu escuro.
  float rim = smoothstep(blur * 2.4, 0.0, abs(iron + blur * 0.2)) * (0.35 + 0.65 * smoothstep(0.0, 0.004, -dFdx(iron)));
  float alpha = a * 0.94;
  // Pré-multiplicado: o ferro cobre, a luz da lanterna e o fio somam.
  vec3 col = uIron * alpha + uRim * rim * 0.32 + uLamp * bokeh * 0.6;
  gl_FragColor = vec4(col * uAlpha, alpha * uAlpha);
}
`;

export function createForeground() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uAlpha: { value: 0 },
      uAspect: { value: 1.6 },
      uOff: { value: new THREE.Vector2() },
      uIron: { value: new THREE.Color(0.03, 0.022, 0.016) },
      uLamp: { value: new THREE.Color(1.6, 0.85, 0.3) },
      uRim: { value: new THREE.Color(0.8, 0.45, 0.15) },
    },
    vertexShader: FG_VERT,
    fragmentShader: FG_FRAG,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  // Sem tone mapping de propósito: o ferro é quase preto e a lanterna já vem na cor final.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 999;
  return { mesh, mat };
}
