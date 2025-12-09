import MiddlewareBinder from "../server/MiddlewareBinder";
import { ServiceProvider } from "../server/ServiceProvider";
import { JWTService } from "./JWTService";
import { AuthMiddleware } from "./middleware/AuthMiddleware";
import { SessionManager } from "./SessionManager";
import { AuthConfig } from "./types";
import { PasswordHasher } from "./utils/PasswordHasher";
import { RateLimiter } from "./utils/RateLimiter";
import { AuditLogger, SecurityHeaders } from "./utils/SecurityUtils";
import { TokenBlacklist } from "./utils/TokenBlacklist";

/**
 * Authentication Service Provider
 *
 * Registers and bootstraps the authentication system with
 * comprehensive security features including:
 * - JWT token management with refresh token rotation
 * - Session management with security hardening
 * - Password hashing with strength validation
 * - Rate limiting for brute force protection
 * - Security headers middleware
 * - Token blacklisting with family revocation
 * - Audit logging for security events
 */
export class AuthProvider extends ServiceProvider {
  async register() {
    console.log("⚙️  AuthProvider: Initializing...");

    // Get config from container (loaded by ArcanaJSServer)
    let authConfig: AuthConfig | undefined;

    try {
      authConfig = this.app.container.resolve<AuthConfig>("AuthConfig");
      console.log("✓ AuthProvider: Configuration loaded successfully");
    } catch (err) {
      console.warn("⚠ AuthProvider: No configuration found - Skipping setup");
      return;
    }

    if (!authConfig) {
      console.warn("⚠ AuthProvider: Configuration is empty - Skipping setup");
      return;
    }

    try {
      // Validate configuration security
      this.validateSecurityConfig(authConfig);

      // Initialize Password Hasher
      PasswordHasher.init(authConfig.password);
      console.log("✓ AuthProvider: Password hasher initialized");

      // Initialize JWT Service
      JWTService.init(authConfig.jwt);
      console.log("✓ AuthProvider: JWT service initialized");

      // Initialize Token Blacklist
      await TokenBlacklist.init(
        authConfig.tokenBlacklist,
        authConfig.session.redis
      );
      console.log("✓ AuthProvider: Token blacklist initialized");

      // Initialize Session Manager (if Redis is configured)
      if (authConfig.session.redis) {
        await SessionManager.init(authConfig.session);
      }

      // Initialize Rate Limiter (if Redis is configured)
      if (authConfig.security?.rateLimit?.enabled && authConfig.session.redis) {
        await RateLimiter.initRedis(authConfig.session.redis);
        console.log("✓ AuthProvider: Rate limiter initialized with Redis");
      }

      // Configure Audit Logger
      if (authConfig.security?.auditLogging) {
        AuditLogger.configure({ enabled: true });
        console.log("✓ AuthProvider: Audit logging enabled");
      }

      // Register Security Headers Middleware (first in chain)
      this.app.app.use(SecurityHeaders.middleware());
      console.log("✓ AuthProvider: Security headers middleware registered");

      // Register Session Middleware
      this.app.app.use(SessionManager.createMiddleware(authConfig.session));
      console.log("✓ AuthProvider: Session middleware registered");

      // Register Session Validation Middleware (if idle timeout configured)
      if (authConfig.session.idleTimeout) {
        this.app.app.use(
          SessionManager.checkSessionValidity(authConfig.session.idleTimeout)
        );
        console.log("✓ AuthProvider: Session idle timeout configured");
      }

      // Register Session Fingerprint Validation
      this.app.app.use(SessionManager.validateFingerprint());
      console.log("✓ AuthProvider: Session fingerprinting enabled");

      // Register Auth Middleware
      this.app.app.use(MiddlewareBinder.handle(AuthMiddleware));
      console.log("✓ AuthProvider: Auth middleware registered");

      // Register in container
      this.app.container.singleton("AuthConfig", () => authConfig);
      this.app.container.singleton("JWTService", () => JWTService);
      this.app.container.singleton("SessionManager", () => SessionManager);
      this.app.container.singleton("PasswordHasher", () => PasswordHasher);
      this.app.container.singleton("TokenBlacklist", () => TokenBlacklist);
      this.app.container.singleton("RateLimiter", () => RateLimiter);

      console.log("✅ AuthProvider: Ready");
    } catch (error) {
      console.error("✗ AuthProvider: Initialization failed", error);
      throw error;
    }
  }

  /**
   * Validate security configuration for best practices
   */
  private validateSecurityConfig(config: AuthConfig): void {
    const isProduction = process.env.NODE_ENV === "production";
    const warnings: string[] = [];

    // JWT secret validation
    if (config.jwt.secret) {
      if (config.jwt.secret.length < 32) {
        warnings.push("JWT secret should be at least 32 characters");
      }
      if (
        isProduction &&
        /^(secret|password|123|test)/i.test(config.jwt.secret)
      ) {
        warnings.push("Weak JWT secret detected in production");
      }
    }

    // Session secret validation
    if (config.session.secret.length < 32) {
      warnings.push("Session secret should be at least 32 characters");
    }

    // Cookie security in production
    if (isProduction) {
      if (config.session.secure === false) {
        warnings.push("Secure cookies should be enabled in production");
      }
      if (config.session.sameSite === "none") {
        warnings.push("SameSite=none is not recommended without specific need");
      }
    }

    // Rate limiting recommendation
    if (!config.security?.rateLimit?.enabled && isProduction) {
      warnings.push("Rate limiting is recommended for production");
    }

    // Token blacklist recommendation
    if (!config.tokenBlacklist?.enabled) {
      warnings.push("Token blacklisting is recommended for security");
    }

    // Log warnings
    if (warnings.length > 0) {
      console.warn("⚠️  AuthProvider Security Warnings:");
      warnings.forEach((w) => console.warn(`   - ${w}`));
    }
  }

  async boot() {
    // Boot logic here if needed
    // This runs after all providers are registered
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    try {
      await TokenBlacklist.shutdown();
      await SessionManager.close();
      await RateLimiter.shutdown();
      console.log("✓ AuthProvider: Shutdown complete");
    } catch (error) {
      console.error("✗ AuthProvider: Shutdown error", error);
    }
  }
}
