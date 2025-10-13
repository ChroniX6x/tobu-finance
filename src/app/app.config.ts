import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withDebugTracing, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideStore } from '@ngxs/store';
import { withNgxsLoggerPlugin } from '@ngxs/logger-plugin';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';
import { withNgxsRouterPlugin } from '@ngxs/router-plugin';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import Aura from '@primeng/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { AccountState } from './state/account.state';
import { CategoriesState } from './state/categories.state';
import { TransactionsState } from './state/transactions.state';
import { API_BASE_URL } from './core/api-base-url.token';
import { authInterceptor } from './core/auth/interceptors/auth.interceptor';

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
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideStore([AccountState,CategoriesState,TransactionsState], {developmentMode: true}, withNgxsLoggerPlugin(), withNgxsReduxDevtoolsPlugin(), withNgxsRouterPlugin()),
    providePrimeNG({
      theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } }
    }),
    { provide: API_BASE_URL, useValue: 'http://localhost:4000' } // z.B. 'https://api.example.com'
  ]
};
