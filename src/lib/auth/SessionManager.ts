import { RedisStore } from "connect-redis";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import session, { SessionOptions } from "express-session";
import { createClient, RedisClientType } from "redis";
import { AuthConfig } from "./types";

/**
 * Session Manager with enhanced security features
 * Implements OWASP session management best practices
 */
export class SessionManager {
  private static redisClient: RedisClientType | null = null;
  private static config: AuthConfig["session"];

  /**
   * Initialize session manager
   */
  static async init(config: AuthConfig["session"]): Promise<void> {
    this.config = config;
    this.validateConfig(config);

    if (config.redis) {
      await this.initRedis(config.redis);
    }
  }

  /**
   * Validate session configuration
   */
  private static validateConfig(config: AuthConfig["session"]): void {
    if (!config.secret) {
      throw new Error("Session secret is required");
    }

    if (config.secret.length < 32) {
      console.warn("⚠️ Session secret should be at least 32 characters");
    }

    // Check for weak secrets in production
    if (process.env.NODE_ENV === "production") {
      const weakSecrets = ["secret", "session", "password", "123456"];
      if (
        weakSecrets.some((weak) => config.secret.toLowerCase().includes(weak))
      ) {
        console.warn("⚠️ Weak session secret detected in production");
      }
    }
  }

  /**
   * Initialize Redis connection with TLS support
   */
  private static async initRedis(
    redisConfig: NonNullable<AuthConfig["session"]["redis"]>
  ): Promise<void> {
    const url = redisConfig.tls
      ? `rediss://${redisConfig.password ? `:${redisConfig.password}@` : ""}${
          redisConfig.host
        }:${redisConfig.port}`
      : `redis://${redisConfig.password ? `:${redisConfig.password}@` : ""}${
          redisConfig.host
        }:${redisConfig.port}`;

    this.redisClient = createClient({
      url,
      database: redisConfig.db,
      socket: {
        connectTimeout: redisConfig.connectTimeout || 10000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error(
              "SessionManager: Max Redis reconnection attempts reached"
            );
            return new Error("Max reconnection attempts reached");
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.redisClient.on("error", (err) => {
      console.error("SessionManager Redis Error:", err);
    });

    this.redisClient.on("connect", () => {
      console.log("✓ SessionManager: Redis connected");
    });

    await this.redisClient.connect();
  }

  /**
   * Create session middleware with security enhancements
   */
  static createMiddleware(config: AuthConfig["session"]) {
    this.config = config;
    let store: session.Store | undefined;

    if (config.redis && this.redisClient) {
      store = new RedisStore({
        client: this.redisClient,
        prefix: config.redis.prefix || "arcanajs:sess:",
        ttl: Math.floor((config.maxAge || 7 * 24 * 60 * 60 * 1000) / 1000),
      });
    } else if (config.redis) {
      // Lazy initialization if Redis client wasn't pre-initialized
      const redisClient = createClient({
        url: `redis://${
          config.redis.password ? `:${config.redis.password}@` : ""
        }${config.redis.host}:${config.redis.port}`,
        database: config.redis.db,
      });

      redisClient.connect().catch((err) => {
        console.error("SessionManager: Failed to connect to Redis", err);
      });

      store = new RedisStore({
        client: redisClient,
        prefix: config.redis.prefix || "arcanajs:sess:",
        ttl: Math.floor((config.maxAge || 7 * 24 * 60 * 60 * 1000) / 1000),
      });
    }

    const isProduction = process.env.NODE_ENV === "production";

    const sessionOptions: SessionOptions = {
      store,
      name: config.name || "arcanajs.sid",
      secret: config.secret,
      resave: false,
      saveUninitialized: false,
      rolling: config.rolling || false,
      cookie: {
        secure: config.secure ?? isProduction,
        httpOnly: true,
        maxAge: config.maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: config.sameSite || "strict",
        // Domain should be set explicitly in production
        // domain: config.domain,
        path: "/",
      },
      // Generate cryptographically secure session IDs
      genid: () => this.generateSecureSessionId(),
    };

    return session(sessionOptions);
  }

  /**
   * Generate a cryptographically secure session ID
   */
  static generateSecureSessionId(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Regenerate session ID (for session fixation protection)
   * Call this after successful login
   */
  static async regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const oldSession = { ...req.session };

      req.session.regenerate((err) => {
        if (err) {
          reject(
            new SessionError(
              "Failed to regenerate session",
              "SESSION_REGENERATE_FAILED"
            )
          );
          return;
        }

        // Copy over user data to new session (except session metadata)
        Object.keys(oldSession).forEach((key) => {
          if (key !== "cookie" && key !== "id") {
            (req.session as any)[key] = (oldSession as any)[key];
          }
        });

        resolve();
      });
    });
  }

  /**
   * Destroy session completely (for logout)
   */
  static async destroySession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(
            new SessionError(
              "Failed to destroy session",
              "SESSION_DESTROY_FAILED"
            )
          );
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Middleware to check session validity and idle timeout
   */
  static checkSessionValidity(idleTimeout?: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.session) {
        return next();
      }

      const session = req.session as any;
      const now = Date.now();

      // Check idle timeout
      if (idleTimeout && session.lastActivity) {
        if (now - session.lastActivity > idleTimeout) {
          return SessionManager.destroySession(req)
            .then(() => {
              res.status(401).json({
                error: "Session expired due to inactivity",
                code: "SESSION_IDLE_TIMEOUT",
              });
            })
            .catch(next);
        }
      }

      // Update last activity
      session.lastActivity = now;

      next();
    };
  }

  /**
   * Middleware to enforce single session per user
   */
  static enforceSingleSession() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.session || !req.user) {
        return next();
      }

      const session = req.session as any;
      const userId = req.user.sub;

      // Store session ID associated with user
      // In a real implementation, you'd track this in Redis/DB
      if (session.userId && session.userId !== userId) {
        // Different user trying to use same session
        await SessionManager.destroySession(req);
        return res.status(401).json({
          error: "Session invalid",
          code: "SESSION_HIJACK_DETECTED",
        });
      }

      session.userId = userId;
      next();
    };
  }

  /**
   * Bind session to IP address (optional, can cause issues with mobile)
   */
  static bindToIP() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.session) {
        return next();
      }

      const session = req.session as any;
      const clientIP = this.getClientIP(req);

      if (!session.boundIP) {
        session.boundIP = clientIP;
      } else if (session.boundIP !== clientIP) {
        console.warn(
          `Session IP mismatch: expected ${session.boundIP}, got ${clientIP}`
        );
        // Optionally destroy session on IP change
        // This can be too strict for mobile users
      }

      next();
    };
  }

  /**
   * Get client IP address (handles proxies)
   */
  static getClientIP(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(",")[0];
      return ips.trim();
    }
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  /**
   * Create session fingerprint for additional validation
   */
  static createFingerprint(req: Request): string {
    const components = [
      req.headers["user-agent"] || "",
      req.headers["accept-language"] || "",
      req.headers["accept-encoding"] || "",
    ];

    return crypto
      .createHash("sha256")
      .update(components.join("|"))
      .digest("hex")
      .slice(0, 16);
  }

  /**
   * Middleware to validate session fingerprint
   */
  static validateFingerprint() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.session) {
        return next();
      }

      const session = req.session as any;
      const currentFingerprint = this.createFingerprint(req);

      if (!session.fingerprint) {
        session.fingerprint = currentFingerprint;
      } else if (session.fingerprint !== currentFingerprint) {
        console.warn("Session fingerprint mismatch detected");
        // Don't immediately destroy - could be browser update
        // Log for security monitoring
      }

      next();
    };
  }

  /**
   * Get all active sessions for a user (requires Redis)
   */
  static async getUserSessions(userId: string): Promise<string[]> {
    if (!this.redisClient) {
      throw new SessionError(
        "Redis required for session tracking",
        "REDIS_REQUIRED"
      );
    }

    const prefix = this.config?.redis?.prefix || "arcanajs:sess:";
    const keys = await this.redisClient.keys(`${prefix}*`);

    const userSessions: string[] = [];
    for (const key of keys) {
      const data = await this.redisClient.get(key);
      if (data) {
        try {
          const session = JSON.parse(data);
          if (session.userId === userId) {
            userSessions.push(key.replace(prefix, ""));
          }
        } catch {
          // Invalid session data
        }
      }
    }

    return userSessions;
  }

  /**
   * Invalidate all sessions for a user (requires Redis)
   */
  static async invalidateUserSessions(userId: string): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    const prefix = this.config?.redis?.prefix || "arcanajs:sess:";

    for (const sessionId of sessions) {
      await this.redisClient?.del(`${prefix}${sessionId}`);
    }

    return sessions.length;
  }

  /**
   * Close Redis connection gracefully
   */
  static async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }
}

/**
 * Custom Session Error class
 */
export class SessionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}
