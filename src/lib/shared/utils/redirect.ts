/**
 * Universal Redirect Utility
 *
 * Works seamlessly in both SSR (Server-Side Rendering) and SPA (Single Page Application) contexts.
 *
 * @example
 * // In a page component
 * if (!user.isAuthenticated) {
 *   redirect('/login');
 * }
 *
 * // Permanent redirect
 * permanentRedirect('/new-location');
 *
 * // With custom status
 * redirect('/dashboard', 307);
 */

import type { Response } from "express";

/**
 * Redirect error class - thrown during SSR to signal redirect
 */
export class RedirectError extends Error {
  public readonly url: string;
  public readonly statusCode: number;
  public readonly isRedirect = true;

  constructor(url: string, statusCode: number = 302) {
    super(`Redirect to ${url}`);
    this.name = "RedirectError";
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * SSR context for redirect handling
 */
interface SSRContext {
  response?: Response;
  isSSR: boolean;
}

// Global SSR context (set during server-side rendering)
let ssrContext: SSRContext | null = null;

/**
 * Set SSR context for redirect handling
 * Called by the server during SSR rendering
 */
export function setSSRContext(ctx: SSRContext | null): void {
  ssrContext = ctx;
}

/**
 * Get current SSR context
 */
export function getSSRContext(): SSRContext | null {
  return ssrContext;
}

// Client-side navigation function (set by RouterContext)
let clientNavigate:
  | ((url: string, options?: { replace?: boolean }) => void)
  | null = null;

/**
 * Set client-side navigation function
 * Called by ArcanaJSApp on initialization
 */
export function setClientNavigate(
  fn: ((url: string, options?: { replace?: boolean }) => void) | null
): void {
  clientNavigate = fn;
}

/**
 * Redirect to a new URL
 *
 * Works in both SSR and SPA contexts:
 * - **SSR**: Sets response redirect and throws RedirectError to stop rendering
 * - **SPA**: Uses client-side navigation with history replacement
 *
 * @param url - The URL to redirect to
 * @param statusCode - HTTP status code (default: 302)
 *
 * @example
 * // Basic redirect
 * redirect('/login');
 *
 * // With status code
 * redirect('/dashboard', 307);
 *
 * // In a component
 * function ProtectedPage({ data }) {
 *   if (!data.isAuthenticated) {
 *     redirect('/login');
 *   }
 *   return <Dashboard />;
 * }
 */
export function redirect(url: string, statusCode: number = 302): never {
  // Check for SSR context first
  if (ssrContext?.isSSR && ssrContext.response) {
    // Server-side: use HTTP redirect
    ssrContext.response.redirect(statusCode, url);
    throw new RedirectError(url, statusCode);
  }

  // Client-side: use navigation
  if (typeof window !== "undefined") {
    if (clientNavigate) {
      // Use ArcanaJS navigation with replace
      clientNavigate(url, { replace: true });
    } else {
      // Fallback to window.location
      window.location.replace(url);
    }
  }

  // Throw redirect error to stop execution
  throw new RedirectError(url, statusCode);
}

/**
 * Permanent redirect (301)
 *
 * @param url - The URL to redirect to
 *
 * @example
 * permanentRedirect('/new-page');
 */
export function permanentRedirect(url: string): never {
  return redirect(url, 301);
}

/**
 * Temporary redirect (307 - preserves HTTP method)
 *
 * @param url - The URL to redirect to
 *
 * @example
 * temporaryRedirect('/maintenance');
 */
export function temporaryRedirect(url: string): never {
  return redirect(url, 307);
}

/**
 * Check if an error is a redirect error
 */
export function isRedirectError(error: unknown): error is RedirectError {
  return (
    error instanceof RedirectError ||
    (error !== null &&
      typeof error === "object" &&
      "isRedirect" in error &&
      (error as any).isRedirect === true)
  );
}

/**
 * Navigate without throwing (for conditional navigation)
 * Returns false if navigation was not possible
 *
 * @param url - The URL to navigate to
 * @param options - Navigation options
 *
 * @example
 * if (!navigateTo('/dashboard', { replace: true })) {
 *   console.log('Navigation not available');
 * }
 */
export function navigateTo(
  url: string,
  options: { replace?: boolean } = {}
): boolean {
  // SSR context
  if (ssrContext?.isSSR && ssrContext.response) {
    ssrContext.response.redirect(options.replace ? 301 : 302, url);
    return true;
  }

  // Client-side
  if (typeof window !== "undefined") {
    if (clientNavigate) {
      clientNavigate(url, options);
      return true;
    } else {
      if (options.replace) {
        window.location.replace(url);
      } else {
        window.location.href = url;
      }
      return true;
    }
  }

  return false;
}
