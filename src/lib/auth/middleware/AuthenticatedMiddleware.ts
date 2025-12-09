import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";
import { AuthErrorCode } from "../types";

/**
 * Authenticated Middleware
 * Ensures user is authenticated before accessing protected routes
 * Provides consistent error responses for unauthenticated requests
 */
export class AuthenticatedMiddleware implements Middleware {
  private redirectUrl?: string;
  private customMessage?: string;

  /**
   * Create middleware with optional redirect URL for web routes
   * @param redirectUrl URL to redirect unauthenticated users (for web apps)
   * @param customMessage Custom error message
   */
  constructor(redirectUrl?: string, customMessage?: string) {
    this.redirectUrl = redirectUrl;
    this.customMessage = customMessage;
  }

  handle(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      return this.handleUnauthenticated(req, res);
    }

    // Check if token is near expiry and add hint
    if (req.user.isNearExpiry) {
      res.setHeader("X-Token-Near-Expiry", "true");
    }

    next();
  }

  /**
   * Handle unauthenticated request
   */
  private handleUnauthenticated(req: Request, res: Response): void {
    // Check if request expects JSON response
    const isApiRequest = this.isApiRequest(req);

    if (isApiRequest) {
      this.sendJsonError(res);
    } else if (this.redirectUrl) {
      this.redirectToLogin(req, res);
    } else {
      this.sendJsonError(res);
    }
  }

  /**
   * Check if request is an API request expecting JSON
   */
  private isApiRequest(req: Request): boolean {
    return !!(
      req.get("X-ArcanaJS-Request") ||
      req.xhr ||
      req.headers.accept?.includes("application/json") ||
      req.path.startsWith("/api/")
    );
  }

  /**
   * Send JSON error response
   */
  private sendJsonError(res: Response): void {
    res.status(401).json({
      success: false,
      error: this.customMessage || "Authentication required",
      code: AuthErrorCode.INVALID_CREDENTIALS,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Redirect to login page with return URL
   */
  private redirectToLogin(req: Request, res: Response): void {
    // Store the intended destination for post-login redirect
    const returnUrl = encodeURIComponent(req.originalUrl);
    const separator = this.redirectUrl!.includes("?") ? "&" : "?";
    res.redirect(`${this.redirectUrl}${separator}returnUrl=${returnUrl}`);
  }
}

/**
 * Factory function to create AuthenticatedMiddleware with custom options
 */
export function authenticated(options?: {
  redirectUrl?: string;
  message?: string;
}): AuthenticatedMiddleware {
  return new AuthenticatedMiddleware(options?.redirectUrl, options?.message);
}
