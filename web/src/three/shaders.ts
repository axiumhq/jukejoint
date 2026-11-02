import * as THREE from 'three';
import { MELT_GLSL } from './illus';

/**
 * Shaders próprios da Torre. Nada de biblioteca de pós-processamento: um passe de
 * composição só (bloom por mip, aberração, vinheta, grão, transição) e materiais
 * pequenos para janela, céu, névoa e cone de luz de sódio.
 */

/* ───────── Janela: interior falso (interior mapping) + estados do lobby ─────────
 * Cada instância é uma vaga. aState = (tipo anterior, tipo atual, instante da troca);
 * tipo 0 = vaga livre, 1 = jogador (latão/sódio), 2 = amigo (verdete).
 * aInfo = (semente, flags, andar, vaga); flags: 1 em partida (persiana),
 * 2 com convite (cortina), 4 seu lobby (moldura verdete). */

const WINDOW_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 aState;
attribute vec4 aInfo;
attribute float aMelt;
uniform vec2 uWin;
uniform float uTime;
uniform float uReflect;
varying vec3 vO;
varying vec3 vD;
varying vec2 vUv;
varying vec3 vState;
varying vec4 vInfo;
varying float vWorldY;
varying vec3 vWorld;
varying float vMelt;
void main() {
  vUv = uv;
  vMelt = aMelt;
  vState = aState;
  vInfo = aInfo;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 world = m * vec4(position, 1.0);
  vWorldY = world.y;
  vWorld = world.xyz;
  vec3 view = world.xyz - cameraPosition;
  vec3 loc = inverse(mat3(m)) * view;
  vD = vec3(loc.x / uWin.x, loc.y / uWin.y, loc.z / (uWin.x * 1.15));
  vO = vec3(position.x / uWin.x, position.y / uWin.y, 0.0);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WINDOW_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uFocus;
uniform float uReflect;
uniform float uAmb;
uniform vec3 uLit;
uniform vec3 uFriend;
uniform vec3 uSky;
uniform vec3 uFrame;
uniform vec3 uMine;
varying vec3 vO;
varying vec3 vD;
varying vec2 vUv;
varying vec3 vState;
varying vec4 vInfo;
varying float vWorldY;
varying vec3 vWorld;
varying float vMelt;
uniform vec3 uBurn;
${MELT_GLSL}

float h1(float n) { return fract(sin(n) * 43758.5453123); }

// Sala atrás do vidro: devolve a luminância da parede atingida e o "id" dela.
float roomLum(vec3 o, vec3 d, float seed, out vec3 hit, out float wall) {
  d.z = min(d.z, -1e-4);
  vec3 inv = 1.0 / d;
  float tx = (sign(d.x) * 0.5 - o.x) * inv.x;
  float ty = (sign(d.y) * 0.5 - o.y) * inv.y;
  float tz = (-1.0 - o.z) * inv.z;
  float tm = min(min(tx, ty), tz);
  hit = o + d * tm;
  float depth = clamp(-hit.z, 0.0, 1.0);
  float lum;
  if (tm == tz) {
    wall = 0.0;
    // parede do fundo: abajur e, em metade das salas, uma silhueta de gente
    float lampX = (h1(seed * 7.1) - 0.5) * 0.6;
    float lamp = 1.0 - smoothstep(0.0, 0.55, length(hit.xy - vec2(lampX, 0.2)));
    lum = 0.42 + 0.6 * lamp;
    if (h1(seed * 3.7) > 0.45) {
      float px = (h1(seed * 5.3) - 0.5) * 0.5;
      float head = 1.0 - smoothstep(0.065, 0.075, length((hit.xy - vec2(px, 0.02)) * vec2(1.0, 0.9)));
      vec2 b = abs(hit.xy - vec2(px, -0.32));
      float body = (1.0 - step(0.13 - (hit.y + 0.06) * 0.08, b.x)) * (1.0 - step(0.26, b.y));
      lum *= 1.0 - 0.82 * max(head, body);
    }
  } else if (tm == ty) {
    wall = d.y < 0.0 ? 1.0 : 2.0;
    lum = d.y < 0.0 ? 0.22 + 0.1 * step(0.5, fract(hit.z * 4.0 + hit.x * 0.0)) : 0.55 + 0.6 * (1.0 - smoothstep(0.0, 0.5, length(hit.xz - vec2(0.0, -0.4))));
  } else {
    wall = 3.0;
    lum = 0.32 + 0.12 * step(0.5, h1(floor(hit.z * 3.0) + seed));
  }
  return lum * mix(1.0, 0.55, depth);
}

vec3 kindColor(float kind, float lum, float refl) {
  if (kind > 1.5) return uFriend * lum;
  if (kind > 0.5) return uLit * lum;
  return uSky * (0.035 + refl);
}

void main() {
  float seed = vInfo.x;
  int flags = int(vInfo.y + 0.5);
  float floorI = vInfo.z;
  vec2 uv = vUv;
  if (uReflect > 0.5) uv.x += sin(vWorldY * 7.0 + uTime * 1.6) * 0.035;

  vec3 hit; float wall;
  float lum = roomLum(vO, vD, seed, hit, wall);
  float fres = pow(1.0 - clamp(abs(normalize(vD).z), 0.0, 1.0), 3.0);
  float refl = 0.06 + 0.4 * fres + 0.06 * smoothstep(0.3, 1.0, uv.y);

  float t = uTime - vState.z;
  float prevK = vState.x;
  float kind = vState.y;
  // Acender: a lâmpada pega, falha e firma (600 ms). Apagar: some em 450 ms.
  float m;
  if (kind > 0.5) {
    float flick = t < 0.34 ? step(0.45, h1(floor(t * 26.0) + seed * 91.0)) * smoothstep(0.0, 0.03, t) : 1.0;
    m = t < 0.0 ? 0.0 : flick * (1.0 + 0.35 * exp(-max(t - 0.34, 0.0) * 9.0) * step(0.34, t));
  } else {
    m = smoothstep(0.0, 0.45, t);
  }
  vec3 col = mix(kindColor(prevK, lum, refl), kindColor(kind, lum, refl), m);
  float litNow = kind > 0.5 ? m : (1.0 - m) * step(0.5, prevK);

  // Persiana (em partida) e cortina (com convite)
  if ((flags & 1) != 0) {
    float slat = step(0.42, fract(uv.y * 11.0));
    col *= mix(0.18, 1.0, slat);
  }
  if ((flags & 2) != 0) {
    float cx = abs(uv.x - 0.5);
    float curtain = smoothstep(0.1, 0.13, cx);
    float fold = 0.55 + 0.45 * sin(uv.x * 70.0);
    vec3 cloth = uLit * vec3(0.9, 0.42, 0.26) * 0.38 * fold * max(litNow, 0.15);
    col = mix(col, cloth, curtain);
    // Lobby com convite: uma vela acesa no peitoril, atrás do vidro (a chama treme).
    float fl = 0.85 + 0.15 * sin(uAmb * 13.0 + seed * 40.0) * sin(uAmb * 7.3 + seed * 9.0);
    vec2 cv = (uv - vec2(0.445 + sin(uAmb * 3.1 + seed * 20.0) * 0.006, 0.27)) * vec2(1.0, 0.55);
    float flame = 1.0 - smoothstep(0.012, 0.03, length(cv));
    float wick = (1.0 - step(0.02, abs(uv.x - 0.445))) * step(0.08, uv.y) * (1.0 - step(0.2, uv.y));
    col = mix(col, vec3(0.22, 0.2, 0.17), wick);
    col += uLit * (flame * 1.6 + exp(-length(cv) * 9.0) * 0.35) * fl;
  }

  // Foco (linha da lista em hover/foco): o andar inteiro acende um pouco mais.
  float focus = 1.0 - step(0.5, abs(floorI - uFocus));
  col *= 1.0 + 0.55 * focus;

  // Esquadria de aço com travessa: déco, não "janela de casinha".
  vec2 e = min(uv, 1.0 - uv);
  float frame = 1.0 - step(0.05, min(e.x * 1.45, e.y));
  float mull = 1.0 - step(0.014, abs(uv.x - 0.5));
  float tran = 1.0 - step(0.012, abs(uv.y - 0.7));
  float bars = max(frame, max(mull, tran));
  vec3 frameCol = (flags & 4) != 0 ? uMine : uFrame * (1.0 + focus * 3.0);
  col = mix(col, frameCol, bars);

  // Andar se desfazendo (ou sendo conjurado): o reflexo usa a altura espelhada.
  col += uBurn * trMelt(vec3(vWorld.x, abs(vWorld.y), vWorld.z), vMelt) * 1.4;

  float alpha = 1.0;
  if (uReflect > 0.5) {
    col *= 0.8;
    alpha = smoothstep(-15.0, -0.4, vWorldY) * 0.9;
  }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export interface WindowUniforms {
  [k: string]: THREE.IUniform;
}

export function createWindowMaterial(reflect: boolean, winW: number, winH: number) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uAmb: { value: 0 },
        uFocus: { value: -1 },
        uReflect: { value: reflect ? 1 : 0 },
        uWin: { value: new THREE.Vector2(winW, winH) },
        uLit: { value: new THREE.Color(2.6, 1.45, 0.52) },
        uFriend: { value: new THREE.Color(0.55, 1.75, 1.35) },
        uSky: { value: new THREE.Color(0.28, 0.36, 0.52) },
        uFrame: { value: new THREE.Color(0.06, 0.05, 0.035) },
        uMine: { value: new THREE.Color(0.5, 1.6, 1.25) },
        uBurn: { value: new THREE.Color(4.2, 1.7, 0.42) },
      },
    ]),
    vertexShader: WINDOW_VERT,
    fragmentShader: WINDOW_FRAG,
    fog: true,
    transparent: reflect,
    depthWrite: !reflect,
    side: reflect ? THREE.DoubleSide : THREE.FrontSide,
  });
}

/* ───────── Céu: anil em cima, névoa no horizonte, luz de sódio da cidade embaixo ───────── */

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uFlash;
uniform vec2 uFlashDir;
varying vec3 vDir;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float h = vDir.y;
  vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.22, h));
  col = mix(col, uTop, smoothstep(0.2, 0.85, h));
  // brilho baixo da cidade (sódio refletido na névoa), concentrado atrás da torre
  float az = 1.0 - smoothstep(0.0, 1.6, abs(atan(vDir.x, -vDir.z)));
  col += uGlow * (1.0 - smoothstep(-0.05, 0.16, h)) * (0.55 + 0.45 * az);
  // Relâmpago distante: a névoa do horizonte acende de um lado e recorta a cidade.
  float fa = pow(max(0.0, dot(normalize(vDir.xz + 1e-4), uFlashDir)), 3.0);
  col += vec3(0.5, 0.6, 0.95) * uFlash * smoothstep(-0.05, 0.12, h) * (1.0 - smoothstep(0.12, 0.7, h)) * (0.25 + 0.75 * fa);
  // pontilhado azul contra faixas de gradiente (8 bits)
  col += (h2(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uFlash: { value: 0 },
      uFlashDir: { value: new THREE.Vector2(0, -1) },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

/* ───────── Lençóis de névoa: ruído em textura, sem geometria ───────── */

const SHEET_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const SHEET_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D tNoise;
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz * 0.012;
  float n = texture2D(tNoise, p + vec2(uTime * 0.004, uTime * 0.0015)).r;
  float n2 = texture2D(tNoise, p * 2.3 - vec2(uTime * 0.006, 0.0)).r;
  float a = smoothstep(0.35, 0.85, n * 0.65 + n2 * 0.5);
  float near = smoothstep(4.0, 22.0, distance(vWorld, cameraPosition));
  gl_FragColor = vec4(uColor, a * uOpacity * near);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createFogSheetMaterial(noise: THREE.Texture) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { tNoise: { value: null }, uTime: { value: 0 }, uOpacity: { value: 0.32 }, uColor: { value: new THREE.Color() } },
    ]),
    vertexShader: SHEET_VERT,
    fragmentShader: SHEET_FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
  });
  // merge() clona os uniforms; a textura entra depois para não ser copiada.
  mat.uniforms.tNoise!.value = noise;
  return mat;
}

/* ───────── Cone de luz do poste: aditivo, some nas bordas (fresnel) ───────── */

const CONE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vH;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  vec4 world = m * vec4(position, 1.0);
  vN = normalize(mat3(m) * normal);
  vV = normalize(cameraPosition - world.xyz);
  vH = uv.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const CONE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vN;
varying vec3 vV;
varying float vH;
void main() {
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float fall = pow(vH, 1.8);
  gl_FragColor = vec4(uColor * edge * fall * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createConeMaterial(color: THREE.Color, intensity: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uIntensity: { value: intensity } },
    vertexShader: CONE_VERT,
    fragmentShader: CONE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/* ───────── Composição (só no nível alto) ───────── */

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const POST_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uTrans;
uniform float uDawn;
varying vec2 vUv;
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  // Aberração cromática: quase nada no centro, mais nas bordas e na travessia do chão.
  float ca = 0.004 * r2 + uTrans * 0.018;
  vec3 col;
  col.r = texture2D(tScene, uv + c * ca).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - c * ca).b;
  // Bloom barato: as mips do próprio quadro (a GPU já faz o desfoque ao gerar a mip).
  vec3 b = textureLod(tScene, uv, 2.0).rgb * 0.5
         + textureLod(tScene, uv, 3.5).rgb * 0.35
         + textureLod(tScene, uv, 5.0).rgb * 0.3;
  col += max(b - vec3(0.42), vec3(0.0)) * 0.9;
  // Vinheta oval
  float v = smoothstep(1.0, 0.28, length(c * vec2(1.0, 1.2)));
  col *= mix(mix(0.42, 0.7, uDawn), 1.0, v);
  col *= 1.0 - uTrans * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Grão de filme depois do tone mapping (espaço de tela), mais fraco de dia.
  float g = h2(uv * uRes + fract(uTime * 7.31) * 113.0) - 0.5;
  gl_FragColor.rgb += g * mix(0.05, 0.028, uDawn);
}
`;

export function createPostMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uTrans: { value: 0 },
      uDawn: { value: 0 },
    },
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    depthTest: false,
    depthWrite: false,
  });
}
