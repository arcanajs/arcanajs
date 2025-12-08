/**
 * Authentication Configuration
 *
 * Configure your authentication settings here.
 * Supports JWT and Session-based authentication.
 */
import { AuthConfig } from "arcanajs/auth";

const authConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    algorithm: "HS256",
  },
  session: {
    secret: process.env.SESSION_SECRET || "your-session-secret",
    name: "arcanajs.sid",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === "production",
    redis: process.env.REDIS_HOST
      ? {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT || "6379"),
          password: process.env.REDIS_PASSWORD,
        }
      : undefined,
  },
  tokenBlacklist: {
    enabled: true,
    storage: process.env.REDIS_HOST ? "redis" : "memory",
  },
};

export default authConfig;
