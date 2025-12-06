import compression from "compression";
import cookieParser from "cookie-parser";
import express, { Express, RequestHandler } from "express";
import fs from "fs";
import helmet from "helmet";
import path from "path";
import React from "react";
import ErrorPage from "../shared/views/ErrorPage";
import NotFoundPage from "../shared/views/NotFoundPage";
import { createArcanaJSMiddleware } from "./ArcanaJSMiddleware";
import { createCsrfMiddleware } from "./CsrfMiddleware";
import { createDynamicRouter } from "./DynamicRouter";
import { responseHandler } from "./ResponseHandlerMiddleware";
import { dynamicRequire } from "./utils/dynamicRequire";

import { ServiceProvider } from "./support/ServiceProvider";

export interface ArcanaJSConfig {
  port?: number | string;
  views?: Record<string, React.FC<any>>;
  viewsDir?: string;
  viewsContext?: any;
  routes?: RequestHandler | RequestHandler[];
  /** API routes can be provided separately from web routes */
  apiRoutes?: RequestHandler | RequestHandler[];
  /** Base path under which API routes will be mounted (default: '/api') */
  apiBase?: string;
  staticDir?: string;
  distDir?: string;
  indexFile?: string;
  layout?: React.FC<any>;
  /** Automatically register SIGINT/SIGTERM handlers to call stop(). Default: true */
  autoHandleSignals?: boolean;
  /** Auth configuration */
  auth?: any;
  /** Mail configuration */
  mail?: any;
  /** Database configuration */
  database?: any;
  /** Service providers to load */
  providers?: (new (app: ArcanaJSServer) => ServiceProvider)[];
}

import { Container } from "./Container";

class ArcanaJSServer {
  public app: Express;
  public container: Container;
  private config: ArcanaJSConfig;
  private serverInstance?: import("http").Server;
  private _sigintHandler?: () => void;
  private _sigtermHandler?: () => void;
  private providers: ServiceProvider[] = [];

  private initialized = false;

  constructor(config: ArcanaJSConfig) {
    this.config = config;
    this.app = express();
    this.container = Container.getInstance();
    this.setupMiddleware();
  }

  private async initializeAsync() {
    if (this.initialized) return;

    await this.loadConfigurations();
    await this.registerProviders();
    await this.bootProviders();

    this.initialized = true;
  }

  private async loadConfigurations() {
    // Register configs passed via constructor
    if (this.config.auth) {
      this.container.singleton("AuthConfig", () => this.config.auth);
    }

    if (this.config.mail) {
      this.container.singleton("MailConfig", () => this.config.mail);
    }

    if (this.config.database) {
      this.container.singleton("DatabaseConfig", () => this.config.database);
    }
  }

  private async registerProviders() {
    if (this.config.providers) {
      for (const ProviderClass of this.config.providers) {
        const provider = new ProviderClass(this);
        await provider.register();
        this.providers.push(provider);
      }
    }
  }

  private async bootProviders() {
    for (const provider of this.providers) {
      await provider.boot();
    }
  }

  private setupMiddleware() {
    const {
      staticDir = "public",
      distDir = "dist/public",
      indexFile = "dist/public/index.html",
      views,
      viewsContext,
      routes,
      layout,
      apiRoutes,
      apiBase = "/api",
    } = this.config;

    const root = process.cwd();

    // 1. Resolve views once and in priority order
    let resolvedViews = views;
    if (!resolvedViews && viewsContext)
      resolvedViews = this.loadViewsFromContext(viewsContext);
    if (!resolvedViews) resolvedViews = this.loadViewsFromAlias();
    if (!resolvedViews) resolvedViews = this.discoverViews();
    if (!resolvedViews || Object.keys(resolvedViews).length === 0) {
      console.warn("No views found. Please check your views directory.");
      resolvedViews = {} as Record<string, React.FC<any>>;
    }
    resolvedViews.NotFoundPage = resolvedViews.NotFoundPage || NotFoundPage;
    resolvedViews.ErrorPage = resolvedViews.ErrorPage || ErrorPage;

    // Security headers
    this.app.use(helmet());
    this.app.use(cookieParser());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(createCsrfMiddleware());
    this.app.use(responseHandler);

    // Static files: resolve and dedupe paths, serve before compression to avoid recompressing static files
    const isProduction = process.env.NODE_ENV === "production";
    const staticOptions = { index: false, maxAge: isProduction ? "1y" : "0" };
    const staticPaths = [
      path.resolve(root, distDir),
      path.resolve(root, staticDir),
    ].filter((p, i, a) => a.indexOf(p) === i);
    for (const p of staticPaths) {
      this.app.use(express.static(p, staticOptions));
    }

    // Compression for dynamic responses (after static middleware)
    this.app.use(compression());

    // ArcanaJS Middleware
    this.app.use(
      createArcanaJSMiddleware({
        views: resolvedViews,
        indexFile: path.resolve(root, indexFile),
        layout,
      })
    );

    // Helper to mount arrays or single route objects
    const mount = (target: any, base?: string) => {
      if (!target) return;
      const items = Array.isArray(target) ? target : [target];
      for (const r of items) {
        if (!r) continue;
        if (typeof r.getRouter === "function") {
          this.app.use(base || "/", r.getRouter());
        } else {
          this.app.use(base || "/", r as RequestHandler);
        }
      }
    };

    try {
      mount(apiRoutes, apiBase);
      if (apiRoutes) console.log(`API routes mounted at ${apiBase}`);
    } catch (err) {
      console.error("Error mounting apiRoutes:", err);
    }

    try {
      mount(routes);
    } catch (err) {
      console.error("Error mounting routes:", err);
    }

    // Dynamic Router
    this.app.use(createDynamicRouter(resolvedViews));

    // 404 and error handlers
    this.app.use((req, res) => {
      if (req.get("X-ArcanaJS-Request") || req.query.format === "json") {
        res.status(404).json({
          page: "NotFoundPage",
          data: { url: req.url },
          params: {},
          csrfToken: res.locals.csrfToken,
        });
      } else {
        res.status(404).renderPage("NotFoundPage", { url: req.url });
      }
    });

    this.app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error(err);
        const message =
          process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message;
        if (req.get("X-ArcanaJS-Request") || req.query.format === "json") {
          res.status(500).json({
            page: "ErrorPage",
            data: { message },
            params: {},
            csrfToken: res.locals.csrfToken,
          });
        } else {
          res.status(500).renderPage("ErrorPage", { message });
        }
      }
    );
  }

  private loadViewsFromContext(context: any): Record<string, React.FC<any>> {
    const views: Record<string, React.FC<any>> = {};
    context.keys().forEach((key: string) => {
      const viewName = key.replace(/^\.\/(.*)\.tsx$/, "$1");
      views[viewName] = context(key).default;
    });
    return views;
  }

  private loadViewsFromAlias(): Record<string, React.FC<any>> | undefined {
    try {
      // @ts-ignore - This alias is injected by Webpack
      const injectedViews = require("arcana-views");
      if (injectedViews) {
        return this.loadViewsFromContext(injectedViews);
      }
    } catch (e) {
      // Ignore
    }
    return undefined;
  }

  private discoverViews(): Record<string, React.FC<any>> {
    const views: Record<string, React.FC<any>> = {};
    const viewsDir = this.config.viewsDir
      ? path.resolve(process.cwd(), this.config.viewsDir)
      : path.resolve(process.cwd(), "src/resources/views");

    if (!fs.existsSync(viewsDir)) return views;

    const traverse = (dir: string) => {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
          const relativePath = path.relative(viewsDir, fullPath);
          const viewName = relativePath.replace(/\.(tsx|jsx)$/, "");
          try {
            // Use __non_webpack_require__ if available to avoid Webpack bundling issues
            // or standard require if running in Node directly

            // Register ts-node if needed
            if (file.endsWith(".tsx") || file.endsWith(".ts")) {
              try {
                dynamicRequire("ts-node/register");
              } catch (e) {
                // Ignore
              }
            }

            const pageModule = dynamicRequire(fullPath);
            views[viewName] = pageModule.default || pageModule;
          } catch (error) {
            console.error(`Failed to load view ${viewName}:`, error);
          }
        }
      });
    };

    traverse(viewsDir);
    return views;
  }

  public async start() {
    // Initialize async components first
    await this.initializeAsync();

    const PORT = this.config.port || process.env.PORT || 3000;

    // Prevent multiple server instances
    if (this.serverInstance) {
      console.warn(
        "Server is already running. Call stop() before starting again."
      );
      return;
    }

    this.serverInstance = this.app.listen(PORT, () => {
      console.log(`✓ Server is running on http://localhost:${PORT}`);
    });

    // Handle server errors
    this.serverInstance.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.error(`✗ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error("✗ Server error:", error);
      }
    });

    // Optionally register process signal handlers per-instance to gracefully shutdown
    const autoHandle = this.config.autoHandleSignals !== false;
    if (autoHandle) {
      const shutdown = async (signal: string) => {
        console.log(`\n⚠ Received ${signal}, shutting down gracefully...`);
        try {
          await this.stop();
          console.log("✓ Shutdown complete");
          process.exit(0);
        } catch (err) {
          console.error("✗ Error during shutdown:", err);
          process.exit(1);
        }
      };

      this._sigintHandler = () => shutdown("SIGINT");
      this._sigtermHandler = () => shutdown("SIGTERM");

      process.on("SIGINT", this._sigintHandler);
      process.on("SIGTERM", this._sigtermHandler);

      console.log("✓ Signal handlers registered (Ctrl+C to stop)");
    }
  }

  /**
   * Stop the HTTP server and close DB connection if present.
   */
  public async stop(): Promise<void> {
    // Close HTTP server
    if (this.serverInstance) {
      console.log("⏳ Stopping HTTP server...");
      await new Promise<void>((resolve, reject) => {
        this.serverInstance!.close((err) => {
          if (err) {
            console.error("✗ Error closing HTTP server:", err);
            return reject(err);
          }
          resolve();
        });
      });
      this.serverInstance = undefined;
      console.log("✓ HTTP server stopped");
    } else {
      console.log("ℹ HTTP server is not running");
    }

    // Shutdown all providers
    if (this.providers.length > 0) {
      console.log("⏳ Shutting down providers...");
      for (const provider of this.providers) {
        if (provider.shutdown) {
          try {
            await provider.shutdown();
            console.log(`✓ ${provider.constructor.name} shut down`);
          } catch (err) {
            console.error(
              `✗ Error shutting down provider ${provider.constructor.name}:`,
              err
            );
          }
        }
      }
    }

    // Remove signal handlers registered by this instance
    try {
      if (this._sigintHandler) {
        process.removeListener("SIGINT", this._sigintHandler);
        this._sigintHandler = undefined;
      }
      if (this._sigtermHandler) {
        process.removeListener("SIGTERM", this._sigtermHandler);
        this._sigtermHandler = undefined;
      }
    } catch (err) {
      // ignore errors while removing listeners
    }
  }
}
export default ArcanaJSServer;
