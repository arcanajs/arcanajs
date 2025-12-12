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

export { default as Route } from "./server/Router";

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
 * import { createArcanaServer } from 'arcanajs/server';
 *
 * const app = express();
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
