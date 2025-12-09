/**
 * JWT Payload interface following RFC 7519 standards
 * with additional security claims
 */
export interface JWTPayload {
  /** Subject - User ID (required) */
  sub: string;
  /** User email address */
  email?: string;
  /** User roles for RBAC */
  roles?: string[];
  /** Fine-grained permissions */
  permissions?: string[];
  /** Issued at timestamp (auto-generated) */
  iat?: number;
  /** Expiration timestamp (auto-generated) */
  exp?: number;
  /** Not before timestamp */
  nbf?: number;
  /** JWT ID for revocation tracking (auto-generated) */
  jti?: string;
  /** Issuer identifier */
  iss?: string;
  /** Audience - intended recipient(s) */
  aud?: string | string[];
  /** Token type: access or refresh */
  type?: "access" | "refresh";
  /** Token family ID for refresh token rotation */
  tokenFamily?: string;
  /** Device/client fingerprint hash */
  fingerprint?: string;
  /** Session ID for session binding */
  sid?: string;
  /** IP address hash for additional validation */
  ipHash?: string;
  /** Token version for forced invalidation */
  tokenVersion?: number;
  /** Custom claims */
  [key: string]: any;
}

/**
 * Decoded token with metadata
 */
export interface DecodedToken extends JWTPayload {
  /** Raw token string */
  rawToken?: string;
  /** Whether token is close to expiry */
  isNearExpiry?: boolean;
  /** Remaining time in seconds */
  remainingTime?: number;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  /** Access token for API requests */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** Access token expiry timestamp */
  expiresAt: number;
  /** Token type (always "Bearer") */
  tokenType: "Bearer";
}
