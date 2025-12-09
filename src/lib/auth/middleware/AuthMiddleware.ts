import { NextFunction, Request, Response } from "express";
import { Middleware } from "../../validation/http/Middleware";
import { JWTError, JWTService } from "../JWTService";
import { DecodedToken } from "../types";

/**
 * Authentication Middleware
 * Extracts and validates JWT tokens from requests
 * Implements security best practices for token handling
 */
export class AuthMiddleware implements Middleware {
  private static readonly TOKEN_REFRESH_HEADER = "X-Token-Refresh";
  private static readonly NEAR_EXPIRY_HEADER = "X-Token-Near-Expiry";

  async handle(req: Request, res: Response, next: NextFunction) {
    try {
      const token = this.extractToken(req);

      if (!token) {
        return next();
      }

      // Validate token format before verification
      if (!this.isValidTokenFormat(token)) {
        console.warn("AuthMiddleware: Invalid token format detected");
        return next();
      }

      // Get fingerprint for validation if enabled
      const fingerprint = this.extractFingerprint(req);

      const payload = await JWTService.verifyToken(token, {
        fingerprint,
        validateFingerprint: !!fingerprint,
      });

      // Attach user and token info to request
      req.user = payload;
      req.token = token;

      // Add header hint if token is near expiry (client can proactively refresh)
      if (payload.isNearExpiry) {
        res.setHeader(this.NEAR_EXPIRY_HEADER, "true");
      }

      next();
    } catch (err) {
      // Handle specific JWT errors
      if (err instanceof JWTError) {
        this.handleJWTError(err, res);
        return;
      }

      // Token invalid or expired, proceed without user
      // Guards/AuthenticatedMiddleware will handle 401 if needed
      console.warn(
        "AuthMiddleware: Token verification failed",
        (err as Error).message
      );
      next();
    }
  }

  /**
   * Extract token from request (Authorization header or cookie)
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header first (preferred for APIs)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      // Support both "Bearer" and "bearer" (case-insensitive)
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1];
      }
    }

    // Fall back to cookie (for web applications)
    if (req.cookies?.token) {
      return req.cookies.token;
    }

    // Check for token in query params (use with caution, only for specific cases like SSE)
    // This should generally be avoided as tokens in URLs can be logged
    if (req.query?.token && typeof req.query.token === "string") {
      console.warn("AuthMiddleware: Token in query params is insecure");
      return req.query.token;
    }

    return null;
  }

  /**
   * Extract fingerprint from request for validation
   */
  private extractFingerprint(req: Request): string | undefined {
    // Check for fingerprint cookie (set during login)
    if (req.cookies?.fp) {
      return req.cookies.fp;
    }

    // Or from header (for API clients)
    const fpHeader = req.headers["x-fingerprint"];
    if (fpHeader && typeof fpHeader === "string") {
      return fpHeader;
    }

    return undefined;
  }

  /**
   * Validate token format (basic structure check)
   */
  private isValidTokenFormat(token: string): boolean {
    // JWT format: header.payload.signature (3 parts separated by dots)
    const parts = token.split(".");
    if (parts.length !== 3) {
      return false;
    }

    // Check that each part is base64url encoded
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
    return parts.every((part) => base64UrlRegex.test(part) && part.length > 0);
  }

  /**
   * Handle JWT-specific errors
   */
  private handleJWTError(err: JWTError, res: Response): void {
    const errorResponses: Record<string, { status: number; message: string }> =
      {
        TOKEN_EXPIRED: { status: 401, message: "Token has expired" },
        TOKEN_REVOKED: { status: 401, message: "Token has been revoked" },
        TOKEN_INVALID: { status: 401, message: "Invalid token" },
        TOKEN_FAMILY_REVOKED: { status: 401, message: "Session invalidated" },
        FINGERPRINT_MISMATCH: {
          status: 401,
          message: "Token validation failed",
        },
      };

    const response = errorResponses[err.code] || {
      status: 401,
      message: "Authentication failed",
    };

    res.status(response.status).json({
      error: response.message,
      code: err.code,
    });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
      token?: string;
    }
  }
}
