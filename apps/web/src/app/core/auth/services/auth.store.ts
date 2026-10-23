import { Injectable, signal, computed } from '@angular/core';
import { User } from '../models/auth.models';

/**
 * AuthStore - Signal-based authentication state management
 * Stores ONLY in-memory (no persistence of access token)
 *
 * Requirements from spec:
 * - Access token in memory only (never persisted)
 * - User object cached in memory (optionally in SessionStorage without token)
 * - Provides reactive signals for UI binding
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  // Private signals for internal state
  private readonly _accessToken = signal<string | null>(null);
  private readonly _user = signal<User | null>(null);
  private readonly _refreshInFlight = signal<Promise<string> | null>(null);

  // Public computed signals for reactive UI
  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());
  readonly roles = computed(() => this._user()?.roles ?? []);

  /**
   * Get current access token (for interceptor use)
   */
  getAccessToken(): string | null {
    return this._accessToken();
  }

  /**
   * Set access token (used by interceptor after refresh)
   */
  setAccessToken(token: string | null): void {
    this._accessToken.set(token);
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this._user();
  }

  /**
   * Set user (after login/register)
   */
  setUser(user: User | null): void {
    this._user.set(user);

    // Optional: persist user (without token) to SessionStorage for page refresh
    if (user) {
      try {
        sessionStorage.setItem('user', JSON.stringify(user));
      } catch (e) {
        console.warn('Failed to persist user to SessionStorage:', e);
      }
    } else {
      sessionStorage.removeItem('user');
    }
  }

  /**
   * Get/Set refresh in-flight promise (for single-flight refresh)
   */
  getRefreshInFlight(): Promise<string> | null {
    return this._refreshInFlight();
  }

  setRefreshInFlight(promise: Promise<string> | null): void {
    this._refreshInFlight.set(promise);
  }

  /**
   * Clear entire session (used on logout or auth failure)
   */
  clearSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
    this._refreshInFlight.set(null);
    sessionStorage.removeItem('user');
  }

  /**
   * Initialize store (e.g., restore user from SessionStorage on app start)
   * Note: Access token is NEVER restored from storage
   */
  initialize(): void {
    try {
      const userJson = sessionStorage.getItem('user');
      if (userJson) {
        const user = JSON.parse(userJson) as User;
        this._user.set(user);
      }
    } catch (e) {
      console.warn('Failed to restore user from SessionStorage:', e);
    }
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }
}
