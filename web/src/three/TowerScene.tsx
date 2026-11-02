import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BRAND_NAME } from '../config/brand';
import { modes } from '../data/modes';
import { ramp } from '../lib/obra';
import { play } from '../lib/sound';
import { floorLabels, floorMarks, sceneCoord, towerBus } from '../lib/towerBus';
import type { TowerFloor } from '../lib/towerData';
import { createPostMaterial } from './shaders';
import { createWorld, type Quality, type World } from './world';

/**
 * Chunk 3D da home (carregado só depois da primeira pintura). R3F cuida do canvas,
 * do tamanho e do laço; a cena em si é montada por `createWorld` e desenhada por
 * nós (useFrame com prioridade 1), com ou sem o passe de composição.
 *
 * Regras: nada de setState no laço; a câmera persegue a rolagem nativa com
 * amortecimento; o HTML é a verdade e a cena só ilustra.
 */

interface Props {
  quality: Quality;
  floors: TowerFloor[];
  dawn: boolean;
  /** Remontagem por rebaixamento de nível: pula a abertura. */
  skipIntro?: boolean;
}

interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  explode: number;
  vaultRot: number;
  needle: number;
  doors: number;
  plateLight: number;
  /**
   * Deslocamento de lente (fração da meia tela, como uma câmera de báscula): põe o
   * assunto ao lado ou acima do texto sem inclinar a câmera, então as verticais do
   * prédio continuam retas. +x empurra a cena para a direita, +y para cima.
   */
  shiftX: number;
  shiftY: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Anda em degraus: segura em cada inteiro e passa rápido entre eles (paradas do elevador, cartas). */
const stepped = (x: number) => Math.floor(x) + sstep(0.28, 0.72, x - Math.floor(x));

const tmpA = V(0, 0, 0);
const tmpB = V(0, 0, 0);
const tmpEst = V(0, 0, 0);
const tmpLook = V(0, 0, 0);

/** Pose da câmera e dos parâmetros da cena em cada cena do roteiro (0 = torre … 5 = rua). */
function pose(scene: number, local: number, wide: number, out: Pose): Pose {
  const L = (a: THREE.Vector3, b: THREE.Vector3) => tmpA.copy(a).lerp(b, local);
  const P = (a: THREE.Vector3, b: THREE.Vector3) => tmpB.copy(a).lerp(b, local);
  out.explode = 0;
  out.vaultRot = 0;
  out.needle = 0;
  out.doors = 0;
  out.plateLight = 0.5;
  out.shiftX = 0;
  out.shiftY = 0;
  let fovL = 38;
  let fovP = 52;
  switch (scene) {
    case 0:
      // v5, câmera heroica: contra-plongée baixa (a câmera quase no asfalto), a torre inteira
      // ocupando ~65% da altura, à direita do título no desktop e no meio no celular.
      fovP = 50;
      out.pos.copy(P(V(0, 0.9, 62), V(0, 2.2, 57))).lerp(L(V(-5, 0.9, 66), V(-6, 2.6, 60)), wide);
      out.look.copy(P(V(0.2, 15.5, 0), V(0.2, 16.5, 0))).lerp(L(V(-15, 16, 0), V(-14, 17, 0)), wide);
      break;
    case 1:
      // Torre separada à esquerda (com etiquetas), lista à direita; a câmera sobe com a lista.
      out.explode = 1;
      fovL = 40;
      // v5: a explosão é mais alta (atraso, giro, inclinação); a câmera recua para a torre caber inteira.
      out.pos.copy(P(V(0, 14, 70), V(0, 26, 66))).lerp(L(V(-2, 15, 82), V(-1, 30, 78)), wide);
      out.look.copy(P(V(0, 18, 0), V(0, 29, 0))).lerp(L(V(12.5, 20.5, 0), V(12.5, 32, 0)), wide);
      break;
    case 2:
      out.vaultRot = stepped(Math.min(5, Math.max(0, local * 6 - 0.5)));
      fovP = 56;
      out.pos.copy(V(0, -44.0, 11)).lerp(V(0.9, -44.4, 9.6), wide);
      out.look.copy(V(0, -44.6, -4)).lerp(V(-3.4, -44.7, -4), wide);
      // Celular: as cartas sobem para a metade de cima; o painel fica embaixo.
      out.shiftY = 0.5 * (1 - wide);
      break;
    case 3:
      out.needle = stepped(Math.min(2, Math.max(0, local * 3 - 0.5)));
      out.doors = sstep(0.8, 0.94, local);
      // De frente para a porta, com o mostrador inteiro no quadro. Desktop: porta na
      // metade direita, longe da coluna de texto. Celular: porta e mostrador em cima,
      // o painel embaixo, sobre o chão escuro.
      fovL = 44;
      fovP = 70;
      out.pos.copy(V(-4.6, -43.4, -4)).lerp(V(-4.8, -43.3, -4), wide);
      out.look.copy(V(-18, -42.85, -4));
      out.shiftX = 0.36 * wide;
      out.shiftY = 0.36 * (1 - wide);
      break;
    case 4:
      out.plateLight = local;
      fovP = 56;
      out.pos.copy(V(12.2, -43.2, 3)).lerp(V(13.9, -43.2, 3.2 + (local - 0.5) * 0.5), wide);
      out.look.copy(V(18, -43.2, 3)).lerp(V(18, -43.2, 3), wide);
      break;
    default:
      fovL = 40;
      fovP = 58;
      out.pos.copy(P(V(3, 1.2, 33), V(2.6, 1.0, 31))).lerp(L(V(5.2, 1.05, 31.5), V(4, 0.9, 29)), wide);
      out.look.copy(P(V(0, 3, 18), V(0, 3.2, 18))).lerp(L(V(-1.5, 2.6, 19), V(-1, 2.4, 18)), wide);
  }
  out.fov = fovP + (fovL - fovP) * wide;
  return out;
}

const newPose = (): Pose => ({ pos: V(0, 0, 0), look: V(0, 0, 0), fov: 40, explode: 0, vaultRot: 0, needle: 0, doors: 0, plateLight: 0.5, shiftX: 0, shiftY: 0 });

function Stage({ quality, floors, dawn, skipIntro }: Props) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const viewport = useThree((s) => s.viewport);

  const world = useMemo<World>(() => createWorld(quality, BRAND_NAME, modes), [quality]);
  const post = quality === 'high';

  const rt = useMemo(() => {
    if (!post) return null;
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    return target;
  }, [post]);
  const postScene = useMemo(() => {
    const s = new THREE.Scene();
    const mat = createPostMaterial();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    s.add(quad);
    return { scene: s, mat, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, []);

  useEffect(() => {
    if (!rt) return;
    const dpr = viewport.dpr;
    rt.setSize(Math.max(1, Math.floor(size.width * dpr)), Math.max(1, Math.floor(size.height * dpr)));
    postScene.mat.uniforms.uRes!.value.set(size.width * dpr, size.height * dpr);
  }, [rt, size, viewport.dpr, postScene]);

  // Movimento reduzido (com ?tier= forçado) ou remontagem: a torre aparece pronta, sem abertura.
  const still = useMemo(() => !!skipIntro || window.matchMedia('(prefers-reduced-motion: reduce)').matches, [skipIntro]);

  const state = useRef({
    ready: false,
    compiled: false,
    phase: 'load' as 'load' | 'floors' | 'souls' | 'done',
    newsTimer: 0,
    lastScroll: window.scrollY,
    wind: 0,
    pointer: new THREE.Vector2(),
    pointerS: new THREE.Vector2(),
    look: V(0, 0, 0),
    camVel: 0,
    first: true,
    perfFrames: 0,
    perfTime: 0,
    perfStart: 0,
    labelsHidden: false,
    shift: new THREE.Vector2(),
  });
  /** Largura de cada etiqueta (lida uma vez, não a cada quadro); zera quando a tela ou o texto muda. */
  const labelW = useMemo(() => new Map<HTMLElement, number>(), []);
  useEffect(() => labelW.clear(), [size.width, floors, labelW]);
  const poses = useMemo(() => ({ a: newPose(), b: newPose(), mix: newPose() }), []);
  const floorsRef = useRef(floors);

  // Montagem: ambiente, estados iniciais (apagados), compilação antecipada dos shaders.
  useEffect(() => {
    let alive = true;
    // Mundo novo (troca de nível ou recarga em dev): a abertura recomeça do zero.
    state.current.ready = false;
    state.current.compiled = false;
    gl.toneMappingExposure = 1.15;
    towerBus.progress(66);
    world.setDawn(dawn, gl);
    towerBus.progress(78);
    // Sem abertura: pronta. Com abertura: andares escondidos, o círculo acende com o carregamento.
    world.setFloors(floorsRef.current, still ? 'instant' : 'hold');
    world.showAll();
    const done = () => {
      if (!alive) return;
      state.current.compiled = true;
      towerBus.progress(94);
    };
    gl.compileAsync(world.scene, camera).then(done, done);
    return () => {
      alive = false;
      world.dispose();
      rt?.dispose();
    };
    // dawn entra no efeito abaixo; aqui só a montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => {
    world.setDawn(dawn, gl);
    postScene.mat.uniforms.uDawn!.value = dawn ? 1 : 0;
  }, [dawn, world, gl, postScene]);

  // Dado ao vivo: alguém entrou → uma brasa voa da cidade e acende a janela ("plim", se o som
  // estiver ligado). Lobby novo → andar conjurado; lobby que fechou → andar desfeito.
  useEffect(() => {
    floorsRef.current = floors;
    if (!state.current.ready) return;
    const change = world.setFloors(floors, 'live');
    if (change.lit > 0) play('plim');
    const news = change.added.length ? { raised: change.added[change.added.length - 1]! } : change.removed ? ({ gone: true } as const) : null;
    if (news) {
      towerBus.set({ news });
      window.clearTimeout(state.current.newsTimer);
      state.current.newsTimer = window.setTimeout(() => towerBus.set({ news: null }), 4200);
    }
  }, [floors, world]);

  // Qualquer gesto pula a abertura: o resto do roteiro corre em ~300 ms (nada trava a página).
  useEffect(() => {
    const skip = () => world.skip();
    const opts = { passive: true } as const;
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    evs.forEach((e) => window.addEventListener(e, skip, opts));
    return () => {
      evs.forEach((e) => window.removeEventListener(e, skip));
      window.clearTimeout(state.current.newsTimer);
    };
  }, [world]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      state.current.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const anchor = useMemo(() => V(0, 0, 0), []);

  // Só em desenvolvimento: inspecionar a cena pelo console (window.__torre).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // __torre.replay() reinicia a abertura; window.__torreObraT = 1.4 congela nela (capturas).
    (window as unknown as { __torre?: unknown }).__torre = { camera, world, gl, poses, replay: () => world.startOpening(true), floors: () => floorsRef.current };
  }, [camera, world, gl, poses]);

  useFrame((_, rawDt) => {
    const s = state.current;
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now() / 1000;

    // Pronto: compila → primeiro quadro → começa a "Obra Encantada" (ou, sem abertura, já está pronta).
    if (s.compiled && !s.ready) {
      s.ready = true;
      if (!still) {
        world.setFloors(floorsRef.current, 'hold');
        world.startOpening();
      }
      towerBus.set({ ready: true, progress: 100 });
      s.perfStart = now + 5;
    }
    // Fase da abertura para o HUD e o título (muda poucas vezes; nada de setState por quadro).
    const ob = world.obra();
    const phase = !s.ready ? 'load' : !ob || ob.done ? 'done' : ob.t < Math.max(...ob.plan.fall, 0) + 0.46 ? 'floors' : ob.t < ob.plan.climax ? 'souls' : 'done';
    if (phase !== s.phase) {
      s.phase = phase;
      towerBus.set({ phase });
    }

    const aspect = size.width / Math.max(1, size.height);
    const wide = clamp01((aspect - 0.62) / (1.25 - 0.62));
    const c = sceneCoord();
    pose(c.a, c.localA, wide, poses.a);
    pose(c.b, c.localB, wide, poses.b);
    const m = poses.mix;
    const t = c.t;
    m.pos.copy(poses.a.pos).lerp(poses.b.pos, t);
    m.look.copy(poses.a.look).lerp(poses.b.look, t);
    m.fov = poses.a.fov + (poses.b.fov - poses.a.fov) * t;
    for (const k of ['explode', 'vaultRot', 'needle', 'doors', 'plateLight', 'shiftX', 'shiftY'] as const) m[k] = poses.a[k] + (poses.b[k] - poses.a[k]) * t;

    // Respiração lenta e paralaxe do ponteiro só na rua (no porão a câmera fica firme).
    const above = m.pos.y > 0 ? 1 : 0;
    s.pointerS.lerp(s.pointer, 1 - Math.exp(-dt * 2.5));
    m.pos.x += (Math.sin(now * 0.13) * 0.35 + s.pointerS.x * 0.9) * above;
    m.pos.y += (-s.pointerS.y * 0.45) * above;
    m.look.y += Math.sin(now * 0.09) * 0.2 * above;

    // Abertura: a câmera começa alta, olhando o círculo na praça, e desce para a contra-plongée
    // do hero conforme a torre se ergue (só enquanto a cena 1 está no quadro).
    const hero = c.a === 0 ? 1 - c.t : 0;
    if (!still) {
      const ot = ob ? ob.t : 0;
      const end = ob ? ob.plan.climax : 4;
      const est = (1 - ramp(0.7, end * 0.9, ot)) * hero;
      if (est > 0) {
        m.pos.lerp(tmpEst.copy(m.pos).add(V(1.5, 7.5, 9)), est);
        m.look.lerp(tmpLook.set(m.look.x * 0.5, 2.2, 0), est);
      }
    }
    if (s.first) {
      s.first = false;
      camera.position.copy(m.pos);
      s.look.copy(m.look);
    }
    // (dev) window.__torreSettle = true: câmera sem amortecimento, para capturas de tela.
    const settle = import.meta.env.DEV && (window as unknown as { __torreSettle?: boolean }).__torreSettle;
    const k = settle ? 1 : 1 - Math.exp(-dt * 3.2);
    const prevY = camera.position.y;
    camera.position.lerp(m.pos, k);
    s.look.lerp(m.look, k);
    camera.lookAt(s.look);
    if (Math.abs(camera.fov - m.fov) > 0.01) {
      camera.fov += (m.fov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
    s.shift.x += (m.shiftX - s.shift.x) * k;
    s.shift.y += (m.shiftY - s.shift.y) * k;
    if (Math.abs(s.shift.x) + Math.abs(s.shift.y) > 1e-4) {
      const w = size.width;
      const h = size.height;
      camera.setViewOffset(w, h, (-s.shift.x * w) / 2, (s.shift.y * h) / 2, w, h);
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
    s.camVel = Math.abs(camera.position.y - prevY) / Math.max(dt, 1e-3);

    // Vento da rolagem para as folhas da Gazeta.
    const sy = window.scrollY;
    const speed = Math.abs(sy - s.lastScroll) / Math.max(dt, 1e-3);
    s.lastScroll = sy;
    const windTarget = clamp01(speed / 1600);
    s.wind += (windTarget - s.wind) * (1 - Math.exp(-dt * (windTarget > s.wind ? 6 : 1.4)));

    const focusId = towerBus.get().focusId;
    const focus = focusId ? floorsRef.current.findIndex((f) => f.lobby.id === focusId) : -1;
    const underground = camera.position.y < 0;

    world.update({
      time: now,
      dt,
      explode: m.explode,
      vaultRot: m.vaultRot,
      needle: m.needle,
      doors: m.doors,
      plateLight: m.plateLight,
      wind: s.wind,
      focus,
      underground,
      camera,
      hero,
      progress: towerBus.get().progress / 100,
      pointer: s.pointerS,
      aspect,
      heightPx: size.height * viewport.dpr,
      seek: import.meta.env.DEV ? (window as unknown as { __torreObraT?: number }).__torreObraT : undefined,
    });

    // Etiquetas dos andares: projeta e move no DOM (aria-hidden; a lista é o equivalente).
    const show = m.explode > 0.04 && !underground;
    // Abaixo de 1024 px a torre fica no meio: a etiqueta curta vai à direita de cada andar.
    const narrow = size.width < 1024;
    if (show || !s.labelsHidden) {
      // Faixa livre para as etiquetas: entre o cabeçalho e o HUD. No estreito a torre fica
      // atrás do título e da lista, então as etiquetas só aparecem acima do título da cena.
      let clipY = size.height - (size.width < 960 ? 150 : 64);
      if (narrow && show) {
        const head = document.getElementById('andares-title');
        if (head) clipY = Math.min(clipY, head.getBoundingClientRect().top - 12);
      }
      floorsRef.current.forEach((fl, i) => {
        const el = floorLabels.get(fl.lobby.id);
        if (!el) return;
        if (!show || !world.floorAnchor(i, anchor, narrow ? 'right' : 'left')) {
          el.style.opacity = '0';
          return;
        }
        anchor.project(camera);
        const x = (anchor.x * 0.5 + 0.5) * size.width;
        const y = (-anchor.y * 0.5 + 0.5) * size.height;
        let w = labelW.get(el);
        if (w === undefined) {
          w = el.offsetWidth;
          labelW.set(el, w);
        }
        // A etiqueta inteira cabe na tela e fora das faixas do cabeçalho e do HUD.
        const fits = narrow ? x + w < size.width - 4 : x - w > 4;
        const visible = anchor.z < 1 && fits && y > 84 && y < clipY;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.style.opacity = visible ? String(Math.min(1, (m.explode - 0.04) * 1.6)) : '0';
      });
      // Miras "+ 07" no remate direito de cada andar (só no desktop; no estreito a etiqueta curta já tem o número).
      floorsRef.current.forEach((fl, i) => {
        const el = floorMarks.get(fl.lobby.id);
        if (!el) return;
        if (!show || narrow || !world.floorMark(i, anchor)) {
          el.style.opacity = '0';
          return;
        }
        anchor.project(camera);
        const x = (anchor.x * 0.5 + 0.5) * size.width;
        const y = (-anchor.y * 0.5 + 0.5) * size.height;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.style.opacity = anchor.z < 1 && y > 84 && y < clipY ? String(Math.min(1, (m.explode - 0.3) * 2)) : '0';
      });
      s.labelsHidden = !show;
    }

    // Desenho
    if (rt) {
      const crossing = 1 - sstep(0.0, 7.0, Math.abs(camera.position.y));
      postScene.mat.uniforms.uTrans!.value = s.camVel > 1.5 ? crossing : crossing * 0.2 * (camera.position.y < 0.6 ? 1 : 0);
      postScene.mat.uniforms.uTime!.value = now;
      gl.setRenderTarget(rt);
      gl.render(world.scene, camera);
      gl.setRenderTarget(null);
      postScene.mat.uniforms.tScene!.value = rt.texture;
      gl.render(postScene.scene, postScene.cam);
    } else {
      gl.render(world.scene, camera);
    }

    // Guarda de desempenho: se o FPS cair, rebaixa o nível (alto → médio → cidade SVG).
    if (s.ready && now > s.perfStart) {
      s.perfFrames++;
      s.perfTime += rawDt < 0.25 ? rawDt : 1 / 60;
      if (s.perfFrames >= 150) {
        const avg = s.perfTime / s.perfFrames;
        s.perfFrames = 0;
        s.perfTime = 0;
        const tier = towerBus.get().tier;
        if (tier === 'high' && avg > 1 / 34) towerBus.set({ tier: 'mid' });
        else if (tier === 'mid' && avg > 1 / 22) towerBus.set({ tier: 'low' });
      }
    }
  }, 1);

  return null;
}

export default function TowerScene(props: Props) {
  const high = props.quality === 'high';
  return (
    <Canvas
      className="tr-canvas"
      dpr={high ? [1, 1.5] : [1, 1.25]}
      gl={{ antialias: !high, alpha: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 40, near: 0.1, far: 900, position: [-3, 1.6, 44] }}
      flat={false}
      aria-hidden="true"
    >
      <Stage {...props} />
    </Canvas>
  );
}
