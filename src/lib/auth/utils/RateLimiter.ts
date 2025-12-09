import { NextFunction, Request, Response } from "express";
import { createClient, RedisClientType } from "redis";
import { AuthConfig, AuthErrorCode } from "../types";

/**
 * Rate Limiter Configuration
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxAttempts: number;
  /** Time window in milliseconds */
  windowSize: number;
  /** Lockout duration in milliseconds after max attempts */
  lockoutDuration: number;
  /** Key prefix for storage */
  keyPrefix?: string;
  /** Skip rate limiting for certain IPs (e.g., localhost) */
  skipIPs?: string[];
  /** Custom key generator function */
  keyGenerator?: (req: Request) => string;
  /** Custom response handler */
  onRateLimited?: (req: Request, res: Response, retryAfter: number) => void;
}

/**
 * Rate limit entry stored in memory/Redis
 */
interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

/**
 * Rate Limiter for protecting against brute force and DoS attacks
 * Supports both in-memory and Redis storage
 */
export class RateLimiter {
  private static memoryStore: Map<string, RateLimitEntry> = new Map();
  private static redisClient: RedisClientType | null = null;
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly DEFAULT_PREFIX = "arcanajs:ratelimit:";

  /**
   * Initialize Redis for distributed rate limiting
   */
  static async initRedis(
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
    });

    await this.redisClient.connect();
    console.log("✓ RateLimiter: Connected to Redis");
  }

  /**
   * Create rate limiting middleware
   */
  static middleware(config: RateLimitConfig) {
    const defaults: Partial<RateLimitConfig> = {
      maxAttempts: 5,
      windowSize: 15 * 60 * 1000, // 15 minutes
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      keyPrefix: this.DEFAULT_PREFIX,
      skipIPs: ["127.0.0.1", "::1"],
    };

    const settings = { ...defaults, ...config };

    // Start cleanup if using memory store
    if (!this.redisClient && !this.cleanupInterval) {
      this.startCleanup(settings.windowSize! + settings.lockoutDuration!);
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);

      // Skip rate limiting for allowed IPs
      if (settings.skipIPs?.includes(clientIP)) {
        return next();
      }

      const key = settings.keyGenerator
        ? settings.keyGenerator(req)
        : `${settings.keyPrefix}${clientIP}:${req.path}`;

      try {
        const result = await this.checkRateLimit(key, settings);

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", settings.maxAttempts!);
        res.setHeader(
          "X-RateLimit-Remaining",
          Math.max(0, settings.maxAttempts! - result.attempts)
        );
        res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000));

        if (result.isLimited) {
          const retryAfter = Math.ceil(result.retryAfter! / 1000);
          res.setHeader("Retry-After", retryAfter);

          if (settings.onRateLimited) {
            return settings.onRateLimited(req, res, retryAfter);
          }

          return res.status(429).json({
            success: false,
            error: "Too many requests. Please try again later.",
            code: AuthErrorCode.RATE_LIMITED,
            retryAfter,
            timestamp: new Date().toISOString(),
          });
        }

        next();
      } catch (err) {
        console.error("RateLimiter error:", err);
        // On error, allow the request (fail open)
        next();
      }
    };
  }

  /**
   * Check rate limit for a key
   */
  private static async checkRateLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{
    isLimited: boolean;
    attempts: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const now = Date.now();

    if (this.redisClient) {
      return this.checkRedisRateLimit(key, config, now);
    }

    return this.checkMemoryRateLimit(key, config, now);
  }

  /**
   * Check rate limit using Redis
   */
  private static async checkRedisRateLimit(
    key: string,
    config: RateLimitConfig,
    now: number
  ): Promise<{
    isLimited: boolean;
    attempts: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const data = await this.redisClient!.get(key);
    let entry: RateLimitEntry = data
      ? JSON.parse(data)
      : { attempts: 0, firstAttempt: now };

    // Check if locked
    if (entry.lockedUntil && entry.lockedUntil > now) {
      return {
        isLimited: true,
        attempts: entry.attempts,
        resetTime: entry.lockedUntil,
        retryAfter: entry.lockedUntil - now,
      };
    }

    // Reset if window has passed
    if (now - entry.firstAttempt > config.windowSize) {
      entry = { attempts: 0, firstAttempt: now };
    }

    // Increment attempts
    entry.attempts++;

    // Check if should lock
    if (entry.attempts > config.maxAttempts) {
      entry.lockedUntil = now + config.lockoutDuration;
      await this.redisClient!.set(key, JSON.stringify(entry), {
        EX: Math.ceil(config.lockoutDuration / 1000),
      });

      return {
        isLimited: true,
        attempts: entry.attempts,
        resetTime: entry.lockedUntil,
        retryAfter: config.lockoutDuration,
      };
    }

    // Save updated entry
    const ttl = Math.ceil(
      (config.windowSize - (now - entry.firstAttempt)) / 1000
    );
    await this.redisClient!.set(key, JSON.stringify(entry), { EX: ttl });

    return {
      isLimited: false,
      attempts: entry.attempts,
      resetTime: entry.firstAttempt + config.windowSize,
    };
  }

  /**
   * Check rate limit using memory store
   */
  private static checkMemoryRateLimit(
    key: string,
    config: RateLimitConfig,
    now: number
  ): {
    isLimited: boolean;
    attempts: number;
    resetTime: number;
    retryAfter?: number;
  } {
    let entry = this.memoryStore.get(key);

    // Check if locked
    if (entry?.lockedUntil && entry.lockedUntil > now) {
      return {
        isLimited: true,
        attempts: entry.attempts,
        resetTime: entry.lockedUntil,
        retryAfter: entry.lockedUntil - now,
      };
    }

    // Reset if window has passed or no entry
    if (!entry || now - entry.firstAttempt > config.windowSize) {
      entry = { attempts: 0, firstAttempt: now };
    }

    // Increment attempts
    entry.attempts++;

    // Check if should lock
    if (entry.attempts > config.maxAttempts) {
      entry.lockedUntil = now + config.lockoutDuration;
      this.memoryStore.set(key, entry);

      return {
        isLimited: true,
        attempts: entry.attempts,
        resetTime: entry.lockedUntil,
        retryAfter: config.lockoutDuration,
      };
    }

    this.memoryStore.set(key, entry);

    return {
      isLimited: false,
      attempts: entry.attempts,
      resetTime: entry.firstAttempt + config.windowSize,
    };
  }

  /**
   * Reset rate limit for a key
   */
  static async reset(key: string): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  /**
   * Reset rate limit for an IP
   */
  static async resetIP(ip: string, path?: string): Promise<void> {
    const key = path
      ? `${this.DEFAULT_PREFIX}${ip}:${path}`
      : `${this.DEFAULT_PREFIX}${ip}:*`;

    if (this.redisClient) {
      if (path) {
        await this.redisClient.del(key);
      } else {
        const keys = await this.redisClient.keys(key);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }
    } else {
      if (path) {
        this.memoryStore.delete(key);
      } else {
        for (const k of this.memoryStore.keys()) {
          if (k.startsWith(`${this.DEFAULT_PREFIX}${ip}:`)) {
            this.memoryStore.delete(k);
          }
        }
      }
    }
  }

  /**
   * Get client IP address
   */
  private static getClientIP(req: Request): string {
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
   * Start periodic cleanup of expired entries
   */
  private static startCleanup(maxAge: number): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryStore.entries()) {
        const expired = entry.lockedUntil
          ? now > entry.lockedUntil
          : now - entry.firstAttempt > maxAge;

        if (expired) {
          this.memoryStore.delete(key);
        }
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Shutdown and cleanup
   */
  static async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }

    this.memoryStore.clear();
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimiters = {
  /**
   * Strict limiter for login attempts
   */
  login: RateLimiter.middleware({
    maxAttempts: 5,
    windowSize: 15 * 60 * 1000, // 15 minutes
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    keyGenerator: (req) =>
      `arcanajs:ratelimit:login:${req.body?.email || req.ip}`,
  }),

  /**
   * Limiter for password reset requests
   */
  passwordReset: RateLimiter.middleware({
    maxAttempts: 3,
    windowSize: 60 * 60 * 1000, // 1 hour
    lockoutDuration: 60 * 60 * 1000, // 1 hour
    keyGenerator: (req) =>
      `arcanajs:ratelimit:reset:${req.body?.email || req.ip}`,
  }),

  /**
   * Limiter for registration
   */
  registration: RateLimiter.middleware({
    maxAttempts: 5,
    windowSize: 60 * 60 * 1000, // 1 hour
    lockoutDuration: 24 * 60 * 60 * 1000, // 24 hours
  }),

  /**
   * General API rate limiter
   */
  api: RateLimiter.middleware({
    maxAttempts: 100,
    windowSize: 60 * 1000, // 1 minute
    lockoutDuration: 60 * 1000, // 1 minute
  }),

  /**
   * Aggressive limiter for sensitive operations
   */
  sensitive: RateLimiter.middleware({
    maxAttempts: 3,
    windowSize: 60 * 60 * 1000, // 1 hour
    lockoutDuration: 24 * 60 * 60 * 1000, // 24 hours
  }),
};
