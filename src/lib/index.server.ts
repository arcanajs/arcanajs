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
