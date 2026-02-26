import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withDebugTracing, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { provideStore } from '@ngxs/store';
import { withNgxsLoggerPlugin } from '@ngxs/logger-plugin';
import { withNgxsReduxDevtoolsPlugin } from '@ngxs/devtools-plugin';
import { withNgxsRouterPlugin } from '@ngxs/router-plugin';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { AccountState } from './shared/state/account.state';
import { CategoriesState } from './shared/state/categories.state';
import { TransactionPageState } from './transactions/state/transaction-page.state';
import { TransactionCaptureState } from './transactions/state/transaction-capture.state';
import { API_BASE_URL } from './core/api-base-url.token';
import { authInterceptor } from './core/auth/interceptors/auth.interceptor';
import { AuthService } from './core/auth/services/auth.service';

async function initializeAuth(authService: AuthService): Promise<void> {
  try {
    await firstValueFrom(authService.refresh());
    console.log('[AppInit] Session restored via refresh token');
  } catch {
    // Kein gültiges Refresh-Cookie vorhanden – Guard leitet zum Login weiter
    console.log('[AppInit] No active session, user needs to log in');
  }
}

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
    provideStore([AccountState, CategoriesState, TransactionPageState, TransactionCaptureState], {developmentMode: true}, withNgxsLoggerPlugin(), withNgxsReduxDevtoolsPlugin(), withNgxsRouterPlugin()),
    providePrimeNG({
      theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } }
    }),
    { provide: API_BASE_URL, useValue: 'http://localhost:4000' }, // z.B. 'https://api.example.com'
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      return initializeAuth(authService);
    })
  ]
};
