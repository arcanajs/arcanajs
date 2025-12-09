export * from "./AuthConfig";
export * from "./JWTPayload";

/**
 * Authentication result returned after successful login
 */
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email?: string;
    roles?: string[];
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
  error?: string;
  errorCode?: AuthErrorCode;
}

/**
 * Standard authentication error codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  TOKEN_REVOKED = "TOKEN_REVOKED",
  TOKEN_MALFORMED = "TOKEN_MALFORMED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SESSION_INVALID = "SESSION_INVALID",
  RATE_LIMITED = "RATE_LIMITED",
  IP_BLOCKED = "IP_BLOCKED",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  PASSWORD_WEAK = "PASSWORD_WEAK",
  PASSWORD_COMPROMISED = "PASSWORD_COMPROMISED",
  MFA_REQUIRED = "MFA_REQUIRED",
  MFA_INVALID = "MFA_INVALID",
}
