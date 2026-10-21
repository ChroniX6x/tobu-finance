/**
 * Auth Models - Domain types for authentication
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  roles: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
}

/**
 * Auth error types for domain-meaningful error handling
 */
export enum AuthErrorType {
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface AuthError {
  type: AuthErrorType;
  message: string;
  originalError?: any;
}
