import * as THREE from 'three';

/**
 * Kits feitos no Blender (contrato: docs/design/contrato-kit-torre.md).
 *
 * Melhoria progressiva: a torre e a cidade procedurais são o caminho padrão e testado. Se
 * `public/models/torre-kit.glb` ou `cidade-kit.glb` existirem e forem glTF válidos, as peças
 * substituem a geometria procedural (ver `applyKit` em world.ts e `city.ts`).
 *
 *  - Existência: `__TORRE_KIT__` e `__CIDADE_KIT__` vêm do vite.config.ts (o arquivo existia
 *    quando o servidor ou o build começou). Sem o arquivo, nenhuma requisição e nenhum 404.
 *  - O GLTFLoader vem num chunk próprio, baixado só se algum kit existir: o chunk 3D não cresce.
 *  - `?kit=0` na URL força a versão procedural das duas (para comparar).
 *  - Texturas e materiais do arquivo são ignorados: cada peça fica só com posição e normal, e o
 *    material é escolhido pelo NOME do material no Blender (sufixos .001 caem).
 *  - v5 leva 2: cada peça vira UMA geometria (`mergeKit`), com a classe do material por vértice
 *    (`aCls`), desenhada pelo material único do kit (illus.ts). Menos chamadas de desenho.
 */

export const KIT_PIECES = [
  'floor_A',
  'floor_B',
  'floor_C',
  'floor_cap_L',
  'floor_cap_R',
  'setback_ledge',
  'base',
  'crown',
  'spire',
  'ornament_gargoyle',
  'ornament_sunburst',
  'ornament_pilaster',
] as const;

export const CITY_PIECES = [
  'bldg_A',
  'bldg_B',
  'bldg_C',
  'bldg_D',
  'bldg_E',
  'water_tank',
  'lamp_post',
  'el_track',
  'el_car',
  'searchlight',
  'searchlight_drum',
  'steam_vent',
  'billboard_frame',
  'cable_pylon',
] as const;

/** Pontos de encaixe (objetos vazios do Blender), no espaço da peça-mãe. */
const ANCHORS = ['lamp_light', 'beam_origin', 'steam_origin', 'text_anchor', 'cable_anchor'] as const;

export type KitPiece = (typeof KIT_PIECES)[number];
export type CityPiece = (typeof CITY_PIECES)[number];
export type KitMaterial = (typeof MATERIALS)[number];

/**
 * Classe de material por vértice (`aCls`), lida pela tabela do material do kit em illus.ts.
 * A ordem é contrato com `KIT_TABLE`.
 */
export const CLS = {
  obsidian: 0,
  obsidian_matte: 1,
  brass: 2,
  brass_dark: 3,
  verdigris: 4,
  stone: 5,
  glassWarm: 6,
  glassCold: 7,
  steel: 8,
  window_lit: 9,
  window_dark: 10,
  sodium: 11,
  cityStone: 12,
  chase: 13,
  windowWarm: 14,
  lens: 15,
} as const;

export interface KitPart {
  /** Geometria já no espaço da peça (origem no centro da base, Y para cima). */
  geometry: THREE.BufferGeometry;
  material: KitMaterial;
}

export interface Kit<P extends string = KitPiece> {
  parts: Map<P, KitPart[]>;
  /** Caixa de cada peça (para escalar coroa e pedestal à largura do dado). */
  size: Map<P, THREE.Vector3>;
  /** Encaixes (lamp_light, beam_origin…) no espaço da peça em que moram. */
  anchors: Map<string, THREE.Vector3>;
  /** Posição e rotação da peça filha em relação à mãe (o tambor do holofote). */
  local: Map<P, THREE.Matrix4>;
}

const MATERIALS = ['obsidian', 'obsidian_matte', 'brass', 'brass_dark', 'verdigris', 'stone', 'glass', 'window_lit', 'window_dark', 'sodium', 'steel'] as const;

function materialName(m: THREE.Material | undefined): KitMaterial {
  const base = (m?.name ?? '').replace(/\.\d+$/, '').toLowerCase() as KitMaterial;
  return MATERIALS.includes(base) ? base : 'obsidian';
}

const noKit = () => new URLSearchParams(window.location.search).get('kit') === '0';

async function loadGlb<P extends string>(file: string, pieces: readonly P[]): Promise<Kit<P> | null> {
  try {
    if (noKit()) return null;
    const res = await fetch(`${import.meta.env.BASE_URL}models/${file}`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Um servidor de SPA devolve index.html (200) para arquivo ausente: confere a assinatura.
    if (buf.byteLength < 20 || new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== 'glTF') return null;
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    gltf.scene.updateMatrixWorld(true);

    const kit: Kit<P> = { parts: new Map(), size: new Map(), anchors: new Map(), local: new Map() };
    const toPiece = new THREE.Matrix4();
    const names = new Set<string>(pieces);
    for (const name of pieces) {
      const root = gltf.scene.getObjectByName(name);
      if (!root) continue;
      toPiece.copy(root.matrixWorld).invert();
      if (root.parent && names.has(root.parent.name)) kit.local.set(name, root.matrix.clone());
      const parts: KitPart[] = [];
      const box = new THREE.Box3();
      const visit = (o: THREE.Object3D) => {
        // Peça filha listada (o tambor dentro do holofote) é peça própria.
        if (o !== root && names.has(o.name)) return;
        if ((ANCHORS as readonly string[]).includes(o.name)) kit.anchors.set(o.name, new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(toPiece));
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          // O GLTFLoader separa cada material do Blender numa malha filha (uma primitiva cada).
          const g = mesh.geometry.clone();
          g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toPiece, mesh.matrixWorld));
          for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
          if (!g.attributes.normal) g.computeVertexNormals();
          g.computeBoundingBox();
          box.union(g.boundingBox!);
          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          parts.push({ geometry: g, material: materialName(mat) });
        }
        o.children.forEach(visit);
      };
      visit(root);
      if (!parts.length) continue;
      kit.parts.set(name, parts);
      kit.size.set(name, box.getSize(new THREE.Vector3()));
    }
    gltf.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    return kit.parts.size ? kit : null;
  } catch (err) {
    if (import.meta.env.DEV) console.warn(`[torre] ${file} ignorado, seguindo com a versão procedural:`, err);
    return null;
  }
}

export function loadKit(): Promise<Kit | null> {
  // Build: a constante diz se o arquivo existe (sem arquivo, nenhuma requisição). Servidor de dev
  // aberto antes desta configuração não tem a constante: tenta (arquivo ausente = index.html,
  // recusado pela assinatura, sem 404 no console).
  if (typeof __TORRE_KIT__ !== 'undefined' && !__TORRE_KIT__) return Promise.resolve(null);
  return loadGlb('torre-kit.glb', KIT_PIECES);
}

export function loadCityKit(): Promise<Kit<CityPiece> | null> {
  if (typeof __CIDADE_KIT__ !== 'undefined' && !__CIDADE_KIT__) return Promise.resolve(null);
  return loadGlb('cidade-kit.glb', CITY_PIECES);
}

const fract = (x: number) => x - Math.floor(x);

/**
 * Junta as partes de uma peça numa geometria só, com a classe do material por vértice
 * (`aCls`) e, nas janelas, uma semente por vidraça (`aWin`: cada quadrado de vidro
 * acende e pisca sozinho). `cls` decide a classe de cada material (vidro quente ou frio…).
 */
export function mergeKit(parts: KitPart[], cls: (m: KitMaterial) => number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const cl: number[] = [];
  const win: number[] = [];
  const idx: number[] = [];
  for (const p of parts) {
    const g = p.geometry;
    const P = g.attributes.position!;
    const N = g.attributes.normal!;
    const c = cls(p.material);
    // As primitivas do glTF dividem o buffer de vértices da malha inteira: só entram os
    // vértices que os triângulos desta parte usam (sem isso, ~7× mais vértices).
    const src = g.index ? Array.from(g.index.array) : Array.from({ length: P.count }, (_, i) => i);
    const map = new Map<number, number>();
    const used: number[] = [];
    const ix = src.map((i) => {
      let j = map.get(i);
      if (j === undefined) {
        j = used.length;
        map.set(i, j);
        used.push(i);
      }
      return j;
    });
    const n = used.length;
    // Vidraças: vértices ligados por triângulos formam um vidro (união e busca).
    const root = Array.from({ length: n }, (_, i) => i);
    const find = (a: number): number => (root[a] === a ? a : (root[a] = find(root[a]!)));
    if (p.material === 'window_lit' || p.material === 'window_dark') {
      for (let t = 0; t < ix.length; t += 3) {
        const a = find(ix[t]!);
        root[find(ix[t + 1]!)] = a;
        root[find(ix[t + 2]!)] = a;
      }
    }
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const v = used[i]!;
      const r = used[find(i)]!;
      pos.push(P.getX(v), P.getY(v), P.getZ(v));
      nor.push(N.getX(v), N.getY(v), N.getZ(v));
      cl.push(c);
      win.push(fract(Math.sin(P.getX(r) * 12.9898 + P.getY(r) * 78.233 + P.getZ(r) * 37.719) * 43758.5453));
    }
    for (const i of ix) idx.push(base + i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('aCls', new THREE.Float32BufferAttribute(cl, 1));
  out.setAttribute('aWin', new THREE.Float32BufferAttribute(win, 1));
  out.setIndex(idx);
  out.computeBoundingBox();
  return out;
}
