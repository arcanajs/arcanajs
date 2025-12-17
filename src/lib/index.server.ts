import { Express } from "express";
import ArcanaJSServer, { ArcanaJSConfig } from "./server/ArcanaJSServer";

// ============================================================================
// Server Core Exports
// ============================================================================

// Server
export { default as ArcanaJSServer } from "./server/ArcanaJSServer";
export type { ArcanaJSConfig } from "./server/ArcanaJSServer";

export { Express, NextFunction, Request, Response } from "express";

// ============================================================================
// Routing Exports
// ============================================================================

export {
  ArcanaJSRouter,
  default as Route,
  RouteBuilder,
  RouteRegistry,
} from "./server/Router";

// Dynamic router utilities
export {
  createDynamicRouter,
  generateViewUrl,
  getViewRoutes,
  matchPattern,
  matchRoute,
} from "./server/DynamicRouter";

// ============================================================================
// Universal Redirect (SSR + SPA)
// ============================================================================

export {
  getSSRContext,
  isRedirectError,
  navigateTo,
  permanentRedirect,
  redirect,
  RedirectError,
  setSSRContext,
  temporaryRedirect,
} from "./shared/utils/redirect";

// ============================================================================
// Middleware Exports
// ============================================================================

export type { Middleware } from "./validation/http/Middleware";

// ============================================================================
// SSR Context & Utilities (for server-side rendering)
// ============================================================================

// Request context for SSR
export {
  createRequestContext,
  getClientRequestContext,
  RequestContext,
  RequestContextProvider,
} from "./shared/context/RequestContext";
export type { RequestContextType } from "./shared/context/RequestContext";

// Router context for SSR
export {
  parseQueryString,
  RouterContext,
  RouterProvider,
  serializeQueryString,
} from "./shared/context/RouterContext";
export type {
  NavigateOptions,
  RouterContextType,
} from "./shared/context/RouterContext";

// Shared state for SSR
export {
  clearSharedState,
  getSharedState,
  setSharedState,
  SharedStateContext,
  SharedStateProvider,
} from "./shared/hooks/useState";

// Runtime config
export {
  getPublicRuntimeConfig,
  getRuntimeConfig,
  RuntimeConfigContext,
  setRuntimeConfig,
} from "./shared/hooks/useRuntimeConfig";
export type { RuntimeConfig } from "./shared/hooks/useRuntimeConfig";

// Error handling
export {
  clearGlobalError,
  createError,
  ErrorContext,
  getGlobalError,
  setGlobalError,
  showError,
} from "./shared/hooks/useError";
export type { ArcanaError } from "./shared/hooks/useError";

// ============================================================================
// Server Factory Function
// ============================================================================

/**
 * Create an ArcanaJS server with the given Express app
 *
 * @param app - Express application instance
 * @param config - Optional ArcanaJS configuration
 * @returns ArcanaJSServer instance
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createArcanaServer, Route } from 'arcanajs/server';
 *
 * const app = express();
 *
 * // Define routes with professional features
 * Route.get('/users/:id', [UserController, 'show'])
 *   .name('user.show')
 *   .whereNumber('id');
 *
 * // Redirects (SSR + SPA compatible)
 * Route.redirect('/old-path', '/new-path');
 *
 * // Generate URL from route name
 * const url = Route.urlFor('user.show', { id: 1 }); // '/users/1'
 *
 * // List all routes
 * Route.printRoutes();
 *
 * const server = createArcanaServer(app, {
 *   port: 3000,
 *   viewsDir: 'src/resources/views',
 * });
 *
 * server.start();
 * ```
 */
export function createArcanaServer(
  app: Express,
  config?: Partial<ArcanaJSConfig>
): ArcanaJSServer {
  const server = new ArcanaJSServer({ ...config });
  return server;
}
