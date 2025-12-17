import React from "react";
import { createSingletonContext } from "../utils/createSingletonContext";

/**
 * Navigation options for programmatic navigation
 */
export interface NavigateOptions {
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** State to pass to the destination */
  state?: any;
  /** Scroll to top after navigation (default: true) */
  scroll?: boolean;
  /** Shallow navigation - update URL without re-fetching data */
  shallow?: boolean;
}

/**
 * Router context type with full navigation capabilities
 */
export interface RouterContextType {
  // ============================================================================
  // Navigation Methods
  // ============================================================================

  /** Navigate to a URL (fire-and-forget) */
  navigateTo: (url: string, options?: NavigateOptions) => void;

  /** Navigate to a URL (returns promise) */
  navigateToAsync?: (url: string, options?: NavigateOptions) => Promise<void>;

  /** Navigate using push (alias for navigateTo) */
  push: (url: string, options?: NavigateOptions) => void;

  /** Replace current history entry with new URL */
  replace: (url: string, options?: NavigateOptions) => void;

  /** Go back in history */
  back: () => void;

  /** Go forward in history */
  forward: () => void;

  /** Refresh current page data */
  refresh: () => Promise<void>;

  /** Prefetch a route for faster navigation */
  prefetchRoute?: (url: string) => Promise<void>;

  // ============================================================================
  // Current Route State
  // ============================================================================

  /** Current page name */
  currentPage: string;

  /** Current URL path */
  currentUrl: string;

  /** Alias for currentUrl */
  pathname: string;

  /** Route parameters (dynamic segments) */
  params: Record<string, string>;

  /** Parsed query string parameters */
  query: Record<string, string | string[]>;

  /** Navigation state passed via options */
  state?: any;

  // ============================================================================
  // Authentication & Security
  // ============================================================================

  /** CSRF token for form submissions */
  csrfToken?: string;

  // ============================================================================
  // Navigation Events & State
  // ============================================================================

  /** Whether navigation is in progress */
  isNavigating: boolean;

  /** Callback when navigation completes */
  onNavigate?: (url: string) => void;

  /** Previous URL before navigation */
  previousUrl?: string;
}

export const RouterContext = createSingletonContext<RouterContextType | null>(
  "RouterContext",
  null
);

export const RouterProvider: React.FC<{
  value: RouterContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
};

/**
 * Parse query string into object
 */
export function parseQueryString(
  search: string
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  if (typeof window === "undefined") return query;

  const params = new URLSearchParams(search);
  params.forEach((value, key) => {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  });

  return query;
}

/**
 * Serialize query object to string
 */
export function serializeQueryString(
  query: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.set(key, value);
    }
  }

  const str = params.toString();
  return str ? `?${str}` : "";
}
