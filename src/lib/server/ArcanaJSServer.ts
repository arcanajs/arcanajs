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
import { Router as ArcanaRouter } from "./Router";

export interface ArcanaJSConfig<TDb = any> {
  port?: number | string;
  views?: Record<string, React.FC<any>>;
  viewsDir?: string;
  viewsContext?: any;
  routes?: RequestHandler | RequestHandler[] | ArcanaRouter | ArcanaRouter[];
  /** API routes can be provided separately from web routes */
  apiRoutes?: RequestHandler | RequestHandler[] | ArcanaRouter | ArcanaRouter[];
  /** Base path under which API routes will be mounted (default: '/api') */
  apiBase?: string;
  staticDir?: string;
  distDir?: string;
  indexFile?: string;
  layout?: React.FC<any>;
  /** Optional function to establish a DB connection. Should return a Promise resolving to the DB client/connection. */
  dbConnect?: () => Promise<TDb> | TDb;
  /** Automatically register SIGINT/SIGTERM handlers to call stop(). Default: true */
  autoHandleSignals?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Normalized DB object optionally attached to the request by ArcanaJSServer.
       * It may be either the raw client, or an object like `{ client, db, close }`.
       */
      db?: any;
    }
  }
}

export class ArcanaJSServer<TDb = any> {
  public app: Express;
  private config: ArcanaJSConfig<TDb>;
  private serverInstance?: import("http").Server;
  private _sigintHandler?: () => void;
  private _sigtermHandler?: () => void;

  constructor(config: ArcanaJSConfig<TDb>) {
    this.config = config;
    this.app = express();
    this.initialize();
  }

  /**
   * Normalize different DB client shapes into a single object exposing:
   * { client?: any, db?: any, close: async () => void }
   */
  private normalizeDb(obj: any): any {
    if (!obj) return obj;

    // If already normalized (has close function), return as-is
    if (typeof obj.close === "function") {
      return obj;
    }

    // Mongoose instance
    if (typeof obj.disconnect === "function") {
      return {
        client: obj,
        close: async () => {
          await obj.disconnect();
        },
      };
    }

    // If object contains { client, db }
    if (obj.client && obj.db) {
      const client = obj.client;
      return {
        client,
        db: obj.db,
        close: async () => {
          if (client && typeof client.close === "function") {
            await client.close();
          } else if (client && typeof client.disconnect === "function") {
            await client.disconnect();
          } else {
            throw new Error("No close method on client");
          }
        },
      };
    }

    // Native MongoClient instance
    if (obj && typeof obj.close === "function" && obj.connect) {
      return {
        client: obj,
        close: async () => {
          await obj.close();
        },
      };
    }

    // Pg/mysql client with end()/query()
    if (typeof obj.end === "function" || typeof obj.query === "function") {
      return {
        client: obj,
        close: async () => {
          if (typeof obj.end === "function") {
            await obj.end();
          } else if (typeof obj.close === "function") {
            await obj.close();
          } else {
            throw new Error("No close/end method on SQL client");
          }
        },
      };
    }

    // Try internal mongo client path { s: { client } }
    if (obj.s && obj.s.client && typeof obj.s.client.close === "function") {
      return {
        client: obj.s.client,
        db: obj,
        close: async () => {
          await obj.s.client.close();
        },
      };
    }

    // Fallback: wrap with a close that throws to surface the issue
    return {
      client: obj,
      close: async () => {
        throw new Error("No known close method on DB client");
      },
    };
  }

  private initialize() {
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
    this.app.use(helmet({ contentSecurityPolicy: false }));
    this.app.use(cookieParser());
    this.app.use(createCsrfMiddleware());
    this.app.use(responseHandler);

    // Expose `req.db` for convenience
    this.app.use(
      (
        req: express.Request,
        _res: express.Response,
        next: express.NextFunction
      ) => {
        req.db = this.app.locals.db;
        next();
      }
    );

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

    // Establish DB connection if provided (normalize eagerly where possible)
    if (this.config.dbConnect) {
      try {
        const maybe = this.config.dbConnect();
        const handleDb = (db: any) => {
          try {
            this.app.locals.db = this.normalizeDb(db) || db;
            console.log("Database connection attached to app.locals.db");
          } catch (e) {
            this.app.locals.db = db;
            console.warn(
              "DB connection attached without full normalization",
              e
            );
          }
        };

        if (
          maybe &&
          (maybe as any).then &&
          typeof (maybe as any).then === "function"
        ) {
          (maybe as Promise<any>)
            .then(handleDb)
            .catch((err: any) =>
              console.error("Error establishing DB connection:", err)
            );
        } else {
          handleDb(maybe);
        }
      } catch (err) {
        console.error("Error calling dbConnect:", err);
      }
    }

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
          data: {},
          params: {},
          csrfToken: res.locals.csrfToken,
        });
      } else {
        res.status(404).renderPage("NotFoundPage");
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
      : path.resolve(process.cwd(), "src/views");

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
            const requireFunc =
              typeof __non_webpack_require__ !== "undefined"
                ? __non_webpack_require__
                : eval("require");

            // Register ts-node if needed
            if (file.endsWith(".tsx") || file.endsWith(".ts")) {
              try {
                requireFunc("ts-node/register");
              } catch (e) {
                // Ignore
              }
            }

            const pageModule = requireFunc(fullPath);
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

  public start() {
    const PORT = this.config.port || process.env.PORT || 3000;
    this.serverInstance = this.app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });

    // Optionally register process signal handlers per-instance to gracefully shutdown
    const autoHandle = this.config.autoHandleSignals !== false;
    if (autoHandle) {
      const shutdown = async () => {
        try {
          await this.stop();
          process.exit(0);
        } catch (err) {
          console.error("Error during shutdown:", err);
          process.exit(1);
        }
      };
      this._sigintHandler = shutdown;
      this._sigtermHandler = shutdown;
      process.on("SIGINT", this._sigintHandler);
      process.on("SIGTERM", this._sigtermHandler);
    }
  }

  /**
   * Stop the HTTP server and close DB connection if present.
   */
  public async stop(): Promise<void> {
    // Close HTTP server
    if (this.serverInstance) {
      await new Promise<void>((resolve, reject) => {
        this.serverInstance!.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      this.serverInstance = undefined;
      console.log("HTTP server stopped");
    }

    // Close DB connection if attached to app.locals.db
    const db = this.app.locals.db as TDb | undefined;
    if (db) {
      let closed = false;
      // Try mongoose.disconnect()
      try {
        if (typeof (db as any).disconnect === "function") {
          await (db as any).disconnect();
          closed = true;
          console.log("Database connection closed via disconnect().");
        }
      } catch (err) {
        console.error("Error calling disconnect() on DB client:", err);
      }

      // Try db.close()
      if (!closed) {
        try {
          if (typeof (db as any).close === "function") {
            await (db as any).close();
            closed = true;
            console.log("Database connection closed via close().");
          }
        } catch (err) {
          console.error("Error calling close() on DB client:", err);
        }
      }

      // Try db.end()
      if (!closed) {
        try {
          if (typeof (db as any).end === "function") {
            await (db as any).end();
            closed = true;
            console.log("Database connection closed via end().");
          }
        } catch (err) {
          console.error("Error calling end() on DB client:", err);
        }
      }

      // Try db.client?.close()
      if (!closed) {
        try {
          const clientClose = (db as any).client && (db as any).client.close;
          if (clientClose && typeof clientClose === "function") {
            await (db as any).client.close();
            closed = true;
            console.log("Database connection closed via db.client.close().");
          }
        } catch (err) {
          console.error("Error calling db.client.close() on DB client:", err);
        }
      }

      // Try db.s?.client?.close() (internal Mongo client path)
      if (!closed) {
        try {
          const maybeInternal =
            (db as any).s && (db as any).s.client && (db as any).s.client.close;
          if (maybeInternal && typeof maybeInternal === "function") {
            await (db as any).s.client.close();
            closed = true;
            console.log("Database connection closed via db.s.client.close().");
          }
        } catch (err) {
          console.error("Error calling db.s.client.close() on DB client:", err);
        }
      }

      if (!closed) {
        console.warn(
          "Could not find a supported close method on the DB client; connection may remain open."
        );
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
