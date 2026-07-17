import { ApplicationConfig, ErrorHandler, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { DEFAULT_LANGUAGE } from './core/i18n/language.config';
import { AppErrorHandler } from './core/errors/app-error-handler';

const surfaceDay = {
  0: '#fffdf9',
  50: '#faf7f0',
  100: '#f3ede1',
  200: '#e6dcc8',
  300: '#d4c4a3',
  400: '#b3a589',
  500: '#8a7d66',
  600: '#6b5f4c',
  700: '#4f4537',
  800: '#352e25',
  900: '#211c16',
  950: '#13100c',
};

const surfaceNight = {
  0: '#f4f3fb',
  50: '#e6e3f5',
  100: '#c9c3e8',
  200: '#a79ed9',
  300: '#8478c8',
  400: '#6757b0',
  500: '#4f4090',
  600: '#3d3072',
  700: '#2e2456',
  800: '#211a40',
  900: '#171232',
  950: '#0d0a1f',
};

const BitchickenPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
    colorScheme: {
      light: {
        surface: surfaceDay,
        primary: {
          color: '{primary.500}',
          contrastColor: '#3a2606',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.700}',
          focusColor: '{primary.800}',
        },
      },
      dark: {
        surface: surfaceNight,
        primary: {
          color: '{primary.400}',
          contrastColor: '#1a1330',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
        highlight: {
          background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
          focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
          color: 'rgba(255, 255, 255, 0.92)',
          focusColor: 'rgba(255, 255, 255, 0.92)',
        },
      },
    },
  },
  components: {
    slider: {
      handle: {
        width: '16px',
        height: '16px',
        background: '{primary.color}',
        hoverBackground: '{primary.color}',
        content: {
          width: '12px',
          height: '12px',
        },
      },
      colorScheme: {
        light: { handle: { content: { background: '{primary.color}' } } },
        dark: { handle: { content: { background: '{primary.color}' } } },
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideAnimationsAsync(),
    provideHttpClient(withFetch(), withInterceptors([authTokenInterceptor])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: DEFAULT_LANGUAGE,
      lang: DEFAULT_LANGUAGE,
    }),
    providePrimeNG({
      theme: {
        preset: BitchickenPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
    }),
    MessageService,
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
