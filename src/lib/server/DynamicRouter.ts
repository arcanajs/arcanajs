import { NextFunction, Request, Response } from "express";

/**
 * Represents matched parameters from dynamic routing
 */
interface RouteMatch {
  viewName: string;
  params: Record<string, string>;
}

/**
 * Match a request path against view patterns
 * Supports:
 * - Exact matches: 'users' matches '/users'
 * - Dynamic segments: 'users/[id]' matches '/users/123'
 * - Catch-all segments: 'docs/[...slug]' matches '/docs/a/b/c'
 * - Optional catch-all: 'docs/[[...slug]]' matches '/docs' and '/docs/a/b/c'
 */
function matchRoute(
  views: Record<string, any>,
  path: string
): RouteMatch | null {
  // Handle root path
  if (path === "") {
    path = "index";
  }

  // 1. Try exact match first
  if (views[path]) {
    return { viewName: path, params: {} };
  }

  // 2. Try dynamic and catch-all matches
  for (const viewName of Object.keys(views)) {
    const match = matchPattern(viewName, path);
    if (match) {
      return { viewName, params: match };
    }
  }

  return null;
}

/**
 * Match a single pattern against a path
 * Returns params object if matched, null otherwise
 */
function matchPattern(
  pattern: string,
  path: string
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  const params: Record<string, string> = {};

  let patternIndex = 0;
  let pathIndex = 0;

  while (patternIndex < patternParts.length) {
    const patternPart = patternParts[patternIndex];

    // Optional catch-all: [[...param]]
    if (patternPart.startsWith("[[...") && patternPart.endsWith("]]")) {
      const paramName = patternPart.slice(5, -2);

      // Match remaining path parts (can be empty)
      if (pathIndex < pathParts.length) {
        params[paramName] = pathParts.slice(pathIndex).join("/");
      } else {
        params[paramName] = "";
      }

      return params;
    }

    // Required catch-all: [...param]
    if (patternPart.startsWith("[...") && patternPart.endsWith("]")) {
      const paramName = patternPart.slice(4, -1);

      // Must have at least one segment
      if (pathIndex >= pathParts.length) {
        return null;
      }

      // Match remaining path parts
      params[paramName] = pathParts.slice(pathIndex).join("/");
      return params;
    }

    // Dynamic segment: [param]
    if (patternPart.startsWith("[") && patternPart.endsWith("]")) {
      if (pathIndex >= pathParts.length) {
        return null; // No corresponding path part
      }

      const paramName = patternPart.slice(1, -1);
      params[paramName] = pathParts[pathIndex];
      patternIndex++;
      pathIndex++;
      continue;
    }

    // Static segment - must match exactly
    if (pathIndex >= pathParts.length || patternPart !== pathParts[pathIndex]) {
      return null;
    }

    patternIndex++;
    pathIndex++;
  }

  // Path must be fully consumed unless pattern ends with catch-all
  if (pathIndex !== pathParts.length) {
    return null;
  }

  return params;
}

/**
 * Create dynamic router middleware for views
 *
 * Supports file-based routing patterns:
 * - `/users` → 'users' view
 * - `/users/123` → 'users/[id]' view with params.id = '123'
 * - `/docs/a/b/c` → 'docs/[...slug]' view with params.slug = 'a/b/c'
 * - `/docs` or `/docs/x` → 'docs/[[...slug]]' view (optional catch-all)
 *
 * @example
 * // Views structure:
 * {
 *   'index': IndexPage,
 *   'users': UsersPage,
 *   'users/[id]': UserDetailPage,
 *   'docs/[...slug]': DocsPage,
 *   'blog/[[...slug]]': BlogPage,
 * }
 */
export const createDynamicRouter = (views: Record<string, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Remove leading slash
    const path = req.path.substring(1);

    // Try to match the route
    const match = matchRoute(views, path);

    if (match) {
      return res.renderPage(match.viewName, {}, match.params);
    }

    // If not found, pass to the next middleware (usually 404 handler)
    next();
  };
};

/**
 * Utility to generate a URL from a view name and params
 *
 * @example
 * generateViewUrl('users/[id]', { id: '123' }); // '/users/123'
 * generateViewUrl('docs/[...slug]', { slug: 'api/auth' }); // '/docs/api/auth'
 */
export function generateViewUrl(
  viewName: string,
  params: Record<string, string> = {}
): string {
  let url = viewName;

  // Replace dynamic segments with params
  for (const [key, value] of Object.entries(params)) {
    // Match catch-all patterns
    url = url.replace(`[...${key}]`, value);
    url = url.replace(`[[...${key}]]`, value);
    // Match dynamic segments
    url = url.replace(`[${key}]`, value);
  }

  // Handle empty optional catch-all
  url = url.replace(/\/\[\[\.\.\..*?\]\]/g, "");

  return `/${url}`;
}

/**
 * Get all routes from views with their patterns
 */
export function getViewRoutes(views: Record<string, any>): Array<{
  pattern: string;
  type: "static" | "dynamic" | "catch-all" | "optional-catch-all";
}> {
  return Object.keys(views).map((viewName) => {
    let type: "static" | "dynamic" | "catch-all" | "optional-catch-all" =
      "static";

    if (viewName.includes("[[...")) {
      type = "optional-catch-all";
    } else if (viewName.includes("[...")) {
      type = "catch-all";
    } else if (viewName.includes("[")) {
      type = "dynamic";
    }

    return {
      pattern: `/${viewName}`,
      type,
    };
  });
}

export { matchPattern, matchRoute };
