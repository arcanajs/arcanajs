export interface AuthConfig {
  jwt: {
    /** JWT signing secret - must be at least 32 characters for HS256, 64 for HS512 */
    secret: string;
    /** Public key for RS256/RS512 algorithms (PEM format) */
    publicKey?: string;
    /** Private key for RS256/RS512 algorithms (PEM format) */
    privateKey?: string;
    /** Access token expiry (default: 15m) */
    accessTokenExpiry?: string | number;
    /** Refresh token expiry (default: 7d) */
    refreshTokenExpiry?: string | number;
    /** Signing algorithm (default: HS256) */
    algorithm?: "HS256" | "HS384" | "HS512" | "RS256" | "RS384" | "RS512";
    /** Issuer claim for tokens */
    issuer?: string;
    /** Audience claim for tokens */
    audience?: string | string[];
    /** Enable token fingerprinting for additional security */
    enableFingerprint?: boolean;
    /** Maximum number of refresh tokens per user (default: 5) */
    maxRefreshTokensPerUser?: number;
  };
  session: {
    /** Session secret - must be at least 32 characters */
    secret: string;
    /** Session cookie name (default: arcanajs.sid) */
    name?: string;
    /** Session max age in milliseconds (default: 7 days) */
    maxAge?: number;
    /** Use secure cookies (default: true in production) */
    secure?: boolean;
    /** SameSite cookie attribute (default: strict) */
    sameSite?: "strict" | "lax" | "none";
    /** Enable session rotation on login (default: true) */
    rotateOnLogin?: boolean;
    /** Enable rolling sessions - extends expiry on activity (default: false) */
    rolling?: boolean;
    /** Session idle timeout in milliseconds */
    idleTimeout?: number;
    /** Redis configuration for distributed sessions */
    redis?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
      /** TLS/SSL connection */
      tls?: boolean;
      /** Connection timeout in milliseconds */
      connectTimeout?: number;
      /** Key prefix (default: arcanajs:sess:) */
      prefix?: string;
    };
  };
  tokenBlacklist?: {
    /** Enable token blacklisting (default: true) */
    enabled: boolean;
    /** Storage backend (default: memory) */
    storage: "memory" | "redis";
    /** Hash tokens before storing (recommended for security) */
    hashTokens?: boolean;
    /** Enable token family tracking for refresh token rotation */
    enableTokenFamilies?: boolean;
  };
  password?: {
    /** Minimum password length (default: 8) */
    minLength?: number;
    /** Maximum password length (default: 128) */
    maxLength?: number;
    /** Require uppercase characters */
    requireUppercase?: boolean;
    /** Require lowercase characters */
    requireLowercase?: boolean;
    /** Require numeric characters */
    requireNumbers?: boolean;
    /** Require special characters */
    requireSpecialChars?: boolean;
    /** Bcrypt salt rounds (default: 12) */
    saltRounds?: number;
    /** Optional pepper for additional security (server-side secret) */
    pepper?: string;
    /** Use Argon2 instead of bcrypt */
    useArgon2?: boolean;
    /** Argon2 options */
    argon2Options?: {
      memoryCost?: number;
      timeCost?: number;
      parallelism?: number;
    };
  };
  security?: {
    /** Enable rate limiting */
    rateLimit?: {
      enabled: boolean;
      /** Max attempts before lockout */
      maxAttempts?: number;
      /** Lockout duration in milliseconds */
      lockoutDuration?: number;
      /** Window size in milliseconds for counting attempts */
      windowSize?: number;
    };
    /** Allowed IP addresses (whitelist) */
    allowedIPs?: string[];
    /** Blocked IP addresses (blacklist) */
    blockedIPs?: string[];
    /** Enable brute force protection */
    bruteForceProtection?: boolean;
    /** Enable suspicious activity logging */
    auditLogging?: boolean;
    /** Maximum concurrent sessions per user */
    maxConcurrentSessions?: number;
  };
}
