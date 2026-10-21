import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, map } from 'rxjs';
import { AuthStore } from './auth.store';
import {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  RefreshResponse,
  User,
  AuthError,
  AuthErrorType
} from '../models/auth.models';
import { API_BASE_URL } from '../../api-base-url.token';

/**
 * AuthService - Core authentication operations
 *
 * Implements requirements from spec §6:
 * - register, login, refresh, logout operations
 * - Token management via AuthStore
 * - No UI concerns (no navigation, no messages)
 * - withCredentials only for refresh and logout
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Register new user
   * POST /api/auth/register
   * Returns user object and stores access token
   */
  register(data: RegisterData): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/auth/register`, data, { withCredentials: true })
      .pipe(
        tap(response => {
          this.authStore.setAccessToken(response.accessToken);
          this.authStore.setUser(response.user);
          console.log('[AuthService] Registration successful');
        }),
        catchError(error => throwError(() => this.mapError(error))),
        tap(() => {}),
        map(response => response.user)
      );
  }

  /**
   * Login existing user
   * POST /api/auth/login
   * Returns user object and stores access token
   */
  login(credentials: LoginCredentials): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/api/auth/login`, credentials, { withCredentials: true })
      .pipe(
        tap(response => {
          this.authStore.setAccessToken(response.accessToken);
          this.authStore.setUser(response.user);
          console.log('[AuthService] Login successful');
        }),
        catchError(error => throwError(() => this.mapError(error))),
        tap(() => {}),
        map(response => response.user)
      );
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   * withCredentials: true (sends httpOnly refresh cookie)
   *
   * Implements single-flight refresh pattern (§5)
   */
  refresh(): Observable<string> {
    // Check if refresh already in flight
    const inFlight = this.authStore.getRefreshInFlight();
    if (inFlight) {
      return new Observable(subscriber => {
        inFlight
          .then(token => {
            subscriber.next(token);
            subscriber.complete();
          })
          .catch(err => subscriber.error(err));
      });
    }

    // Start new refresh request
    const refreshPromise = new Promise<string>((resolve, reject) => {
      this.http
        .post<RefreshResponse>(
          `${this.baseUrl}/api/auth/refresh`,
          {},
          { withCredentials: true } // CRITICAL: sends httpOnly cookie
        )
        .pipe(
          tap(response => {
            this.authStore.setAccessToken(response.accessToken);
            console.log('[AuthService] Token refreshed successfully');
          }),
          catchError(error => {
            console.warn('[AuthService] Refresh failed:', error);
            this.authStore.clearSession(); // Clear session on refresh failure
            return throwError(() => this.mapError(error));
          })
        )
        .subscribe({
          next: response => resolve(response.accessToken),
          error: err => reject(err)
        });
    });

    // Store promise for single-flight pattern
    this.authStore.setRefreshInFlight(refreshPromise);

    // Clean up after completion
    refreshPromise.finally(() => {
      this.authStore.setRefreshInFlight(null);
    });

    return new Observable(subscriber => {
      refreshPromise
        .then(token => {
          subscriber.next(token);
          subscriber.complete();
        })
        .catch(err => subscriber.error(err));
    });
  }

  /**
   * Logout user
   * POST /api/auth/logout
   * withCredentials: true (clears httpOnly refresh cookie)
   * Always clears local session regardless of response
   */
  logout(): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/api/auth/logout`,
        {},
        { withCredentials: true } // CRITICAL: sends httpOnly cookie
      )
      .pipe(
        catchError(error => {
          console.warn('[AuthService] Logout request failed, clearing session anyway:', error);
          return throwError(() => this.mapError(error));
        }),
        tap(() => {
          this.authStore.clearSession();
          console.log('[AuthService] Logout successful, session cleared');
        })
      );
  }

  /**
   * Get current access token (for interceptor)
   */
  getAccessToken(): string | null {
    return this.authStore.getAccessToken();
  }

  /**
   * Set access token (for interceptor after refresh)
   */
  setAccessToken(token: string | null): void {
    this.authStore.setAccessToken(token);
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.authStore.getUser();
  }

  /**
   * Map HTTP errors to domain-meaningful AuthError (§11)
   */
  private mapError(error: any): AuthError {
    const status = error?.status;

    if (status === 401) {
      return {
        type: AuthErrorType.AUTH_EXPIRED,
        message: 'Session expired. Please login again.',
        originalError: error
      };
    }

    if (status === 403) {
      return {
        type: AuthErrorType.AUTH_FORBIDDEN,
        message: 'Access denied. Insufficient permissions.',
        originalError: error
      };
    }

    if (status === 400) {
      // Check for field validation errors
      const fieldErrors = error?.error?.error?.fieldErrors;
      if (fieldErrors) {
        // Format field errors into readable message
        const errorMessages: string[] = [];
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (Array.isArray(messages) && messages.length > 0) {
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            errorMessages.push(`${fieldName}: ${messages.join(', ')}`);
          }
        }
        if (errorMessages.length > 0) {
          return {
            type: AuthErrorType.INVALID_CREDENTIALS,
            message: errorMessages.join('\n'),
            originalError: error
          };
        }
      }

      // Check for general credential errors
      if (error?.error?.message?.includes('credential')) {
        return {
          type: AuthErrorType.INVALID_CREDENTIALS,
          message: 'Invalid email or password.',
          originalError: error
        };
      }

      // Generic 400 error
      return {
        type: AuthErrorType.INVALID_CREDENTIALS,
        message: error?.error?.message || 'Invalid request. Please check your input.',
        originalError: error
      };
    }

    if (status === 0 || status >= 500) {
      return {
        type: AuthErrorType.NETWORK_ERROR,
        message: 'Network error. Please check your connection.',
        originalError: error
      };
    }

    return {
      type: AuthErrorType.UNKNOWN,
      message: error?.error?.message || 'An unexpected error occurred.',
      originalError: error
    };
  }
}
