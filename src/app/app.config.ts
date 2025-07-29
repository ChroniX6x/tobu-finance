import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withDebugTracing, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideStore } from '@ngxs/store';
import { withNgxsLoggerPlugin } from '@ngxs/logger-plugin';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';
import { withNgxsRouterPlugin } from '@ngxs/router-plugin';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import Aura from '@primeng/themes/aura';
import { providePrimeNG } from 'primeng/config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({
          anchorScrolling: 'enabled',
          scrollPositionRestoration: 'enabled'
      }),
      withEnabledBlockingInitialNavigation(),
      withDebugTracing()
    ),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(),
    provideStore([], {developmentMode: true}, withNgxsLoggerPlugin(), withNgxsReduxDevtoolsPlugin(), withNgxsRouterPlugin()),
    providePrimeNG({
      theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } }
    })
  ]
};
