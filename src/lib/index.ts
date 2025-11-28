import { Express } from "express";
import ArcanaJSServer, { ArcanaJSConfig } from "./server/ArcanaJSServer";

// ============================================================================
// Component Exports
// ============================================================================

export { default as Body } from "./shared/components/Body";
export { default as Head } from "./shared/components/Head";
export { default as Link } from "./shared/components/Link";
export { default as NavLink } from "./shared/components/NavLink";
export { default as Page } from "./shared/components/Page";

// ============================================================================
// Client Exports
// ============================================================================

export { default as hydrateArcanaJS } from "./client/index";

// ============================================================================
// Hook Exports
// ============================================================================

export { default as useLocation } from "./shared/hooks/useLocation";
export { default as usePage } from "./shared/hooks/usePage";
export { default as useParams } from "./shared/hooks/useParams";
export { default as useQuery } from "./shared/hooks/useQuery";
export { default as useRouter } from "./shared/hooks/useRouter";

// ============================================================================
// Server Core Exports
// ============================================================================

export { default as ArcanaJSServer } from "./server/ArcanaJSServer";

export { Express, NextFunction, Request, Response } from "express";

// ============================================================================
// Routing Exports
// ============================================================================

export { default as Route } from "./server/Router";

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
 *   viewsDir: 'src/views',
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
