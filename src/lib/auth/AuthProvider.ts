import fs from "fs";
import path from "path";
import MiddlewareBinder from "../server/MiddlewareBinder";
import { ServiceProvider } from "../server/support/ServiceProvider";
import { dynamicRequireSync } from "../server/utils/dynamicRequire";
import { JWTService } from "./JWTService";
import { AuthMiddleware } from "./middleware/AuthMiddleware";
import { SessionManager } from "./SessionManager";
import { AuthConfig } from "./types";
import { TokenBlacklist } from "./utils/TokenBlacklist";

export class AuthProvider extends ServiceProvider {
  async register() {
    let authConfig: AuthConfig | undefined;

    // Try multiple possible config paths
    const possiblePaths = [
      path.resolve(process.cwd(), "dist/config/auth.js"),
      path.resolve(process.cwd(), "dist/config/auth.ts"),
      path.resolve(process.cwd(), "src/config/auth.ts"),
      path.resolve(process.cwd(), "src/config/auth.js"),
    ];

    let configLoaded = false;
    for (const configPath of possiblePaths) {
      // Check if file exists before trying to load it
      if (!fs.existsSync(configPath)) {
        continue;
      }

      try {
        const required = dynamicRequireSync(configPath);
        authConfig = required.default || required.authConfig || required;
        configLoaded = true;
        break;
      } catch (err) {
        // Try next path
        console.warn(`Failed to load auth config from ${configPath}:`, err);
        continue;
      }
    }

    if (!configLoaded) {
      console.warn("No auth config found. Skipping auth setup.");
      console.warn("Tried paths:", possiblePaths);
      return;
    }

    // At this point, authConfig is guaranteed to be defined

    // Initialize Services
    JWTService.init(authConfig!.jwt);
    await TokenBlacklist.init(
      authConfig!.tokenBlacklist,
      authConfig!.session.redis
    );

    // Register Session Middleware
    this.app.app.use(SessionManager.createMiddleware(authConfig!.session));

    // Register Auth Middleware
    this.app.app.use(MiddlewareBinder.handle(AuthMiddleware));

    // Register in container
    this.app.container.singleton("AuthConfig", () => authConfig!);
  }

  async boot() {
    //
  }
}
