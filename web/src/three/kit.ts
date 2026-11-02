import * as THREE from 'three';

/**
 * Kit da Torre feito no Blender (contrato: docs/design/contrato-kit-torre.md).
 *
 * Melhoria progressiva: a torre procedural é o caminho padrão e testado. Se
 * `public/models/torre-kit.glb` existir e for um glTF válido, as peças do kit substituem
 * fachada, remates, cornija de recuo, pedestal, coroa e agulha (ver `applyKit` em world.ts).
 *
 *  - Existência: `__TORRE_KIT__` vem do vite.config.ts (o arquivo existia quando o
 *    servidor ou o build começou). Sem o arquivo, nenhuma requisição e nenhum 404 no console.
 *  - O GLTFLoader vem num chunk próprio, baixado só se o kit existir: o chunk 3D não cresce.
 *  - `?kit=0` na URL força a torre procedural (para comparar as duas).
 *  - Texturas e materiais do arquivo são ignorados: cada peça fica só com posição e normal,
 *    e o material é escolhido pelo NOME do material no Blender (sufixos .001 caem).
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

export type KitPiece = (typeof KIT_PIECES)[number];
export type KitMaterial = 'obsidian' | 'obsidian_matte' | 'brass' | 'brass_dark' | 'verdigris' | 'stone' | 'glass';

export interface KitPart {
  /** Geometria já no espaço da peça (origem no centro da base, Y para cima). */
  geometry: THREE.BufferGeometry;
  material: KitMaterial;
}

export interface Kit {
  parts: Map<KitPiece, KitPart[]>;
  /** Caixa de cada peça (para escalar coroa e pedestal à largura do dado). */
  size: Map<KitPiece, THREE.Vector3>;
}

const MATERIALS: KitMaterial[] = ['obsidian', 'obsidian_matte', 'brass', 'brass_dark', 'verdigris', 'stone', 'glass'];

function materialName(m: THREE.Material | undefined): KitMaterial {
  const base = (m?.name ?? '').replace(/\.\d+$/, '').toLowerCase() as KitMaterial;
  return MATERIALS.includes(base) ? base : 'obsidian';
}

export async function loadKit(): Promise<Kit | null> {
  // Build: a constante diz se o arquivo existe (sem arquivo, nenhuma requisição). Servidor de dev
  // aberto antes desta configuração não tem a constante: tenta (arquivo ausente = index.html,
  // recusado pela assinatura abaixo, sem 404 no console).
  if (typeof __TORRE_KIT__ !== 'undefined' && !__TORRE_KIT__) return null;
  try {
    if (new URLSearchParams(window.location.search).get('kit') === '0') return null;
    const res = await fetch(`${import.meta.env.BASE_URL}models/torre-kit.glb`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Um servidor de SPA devolve index.html (200) para arquivo ausente: confere a assinatura.
    if (buf.byteLength < 20 || new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== 'glTF') return null;
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    gltf.scene.updateMatrixWorld(true);

    const kit: Kit = { parts: new Map(), size: new Map() };
    const toPiece = new THREE.Matrix4();
    for (const name of KIT_PIECES) {
      const root = gltf.scene.getObjectByName(name);
      if (!root) continue;
      toPiece.copy(root.matrixWorld).invert();
      const parts: KitPart[] = [];
      const box = new THREE.Box3();
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // O GLTFLoader separa cada material do Blender numa malha filha (uma primitiva cada).
        const g = mesh.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toPiece, mesh.matrixWorld));
        for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        if (!g.attributes.normal) g.computeVertexNormals();
        g.computeBoundingBox();
        box.union(g.boundingBox!);
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        parts.push({ geometry: g, material: materialName(mat) });
      });
      if (!parts.length) continue;
      kit.parts.set(name, parts);
      kit.size.set(name, box.getSize(new THREE.Vector3()));
    }
    gltf.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    return kit.parts.size ? kit : null;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[torre] kit glTF ignorado, seguindo com a torre procedural:', err);
    return null;
  }
}
