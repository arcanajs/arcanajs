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

    // 1. Load views from config or context (highest priority)
    if (!views && viewsContext) {
      views = this.loadViewsFromContext(viewsContext);
    }

    // 2. Load views from injected alias (Webpack)
    if (!views) {
      views = this.loadViewsFromAlias();
    }

    // 3. Fallback to auto-discovery (Server-side only, non-bundled)
    if (!views) {
      views = this.discoverViews();
    }

    if (!views || Object.keys(views).length === 0) {
      console.warn("No views found. Please check your views directory.");
      views = {};
    }

    // Add default error views if not already present
    views.NotFoundPage = views.NotFoundPage || NotFoundPage;
    views.ErrorPage = views.ErrorPage || ErrorPage;

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
    const isProduction = process.env.NODE_ENV === "production";
    const staticOptions = {
      index: false,
      maxAge: isProduction ? "1y" : "0",
    };

    this.app.use(
      express.static(path.resolve(process.cwd(), distDir), staticOptions)
    );
    this.app.use(
      express.static(path.resolve(process.cwd(), staticDir), staticOptions)
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
    this.app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }
}
