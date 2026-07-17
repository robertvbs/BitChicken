import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { EggSceneService } from './egg-scene.service';
import { getLevelConfig, hexToRgb } from './egg-levels';
import { ThemeService } from '../../../core/theme/theme.service';

interface Particle {
  left: string;
  size: string;
  bg: string;
  shadow: string;
  dur: string;
  delay: string;
}

const QUALITY_PARTICLE_FACTOR: Record<'high' | 'medium' | 'low', number> = {
  high: 1,
  medium: 0.6,
  low: 0.3,
};

@Component({
  selector: 'app-egg',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'egg.css',
  host: {
    '[style.--egg-glow]': 'theme().glowCss',
    '[style.--egg-accent]': 'theme().accentCss',
    '[class.egg--dark]': 'isDark()',
  },
  template: `
    <div class="base"><img [src]="src()" alt="" decoding="async" loading="lazy" /></div>

    @if (!fallback()) {
      <div class="portal">
        <div class="ring r2"></div>
        <div class="ring"></div>
        <div class="core"></div>
      </div>

      <div class="beam"></div>

      <div class="particles">
        @for (p of particles(); track $index) {
          <span
            [style.left]="p.left"
            [style.width]="p.size"
            [style.height]="p.size"
            [style.background]="p.bg"
            [style.box-shadow]="p.shadow"
            [style.animation-duration]="p.dur"
            [style.animation-delay]="p.delay"
          ></span>
        }
      </div>
    }

    <div class="egg-shadow" [style.animation-delay]="floatDelay"></div>

    <div class="egg-wrap" [style.animation-delay]="floatDelay">
      <canvas #eggCanvas class="egg-canvas"></canvas>
      @if (fallback()) {
        <div
          class="egg-fallback"
          [style.--c-top]="theme().shellTop"
          [style.--c-bot]="theme().shellBottom"
        ></div>
      }
    </div>
  `,
})
export class Egg implements OnDestroy {
  readonly src = input('egg/base.webp');
  readonly level = input(1);
  readonly forceFallback = input(false);

  readonly theme = computed(() => getLevelConfig(this.level()));
  readonly fallback = signal(false);
  protected readonly isDark = inject(ThemeService).isDark;

  readonly particles = computed<Particle[]>(() => {
    const config = this.theme();
    const factor = QUALITY_PARTICLE_FACTOR[this.egg.quality()];
    const count = Math.max(0, Math.round(config.particles * factor));
    const glow = hexToRgb(config.glowCss);
    const accent = hexToRgb(config.accentCss);

    return Array.from({ length: count }, (_, i) => {
      const random = (seed: number) => {
        const value = Math.sin((i + 1) * seed) * 43758.5453;
        return value - Math.floor(value);
      };
      const duration = 2.2 + random(12.9898) * 2.6;
      const hue = random(4.1414) > 0.5 ? glow : accent;
      return {
        left: `${(random(78.233) * 100).toFixed(2)}%`,
        size: `${(3 + random(37.719) * 5).toFixed(1)}px`,
        bg: `rgb(${hue})`,
        shadow: `0 0 8px 2px rgba(${hue}, 0.85)`,
        dur: `${duration.toFixed(2)}s`,
        delay: `${(-random(93.989) * duration).toFixed(2)}s`,
      };
    });
  });

  private static sequence = 0;

  readonly floatDelay = `${(-((Egg.sequence++ * 0.73) % 4.2)).toFixed(2)}s`;

  private readonly egg = inject(EggSceneService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('eggCanvas');
  private resizeObserver?: ResizeObserver;
  private viewReady = false;
  private id = -1;

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
      this.resizeObserver.observe(canvas);
      this.viewReady = true;
      this.applyMode();
    });

    effect(() => {
      this.forceFallback();
      if (this.viewReady) this.applyMode();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.id > 0) this.egg.unregister(this.id);
  }

  private applyMode(): void {
    if (this.forceFallback()) {
      this.unregisterEgg();
      this.fallback.set(true);
    } else {
      this.fallback.set(false);
      this.registerEgg();
    }
  }

  private registerEgg(): void {
    if (this.id > 0) return;
    const canvas = this.canvasRef().nativeElement;
    this.resize(canvas);
    this.id = this.egg.register(canvas, this.level(), () => this.fallback.set(true));
    if (this.id < 0) this.fallback.set(true);
  }

  private unregisterEgg(): void {
    if (this.id > 0) {
      this.egg.unregister(this.id);
      this.id = -1;
    }
    const canvas = this.canvasRef().nativeElement;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  private resize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      this.egg.refresh(this.id);
    }
  }
}
