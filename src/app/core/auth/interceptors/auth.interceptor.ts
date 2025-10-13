import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

/**
 * Auth HTTP Interceptor
 *
 * Implements requirements from spec §4:
 * - Attach Authorization header with access token for API requests
 * - Handle 401 errors with automatic token refresh
 * - Single-flight refresh pattern to prevent concurrent refresh calls
 * - Retry original request once after refresh
 * - Do NOT attach credentials except for refresh/logout
 *
 * Pattern: Functional interceptor (Angular 17+)
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Helper: Check if URL is an API endpoint
  const isApiEndpoint = (url: string): boolean => {
    return url.includes('/api/');
  };

  // Helper: Check if URL is an auth endpoint
  const isAuthEndpoint = (url: string): boolean => {
    return url.includes('/api/auth/');
  };

  // Step 1: Attach Authorization header for non-auth API requests
  let clonedReq = req;
  if (isApiEndpoint(req.url) && !isAuthEndpoint(req.url)) {
    const token = authService.getAccessToken();
    if (token) {
      clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
  }

  // Step 2: Execute request and handle errors
  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle 401 for non-auth endpoints
      if (error.status === 401 && !isAuthEndpoint(req.url)) {
        console.log('[AuthInterceptor] 401 detected, attempting refresh...');

        // Attempt refresh and retry
        return authService.refresh().pipe(
          switchMap(newToken => {
            console.log('[AuthInterceptor] Refresh successful, retrying request...');

            // Clone request with new token
            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`
              }
            });

            // Retry exactly once
            return next(retryReq);
          }),
          catchError(refreshError => {
            console.error('[AuthInterceptor] Refresh failed, clearing session:', refreshError);

            // Clear session and navigate to login
            authService.setAccessToken(null);
            router.navigate(['/auth/login'], {
              queryParams: { returnUrl: router.url, reason: 'session-expired' }
            });

            return throwError(() => refreshError);
          })
        );
      }

      // For all other errors, just propagate
      return throwError(() => error);
    })
  );
};
