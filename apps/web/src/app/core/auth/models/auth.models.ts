export type {User, LoginCredentials, RegisterData, AuthResponse, RefreshResponse} from '@tobu/contracts/auth';

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
