import { Injectable, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { EggLevelConfig, clampLevel, getLevelConfig } from './egg-levels';
import { ThemeService } from '../../../core/theme/theme.service';

type QualityTier = 'high' | 'medium' | 'low';

interface EggGroup extends THREE.Group {
  userData: { config: EggLevelConfig; rings: THREE.Mesh[] };
}

interface EggInstance {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  level: number;
  phase: number;
  visible: boolean;
  onFail?: () => void;
}

@Injectable({ providedIn: 'root' })
export class EggSceneService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly theme = inject(ThemeService);
  private readonly reduceMotion =
    this.isBrowser && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly RENDER_W = 384;
  private readonly RENDER_H = 474;
  private readonly SPIN = 0.24;
  private readonly MIN_RENDER_DT = 1 / 32;
  private readonly DEGRADE_FPS = 24;

  readonly quality = signal<QualityTier>('high');

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private geometry?: THREE.SphereGeometry;
  private ringGeometry?: THREE.TorusGeometry;
  private screenGeometry?: THREE.PlaneGeometry;
  private screenMaterial?: THREE.MeshBasicMaterial;
  private screenCtx?: CanvasRenderingContext2D;
  private screenTexture?: THREE.CanvasTexture;
  private maxAnisotropy = 1;
  private ambient?: THREE.AmbientLight;
  private environment?: THREE.Texture;
  private disposables: { dispose(): void }[] = [];

  private readonly eggByLevel = new Map<number, EggGroup>();
  private readonly instances = new Map<number, EggInstance>();
  private readonly elementToId = new Map<Element, number>();
  private observer?: IntersectionObserver;

  private nextId = 1;
  private rafId = 0;
  private running = false;
  private startTime = 0;
  private lastRender = -1;
  private failed = false;

  private frames = 0;
  private fpsStart = -1;
  private lowFpsStreak = 0;
  private tier: QualityTier = 'high';

  constructor() {
    effect(() => {
      this.theme.isDark();
      untracked(() => this.applyTheme());
    });
  }

  register(canvas: HTMLCanvasElement, level: number, onFail?: () => void): number {
    if (!this.isBrowser || this.failed) return -1;
    if (!this.renderer) this.init();
    if (this.failed || !this.renderer) return -1;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return -1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const id = this.nextId++;
    const phase = (id * 2.399963) % (Math.PI * 2);
    const instance: EggInstance = { ctx, canvas, level, phase, visible: false, onFail };
    this.instances.set(id, instance);
    this.elementToId.set(canvas, id);
    this.observer!.observe(canvas);

    if (this.reduceMotion) this.renderOnce(instance);
    return id;
  }

  unregister(id: number): void {
    const instance = this.instances.get(id);
    if (!instance) return;
    this.observer?.unobserve(instance.canvas);
    this.elementToId.delete(instance.canvas);
    this.instances.delete(id);
    if (this.instances.size === 0) this.teardown();
    else this.evaluateRunning();
  }

  refresh(id: number): void {
    const instance = this.instances.get(id);
    if (instance && (this.reduceMotion || !this.running)) this.renderOnce(instance);
  }

  private init(): void {
    if (!this.setupGl()) {
      this.failed = true;
      return;
    }
    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const id = this.elementToId.get(entry.target);
          const instance = id != null ? this.instances.get(id) : undefined;
          if (instance) instance.visible = entry.isIntersecting;
        }
        this.evaluateRunning();
      },
      { threshold: 0.01 },
    );
    document.addEventListener('visibilitychange', this.onVisibility);
    this.startTime = performance.now();
  }

  private setupGl(): boolean {
    try {
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(1);
      this.renderer = renderer;
      this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
      this.disposables.push(renderer);
      this.applyTierScale();

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.PerspectiveCamera(30, this.RENDER_W / this.RENDER_H, 0.1, 100);
      camera.position.set(0, 0, 6.2);
      this.camera = camera;

      this.buildShared(scene);
      renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
      return true;
    } catch (err) {
      console.warn('[egg] WebGL unavailable — using static fallback.', err);
      return false;
    }
  }

  private onVisibility = () => this.evaluateRunning();

  private evaluateRunning(): void {
    if (this.reduceMotion || !this.renderer) return;
    const anyVisible = [...this.instances.values()].some(i => i.visible);
    const shouldRun = anyVisible && !document.hidden;
    if (shouldRun && !this.running) {
      this.running = true;
      this.rafId = requestAnimationFrame(this.frame);
    } else if (!shouldRun && this.running) {
      this.stopLoop();
    }
  }

  private stopLoop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.lastRender = -1;
    this.fpsStart = -1;
  }

  private frame = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    const time = (performance.now() - this.startTime) / 1000;
    if (time - this.lastRender < this.MIN_RENDER_DT) return;
    this.lastRender = time;

    this.sampleFps(time);
    this.drawScreen(time);
    for (const instance of this.instances.values()) {
      if (instance.visible) this.paint(instance, time);
    }
  };

  private sampleFps(time: number): void {
    if (this.fpsStart < 0) {
      this.fpsStart = time;
      this.frames = 0;
      return;
    }
    this.frames++;
    if (time - this.fpsStart < 1) return;
    const fps = this.frames / (time - this.fpsStart);
    this.frames = 0;
    this.fpsStart = time;
    if (this.tier === 'low') return;
    this.lowFpsStreak = fps < this.DEGRADE_FPS ? this.lowFpsStreak + 1 : 0;
    if (this.lowFpsStreak >= 2) {
      this.lowFpsStreak = 0;
      this.degrade();
    }
  }

  private degrade(): void {
    this.tier = this.tier === 'high' ? 'medium' : 'low';
    this.applyTierScale();
    this.quality.set(this.tier);
  }

  private applyTierScale(): void {
    if (!this.renderer) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = this.tier === 'high' ? Math.min(dpr, 2) : this.tier === 'medium' ? 1 : 0.75;
    this.renderer.setSize(this.RENDER_W * scale, this.RENDER_H * scale, false);
  }

  private renderOnce(instance: EggInstance): void {
    if (!this.renderer) return;
    const time = (performance.now() - this.startTime) / 1000;
    this.drawScreen(time);
    this.paint(instance, time);
  }

  private paint(instance: EggInstance, time: number): void {
    const renderer = this.renderer!;
    const group = this.getEgg(instance.level);
    const config = group.userData.config;

    group.visible = true;
    group.rotation.y = time * this.SPIN * config.spin + instance.phase;
    group.userData.rings.forEach((ring, i) => {
      ring.rotation.z = time * (0.5 + 0.25 * i) * (i % 2 ? -1 : 1);
    });

    renderer.render(this.scene!, this.camera!);
    group.visible = false;

    const target = instance.ctx.canvas;
    instance.ctx.clearRect(0, 0, target.width, target.height);
    instance.ctx.drawImage(renderer.domElement, 0, 0, target.width, target.height);
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.stopLoop();
    setTimeout(() => this.recover(), 300);
  };

  private recover(): void {
    if (this.failed) return;
    this.disposeGpu();
    this.lastRender = -1;
    if (!this.setupGl()) {
      this.failNow();
      return;
    }
    if (this.reduceMotion) {
      for (const instance of this.instances.values()) {
        if (instance.visible) this.renderOnce(instance);
      }
    } else {
      this.evaluateRunning();
    }
  }

  private failNow(): void {
    this.failed = true;
    this.stopLoop();
    for (const instance of this.instances.values()) instance.onFail?.();
  }

  private disposeGpu(): void {
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch {
        continue;
      }
    }
    this.disposables = [];
    this.environment?.dispose();
    this.environment = undefined;
    this.ambient = undefined;
    this.eggByLevel.clear();
    this.renderer = this.scene = this.camera = undefined;
  }

  private teardown(): void {
    this.stopLoop();
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.disposeGpu();
    this.elementToId.clear();
    this.failed = false;
    this.tier = 'high';
    this.quality.set('high');
  }

  private buildShared(scene: THREE.Scene): void {
    const FACETS = 12;
    const ELONGATE = 1.46;
    const TAPER = 0.24;
    const LOBES = 5;
    const LOBE_DEPTH = 0.03;

    const geometry = new THREE.SphereGeometry(1, FACETS, FACETS);
    const position = geometry.attributes['position'];
    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i);
      let z = position.getZ(i);
      const y = position.getY(i);
      const taper = 1 - TAPER * y - 0.05 * y * y;
      x *= taper;
      z *= taper;
      const ridge = 1 + LOBE_DEPTH * Math.cos(LOBES * Math.atan2(z, x));
      x *= ridge;
      z *= ridge;
      position.setXYZ(i, x, y * ELONGATE, z);
    }
    geometry.computeVertexNormals();
    this.geometry = geometry;
    this.disposables.push(geometry);

    this.ringGeometry = new THREE.TorusGeometry(1.3, 0.012, 10, 90);
    this.screenGeometry = new THREE.PlaneGeometry(0.82, 0.58);
    this.disposables.push(this.ringGeometry, this.screenGeometry);

    this.applyEnvironment();

    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 360;
    this.screenCtx = screenCanvas.getContext('2d')!;
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture = screenTexture;
    this.screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture, transparent: true });
    this.disposables.push(screenTexture, this.screenMaterial);
    this.drawScreen(0);

    const ambient = new THREE.AmbientLight(0x5b6bb0, 0.85);
    this.ambient = ambient;
    scene.add(ambient);
    this.applyAmbient();
    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(0.5, 1, 1.4);
    scene.add(key);
    const cyan = new THREE.PointLight(0x29e7ff, 1.2, 30);
    cyan.position.set(-3, 0.6, 2.2);
    scene.add(cyan);
    const magenta = new THREE.PointLight(0xc14bff, 1, 30);
    magenta.position.set(3, -0.5, 2);
    scene.add(magenta);
  }

  private getEgg(level: number): EggGroup {
    const key = clampLevel(level);
    const cached = this.eggByLevel.get(key);
    if (cached) return cached;
    const group = this.buildEgg(getLevelConfig(key));
    this.eggByLevel.set(key, group);
    this.scene!.add(group);
    return group;
  }

  private buildEgg(config: EggLevelConfig): EggGroup {
    const group = new THREE.Group() as EggGroup;
    group.visible = false;
    group.userData = { config, rings: [] };

    const map = this.shellTexture(false, config);
    const emissiveMap = this.shellTexture(true, config);
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      map,
      emissive: 0xffffff,
      emissiveMap,
      emissiveIntensity: config.emissive,
      metalness: config.metalness,
      roughness: config.roughness,
      flatShading: true,
      clearcoat: 0.45,
      clearcoatRoughness: 0.4,
      iridescence: 0.15 + 0.06 * config.level,
      iridescenceIOR: 1.3,
      envMapIntensity: 0.65,
    });
    this.disposables.push(map, emissiveMap, bodyMaterial);
    group.add(new THREE.Mesh(this.geometry!, bodyMaterial));

    if (config.screen) {
      const screen = new THREE.Mesh(this.screenGeometry!, this.screenMaterial!);
      screen.position.set(0, -0.12, 1.02);
      group.add(screen);
    }

    if (config.antenna) {
      const metalMaterial = new THREE.MeshStandardMaterial({
        color: 0x3b4258,
        metalness: 0.85,
        roughness: 0.35,
      });
      const stemGeometry = new THREE.CylinderGeometry(0.012, 0.022, 0.55, 12);
      const tipGeometry = new THREE.SphereGeometry(0.05, 16, 16);
      const tipMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a6e });
      this.disposables.push(metalMaterial, stemGeometry, tipGeometry, tipMaterial);
      const stem = new THREE.Mesh(stemGeometry, metalMaterial);
      stem.position.set(0.17, 1.3, 0.02);
      stem.rotation.z = -0.28;
      const tip = new THREE.Mesh(tipGeometry, tipMaterial);
      tip.position.set(0.31, 1.55, 0.02);
      group.add(stem, tip);
    }

    if (config.bosses) {
      const rimGeometry = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 24);
      const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0xb8862a,
        metalness: 0.9,
        roughness: 0.35,
      });
      const coreGeometry = new THREE.CylinderGeometry(0.105, 0.105, 0.1, 24);
      const coreMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(config.accent) });
      this.disposables.push(rimGeometry, rimMaterial, coreGeometry, coreMaterial);
      const addBoss = (x: number, rotationZ: number) => {
        const boss = new THREE.Group();
        boss.add(new THREE.Mesh(rimGeometry, rimMaterial), new THREE.Mesh(coreGeometry, coreMaterial));
        boss.position.set(x, -0.05, 0);
        boss.rotation.z = rotationZ;
        group.add(boss);
      };
      addBoss(-0.99, Math.PI / 2);
      addBoss(0.99, -Math.PI / 2);
    }

    for (let i = 0; i < config.rings; i++) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(config.glowColor),
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.disposables.push(ringMaterial);
      const ring = new THREE.Mesh(this.ringGeometry!, ringMaterial);
      ring.rotation.x = Math.PI / 2 - 0.5 + i * 0.5;
      ring.rotation.y = i * 0.6;
      group.add(ring);
      group.userData.rings.push(ring);
    }

    return group;
  }

  private applyTheme(): void {
    if (!this.renderer || !this.scene) return;
    this.applyEnvironment();
    this.applyAmbient();
    for (const instance of this.instances.values()) {
      if (instance.visible) this.renderOnce(instance);
    }
  }

  private applyEnvironment(): void {
    if (!this.renderer || !this.scene) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const equirect = this.makeEnvTexture(this.theme.isDark());
    const environment = pmrem.fromEquirectangular(equirect).texture;
    equirect.dispose();
    pmrem.dispose();
    this.environment?.dispose();
    this.environment = environment;
    this.scene.environment = environment;
  }

  private applyAmbient(): void {
    if (!this.ambient) return;
    const dark = this.theme.isDark();
    this.ambient.color.setHex(dark ? 0x5b6bb0 : 0xacc2da);
    this.ambient.intensity = dark ? 0.85 : 1.12;
  }

  private makeEnvTexture(isDark: boolean): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const g = canvas.getContext('2d')!;
    const gradient = g.createLinearGradient(0, 0, 0, 256);
    if (isDark) {
      gradient.addColorStop(0, '#16323e');
      gradient.addColorStop(0.5, '#070912');
      gradient.addColorStop(1, '#1f0c2c');
    } else {
      gradient.addColorStop(0, '#dbe9f6');
      gradient.addColorStop(0.5, '#f3f7fc');
      gradient.addColorStop(1, '#e7e1f3');
    }
    g.fillStyle = gradient;
    g.fillRect(0, 0, 512, 256);

    const blob = (x: number, y: number, radius: number, color: string) => {
      const radial = g.createRadialGradient(x, y, 0, x, y, radius);
      radial.addColorStop(0, color);
      radial.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = radial;
      g.fillRect(0, 0, 512, 256);
    };
    if (isDark) {
      blob(150, 90, 180, 'rgba(70,150,175,.30)');
      blob(370, 100, 170, 'rgba(140,85,170,.26)');
    } else {
      blob(255, 34, 110, 'rgba(255,255,255,.42)');
      blob(150, 95, 185, 'rgba(110,190,230,.42)');
      blob(372, 105, 175, 'rgba(170,140,220,.36)');
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private shellTexture(emissive: boolean, config: EggLevelConfig): THREE.CanvasTexture {
    const W = 512;
    const H = 256;
    const blur = W / 2048;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;

    if (emissive) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
    } else {
      const gradient = g.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, config.shellTop);
      gradient.addColorStop(1, config.shellBottom);
      g.fillStyle = gradient;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.lineWidth = H * 0.014;
      [0.22, 0.5, 0.78].forEach(v => {
        g.beginPath();
        g.moveTo(0, v * H);
        g.lineTo(W, v * H);
        g.stroke();
      });
    }

    if (config.modules > 0) {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let m = 0; m < config.modules; m++) {
        const cx = ((m + 0.5) / config.modules) * W;
        g.shadowColor = config.circuit;
        g.shadowBlur = (emissive ? 28 : 14) * blur;
        g.strokeStyle = emissive ? config.circuit : withAlpha(config.circuit, 0.75);
        g.lineWidth = W * 0.004;
        g.beginPath();
        g.moveTo(cx, H * 0.13);
        g.lineTo(cx, H * 0.3);
        g.lineTo(cx + W * 0.03, H * 0.3);
        g.lineTo(cx + W * 0.03, H * 0.45);
        g.moveTo(cx, H * 0.3);
        g.lineTo(cx - W * 0.03, H * 0.36);
        g.lineTo(cx - W * 0.03, H * 0.5);
        g.moveTo(cx, H * 0.6);
        g.lineTo(cx, H * 0.85);
        g.lineTo(cx + W * 0.026, H * 0.85);
        g.stroke();
        g.shadowColor = config.accent;
        g.fillStyle = config.accent;
        const nodes: readonly (readonly [number, number])[] = [
          [cx + W * 0.03, H * 0.45],
          [cx - W * 0.03, H * 0.5],
          [cx + W * 0.026, H * 0.85],
          [cx, H * 0.13],
        ];
        nodes.forEach(([nx, ny]) => {
          g.beginPath();
          g.arc(nx, ny, W * 0.006, 0, Math.PI * 2);
          g.fill();
        });
      }
      if (!emissive) {
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(200,215,255,.35)';
        for (let i = 0; i < 28; i++) {
          const x = (i / 28) * W;
          g.beginPath();
          g.arc(x, H * 0.075, W * 0.004, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.arc(x, H * 0.925, W * 0.004, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.shadowBlur = 0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = this.maxAnisotropy;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private drawScreen(time: number): void {
    const g = this.screenCtx;
    if (!g) return;
    const W = 512;
    const H = 360;
    g.clearRect(0, 0, W, H);
    roundedRect(g, 6, 6, W - 12, H - 12, 46);
    g.fillStyle = '#caa23c';
    g.fill();
    roundedRect(g, 20, 20, W - 40, H - 40, 36);
    g.fillStyle = '#150e34';
    g.fill();
    roundedRect(g, 34, 34, W - 68, H - 68, 26);
    const gradient = g.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#3a1d6e');
    gradient.addColorStop(1, '#221148');
    g.fillStyle = gradient;
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = '#29e7ff';
    g.lineWidth = 5;
    g.shadowColor = '#29e7ff';
    g.shadowBlur = 16;
    g.beginPath();
    for (let x = 44; x <= W - 44; x += 4) {
      const p = (x - 44) / (W - 88);
      const y = H * 0.5 + Math.sin(p * 22 + time * 4.5) * Math.sin(p * 5 + time * 1.3) * (H * 0.22);
      if (x === 44) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.restore();
    if (this.screenTexture) this.screenTexture.needsUpdate = true;
  }
}

function roundedRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const n = parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
