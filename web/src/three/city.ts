import * as THREE from 'three';
import { CLS, mergeKit, type CityPiece, type Kit, type KitMaterial } from './kit';
import { AMB, beamGeometry, createAmbient, createBeamMaterial, createBirds, createPoolMaterial, createRain, createSign } from './life';
import { createConeMaterial } from './shaders';

/**
 * A cidade em volta da Torre (v5 leva 2). Com o kit do Blender (`cidade-kit.glb`), os prédios
 * de fundo, caixas d'água, postes, trilho elevado, bueiros e a torre de cabos viram UMA malha
 * estática (tudo assado numa geometria, uma chamada de desenho); o que se mexe (trem,
 * holofotes) é instanciado. Sem o kit (ou com `?kit=0`), as caixas escuras do v4 continuam.
 *
 * Silhueta primeiro, em camadas: uma fileira perto (atrás do trilho, emoldurando a torre),
 * duas no meio e três longe, cada vez mais altas e mais engolidas pela névoa. Ninguém fica
 * bem atrás da agulha: ali é céu, para os fachos se cruzarem.
 */

export type CityQuality = 'high' | 'mid';

export interface CityFrame {
  /** Relógio ambiente (parado com movimento reduzido). */
  amb: number;
  dt: number;
  heightPx: number;
  /** Onde a tirolesa prende na torre (ou null quando a torre está explodida). */
  zipTo: THREE.Vector3 | null;
  /** Beirada do último andar para os pombos: centro (xyz), meia largura (w), frente. */
  nest: THREE.Vector4;
  nestFront: number;
  dawn: boolean;
}

interface Opts {
  quality: CityQuality;
  still: boolean;
  unitBox: THREE.BufferGeometry;
  boxMat: THREE.Material;
  kitMat: THREE.Material;
  lampMats: { pole: THREE.Material; arm: THREE.Material; bulb: THREE.Material };
  /** Faísca fria (brasas do mundo): o trem risca o trilho. */
  spark(from: THREE.Vector3, vel: THREE.Vector3): void;
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
/** Raio do círculo ritual (o mesmo de world.ts). */
const CIRCLE_R = 10.5;
const TRACK_Z = -17;
const TRACK_S = 1.25;
const LAMP_S = 1.25;
const TRAIN_PERIOD = 34;
const TRAIN_SPEED = 18;
const PYLON = new THREE.Vector3(16.5, 0, 4);
const PYLON_FAR = new THREE.Vector3(44, 27, -16);
const VENTS = [new THREE.Vector3(-11, 0, 15), new THREE.Vector3(6, 0, 21), new THREE.Vector3(-4, 0, 31)];
const SEARCH = [new THREE.Vector3(-28, 0, -36), new THREE.Vector3(33, 0, -38)];
/** Prédio do letreiro (à direita da torre no hero, junto da torre de cabos). */
const SIGN_BLDG = { x: 21, z: -27, type: 1, s: 1.05, ry: -0.1 };

/** Altura do telhado (face virada para cima) que cobre o ponto (x, z) da peça. */
function roofAt(g: THREE.BufferGeometry, x: number, z: number) {
  const p = g.attributes.position!.array as Float32Array;
  const ix = g.index!.array;
  let best = -1;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3;
    const b = ix[t + 1]! * 3;
    const c = ix[t + 2]! * 3;
    const ux = p[b]! - p[a]!;
    const uz = p[b + 2]! - p[a + 2]!;
    const vx = p[c]! - p[a]!;
    const vz = p[c + 2]! - p[a + 2]!;
    const det = ux * vz - uz * vx;
    if (Math.abs(det) < 1e-6) continue;
    // Plano quase horizontal: as três alturas iguais.
    if (Math.abs(p[a + 1]! - p[b + 1]!) > 0.02 || Math.abs(p[a + 1]! - p[c + 1]!) > 0.02) continue;
    const wx = x - p[a]!;
    const wz = z - p[a + 2]!;
    const s = (wx * vz - wz * vx) / det;
    const r = (ux * wz - uz * wx) / det;
    if (s >= 0 && r >= 0 && s + r <= 1) best = Math.max(best, p[a + 1]!);
  }
  return best;
}

interface Bake {
  g: THREE.BufferGeometry;
  m: THREE.Matrix4;
  seed: number;
  tint: number;
}

/** Assa várias peças numa geometria só (posição e normal já no mundo; semente e tom por peça). */
function bake(items: Bake[]) {
  let nv = 0;
  let ni = 0;
  for (const it of items) {
    nv += it.g.attributes.position!.count;
    ni += it.g.index!.count;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const cls = new Float32Array(nv);
  const win = new Float32Array(nv);
  const ins = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let o = 0;
  let oi = 0;
  for (const it of items) {
    const P = it.g.attributes.position!;
    const N = it.g.attributes.normal!;
    const C = it.g.attributes.aCls!.array;
    const W = it.g.attributes.aWin!.array;
    nm.getNormalMatrix(it.m);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(it.m).toArray(pos, (o + i) * 3);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize().toArray(nor, (o + i) * 3);
      cls[o + i] = C[i]!;
      win[o + i] = W[i]!;
      ins[(o + i) * 2] = it.seed;
      ins[(o + i) * 2 + 1] = it.tint;
    }
    const I = it.g.index!.array;
    for (let i = 0; i < I.length; i++) idx[oi + i] = I[i]! + o;
    o += P.count;
    oi += I.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aCls', new THREE.BufferAttribute(cls, 1));
  g.setAttribute('aWin', new THREE.BufferAttribute(win, 1));
  g.setAttribute('aInst', new THREE.BufferAttribute(ins, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Classe do material de cada peça da cidade (pedra clara, lâmpada que corre, lente do holofote…). */
const cityCls = (piece: CityPiece) => (m: KitMaterial) =>
  m === 'stone'
    ? CLS.cityStone
    : m === 'sodium'
      ? piece === 'billboard_frame'
        ? CLS.chase
        : piece === 'searchlight_drum'
          ? CLS.lens
          : CLS.sodium
      : m === 'window_lit' && piece === 'el_car'
        ? CLS.windowWarm
        : m === 'glass'
          ? CLS.glassCold
          : CLS[m];

export function createCity(o: Opts) {
  const high = o.quality === 'high';
  const group = new THREE.Group();
  const refl = new THREE.Group();
  const fallback = new THREE.Group();
  group.add(fallback);
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  /** Telhados de onde saem as brasas (a cidade manda gente para a torre). */
  const roofs: THREE.Vector3[] = [];
  const roofSteam: THREE.Vector3[] = [];

  /* ───────── Sem o kit: as caixas escuras do v4 ───────── */
  {
    const n = high ? 90 : 56;
    const city = new THREE.InstancedMesh(o.unitBox, o.boxMat, n);
    const tanks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), o.boxMat, 24);
    let k = 0;
    let tk = 0;
    for (let i = 0; i < n; i++) {
      const a = hash(i + 3) * Math.PI * 2;
      const r = 46 + hash(i + 11) * 120;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 10;
      if (z > 6 && Math.abs(x) < 26) continue; // deixa a rua livre na frente da câmera
      const w = 6 + hash(i + 5) * 10;
      const d = 6 + hash(i + 7) * 10;
      const h = 8 + hash(i + 9) * (r > 80 ? 46 : 26);
      tmpQ.setFromAxisAngle(Y, hash(i + 1) * 0.6);
      city.setMatrixAt(k++, tmpM.compose(tmpV.set(x, h / 2, z), tmpQ, tmpS.set(w, h, d)));
      if (r < 95) roofs.push(new THREE.Vector3(x, h + 0.5, z));
      if (tk < 24 && hash(i + 13) > 0.55) {
        tanks.setMatrixAt(tk++, tmpM.compose(tmpV.set(x + (hash(i) - 0.5) * w * 0.5, h + 1.4, z), tmpQ, tmpS.set(1, 1, 1)));
        if (roofSteam.length < 3 && r < 90) roofSteam.push(new THREE.Vector3(x, h + 0.2, z));
      }
    }
    city.count = k;
    tanks.count = tk;
    fallback.add(city, tanks);
  }

  /* ───────── Postes de luz de sódio ─────────
   * v5: nenhum cruza a fachada no hero (o da direita saiu da frente da torre e foi para a
   * esquina da praça). As luzes pontuais (world.ts) e as poças seguem `lights`. */
  const spots = high
    ? [new THREE.Vector3(-9.5, 0, 13.5), new THREE.Vector3(14.2, 0, 8.5), new THREE.Vector3(-17, 0, 27)]
    : [new THREE.Vector3(-9.5, 0, 13.5), new THREE.Vector3(14.2, 0, 8.5)];
  const lights = spots.map((p) => new THREE.Vector3(p.x + 0.8, 5.18, p.z));
  const bulbGeo = new THREE.SphereGeometry(0.16, 12, 8);
  {
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8);
    for (const p of spots) {
      const g = new THREE.Group();
      g.position.copy(p);
      const pole = new THREE.Mesh(poleGeo, o.lampMats.pole);
      pole.position.y = 2.7;
      const arm = new THREE.Mesh(o.unitBox, o.lampMats.arm);
      arm.scale.set(0.9, 0.06, 0.06);
      arm.position.set(0.4, 5.35, 0);
      const head = new THREE.Mesh(o.unitBox, o.lampMats.arm);
      head.scale.set(0.55, 0.16, 0.36);
      head.position.set(0.8, 5.32, 0);
      const bulb = new THREE.Mesh(bulbGeo, o.lampMats.bulb);
      bulb.position.set(0.8, 5.18, 0);
      bulb.scale.set(1.3, 0.55, 1);
      g.add(pole, arm, head, bulb);
      fallback.add(g);
    }
  }
  const coneGeo = new THREE.ConeGeometry(2.3, 5.1, 24, 1, true);
  coneGeo.translate(0, -2.55, 0);
  const cones = new THREE.InstancedMesh(coneGeo, createConeMaterial(new THREE.Color(1.0, 0.62, 0.26), high ? 0.22 : 0.18), spots.length);
  cones.frustumCulled = false;
  // Reflexo no asfalto: o bulbo espelhado e esticado.
  const reflBulbs = new THREE.InstancedMesh(bulbGeo, o.lampMats.bulb, spots.length);
  reflBulbs.frustumCulled = false;
  refl.add(reflBulbs);
  // Poças de luz de sódio no asfalto molhado (uma por poste e uma na porta da torre).
  const poolMat = createPoolMaterial();
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, spots.length + 1);
  pools.frustumCulled = false;
  pools.renderOrder = 3;
  group.add(cones, pools);
  const door = new THREE.Vector3(0, 0, 4);
  function placeLamps() {
    lights.forEach((l, i) => {
      // O cone desce da lanterna até o chão.
      cones.setMatrixAt(i, tmpM.compose(l, tmpQ.identity(), tmpS.set(l.y / 5.18, l.y / 5.1, l.y / 5.18)));
      reflBulbs.setMatrixAt(i, tmpM.compose(l, tmpQ.identity(), tmpS.set(0.7, 2.6, 0.7)));
      pools.setMatrixAt(i, tmpM.compose(tmpV.set(l.x, 0.16, l.z), tmpQ.identity(), tmpS.set(11, 1, 11)));
    });
    pools.setMatrixAt(spots.length, tmpM.compose(tmpV.set(door.x, 0.16, door.z + 2), tmpQ.identity(), tmpS.set(9, 1, 7)));
    for (const m of [cones, reflBulbs, pools]) m.instanceMatrix.needsUpdate = true;
  }
  placeLamps();

  /* ───────── Holofotes de estreia (os fachos existem mesmo sem o kit) ───────── */
  const beamMat = createBeamMaterial();
  const beams = new THREE.InstancedMesh(beamGeometry(170), beamMat, SEARCH.length);
  beams.frustumCulled = false;
  beams.renderOrder = 4;
  group.add(beams);
  let searchBase: THREE.InstancedMesh | null = null;
  let searchDrum: THREE.InstancedMesh | null = null;
  let drumAt = new THREE.Vector3(0, 1.55, 0);
  let beamAt = new THREE.Vector3(0, 0.56, 0);
  const SEARCH_S = 1.6;

  /* ───────── Partículas: vapor, brasas da praça, fumaça da base, lanterna ───────── */
  let ambient: ReturnType<typeof createAmbient> | null = null;
  function buildAmbient(ventTops: THREE.Vector3[]) {
    if (ambient) {
      group.remove(ambient.points);
      ambient.points.geometry.dispose();
      ambient.mat.dispose();
    }
    const list: { p: THREE.Vector3; kind: number }[] = [];
    const k = high ? 1 : 0.45;
    for (const v of ventTops) for (let i = 0; i < 34 * k; i++) list.push({ p: v, kind: AMB.steam });
    for (const v of roofSteam) for (let i = 0; i < 26 * k; i++) list.push({ p: v, kind: AMB.steam });
    for (let i = 0; i < 160 * k; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * CIRCLE_R * 0.95;
      list.push({ p: new THREE.Vector3(Math.cos(a) * r, 0.2, Math.sin(a) * r), kind: AMB.ember });
    }
    for (let i = 0; i < 70 * k; i++) {
      const a = Math.random() * Math.PI * 2;
      list.push({ p: new THREE.Vector3(Math.cos(a) * 5.5, 0.25, Math.sin(a) * 4.5), kind: AMB.smoke });
    }
    list.push({ p: new THREE.Vector3(), kind: AMB.lantern });
    ambient = createAmbient(list);
    group.add(ambient.points);
  }
  buildAmbient(VENTS.map((v) => v.clone().setY(0.15)));

  /* ───────── Chuva (só no alto) e pombos ───────── */
  const rain = high && !o.still ? createRain(1700) : null;
  if (rain) group.add(rain.mesh);
  const birds = createBirds(high ? 16 : 10);
  birds.points.visible = !o.still;
  group.add(birds.points);

  /* ───────── Letreiro e tirolesa (com o kit) ───────── */
  const sign = createSign();
  let signText: [string, string][] = [];
  let cable: THREE.LineSegments | null = null;
  let anchorTop: THREE.Vector3 | null = null;
  let cars: THREE.InstancedMesh | null = null;
  let carLen = 4.8;
  let railY = 7.5;
  const CARS = 4;

  function applyKit(k: Kit<CityPiece>) {
    const geo = new Map<CityPiece, THREE.BufferGeometry>();
    const G = (p: CityPiece) => {
      if (!geo.has(p) && k.parts.has(p)) geo.set(p, mergeKit(k.parts.get(p)!, cityCls(p)));
      return geo.get(p);
    };
    const items: Bake[] = [];
    const put = (p: CityPiece, x: number, y: number, z: number, ry: number, s: number, seed = Math.random(), tint = 0) => {
      const g = G(p);
      if (!g) return null;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, ry), new THREE.Vector3(s, s, s));
      items.push({ g, m, seed, tint });
      return m;
    };
    const types = ['bldg_A', 'bldg_B', 'bldg_C', 'bldg_D', 'bldg_E'] as const;
    if (!types.some((t) => k.parts.has(t))) return;
    roofs.length = 0;
    roofSteam.length = 0;

    // Fileiras: perto (atrás do trilho), meio e longe, cada vez mais altas e na névoa.
    const rows = (high
      ? [[-27, 1, 12.5], [-46, 1.1, 13], [-66, 1.25, 14], [-88, 1.4, 15], [-108, 1.6, 17]]
      : [[-27, 1, 14], [-52, 1.15, 16], [-86, 1.4, 19]]) as [number, number, number][];
    const slots: { x: number; z: number; s: number; type: number; ry: number }[] = [];
    rows.forEach(([z, s, step], r) => {
      for (let x = -115 + hash(r * 7) * step; x < 110; x += step * s * (0.85 + hash(x * 0.13 + r) * 0.3)) {
        // Atrás da agulha fica céu (os fachos se cruzam ali).
        if (Math.abs(x) < 14 + (z > -70 ? 2 : 0) && z > -100) continue;
        if (Math.hypot(x - SIGN_BLDG.x, z - SIGN_BLDG.z) < 11) continue;
        const h = hash(x * 1.7 + z * 0.31);
        // Perto: mais prédios baixos (cortiço, mansarda); longe: as torres altas.
        const type = r < 2 ? [1, 2, 0, 1, 3, 4][Math.floor(h * 6)]! : [0, 3, 4, 2, 4][Math.floor(h * 5)]!;
        // Frente para a câmera, com só um pouco de giro (a silhueta não pode virar de lado).
        const ry = THREE.MathUtils.clamp(Math.atan2(-x, 66 - z) * 0.25, -0.12, 0.12) + (hash(x + z) - 0.5) * 0.08;
        slots.push({ x, z: z + (hash(x * 3.1) - 0.5) * 5, s: s * (0.9 + hash(x * 0.7) * 0.2), type, ry });
      }
    });
    // Laterais da praça (emolduram o hero no desktop, à esquerda do título).
    for (const z of high ? [-8, 8] : []) {
      for (const side of [-1, 1]) {
        for (let x = 44 + (z > 0 ? 8 : 0); x < 80; x += 14) slots.push({ x: side * (x + hash(x + z) * 4), z, s: 0.95, type: [1, 2, 0][Math.floor(hash(x * z) * 3)]!, ry: side * 0.08 });
      }
    }
    slots.push(SIGN_BLDG);
    let signM: THREE.Matrix4 | null = null;
    slots.forEach((b, i) => {
      const t = types[b.type]!;
      const m = put(t, b.x, 0, b.z, b.ry, b.s, hash(i * 1.37), (hash(i * 2.9) - 0.5) * 0.4);
      const g = G(t);
      if (!m || !g) return;
      const size = k.size.get(t)!;
      if (b.z > -90) roofs.push(new THREE.Vector3(b.x, size.y * b.s, b.z));
      // Caixa d'água num telhado (de preferência num recuo mais baixo).
      if (b !== SIGN_BLDG && hash(i * 5.3) < 0.5) {
        for (const [ox, oz] of [[2.6, -1.6], [-2.6, -1.8], [0, -2.2]] as const) {
          const y = roofAt(g, ox, oz);
          if (y < 4 || y > size.y - 0.5) continue;
          tmpV.set(ox, y, oz).applyMatrix4(m);
          put('water_tank', tmpV.x, tmpV.y, tmpV.z, hash(i) * 3, b.s * 0.95);
          if (roofSteam.length < 4 && b.z > -50 && b.z < -20) roofSteam.push(tmpV.clone().setY(tmpV.y + 4.4 * b.s));
          break;
        }
      }
      if (b === SIGN_BLDG) signM = m;
    });

    // Trilho elevado atrás da torre, de ponta a ponta.
    const track = k.size.get('el_track');
    if (track) {
      const along = track.x >= track.z ? 0 : Math.PI / 2;
      const len = Math.max(track.x, track.z) * TRACK_S;
      for (let x = -130; x < 130; x += len) put('el_track', x, 0, TRACK_Z, along, TRACK_S, 0.5);
      railY = 6 * TRACK_S;
    }
    // Postes do kit (a lanterna mora no encaixe lamp_light).
    const lampLight = k.anchors.get('lamp_light');
    if (k.parts.has('lamp_post') && lampLight) {
      spots.forEach((p, i) => {
        put('lamp_post', p.x, 0, p.z, 0, LAMP_S);
        lights[i]!.set(p.x + lampLight.x * LAMP_S, lampLight.y * LAMP_S, p.z + lampLight.z * LAMP_S);
      });
      fallback.children.filter((c) => c instanceof THREE.Group).forEach((c) => (c.visible = false));
      placeLamps();
    }
    // Bueiros de vapor.
    const steamO = k.anchors.get('steam_origin') ?? new THREE.Vector3(0, 1, 0);
    for (const v of VENTS) put('steam_vent', v.x, 0, v.z, hash(v.x) * 3, 1.2);
    // Torre de cabos (o cabo corre no Z local; aqui ele vai da rua até a torre, em X).
    const ca = k.anchors.get('cable_anchor');
    if (k.parts.has('cable_pylon') && ca) {
      put('cable_pylon', PYLON.x, 0, PYLON.z, Math.PI / 2, 1.15);
      anchorTop = new THREE.Vector3(PYLON.x + ca.z * 1.15, ca.y * 1.15, PYLON.z - ca.x * 1.15);
      cable = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#3a3430' }));
      cable.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 2 * 3), 3));
      cable.frustumCulled = false;
      group.add(cable);
    }

    const city = new THREE.Mesh(bake(items), o.kitMat);
    city.frustumCulled = false;
    group.add(city);
    fallback.children.filter((c) => c instanceof THREE.InstancedMesh).forEach((c) => (c.visible = false));

    // Letreiro no telhado do prédio à direita da torre (moldura própria: as lâmpadas correm no local).
    const bf = G('billboard_frame');
    if (bf && signM) {
      const roof = roofAt(G(types[SIGN_BLDG.type]!)!, 0, 1.5);
      const frame = new THREE.Mesh(bf, o.kitMat);
      new THREE.Matrix4().compose(new THREE.Vector3(0, roof > 0 ? roof : 14, 1.2), new THREE.Quaternion(), new THREE.Vector3(1.25, 1.25, 1.25)).premultiply(signM).decompose(frame.position, frame.quaternion, frame.scale);
      const ta = k.anchors.get('text_anchor') ?? new THREE.Vector3(0, 2.75, 0.02);
      const text = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 2.4), sign.mat);
      text.position.set(ta.x, ta.y, ta.z + 0.015);
      frame.add(text);
      group.add(frame);
    }

    // Holofotes: base gira (pan), tambor inclina (tilt); o facho sai do encaixe beam_origin.
    if (G('searchlight') && G('searchlight_drum')) {
      searchBase = new THREE.InstancedMesh(G('searchlight')!, o.kitMat, SEARCH.length);
      searchDrum = new THREE.InstancedMesh(G('searchlight_drum')!, o.kitMat, SEARCH.length);
      for (const m of [searchBase, searchDrum]) {
        m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        group.add(m);
      }
      drumAt = new THREE.Vector3().setFromMatrixPosition(k.local.get('searchlight_drum') ?? new THREE.Matrix4().makeTranslation(0, 1.55, 0));
      beamAt = k.anchors.get('beam_origin') ?? beamAt;
    }

    // Trem elevado: quatro vagões correndo no trilho, em loop.
    const car = G('el_car');
    if (car && track) {
      const cs = k.size.get('el_car')!;
      carLen = Math.max(cs.x, cs.z) * TRACK_S;
      cars = new THREE.InstancedMesh(car, o.kitMat, CARS);
      cars.userData.along = cs.x >= cs.z ? 0 : Math.PI / 2;
      cars.frustumCulled = false;
      cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(cars);
    }
    buildAmbient([...VENTS.map((v) => v.clone().addScaledVector(steamO, 1.2))]);
  }

  /* ───────── Quadro a quadro ───────── */
  const nextSpark = { t: 0 };
  const dir = new THREE.Vector3();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();

  function update(f: CityFrame) {
    const t = f.amb;
    for (const m of [beamMat, poolMat, birds.mat, ambient!.mat, sign.mat, rain?.mat]) if (m) m.uniforms.uTime!.value = t;
    poolMat.uniforms.uRain!.value = rain ? 1 : 0;
    poolMat.uniforms.uI!.value = f.dawn ? 0.25 : 0.55;
    // Sem o passe de composição (médio) o cruzamento estoura: facho mais fraco.
    beamMat.uniforms.uI!.value = (f.dawn ? 0.18 : 0.5) * (high ? 1 : 0.55);
    ambient!.mat.uniforms.uPx!.value = f.heightPx * 0.9;
    ambient!.mat.uniforms.uDawn!.value = f.dawn ? 1 : 0;
    birds.mat.uniforms.uPx!.value = f.heightPx * 0.9;
    (birds.mat.uniforms.uNest!.value as THREE.Vector4).copy(f.nest);
    birds.mat.uniforms.uEdge!.value = f.nestFront;
    // Pombo é cinza: à noite um cinza claro contra o céu escuro, no amanhecer a silhueta escura.
    (birds.mat.uniforms.uColor!.value as THREE.Color).setRGB(...((f.dawn ? [0.03, 0.03, 0.04] : [0.2, 0.19, 0.21]) as [number, number, number]));
    if (rain) rain.mesh.visible = !f.dawn;

    // Holofotes: dois alvos que varrem o céu em fase oposta e se cruzam acima da agulha.
    SEARCH.forEach((p, i) => {
      const ph = t * 0.16 + i * Math.PI;
      tmpA.set(Math.sin(ph) * 30, 39 + Math.sin(t * 0.11 + i * 2) * 4, -10 + Math.cos(ph) * 8);
      const origin = tmpB.copy(p).addScaledVector(drumAt, SEARCH_S);
      dir.copy(tmpA).sub(origin).normalize();
      const pan = Math.atan2(dir.x, dir.z);
      const tilt = Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1));
      qa.setFromAxisAngle(Y, pan);
      qb.setFromAxisAngle(X, tilt);
      const q = tmpQ.copy(qa).multiply(qb);
      if (searchBase && searchDrum) {
        searchBase.setMatrixAt(i, tmpM.compose(p, qa, tmpS.setScalar(SEARCH_S)));
        searchDrum.setMatrixAt(i, tmpM.compose(origin, q, tmpS.setScalar(SEARCH_S)));
      }
      // Saída do facho: a boca do tambor.
      tmpV.copy(beamAt).multiplyScalar(SEARCH_S).applyQuaternion(q).add(origin);
      beams.setMatrixAt(i, tmpM.compose(tmpV, q, tmpS.setScalar(1)));
    });
    beams.instanceMatrix.needsUpdate = true;
    if (searchBase && searchDrum) {
      searchBase.instanceMatrix.needsUpdate = true;
      searchDrum.instanceMatrix.needsUpdate = true;
    }

    // Trem: passa da esquerda para a direita a cada TRAIN_PERIOD s; a roda risca faísca fria.
    if (cars) {
      const head = -135 + ((t + 23.6) % TRAIN_PERIOD) * TRAIN_SPEED;
      tmpQ.setFromAxisAngle(Y, cars.userData.along as number);
      for (let i = 0; i < CARS; i++) cars.setMatrixAt(i, tmpM.compose(tmpV.set(head - i * (carLen + 0.35), railY, TRACK_Z), tmpQ, tmpS.setScalar(TRACK_S)));
      cars.instanceMatrix.needsUpdate = true;
      if (high && !o.still && Math.abs(head) < 90 && t > nextSpark.t) {
        nextSpark.t = t + 0.25 + Math.random() * 0.5;
        o.spark(tmpA.set(head - Math.random() * CARS * carLen, railY + 0.05, TRACK_Z + 0.5), tmpB.set(-3 - Math.random() * 3, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 2));
      }
    }

    // Tirolesa: cabo com barriga da rua à torre; a lanterna corre do prédio vizinho até a torre.
    const lan = ambient!.mat.uniforms.uLantern!.value as THREE.Vector4;
    lan.w = 0;
    if (cable && anchorTop) {
      cable.visible = !!f.zipTo;
      if (f.zipTo) {
        const pos = cable.geometry.attributes.position as THREE.BufferAttribute;
        const pt = (a: THREE.Vector3, b: THREE.Vector3, s: number, out: THREE.Vector3) => out.lerpVectors(a, b, s).setY(out.y - a.distanceTo(b) * 0.045 * 4 * s * (1 - s));
        let v = 0;
        for (const [a, b] of [[PYLON_FAR, anchorTop], [anchorTop, f.zipTo]] as const) {
          for (let i = 0; i < 24; i++) {
            pt(a, b, i / 24, tmpA);
            pt(a, b, (i + 1) / 24, tmpB);
            pos.setXYZ(v++, tmpA.x, tmpA.y, tmpA.z);
            pos.setXYZ(v++, tmpB.x, tmpB.y, tmpB.z);
          }
        }
        pos.needsUpdate = true;
        const u = (t % 13) / 9;
        if (u < 1) {
          const s = u * 2;
          pt(s < 1 ? PYLON_FAR : anchorTop, s < 1 ? anchorTop : f.zipTo, s < 1 ? s : s - 1, tmpA);
          lan.set(tmpA.x, tmpA.y - 0.35, tmpA.z, Math.min(1, u * 12, (1 - u) * 12));
        }
      }
    }
  }

  return {
    group,
    refl,
    roofs,
    lights,
    applyKit,
    update,
    /** Porta da torre: a poça quente do saguão. */
    setDoor(p: THREE.Vector3) {
      door.copy(p);
      placeLamps();
    },
    /** Texto do letreiro: [linha grande, linha pequena] de cada aviso. */
    setSign(a: [string, string], b: [string, string]) {
      const next: [string, string][] = [a, b];
      if (JSON.stringify(next) === JSON.stringify(signText)) return;
      signText = next;
      sign.draw(next);
    },
    /** Um lobby lotou: os pombos levantam da coroa. */
    takeoff(t: number) {
      birds.mat.uniforms.uFly!.value = t;
    },
    dispose() {
      sign.tex.dispose();
    },
  };
}

export type City = ReturnType<typeof createCity>;
