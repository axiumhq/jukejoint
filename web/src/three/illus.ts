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
};

const MOON_W = new THREE.Vector3(-0.45, 0.62, -0.64).normalize();
const WARM_W = new THREE.Vector3(0.25, -0.12, 1).normalize();

/** Direções de luz em espaço de vista (a rampa e o contorno trabalham com a normal de vista). */
export function updateIllus(camera: THREE.Camera) {
  IL.uMoonV.value.copy(MOON_W).transformDirection(camera.matrixWorldInverse);
  IL.uWarmV.value.copy(WARM_W).transformDirection(camera.matrixWorldInverse);
}

/** Ruído 3D barato + dissolução. Também usado pelo shader das janelas. */
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
varying vec3 vTrLocal;
varying vec3 vTrLocalN;
varying vec3 vTrScale;
varying vec3 vTrW;
varying float vTrBox;
varying float vTrMelt;
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
  vTrBox = aBox;
  vTrMelt = aMelt;
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
varying vec3 vTrLocal;
varying vec3 vTrLocalN;
varying vec3 vTrScale;
varying vec3 vTrW;
varying float vTrBox;
varying float vTrMelt;
${MELT_GLSL}
`;

/** Rampa + contorno + aresta + vazamento. Precisa de `normal` e `vViewPosition` (material com luz). */
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
}

/** Costura o shader ilustrativo num material. Devolve o uniform próprio dele (`uMat`). */
export function illus<T extends THREE.Material>(mat: T, o: IllusOpts = {}): { mat: T; uMat: { value: THREE.Vector4 } } {
  const uMat = { value: new THREE.Vector4(o.edge ?? 1, o.ramp ?? 1, o.rim ?? 1, 0) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, IL, { uMat });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <opaque_fragment>', `${o.basic ? '' : FRAG_LIT}${FRAG_MELT}\n#include <opaque_fragment>`);
  };
  // Mesmo programa para todos os materiais da mesma família (luz × básico).
  mat.customProgramCacheKey = () => (o.basic ? 'tr-illus-basic' : 'tr-illus-lit');
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
