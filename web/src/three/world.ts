import * as THREE from 'three';
import type { TowerFloor, WindowKind } from '../lib/towerData';
import { createConeMaterial, createFogSheetMaterial, createSkyMaterial, createWindowMaterial } from './shaders';
import { makeBrushedTexture, makeNewspaperTexture, makeNoiseTexture } from './textures';

/**
 * O mundo da Torre, montado em código a partir dos andares (lobbies).
 * Tudo que se repete é instanciado (uma chamada de desenho por tipo de peça).
 *
 * Coordenadas: a torre nasce em (0, 0, 0), a rua corre na frente (z positivo).
 * O cofre (cenas 3 a 5) fica no porão, em y ≈ −44; a câmera atravessa o chão.
 */

export type Quality = 'high' | 'mid';

export const FLOOR_H = 1;
const PLINTH_H = 3.2;
const BAY = 0.62;
const PAD = 0.46;
const WIN_W = 0.4;
const WIN_H = 0.6;
const GAP = 0.9;
const MAX_FLOORS = 24;
const MAX_SLOTS = 12;
export const VAULT_FLOOR = -47;
export const RING_CENTER = new THREE.Vector3(0, VAULT_FLOOR, -4);
export const RING_R = 3.6;
export const DOOR_POS = new THREE.Vector3(-17.94, VAULT_FLOOR + 2.8, -4);
export const PLATE_POS = new THREE.Vector3(17.92, -43.2, 3);

const floorW = (slots: number) => slots * BAY + PAD * 2;
const floorD = (slots: number) => 1.5 + slots * 0.4;
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

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
}

const PALETTES: Record<'night' | 'dawn', Palette> = {
  night: {
    skyTop: '#03060c',
    skyMid: '#0a1222',
    horizon: '#1a1f28',
    glow: '#4d3217',
    fog: '#121519',
    fogDensity: 0.0115,
    hemiSky: '#2c3c5e',
    hemiGround: '#0b0806',
    hemi: 0.55,
    moon: '#8ea6d8',
    moonI: 0.45,
    ground: '#0a0d11',
    sheet: '#3b4048',
    windowSky: [0.26, 0.34, 0.5],
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
    hemi: 1.05,
    moon: '#ffd3a3',
    moonI: 1.15,
    ground: '#23262b',
    sheet: '#d8d2cb',
    windowSky: [0.75, 0.72, 0.74],
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
}

export interface World {
  scene: THREE.Scene;
  setFloors(floors: TowerFloor[], now: number, opening: boolean): number;
  update(f: FrameState): void;
  setDawn(dawn: boolean, renderer: THREE.WebGLRenderer): void;
  /** Ponto da etiqueta do andar: à esquerda dos fios (desktop) ou rente à direita do andar (telas estreitas). */
  floorAnchor(i: number, out: THREE.Vector3, side?: 'left' | 'right'): boolean;
  /** Deixa tudo visível para compilar os shaders de uma vez (rua e porão). */
  showAll(): void;
  floorCount(): number;
  topY(): number;
  dispose(): void;
}

/* ───────── Materiais ───────── */

function materials(q: Quality) {
  const brushed = makeBrushedTexture();
  return {
    obsidian: new THREE.MeshStandardMaterial({ color: '#06080b', roughness: 0.16, metalness: 0.35, envMapIntensity: 1.25 }),
    obsidianMatte: new THREE.MeshStandardMaterial({ color: '#0b0e12', roughness: 0.42, metalness: 0.25 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b98d48', roughness: 0.34, metalness: 1, envMapIntensity: 1.3 }),
    brassDark: new THREE.MeshStandardMaterial({ color: '#7d5f30', roughness: 0.45, metalness: 1 }),
    brassBrushed: new THREE.MeshStandardMaterial({
      color: '#c49a55',
      roughness: 0.42,
      metalness: 1,
      roughnessMap: brushed,
      envMapIntensity: 1.1,
    }),
    city: new THREE.MeshStandardMaterial({ color: '#0a0d12', roughness: 0.92, metalness: 0 }),
    stone: new THREE.MeshStandardMaterial({ color: '#111419', roughness: 0.78, metalness: 0 }),
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
    sodiumDim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.2, 0.08) }),
    warm: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.95, 0.42) }),
    frieze: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    line: new THREE.LineBasicMaterial({ color: new THREE.Color(1.9, 1.25, 0.55), transparent: true, opacity: 0.85 }),
    lineDim: new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.42, 0.24), transparent: true, opacity: 0.7 }),
    engrave: new THREE.LineBasicMaterial({ color: '#3a2a12' }),
    brushed,
  };
}

type Mats = ReturnType<typeof materials>;

const unitBox = new THREE.BoxGeometry(1, 1, 1);

function inst(geo: THREE.BufferGeometry, mat: THREE.Material, count: number) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  m.frustumCulled = false;
  return m;
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

export function createWorld(quality: Quality, brand: string, modes: { motif: string; hue: number }[]): World {
  const scene = new THREE.Scene();
  const M: Mats = materials(quality);
  const noise = makeNoiseTexture();
  let pal = PALETTES.night;

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
  const cityCount = quality === 'high' ? 90 : 56;
  const city = inst(unitBox, M.city, cityCount);
  const tanks = inst(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), M.city, 24);
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
      if (tk < 24 && hash(i + 13) > 0.55) {
        m.compose(new THREE.Vector3(x + (hash(i) - 0.5) * w * 0.5, h + 1.4, z), q, new THREE.Vector3(1, 1, 1));
        tanks.setMatrixAt(tk++, m);
      }
    }
    city.count = n;
    tanks.count = tk;
  }
  street.add(city, tanks);

  /* Postes de luz de sódio */
  const lampSpots = quality === 'high'
    ? [new THREE.Vector3(-8.5, 0, 13), new THREE.Vector3(7.8, 0, 10.5), new THREE.Vector3(-2.6, 0, 25)]
    : [new THREE.Vector3(-8.5, 0, 13), new THREE.Vector3(7.8, 0, 10.5)];
  const coneMat = createConeMaterial(new THREE.Color(1.0, 0.62, 0.26), quality === 'high' ? 0.22 : 0.18);
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
  const sheetHeights = quality === 'high' ? [0.7, 2.1, 4.6] : [1.2];
  for (const y of sheetHeights) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), sheetMat);
    s.rotation.x = -Math.PI / 2;
    s.position.y = y;
    s.renderOrder = 5;
    sheets.push(s);
    street.add(s);
  }

  /* ───────── Torre ───────── */
  const tower = new THREE.Group();
  street.add(tower);
  const MAX_WIN = MAX_FLOORS * MAX_SLOTS;
  const bodies = inst(unitBox, M.obsidian, MAX_FLOORS);
  const bands = inst(unitBox, M.brass, MAX_FLOORS);
  const ledges = inst(unitBox, M.brass, MAX_FLOORS);
  const friezes = inst(unitBox, M.frieze, MAX_FLOORS);
  friezes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLOORS * 3), 3);
  const signs = inst(unitBox, M.sodium, MAX_FLOORS);
  const piers = inst(unitBox, M.obsidianMatte, MAX_FLOORS * (MAX_SLOTS + 1));
  const strips = inst(unitBox, M.brass, MAX_FLOORS * 4);
  const winGeo = new THREE.PlaneGeometry(WIN_W, WIN_H);
  const stateAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WIN * 3), 3);
  const infoAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WIN * 4), 4);
  stateAttr.setUsage(THREE.DynamicDrawUsage);
  winGeo.setAttribute('aState', stateAttr);
  winGeo.setAttribute('aInfo', infoAttr);
  const winMat = createWindowMaterial(false, WIN_W, WIN_H);
  const winMatR = createWindowMaterial(true, WIN_W, WIN_H);
  const windows = inst(winGeo, winMat, MAX_WIN);
  const windowsR = new THREE.InstancedMesh(winGeo, winMatR, MAX_WIN);
  windowsR.instanceMatrix = windows.instanceMatrix;
  windowsR.frustumCulled = false;
  windowsR.renderOrder = -1;
  tower.add(bodies, bands, ledges, friezes, signs, piers, strips, windows);
  reflection.add(windowsR);

  // Saguão (embasamento) com pilastras de latão, porta acesa e marquise
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

  // Coroa: degraus, leque de raios de latão, agulha, mastro e farol
  const crown = new THREE.Group();
  tower.add(crown);
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.5) });

  // Constelação: fios de latão ligando andares do mesmo modo (aparecem com a separação)
  const constGeo = new THREE.BufferGeometry();
  constGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX_FLOORS * 4 * 3 * 2), 3));
  const constMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 0.95, 0.45), transparent: true, opacity: 0 });
  const constellation = new THREE.LineSegments(constGeo, constMat);
  constellation.frustumCulled = false;
  tower.add(constellation);

  let floors: TowerFloor[] = [];
  let kindsById = new Map<string, WindowKind[]>();
  let lastExplode = -1;
  let lastFocus = -2;
  const floorMats: THREE.Matrix4[] = [];
  const tmpM = new THREE.Matrix4();
  const tmpL = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const kindNum = (k: WindowKind) => (k === 'friend' ? 2 : k === 'lit' ? 1 : 0);

  function buildCrown() {
    crown.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g && g !== unitBox && g !== bulbGeo) g.dispose();
    });
    crown.clear();
    const top = floors[floors.length - 1];
    const w = top ? floorW(top.lobby.slots) : 4;
    const d = top ? floorD(top.lobby.slots) : 3;
    const add = (mesh: THREE.Object3D) => crown.add(mesh);
    const box = (mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(unitBox, mat);
      b.scale.set(sx, sy, sz);
      b.position.set(x, y, z);
      add(b);
      return b;
    };
    box(M.obsidian, w * 0.78, 0.9, d * 0.78, 0, 0.45, 0);
    box(M.brass, w * 0.78 + 0.2, 0.08, d * 0.78 + 0.2, 0, 0.92, 0);
    box(M.obsidian, w * 0.54, 0.9, d * 0.54, 0, 1.4, 0);
    box(M.brass, w * 0.54 + 0.16, 0.07, d * 0.54 + 0.16, 0, 1.86, 0);
    // leque de raios na face da frente
    for (let i = 0; i < 9; i++) {
      const a = ((i - 4) / 4) * 0.62;
      const ray = box(M.brass, 0.05, 1.5, 0.05, Math.sin(a) * 0.75, 2.5 + Math.cos(a) * 0.75 - 0.75, d * 0.27 + 0.03);
      ray.rotation.z = -a;
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.3, 3.6, 4, 1), M.obsidian);
    spire.rotation.y = Math.PI / 4;
    spire.position.y = 1.9 + 1.8;
    add(spire);
    // arestas da agulha em fio de latão aceso
    const fins = new THREE.LineSegments(new THREE.EdgesGeometry(spire.geometry), M.line);
    fins.rotation.y = Math.PI / 4;
    fins.position.y = 1.9 + 1.8;
    fins.scale.setScalar(1.01);
    add(fins);
    box(M.brass, 0.05, 3.2, 0.05, 0, 5.7 + 1.6, 0);
    const beacon = new THREE.Mesh(bulbGeo, beaconMat);
    beacon.position.y = 5.7 + 3.25;
    beacon.scale.setScalar(0.7);
    beacon.name = 'beacon';
    add(beacon);
  }

  function buildPlinth() {
    const base = floors[0];
    const w = (base ? floorW(base.lobby.slots) : 6) + 1.4;
    const d = (base ? floorD(base.lobby.slots) : 5) + 1.4;
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
    const n = Math.min(32, Math.floor(w / 0.9));
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.45 + i * ((w - 0.9) / Math.max(1, n - 1));
      if (Math.abs(x) < 1.3) continue;
      tmpM.compose(tmpV.set(x, PLINTH_H / 2 - 0.1, d / 2 + 0.04), tmpQ.identity(), tmpS.set(0.09, PLINTH_H - 0.4, 0.08));
      pilasters.setMatrixAt(k++, tmpM);
    }
    pilasters.count = k;
    pilasters.instanceMatrix.needsUpdate = true;
  }

  function writeStates(now: number, opening: boolean): number {
    let wi = 0;
    let lit = 0;
    const order = new Map<string, number>();
    if (opening) {
      // Ordem de chegada (joinOrder já ordenou pelo dado); aqui só o índice por janela.
      const events: { at: number; key: string }[] = [];
      floors.forEach((fl, f) => {
        const taken = fl.lobby.players;
        const opened = -Math.max(0.5, fl.lobby.minutesAgo);
        for (let w = 0; w < taken; w++) events.push({ at: opened * (1 - w / Math.max(1, taken)), key: `${f}:${w}` });
      });
      events.sort((a, b) => a.at - b.at);
      events.forEach((e, i) => order.set(e.key, i));
    }
    const total = Math.max(1, order.size);
    floors.forEach((fl, f) => {
      const prev = kindsById.get(fl.lobby.id);
      const flags = (fl.lobby.status === 'em-partida' ? 1 : 0) | (fl.lobby.locked ? 2 : 0) | (fl.lobby.mine ? 4 : 0);
      fl.windows.forEach((kind, w) => {
        const k = kindNum(kind);
        const before = prev?.[w];
        const i3 = wi * 3;
        if (opening) {
          const idx = order.get(`${f}:${w}`);
          stateAttr.array[i3] = 0;
          stateAttr.array[i3 + 1] = k;
          stateAttr.array[i3 + 2] = k > 0 && idx !== undefined ? now + 0.35 + (idx / total) * 1.6 : now;
        } else if (before === undefined) {
          stateAttr.array[i3] = k;
          stateAttr.array[i3 + 1] = k;
          stateAttr.array[i3 + 2] = now - 10;
        } else if (kindNum(before) !== k) {
          stateAttr.array[i3] = kindNum(before);
          stateAttr.array[i3 + 1] = k;
          stateAttr.array[i3 + 2] = now;
          if (k > 0) lit++;
        }
        const i4 = wi * 4;
        infoAttr.array[i4] = hash(f * 31 + w * 7 + fl.lobby.id.length);
        infoAttr.array[i4 + 1] = flags;
        infoAttr.array[i4 + 2] = f;
        infoAttr.array[i4 + 3] = w;
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

  function layout(explode: number) {
    let wi = 0;
    let pi = 0;
    let si = 0;
    floorMats.length = 0;
    floors.forEach((fl, f) => {
      const slots = fl.lobby.slots;
      const w = floorW(slots);
      const d = floorD(slots);
      const y = PLINTH_H + f * FLOOR_H + f * explode * GAP + explode * 0.6;
      const rot = (hash(f + 0.5) - 0.5) * 0.16 * explode;
      const fm = new THREE.Matrix4().compose(tmpV.set(0, y, explode * Math.sin(f * 1.7) * 0.25), tmpQ.setFromAxisAngle(Y, rot), tmpS.set(1, 1, 1));
      floorMats.push(fm);
      const put = (mesh: THREE.InstancedMesh, i: number, x: number, yy: number, z: number, sx: number, sy: number, sz: number) => {
        tmpL.compose(tmpV.set(x, yy, z), tmpQ.identity(), tmpS.set(sx, sy, sz));
        tmpM.multiplyMatrices(fm, tmpL);
        mesh.setMatrixAt(i, tmpM);
      };
      put(bodies, f, 0, FLOOR_H / 2, 0, w, FLOOR_H * 0.996, d);
      put(bands, f, 0, 0.025, 0, w + 0.06, 0.05, d + 0.06);
      const next = floors[f + 1];
      const setback = !next || next.lobby.slots < slots || explode > 0.05;
      put(ledges, f, 0, FLOOR_H - 0.05, 0, setback ? w + 0.3 : 0.0001, setback ? 0.1 : 0.0001, setback ? d + 0.3 : 0.0001);
      put(friezes, f, 0, 0.14, d / 2 + 0.035, w - 0.7, 0.032, 0.02);
      const full = fl.lobby.players >= slots && fl.lobby.status !== 'em-partida';
      put(signs, f, -w / 2 + 0.3, 0.86, d / 2 + 0.06, full ? 0.34 : 0.0001, full ? 0.07 : 0.0001, 0.02);
      for (let k = 0; k <= slots; k++) {
        put(piers, pi++, -w / 2 + PAD + BAY * k, 0.53, d / 2 + 0.05, 0.075, 0.86, 0.12);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(strips, si++, (sx * w) / 2, FLOOR_H / 2, sz * d * 0.22, 0.04, FLOOR_H, 0.06);
      for (let k = 0; k < slots; k++) {
        put(windows, wi++, -w / 2 + PAD + BAY * (k + 0.5), 0.53, d / 2 + 0.004, 1, 1, 1);
      }
    });
    bodies.count = bands.count = ledges.count = friezes.count = signs.count = floors.length;
    piers.count = pi;
    strips.count = si;
    for (const m of [bodies, bands, ledges, friezes, signs, piers, strips, windows]) m.instanceMatrix.needsUpdate = true;

    // Coroa acompanha o topo; constelação liga andares do mesmo modo pela esquerda.
    const top = floors.length;
    crown.position.set(0, PLINTH_H + top * FLOOR_H + Math.max(0, top - 1) * explode * GAP + explode * 1.6, 0);
    const pos = constGeo.attributes.position as THREE.BufferAttribute;
    let v = 0;
    const lanes = new Map<string, number>();
    const lastOf = new Map<string, THREE.Vector3>();
    floors.forEach((fl, f) => {
      const slug = fl.lobby.modeSlug;
      if (!lanes.has(slug)) lanes.set(slug, lanes.size);
      const lane = lanes.get(slug)!;
      const w = floorW(fl.lobby.slots);
      const fm = floorMats[f]!;
      const edge = new THREE.Vector3(-w / 2 - 0.15, FLOOR_H * 0.5, 0).applyMatrix4(fm);
      const out = new THREE.Vector3(-w / 2 - 1.1 - lane * 0.45, FLOOR_H * 0.5, 0).applyMatrix4(fm);
      out.x = -floorW(12) / 2 - 1.1 - lane * 0.45;
      pos.setXYZ(v++, edge.x, edge.y, edge.z);
      pos.setXYZ(v++, out.x, out.y, out.z);
      const prev = lastOf.get(slug);
      if (prev) {
        pos.setXYZ(v++, prev.x, prev.y, prev.z);
        pos.setXYZ(v++, out.x, out.y, out.z);
      }
      lastOf.set(slug, out);
    });
    constGeo.setDrawRange(0, v);
    pos.needsUpdate = true;
  }

  function paintFriezes(focus: number) {
    const c = new THREE.Color();
    floors.forEach((fl, f) => {
      c.setHSL(fl.hue / 360, 0.55, 0.5);
      c.multiplyScalar(f === focus ? 3.2 : 0.9);
      friezes.setColorAt(f, c);
    });
    if (friezes.instanceColor) friezes.instanceColor.needsUpdate = true;
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
      const cool = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshBasicMaterial({ color: dawn ? new THREE.Color(1.6, 1.5, 1.5) : new THREE.Color(0.25, 0.35, 0.6) }));
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

  const world: World = {
    scene,
    setFloors(next, now, opening) {
      const structural = next.length !== floors.length || next.some((f, i) => f.lobby.id !== floors[i]?.lobby.id || f.lobby.slots !== floors[i]?.lobby.slots);
      floors = next;
      const lit = writeStates(now, opening || false);
      if (structural || opening) {
        buildPlinth();
        buildCrown();
        lastExplode = -1;
      }
      // Estados que mudam forma (cheio, em partida) também mexem nas matrizes.
      layout(Math.max(0, lastExplode));
      paintFriezes(lastFocus);
      return lit;
    },
    update(f) {
      const t = f.time;
      winMat.uniforms.uTime!.value = t;
      winMatR.uniforms.uTime!.value = t;
      sheetMat.uniforms.uTime!.value = t;
      if (Math.abs(f.explode - lastExplode) > 0.0005) {
        layout(f.explode);
        lastExplode = f.explode;
      }
      constMat.opacity = Math.min(0.85, f.explode * 1.1);
      constellation.visible = f.explode > 0.02;
      if (f.focus !== lastFocus) {
        lastFocus = f.focus;
        winMat.uniforms.uFocus!.value = f.focus;
        paintFriezes(f.focus);
      }
      const beacon = crown.getObjectByName('beacon') as THREE.Mesh | undefined;
      if (beacon) beacon.scale.setScalar(0.55 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.4)));

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
        door.intensity = 9;
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
        // Folhas da Gazeta: o vento da rolagem levanta; parou, assentam no asfalto.
        papers.forEach((p, i) => {
          const w = f.wind;
          const ph = t * (0.9 + i * 0.23) + i * 2.1;
          p.mesh.position.set(
            p.rest.x + w * (Math.sin(ph) * 1.4 + i * 0.4),
            p.rest.y + w * (0.9 + 0.6 * Math.sin(ph * 1.7)),
            p.rest.z + w * Math.cos(ph * 0.8) * 1.1,
          );
          p.mesh.rotation.set(-Math.PI / 2 + w * Math.sin(ph * 2.3) * 0.9, w * Math.cos(ph * 1.9) * 0.6, p.rot + w * ph * 0.3);
        });
      }
      const topNow = crown.position.y;
      lastTop = topNow;
    },
    setDawn(dawn, renderer) {
      setPalette(dawn, renderer);
    },
    floorAnchor(i, out, side = 'left') {
      const fl = floors[i];
      const fm = floorMats[i];
      if (!fl || !fm) return false;
      if (side === 'right') {
        out.set(floorW(fl.lobby.slots) / 2 + 0.25, FLOOR_H * 0.5, floorD(fl.lobby.slots) / 2).applyMatrix4(fm);
        return true;
      }
      out.set(-floorW(fl.lobby.slots) / 2 - 0.2, FLOOR_H * 0.5, floorD(fl.lobby.slots) / 2).applyMatrix4(fm);
      // À esquerda dos fios da constelação (uma faixa por modo).
      out.x = -floorW(12) / 2 - 1.6 - modes.length * 0.45;
      return true;
    },
    showAll() {
      street.visible = reflection.visible = vault.visible = true;
    },
    floorCount: () => floors.length,
    topY: () => lastTop,
    dispose() {
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
