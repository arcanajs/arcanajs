import compression from "compression";
import cookieParser from "cookie-parser";
import express, { Express, RequestHandler } from "express";
import fs from "fs";
import helmet from "helmet";
import path from "path";
import React from "react";
import { createArcanaJSMiddleware } from "./ArcanaJSMiddleware";
import { createCsrfMiddleware } from "./CsrfMiddleware";
import { createDynamicRouter } from "./DynamicRouter";
import { responseHandler } from "./ResponseHandlerMiddleware";

export interface ArcanaJSConfig {
  port?: number | string;
  views?: Record<string, React.FC<any>>;
  viewsDir?: string;
  viewsContext?: any;
  routes?: RequestHandler | RequestHandler[];
  staticDir?: string;
  distDir?: string;
  indexFile?: string;
  layout?: React.FC<any>;
}

export class ArcanaJSServer {
  public app: Express;
  private config: ArcanaJSConfig;

  constructor(config: ArcanaJSConfig) {
    this.config = config;
    this.app = express();
    this.initialize();
  }

  private initialize() {
    let {
      staticDir = "public",
      distDir = "dist/public",
      indexFile = "dist/public/index.html",
      views,
      viewsContext,
      routes,
      layout,
    } = this.config;

    if (!views && viewsContext) {
      views = {};
      viewsContext.keys().forEach((key: string) => {
        const viewName = key.replace(/^\.\/(.*)\.tsx$/, "$1");
        views![viewName] = viewsContext(key).default;
      });
    }

    if (!views) {
      // Try to load from injected alias (Webpack)
      try {
        // @ts-ignore - This alias is injected by Webpack
        const injectedViews = require("arcana-views");
        if (injectedViews) {
          views = {};
          injectedViews.keys().forEach((key: string) => {
            const viewName = key.replace(/^\.\/(.*)\.tsx$/, "$1");
            views![viewName] = injectedViews(key).default;
          });
        }
      } catch (e) {
        // Fallback to auto-discovery using fs (Server-side only, non-bundled)
        views = this.discoverViews();
      }
    }

    if (!views || Object.keys(views).length === 0) {
      console.warn("No views found. Please check your views directory.");
      views = {};
    }

    // Security and Performance
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
      })
    );
    this.app.use(compression());
    this.app.use(cookieParser());
    this.app.use(createCsrfMiddleware());
    this.app.use(responseHandler);

    // Static files
    this.app.use(
      express.static(path.resolve(process.cwd(), distDir), {
        index: false,
        maxAge: "1y",
      })
    );
    this.app.use(
      express.static(path.resolve(process.cwd(), staticDir), {
        index: false,
        maxAge: "1d",
      })
    );

    // ArcanaJS Middleware
    this.app.use(
      createArcanaJSMiddleware({
        views,
        indexFile: path.resolve(process.cwd(), indexFile),
        layout,
      })
    );

    // Custom Routes
    if (routes) {
      if (Array.isArray(routes)) {
        routes.forEach((route) => this.app.use(route));
      } else {
        this.app.use(routes);
      }
    }

    // Dynamic Router
    this.app.use(createDynamicRouter(views));

    // 404 Fallback
    this.app.use((req, res) => {
      res.status(404).renderPage("NotFoundPage");
    });

    // Error Handler
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
        res.status(500).renderPage("ErrorPage", { message });
      }
    );
  }

  private discoverViews(): Record<string, React.FC<any>> {
    const views: Record<string, React.FC<any>> = {};
    const viewsDir = this.config.viewsDir
      ? path.resolve(process.cwd(), this.config.viewsDir)
      : path.resolve(process.cwd(), "src/views");

    const traverse = (dir: string) => {
      if (!fs.existsSync(dir)) return;
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
                : module.require;

            // We need to register ts-node if we are requiring .tsx files directly
            // This is a simplified approach. In a real framework, we'd handle compilation.
            if (file.endsWith(".tsx") || file.endsWith(".ts")) {
              try {
                requireFunc("ts-node/register");
              } catch (e) {
                // Ignore if already registered or not found (might be pre-compiled)
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
    this.app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }
}
