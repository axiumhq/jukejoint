import * as THREE from 'three';

/**
 * Luz ilustrativa (item 3 do plano v5) e dissolução por brasa (itens 1 e 5), costuradas
 * nos materiais do three por `onBeforeCompile`, sem trocar de material:
 *
 *  - Rampa quente e fria: o lado virado para os postes de sódio puxa para o âmbar; o lado
 *    da lua cai para o azul-safira, nunca para o preto (o jeito Valve/TF2).
 *  - Contorno de luz (rim): azul frio onde a lua bate por trás, âmbar embaixo.
 *  - Fio de aresta: as caixas unitárias (atributo `aBox`) ganham um filete de luz nas
 *    arestas, calculado em metros pela escala da instância. Parece chanfro, custa zero
 *    geometria.
 *  - Vazamento de luz pelo vão (cena 2): faces de cima e de baixo dos corpos dos andares
 *    brilham âmbar conforme a separação (`uMat.w`).
 *  - Dissolução (`aMelt` por instância, 0 = inteiro, 1 = sumiu): ruído 3D no espaço do
 *    mundo, borda queimando em âmbar. Malhas sem o atributo leem 0 e ficam inteiras.
 *
 * v5 leva 2:
 *  - Material único do kit (`kit: true`): a cor, a rugosidade, o metal e a luz própria saem
 *    de uma tabela pela classe do material por vértice (`aCls`, ver `CLS` em kit.ts). Uma
 *    peça inteira do Blender = uma chamada de desenho. As janelas da cidade (azul frio, com
 *    tremor irregular e uma onda âmbar quando um lobby lota) moram aqui.
 *  - Micro-detalhe procedural (só no nível alto, sem textura): riscos verticais no latão,
 *    verdete juntando nas faces de cima, chuva escorrendo de baixo dos ressaltos, veios na
 *    obsidiana, fuligem perto do chão e desgaste nos chanfros do kit.
 *  - A chama fria do farol ilumina a coroa (luz falsa, sem luz pontual nova) e o relâmpago
 *    distante recorta as faces viradas para a lua.
 */

/** Uniforms compartilhados por todos os materiais da torre (um objeto, atualizado uma vez por quadro). */
export const IL = {
  uMoonV: { value: new THREE.Vector3(0, 1, 0) },
  uWarmV: { value: new THREE.Vector3(0, 0, 1) },
  uCool: { value: new THREE.Color(0.05, 0.09, 0.2) },
  uWarm: { value: new THREE.Color(0.34, 0.17, 0.05) },
  uRimCool: { value: new THREE.Color(0.32, 0.5, 1.1) },
  uRimWarm: { value: new THREE.Color(1.2, 0.6, 0.2) },
  uBurn: { value: new THREE.Color(4.2, 1.7, 0.42) },
  uLeakCol: { value: new THREE.Color(2.6, 1.35, 0.45) },
  /** Farol: posição em espaço de vista (xyz) e força (w). */
  uBeacon: { value: new THREE.Vector4() },
  uBeaconCol: { value: new THREE.Color(0.35, 0.65, 2.0) },
  uFlash: { value: 0 },
  uFlashCol: { value: new THREE.Color(0.55, 0.65, 1.0) },
  /** Relógio ambiente (parado com movimento reduzido). */
  uAmb: { value: 0 },
  /** Onda de janelas da cidade: x = instante em que um lobby lotou. */
  uBurst: { value: new THREE.Vector4(-100, 0, 0, 0) },
  uWinCold: { value: new THREE.Color(0.5, 0.66, 1.05) },
  uWinWarm: { value: new THREE.Color(1.05, 0.68, 0.36) },
  uWinBurst: { value: new THREE.Color(2.4, 1.3, 0.42) },
  uKCol: { value: [] as THREE.Color[] },
  uKRM: { value: [] as THREE.Vector2[] },
  uKEm: { value: [] as THREE.Color[] },
};

/** Tabela do material do kit, na ordem de `CLS` (kit.ts): cor, rugosidade, metal, luz própria. */
const KIT_TABLE: [string, number, number, [number, number, number]?][] = [
  ['#06080b', 0.16, 0.35],
  ['#0b0e12', 0.42, 0.25],
  ['#b98d48', 0.34, 1],
  ['#7d5f30', 0.45, 1],
  ['#3f7f6c', 0.6, 0.4],
  ['#111419', 0.78, 0],
  ['#000000', 0.9, 0, [1.5, 0.82, 0.36]],
  ['#000000', 0.9, 0, [0.45, 0.85, 2.6]],
  ['#16191e', 0.5, 0.75],
  ['#06080c', 0.12, 0.3],
  ['#05070a', 0.07, 0.45],
  ['#1a1208', 0.6, 0, [3.2, 1.75, 0.55]],
  ['#2c2925', 0.85, 0],
  ['#1a1208', 0.6, 0, [3.0, 1.6, 0.5]],
  ['#0a0806', 0.3, 0, [1.6, 0.95, 0.42]],
  ['#101216', 0.2, 0.6, [2.6, 2.8, 3.2]],
];
for (const [hex, r, m, e] of KIT_TABLE) {
  IL.uKCol.value.push(new THREE.Color(hex));
  IL.uKRM.value.push(new THREE.Vector2(r, m));
  IL.uKEm.value.push(e ? new THREE.Color(...e) : new THREE.Color(0, 0, 0));
}

const MOON_W = new THREE.Vector3(-0.45, 0.62, -0.64).normalize();
const WARM_W = new THREE.Vector3(0.25, -0.12, 1).normalize();
const tmpV = new THREE.Vector3();

/** Direções de luz e o farol em espaço de vista (a rampa e o contorno trabalham com a normal de vista). */
export function updateIllus(camera: THREE.Camera, beacon?: THREE.Vector3, beaconI = 0) {
  IL.uMoonV.value.copy(MOON_W).transformDirection(camera.matrixWorldInverse);
  IL.uWarmV.value.copy(WARM_W).transformDirection(camera.matrixWorldInverse);
  if (beacon) {
    tmpV.copy(beacon).applyMatrix4(camera.matrixWorldInverse);
    IL.uBeacon.value.set(tmpV.x, tmpV.y, tmpV.z, beaconI);
  }
}

/** Micro-detalhe só no nível alto (programa próprio). */
let detail = false;
export const setIllusDetail = (on: boolean) => (detail = on);

/** Ruído 3D barato + dissolução. Também usado pelo shader das janelas e pelos fachos. */
export const MELT_GLSL = /* glsl */ `
float trHash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float trNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(trHash3(i), trHash3(i + vec3(1, 0, 0)), f.x), mix(trHash3(i + vec3(0, 1, 0)), trHash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(trHash3(i + vec3(0, 0, 1)), trHash3(i + vec3(1, 0, 1)), f.x), mix(trHash3(i + vec3(0, 1, 1)), trHash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
// Devolve o quanto a borda queima (0..1); descarta o que já virou fumaça.
float trMelt(vec3 wp, float m) {
  if (m <= 0.001) return 0.0;
  float n = trNoise(wp * 2.3) * 0.62 + trNoise(wp * 7.1) * 0.38;
  float th = m * 1.16 - 0.08;
  if (n < th) discard;
  return 1.0 - smoothstep(0.0, 0.07, n - th);
}
`;

const VERT_PARS = /* glsl */ `
attribute float aBox;
attribute float aMelt;
attribute float aCls;
attribute float aWin;
attribute vec4 aInst;
uniform float uCls;
varying vec3 vTrLocal;
varying vec3 vTrLocalN;
varying vec3 vTrScale;
varying vec3 vTrW;
varying vec3 vTrWN;
varying float vTrBox;
varying float vTrMelt;
varying float vTrCls;
varying float vTrWin;
varying vec2 vTrInst;
`;

const VERT_MAIN = /* glsl */ `
{
  mat4 trM = modelMatrix;
  #ifdef USE_INSTANCING
    trM = trM * instanceMatrix;
  #endif
  vTrLocal = position;
  vTrLocalN = normal;
  vTrScale = vec3(length(trM[0].xyz), length(trM[1].xyz), length(trM[2].xyz));
  vTrW = (trM * vec4(transformed, 1.0)).xyz;
  vTrWN = normalize(mat3(trM) * normal);
  vTrBox = aBox;
  vTrMelt = aMelt;
  vTrCls = uCls >= 0.0 ? uCls : aCls;
  vTrWin = aWin;
  vTrInst = aInst.xy;
}
`;

const FRAG_PARS = /* glsl */ `
uniform vec3 uMoonV;
uniform vec3 uWarmV;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uRimCool;
uniform vec3 uRimWarm;
uniform vec3 uBurn;
uniform vec3 uLeakCol;
uniform vec4 uMat; // x aresta, y rampa, z contorno, w vazamento pelo vão
uniform vec4 uBeacon;
uniform vec3 uBeaconCol;
uniform float uFlash;
uniform vec3 uFlashCol;
uniform float uAmb;
uniform vec4 uBurst;
uniform vec3 uWinCold;
uniform vec3 uWinWarm;
uniform vec3 uWinBurst;
uniform vec3 uKCol[16];
uniform vec2 uKRM[16];
uniform vec3 uKEm[16];
varying vec3 vTrLocal;
varying vec3 vTrLocalN;
varying vec3 vTrScale;
varying vec3 vTrW;
varying vec3 vTrWN;
varying float vTrBox;
varying float vTrMelt;
varying float vTrCls;
varying float vTrWin;
varying vec2 vTrInst;
${MELT_GLSL}
`;

/** Cor da tabela (kit) e micro-detalhe, antes da luz. */
const FRAG_COLOR = (d: boolean) => /* glsl */ `
float trC = vTrCls;
int trI = int(trC + 0.5);
#ifdef TR_KIT
  diffuseColor.rgb = uKCol[trI] * (1.0 + vTrInst.y);
#endif
float trStreak = 0.0, trPat = 0.0, trVein = 0.0, trWear = 0.0, trBrush = 0.0;
${
  d
    ? `{
  vec3 trP = vTrW;
  float trSurf = (trC < 5.5 || abs(trC - 8.0) < 0.5 || abs(trC - 12.0) < 0.5) ? 1.0 : 0.0;
  float trBrass = step(1.5, trC) * step(trC, 3.5);
  float trNear = 1.0 - smoothstep(18.0, 60.0, length(vViewPosition));
  float trGrime = 0.0;
  // Cada termo só roda na classe que o usa (o ramo é coerente por objeto).
  if (trSurf > 0.5) {
    // Chuva escorrendo: mais forte logo abaixo de cada ressalto (andares de 1 m).
    trStreak = smoothstep(0.58, 0.9, trNoise(vec3((trP.x + trP.z) * 5.0, trP.y * 0.4, 3.1))) * (1.0 - abs(vTrWN.y));
    trStreak *= 0.4 + 0.6 * (1.0 - fract(0.2 - trP.y));
    if (trP.y < 3.5) trGrime = (1.0 - smoothstep(0.0, 3.5, trP.y)) * (0.5 + 0.5 * trNoise(trP * 1.3));
  }
  if (trBrass > 0.5) {
    // Verdete: junta nas faces de cima e onde a chuva escorre; latão escovado em riscos verticais.
    trPat = smoothstep(0.5, 0.85, trNoise(trP * 2.7) * 0.6 + max(vTrWN.y, 0.0) * 0.45 + trStreak * 0.5);
    if (trNear > 0.0) trBrush = (trNoise(vec3((trP.x + trP.z) * 70.0, trP.y * 2.5, 0.0)) - 0.5) * trNear;
  }
  if (trC < 1.5) trVein = (1.0 - smoothstep(0.0, 0.05, abs(sin(dot(trP, vec3(1.1, 0.6, 0.8)) * 1.9 + trNoise(trP * 1.4) * 5.0)))) * smoothstep(0.4, 0.7, trNoise(trP * 0.5 + 7.0));
  // Desgaste nos chanfros do kit (faces que não são de eixo).
  float trAx = max(max(abs(vTrLocalN.x), abs(vTrLocalN.y)), abs(vTrLocalN.z));
  trWear = (1.0 - smoothstep(0.8, 0.97, trAx)) * step(trC, 3.5) * trNear;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.2, 0.15), trPat * 0.8);
  diffuseColor.rgb += vec3(0.06, 0.08, 0.09) * trVein;
  diffuseColor.rgb *= (1.0 - 0.4 * trStreak) * (1.0 - 0.35 * trGrime) * (1.0 + trBrush * 0.5);
  diffuseColor.rgb += trWear * mix(vec3(0.02), diffuseColor.rgb * 0.8, trBrass);
}`
    : ''
}
`;

const FRAG_ROUGH = /* glsl */ `
#ifdef TR_KIT
  roughnessFactor = uKRM[trI].x;
#endif
roughnessFactor = clamp(roughnessFactor + trBrush * 0.3 + trPat * 0.35 - trStreak * 0.15 - trWear * 0.15 + trVein * 0.1, 0.04, 1.0);
`;

const FRAG_METAL = /* glsl */ `
#ifdef TR_KIT
  metalnessFactor = uKRM[trI].y;
#endif
metalnessFactor *= 1.0 - trPat * 0.6;
`;

/** Rampa + contorno + aresta + vazamento + farol + relâmpago (+ luz própria do kit). */
const FRAG_LIT = /* glsl */ `
{
  vec3 trN = normalize(normal);
  vec3 trV = normalize(vViewPosition);
  float trWarmF = dot(trN, uWarmV);
  float trMoonF = dot(trN, uMoonV);
  float trAlb = dot(diffuseColor.rgb, vec3(0.3333));
  // Rampa: sombra fria em vez de preta; lado do sódio puxando para o âmbar.
  vec3 trRamp = mix(uCool, uWarm, smoothstep(-0.55, 0.75, trWarmF));
  outgoingLight += trRamp * uMat.y * (0.16 + trAlb);
  // Contorno: frio onde a lua chega por trás, quente onde o sódio chega de baixo.
  float trRim = pow(1.0 - clamp(dot(trN, trV), 0.0, 1.0), 3.0);
  outgoingLight += trRim * uMat.z * (uRimCool * clamp(trMoonF * 0.7 + 0.45, 0.0, 1.0) + uRimWarm * clamp(-trN.y * 0.6 + trWarmF * 0.35, 0.0, 1.0) * 0.55);
  // A chama fria do farol lambe a coroa.
  if (uBeacon.w > 0.001) {
    vec3 trL = uBeacon.xyz + vViewPosition;
    float trD2 = dot(trL, trL);
    outgoingLight += uBeaconCol * uBeacon.w * max(dot(trN, trL * inversesqrt(trD2)), 0.0) * (0.25 + trAlb) / (1.0 + trD2 * 0.12);
  }
  outgoingLight += uFlashCol * uFlash * clamp(trMoonF * 0.6 + 0.5, 0.0, 1.0) * (0.15 + trAlb);
  if (vTrBox > 0.5) {
    // Distância (em metros) até a aresta mais próxima da face atual.
    vec3 trD = (0.5 - abs(vTrLocal)) * vTrScale + abs(vTrLocalN) * 1e3;
    float trE = min(min(trD.x, trD.y), trD.z);
    float trAA = max(0.022, fwidth(trE) * 1.5);
    float trEdge = 1.0 - smoothstep(0.0, trAA, trE);
    vec3 trEdgeCol = mix(uRimCool * 0.8, uRimWarm * 1.15, smoothstep(-0.3, 0.6, trWarmF));
    outgoingLight += trEdge * uMat.x * trEdgeCol * (0.35 + 0.65 * max(trRim, max(trWarmF, trMoonF * 0.8)));
    // Luz do interior vazando pelo vão entre andares.
    if (uMat.w > 0.001) {
      float trCap = step(0.499, abs(vTrLocal.y));
      vec2 trQ = abs(vTrLocal.xz) * 2.0;
      float trCenter = 1.0 - smoothstep(0.15, 1.0, max(trQ.x, trQ.y));
      float trSide = (1.0 - trCap) * exp(-(0.5 - abs(vTrLocal.y)) * vTrScale.y * 16.0);
      outgoingLight += uLeakCol * uMat.w * (trCap * (0.25 + 0.75 * trCenter) + trSide * 0.7);
    }
  }
#ifdef TR_KIT
  vec3 trEm = uKEm[trI];
  if (trI == 9 || trI == 10) {
    // Janelas da cidade: azul frio, umas poucas quentes; algumas trocam de estado devagar,
    // poucas tremem (televisão). Nada disso é dado: o âmbar de "gente" é da torre.
    float s = fract(vTrWin * 13.7 + vTrInst.x * 3.1);
    float on = trI == 9 ? step(0.2, fract(s * 7.13)) : step(0.95, fract(s * 5.31));
    on *= step(0.1, fract(sin(floor(uAmb / 29.0 + s * 13.0) * 91.7 + s * 47.0) * 437.5));
    float tv = step(0.965, s) * (0.5 + 0.5 * sin(uAmb * (7.0 + s * 19.0)));
    trEm = mix(uWinCold, uWinWarm, step(0.9, fract(s * 3.7))) * on * (0.55 + 0.6 * fract(s * 11.0)) * (1.0 - 0.35 * tv);
    // Um lobby lotou: uma onda âmbar sai da torre e acende janelas da cidade por um instante.
    float bt = uAmb - uBurst.x - length(vTrW.xz) / 34.0;
    trEm += uWinBurst * step(0.0, bt) * exp(-bt * 1.7) * step(0.45, s) * (1.0 - smoothstep(60.0, 110.0, length(vTrW.xz)));
  }
  // Letreiro: as lâmpadas da moldura correm em volta (perseguição).
  if (trI == 13) trEm *= 0.25 + 0.75 * step(0.5, fract(atan(vTrLocal.y - 2.75, vTrLocal.x * 0.45) / 6.2831 * 22.0 - uAmb * 1.2));
  outgoingLight += trEm;
#endif
}
`;

const FRAG_MELT = /* glsl */ `
outgoingLight += uBurn * trMelt(vTrW, vTrMelt) * 1.4;
`;

export interface IllusOpts {
  /** Força do fio de aresta, da rampa, do contorno. */
  edge?: number;
  ramp?: number;
  rim?: number;
  /** Só a dissolução (materiais sem luz: MeshBasicMaterial). */
  basic?: boolean;
  /** Classe do material para o micro-detalhe (CLS em kit.ts). Sem ela, a classe vem do vértice. */
  cls?: number;
  /** Material único do kit: cor, rugosidade, metal e luz própria pela tabela. */
  kit?: boolean;
}

/** Costura o shader ilustrativo num material. Devolve o uniform próprio dele (`uMat`). */
export function illus<T extends THREE.Material>(mat: T, o: IllusOpts = {}): { mat: T; uMat: { value: THREE.Vector4 } } {
  const uMat = { value: new THREE.Vector4(o.edge ?? 1, o.ramp ?? 1, o.rim ?? 1, 0) };
  const uCls = { value: o.cls ?? (o.kit ? -1 : 0) };
  const d = detail && !o.basic;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, IL, { uMat, uCls });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    let f = sh.fragmentShader.replace('#include <common>', `${o.kit ? '#define TR_KIT\n' : ''}#include <common>\n${FRAG_PARS}`);
    if (!o.basic) {
      f = f
        .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR(d)}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${FRAG_METAL}`);
    }
    sh.fragmentShader = f.replace('#include <opaque_fragment>', `${o.basic ? '' : FRAG_LIT}${FRAG_MELT}\n#include <opaque_fragment>`);
  };
  // Mesmo programa para todos os materiais da mesma família (luz × básico × kit; detalhe ou não).
  const key = `tr-${o.basic ? 'b' : o.kit ? 'k' : 'l'}${d ? 'd' : ''}`;
  mat.customProgramCacheKey = () => key;
  return { mat, uMat };
}

/** Atributo por vértice que marca a caixa unitária (aresta calculável no shader). */
export function markBox(geo: THREE.BufferGeometry) {
  const n = geo.attributes.position!.count;
  geo.setAttribute('aBox', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
  return geo;
}

/** Atributo de dissolução por instância (um por InstancedMesh, já que as geometrias são clonadas). */
export function meltAttr(geo: THREE.BufferGeometry, count: number) {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aMelt', a);
  return a;
}
