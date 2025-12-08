import MiddlewareBinder from "../server/MiddlewareBinder";
import { ServiceProvider } from "../server/ServiceProvider";
import { JWTService } from "./JWTService";
import { AuthMiddleware } from "./middleware/AuthMiddleware";
import { SessionManager } from "./SessionManager";
import { AuthConfig } from "./types";
import { TokenBlacklist } from "./utils/TokenBlacklist";

/**
 * Authentication Service Provider
 *
 * Registers and bootstraps the authentication system
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

    try {
      // Initialize JWT Service
      JWTService.init(authConfig.jwt);
      console.log("✓ AuthProvider: JWT service initialized");

      // Initialize Token Blacklist
      await TokenBlacklist.init(
        authConfig.tokenBlacklist,
        authConfig.session.redis
      );
      console.log("✓ AuthProvider: Token blacklist initialized");

      // Register Session Middleware
      this.app.app.use(SessionManager.createMiddleware(authConfig.session));
      console.log("✓ AuthProvider: Session middleware registered");

      // Register Auth Middleware
      this.app.app.use(MiddlewareBinder.handle(AuthMiddleware));
      console.log("✓ AuthProvider: Auth middleware registered");

      // Register in container
      this.app.container.singleton("AuthConfig", () => authConfig!);

      console.log("✅ AuthProvider: Ready");
    } catch (error) {
      console.error("✗ AuthProvider: Initialization failed", error);
      throw error;
    }
  }

  async boot() {
    // Boot logic here if needed
  }
}
