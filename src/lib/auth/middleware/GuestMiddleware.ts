import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";

/**
 * Guest Middleware
 * Ensures user is NOT authenticated (for login/register pages)
 * Prevents authenticated users from accessing guest-only routes
 */
export class GuestMiddleware implements Middleware {
  private redirectUrl: string;
  private customMessage?: string;

  /**
   * Create middleware with redirect URL for authenticated users
   * @param redirectUrl URL to redirect authenticated users (default: "/")
   * @param customMessage Custom message for API responses
   */
  constructor(redirectUrl: string = "/", customMessage?: string) {
    this.redirectUrl = redirectUrl;
    this.customMessage = customMessage;
  }

  handle(req: Request, res: Response, next: NextFunction) {
    if (req.user) {
      return this.handleAuthenticated(req, res);
    }
    next();
  }

  /**
   * Handle already authenticated request
   */
  private handleAuthenticated(req: Request, res: Response): void {
    const isApiRequest = this.isApiRequest(req);

    if (isApiRequest) {
      res.status(403).json({
        success: false,
        error: this.customMessage || "Already authenticated",
        code: "ALREADY_AUTHENTICATED",
        timestamp: new Date().toISOString(),
      });
    } else {
      res.redirect(this.redirectUrl);
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
}

/**
 * Factory function to create GuestMiddleware with custom options
 */
export function guest(options?: {
  redirectUrl?: string;
  message?: string;
}): GuestMiddleware {
  return new GuestMiddleware(options?.redirectUrl, options?.message);
}
