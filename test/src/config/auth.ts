/**
 * Authentication Configuration
 *
 * Configure your authentication settings here.
 * Supports JWT and Session-based authentication with comprehensive security features.
 */
import { AuthConfig } from "arcanajs/auth";

const authConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || "your-super-secret-key-min-32-chars!",
    // For RSA algorithms (RS256/RS512), use:
    // publicKey: process.env.JWT_PUBLIC_KEY,
    // privateKey: process.env.JWT_PRIVATE_KEY,
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    algorithm: "HS256",
    issuer: "arcanajs",
    audience: "arcanajs-app",
    enableFingerprint: true,
    maxRefreshTokensPerUser: 5,
  },
  session: {
    secret: process.env.SESSION_SECRET || "your-session-secret-min-32-chars!",
    name: "arcanajs.sid",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    rotateOnLogin: true,
    rolling: false,
    idleTimeout: 30 * 60 * 1000, // 30 minutes idle timeout
    redis: process.env.REDIS_HOST
      ? {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
          db: 0,
          tls: process.env.REDIS_TLS === "true",
          connectTimeout: 10000,
          prefix: "arcanajs:sess:",
        }
      : undefined,
  },
  tokenBlacklist: {
    enabled: true,
    storage: process.env.REDIS_HOST ? "redis" : "memory",
    hashTokens: true,
    enableTokenFamilies: true,
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    saltRounds: 12,
    pepper: process.env.PASSWORD_PEPPER,
    useArgon2: false,
  },
  security: {
    rateLimit: {
      enabled: true,
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      windowSize: 15 * 60 * 1000, // 15 minutes
    },
    allowedIPs: [], // Empty = allow all
    blockedIPs: [],
    bruteForceProtection: true,
    auditLogging: process.env.NODE_ENV === "production",
    maxConcurrentSessions: 5,
  },
};

export default authConfig;
