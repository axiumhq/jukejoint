import * as THREE from 'three';
import { advanceObra, OBRA, planObra, ramp, type ObraPlan } from '../lib/obra';
import type { TowerFloor, WindowKind } from '../lib/towerData';
import { IL, illus, markBox, meltAttr, updateIllus } from './illus';
import { loadKit, type Kit, type KitMaterial, type KitPiece } from './kit';
import { createEmbers, createFlame, createForeground, createRitualCircle, createThreadMaterial, EMBER } from './occult';
import { createConeMaterial, createFogSheetMaterial, createSkyMaterial, createWindowMaterial } from './shaders';
import { makeBrushedTexture, makeNewspaperTexture, makeNoiseTexture } from './textures';

/**
 * O mundo da Torre, montado em código a partir dos andares (lobbies).
 * Tudo que se repete é instanciado (uma chamada de desenho por tipo de peça).
 *
 * Coordenadas: a torre nasce em (0, 0, 0), a rua corre na frente (z positivo).
 * O cofre (cenas 3 a 5) fica no porão, em y ≈ −44; a câmera atravessa o chão.
 *
 * v5 (onda 1): a torre não aparece pronta. A abertura "Obra Encantada" (lib/obra.ts)
 * e as mudanças ao vivo (andar conjurado, andar desfeito) são um estado de obra por
 * andar, lido em `layout()` a cada quadro enquanto algo se move. Um relógio próprio
 * (`clock`) corre junto com o tempo real e acelera quando o usuário pula a abertura;
 * os shaders de janela, brasa, fio e chama leem esse relógio.
 */

export type Quality = 'high' | 'mid';

export const FLOOR_H = 1;
const PLINTH_H = 3.2;
const BAY = 0.62;
const PAD = 0.46;
const WIN_W = 0.4;
const WIN_H = 0.6;
const GAP = 1.05;
const MAX_FLOORS = 24;
const MAX_SLOTS = 12;
/** Andares em obra mais os que estão se desfazendo. */
const MAX_ITEMS = MAX_FLOORS + 4;
export const VAULT_FLOOR = -47;
export const RING_CENTER = new THREE.Vector3(0, VAULT_FLOOR, -4);
export const RING_R = 3.6;
export const DOOR_POS = new THREE.Vector3(-17.94, VAULT_FLOOR + 2.8, -4);
export const PLATE_POS = new THREE.Vector3(17.92, -43.2, 3);
/** Raio do círculo ritual na praça. */
const CIRCLE_R = 10.5;

const floorW = (slots: number) => slots * BAY + PAD * 2;
const floorD = (slots: number) => 1.5 + slots * 0.4;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutBack = (x: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

interface Palette {
  skyTop: string;
  skyMid: string;
  horizon: string;
  glow: string;
  fog: string;
  fogDensity: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  moon: string;
  moonI: number;
  ground: string;
  sheet: string;
  windowSky: [number, number, number];
  /** Luz ilustrativa: sombra fria, lado quente, contorno frio e quente. */
  cool: [number, number, number];
  warm: [number, number, number];
  rimCool: [number, number, number];
  rimWarm: [number, number, number];
}

/* Duas temperaturas (v5): âmbar é gente (janelas, brasas, sódio); azul-safira é o
 * sobrenatural (lua, céu alto, círculo, farol). O verdete continua sendo amigo. */
const PALETTES: Record<'night' | 'dawn', Palette> = {
  night: {
    skyTop: '#02050d',
    skyMid: '#0a1430',
    horizon: '#1a1f2c',
    glow: '#55341a',
    fog: '#10151d',
    fogDensity: 0.0108,
    hemiSky: '#263a68',
    hemiGround: '#0b0806',
    hemi: 0.42,
    moon: '#7f9df0',
    moonI: 0.55,
    ground: '#0a0d11',
    sheet: '#39414f',
    windowSky: [0.24, 0.33, 0.55],
    cool: [0.035, 0.07, 0.18],
    warm: [0.3, 0.15, 0.045],
    rimCool: [0.3, 0.5, 1.15],
    rimWarm: [1.15, 0.58, 0.18],
  },
  dawn: {
    skyTop: '#33476b',
    skyMid: '#8593ad',
    horizon: '#d7bc9d',
    glow: '#e39a5c',
    fog: '#a9a4a0',
    fogDensity: 0.0105,
    hemiSky: '#c5cfe4',
    hemiGround: '#40342a',
    hemi: 0.95,
    moon: '#ffd3a3',
    moonI: 1.15,
    ground: '#23262b',
    sheet: '#d8d2cb',
    windowSky: [0.75, 0.72, 0.74],
    // De dia a luz já vem do céu claro: a rampa e o contorno só temperam.
    cool: [0.05, 0.07, 0.12],
    warm: [0.12, 0.08, 0.04],
    rimCool: [0.22, 0.28, 0.42],
    rimWarm: [0.42, 0.28, 0.14],
  },
};

const VAULT_FOG = new THREE.Color('#0c0b0a');

export interface FrameState {
  time: number;
  dt: number;
  explode: number;
  vaultRot: number;
  needle: number;
  doors: number;
  plateLight: number;
  wind: number;
  focus: number;
  underground: boolean;
  camera: THREE.Camera;
  /** Peso da cena 1 (o hero) na pose atual: mostra o primeiro plano desfocado. */
  hero: number;
  /** Progresso real do carregamento (0 a 1): os anéis do círculo ritual. */
  progress: number;
  /** Ponteiro suavizado (−1 a 1): paralaxe do primeiro plano. */
  pointer: THREE.Vector2;
  aspect: number;
  /** Altura do canvas em px (tamanho das brasas). */
  heightPx: number;
  /** (dev) Congela a abertura neste tempo, para capturas de tela (window.__torreObraT). */
  seek?: number;
}

/**
 * Como os andares chegam:
 *  - `instant`: prontos (remontagem por rebaixamento, movimento reduzido).
 *  - `hold`: escondidos até a abertura começar (o círculo já acende com o carregamento).
 *  - `live`: dado ao vivo; andar novo é conjurado, andar que sumiu se desfaz.
 */
export type FloorsMode = 'instant' | 'hold' | 'live';

export interface FloorsChange {
  /** Janelas que acenderam agora (alguém entrou). */
  lit: number;
  /** Números (1 = mais baixo) dos andares conjurados agora. */
  added: number[];
  removed: number;
}

export interface ObraStatus {
  /** Tempo da abertura (s). */
  t: number;
  plan: ObraPlan;
  done: boolean;
}

export interface World {
  scene: THREE.Scene;
  setFloors(floors: TowerFloor[], mode: FloorsMode): FloorsChange;
  /** Começa a abertura "Obra Encantada" (depois de compilar e pintar o primeiro quadro). `again` (dev) reinicia. */
  startOpening(again?: boolean): void;
  /** Gesto do usuário: o resto da abertura corre em ~300 ms. */
  skip(): void;
  obra(): ObraStatus | null;
  update(f: FrameState): void;
  setDawn(dawn: boolean, renderer: THREE.WebGLRenderer): void;
  /** Ponto da etiqueta do andar: à esquerda dos fios (desktop) ou rente à direita do andar (telas estreitas). */
  floorAnchor(i: number, out: THREE.Vector3, side?: 'left' | 'right'): boolean;
  /** Mira "+" da vista explodida: no remate direito da face do andar (fora das janelas). */
  floorMark(i: number, out: THREE.Vector3): boolean;
  /** Deixa tudo visível para compilar os shaders de uma vez (rua e porão). */
  showAll(): void;
  floorCount(): number;
  topY(): number;
  /** O kit glTF do Blender substituiu a geometria procedural. */
  usingKit(): boolean;
  dispose(): void;
}

/* ───────── Materiais ───────── */

function materials(q: Quality) {
  const brushed = makeBrushedTexture();
  // Luz ilustrativa só nos materiais da torre e da cidade (ver illus.ts).
  const obsidian = illus(new THREE.MeshStandardMaterial({ color: '#06080b', roughness: 0.16, metalness: 0.35, envMapIntensity: 1.25 }), { edge: 0.55 });
  // Corpos dos andares: o mesmo material com o vazamento de luz pelo vão (uMat.w).
  const floorBody = illus(new THREE.MeshStandardMaterial({ color: '#06080b', roughness: 0.16, metalness: 0.35, envMapIntensity: 1.25 }), { edge: 0.55 });
  const obsidianMatte = illus(new THREE.MeshStandardMaterial({ color: '#0b0e12', roughness: 0.42, metalness: 0.25 }), { edge: 0.4 });
  const brass = illus(new THREE.MeshStandardMaterial({ color: '#b98d48', roughness: 0.34, metalness: 1, envMapIntensity: 1.3 }), { edge: 1.6, ramp: 0.6, rim: 0.6 });
  const brassDark = illus(new THREE.MeshStandardMaterial({ color: '#7d5f30', roughness: 0.45, metalness: 1 }), { edge: 1.1, ramp: 0.6, rim: 0.6 });
  const verdigris = illus(new THREE.MeshStandardMaterial({ color: '#3f7f6c', roughness: 0.6, metalness: 0.4 }), { edge: 0.8 });
  const city = illus(new THREE.MeshStandardMaterial({ color: '#0a0d12', roughness: 0.92, metalness: 0 }), { edge: 0.12, ramp: 0.8, rim: 0.7 });
  const stone = illus(new THREE.MeshStandardMaterial({ color: '#111419', roughness: 0.78, metalness: 0 }), { edge: 0.35, rim: 0.5 });
  const frieze = illus(new THREE.MeshBasicMaterial({ color: '#ffffff' }), { basic: true });
  const signMat = illus(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.75, 0.55) }), { basic: true });
  return {
    obsidian: obsidian.mat,
    floorBody: floorBody.mat,
    floorLeak: floorBody.uMat,
    obsidianMatte: obsidianMatte.mat,
    brass: brass.mat,
    brassDark: brassDark.mat,
    verdigris: verdigris.mat,
    brassBrushed: new THREE.MeshStandardMaterial({
      color: '#c49a55',
      roughness: 0.42,
      metalness: 1,
      roughnessMap: brushed,
      envMapIntensity: 1.1,
    }),
    city: city.mat,
    stone: stone.mat,
    vaultWall: new THREE.MeshStandardMaterial({ color: '#0e1013', roughness: 0.82, metalness: 0.05, side: THREE.BackSide }),
    vaultFloor: new THREE.MeshStandardMaterial({ color: '#050608', roughness: 0.12, metalness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({
      color: '#0b1218',
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: q === 'high' ? 0.62 : 0.7,
      envMapIntensity: 2,
      depthWrite: false,
    }),
    sodium: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.75, 0.55) }),
    /** Vidro do kit: lanterna da coroa e olhos das gárgulas em azul frio (o sobrenatural). */
    coldGlow: illus(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.85, 2.6) }), { basic: true }).mat,
    /** Vidro do kit no saguão: janelas do térreo acesas em âmbar (gente). */
    warmGlow: illus(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.82, 0.36) }), { basic: true }).mat,
    sign: signMat.mat,
    sodiumDim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.2, 0.08) }),
    warm: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.95, 0.42) }),
    frieze: frieze.mat,
    line: new THREE.LineBasicMaterial({ color: new THREE.Color(1.9, 1.25, 0.55), transparent: true, opacity: 0.85 }),
    lineDim: new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.42, 0.24), transparent: true, opacity: 0.7 }),
    engrave: new THREE.LineBasicMaterial({ color: '#3a2a12' }),
    brushed,
  };
}

type Mats = ReturnType<typeof materials>;

/** Caixa unitária com o atributo de aresta (fio de luz no shader ilustrativo). */
const unitBox = markBox(new THREE.BoxGeometry(1, 1, 1));

function inst(geo: THREE.BufferGeometry, mat: THREE.Material, count: number) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  m.frustumCulled = false;
  return m;
}

/** InstancedMesh por andar: geometria própria (para ter o atributo de dissolução dela). */
function floorInst(mat: THREE.Material, count: number, geo: THREE.BufferGeometry = unitBox) {
  const g = geo.clone();
  const melt = meltAttr(g, count);
  return { mesh: inst(g, mat, count), melt };
}

/* ───────── Motivos dos modos, em linha de latão (cartas-relicário) ───────── */

function motifSegments(motif: string): number[] {
  const s: number[] = [];
  const seg = (x1: number, y1: number, x2: number, y2: number, z = 0) => s.push(x1, y1, z, x2, y2, z);
  const circle = (cx: number, cy: number, r: number, n = 48, z = 0, dash = false) => {
    for (let i = 0; i < n; i++) {
      if (dash && i % 2) continue;
      const a1 = (i / n) * Math.PI * 2;
      const a2 = ((i + 1) / n) * Math.PI * 2;
      seg(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, z);
    }
  };
  switch (motif) {
    case 'rings': {
      circle(0, 0.15, 0.62, 64, -0.02, true);
      circle(0, 0.15, 0.42, 48, 0.02);
      circle(0, 0.15, 0.14, 24, 0.03);
      for (let i = 0; i < 7; i++) {
        const a1 = (i * 3 * Math.PI * 2) / 7 - Math.PI / 2;
        const a2 = ((i + 1) * 3 * Math.PI * 2) / 7 - Math.PI / 2;
        seg(Math.cos(a1) * 0.42, 0.15 + Math.sin(a1) * 0.42, Math.cos(a2) * 0.42, 0.15 + Math.sin(a2) * 0.42, 0.01);
      }
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const r1 = i % 4 === 0 ? 0.5 : 0.54;
        seg(Math.cos(a) * r1, 0.15 + Math.sin(a) * r1, Math.cos(a) * 0.57, 0.15 + Math.sin(a) * 0.57, -0.01);
      }
      break;
    }
    case 'rails': {
      seg(-0.75, 0.55, 0.75, 0.55, -0.03);
      seg(-0.42, -1.0, -0.04, 0.55);
      seg(0.42, -1.0, 0.04, 0.55);
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const y = 0.55 - 1.55 * t * t;
        const half = 0.04 + 0.42 * t * t;
        seg(-half - 0.06, y, half + 0.06, y, 0.02);
      }
      for (const x of [-0.6, -0.48, 0.48, 0.6]) seg(x, 0.55, x, 0.85, -0.03);
      break;
    }
    case 'fog': {
      for (let row = 0; row < 7; row++) {
        const y = -0.8 + row * 0.26;
        const z = (row % 3) * 0.025 - 0.025;
        for (let i = 0; i < 24; i++) {
          const x1 = -0.75 + (i / 24) * 1.5;
          const x2 = -0.75 + ((i + 1) / 24) * 1.5;
          const w = (x: number) => y + Math.sin(x * 5 + row * 1.7) * 0.05;
          if ((i + row) % 5 !== 0) seg(x1, w(x1), x2, w(x2), z);
        }
      }
      circle(0.25, 0.6, 0.12, 24, 0.03);
      break;
    }
    case 'clock': {
      circle(0, 0.25, 0.6, 64, 0);
      circle(0, 0.25, 0.66, 64, -0.02, true);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 3 === 0 ? 0.44 : 0.52;
        seg(Math.cos(a) * r1, 0.25 + Math.sin(a) * r1, Math.cos(a) * 0.58, 0.25 + Math.sin(a) * 0.58, 0.01);
      }
      seg(0, 0.25, 0.02, 0.72, 0.02);
      seg(0, 0.25, -0.05, 0.62, 0.03);
      seg(0, -0.36, 0, -0.85, 0.01);
      circle(0, -0.92, 0.08, 20, 0.01);
      break;
    }
    case 'vault': {
      for (const r of [0.7, 0.56]) {
        seg(-r, 0.15 - r, r, 0.15 - r, r === 0.7 ? -0.02 : 0);
        seg(r, 0.15 - r, r, 0.15 + r, r === 0.7 ? -0.02 : 0);
        seg(r, 0.15 + r, -r, 0.15 + r, r === 0.7 ? -0.02 : 0);
        seg(-r, 0.15 + r, -r, 0.15 - r, r === 0.7 ? -0.02 : 0);
      }
      circle(0, 0.15, 0.32, 48, 0.02);
      circle(0, 0.15, 0.08, 16, 0.03);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        seg(Math.cos(a) * 0.32, 0.15 + Math.sin(a) * 0.32, Math.cos(a) * 0.38, 0.15 + Math.sin(a) * 0.38, 0.02);
      }
      for (const [x, y] of [[-0.62, -0.47], [0.62, -0.47], [-0.62, 0.77], [0.62, 0.77]] as const) circle(x, y, 0.035, 10, 0);
      break;
    }
    default: {
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const y = -0.95 + 0.9 * t * t;
        seg(-0.75, y, 0.75, y, 0.02);
        seg(-0.75 + 1.5 * t, -0.95, -0.25 + 0.5 * t, -0.05, 0.02);
      }
      seg(-0.22, 0.25, 0.22, 0.25, -0.02);
      seg(0.22, 0.25, 0.22, 0.65, -0.02);
      seg(0.22, 0.65, -0.22, 0.65, -0.02);
      seg(-0.22, 0.65, -0.22, 0.25, -0.02);
      circle(0, 0.45, 0.06, 12, 0.03);
    }
  }
  return s;
}

/** Numeral romano (I a VI) em traços retos: o número de arcano da carta. */
function numeralSegments(n: number): number[] {
  const glyphs: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
  const str = glyphs[n] ?? 'I';
  const s: number[] = [];
  const h = 0.16;
  const w = 0.09;
  const width = [...str].reduce((acc, c) => acc + (c === 'I' ? 0.05 : w + 0.05), 0);
  let x = -width / 2;
  for (const c of str) {
    if (c === 'I') {
      s.push(x, 0, 0, x, h, 0);
      x += 0.05;
    } else {
      s.push(x, h, 0, x + w / 2, 0, 0, x + w / 2, 0, 0, x + w, h, 0);
      x += w + 0.05;
    }
  }
  return s;
}

function lineObj(points: number[], mat: THREE.LineBasicMaterial) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(g, mat);
}

/* ───────── Montagem ───────── */

/** Estado de obra de um andar (abertura e mudanças ao vivo). */
interface Build {
  /** Instante (relógio do mundo) em que o andar começa a entrar. */
  enterAt: number;
  /** Como entra: cai do céu ou desliza para dentro como gaveta (andar novo no meio da pilha). */
  kind: 'fall' | 'slide';
  /** Altura de onde estava (para descer ou subir um nível quando a pilha muda). */
  fromY: number | null;
  shiftAt: number;
  /** Altura de repouso calculada no último quadro (base para a próxima mudança). */
  y: number;
  landed: boolean;
}

interface Ghost {
  fl: TowerFloor;
  at: number;
  y: number;
  puffed?: boolean;
}

export function createWorld(quality: Quality, brand: string, modes: { slug?: string; motif: string; hue: number }[]): World {
  const scene = new THREE.Scene();
  const M: Mats = materials(quality);
  const high = quality === 'high';
  const noise = makeNoiseTexture();
  let pal = PALETTES.night;
  let clock = 0;

  const street = new THREE.Group();
  const reflection = new THREE.Group();
  reflection.scale.y = -1;
  const vault = new THREE.Group();
  vault.visible = false;
  scene.add(street, reflection, vault);

  /* Céu e névoa */
  const skyMat = createSkyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  street.add(sky);
  const fog = new THREE.FogExp2(pal.fog, pal.fogDensity);
  scene.fog = fog;
  const fogColorStreet = new THREE.Color();

  /* Luz: hemisfério + lua (contraluz fria) + postes de sódio + um facho na fachada */
  const hemi = new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, pal.hemi);
  const moon = new THREE.DirectionalLight(pal.moon, pal.moonI);
  moon.position.set(-30, 40, -40);
  scene.add(hemi, moon);

  /* Chão molhado: transparente o bastante para o reflexo espelhado aparecer por baixo */
  const groundMat = new THREE.MeshStandardMaterial({
    color: pal.ground,
    roughness: 0.3,
    metalness: 0.2,
    roughnessMap: noise,
    transparent: true,
    opacity: 0.8,
    envMapIntensity: 0.9,
  });
  noise.repeat.set(18, 18);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = 2;
  street.add(ground);

  const plaza = new THREE.Mesh(unitBox, M.stone);
  plaza.scale.set(26, 0.14, 22);
  plaza.position.set(0, 0.07, -1);
  street.add(plaza);
  const curb = new THREE.Mesh(unitBox, M.brassDark);
  curb.scale.set(26.2, 0.03, 0.06);
  curb.position.set(0, 0.15, 10);
  street.add(curb);

  /* Cidade apagada ao redor (sem janelas, para não confundir com vaga livre) */
  const cityCount = high ? 90 : 56;
  const city = inst(unitBox, M.city, cityCount);
  const tanks = inst(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), M.city, 24);
  /** Telhados de onde saem as brasas (a cidade manda gente para a torre). */
  const roofs: THREE.Vector3[] = [];
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let n = 0;
    let tk = 0;
    for (let i = 0; i < cityCount; i++) {
      const a = hash(i + 3) * Math.PI * 2;
      const r = 46 + hash(i + 11) * 120;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 10;
      if (z > 6 && Math.abs(x) < 26) continue; // deixa a rua livre na frente da câmera
      const w = 6 + hash(i + 5) * 10;
      const d = 6 + hash(i + 7) * 10;
      const h = 8 + hash(i + 9) * (r > 80 ? 46 : 26);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i + 1) * 0.6);
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d));
      city.setMatrixAt(n++, m);
      if (r < 95) roofs.push(new THREE.Vector3(x, h + 0.5, z));
      if (tk < 24 && hash(i + 13) > 0.55) {
        m.compose(new THREE.Vector3(x + (hash(i) - 0.5) * w * 0.5, h + 1.4, z), q, new THREE.Vector3(1, 1, 1));
        tanks.setMatrixAt(tk++, m);
      }
    }
    city.count = n;
    tanks.count = tk;
  }
  street.add(city, tanks);

  /* Postes de luz de sódio. v5: nenhum cruza a fachada no hero (o da direita saiu da frente
   * da torre e foi para a esquina da praça). */
  const lampSpots = high
    ? [new THREE.Vector3(-9.5, 0, 13.5), new THREE.Vector3(14.2, 0, 8.5), new THREE.Vector3(-17, 0, 27)]
    : [new THREE.Vector3(-9.5, 0, 13.5), new THREE.Vector3(14.2, 0, 8.5)];
  const coneMat = createConeMaterial(new THREE.Color(1.0, 0.62, 0.26), high ? 0.22 : 0.18);
  /* Luzes pontuais num "banco" fixo: na rua são os postes e a porta; no porão as mesmas
   * luzes viram a luz do cofre, a do elevador e a rasante da placa. O número de luzes
   * nunca muda, então nenhum shader recompila na travessia. */
  const pool = Array.from({ length: lampSpots.length + 1 }, () => new THREE.PointLight('#ffae55', 0, 20, 1.6));
  scene.add(...pool);
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8);
  const bulbGeo = new THREE.SphereGeometry(0.16, 12, 8);
  const coneGeo = new THREE.ConeGeometry(2.3, 5.1, 24, 1, true);
  coneGeo.translate(0, -2.55, 0);
  for (const p of lampSpots) {
    const g = new THREE.Group();
    g.position.copy(p);
    const pole = new THREE.Mesh(poleGeo, M.obsidianMatte);
    pole.position.y = 2.7;
    const arm = new THREE.Mesh(unitBox, M.brassDark);
    arm.scale.set(0.9, 0.06, 0.06);
    arm.position.set(0.4, 5.35, 0);
    const head = new THREE.Mesh(unitBox, M.brassDark);
    head.scale.set(0.55, 0.16, 0.36);
    head.position.set(0.8, 5.32, 0);
    const bulb = new THREE.Mesh(bulbGeo, M.sodium);
    bulb.position.set(0.8, 5.18, 0);
    bulb.scale.set(1.3, 0.55, 1);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0.8, 5.2, 0);
    g.add(pole, arm, head, bulb, cone);
    street.add(g);
    // reflexo no asfalto: o bulbo espelhado e esticado
    const rb = new THREE.Mesh(bulbGeo, M.sodium);
    rb.position.set(p.x + 0.8, 5.18, p.z);
    rb.scale.set(0.7, 2.6, 0.7);
    reflection.add(rb);
  }

  /* Névoa baixa em lençóis */
  const sheets: THREE.Mesh[] = [];
  const sheetMat = createFogSheetMaterial(noise.clone());
  (sheetMat.uniforms.tNoise!.value as THREE.Texture).needsUpdate = true;
  const sheetHeights = high ? [0.7, 2.1, 4.6] : [1.2];
  for (const y of sheetHeights) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), sheetMat);
    s.rotation.x = -Math.PI / 2;
    s.position.y = y;
    s.renderOrder = 5;
    sheets.push(s);
    street.add(s);
  }

  /* ───────── Camada sobrenatural ───────── */
  const circle = createRitualCircle(CIRCLE_R);
  circle.mesh.position.set(0, 0.152, 0);
  street.add(circle.mesh);
  const embers = createEmbers(high ? 2000 : 400, high ? 3 : 1);
  street.add(embers.points);
  const threadMat = createThreadMaterial(new THREE.Color(2.2, 1.25, 0.42));
  const threadGeo = new THREE.BufferGeometry();
  const threads = new THREE.LineSegments(threadGeo, threadMat);
  threads.frustumCulled = false;
  threads.visible = false;
  street.add(threads);
  const fg = createForeground();
  scene.add(fg.mesh);
  let pulse = 0;

  /* ───────── Torre ───────── */
  const tower = new THREE.Group();
  street.add(tower);
  const MAX_WIN = MAX_ITEMS * MAX_SLOTS;
  const bodies = floorInst(M.floorBody, MAX_ITEMS);
  const bands = floorInst(M.brass, MAX_ITEMS);
  const ledges = floorInst(M.brass, MAX_ITEMS);
  const friezes = floorInst(M.frieze, MAX_ITEMS);
  friezes.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ITEMS * 3), 3);
  const signs = floorInst(M.sign, MAX_ITEMS);
  const piers = floorInst(M.obsidianMatte, MAX_ITEMS * (MAX_SLOTS + 1));
  const strips = floorInst(M.brass, MAX_ITEMS * 4);
  const perFloor = [bodies, bands, ledges, friezes, signs, piers, strips];
  const winGeo = new THREE.PlaneGeometry(WIN_W, WIN_H);
  const stateAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WIN * 3), 3);
  const infoAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WIN * 4), 4);
  stateAttr.setUsage(THREE.DynamicDrawUsage);
  winGeo.setAttribute('aState', stateAttr);
  winGeo.setAttribute('aInfo', infoAttr);
  const winMelt = meltAttr(winGeo, MAX_WIN);
  const winMat = createWindowMaterial(false, WIN_W, WIN_H);
  const winMatR = createWindowMaterial(true, WIN_W, WIN_H);
  const windows = inst(winGeo, winMat, MAX_WIN);
  const windowsR = new THREE.InstancedMesh(winGeo, winMatR, MAX_WIN);
  windowsR.instanceMatrix = windows.instanceMatrix;
  windowsR.frustumCulled = false;
  windowsR.renderOrder = -1;
  tower.add(...perFloor.map((p) => p.mesh), windows);
  reflection.add(windowsR);

  // Saguão (embasamento) com pilastras de latão, porta acesa e marquise. Na abertura ele sobe do chão.
  const plinth = new THREE.Group();
  const plinthBody = new THREE.Mesh(unitBox, M.obsidian);
  const plinthCap = new THREE.Mesh(unitBox, M.brass);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), M.warm);
  const doorFrame = new THREE.Mesh(unitBox, M.brass);
  const canopy = new THREE.Mesh(unitBox, M.brass);
  const pilasters = inst(unitBox, M.brass, 32);
  plinth.add(plinthBody, plinthCap, doorFrame, door, canopy, pilasters);
  tower.add(plinth);
  const doorR = new THREE.Mesh(door.geometry, M.warm);
  reflection.add(doorR);
  const doorLightPos = new THREE.Vector3();

  // Coroa: degraus, leque de raios, e a agulha num grupo próprio (sobe de dentro da coroa).
  const crown = new THREE.Group();
  const spire = new THREE.Group();
  crown.add(spire);
  tower.add(crown);
  const flame = createFlame();
  let crownY = PLINTH_H;

  // Constelação: fios de latão ligando andares do mesmo modo (se desenham com a separação)
  const constGeo = new THREE.BufferGeometry();
  constGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX_FLOORS * 4 * 3), 3));
  constGeo.setAttribute('aDraw', new THREE.Float32BufferAttribute(new Float32Array(MAX_FLOORS * 4 * 3), 3));
  const constMat = createThreadMaterial(new THREE.Color(1.5, 1.0, 0.45));
  const constellation = new THREE.LineSegments(constGeo, constMat);
  constellation.frustumCulled = false;
  tower.add(constellation);
  let constDraw = 0;

  let floors: TowerFloor[] = [];
  let ghosts: Ghost[] = [];
  const builds = new Map<string, Build>();
  let kindsById = new Map<string, WindowKind[]>();
  let lastExplode = -1;
  let lastFocus = -2;
  let lastMoving = true;
  let obra: { plan: ObraPlan; t0: number; skipT: number | null; done: boolean } | null = null;
  let kit: Kit | null = null;
  let disposed = false;
  const floorMats: THREE.Matrix4[] = Array.from({ length: MAX_ITEMS }, () => new THREE.Matrix4());
  const tmpM = new THREE.Matrix4();
  const tmpL = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const kindNum = (k: WindowKind) => (k === 'friend' ? 2 : k === 'lit' ? 1 : 0);
  const restY = (level: number) => PLINTH_H + level * FLOOR_H;
  /** Altura de onde os andares caem (acima do quadro do hero). */
  const DROP = 11;

  /* ───────── Kit glTF (melhoria progressiva) ───────── */
  interface KitSet {
    begin(): void;
    put(m: THREE.Matrix4, melt?: number): void;
    end(): void;
  }
  const kitSets = new Map<KitPiece, KitSet>();
  const kitMeshes: THREE.InstancedMesh[] = [];
  /** Material do kit pelo nome (contrato). O vidro vira luz: âmbar no saguão (gente), azul no resto (o sobrenatural). */
  const kitMat = (name: KitMaterial, piece: KitPiece): THREE.Material =>
    name === 'glass'
      ? piece === 'base'
        ? M.warmGlow
        : M.coldGlow
      : { obsidian: M.obsidian, obsidian_matte: M.obsidianMatte, brass: M.brass, brass_dark: M.brassDark, verdigris: M.verdigris, stone: M.stone }[name];

  /** Peças do kit como InstancedMesh (uma por material da peça), no grupo indicado. */
  function kitSet(piece: KitPiece, cap: number, parent: THREE.Object3D) {
    const parts = kit?.parts.get(piece);
    if (!parts) return;
    const meshes = parts.map((p) => {
      const g = p.geometry.clone();
      const melt = meltAttr(g, cap);
      const m = inst(g, kitMat(p.material, piece), cap);
      kitMeshes.push(m);
      parent.add(m);
      return { m, melt };
    });
    let n = 0;
    kitSets.set(piece, {
      begin: () => (n = 0),
      put(mat, melt = 0) {
        if (n >= cap) return;
        for (const { m, melt: a } of meshes) {
          m.setMatrixAt(n, mat);
          a.array[n] = melt;
        }
        n++;
      },
      end() {
        for (const { m, melt: a } of meshes) {
          m.count = n;
          m.instanceMatrix.needsUpdate = true;
          a.needsUpdate = true;
        }
      },
    });
  }

  /**
   * Troca a geometria procedural pelas peças do kit (contrato-kit-torre.md). Corpos,
   * janelas, frisos e letreiros continuam do código (são o dado ao vivo); saem pilares,
   * cornijas, pedestal e coroa procedurais. Peça ausente no arquivo = fica a procedural.
   */
  function applyKit(k: Kit) {
    kit = k;
    const cap = MAX_ITEMS * MAX_SLOTS;
    for (const p of ['floor_A', 'floor_B', 'floor_C', 'setback_ledge'] as const) kitSet(p, cap, tower);
    for (const p of ['floor_cap_L', 'floor_cap_R'] as const) kitSet(p, MAX_ITEMS, tower);
    kitSet('ornament_gargoyle', MAX_ITEMS * 2, tower);
    kitSet('base', 1, plinth);
    kitSet('ornament_pilaster', 32, plinth);
    kitSet('ornament_sunburst', 1, plinth);
    kitSet('crown', 1, crown);
    kitSet('spire', 1, spire);
    buildPlinth();
    buildCrown();
    lastExplode = -1;
  }
  void loadKit().then((k) => {
    if (k && !disposed) applyKit(k);
  });

  function buildCrown() {
    for (const g of [crown, spire]) {
      for (const o of [...g.children]) {
        if (o === spire || kitMeshes.includes(o as THREE.InstancedMesh)) continue;
        const geo = (o as THREE.Mesh).geometry;
        if (geo && geo !== unitBox && geo !== bulbGeo && geo !== flame.mesh.geometry) geo.dispose();
        g.remove(o);
      }
    }
    const top = floors[floors.length - 1];
    const w = top ? floorW(top.lobby.slots) : 4;
    const d = top ? floorD(top.lobby.slots) : 3;
    const box = (parent: THREE.Object3D, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(unitBox, mat);
      b.scale.set(sx, sy, sz);
      b.position.set(x, y, z);
      parent.add(b);
      return b;
    };
    let spireBase = 1.9;
    let spireH = 3.6;
    let cs = 1;
    const kc = kitSets.get('crown');
    spire.scale.setScalar(1);
    if (kc && kit) {
      // Coroa do kit (4,12 × 5,95 × 3,12) escalada por inteiro à largura do último andar; a
      // agulha mora na lanterna (assento em y = 5,3 da coroa, aberta em cima) e sobe de lá.
      const size = kit.size.get('crown')!;
      cs = Math.min(1.6, Math.max(0.9, (w * 0.82) / Math.max(0.1, size.x)));
      kc.begin();
      kc.put(tmpM.compose(tmpV.set(0, 0, 0), tmpQ.identity(), tmpS.set(cs, cs, cs)));
      kc.end();
      spire.scale.setScalar(cs);
      spireBase = 5.3;
    } else {
      box(crown, M.obsidian, w * 0.78, 0.9, d * 0.78, 0, 0.45, 0);
      box(crown, M.brass, w * 0.78 + 0.2, 0.08, d * 0.78 + 0.2, 0, 0.92, 0);
      box(crown, M.obsidian, w * 0.54, 0.9, d * 0.54, 0, 1.4, 0);
      box(crown, M.brass, w * 0.54 + 0.16, 0.07, d * 0.54 + 0.16, 0, 1.86, 0);
      // leque de raios na face da frente
      for (let i = 0; i < 9; i++) {
        const a = ((i - 4) / 4) * 0.62;
        const ray = box(crown, M.brass, 0.05, 1.5, 0.05, Math.sin(a) * 0.75, 2.5 + Math.cos(a) * 0.75 - 0.75, d * 0.27 + 0.03);
        ray.rotation.z = -a;
      }
    }
    const ks = kitSets.get('spire');
    if (ks && kit) {
      spireH = kit.size.get('spire')!.y;
      ks.begin();
      ks.put(tmpM.compose(tmpV.set(0, spireBase, 0), tmpQ.identity(), tmpS.set(1, 1, 1)));
      ks.end();
    } else {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(w * 0.3, spireH, 4, 1), M.obsidian);
      cone.rotation.y = Math.PI / 4;
      cone.position.y = spireBase + spireH / 2;
      spire.add(cone);
      // arestas da agulha em fio de latão aceso
      const fins = new THREE.LineSegments(new THREE.EdgesGeometry(cone.geometry), M.line);
      fins.rotation.y = Math.PI / 4;
      fins.position.y = spireBase + spireH / 2;
      fins.scale.setScalar(1.01);
      spire.add(fins);
    }
    const top2 = spireBase + spireH;
    if (!ks) box(spire, M.brass, 0.05, 3.2, 0.05, 0, top2 + 1.5, 0);
    // Farol: chama azul fria (o sobrenatural), não mais uma lâmpada de sódio.
    flame.mesh.position.y = ks ? top2 + 0.15 : top2 + 3.0;
    spire.add(flame.mesh);
    // Quanto a agulha afunda para ficar escondida (dentro da coroa ou da lanterna do kit).
    spire.userData.drop = (ks ? spireH + 0.1 : top2 - 0.2) * cs;
  }

  function buildPlinth() {
    const base = floors[0];
    const w = (base ? floorW(base.lobby.slots) : 6) + 1.4;
    const d = (base ? floorD(base.lobby.slots) : 5) + 1.4;
    const kb = kitSets.get('base');
    // O pedestal do kit tem portal, porta e janelas próprios: saem os procedurais.
    plinthBody.visible = plinthCap.visible = doorFrame.visible = canopy.visible = door.visible = doorR.visible = !kb;
    plinthBody.scale.set(w, PLINTH_H, d);
    plinthBody.position.set(0, PLINTH_H / 2, 0);
    plinthCap.scale.set(w + 0.3, 0.16, d + 0.3);
    plinthCap.position.set(0, PLINTH_H - 0.02, 0);
    door.position.set(0, 1.18, d / 2 + 0.012);
    doorR.position.set(0, 1.18, d / 2 + 0.012);
    doorFrame.scale.set(2.0, 2.55, 0.1);
    doorFrame.position.set(0, 1.27, d / 2 - 0.02);
    canopy.scale.set(3.4, 0.1, 1.3);
    canopy.position.set(0, 2.62, d / 2 + 0.6);
    doorLightPos.set(0, 1.6, d / 2 + 1.2);
    let k = 0;
    if (kb) {
      // Contrato: pedestal 8 × 3,2 × 5 (largura de referência 8). Escala em X pela largura
      // do andar de baixo e em Z pela profundidade dele (com os módulos de fachada na frente).
      const sx = w / 8;
      const sz = Math.max(1, (d - 0.4) / 5);
      kb.begin();
      kb.put(tmpM.compose(tmpV.set(0, 0, 0), tmpQ.identity(), tmpS.set(sx, 1, sz)));
      kb.end();
      // Encaixes do modelador: pilastras a x = ±1,0 (frente em z = 2,47), sol acima do portal
      // (y ≈ 2,4, frente em z = 2,35).
      const kp = kitSets.get('ornament_pilaster');
      if (kp) {
        kp.begin();
        for (const x of [-1, 1]) kp.put(tmpM.compose(tmpV.set(x * sx, 0, 2.47 * sz - 0.083), tmpQ.identity(), tmpS.set(1, 1, 1)));
        kp.end();
      }
      const ksun = kitSets.get('ornament_sunburst');
      if (ksun) {
        ksun.begin();
        ksun.put(tmpM.compose(tmpV.set(0, 2.4, 2.35 * sz + 0.05), tmpQ.identity(), tmpS.set(1, 1, 1)));
        ksun.end();
      }
      doorLightPos.set(0, 1.6, 2.5 * sz + 1.2);
    } else {
      const n = Math.min(32, Math.floor(w / 0.9));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.45 + i * ((w - 0.9) / Math.max(1, n - 1));
        if (Math.abs(x) < 1.3) continue;
        tmpM.compose(tmpV.set(x, PLINTH_H / 2 - 0.1, d / 2 + 0.04), tmpQ.identity(), tmpS.set(0.09, PLINTH_H - 0.4, 0.08));
        pilasters.setMatrixAt(k++, tmpM);
      }
    }
    pilasters.count = k;
    pilasters.instanceMatrix.needsUpdate = true;
  }

  /**
   * Face da frente de um andar: a do corpo, ou (com o kit) a dos módulos de fachada, que
   * encostam o fundo (z = −0,25) no corpo; o vidro mora em z ≈ +0,02 a +0,05 do módulo.
   */
  const facadeKit = () => kitSets.has('floor_A') || kitSets.has('floor_B') || kitSets.has('floor_C');
  const winZ = (d: number) => (facadeKit() ? d / 2 + 0.25 + 0.035 : d / 2 + 0.004);
  const frontZ = (d: number) => (facadeKit() ? d / 2 + 0.5 : d / 2);

  /** Onde a janela w do andar f está no mundo: pela matriz atual do andar ou, na abertura, pela de repouso. */
  function windowPos(f: number, w: number, out: THREE.Vector3, rest = false) {
    const fl = floors[f];
    if (!fl) return out.set(0, 0, 0);
    const width = floorW(fl.lobby.slots);
    out.set(-width / 2 + PAD + BAY * (w + 0.5), 0.53, winZ(floorD(fl.lobby.slots)) + 0.04);
    return rest ? out.setY(out.y + restY(f)) : out.applyMatrix4(floorMats[f]!);
  }

  /** Um telhado da cidade, de preferência do lado da câmera (as brasas cruzam o quadro). */
  function roof(seed: number, out: THREE.Vector3) {
    const r = roofs[Math.floor(hash(seed * 7.31) * roofs.length)] ?? tmpA.set(-40, 20, -30);
    return out.copy(r);
  }

  /** Poeira de brasa e (no alto) fumaça no encaixe de um andar. */
  function puff(f: number, at: number) {
    const fl = floors[f];
    if (!fl) return;
    const w = floorW(fl.lobby.slots);
    const d = floorD(fl.lobby.slots);
    const n = high ? 14 : 5;
    for (let i = 0; i < n; i++) {
      const sx = (hash(f * 13 + i) - 0.5) * w;
      const sz = (i % 2 ? 1 : -1) * d * 0.5;
      tmpA.set(sx, 0.02, sz).applyMatrix4(floorMats[f]!);
      tmpB.set(sx * 0.5 + (hash(i + f) - 0.5) * 2, 0.6 + hash(i * 3 + f) * 1.4, sz * 0.9);
      embers.emit(tmpA, tmpB, at + hash(i) * 0.05, 0.7 + hash(i + 9) * 0.6, EMBER.spark, hash(i * 7 + f));
    }
    if (high) {
      for (let i = 0; i < 3; i++) {
        tmpA.set((i - 1) * w * 0.45, 0, d * 0.5).applyMatrix4(floorMats[f]!);
        tmpB.set((i - 1) * 0.8, 0.2, 0.6);
        embers.emit(tmpA, tmpB, at, 1.6 + hash(i + f) * 0.6, EMBER.smoke, hash(i + f * 5));
      }
    }
  }

  /** Brasa da cidade até a janela (abertura e entrada ao vivo). */
  function soul(f: number, w: number, kind: WindowKind, launch: number, fly: number, rest = false) {
    windowPos(f, w, tmpB, rest);
    roof(f * 31 + w * 7 + launch, tmpA);
    embers.emit(tmpA, tmpB, launch, fly, kind === 'friend' ? EMBER.friend : EMBER.player, hash(f * 17 + w));
  }

  function writeStates(mode: FloorsMode | 'opening', plan?: ObraPlan): number {
    let wi = 0;
    let lit = 0;
    const arrive = new Map<string, number>();
    if (mode === 'opening' && plan && obra) for (const e of plan.embers) arrive.set(`${e.f}:${e.w}`, obra.t0 + e.arrive);
    floors.forEach((fl, f) => {
      const prev = kindsById.get(fl.lobby.id);
      const b = builds.get(fl.lobby.id);
      const flags = (fl.lobby.status === 'em-partida' ? 1 : 0) | (fl.lobby.locked ? 2 : 0) | (fl.lobby.mine ? 4 : 0);
      fl.windows.forEach((kind, w) => {
        const k = kindNum(kind);
        const before = prev?.[w];
        const i3 = wi * 3;
        const s = stateAttr.array;
        if (mode === 'instant') {
          s[i3] = k;
          s[i3 + 1] = k;
          s[i3 + 2] = clock - 10;
        } else if (mode === 'hold') {
          // escuras até a abertura (a brasa de cada jogador é que acende a janela)
          s[i3] = 0;
          s[i3 + 1] = k;
          s[i3 + 2] = 1e7;
        } else if (mode === 'opening') {
          s[i3] = 0;
          s[i3 + 1] = k;
          s[i3 + 2] = k > 0 ? (arrive.get(`${f}:${w}`) ?? clock + 3) : clock - 10;
        } else if (before === undefined) {
          // Andar novo: as janelas acendem depois do pouso, em fila.
          const at = b ? b.enterAt + OBRA.FALL + 0.25 + w * 0.06 : clock;
          s[i3] = 0;
          s[i3 + 1] = k;
          s[i3 + 2] = k > 0 ? at : clock - 10;
        } else if (kindNum(before) !== k) {
          // Alguém entrou: a brasa sai da cidade e a janela acende quando ela chega.
          s[i3] = kindNum(before);
          s[i3 + 1] = k;
          s[i3 + 2] = clock + (k > 0 ? OBRA.FLY : 0);
          if (k > 0) {
            lit++;
            soul(f, w, kind, clock, OBRA.FLY);
            pulse = 1;
          }
        }
        const i4 = wi * 4;
        infoAttr.array[i4] = hash(f * 31 + w * 7 + fl.lobby.id.length);
        infoAttr.array[i4 + 1] = flags;
        infoAttr.array[i4 + 2] = f;
        infoAttr.array[i4 + 3] = w;
        wi++;
      });
    });
    // Andares se desfazendo: as janelas ficam como estavam até a dissolução levar.
    ghosts.forEach((g, gi) => {
      g.fl.windows.forEach((kind, w) => {
        const k = kindNum(kind);
        stateAttr.array[wi * 3] = k;
        stateAttr.array[wi * 3 + 1] = k;
        stateAttr.array[wi * 3 + 2] = clock - 10;
        infoAttr.array[wi * 4] = hash(gi * 13 + w);
        infoAttr.array[wi * 4 + 1] = 0;
        infoAttr.array[wi * 4 + 2] = 99;
        infoAttr.array[wi * 4 + 3] = w;
        wi++;
      });
    });
    windows.count = wi;
    windowsR.count = wi;
    stateAttr.needsUpdate = true;
    infoAttr.needsUpdate = true;
    kindsById = new Map(floors.map((fl) => [fl.lobby.id, fl.windows]));
    return lit;
  }

  /** Estado de obra de um andar neste instante. */
  function floorBuild(b: Build | undefined) {
    const out = { dy: 0, dz: 0, rot: 0, s: 1, orn: 1, melt: 0, moving: false };
    if (!b) return out;
    const t = clock - b.enterAt;
    if (t < 0) {
      out.s = 0.0001;
      out.orn = 0;
      out.moving = true;
      return out;
    }
    if (t < OBRA.FALL) {
      const u = t / OBRA.FALL;
      if (b.kind === 'fall') {
        out.dy = DROP * (1 - u * u);
        out.rot = 0.26 * (1 - u) * (1 - u);
      } else {
        out.dz = 7 * (1 - easeOutCubic(u));
        out.rot = 0.18 * (1 - u) * (1 - u);
      }
      // No alto o andar se condensa da fumaça (borda em brasa) na primeira metade da queda.
      if (high) out.melt = 1 - ramp(0, 0.62, u);
      out.moving = true;
    } else if (t < OBRA.FALL + OBRA.JOLT) {
      const v = (t - OBRA.FALL) / OBRA.JOLT;
      out.dy = -0.09 * Math.sin(Math.PI * v) * (1 - v);
      out.moving = true;
    }
    const o = clamp01((t - OBRA.FALL - OBRA.ORN_DELAY) / OBRA.ORN);
    out.orn = o <= 0 ? 0 : o >= 1 ? 1 : easeOutBack(o);
    if (o < 1) out.moving = true;
    if (b.fromY !== null) {
      const sh = clamp01((clock - b.shiftAt) / 0.55);
      if (sh < 1) out.moving = true;
    }
    return out;
  }

  function layout(explode: number): boolean {
    let wi = 0;
    let pi = 0;
    let si = 0;
    let moving = false;
    const kf = kitSets.size ? (['floor_A', 'floor_B', 'floor_C'] as const).map((p) => kitSets.get(p)) : [];
    const kLedge = kitSets.get('setback_ledge');
    const kCapL = kitSets.get('floor_cap_L');
    const kCapR = kitSets.get('floor_cap_R');
    const kGarg = kitSets.get('ornament_gargoyle');
    for (const s of [...kf, kLedge, kCapL, kCapR, kGarg]) s?.begin();
    const kitFront = kf.some(Boolean);

    // Vista explodida (cena 2): cada andar se solta com atraso próprio (escada), gira no
    // eixo vertical, inclina até ±4° e se afasta em Z conforme o modo.
    const n = floors.length;
    const stair = n > 1 ? Math.min(0.025, 0.5 / (n - 1)) : 0;
    const span = 1 - stair * Math.max(0, n - 1);
    const lanes = new Map<string, number>();
    let cum = 0;
    const items: { fl: TowerFloor; ghost?: Ghost }[] = [...floors.map((fl) => ({ fl })), ...ghosts.map((g) => ({ fl: g.fl, ghost: g }))];
    items.forEach(({ fl, ghost }, f) => {
      const slots = fl.lobby.slots;
      const w = floorW(slots);
      const d = floorD(slots);
      let y: number;
      let melt = 0;
      let s = 1;
      let bb = { dy: 0, dz: 0, rot: 0, orn: 1 };
      let ex = 0;
      let rotY = 0;
      let tiltX = 0;
      let tiltZ = 0;
      let z = 0;
      if (ghost) {
        // Andar que fechou: se desfaz em fumaça e brasa (alto) ou desaba sobre si (médio).
        const u = clamp01((clock - ghost.at) / 0.9);
        y = ghost.y;
        if (high) melt = u;
        else s = Math.max(0.0001, 1 - easeOutCubic(u));
        moving = true;
      } else {
        const b = builds.get(fl.lobby.id);
        const fb = floorBuild(b);
        if (fb.moving) moving = true;
        bb = fb;
        s = fb.s;
        melt = fb.melt;
        let base = restY(f);
        if (b && b.fromY !== null) {
          const sh = clamp01((clock - b.shiftAt) / 0.55);
          base = b.fromY + (base - b.fromY) * (sh * sh * (3 - 2 * sh));
          if (sh >= 1) b.fromY = null;
        }
        if (b) b.y = base;
        ex = clamp01((explode - f * stair) / Math.max(0.2, span));
        ex = ex * ex * (3 - 2 * ex);
        if (f > 0) cum += ex * GAP;
        y = base + cum + ex * 0.6;
        if (!lanes.has(fl.lobby.modeSlug)) lanes.set(fl.lobby.modeSlug, lanes.size);
        const lane = lanes.get(fl.lobby.modeSlug)!;
        rotY = (hash(f + 0.5) - 0.5) * 0.5 * ex;
        tiltX = (hash(f + 3.3) - 0.5) * 0.14 * ex;
        tiltZ = (hash(f + 7.7) - 0.5) * 0.14 * ex;
        z = ((lane % 3) - 1) * 0.7 * ex;
      }
      const fm = floorMats[f]!;
      tmpE.set(tiltX, rotY + bb.rot, tiltZ);
      // Antes de entrar (s ≈ 0) o andar some por inteiro; o andar que desaba (médio) só achata.
      fm.compose(tmpV.set(0, y + bb.dy, z + bb.dz), tmpQ.setFromEuler(tmpE), s < 0.001 ? tmpS.setScalar(0.0001) : tmpS.set(1, s, 1));
      const orn = bb.orn;
      const put = (p: { mesh: THREE.InstancedMesh; melt: THREE.InstancedBufferAttribute }, i: number, x: number, yy: number, zz: number, sx: number, sy: number, sz: number, ry = 0) => {
        tmpL.compose(tmpV.set(x, yy, zz), ry ? tmpQ.setFromAxisAngle(Y, ry) : tmpQ.identity(), tmpS.set(sx, sy, sz));
        tmpM.multiplyMatrices(fm, tmpL);
        p.mesh.setMatrixAt(i, tmpM);
        p.melt.array[i] = melt;
      };
      const kput = (set: KitSet | undefined, x: number, yy: number, zz: number, ry = 0, sx = 1) => {
        if (!set) return;
        tmpL.compose(tmpV.set(x, yy, zz), tmpQ.setFromAxisAngle(Y, ry), tmpS.set(sx, Math.max(0.0001, orn), 1));
        set.put(tmpM.multiplyMatrices(fm, tmpL), melt);
      };
      const tiny = 0.0001;
      const on = Math.max(tiny, orn);
      put(bodies, f, 0, FLOOR_H / 2, 0, w, FLOOR_H * 0.996, d);
      put(bands, f, 0, 0.025, 0, (w + 0.06) * on, 0.05, (d + 0.06) * on);
      const next = floors[f + 1];
      const setback = !ghost && (!next || next.lobby.slots < slots || ex > 0.05);
      const ledgeOn = setback && !kLedge;
      put(ledges, f, 0, FLOOR_H - 0.05, 0, ledgeOn ? (w + 0.3) * on : tiny, ledgeOn ? 0.1 : tiny, ledgeOn ? d + 0.3 : tiny);
      // Friso (cor do modo) e letreiro de lotado ficam sempre na face da frente (são dado).
      const fz = frontZ(d);
      put(friezes, f, 0, kitFront ? 0.04 : 0.14, fz + 0.035, (w - 0.7) * on, 0.032, 0.02);
      const full = fl.lobby.players >= slots && fl.lobby.status !== 'em-partida';
      put(signs, f, -w / 2 + 0.3, 0.86, fz + 0.06, full ? 0.34 * on : tiny, full ? 0.07 : tiny, 0.02);
      for (let k = 0; k <= slots; k++) {
        // Pilastras: giram 90° e encaixam (o "aparafusar" da obra encantada).
        const pOn = kitFront ? tiny : 1;
        put(piers, pi++, -w / 2 + PAD + BAY * k, 0.53, d / 2 + 0.05, 0.075 * pOn, 0.86 * on * pOn, 0.12 * pOn, (1 - Math.min(1, orn)) * Math.PI * 0.5);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(strips, si++, (sx * w) / 2, (FLOOR_H / 2) * on, sz * d * 0.22, 0.04, FLOOR_H * on, 0.06);
      for (let k = 0; k < slots; k++) {
        const x = -w / 2 + PAD + BAY * (k + 0.5);
        tmpL.compose(tmpV.set(x, 0.53, winZ(d)), tmpQ.identity(), tmpS.set(1, 1, 1));
        tmpM.multiplyMatrices(fm, tmpL);
        windows.setMatrixAt(wi, tmpM);
        winMelt.array[wi] = melt;
        wi++;
        // Kit: um módulo de fachada por vaga, com o fundo (z = −0,25) encostado no corpo; o
        // ritmo (A pilastra, B nervura, C arco verdete) sai do modo do lobby.
        const mz = d / 2 + 0.25;
        if (kitFront) kput(kf[(modes.findIndex((m) => m.slug === fl.lobby.modeSlug) + 3) % 3], x, 0, mz);
        if (setback && kLedge) kput(kLedge, x, FLOOR_H - 0.12, mz);
      }
      if (kitFront) {
        kput(kCapL, -w / 2 + PAD / 2, 0, d / 2 + 0.25);
        kput(kCapR, w / 2 - PAD / 2, 0, d / 2 + 0.25);
      }
      if (setback && kGarg) {
        // Gárgulas nos cantos do recuo, olhando para fora (frente da peça em +Z).
        kput(kGarg, -w / 2 + 0.12, FLOOR_H - 0.05, d / 2 + 0.38, -Math.PI / 4);
        kput(kGarg, w / 2 - 0.12, FLOOR_H - 0.05, d / 2 + 0.38, Math.PI / 4);
      }
    });
    const count = items.length;
    for (const p of perFloor) {
      p.mesh.count = count;
      p.mesh.instanceMatrix.needsUpdate = true;
      p.melt.needsUpdate = true;
    }
    piers.mesh.count = pi;
    strips.mesh.count = si;
    windows.instanceMatrix.needsUpdate = true;
    winMelt.needsUpdate = true;
    for (const s of [...kf, kLedge, kCapL, kCapR, kGarg]) s?.end();

    // Coroa: acompanha o topo (sobe antes de um andar novo encaixar em cima).
    const target = restY(n) + cum + (n ? explode * 0.6 : 0) + explode * 1.0;
    crownY = lastMoving || moving ? crownY + (target - crownY) * 0.18 : target;
    crown.position.set(0, crownY, 0);

    // Constelação: liga andares do mesmo modo pela esquerda; cada fio se desenha (aDraw).
    const pos = constGeo.attributes.position as THREE.BufferAttribute;
    const draw = constGeo.attributes.aDraw as THREE.BufferAttribute;
    let v = 0;
    const lastOf = new Map<string, THREE.Vector3>();
    const seg = (a: THREE.Vector3, b: THREE.Vector3, order: number) => {
      pos.setXYZ(v, a.x, a.y, a.z);
      draw.setXYZ(v++, 0, order, 1);
      pos.setXYZ(v, b.x, b.y, b.z);
      draw.setXYZ(v++, 1, order, 1);
    };
    floors.forEach((fl, f) => {
      const slug = fl.lobby.modeSlug;
      const lane = lanes.get(slug) ?? 0;
      const w = floorW(fl.lobby.slots);
      const fm = floorMats[f]!;
      const edge = new THREE.Vector3(-w / 2 - 0.15, FLOOR_H * 0.5, 0).applyMatrix4(fm);
      const out = new THREE.Vector3(-floorW(12) / 2 - 1.1 - lane * 0.45, edge.y, edge.z * 0.3);
      const order = n > 1 ? f / (n - 1) : 0;
      seg(edge, out, order);
      const prev = lastOf.get(slug);
      if (prev) seg(prev, out, order);
      lastOf.set(slug, out);
    });
    constGeo.setDrawRange(0, v);
    pos.needsUpdate = true;
    draw.needsUpdate = true;
    lastMoving = moving;
    return moving;
  }

  function paintFriezes(focus: number) {
    const c = new THREE.Color();
    floors.forEach((fl, f) => {
      c.setHSL(fl.hue / 360, 0.55, 0.5);
      c.multiplyScalar(f === focus ? 3.2 : 0.9);
      friezes.mesh.setColorAt(f, c);
    });
    ghosts.forEach((g, i) => friezes.mesh.setColorAt(floors.length + i, c.setHSL(g.fl.hue / 360, 0.55, 0.5)));
    if (friezes.mesh.instanceColor) friezes.mesh.instanceColor.needsUpdate = true;
  }

  /** Esqueleto da torre em fios âmbar, a partir do círculo (só na abertura). */
  function buildThreads() {
    const p: number[] = [];
    const dr: number[] = [];
    const top = restY(floors.length) + 6;
    const segLine = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      p.push(ax, ay, az, bx, by, bz);
      const seed = Math.random();
      dr.push(0, Math.min(1, ay / top), seed, 1, Math.min(1, ay / top), seed);
    };
    const rect = (y: number, w: number, d: number) => {
      const c: [number, number][] = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]];
      c.forEach(([x, z], i) => {
        const [x2, z2] = c[(i + 1) % 4]!;
        segLine(x, y, z, x2, y, z2);
      });
    };
    const base = floors[0];
    const bw = (base ? floorW(base.lobby.slots) : 6) + 1.4;
    const bd = (base ? floorD(base.lobby.slots) : 5) + 1.4;
    // Do círculo aos cantos do saguão: oito fios curvos que sobem do chão.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const sx = Math.cos(a) * CIRCLE_R * 0.97;
      const sz = Math.sin(a) * CIRCLE_R * 0.97;
      const tx = Math.sign(Math.cos(a)) * bw * 0.5;
      const tz = Math.sign(Math.sin(a)) * bd * 0.5;
      let px = sx;
      let py = 0.2;
      let pz = sz;
      for (let k = 1; k <= 10; k++) {
        const u = k / 10;
        const x = sx + (tx - sx) * u;
        const z = sz + (tz - sz) * u;
        const y = 0.2 + PLINTH_H * u * u + Math.sin(u * Math.PI) * 1.6;
        segLine(px, py, pz, x, y, z);
        px = x;
        py = y;
        pz = z;
      }
    }
    rect(PLINTH_H, bw, bd);
    floors.forEach((fl, f) => {
      const w = floorW(fl.lobby.slots);
      const d = floorD(fl.lobby.slots);
      const y = restY(f);
      for (const [x, z] of [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]] as const) segLine(x, y, z, x, y + FLOOR_H, z);
      rect(y + FLOOR_H, w, d);
    });
    // Mastro da agulha
    segLine(0, restY(floors.length), 0, 0, top, 0);
    threadGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    threadGeo.setAttribute('aDraw', new THREE.Float32BufferAttribute(dr, 3));
  }

  /* ───────── Cofre (porão): cartas, elevador, placa ───────── */
  const room = new THREE.Mesh(new THREE.BoxGeometry(36, 14, 36), M.vaultWall);
  room.position.set(0, VAULT_FLOOR + 7, 0);
  vault.add(room);
  const vfloor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), M.vaultFloor);
  vfloor.rotation.x = -Math.PI / 2;
  vfloor.position.y = VAULT_FLOOR + 0.01;
  vault.add(vfloor);
  const ribs = inst(unitBox, M.brassDark, 64);
  {
    let k = 0;
    for (let i = -5; i <= 5; i++) {
      for (const [x, z, rx] of [[i * 3.2, -17.9, false], [i * 3.2, 17.9, false], [-17.9, i * 3.2, true], [17.9, i * 3.2, true]] as const) {
        if (rx && Math.abs(z - DOOR_POS.z) < 3 && x < 0) continue;
        if (rx && Math.abs(z - PLATE_POS.z) < 4.5 && x > 0) continue;
        tmpM.compose(tmpV.set(x, VAULT_FLOOR + 7, z), tmpQ.identity(), tmpS.set(rx ? 0.2 : 0.16, 14, rx ? 0.16 : 0.2));
        ribs.setMatrixAt(k++, tmpM);
      }
    }
    ribs.count = k;
  }
  vault.add(ribs);
  const inlay = new THREE.Mesh(new THREE.RingGeometry(RING_R + 0.9, RING_R + 1.0, 96), M.brass);
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(RING_CENTER.x, VAULT_FLOOR + 0.02, RING_CENTER.z);
  const inlay2 = new THREE.Mesh(new THREE.RingGeometry(RING_R + 1.25, RING_R + 1.29, 96), M.brass);
  inlay2.rotation.x = -Math.PI / 2;
  inlay2.position.copy(inlay.position);
  vault.add(inlay, inlay2);

  const ring = new THREE.Group();
  ring.position.copy(RING_CENTER);
  vault.add(ring);
  const cardMotifs: THREE.LineSegments[] = [];
  const cardPanes: THREE.Mesh[] = [];
  const cardGeo = new THREE.BoxGeometry(2.0, 3.4, 0.07);
  modes.slice(0, 6).forEach((mode, i) => {
    const a = (i / 6) * Math.PI * 2;
    const card = new THREE.Group();
    card.position.set(Math.sin(a) * RING_R, 2.15, Math.cos(a) * RING_R);
    card.rotation.y = a;
    const pane = new THREE.Mesh(cardGeo, M.glass);
    pane.renderOrder = 3;
    cardPanes.push(pane);
    card.add(pane);
    for (const [sx, sy, x, y] of [[2.12, 0.07, 0, 1.73], [2.12, 0.07, 0, -1.73], [0.07, 3.5, 1.03, 0], [0.07, 3.5, -1.03, 0]] as const) {
      const b = new THREE.Mesh(unitBox, M.brass);
      b.scale.set(sx, sy, 0.1);
      b.position.set(x, y, 0);
      card.add(b);
    }
    // arco escalonado no topo (a janela da carta)
    for (const [w, y] of [[1.5, 1.45], [1.1, 1.53], [0.6, 1.61]] as const) {
      const b = new THREE.Mesh(unitBox, M.brass);
      b.scale.set(w, 0.025, 0.09);
      b.position.set(0, y, 0);
      card.add(b);
    }
    const motif = lineObj(motifSegments(mode.motif), M.line.clone());
    motif.position.set(0, 0.05, 0.0);
    motif.scale.setScalar(1.05);
    cardMotifs.push(motif);
    card.add(motif);
    const num = lineObj(numeralSegments(i + 1), M.line);
    num.position.set(0, -1.52, 0.05);
    card.add(num);
    const frieze = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(mode.hue / 360, 0.55, 0.5).multiplyScalar(1.2) }));
    frieze.scale.set(1.6, 0.03, 0.02);
    frieze.position.set(0, -1.25, 0.05);
    card.add(frieze);
    const plinthC = new THREE.Mesh(unitBox, M.obsidian);
    plinthC.scale.set(2.3, 0.35, 0.6);
    plinthC.position.set(0, -1.95, 0);
    card.add(plinthC);
    ring.add(card);
  });
  const vaultKeyPos = new THREE.Vector3(RING_CENTER.x, VAULT_FLOOR + 7.5, RING_CENTER.z + 3);

  // Elevador: portas de latão gravadas, mostrador em meia-lua com ponteiro e três lâmpadas
  const elevator = new THREE.Group();
  elevator.position.copy(DOOR_POS);
  elevator.rotation.y = Math.PI / 2; // de frente para +x
  vault.add(elevator);
  const leafGeo = new THREE.BoxGeometry(1.6, 5.4, 0.08);
  const engraving = (() => {
    const s: number[] = [];
    for (let i = 0; i < 7; i++) {
      const y = -2.4 + i * 0.8;
      s.push(-0.7, y, 0.045, 0, y + 0.35, 0.045, 0, y + 0.35, 0.045, 0.7, y, 0.045);
    }
    s.push(-0.7, -2.6, 0.045, -0.7, 2.6, 0.045, 0.7, -2.6, 0.045, 0.7, 2.6, 0.045);
    return s;
  })();
  const leaves: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(leafGeo, M.brassBrushed);
    g.add(leaf, lineObj(engraving, M.engrave));
    g.userData.side = side;
    leaves.push(g);
    elevator.add(g);
  }
  const car = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.3), M.warm.clone());
  car.position.z = -0.6;
  elevator.add(car);
  for (const [sx, sy, x, y] of [[3.8, 0.22, 0, 2.85], [0.22, 5.9, 1.8, 0], [0.22, 5.9, -1.8, 0]] as const) {
    const b = new THREE.Mesh(unitBox, M.brass);
    b.scale.set(sx, sy, 0.3);
    b.position.set(x, y - 0.05, 0.05);
    elevator.add(b);
  }
  const dial = new THREE.Group();
  dial.position.set(0, 3.95, 0.12);
  elevator.add(dial);
  const dialFace = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48, 0, Math.PI), M.brassBrushed);
  dial.add(dialFace);
  const dialRim = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.55, 48, 1, 0, Math.PI), M.brass);
  dial.add(dialRim);
  const ticks: number[] = [];
  for (let i = 0; i <= 30; i++) {
    const a = Math.PI * (i / 30);
    const r1 = i % 5 === 0 ? 1.12 : 1.24;
    ticks.push(Math.cos(a) * r1, Math.sin(a) * r1, 0.02, Math.cos(a) * 1.36, Math.sin(a) * 1.36, 0.02);
  }
  dial.add(lineObj(ticks, M.engrave));
  const stopLamps: THREE.Mesh[] = [];
  const stopAngles = [150, 90, 30].map((d) => (d * Math.PI) / 180);
  stopAngles.forEach((a) => {
    const lamp = new THREE.Mesh(bulbGeo, M.sodiumDim.clone());
    lamp.position.set(Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.06);
    lamp.scale.setScalar(0.55);
    stopLamps.push(lamp);
    dial.add(lamp);
  });
  const needle = new THREE.Group();
  const needleBar = new THREE.Mesh(unitBox, M.obsidian);
  needleBar.scale.set(0.05, 1.25, 0.03);
  needleBar.position.set(0, 0.62, 0.08);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), M.brass);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.08;
  needle.add(needleBar, hub);
  dial.add(needle);
  const elevLightPos = new THREE.Vector3(DOOR_POS.x + 4, VAULT_FLOOR + 6.5, DOOR_POS.z);

  // Placa de latão (o texto gravado é HTML por cima; aqui é o metal e a luz rasante)
  const plate = new THREE.Group();
  plate.position.copy(PLATE_POS);
  plate.rotation.y = -Math.PI / 2;
  vault.add(plate);
  const plateBody = new THREE.Mesh(new THREE.BoxGeometry(6.6, 4.0, 0.1), M.brassBrushed);
  plate.add(plateBody);
  for (const [sx, sy, x, y] of [[6.9, 0.14, 0, 2.06], [6.9, 0.14, 0, -2.06], [0.14, 4.26, 3.38, 0], [0.14, 4.26, -3.38, 0]] as const) {
    const b = new THREE.Mesh(unitBox, M.brass);
    b.scale.set(sx, sy, 0.16);
    b.position.set(x, y, 0.03);
    plate.add(b);
  }
  const screwGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12);
  for (const [x, y] of [[-3.05, 1.72], [3.05, 1.72], [-3.05, -1.72], [3.05, -1.72]] as const) {
    const s = new THREE.Mesh(screwGeo, M.brassDark);
    s.rotation.x = Math.PI / 2;
    s.position.set(x, y, 0.07);
    plate.add(s);
  }

  /* ───────── Rua: folhas da Gazeta ───────── */
  const paperTex = makeNewspaperTexture(brand);
  const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.85, side: THREE.DoubleSide });
  const paperGeo = new THREE.PlaneGeometry(0.9, 1.2, 4, 4);
  const papers = [
    { rest: new THREE.Vector3(1.6, 0.03, 24.4), rot: 0.4 },
    { rest: new THREE.Vector3(-0.8, 0.03, 26.4), rot: -0.9 },
    { rest: new THREE.Vector3(3.8, 0.03, 26.9), rot: 2.1 },
  ].map((p) => {
    const m = new THREE.Mesh(paperGeo, paperMat);
    m.rotation.set(-Math.PI / 2, 0, p.rot);
    m.position.copy(p.rest);
    street.add(m);
    return { mesh: m, ...p };
  });

  /* ───────── API ───────── */

  function setPalette(dawn: boolean, renderer?: THREE.WebGLRenderer) {
    pal = dawn ? PALETTES.dawn : PALETTES.night;
    skyMat.uniforms.uTop!.value.set(pal.skyTop);
    skyMat.uniforms.uMid!.value.set(pal.skyMid);
    skyMat.uniforms.uHorizon!.value.set(pal.horizon);
    skyMat.uniforms.uGlow!.value.set(pal.glow);
    fogColorStreet.set(pal.fog);
    fog.color.copy(fogColorStreet);
    fog.density = pal.fogDensity;
    hemi.color.set(pal.hemiSky);
    hemi.groundColor.set(pal.hemiGround);
    hemi.intensity = pal.hemi;
    moon.color.set(pal.moon);
    moon.intensity = pal.moonI;
    groundMat.color.set(pal.ground);
    sheetMat.uniforms.uColor!.value.set(pal.sheet);
    sheetMat.uniforms.uOpacity!.value = dawn ? 0.42 : 0.3;
    for (const m of [winMat, winMatR]) m.uniforms.uSky!.value.setRGB(...pal.windowSky);
    IL.uCool.value.setRGB(...pal.cool);
    IL.uWarm.value.setRGB(...pal.warm);
    IL.uRimCool.value.setRGB(...pal.rimCool);
    IL.uRimWarm.value.setRGB(...pal.rimWarm);
    if (renderer) {
      // Ambiente para reflexos (obsidiana e latão): o próprio céu + quatro fachos de sódio.
      const envScene = new THREE.Scene();
      const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone());
      envScene.add(envSky);
      const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.3, 0.5) });
      for (const [x, z, h] of [[-30, 10, 3], [28, 18, 2.5], [-14, 36, 4], [34, -20, 3]] as const) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(4, h), panelMat);
        p.position.set(x, 2, z);
        p.lookAt(0, 2, 0);
        envScene.add(p);
      }
      // Faixa fria alta (a lua e o céu safira): dá o reflexo azul nas faces de cima.
      const cool = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshBasicMaterial({ color: dawn ? new THREE.Color(1.6, 1.5, 1.5) : new THREE.Color(0.22, 0.38, 0.85) }));
      cool.position.set(0, 30, -30);
      cool.lookAt(0, 0, 0);
      envScene.add(cool);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const rt = pmrem.fromScene(envScene, 0.035);
      scene.environment?.dispose();
      scene.environment = rt.texture;
      pmrem.dispose();
      envSky.geometry.dispose();
      (envSky.material as THREE.Material).dispose();
    }
  }

  let lastTop = 0;
  /** Andar já pousado (etiqueta e mira só aparecem depois). */
  const entered = (fl: TowerFloor) => clock >= (builds.get(fl.lobby.id)?.enterAt ?? 0) + OBRA.FALL;
  /** Seja o que for que se mexa (obra, andar novo, andar desfeito), o layout roda a cada quadro. */
  let animating = true;

  const world: World = {
    scene,
    setFloors(next, mode) {
      const change: FloorsChange = { lit: 0, added: [], removed: 0 };
      const prevIds = floors.map((f) => f.lobby.id);
      const structural = next.length !== floors.length || next.some((f, i) => f.lobby.id !== prevIds[i] || f.lobby.slots !== floors[i]?.lobby.slots);
      if (mode === 'live' && structural && floors.length) {
        // Quem sumiu vira fantasma (se desfaz); quem ficou desce ou sobe até o novo nível;
        // quem chegou é conjurado (cai do céu se for o topo, entra como gaveta no meio).
        const nextIds = new Set(next.map((f) => f.lobby.id));
        floors.forEach((fl) => {
          if (nextIds.has(fl.lobby.id)) return;
          const b = builds.get(fl.lobby.id);
          ghosts.push({ fl, at: clock, y: b?.y ?? PLINTH_H });
          builds.delete(fl.lobby.id);
          change.removed++;
        });
        ghosts = ghosts.slice(-4);
        const shiftAt = clock + (change.removed ? 0.5 : 0);
        next.forEach((fl, i) => {
          const b = builds.get(fl.lobby.id);
          if (b) {
            if (Math.abs(b.y - restY(i)) > 0.01) {
              b.fromY = b.y;
              b.shiftAt = shiftAt;
            }
            return;
          }
          builds.set(fl.lobby.id, { enterAt: shiftAt + 0.45, kind: i === next.length - 1 ? 'fall' : 'slide', fromY: null, shiftAt, y: restY(i), landed: false });
          change.added.push(i + 1);
        });
      } else if (mode !== 'live' || structural) {
        for (const fl of next) {
          if (!builds.has(fl.lobby.id)) {
            builds.set(fl.lobby.id, { enterAt: mode === 'hold' ? 1e7 : -1e3, kind: 'fall', fromY: null, shiftAt: 0, y: 0, landed: mode !== 'hold' });
          }
        }
      }
      floors = next;
      for (const id of [...builds.keys()]) if (!next.some((f) => f.lobby.id === id)) builds.delete(id);
      change.lit = writeStates(mode);
      if (structural || mode !== 'live') {
        buildPlinth();
        buildCrown();
        if (mode !== 'live') crownY = restY(floors.length);
      }
      // Estados que mudam forma (cheio, em partida) também mexem nas matrizes.
      animating = true;
      lastExplode = -1;
      paintFriezes(lastFocus);
      if (mode === 'hold') {
        plinth.scale.y = 0.0001;
        crown.visible = false;
      } else if (mode === 'instant') {
        plinth.scale.y = 1;
        crown.visible = true;
        spire.position.y = 0;
        flame.mat.uniforms.uIgnite!.value = 1;
        circle.mat.uniforms.uFlare!.value = 0;
      }
      return change;
    },
    startOpening(again = false) {
      if (obra && !again) return;
      if (again) {
        embers.clear();
        spire.userData.lit = false;
        world.setFloors(floors, 'hold');
        floors.forEach((fl) => {
          const b = builds.get(fl.lobby.id);
          if (b) b.enterAt = 1e7;
        });
      }
      const plan = planObra(floors);
      obra = { plan, t0: clock, skipT: null, done: false };
      floors.forEach((fl, f) => {
        const b = builds.get(fl.lobby.id);
        if (b) {
          b.enterAt = clock + (plan.fall[f] ?? 0);
          b.kind = 'fall';
          b.landed = false;
        }
      });
      writeStates('opening', plan);
      // Brasas: uma por jogador real, na ordem de entrada (o destino é a janela já pousada).
      for (const e of plan.embers) {
        const fl = floors[e.f];
        if (fl) soul(e.f, e.w, fl.windows[e.w] ?? 'lit', obra.t0 + e.launch, OBRA.FLY, true);
      }
      buildThreads();
      threads.visible = true;
      crown.visible = true;
      animating = true;
    },
    skip() {
      if (obra && !obra.done && obra.skipT === null) obra.skipT = clock - obra.t0;
    },
    obra: () => (obra ? { t: clock - obra.t0, plan: obra.plan, done: obra.done } : null),
    update(f) {
      // Relógio do mundo: tempo real, acelerado só enquanto a abertura pulada corre para o fim.
      if (f.seek !== undefined && obra) {
        clock = obra.t0 + f.seek;
        obra.done = f.seek >= obra.plan.end;
        animating = true;
        spire.userData.lit = f.seek > obra.plan.beacon;
      } else if (obra && !obra.done) {
        const t = clock - obra.t0;
        const nt = advanceObra(t, f.dt, obra.plan.end, obra.skipT);
        clock += nt - t;
        if (nt >= obra.plan.end) obra.done = true;
      } else {
        clock += f.dt;
      }
      const t = clock;
      winMat.uniforms.uTime!.value = t;
      winMatR.uniforms.uTime!.value = t;
      sheetMat.uniforms.uTime!.value = f.time;
      embers.mat.uniforms.uClock!.value = t;
      embers.mat.uniforms.uPx!.value = f.heightPx * 0.9;
      circle.mat.uniforms.uClock!.value = t;
      flame.mat.uniforms.uClock!.value = t;
      updateIllus(f.camera);

      // Abertura: círculo, fios, saguão, coroa, agulha e farol seguem o roteiro.
      const progress = Math.max(f.progress, obra ? 1 : 0);
      circle.mat.uniforms.uProg!.value = progress;
      if (obra) {
        const p = obra.plan;
        const ot = t - obra.t0;
        circle.mat.uniforms.uFlare!.value = (1 - ramp(p.threadsOut[0], p.climax + 0.4, ot)) * (0.6 + 0.4 * ramp(0, 0.4, ot));
        plinth.scale.y = Math.max(0.0001, easeOutBack(clamp01((ot - p.plinth[0]) / (p.plinth[1] - p.plinth[0]))));
        threadMat.uniforms.uDraw!.value = ramp(p.threadsIn[0], p.threadsIn[1], ot) * 1.3;
        threadMat.uniforms.uUndraw!.value = ramp(p.threadsOut[0], p.threadsOut[1], ot);
        threadMat.uniforms.uAlpha!.value = 1 - ramp(p.threadsOut[1] - 0.1, p.threadsOut[1], ot);
        threads.visible = ot < p.threadsOut[1];
        const c = clamp01((ot - p.crown) / 0.4);
        const crownDrop = DROP * 0.6 * (1 - c * c);
        crown.position.y = crownY + crownDrop;
        crown.rotation.y = 0.26 * (1 - c) * (1 - c);
        crown.visible = ot >= p.crown;
        const sp = easeOutCubic(clamp01((ot - p.spire) / 0.5));
        spire.position.y = -((spire.userData.drop as number) ?? 3) * (1 - sp);
        const ig = clamp01((ot - p.beacon) / 0.25);
        flame.mat.uniforms.uIgnite!.value = ig * (1 + 0.6 * Math.exp(-Math.max(0, ot - p.beacon - 0.25) * 4));
        if (ig > 0 && !spire.userData.lit) {
          spire.userData.lit = true;
          // Faíscas frias saindo do farol quando ele pega.
          flame.mesh.getWorldPosition(tmpA);
          for (let i = 0; i < (high ? 16 : 6); i++) {
            tmpB.set((hash(i) - 0.5) * 3, 1 + hash(i + 3) * 2.5, (hash(i + 5) - 0.5) * 3);
            embers.emit(tmpA, tmpB, t, 0.9 + hash(i + 7) * 0.5, EMBER.cold, hash(i + 11));
          }
        }
        if (obra.done) {
          threads.visible = false;
          crown.rotation.y = 0;
          circle.mat.uniforms.uFlare!.value = 0;
        }
      }
      pulse = Math.max(0, pulse - f.dt * 1.6);
      circle.mat.uniforms.uPulse!.value = pulse;

      // Andares: pousos geram poeira de brasa; tudo que se mexe refaz o layout neste quadro.
      for (let i = 0; i < floors.length; i++) {
        const b = builds.get(floors[i]!.lobby.id);
        if (b && !b.landed && t >= b.enterAt + OBRA.FALL) {
          b.landed = true;
          if (t - (b.enterAt + OBRA.FALL) < 0.5) puff(i, t);
        }
      }
      // Andar que fechou: espirra brasa (e fumaça, no alto) uma vez e some depois de ~1 s.
      for (const g of ghosts) {
        if (g.puffed) continue;
        g.puffed = true;
        tmpM.compose(tmpV.set(0, g.y, 0), tmpQ.identity(), tmpS.set(1, 1, 1));
        for (let i = 0; i < (high ? 18 : 8); i++) {
          tmpA.set((hash(i) - 0.5) * floorW(g.fl.lobby.slots), hash(i + 2), floorD(g.fl.lobby.slots) * 0.5).applyMatrix4(tmpM);
          tmpB.set((hash(i + 4) - 0.5) * 1.5, 0.5 + hash(i + 6), 0.6);
          const smoke = high && i % 3 === 0;
          embers.emit(tmpA, tmpB, t + hash(i) * 0.6, smoke ? 2.0 : 1.0, smoke ? EMBER.smoke : EMBER.spark, hash(i + 9));
        }
      }
      const ghostCount = ghosts.length;
      ghosts = ghosts.filter((g) => clock - g.at <= 0.95);
      if (ghosts.length !== ghostCount) {
        writeStates('live');
        paintFriezes(lastFocus);
        animating = true;
      }

      if (animating || Math.abs(f.explode - lastExplode) > 0.0005) {
        animating = layout(f.explode) || ghosts.length > 0;
        lastExplode = f.explode;
      }
      if (!obra || obra.done) crown.position.y = crownY;
      embers.flush();

      // Vista explodida: os fios da constelação se desenham; a luz vaza pelo vão.
      const wantDraw = f.explode > 0.45 ? 1.35 : 0;
      constDraw += (wantDraw - constDraw) * (1 - Math.exp(-f.dt * (wantDraw > constDraw ? 1.6 : 6)));
      constMat.uniforms.uDraw!.value = constDraw;
      constMat.uniforms.uAlpha!.value = Math.min(0.9, f.explode * 1.1);
      constellation.visible = f.explode > 0.02;
      M.floorLeak.value.w = f.explode * 0.3;
      if (f.focus !== lastFocus) {
        lastFocus = f.focus;
        winMat.uniforms.uFocus!.value = f.focus;
        paintFriezes(f.focus);
      }

      // Primeiro plano desfocado: só no hero, com paralaxe de perto.
      fg.mat.uniforms.uAlpha!.value = f.hero;
      fg.mat.uniforms.uAspect!.value = f.aspect;
      (fg.mat.uniforms.uOff!.value as THREE.Vector2).set(-f.pointer.x * 0.035, f.pointer.y * 0.02);
      fg.mesh.visible = f.hero > 0.01 && !f.underground;

      // Acima ou abaixo do chão: só um dos mundos desenha (e a névoa muda de cor).
      street.visible = !f.underground;
      reflection.visible = !f.underground;
      vault.visible = f.underground;
      fog.color.copy(f.underground ? VAULT_FOG : fogColorStreet);
      fog.density = f.underground ? 0.028 : pal.fogDensity;
      pool.forEach((l) => (l.intensity = 0));
      if (f.underground) {
        const [key, elev, rake] = pool;
        key?.position.copy(vaultKeyPos);
        key?.color.set('#ffb86b');
        if (key) (key.intensity = 32), (key.distance = 16);
        if (elev) {
          elev.position.copy(elevLightPos).lerp(DOOR_POS, f.doors * 0.55);
          elev.color.set('#ffc98a');
          elev.intensity = 16 + 26 * f.doors;
          elev.distance = 12;
        }
        if (rake) {
          // luz rasante: corre a placa de um lado ao outro conforme a rolagem
          rake.position.set(PLATE_POS.x - 1.1, PLATE_POS.y + 2.4, PLATE_POS.z + (f.plateLight - 0.5) * 8);
          rake.color.set('#ffd9a0');
          rake.intensity = 7;
          rake.distance = 8;
        }
      } else {
        lampSpots.forEach((p, i) => {
          const l = pool[i]!;
          l.position.set(p.x + 0.8, 5.0, p.z);
          l.color.set('#ffae55');
          l.intensity = 26;
          l.distance = 20;
        });
        const door = pool[lampSpots.length]!;
        door.position.copy(doorLightPos);
        door.color.set('#ffb867');
        door.intensity = 9 * plinth.scale.y;
        door.distance = 9;
      }

      if (f.underground) {
        ring.rotation.y = -f.vaultRot * (Math.PI / 3);
        const front = Math.round(f.vaultRot);
        cardMotifs.forEach((m, i) => {
          const near = 1 - Math.min(1, Math.abs(f.vaultRot - i) * 1.4);
          (m.material as THREE.LineBasicMaterial).opacity = 0.35 + 0.65 * near;
          m.position.z = 0.0 + 0.04 * near;
        });
        cardPanes.forEach((p, i) => (p.position.y = i === front ? 0.04 : 0));
        needle.rotation.z = stopAngles[0]! - Math.PI / 2 - f.needle * (Math.PI / 3);
        stopLamps.forEach((l, i) => {
          const on = 1 - Math.min(1, Math.max(0, (Math.abs(f.needle - i) - 0.15) / 0.35));
          (l.material as THREE.MeshBasicMaterial).color.setRGB(0.32 + 2.9 * on, 0.2 + 1.5 * on, 0.08 + 0.45 * on);
        });
        leaves.forEach((g) => (g.position.x = (g.userData.side as number) * (0.8 + f.doors * 1.5)));
        (car.material as THREE.MeshBasicMaterial).color.setRGB(1.6 * f.doors + 0.05, 0.95 * f.doors + 0.04, 0.42 * f.doors + 0.03);
      } else {
        // Chama do farol sempre de frente para a câmera (desconta a rotação da coroa).
        spire.getWorldQuaternion(tmpQ);
        flame.mesh.quaternion.copy(tmpQ.invert().multiply(f.camera.quaternion));
        // Folhas da Gazeta: o vento da rolagem levanta; parou, assentam no asfalto.
        papers.forEach((p, i) => {
          const w = f.wind;
          const ph = f.time * (0.9 + i * 0.23) + i * 2.1;
          p.mesh.position.set(
            p.rest.x + w * (Math.sin(ph) * 1.4 + i * 0.4),
            p.rest.y + w * (0.9 + 0.6 * Math.sin(ph * 1.7)),
            p.rest.z + w * Math.cos(ph * 0.8) * 1.1,
          );
          p.mesh.rotation.set(-Math.PI / 2 + w * Math.sin(ph * 2.3) * 0.9, w * Math.cos(ph * 1.9) * 0.6, p.rot + w * ph * 0.3);
        });
      }
      lastTop = crown.position.y;
    },
    setDawn(dawn, renderer) {
      setPalette(dawn, renderer);
    },
    floorAnchor(i, out, side = 'left') {
      const fl = floors[i];
      const fm = floorMats[i];
      if (!fl || !fm || !entered(fl)) return false;
      if (side === 'right') {
        out.set(floorW(fl.lobby.slots) / 2 + 0.25, FLOOR_H * 0.5, floorD(fl.lobby.slots) / 2).applyMatrix4(fm);
        return true;
      }
      out.set(-floorW(fl.lobby.slots) / 2 - 0.2, FLOOR_H * 0.5, floorD(fl.lobby.slots) / 2).applyMatrix4(fm);
      // À esquerda dos fios da constelação (uma faixa por modo).
      out.x = -floorW(12) / 2 - 1.6 - modes.length * 0.45;
      return true;
    },
    floorMark(i, out) {
      const fl = floors[i];
      const fm = floorMats[i];
      if (!fl || !fm || !entered(fl)) return false;
      out.set(floorW(fl.lobby.slots) / 2 - PAD * 0.5, FLOOR_H * 0.5, frontZ(floorD(fl.lobby.slots)) + 0.05).applyMatrix4(fm);
      return true;
    },
    showAll() {
      street.visible = reflection.visible = vault.visible = true;
    },
    floorCount: () => floors.length,
    topY: () => lastTop,
    usingKit: () => kit !== null,
    dispose() {
      disposed = true;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      noise.dispose();
      paperTex.dispose();
      M.brushed.dispose();
      scene.environment?.dispose();
    },
  };

  setPalette(false);
  return world;
}
