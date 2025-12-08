import { ServiceProvider } from "../../server/ServiceProvider";
import { getAllInjectables } from "../decorators/metadata";
import { AutoDiscoveryConfig } from "../decorators/types";
import { ClassScanner } from "../support/ClassScanner";

export interface AutoRegisterConfig extends AutoDiscoveryConfig {
  directories: string[];
}

/**
 * Service provider that automatically discovers and registers
 * classes decorated with @Injectable, @Service, @Repository, or @Controller
 */
export class AutoRegisterProvider extends ServiceProvider {
  private config: AutoRegisterConfig;
  private scanner: ClassScanner;

  constructor(app: any, config: AutoRegisterConfig) {
    super(app);
    this.config = config;
    this.scanner = new ClassScanner();
  }

  async register(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const debug = this.config.debug || false;

    if (debug) {
      console.log("[AutoRegisterProvider] Starting auto-discovery...");
    }

    // First, try to get injectables from the global registry
    // (in case they were already imported elsewhere)
    let injectables = getAllInjectables();

    // If directories are specified, scan them for additional injectables
    if (this.config.directories && this.config.directories.length > 0) {
      const discovered = await this.scanner.scan({
        directories: this.config.directories,
        include: this.config.include,
        exclude: this.config.exclude,
        debug,
      });

      // Merge with existing injectables (avoid duplicates)
      const existingTargets = new Set(injectables.map((i) => i.target));
      for (const injectable of discovered) {
        if (!existingTargets.has(injectable.target)) {
          injectables.push(injectable);
        }
      }
    }

    if (injectables.length === 0) {
      if (debug) {
        console.warn(
          "[AutoRegisterProvider] No injectable classes found. Make sure your classes are decorated with @Injectable, @Service, @Repository, or @Controller."
        );
      }
      return;
    }

    // Register all discovered injectables
    let registeredCount = 0;
    for (const injectable of injectables) {
      try {
        const key = injectable.key || injectable.target;

        if (injectable.scope === "singleton") {
          this.app.container.singleton(key, injectable.target);
        } else {
          this.app.container.bind(key, injectable.target);
        }

        registeredCount++;

        if (debug) {
          console.log(
            `[AutoRegisterProvider] Registered ${injectable.target.name} as ${injectable.scope}`
          );
        }
      } catch (error) {
        console.error(
          `[AutoRegisterProvider] Failed to register ${injectable.target.name}:`,
          error
        );
      }
    }

    console.log(
      `✓ Auto-registered ${registeredCount} injectable class${
        registeredCount !== 1 ? "es" : ""
      }`
    );
  }

  async boot(): Promise<void> {
    // Nothing to do on boot
  }
}
