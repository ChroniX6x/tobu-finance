import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../services/auth.store';

/**
 * Auth Guard
 *
 * Implements requirement from spec §3:
 * - Check if user is authenticated (has valid access token)
 * - Redirect to login if not authenticated
 * - Preserve return URL for post-login redirect
 *
 * Usage: Add to route canActivate array
 * Example: { path: 'accounts', canActivate: [authGuard], ... }
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const isAuthenticated = authStore.isAuthenticated();

  if (!isAuthenticated) {
    console.log('[AuthGuard] User not authenticated, redirecting to login');

    // Redirect to login with return URL
    router.navigate(['/auth/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  console.log('[AuthGuard] User authenticated, allowing access');
  return true;
};

/**
 * Role Guard Factory
 *
 * Implements requirement from spec §3:
 * - Check if user has required role(s)
 * - Redirect to forbidden page if role missing
 * - Can be used with single role or array of roles (OR logic)
 *
 * Usage: Create guard with required roles
 * Example: canActivate: [roleGuard(['admin', 'moderator'])]
 */
export function roleGuard(requiredRoles: string | string[]): CanActivateFn {
  return (route, state) => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    // Ensure roles is array
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    // Check if user is authenticated first
    if (!authStore.isAuthenticated()) {
      console.log('[RoleGuard] User not authenticated, redirecting to login');
      router.navigate(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
      return false;
    }

    // Check if user has any of the required roles
    const hasRole = roles.some(role => authStore.hasRole(role));

    if (!hasRole) {
      console.log('[RoleGuard] User missing required roles:', roles);
      router.navigate(['/notfound'], {
        queryParams: { reason: 'forbidden' }
      });
      return false;
    }

    console.log('[RoleGuard] User has required role, allowing access');
    return true;
  };
}
