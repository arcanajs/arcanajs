import fs from "fs";
import path from "path";
import React from "react";
import { ModuleLoader } from "../../../utils/ModuleLoader";
import ErrorPage from "../../shared/views/ErrorPage";
import NotFoundPage from "../../shared/views/NotFoundPage";
import { ArcanaJSConfig, ResolvedViews } from "../config/types";

/**
 * Resolves and loads view components from various sources
 */
export class ViewsResolver {
  private config: ArcanaJSConfig;

  constructor(config: ArcanaJSConfig) {
    this.config = config;
  }

  /**
   * Resolve views from all possible sources in priority order
   */
  public resolve(): ResolvedViews {
    let resolvedViews = this.config.views;

    // Try loading from context
    if (!resolvedViews && this.config.viewsContext) {
      resolvedViews = this.loadFromContext(this.config.viewsContext);
    }

    // Try loading from alias
    if (!resolvedViews) {
      resolvedViews = this.loadFromAlias();
    }

    // Try discovering views
    if (!resolvedViews) {
      resolvedViews = this.discoverViews();
    }

    // Warn if no views found
    if (!resolvedViews || Object.keys(resolvedViews).length === 0) {
      console.warn("No views found. Please check your views directory.");
      resolvedViews = {} as Record<string, React.FC<any>>;
    }

    // Add default pages
    return {
      ...resolvedViews,
      NotFoundPage: resolvedViews.NotFoundPage || NotFoundPage,
      ErrorPage: resolvedViews.ErrorPage || ErrorPage,
    } as ResolvedViews;
  }

  /**
   * Load views from a webpack context
   */
  private loadFromContext(context: any): Record<string, React.FC<any>> {
    const views: Record<string, React.FC<any>> = {};
    context.keys().forEach((key: string) => {
      const viewName = key.replace(/^\.\/(.*)\.tsx$/, "$1");
      views[viewName] = context(key).default;
    });
    return views;
  }

  /**
   * Load views from webpack alias
   */
  private loadFromAlias(): Record<string, React.FC<any>> | undefined {
    try {
      // @ts-ignore - This alias is injected by Webpack
      const injectedViews = require("arcanajs-views");
      if (injectedViews) {
        return this.loadFromContext(injectedViews);
      }
    } catch (e) {
      // Alias not available
    }
    return undefined;
  }

  /**
   * Discover views by scanning the views directory
   */
  private discoverViews(): Record<string, React.FC<any>> {
    const views: Record<string, React.FC<any>> = {};
    const viewsDir = this.config.viewsDir
      ? path.resolve(process.cwd(), this.config.viewsDir)
      : path.resolve(process.cwd(), "src/resources/views");

    if (!fs.existsSync(viewsDir)) {
      return views;
    }

    this.traverseDirectory(viewsDir, viewsDir, views);
    return views;
  }

  /**
   * Recursively traverse a directory to find view files
   */
  private traverseDirectory(
    dir: string,
    baseDir: string,
    views: Record<string, React.FC<any>>
  ): void {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.traverseDirectory(fullPath, baseDir, views);
      } else if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
        this.loadViewFile(fullPath, baseDir, views);
      }
    });
  }

  /**
   * Load a single view file
   */
  private loadViewFile(
    fullPath: string,
    baseDir: string,
    views: Record<string, React.FC<any>>
  ): void {
    const relativePath = path.relative(baseDir, fullPath);
    const viewName = relativePath.replace(/\.(tsx|jsx)$/, "");

    try {
      // Register ts-node if needed for TypeScript files
      if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
        ModuleLoader.registerTsNode();
      }

      const pageModule = ModuleLoader.require(fullPath);
      views[viewName] = pageModule.default || pageModule;
    } catch (error) {
      console.error(`Failed to load view ${viewName}:`, error);
    }
  }
}
