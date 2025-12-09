import crypto from "crypto";
import { createClient, RedisClientType } from "redis";
import { AuthConfig } from "../types";

/**
 * Token Blacklist for managing revoked tokens
 * Supports both in-memory and Redis storage with security enhancements
 */
export class TokenBlacklist {
  private static redisClient: RedisClientType | null = null;
  private static memoryStore: Map<string, TokenEntry> = new Map();
  private static familyStore: Map<string, number> = new Map(); // token family -> revocation timestamp
  private static config: AuthConfig["tokenBlacklist"];
  private static cleanupInterval: NodeJS.Timeout | null = null;

  private static readonly PREFIX_TOKEN = "arcanajs:blacklist:token:";
  private static readonly PREFIX_FAMILY = "arcanajs:blacklist:family:";
  private static readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  /**
   * Initialize the token blacklist
   */
  static async init(
    config: AuthConfig["tokenBlacklist"],
    redisConfig?: AuthConfig["session"]["redis"]
  ): Promise<void> {
    this.config = config;

    if (!config?.enabled) {
      console.log("TokenBlacklist: Disabled by configuration");
      return;
    }

    if (config?.storage === "redis" && redisConfig) {
      await this.initRedis(redisConfig);
    }

    // Start periodic cleanup for memory store
    if (config?.storage === "memory") {
      this.startCleanupTask();
    }

    console.log(`✓ TokenBlacklist: Initialized (${config.storage} storage)`);
  }

  /**
   * Initialize Redis connection
   */
  private static async initRedis(
    redisConfig: NonNullable<AuthConfig["session"]["redis"]>
  ): Promise<void> {
    try {
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
                "TokenBlacklist: Max Redis reconnection attempts reached"
              );
              // Fall back to memory store
              if (this.config) {
                this.config.storage = "memory";
                this.startCleanupTask();
              }
              return new Error("Max reconnection attempts reached");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.redisClient.on("error", (err) => {
        console.error("TokenBlacklist Redis Error:", err);
      });

      await this.redisClient.connect();
      console.log("✓ TokenBlacklist: Connected to Redis");
    } catch (err) {
      console.error("TokenBlacklist: Failed to connect to Redis", err);
      if (this.config) {
        this.config.storage = "memory";
        this.startCleanupTask();
      }
    }
  }

  /**
   * Start periodic cleanup task for memory store
   */
  private static startCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    // Ensure cleanup runs even if process exits
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => this.shutdown());
    }
  }

  /**
   * Clean up expired entries from memory store
   */
  private static cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt < now) {
        this.memoryStore.delete(key);
        cleaned++;
      }
    }

    // Also clean up family store
    for (const [family, timestamp] of this.familyStore.entries()) {
      // Keep family records for 30 days
      if (now - timestamp > 30 * 24 * 60 * 60 * 1000) {
        this.familyStore.delete(family);
      }
    }

    if (cleaned > 0) {
      console.log(`TokenBlacklist: Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Hash a token for storage (prevents token exposure in storage)
   */
  private static hashToken(token: string): string {
    if (!this.config?.hashTokens) {
      // If not hashing, still use a consistent key format
      return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")
        .slice(0, 32);
    }
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Add a token to the blacklist
   */
  static async add(
    token: string,
    expiresInSeconds: number,
    jti?: string
  ): Promise<void> {
    if (!this.config?.enabled) return;

    const tokenHash = this.hashToken(token);
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    if (this.config.storage === "redis" && this.redisClient) {
      try {
        await this.redisClient.set(
          `${this.PREFIX_TOKEN}${tokenHash}`,
          JSON.stringify({
            jti,
            revokedAt: Date.now(),
            expiresAt,
          }),
          { EX: expiresInSeconds }
        );
      } catch (err) {
        console.error("TokenBlacklist: Failed to add token to Redis", err);
        // Fall back to memory
        this.memoryStore.set(tokenHash, {
          expiresAt,
          jti,
          revokedAt: Date.now(),
        });
      }
    } else {
      this.memoryStore.set(tokenHash, {
        expiresAt,
        jti,
        revokedAt: Date.now(),
      });
    }
  }

  /**
   * Check if a token is revoked
   */
  static async isRevoked(token: string): Promise<boolean> {
    if (!this.config?.enabled) return false;

    const tokenHash = this.hashToken(token);

    if (this.config.storage === "redis" && this.redisClient) {
      try {
        const result = await this.redisClient.get(
          `${this.PREFIX_TOKEN}${tokenHash}`
        );
        return result !== null;
      } catch (err) {
        console.error("TokenBlacklist: Failed to check token in Redis", err);
        // Fall back to memory check
        return this.checkMemory(tokenHash);
      }
    }

    return this.checkMemory(tokenHash);
  }

  /**
   * Check memory store for token
   */
  private static checkMemory(tokenHash: string): boolean {
    const entry = this.memoryStore.get(tokenHash);
    if (!entry) return false;

    if (entry.expiresAt < Date.now()) {
      this.memoryStore.delete(tokenHash);
      return false;
    }

    return true;
  }

  /**
   * Revoke all tokens in a token family (for refresh token rotation attacks)
   */
  static async revokeFamily(tokenFamily: string): Promise<void> {
    if (!this.config?.enabled || !this.config?.enableTokenFamilies) return;

    const timestamp = Date.now();

    if (this.config.storage === "redis" && this.redisClient) {
      try {
        await this.redisClient.set(
          `${this.PREFIX_FAMILY}${tokenFamily}`,
          timestamp.toString(),
          { EX: 30 * 24 * 60 * 60 } // Keep for 30 days
        );
      } catch (err) {
        console.error("TokenBlacklist: Failed to revoke family in Redis", err);
        this.familyStore.set(tokenFamily, timestamp);
      }
    } else {
      this.familyStore.set(tokenFamily, timestamp);
    }

    console.log(
      `TokenBlacklist: Revoked token family ${tokenFamily.slice(0, 8)}...`
    );
  }

  /**
   * Check if a token family has been revoked
   */
  static async isFamilyRevoked(tokenFamily: string): Promise<boolean> {
    if (!this.config?.enabled || !this.config?.enableTokenFamilies)
      return false;

    if (this.config.storage === "redis" && this.redisClient) {
      try {
        const result = await this.redisClient.get(
          `${this.PREFIX_FAMILY}${tokenFamily}`
        );
        return result !== null;
      } catch (err) {
        console.error("TokenBlacklist: Failed to check family in Redis", err);
        return this.familyStore.has(tokenFamily);
      }
    }

    return this.familyStore.has(tokenFamily);
  }

  /**
   * Get blacklist statistics
   */
  static async getStats(): Promise<BlacklistStats> {
    if (this.config?.storage === "redis" && this.redisClient) {
      try {
        const tokenKeys = await this.redisClient.keys(`${this.PREFIX_TOKEN}*`);
        const familyKeys = await this.redisClient.keys(
          `${this.PREFIX_FAMILY}*`
        );
        return {
          revokedTokens: tokenKeys.length,
          revokedFamilies: familyKeys.length,
          storage: "redis",
        };
      } catch {
        // Fall through to memory stats
      }
    }

    return {
      revokedTokens: this.memoryStore.size,
      revokedFamilies: this.familyStore.size,
      storage: "memory",
    };
  }

  /**
   * Clear all blacklist entries (for testing)
   */
  static async clear(): Promise<void> {
    this.memoryStore.clear();
    this.familyStore.clear();

    if (this.redisClient) {
      try {
        const tokenKeys = await this.redisClient.keys(`${this.PREFIX_TOKEN}*`);
        const familyKeys = await this.redisClient.keys(
          `${this.PREFIX_FAMILY}*`
        );
        const allKeys = [...tokenKeys, ...familyKeys];

        if (allKeys.length > 0) {
          await this.redisClient.del(allKeys);
        }
      } catch (err) {
        console.error("TokenBlacklist: Failed to clear Redis", err);
      }
    }
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
    this.familyStore.clear();
  }
}

/**
 * Token entry stored in blacklist
 */
interface TokenEntry {
  expiresAt: number;
  jti?: string;
  revokedAt: number;
}

/**
 * Blacklist statistics
 */
interface BlacklistStats {
  revokedTokens: number;
  revokedFamilies: number;
  storage: "memory" | "redis";
}
